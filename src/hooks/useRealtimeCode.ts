import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

interface ActiveUser {
  id: string;
  username: string;
  avatar_url?: string;
  isTyping?: boolean;
  currentFile?: string;
  currentFileId?: string;
  cursorPosition?: CursorPosition;
}

export interface AILockInfo {
  userId: string;
  username: string;
  sessionId?: string;
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
  const [aiLockedFiles, setAiLockedFiles] = useState<Map<string, AILockInfo>>(new Map());
  const [cancelRequests, setCancelRequests] = useState<{ requesterId: string; requesterName: string; fileId: string }[]>([]);
  const isLocalChangeRef = useRef(false);
  const lastBroadcastRef = useRef<string>('');
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const currentFileIdRef = useRef(currentFileId);
  const currentFileNameRef = useRef(currentFileName);
  const onCodeChangeRef = useRef(onCodeChange);

  // Keep refs in sync without re-subscribing the channel
  useEffect(() => { currentFileIdRef.current = currentFileId; }, [currentFileId]);
  useEffect(() => { currentFileNameRef.current = currentFileName; }, [currentFileName]);
  useEffect(() => { onCodeChangeRef.current = onCodeChange; }, [onCodeChange]);

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

    interface CursorPayload {
      userId: string;
      username: string;
      fileId: string | null;
      cursorPosition: CursorPosition;
    }

    interface PresencePayload {
      id: string;
      username: string;
      avatar_url?: string;
      isTyping?: boolean;
      currentFile?: string;
      currentFileId?: string;
      cursorPosition?: CursorPosition;
    }

    // Listen for code broadcasts from other users
    channel.on('broadcast', { event: 'code_update' }, (payload) => {
      const data = payload.payload as CodePayload;
      // Only update if same file and from different user
      if (data.userId !== user.id && data.fileId === currentFileIdRef.current) {
        console.log('[Realtime] Received code update from:', data.userId);
        isLocalChangeRef.current = true;
        onCodeChangeRef.current(data.code);
        setTimeout(() => {
          isLocalChangeRef.current = false;
        }, 50);
      }
    });

    // Listen for cursor position broadcasts from other users
    channel.on('broadcast', { event: 'cursor_update' }, (payload) => {
      const data = payload.payload as CursorPayload;
      if (data.userId === user.id) return;

      setActiveUsers(prev =>
        prev.map(u =>
          u.id === data.userId
            ? { ...u, cursorPosition: data.cursorPosition, currentFileId: data.fileId || undefined }
            : u
        )
      );
    });

    // AI Lock: another user started AI generation on a file
    channel.on('broadcast', { event: 'ai_lock' }, (payload) => {
      const data = payload.payload as {
        fileId: string;
        fileIds?: string[];
        userId: string;
        username: string;
        sessionId: string;
      };
      if (data.userId === user.id) return;

      const lockInfo: AILockInfo = {
        userId: data.userId,
        username: data.username,
        sessionId: data.sessionId,
      };

      setAiLockedFiles(prev => {
        const next = new Map(prev);
        // Lock individual file
        if (data.fileId) next.set(data.fileId, lockInfo);
        // Lock multiple files
        if (data.fileIds) {
          data.fileIds.forEach(fid => next.set(fid, lockInfo));
        }
        return next;
      });

      toast.info(`🤖 AI is editing files (by @${data.username})`, { duration: 4000 });
    });

    // AI Unlock: AI finished editing
    channel.on('broadcast', { event: 'ai_unlock' }, (payload) => {
      const data = payload.payload as {
        fileId?: string;
        fileIds?: string[];
        userId: string;
        username: string;
      };

      setAiLockedFiles(prev => {
        const next = new Map(prev);
        if (data.fileId) next.delete(data.fileId);
        if (data.fileIds) {
          data.fileIds.forEach(fid => next.delete(fid));
        }
        return next;
      });

      if (data.userId !== user.id) {
        toast.success(`🤖 AI finished editing (by @${data.username})`, { duration: 3000 });
      }
    });

    // AI Cancel Request: another user wants to cancel our AI
    channel.on('broadcast', { event: 'ai_cancel_request' }, (payload) => {
      const data = payload.payload as {
        requesterId: string;
        requesterName: string;
        fileId: string;
        sessionUserId: string;
      };

      // Only show if the request is directed at us
      if (data.sessionUserId === user.id) {
        setCancelRequests(prev => [...prev, {
          requesterId: data.requesterId,
          requesterName: data.requesterName,
          fileId: data.fileId,
        }]);

        toast.warning(
          `@${data.requesterName} is requesting you cancel the AI generation`,
          { duration: 10000 }
        );
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
          currentFile: currentFileNameRef.current || undefined,
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
  }, [projectId, user]);

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

  // Broadcast cursor position to other users
  const broadcastCursor = useCallback((position: CursorPosition) => {
    if (!channelRef.current || !user) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor_update',
      payload: {
        userId: user.id,
        username: user.email?.split('@')[0] || 'Anonymous',
        fileId: currentFileId,
        cursorPosition: position,
      },
    });
  }, [user, currentFileId]);

  // Broadcast AI lock/unlock events
  const broadcastAILock = useCallback((fileIds: string[], sessionId: string) => {
    if (!channelRef.current || !user) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'ai_lock',
      payload: {
        fileIds,
        userId: user.id,
        username: user.email?.split('@')[0] || 'Anonymous',
        sessionId,
      },
    });
  }, [user]);

  const broadcastAIUnlock = useCallback((fileIds: string[]) => {
    if (!channelRef.current || !user) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'ai_unlock',
      payload: {
        fileIds,
        userId: user.id,
        username: user.email?.split('@')[0] || 'Anonymous',
      },
    });
  }, [user]);

  // Dismiss a cancel request
  const dismissCancelRequest = useCallback((requesterId: string) => {
    setCancelRequests(prev => prev.filter(r => r.requesterId !== requesterId));
  }, []);

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
    broadcastCursor,
    broadcastAILock,
    broadcastAIUnlock,
    aiLockedFiles,
    cancelRequests,
    dismissCancelRequest,
    isRemoteChange: isLocalChangeRef.current,
  };
}
