import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Code2,
  Play,
  Loader2,
  ArrowLeft,
  Users,
  Terminal,
  Copy,
  Check,
  Settings,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

const LANGUAGE_MAP: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  html: 'html',
  css: 'css',
};

export default function Project() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeUsers, setActiveUsers] = useState<{ id: string; username: string; avatar_url?: string }[]>([]);

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Set initial code
  useEffect(() => {
    if (project?.code) {
      setCode(project.code);
    }
  }, [project?.code]);

  // Save code mutation (debounced)
  const saveCode = useMutation({
    mutationFn: async (newCode: string) => {
      if (!projectId) return;
      const { error } = await supabase
        .from('projects')
        .update({ code: newCode })
        .eq('id', projectId);
      if (error) throw error;
    },
    onError: () => {
      toast.error('Failed to save');
    },
  });

  // Debounced save
  const handleCodeChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      // Debounce save
      const timeout = setTimeout(() => {
        saveCode.mutate(value);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [projectId]);

  // Set up realtime presence
  useEffect(() => {
    if (!projectId || !user) return;

    const channel = supabase.channel(`project:${projectId}`);

    interface PresencePayload {
      id: string;
      username: string;
      avatar_url?: string;
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const users = Object.values(state).flat();
        setActiveUsers(users.filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            username: user.email?.split('@')[0] || 'Anonymous',
            avatar_url: user.user_metadata?.avatar_url,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, user]);

  // Run code
  const runCode = () => {
    setIsRunning(true);
    setOutput([]);

    try {
      if (project?.language === 'javascript' || project?.language === 'typescript') {
        // Capture console.log output
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args) => {
          logs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        };

        try {
          // Execute the code
          const result = eval(code);
          if (result !== undefined) {
            logs.push(`→ ${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}`);
          }
        } catch (err) {
          logs.push(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
        }

        console.log = originalLog;
        setOutput(logs.length ? logs : ['✓ Code executed successfully (no output)']);
      } else if (project?.language === 'python') {
        // Mock Python execution
        setOutput([
          '🐍 Python execution simulated',
          '→ print() outputs would appear here',
          '(Full Python support coming soon!)',
        ]);
      } else if (project?.language === 'html') {
        // For HTML, we could open in a new tab
        setOutput(['🌐 HTML preview would open in a new tab']);
      } else {
        setOutput([`⚠️ Execution not supported for ${project?.language} yet`]);
      }
    } catch (err) {
      setOutput([`❌ Error: ${err instanceof Error ? err.message : String(err)}`]);
    }

    setIsRunning(false);
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded gradient-primary">
              <Code2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">{project.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {project.language}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active users */}
          {activeUsers.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {activeUsers.slice(0, 4).map((u) => (
                  <Tooltip key={u.id}>
                    <TooltipTrigger asChild>
                      <Avatar className="h-7 w-7 border-2 border-background">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {u.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{u.username}</TooltipContent>
                  </Tooltip>
                ))}
                {activeUsers.length > 4 && (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                    +{activeUsers.length - 4}
                  </div>
                )}
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={copyShareLink}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
            Share
          </Button>

          <Button size="sm" className="gradient-primary" onClick={runCode} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Run
          </Button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Sidebar */}
          <Panel defaultSize={15} minSize={10} maxSize={25}>
            <div className="h-full border-r border-border/50 bg-sidebar p-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Collaborators
              </h3>
              <div className="space-y-2">
                {activeUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-sidebar-accent">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {u.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{u.username}</span>
                    <span className="ml-auto h-2 w-2 rounded-full bg-success animate-pulse" />
                  </div>
                ))}
                {activeUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No other users online</p>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border/30 hover:bg-primary/50 transition-colors" />

          {/* Editor + Terminal */}
          <Panel defaultSize={85}>
            <PanelGroup direction="vertical">
              {/* Editor */}
              <Panel defaultSize={70} minSize={30}>
                <div className="h-full bg-editor">
                  <Editor
                    height="100%"
                    language={LANGUAGE_MAP[project.language] || 'plaintext'}
                    value={code}
                    onChange={handleCodeChange}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      fontFamily: 'JetBrains Mono, monospace',
                      minimap: { enabled: false },
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      renderLineHighlight: 'all',
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      tabSize: 2,
                    }}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="h-1 bg-border/30 hover:bg-primary/50 transition-colors" />

              {/* Terminal/Output */}
              <Panel defaultSize={30} minSize={15}>
                <div className="h-full bg-terminal border-t border-border/50">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Terminal className="h-4 w-4" />
                      <span>Output</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setOutput([])}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="p-4 font-mono text-sm overflow-auto h-[calc(100%-41px)]">
                    {output.length === 0 ? (
                      <span className="text-muted-foreground">
                        Click "Run" to execute your code...
                      </span>
                    ) : (
                      output.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap">
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
