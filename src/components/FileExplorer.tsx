import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FolderOpen,
  Folder,
  FileCode,
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  FileJson,
  FileText,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  path: string;
  content: string | null;
  is_folder: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface FileExplorerProps {
  projectId: string;
  files: ProjectFile[];
  selectedFileId: string | null;
  onFileSelect: (file: ProjectFile) => void;
  canManageFiles: boolean;
  canEdit: boolean;
}

function getFileIcon(name: string, isFolder: boolean, isOpen?: boolean) {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 text-amber-500" />
    ) : (
      <Folder className="h-4 w-4 text-amber-500" />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-yellow-400" />;
    case 'ts':
    case 'tsx':
      return <FileCode className="h-4 w-4 text-blue-400" />;
    case 'py':
      return <FileCode className="h-4 w-4 text-green-400" />;
    case 'java':
      return <FileCode className="h-4 w-4 text-orange-400" />;
    case 'cpp':
    case 'c':
    case 'h':
      return <FileCode className="h-4 w-4 text-purple-400" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-300" />;
    case 'md':
    case 'txt':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'html':
      return <FileCode className="h-4 w-4 text-orange-500" />;
    case 'css':
      return <FileCode className="h-4 w-4 text-blue-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

interface FileTreeItemProps {
  file: ProjectFile;
  files: ProjectFile[];
  selectedFileId: string | null;
  onFileSelect: (file: ProjectFile) => void;
  onCreateFile: (parentId: string | null, isFolder: boolean) => void;
  onDelete: (file: ProjectFile) => void;
  onRename: (file: ProjectFile) => void;
  depth: number;
  canManageFiles: boolean;
  canEdit: boolean;
}

function FileTreeItem({
  file,
  files,
  selectedFileId,
  onFileSelect,
  onCreateFile,
  onDelete,
  onRename,
  depth,
  canManageFiles,
  canEdit,
}: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const children = files.filter((f) => f.parent_id === file.id);

  if (file.is_folder) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <ContextMenu>
          <ContextMenuTrigger>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center gap-1 px-2 py-1 rounded-sm text-sm hover:bg-sidebar-accent transition-colors',
                  'text-left'
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
              >
                {isOpen ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                {getFileIcon(file.name, true, isOpen)}
                <span className="truncate">{file.name}</span>
              </button>
            </CollapsibleTrigger>
          </ContextMenuTrigger>
          {canManageFiles && (
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onCreateFile(file.id, false)}>
                <FilePlus className="h-4 w-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreateFile(file.id, true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onRename(file)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onDelete(file)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>
        <CollapsibleContent>
          {children
            .sort((a, b) => {
              if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
                <FileTreeItem
                  key={child.id}
                  file={child}
                  files={files}
                  selectedFileId={selectedFileId}
                  onFileSelect={onFileSelect}
                  onCreateFile={onCreateFile}
                  onDelete={onDelete}
                  onRename={onRename}
                  depth={depth + 1}
                  canManageFiles={canManageFiles}
                  canEdit={canEdit}
                />
            ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={() => onFileSelect(file)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1 rounded-sm text-sm hover:bg-sidebar-accent transition-colors',
            'text-left',
            selectedFileId === file.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
          )}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
        >
          {getFileIcon(file.name, false)}
          <span className="truncate">{file.name}</span>
        </button>
      </ContextMenuTrigger>
      {canManageFiles && (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onRename(file)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onDelete(file)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}

export function FileExplorer({
  projectId,
  files,
  selectedFileId,
  onFileSelect,
  isOwner,
}: FileExplorerProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState<{ parentId: string | null; isFolder: boolean } | null>(null);
  const [isRenaming, setIsRenaming] = useState<ProjectFile | null>(null);
  const [newName, setNewName] = useState('');

  const createFile = useMutation({
    mutationFn: async ({ name, parentId, isFolder }: { name: string; parentId: string | null; isFolder: boolean }) => {
      const parentPath = parentId 
        ? files.find(f => f.id === parentId)?.path || ''
        : '';
      const path = parentPath ? `${parentPath}/${name}` : name;

      const { data, error } = await supabase
        .from('project_files')
        .insert({
          project_id: projectId,
          name,
          path,
          is_folder: isFolder,
          parent_id: parentId,
          content: isFolder ? null : '',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success(`${data.is_folder ? 'Folder' : 'File'} created!`);
      setIsCreating(null);
      setNewName('');
      if (!data.is_folder) {
        onFileSelect(data);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create');
    },
  });

  const renameFile = useMutation({
    mutationFn: async ({ id, name, oldPath }: { id: string; name: string; oldPath: string }) => {
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = name;
      const newPath = pathParts.join('/');

      const { error } = await supabase
        .from('project_files')
        .update({ name, path: newPath })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success('Renamed successfully!');
      setIsRenaming(null);
      setNewName('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to rename');
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;
      return file;
    },
    onSuccess: (file) => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success(`${file.is_folder ? 'Folder' : 'File'} deleted!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete');
    },
  });

  const handleCreate = useCallback((parentId: string | null, isFolder: boolean) => {
    setIsCreating({ parentId, isFolder });
    setNewName('');
  }, []);

  const handleRename = useCallback((file: ProjectFile) => {
    setIsRenaming(file);
    setNewName(file.name);
  }, []);

  const handleSubmitCreate = () => {
    if (!newName.trim() || !isCreating) return;
    createFile.mutate({
      name: newName.trim(),
      parentId: isCreating.parentId,
      isFolder: isCreating.isFolder,
    });
  };

  const handleSubmitRename = () => {
    if (!newName.trim() || !isRenaming) return;
    renameFile.mutate({
      id: isRenaming.id,
      name: newName.trim(),
      oldPath: isRenaming.path,
    });
  };

  const rootFiles = files
    .filter((f) => f.parent_id === null)
    .sort((a, b) => {
      if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </h3>
        {isOwner && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCreate(null, false)}
            >
              <FilePlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCreate(null, true)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto py-1">
        {/* Creation input */}
        {isCreating && isCreating.parentId === null && (
          <div className="px-2 py-1">
            <Input
              autoFocus
              placeholder={isCreating.isFolder ? 'Folder name' : 'File name'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitCreate();
                if (e.key === 'Escape') setIsCreating(null);
              }}
              onBlur={() => {
                if (newName.trim()) handleSubmitCreate();
                else setIsCreating(null);
              }}
              className="h-7 text-sm"
            />
          </div>
        )}

        {/* Rename input */}
        {isRenaming && (
          <div className="px-2 py-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitRename();
                if (e.key === 'Escape') setIsRenaming(null);
              }}
              onBlur={() => {
                if (newName.trim()) handleSubmitRename();
                else setIsRenaming(null);
              }}
              className="h-7 text-sm"
            />
          </div>
        )}

        {rootFiles.map((file) => (
          <FileTreeItem
            key={file.id}
            file={file}
            files={files}
            selectedFileId={selectedFileId}
            onFileSelect={onFileSelect}
            onCreateFile={handleCreate}
            onDelete={(f) => deleteFile.mutate(f)}
            onRename={handleRename}
            depth={0}
            isOwner={isOwner}
          />
        ))}

        {files.length === 0 && !isCreating && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">No files yet</p>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCreate(null, false)}
              >
                <FilePlus className="h-3.5 w-3.5 mr-1" />
                Create File
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
