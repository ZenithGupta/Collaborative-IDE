import { useState, useCallback, useEffect, useRef } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Copy,
  Clipboard,
  RefreshCw,
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

interface CreationState {
  parentId: string | null;
  isFolder: boolean;
}

function getFileIcon(name: string, isFolder: boolean, isOpen?: boolean) {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
    ) : (
      <Folder className="h-4 w-4 text-amber-500 shrink-0" />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-yellow-400 shrink-0" />;
    case 'ts':
    case 'tsx':
      return <FileCode className="h-4 w-4 text-blue-400 shrink-0" />;
    case 'py':
      return <FileCode className="h-4 w-4 text-green-400 shrink-0" />;
    case 'java':
      return <FileCode className="h-4 w-4 text-orange-400 shrink-0" />;
    case 'cpp':
    case 'c':
    case 'h':
      return <FileCode className="h-4 w-4 text-purple-400 shrink-0" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-300 shrink-0" />;
    case 'md':
    case 'txt':
      return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
    case 'html':
      return <FileCode className="h-4 w-4 text-orange-500 shrink-0" />;
    case 'css':
    case 'scss':
    case 'sass':
      return <FileCode className="h-4 w-4 text-blue-500 shrink-0" />;
    case 'go':
      return <FileCode className="h-4 w-4 text-cyan-400 shrink-0" />;
    case 'rs':
      return <FileCode className="h-4 w-4 text-orange-600 shrink-0" />;
    case 'rb':
      return <FileCode className="h-4 w-4 text-red-400 shrink-0" />;
    case 'php':
      return <FileCode className="h-4 w-4 text-indigo-400 shrink-0" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

interface InlineInputProps {
  placeholder: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  depth: number;
  icon: React.ReactNode;
}

function InlineInput({ placeholder, onSubmit, onCancel, depth, icon }: InlineInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5"
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {icon}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={handleSubmit}
        className="h-6 text-xs px-1.5 py-0"
      />
    </div>
  );
}

interface FileTreeItemProps {
  file: ProjectFile;
  files: ProjectFile[];
  selectedFileId: string | null;
  onFileSelect: (file: ProjectFile) => void;
  onCreateFile: (parentId: string | null, isFolder: boolean) => void;
  onDelete: (file: ProjectFile) => void;
  onRename: (file: ProjectFile) => void;
  onDuplicate: (file: ProjectFile) => void;
  onCopyPath: (file: ProjectFile) => void;
  creationState: CreationState | null;
  onCreationSubmit: (name: string) => void;
  onCreationCancel: () => void;
  renamingFile: ProjectFile | null;
  onRenameSubmit: (name: string) => void;
  onRenameCancel: () => void;
  depth: number;
  canManageFiles: boolean;
  canEdit: boolean;
  expandedFolders: Set<string>;
  toggleFolder: (folderId: string) => void;
}

