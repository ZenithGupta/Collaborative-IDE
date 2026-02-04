import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeCode } from '@/hooks/useRealtimeCode';
import { useProjectFiles } from '@/hooks/useProjectFiles';
import { useCollaboratorRole } from '@/hooks/useCollaboratorRole';
import { useIsMobile } from '@/hooks/use-mobile';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileExplorer, ProjectFile } from '@/components/FileExplorer';
import { ActiveUsersPresence, ActiveUsersSidebar } from '@/components/ActiveUsersPresence';
import { ShareProjectDialog } from '@/components/ShareProjectDialog';
import { RequestAccessDialog } from '@/components/RequestAccessDialog';
import { AccessRequestsPanel } from '@/components/AccessRequestsPanel';
import {
  Code2,
  Play,
  Loader2,
  ArrowLeft,
  Users,
  Terminal,
  Share2,
  Globe,
  Lock,
  X,
  FolderTree,
  Eye,
  Edit2,
  Shield,
  Menu,
  PanelLeft,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Project() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [code, setCode] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [openTabs, setOpenTabs] = useState<ProjectFile[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'users'>('files');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Project files
  const { files, isLoading: filesLoading, saveFileContent, getLanguageFromFile } = useProjectFiles({
    projectId,
  });

  // Handle remote code changes
  const handleRemoteCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  // Real-time code sync with file context
  const { activeUsers, broadcastCode } = useRealtimeCode({
    projectId,
    currentFileId: selectedFile?.id || null,
    currentFileName: selectedFile?.name || null,
    initialCode: code,
    onCodeChange: handleRemoteCodeChange,
  });

  // Set initial code from selected file
  useEffect(() => {
    if (selectedFile) {
      setCode(selectedFile.content || '');
    } else if (project?.code && files.length === 0) {
      // Fallback to legacy single-file code
      setCode(project.code);
    }
  }, [selectedFile, project?.code, files.length]);

  // Handle file selection
  const handleFileSelect = useCallback((file: ProjectFile) => {
    // Save current file before switching
    if (selectedFile && code !== selectedFile.content) {
      saveFileContent(selectedFile.id, code);
    }

    setSelectedFile(file);
    setCode(file.content || '');

    // Add to open tabs if not already there
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === file.id)) return prev;
      return [...prev, file];
    });

    // Close sidebar on mobile after selecting file
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [selectedFile, code, saveFileContent, isMobile]);

  // Close tab
  const closeTab = useCallback((file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs((prev) => prev.filter((t) => t.id !== file.id));
    
    if (selectedFile?.id === file.id) {
      const remaining = openTabs.filter((t) => t.id !== file.id);
      setSelectedFile(remaining[remaining.length - 1] || null);
    }
  }, [selectedFile, openTabs]);

  // Handle code changes - broadcast and save
  const handleCodeChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      
      // Broadcast to other users immediately
      broadcastCode(value);
      
      // Debounce save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        if (selectedFile) {
          saveFileContent(selectedFile.id, value);
        }
      }, 1000);
    }
  }, [broadcastCode, saveFileContent, selectedFile]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Toggle public/private
  const togglePublic = useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!projectId) return;
      const { error } = await supabase
        .from('projects')
        .update({ is_public: isPublic })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success(project?.is_public ? 'Project is now private' : 'Project is now public!');
    },
    onError: () => {
      toast.error('Failed to update visibility');
    },
  });

  // Run code using edge function
  const runCode = async () => {
    setIsRunning(true);
    setOutput(['⏳ Executing code...']);

    try {
      const language = selectedFile 
        ? getLanguageFromFile(selectedFile.name)
        : project?.language;

      const { data, error } = await supabase.functions.invoke('execute-code', {
        body: { code, language },
      });

      if (error) {
        setOutput([`❌ Error: ${error.message}`]);
      } else if (data.error) {
        setOutput([`❌ Error: ${data.error}`]);
      } else {
        setOutput(data.output || ['✓ Code executed successfully (no output)']);
      }
    } catch (err) {
      setOutput([`❌ Error: ${err instanceof Error ? err.message : String(err)}`]);
    }

    setIsRunning(false);
  };

  // Role-based permissions
  const { isOwner, canEdit, canManageFiles, role, isLoading: roleLoading } = useCollaboratorRole({
    projectId,
    userId: user?.id,
  });

  // Get role display info
  const getRoleInfo = () => {
    if (isOwner) return { label: 'Owner', icon: Shield, color: 'text-primary' };
    if (role === 'full_access') return { label: 'Full Access', icon: Shield, color: 'text-emerald-500' };
    if (role === 'edit') return { label: 'Edit Mode', icon: Edit2, color: 'text-amber-500' };
    if (role === 'view') return { label: 'View Only', icon: Eye, color: 'text-muted-foreground' };
    return null;
  };

  const roleInfo = getRoleInfo();

  if (isLoading || filesLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
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

  const currentLanguage = selectedFile 
    ? getLanguageFromFile(selectedFile.name)
    : project.language;

  // Sidebar content (reused for both desktop and mobile)
  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      {/* Sidebar tab switcher */}
      <div className="flex border-b border-border/30">
        <button
          onClick={() => setSidebarTab('files')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            sidebarTab === 'files' 
              ? 'text-foreground border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FolderTree className="h-3.5 w-3.5" />
          Files
        </button>
        <button
          onClick={() => setSidebarTab('users')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors relative',
            sidebarTab === 'users' 
              ? 'text-foreground border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Users
          {activeUsers.length > 0 && (
            <span className="absolute top-2 right-4 h-2 w-2 rounded-full bg-green-500" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'files' ? (
          <div className="flex flex-col h-full">
            {/* Access requests panel for owners */}
            {isOwner && (
              <div className="p-2 border-b border-border/30">
                <AccessRequestsPanel projectId={projectId!} />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <FileExplorer
                projectId={projectId!}
                files={files}
                selectedFileId={selectedFile?.id || null}
                onFileSelect={handleFileSelect}
                canManageFiles={canManageFiles}
                canEdit={canEdit}
              />
            </div>
          </div>
        ) : (
          <div className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Online Now ({activeUsers.length})
            </h3>
            <ActiveUsersSidebar users={activeUsers} currentUserId={user?.id} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-border/50 bg-card/50 backdrop-blur-xl gap-2">
        {/* Left section */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          {/* Mobile sidebar toggle */}
          {isMobile && (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          )}
          
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded gradient-primary shrink-0">
              <Code2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold truncate">{project.name}</span>
            {selectedFile && !isMobile && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground truncate max-w-[120px]">
                {selectedFile.name}
              </span>
            )}
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Role indicator - hide on small mobile */}
          {roleInfo && !isOwner && (
            <div className={cn(
              'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 border border-border/50',
              roleInfo.color
            )}>
              <roleInfo.icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{roleInfo.label}</span>
            </div>
          )}

          {/* Active users - hide on mobile */}
          <div className="hidden md:block">
            <ActiveUsersPresence 
              users={activeUsers} 
              currentUserId={user?.id}
              className="mr-2"
            />
          </div>

          {/* Public toggle - only for owner, hide on mobile */}
          {isOwner && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    {project.is_public ? (
                      <Globe className="h-4 w-4 text-green-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="public-toggle" className="text-xs cursor-pointer">
                      {project.is_public ? 'Public' : 'Private'}
                    </Label>
                    <Switch
                      id="public-toggle"
                      checked={project.is_public}
                      onCheckedChange={(checked) => togglePublic.mutate(checked)}
                      disabled={togglePublic.isPending}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {project.is_public 
                    ? 'Anyone with the room code can join'
                    : 'Only you can access this project'}
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Request access - for collaborators */}
          {!isOwner && role && role !== 'full_access' && (
            <div className="hidden sm:block">
              <RequestAccessDialog projectId={projectId!} currentRole={role} />
            </div>
          )}

          {/* Share button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowShareDialog(true)}
            className="hidden sm:flex"
          >
            <Share2 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          {/* Run button */}
          <Button size="sm" className="gradient-primary" onClick={runCode} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-1">Run</span>
          </Button>

          {/* Mobile overflow menu */}
          {isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {roleInfo && !isOwner && (
                  <>
                    <DropdownMenuItem disabled className={roleInfo.color}>
                      <roleInfo.icon className="h-4 w-4 mr-2" />
                      {roleInfo.label}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem onClick={() => togglePublic.mutate(!project.is_public)}>
                    {project.is_public ? (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Make Private
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4 mr-2" />
                        Make Public
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {!isOwner && role && role !== 'full_access' && (
                  <DropdownMenuItem asChild>
                    <RequestAccessDialog projectId={projectId!} currentRole={role} />
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-muted-foreground">
                  <Users className="h-4 w-4 mr-2" />
                  {activeUsers.length} online
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Share Dialog */}
      {project && (
        <ShareProjectDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          project={project}
        />
      )}

      {/* Main workspace */}
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          // Mobile layout - stacked vertically
          <div className="flex flex-col h-full">
            {/* File tabs - horizontal scrollable */}
            {openTabs.length > 0 && (
              <div className="flex items-center border-b border-border/30 bg-card/30 overflow-x-auto shrink-0">
                {openTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleFileSelect(tab)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm border-r border-border/30 hover:bg-sidebar-accent transition-colors min-w-0 shrink-0',
                      selectedFile?.id === tab.id && 'bg-sidebar-accent'
                    )}
                  >
                    <span className="truncate max-w-[100px]">{tab.name}</span>
                    <button
                      onClick={(e) => closeTab(tab, e)}
                      className="hover:bg-destructive/20 rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 min-h-0">
              {selectedFile || files.length === 0 ? (
                <Editor
                  height="100%"
                  language={currentLanguage}
                  value={code}
                  onChange={handleCodeChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace',
                    minimap: { enabled: false },
                    padding: { top: 12 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    tabSize: 2,
                    readOnly: !canEdit,
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                  <div className="text-center">
                    <FolderTree className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a file to start editing</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <PanelLeft className="h-4 w-4 mr-1" />
                      Open Files
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Terminal/Output */}
            <div className="h-32 bg-terminal border-t border-border/50 shrink-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Output</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs px-2"
                  onClick={() => setOutput([])}
                >
                  Clear
                </Button>
              </div>
              <div className="p-2 font-mono text-xs overflow-auto h-[calc(100%-32px)]">
                {output.length === 0 ? (
                  <span className="text-muted-foreground">
                    Tap "Run" to execute...
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
          </div>
        ) : (
          // Desktop layout - resizable panels
          <PanelGroup direction="horizontal">
            {/* Sidebar with tabs */}
            <Panel defaultSize={18} minSize={12} maxSize={30}>
              <div className="h-full border-r border-border/50 bg-sidebar">
                <SidebarContent />
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border/30 hover:bg-primary/50 transition-colors" />

            {/* Editor + Terminal */}
            <Panel defaultSize={82}>
              <PanelGroup direction="vertical">
                {/* Editor with tabs */}
                <Panel defaultSize={70} minSize={30}>
                  <div className="h-full flex flex-col bg-editor">
                    {/* File tabs */}
                    {openTabs.length > 0 && (
                      <div className="flex items-center border-b border-border/30 bg-card/30 overflow-x-auto">
                        {openTabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => handleFileSelect(tab)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 text-sm border-r border-border/30 hover:bg-sidebar-accent transition-colors min-w-0',
                              selectedFile?.id === tab.id && 'bg-sidebar-accent'
                            )}
                          >
                            <span className="truncate max-w-[120px]">{tab.name}</span>
                            <button
                              onClick={(e) => closeTab(tab, e)}
                              className="hover:bg-destructive/20 rounded p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Monaco editor */}
                    <div className="flex-1">
                      {selectedFile || files.length === 0 ? (
                        <Editor
                          height="100%"
                          language={currentLanguage}
                          value={code}
                          onChange={handleCodeChange}
                          theme="vs-dark"
                          options={{
                            fontSize: 14,
                            fontFamily: 'JetBrains Mono, monospace',
                            minimap: { enabled: true },
                            padding: { top: 16 },
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            renderLineHighlight: 'all',
                            lineNumbers: 'on',
                            wordWrap: 'on',
                            tabSize: 2,
                            bracketPairColorization: { enabled: true },
                            autoClosingBrackets: 'always',
                            autoClosingQuotes: 'always',
                            formatOnPaste: true,
                            readOnly: !canEdit,
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Select a file to start editing</p>
                            <p className="text-sm mt-1">or create a new file from the sidebar</p>
                          </div>
                        </div>
                      )}
                    </div>
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
        )}
      </div>
    </div>
  );
}
