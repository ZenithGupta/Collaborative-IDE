import { useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LivePreviewProps {
  srcdoc: string;
  className?: string;
}

type ViewportSize = 'responsive' | 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_SIZES: Record<ViewportSize, { width: string; label: string }> = {
  responsive: { width: '100%', label: 'Responsive' },
  desktop: { width: '1280px', label: '1280px' },
  tablet: { width: '768px', label: '768px' },
  mobile: { width: '375px', label: '375px' },
};

export function LivePreview({ srcdoc, className }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>('responsive');
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = useCallback(() => {
    // Force iframe re-mount by changing the key
    setIframeKey(prev => prev + 1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    // Open the preview in a new tab
    const blob = new Blob([srcdoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [srcdoc]);

  const hasContent = srcdoc.trim().length > 0;

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-card/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Viewport toggles */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6',
                  viewport === 'responsive' && 'bg-secondary text-foreground'
                )}
                onClick={() => setViewport('responsive')}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Responsive</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6',
                  viewport === 'desktop' && 'bg-secondary text-foreground'
                )}
                onClick={() => setViewport('desktop')}
              >
                <Monitor className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Desktop (1280px)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6',
                  viewport === 'tablet' && 'bg-secondary text-foreground'
                )}
                onClick={() => setViewport('tablet')}
              >
                <Tablet className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tablet (768px)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6',
                  viewport === 'mobile' && 'bg-secondary text-foreground'
                )}
                onClick={() => setViewport('mobile')}
              >
                <Smartphone className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mobile (375px)</TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border/50 mx-1" />

          {/* Refresh */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh preview</TooltipContent>
          </Tooltip>

          {/* Open in new tab */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleOpenExternal}
                disabled={!hasContent}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in new tab</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-white relative">
        {hasContent ? (
          <div
            className="h-full mx-auto transition-all duration-200"
            style={{
              width: VIEWPORT_SIZES[viewport].width,
              maxWidth: '100%',
            }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={srcdoc}
              title="Live Preview"
              sandbox="allow-scripts allow-modals allow-forms allow-popups"
              className="w-full h-full border-0"
              style={{
                backgroundColor: '#ffffff',
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No HTML, CSS, or JS files to preview
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create an <code className="px-1 py-0.5 bg-secondary rounded text-xs">index.html</code> file to get started
              </p>
            </div>
          </div>
        )}

        {/* Viewport size indicator (non-responsive modes) */}
        {viewport !== 'responsive' && hasContent && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono pointer-events-none">
            {VIEWPORT_SIZES[viewport].label}
          </div>
        )}
      </div>
    </div>
  );
}
