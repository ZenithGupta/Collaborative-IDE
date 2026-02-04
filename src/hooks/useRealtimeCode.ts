import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ActiveUser {
  id: string;
  username: string;
  avatar_url?: string;
  isTyping?: boolean;
  currentFile?: string;
}

interface UseRealtimeCodeOptions {
  projectId: string | undefined;
  currentFileId: string | null;
  currentFileName: string | null;
  initialCode: string;
  onCodeChange: (code: string) => void;
}

export function useRealtimeCode({ 
  projectId, 
  currentFileId,
  currentFileName,
  initialCode, 
  onCodeChange 
}: UseRealtimeCodeOptions) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const isLocalChangeRef = useRef(false);
  const lastBroadcastRef = useRef<string>('');
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

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
      fileId: string | null;
    }

    interface PresencePayload {
      id: string;
      username: string;
      avatar_url?: string;
      isTyping?: boolean;
      currentFile?: string;
    }

    // Listen for code broadcasts from other users
    channel.on('broadcast', { event: 'code_update' }, (payload) => {
      const data = payload.payload as CodePayload;
      // Only update if same file and from different user
      if (data.userId !== user.id && data.fileId === currentFileId) {
        console.log('[Realtime] Received code update from:', data.userId);
        isLocalChangeRef.current = true;
        onCodeChange(data.code);
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
          isTyping: false,
          currentFile: currentFileName || undefined,
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
  }, [projectId, user, currentFileId, currentFileName, onCodeChange]);

  // Update presence when file changes
  useEffect(() => {
    if (!channelRef.current || !user) return;
    
    channelRef.current.track({
      id: user.id,
      username: user.email?.split('@')[0] || 'Anonymous',
      avatar_url: user.user_metadata?.avatar_url,
      isTyping: false,
      currentFile: currentFileName || undefined,
    });
  }, [currentFileName, user]);

  // Broadcast code changes to other users
  const broadcastCode = useCallback((code: string) => {
    if (!channelRef.current || !user || isLocalChangeRef.current) return;
    
    // Avoid broadcasting the same code twice
    if (code === lastBroadcastRef.current) return;
    lastBroadcastRef.current = code;

    // Set typing indicator
    channelRef.current.track({
      id: user.id,
      username: user.email?.split('@')[0] || 'Anonymous',
      avatar_url: user.user_metadata?.avatar_url,
      isTyping: true,
      currentFile: currentFileName || undefined,
    });

    // Clear typing after delay
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (channelRef.current && user) {
        channelRef.current.track({
          id: user.id,
          username: user.email?.split('@')[0] || 'Anonymous',
          avatar_url: user.user_metadata?.avatar_url,
          isTyping: false,
          currentFile: currentFileName || undefined,
        });
      }
    }, 1500);

    channelRef.current.send({
      type: 'broadcast',
      event: 'code_update',
      payload: { code, userId: user.id, fileId: currentFileId },
    });
  }, [user, currentFileId, currentFileName]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    activeUsers,
    broadcastCode,
    isRemoteChange: isLocalChangeRef.current,
  };
}
