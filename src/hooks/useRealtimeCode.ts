import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeCodeOptions {
  projectId: string | undefined;
  initialCode: string;
  onCodeChange: (code: string) => void;
}

export function useRealtimeCode({ projectId, initialCode, onCodeChange }: UseRealtimeCodeOptions) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [activeUsers, setActiveUsers] = useState<{ id: string; username: string; avatar_url?: string }[]>([]);
  const isLocalChangeRef = useRef(false);
  const lastBroadcastRef = useRef<string>('');

  // Subscribe to realtime code changes via broadcast
  useEffect(() => {
    if (!projectId || !user) return;

    const channel = supabase.channel(`code:${projectId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });

    interface CodePayload {
      code: string;
      userId: string;
    }

    interface PresencePayload {
      id: string;
      username: string;
      avatar_url?: string;
    }

    // Listen for code broadcasts from other users
    channel.on('broadcast', { event: 'code_update' }, (payload) => {
      const data = payload.payload as CodePayload;
      if (data.userId !== user.id) {
        console.log('[Realtime] Received code update from:', data.userId);
        isLocalChangeRef.current = true;
        onCodeChange(data.code);
        // Reset flag after a short delay
        setTimeout(() => {
          isLocalChangeRef.current = false;
        }, 50);
      }
    });

    // Handle presence for showing active users
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const users = Object.values(state).flat();
        setActiveUsers(users.filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[Presence] User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('[Presence] User left:', leftPresences);
      });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: user.id,
          username: user.email?.split('@')[0] || 'Anonymous',
          avatar_url: user.user_metadata?.avatar_url,
        });
        console.log('[Realtime] Subscribed to channel:', `code:${projectId}`);
      }
    });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Unsubscribing from channel');
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, user, onCodeChange]);

  // Broadcast code changes to other users
  const broadcastCode = useCallback((code: string) => {
    if (!channelRef.current || !user || isLocalChangeRef.current) return;
    
    // Avoid broadcasting the same code twice
    if (code === lastBroadcastRef.current) return;
    lastBroadcastRef.current = code;

    channelRef.current.send({
      type: 'broadcast',
      event: 'code_update',
      payload: { code, userId: user.id },
    });
  }, [user]);

  return {
    activeUsers,
    broadcastCode,
    isRemoteChange: isLocalChangeRef.current,
  };
}