function FileTreeItem({
  file,
  files,
  selectedFileId,
  onFileSelect,
  onCreateFile,
  onDelete,
  onRename,
  onDuplicate,
  onCopyPath,
  creationState,
  onCreationSubmit,
  onCreationCancel,
  renamingFile,
  onRenameSubmit,
  onRenameCancel,
  depth,
  canManageFiles,
  canEdit,
  expandedFolders,
  toggleFolder,
}: FileTreeItemProps) {
  const children = files.filter((f) => f.parent_id === file.id);
  const isOpen = expandedFolders.has(file.id);
  const isCreatingHere = creationState?.parentId === file.id;
  const isRenaming = renamingFile?.id === file.id;

  // Rename inline input
  if (isRenaming) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5"
        style={{ paddingLeft: `${depth * 12 + (file.is_folder ? 8 : 20)}px` }}
      >
        {file.is_folder && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        {getFileIcon(file.name, file.is_folder, isOpen)}
        <Input
          autoFocus
          defaultValue={file.name}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRenameSubmit((e.target as HTMLInputElement).value);
            }
            if (e.key === 'Escape') onRenameCancel();
          }}
          onBlur={(e) => {
            if (e.target.value.trim()) {
              onRenameSubmit(e.target.value.trim());
            } else {
              onRenameCancel();
            }
          }}
          className="h-6 text-xs px-1.5 py-0"
        />
      </div>
    );
  }

  if (file.is_folder) {
    return (
      <Collapsible open={isOpen} onOpenChange={() => toggleFolder(file.id)}>
        <ContextMenu>
          <ContextMenuTrigger>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center gap-1 px-2 py-1 rounded-sm text-sm hover:bg-sidebar-accent transition-colors',
                  'text-left group'
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
                {/* Quick action buttons on hover */}
                {canManageFiles && (
                  <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFile(file.id, false);
                      }}
                      className="p-0.5 hover:bg-sidebar-accent rounded"
                      title="New File"
                    >
                      <FilePlus className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFile(file.id, true);
                      }}
                      className="p-0.5 hover:bg-sidebar-accent rounded"
                      title="New Folder"
                    >
                      <FolderPlus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                )}
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
              <ContextMenuItem onClick={() => onCopyPath(file)}>
                <Clipboard className="h-4 w-4 mr-2" />
                Copy Path
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
          {/* Creation input inside folder */}
          {isCreatingHere && (
            <InlineInput
              placeholder={creationState.isFolder ? 'Folder name...' : 'File name...'}
              onSubmit={onCreationSubmit}
              onCancel={onCreationCancel}
              depth={depth + 1}
              icon={
                creationState.isFolder 
                  ? <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                  : <File className="h-4 w-4 text-muted-foreground shrink-0" />
              }
            />
          )}
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
                onDuplicate={onDuplicate}
                onCopyPath={onCopyPath}
                creationState={creationState}
                onCreationSubmit={onCreationSubmit}
                onCreationCancel={onCreationCancel}
                renamingFile={renamingFile}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                depth={depth + 1}
                canManageFiles={canManageFiles}
                canEdit={canEdit}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // File item
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={() => onFileSelect(file)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1 rounded-sm text-sm hover:bg-sidebar-accent transition-colors',
            'text-left group',
            selectedFileId === file.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
          )}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
        >
          {getFileIcon(file.name, false)}
          <span className="truncate">{file.name}</span>
          {/* Quick delete button on hover */}
          {canManageFiles && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
              }}
              className="ml-auto p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded transition-opacity"
              title="Delete"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </button>
      </ContextMenuTrigger>
      {(canManageFiles || canEdit) && (
        <ContextMenuContent>
          {canManageFiles && (
            <>
              <ContextMenuItem onClick={() => onDuplicate(file)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCopyPath(file)}>
                <Clipboard className="h-4 w-4 mr-2" />
                Copy Path
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
            </>
          )}
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
  canManageFiles,
  canEdit,
}: FileExplorerProps) {
  const queryClient = useQueryClient();
  const [creationState, setCreationState] = useState<CreationState | null>(null);
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectFile | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand all folders on initial load
  useEffect(() => {
    const folderIds = files.filter(f => f.is_folder).map(f => f.id);
    setExpandedFolders(new Set(folderIds));
  }, [files.length === 0]); // Only on initial load

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

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
      setCreationState(null);
      
      // Expand parent folder if creating inside one
      if (data.parent_id) {
        setExpandedFolders(prev => new Set([...prev, data.parent_id!]));
      }
      
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
      setRenamingFile(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to rename');
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (file: ProjectFile) => {
      // If it's a folder, we need to delete all children first (cascade)
      if (file.is_folder) {
        const childrenToDelete = getAllDescendants(file.id, files);
        for (const child of childrenToDelete) {
          await supabase.from('project_files').delete().eq('id', child.id);
        }
      }

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
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete');
      setDeleteConfirm(null);
    },
  });

  const duplicateFile = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
      const newName = `${baseName} (copy)${ext}`;
      const parentPath = file.parent_id
        ? files.find(f => f.id === file.parent_id)?.path || ''
        : '';
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      const { data, error } = await supabase
        .from('project_files')
        .insert({
          project_id: projectId,
          name: newName,
          path: newPath,
          is_folder: false,
          parent_id: file.parent_id,
          content: file.content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success('File duplicated!');
      onFileSelect(data);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to duplicate');
    },
  });

  // Get all descendants of a folder
  function getAllDescendants(folderId: string, allFiles: ProjectFile[]): ProjectFile[] {
    const children = allFiles.filter(f => f.parent_id === folderId);
    let descendants: ProjectFile[] = [...children];
    for (const child of children) {
      if (child.is_folder) {
        descendants = [...descendants, ...getAllDescendants(child.id, allFiles)];
      }
    }
    return descendants;
  }

  const handleCreate = useCallback((parentId: string | null, isFolder: boolean) => {
    setCreationState({ parentId, isFolder });
    // Expand parent folder
    if (parentId) {
      setExpandedFolders(prev => new Set([...prev, parentId]));
    }
  }, []);

  const handleCreationSubmit = useCallback((name: string) => {
    if (!creationState) return;
    createFile.mutate({
      name,
      parentId: creationState.parentId,
      isFolder: creationState.isFolder,
    });
  }, [creationState, createFile]);

  const handleCreationCancel = useCallback(() => {
    setCreationState(null);
  }, []);

  const handleRename = useCallback((file: ProjectFile) => {
    setRenamingFile(file);
  }, []);

  const handleRenameSubmit = useCallback((name: string) => {
    if (!renamingFile || !name.trim()) {
      setRenamingFile(null);
      return;
    }
    renameFile.mutate({
      id: renamingFile.id,
      name: name.trim(),
      oldPath: renamingFile.path,
    });
  }, [renamingFile, renameFile]);

  const handleRenameCancel = useCallback(() => {
    setRenamingFile(null);
  }, []);

  const handleDelete = useCallback((file: ProjectFile) => {
    setDeleteConfirm(file);
  }, []);

  const handleDuplicate = useCallback((file: ProjectFile) => {
    duplicateFile.mutate(file);
  }, [duplicateFile]);

  const handleCopyPath = useCallback((file: ProjectFile) => {
    navigator.clipboard.writeText(file.path);
    toast.success('Path copied to clipboard!');
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
    toast.success('Files refreshed!');
  }, [queryClient, projectId]);

  const rootFiles = files
    .filter((f) => f.parent_id === null)
    .sort((a, b) => {
      if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const isCreatingAtRoot = creationState?.parentId === null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </h3>
        <div className="flex items-center gap-0.5">
          {canManageFiles && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleCreate(null, false)}
                title="New File"
              >
                <FilePlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleCreate(null, true)}
                title="New Folder"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {/* Creation input at root level */}
        {isCreatingAtRoot && (
          <InlineInput
            placeholder={creationState.isFolder ? 'Folder name...' : 'File name...'}
            onSubmit={handleCreationSubmit}
            onCancel={handleCreationCancel}
            depth={0}
            icon={
              creationState.isFolder 
                ? <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                : <File className="h-4 w-4 text-muted-foreground shrink-0" />
            }
          />
        )}

        {rootFiles.map((file) => (
          <FileTreeItem
            key={file.id}
            file={file}
            files={files}
            selectedFileId={selectedFileId}
            onFileSelect={onFileSelect}
            onCreateFile={handleCreate}
            onDelete={handleDelete}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onCopyPath={handleCopyPath}
            creationState={creationState}
            onCreationSubmit={handleCreationSubmit}
            onCreationCancel={handleCreationCancel}
            renamingFile={renamingFile}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={handleRenameCancel}
            depth={0}
            canManageFiles={canManageFiles}
            canEdit={canEdit}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
          />
        ))}

        {files.length === 0 && !creationState && (
          <div className="px-3 py-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sidebar-accent mb-3">
              <FolderPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">No files yet</p>
            {canManageFiles && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreate(null, false)}
                >
                  <FilePlus className="h-3.5 w-3.5 mr-1" />
                  New File
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreate(null, true)}
                >
                  <FolderPlus className="h-3.5 w-3.5 mr-1" />
                  New Folder
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.is_folder ? 'folder' : 'file'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.is_folder 
                ? `This will permanently delete "${deleteConfirm.name}" and all its contents.`
                : `This will permanently delete "${deleteConfirm?.name}".`}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteFile.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
