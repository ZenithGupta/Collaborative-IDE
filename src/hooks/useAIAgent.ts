import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ProjectFile } from '@/components/FileExplorer';
import { toast } from 'sonner';

export type AISessionStatus = 'idle' | 'generating' | 'completed' | 'cancelled' | 'failed';

export interface AIAffectedFile {
  id: string | null;
  name: string;
  action: 'edit' | 'create';
  content?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  status?: AISessionStatus;
  affectedFiles?: AIAffectedFile[];
  tokensUsed?: number;
}

interface UseAIAgentOptions {
  projectId: string | undefined;
  files: ProjectFile[];
  selectedFileId: string | null;
}

export function useAIAgent({ projectId, files, selectedFileId }: UseAIAgentOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AISessionStatus>('idle');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [aiLockedFiles, setAiLockedFiles] = useState<Map<string, { userId: string; username: string }>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  // Generate code with AI
  const generateCode = useCallback(async (prompt: string, model?: string) => {
    if (!projectId || !user || status === 'generating') return;

    setStatus('generating');
    setStreamingText('');

    // Add user message
    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add AI placeholder
    const aiMsgId = crypto.randomUUID();
    const aiMsg: AIMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: new Date(),
      status: 'generating',
    };
    setMessages(prev => [...prev, aiMsg]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // Prepare all files as context
      const allFiles = files.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        content: f.content,
      }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt,
            projectId,
            fileId: selectedFileId,
            allFiles,
            model,
            reviewMode: false,
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      readerRef.current = reader;

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case 'session_start':
                setCurrentSessionId(event.sessionId);
                break;

              case 'chunk':
                accumulated += event.text;
                setStreamingText(accumulated);
                setMessages(prev =>
                  prev.map(m =>
                    m.id === aiMsgId ? { ...m, content: accumulated } : m
                  )
                );
                break;

              case 'complete':
                setMessages(prev =>
                  prev.map(m =>
                    m.id === aiMsgId
                      ? {
                          ...m,
                          content: event.plan || accumulated,
                          status: 'completed',
                          affectedFiles: event.affectedFiles,
                          tokensUsed: event.tokensUsed,
                        }
                      : m
                  )
                );
                setStatus('completed');
                setCurrentSessionId(null);

                if (event.affectedFiles?.length > 0) {
                  queryClient.setQueryData(['project-files', projectId], (oldData: ProjectFile[] | undefined) => {
                    if (!oldData) return oldData;
                    const newData = [...oldData];
                    for (const f of event.affectedFiles) {
                      if (f.action === 'edit' && f.content !== undefined) {
                        const index = newData.findIndex(x => x.id === f.id);
                        if (index !== -1) {
                          newData[index] = { ...newData[index], content: f.content, updated_at: new Date().toISOString() };
                        }
                      } else if (f.action === 'create' && f.id && f.content !== undefined) {
                        if (!newData.find(x => x.id === f.id)) {
                          newData.push({
                            id: f.id,
                            project_id: projectId!,
                            name: f.name,
                            path: f.name,
                            content: f.content,
                            is_folder: false,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          });
                        }
                      }
                    }
                    return newData;
                  });
                }

                queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
                
                if (event.affectedFiles?.length > 0) {
                  const fileNames = event.affectedFiles.map((f: AIAffectedFile) =>
                    `${f.action === 'create' ? '✨' : '✏️'} ${f.name}`
                  ).join(', ');
                  toast.success(`AI generated and applied changes for: ${fileNames}.`, {
                    duration: 5000,
                  });
                }
                break;

              case 'cancelled':
                setMessages(prev =>
                  prev.map(m =>
                    m.id === aiMsgId
                      ? { ...m, content: '⚠️ Generation cancelled.', status: 'cancelled' }
                      : m
                  )
                );
                setStatus('cancelled');
                setCurrentSessionId(null);
                toast.info('AI generation was cancelled.');
                break;

              case 'error':
                setMessages(prev =>
                  prev.map(m =>
                    m.id === aiMsgId
                      ? { ...m, content: `❌ ${event.error}`, status: 'failed' }
                      : m
                  )
                );
                setStatus('failed');
                setCurrentSessionId(null);
                toast.error(`AI error: ${event.error}`);
                break;
            }
          } catch {
            // Skip unparseable events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMsgId
              ? { ...m, content: '⚠️ Generation stopped.', status: 'cancelled' }
              : m
          )
        );
        setStatus('cancelled');
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMsgId
              ? { ...m, content: `❌ ${errMsg}`, status: 'failed' }
              : m
          )
        );
        setStatus('failed');
        toast.error(`AI error: ${errMsg}`);
      }
      setCurrentSessionId(null);
    }

    abortRef.current = null;
    readerRef.current = null;
    setStreamingText('');
  }, [projectId, user, files, selectedFileId, status]);

  // Stop current generation
  const stopGeneration = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (currentSessionId) {
      await supabase
        .from('ai_sessions' as any)
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', currentSessionId);
    }

    setStatus('cancelled');
    setCurrentSessionId(null);
  }, [currentSessionId]);

  // Send cancel request to another user's AI session
  const sendCancelRequest = useCallback(async (sessionUserId: string, fileId: string) => {
    if (!projectId) return;

    // Broadcast cancel request via realtime
    const channel = supabase.channel(`code:${projectId}`);
    await channel.send({
      type: 'broadcast',
      event: 'ai_cancel_request',
      payload: {
        requesterId: user?.id,
        requesterName: user?.email?.split('@')[0] || 'Someone',
        fileId,
        sessionUserId,
      },
    });

    toast.info('Cancel request sent. Waiting for the user to respond.');
  }, [projectId, user]);

  // Clear chat history
  const clearMessages = useCallback(() => {
    if (status === 'generating') return;
    setMessages([]);
  }, [status]);

  // Reset to idle
  useEffect(() => {
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      const timer = setTimeout(() => setStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return {
    status,
    messages,
    streamingText,
    currentSessionId,
    aiLockedFiles,
    setAiLockedFiles,
    generateCode,
    stopGeneration,
    sendCancelRequest,
    clearMessages,
  };
}
