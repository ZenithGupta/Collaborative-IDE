import { useEffect, useState, useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  FileCode,
  Play,
  Sparkles,
  Download,
  Eye,
  FolderTree,
} from 'lucide-react';
import { ProjectFile } from '@/components/FileExplorer';

interface CommandPaletteProps {
  files: ProjectFile[];
  onFileSelect: (file: ProjectFile) => void;
  onRunCode: () => void;
  onToggleAI: () => void;
  onExportProject: () => void;
  onTogglePreview: () => void;
}

export function CommandPalette({
  files,
  onFileSelect,
  onRunCode,
  onToggleAI,
  onExportProject,
  onTogglePreview,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fileItems = useMemo(
    () => files.filter(f => !f.is_folder),
    [files]
  );

  function selectFile(file: ProjectFile) {
    onFileSelect(file);
    setOpen(false);
  }

  function runAction(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search files or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* File results */}
        <CommandGroup heading="Files">
          {fileItems.map(file => (
            <CommandItem
              key={file.id}
              value={`file:${file.path}`}
              onSelect={() => selectFile(file)}
            >
              <FileCode className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{file.name}</span>
              {file.path !== file.name && (
                <span className="ml-2 text-xs text-muted-foreground truncate">
                  {file.path}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Action results */}
        <CommandGroup heading="Actions">
          <CommandItem
            value="action:run-code"
            onSelect={() => runAction(onRunCode)}
          >
            <Play className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Run Code</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Execute current file
            </span>
          </CommandItem>

          <CommandItem
            value="action:toggle-ai"
            onSelect={() => runAction(onToggleAI)}
          >
            <Sparkles className="mr-2 h-4 w-4 text-cyan-400" />
            <span>Toggle AI Sidebar</span>
          </CommandItem>

          <CommandItem
            value="action:toggle-preview"
            onSelect={() => runAction(onTogglePreview)}
          >
            <Eye className="mr-2 h-4 w-4 text-emerald-400" />
            <span>Toggle Live Preview</span>
          </CommandItem>

          <CommandItem
            value="action:export-project"
            onSelect={() => runAction(onExportProject)}
          >
            <Download className="mr-2 h-4 w-4 text-amber-400" />
            <span>Export Project as ZIP</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
