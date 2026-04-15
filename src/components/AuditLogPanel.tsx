import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProjectFile } from './FileExplorer';
import { format } from 'date-fns';
import { LogIn, Edit, Sparkles, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export interface AuditLog {
  id: string;
  project_id: string;
  user_id: string;
  action: 'joined' | 'edited_manual' | 'edited_ai';
  file_name: string | null;
  created_at: string;
  user_email?: string; // We'll fetch this separately if possible
}

export function AuditLogPanel({ files }: { files: ProjectFile[] }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const historyFile = files.find(f => f.name === '.codevibe_history.json');
      if (historyFile && historyFile.content) {
        const parsed = JSON.parse(historyFile.content);
        setLogs(parsed);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error("Failed to parse history", e);
    }
  }, [files]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'joined': return <LogIn className="h-3.5 w-3.5 text-blue-400" />;
      case 'edited_manual': return <Edit className="h-3.5 w-3.5 text-orange-400" />;
      case 'edited_ai': return <Sparkles className="h-3.5 w-3.5 text-cyan-400" />;
      default: return <FileText className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  const getActionText = (log: AuditLog) => {
    const isMe = user?.id === log.user_id;
    const name = isMe ? 'You' : 'A user'; // Ideally we map UUID to username

    switch (log.action) {
      case 'joined': return `${name} joined session`;
      case 'edited_manual': return `${name} edited ${log.file_name || 'a file'}`;
      case 'edited_ai': return `AI modified ${log.file_name || 'a file'}`;
      default: return `${name} performed unknown action`;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border/30">
      <div className="p-3 border-b border-border/30 bg-card/80 flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground tracking-wide flex items-center gap-2">
          Project History
        </h3>
        <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
          Live
        </span>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        {loading ? (
          <div className="text-xs text-muted-foreground animate-pulse text-center mt-4">Loading history...</div>
        ) : logs.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center mt-4 pt-4 border-t border-border/10">No history available for this project.</div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[1.1rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/30 before:to-transparent">
            {logs.map((log) => (
              <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border border-border/50 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors group-hover:border-primary/50">
                  {getActionIcon(log.action)}
                </div>
                <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-border/30 bg-card/50 shadow-sm transition-all hover:bg-card hover:border-border/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground capitalize tracking-tight flex items-center gap-1.5">
                      {log.action.replace('_', ' ')}
                    </span>
                    <time className="text-[10px] font-mono text-muted-foreground bg-secondary/30 px-1.5 py-0.5 rounded">
                      {format(new Date(log.created_at), 'HH:mm - MMM d')}
                    </time>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {getActionText(log)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
