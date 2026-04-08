import { Bot, XCircle, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AILockBannerProps {
  lockedBy: {
    userId: string;
    username: string;
  };
  isCurrentUser: boolean;
  onStopGeneration?: () => void;
  onRequestCancel?: () => void;
}

export function AILockBanner({
  lockedBy,
  isCurrentUser,
  onStopGeneration,
  onRequestCancel,
}: AILockBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2',
        'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10',
        'border-b border-amber-500/20',
        'animate-in slide-in-from-top-2 duration-300'
      )}
    >
      <div className="flex items-center gap-2">
        {/* Pulsing bot icon */}
        <div className="relative">
          <div className="p-1 rounded-md bg-amber-500/20 border border-amber-500/30">
            <Bot className="h-4 w-4 text-amber-400" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" />
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-medium text-amber-200/90">
            AI is editing this file
          </span>
          <span className="text-xs text-amber-200/50">
            {isCurrentUser ? 'Your AI is generating code...' : `Requested by @${lockedBy.username}`}
          </span>
        </div>

        <Loader2 className="h-3.5 w-3.5 text-amber-400/70 animate-spin ml-1" />
      </div>

      <div className="flex items-center gap-2">
        {isCurrentUser ? (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs gap-1"
            onClick={onStopGeneration}
          >
            <Square className="h-3 w-3" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            onClick={onRequestCancel}
          >
            <XCircle className="h-3 w-3" />
            Request Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
