import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Bot,
  Send,
  Square,
  Trash2,
  Sparkles,
  Loader2,
  FileCode2,
  FilePlus,
  ChevronDown,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { AIMessage, AISessionStatus, AIAffectedFile } from '@/hooks/useAIAgent';

const AI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tag: 'default' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tag: '' },
  { value: 'qwen3-coder', label: 'Qwen3 Coder', tag: 'free' },
  { value: 'gemma-4-26b', label: 'Gemma 4 26B', tag: 'free' },
];

interface AIChatPanelProps {
  status: AISessionStatus;
  messages: AIMessage[];
  streamingText: string;
  onSubmit: (prompt: string, model?: string) => void;
  onStop: () => void;
  onClear: () => void;
  currentFileName?: string | null;
  canEdit: boolean;
  onReviewCode?: (code: string, fileName: string) => void;
}

export function AIChatPanel({
  status,
  messages,
  streamingText,
  onSubmit,
  onStop,
  onClear,
  currentFileName,
  canEdit,
  onReviewCode,
}: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || status === 'generating') return;
    onSubmit(trimmed, selectedModel);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const StatusBadge = () => {
    const badges: Record<AISessionStatus, { label: string; color: string; pulse?: boolean }> = {
      idle: { label: 'Ready', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      generating: { label: 'Generating...', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', pulse: true },
      completed: { label: 'Done', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      cancelled: { label: 'Cancelled', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
      failed: { label: 'Error', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    const badge = badges[status];
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border',
        badge.color
      )}>
        {badge.pulse && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {badge.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <span className="text-xs font-semibold text-foreground">AI Agent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge />
          {messages.length > 0 && status !== 'generating' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClear}
              title="Clear chat"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Context indicator */}
      {currentFileName && (
        <div className="px-3 py-1.5 bg-secondary/30 border-b border-border/20 flex items-center gap-1.5">
          <FileCode2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Context: <span className="text-foreground font-medium">{currentFileName}</span> + all project files
          </span>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 mb-3">
              <Bot className="h-8 w-8 text-cyan-400/60" />
            </div>
            <p className="text-sm font-medium text-foreground/80 mb-1">
              AI Coding Agent
            </p>
            <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
              Describe what you want to build or change. The AI will edit your project files directly.
            </p>
            <div className="mt-4 space-y-1.5 w-full max-w-[220px]">
              {[
                'Add error handling to all functions',
                'Create a login page component',
                'Refactor to use TypeScript interfaces',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left text-[11px] px-3 py-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onReviewCode={onReviewCode} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/30 p-2">
        <form onSubmit={handleSubmit} className="flex gap-1.5">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !canEdit
                  ? 'View-only mode'
                  : status === 'generating'
                  ? 'AI is generating...'
                  : 'Describe what to build...'
              }
              disabled={status === 'generating' || !canEdit}
              className={cn(
                'w-full resize-none rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm',
                'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30',
                'min-h-[36px] max-h-[120px]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '36px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          {status === 'generating' ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-9 w-9 shrink-0"
              onClick={onStop}
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              disabled={!input.trim() || !canEdit}
              title="Send prompt"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </form>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelMenuOpen(!modelMenuOpen)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-secondary/50"
            >
              <ChevronsUpDown className="h-2.5 w-2.5" />
              {AI_MODELS.find(m => m.value === selectedModel)?.label || 'Select model'}
            </button>
            {modelMenuOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-border/50 bg-popover shadow-lg z-50 py-1">
                {AI_MODELS.map((model) => (
                  <button
                    key={model.value}
                    onClick={() => { setSelectedModel(model.value); setModelMenuOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors text-left',
                      selectedModel === model.value && 'text-foreground' ,
                      selectedModel !== model.value && 'text-muted-foreground'
                    )}
                  >
                    <Check className={cn('h-3 w-3 shrink-0', selectedModel === model.value ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1">{model.label}</span>
                    {model.tag && (
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded-full',
                        model.tag === 'free' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary/20 text-primary'
                      )}>
                        {model.tag}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/50">Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  );
}

// Individual message bubble
function MessageBubble({ message, onReviewCode }: { message: AIMessage; onReviewCode?: (code: string, fileName: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === 'user';
  const isGenerating = message.status === 'generating';
  const hasAffectedFiles = message.affectedFiles && message.affectedFiles.length > 0;
  const content = message.content || '';
  const isLong = content.length > 400;

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className={cn(
          'shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
          isGenerating
            ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20'
            : message.status === 'failed'
            ? 'bg-red-500/20 border border-red-500/20'
            : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20'
        )}>
          {isGenerating ? (
            <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
          ) : (
            <Bot className="h-3 w-3 text-cyan-400" />
          )}
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white'
            : 'bg-secondary/50 border border-border/30 text-foreground'
        )}
      >
        {/* Message content */}
        <div className={cn(
          'whitespace-pre-wrap break-words text-xs leading-relaxed',
          isLong && !expanded && 'line-clamp-6'
        )}>
          {isGenerating && !content ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1 w-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1 w-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              Thinking...
            </span>
          ) : (
            content
          )}
        </div>

        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 mt-1"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Affected files */}
        {hasAffectedFiles && (
          <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Files changed
            </span>
            {message.affectedFiles!.map((f: AIAffectedFile, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                {f.action === 'create' ? (
                  <FilePlus className="h-3 w-3 text-emerald-400" />
                ) : (
                  <FileCode2 className="h-3 w-3 text-amber-400" />
                )}
                <span className="text-foreground/80">{f.name}</span>
                <span className="text-muted-foreground/50">
                  ({f.action === 'create' ? 'new' : 'edited'})
                </span>
                {f.content && onReviewCode && (
                  <button 
                    onClick={() => onReviewCode(f.content!, f.name)}
                    className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-2 py-0.5 rounded border border-cyan-500/30 transition-colors"
                  >
                    Review
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tokens */}
        {message.tokensUsed && (
          <div className="mt-1.5 text-[10px] text-muted-foreground/50">
            {message.tokensUsed.toLocaleString()} tokens
          </div>
        )}
      </div>
    </div>
  );
}
