import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeCode, CursorPosition } from '@/hooks/useRealtimeCode';
import { useProjectFiles } from '@/hooks/useProjectFiles';
import { useCollaboratorRole } from '@/hooks/useCollaboratorRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAIAgent } from '@/hooks/useAIAgent';
import { usePreviewBuilder, ConsoleEntry } from '@/hooks/usePreviewBuilder';
import Editor, { DiffEditor, type Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
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
import { ActiveUsersPresence, ActiveUsersSidebar, ActiveUser, getUserColor } from '@/components/ActiveUsersPresence';
import { ShareProjectDialog } from '@/components/ShareProjectDialog';
import { RequestAccessDialog } from '@/components/RequestAccessDialog';
import { AccessRequestsPanel } from '@/components/AccessRequestsPanel';
import { AIChatPanel } from '@/components/AIChatPanel';
import { AILockBanner } from '@/components/AILockBanner';
import { LivePreview } from '@/components/LivePreview';
import { CommandPalette } from '@/components/CommandPalette';
import { AuditLogPanel } from '@/components/AuditLogPanel';
import { exportProjectAsZip } from '@/utils/exportProject';
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
  EyeOff,
  Edit2,
  Shield,
  Menu,
  PanelLeft,
  MoreVertical,
  Sparkles,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Columns,
  SplitSquareHorizontal,
  Check,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const insertAuditLog = async (
  projectId: string, 
  userId: string, 
  action: string, 
  fileName: string | null,
  files: ProjectFile[],
  queryClient: any
) => {
  try {
    let historyFile = files.find(f => f.name === '.codevibe_history.json');
    let historyData = [];

    if (historyFile) {
      try {
        historyData = JSON.parse(historyFile.content || '[]');
      } catch (e) {
        historyData = [];
      }
    } else {
      const { data, error } = await supabase.from('project_files').insert({
        project_id: projectId,
        name: '.codevibe_history.json',
        path: '.codevibe_history.json',
        content: '[]',
        is_folder: false,
      }).select().single();
      if (!error && data) {
        historyFile = data;
        queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      }
    }

    if (historyFile) {
      historyData.unshift({
        id: crypto.randomUUID(),
        project_id: projectId,
        user_id: userId,
        action,
        file_name: fileName,
        created_at: new Date().toISOString(),
      });
      if (historyData.length > 100) historyData = historyData.slice(0, 100);
      
      await supabase.from('project_files')
        .update({ content: JSON.stringify(historyData, null, 2), updated_at: new Date().toISOString() })
        .eq('id', historyFile.id);
    }
  } catch (err) {
    console.error("Audit log error:", err);
  }
};

export default function Project() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [code, setCode] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stdinInput, setStdinInput] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [openTabs, setOpenTabs] = useState<ProjectFile[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'users' | 'ai' | 'history'>('files');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [terminalTab, setTerminalTab] = useState<'output' | 'console' | 'preview'>('output');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [splitFile, setSplitFile] = useState<ProjectFile | null>(null);
  const [proposedAICode, setProposedAICode] = useState<{ code: string; fileName: string } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastLoggedEditRef = useRef<Record<string, number>>({});
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const cursorDecorationsRef = useRef<string[]>([]);
  const cursorWidgetsRef = useRef<Record<string, { widget: MonacoEditor.IContentWidget, domNode: HTMLElement }>>({});
  const broadcastThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const [hasLoggedJoin, setHasLoggedJoin] = useState(false);

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
  const { activeUsers, broadcastCode, broadcastCursor, broadcastAILock, broadcastAIUnlock, aiLockedFiles, cancelRequests } = useRealtimeCode({
    projectId,
    currentFileId: selectedFile?.id || null,
    currentFileName: selectedFile?.name || null,
    initialCode: code,
    onCodeChange: handleRemoteCodeChange,
  });

  // AI Agent
  const aiAgent = useAIAgent({
    projectId,
    files,
    selectedFileId: selectedFile?.id || null,
  });

  // Live Preview
  const { previewDoc, consoleLogs, clearConsole, hasPreviewableFiles } = usePreviewBuilder({
    files,
    currentFileId: selectedFile?.id || null,
    currentCode: code,
    enabled: showPreview,
  });

  // Check if current file is AI-locked by another user
  const currentFileAILock = selectedFile?.id ? aiLockedFiles.get(selectedFile.id) : undefined;
  const isFileLocked = !!currentFileAILock;
  const isLockedByMe = currentFileAILock?.userId === user?.id;

  // Audit log: Join event tracking
  useEffect(() => {
    if (projectId && user?.id && !hasLoggedJoin && files) {
      // Small timeout to ensure files are loaded before joining
      setTimeout(() => {
        insertAuditLog(projectId, user.id, 'joined', null, files, queryClient);
      }, 1500);
      setHasLoggedJoin(true);
    }
  }, [projectId, user?.id, hasLoggedJoin, files, queryClient]);

  // Auto-create a project_file entry from legacy project.code when no files exist
  const [migratedLegacy, setMigratedLegacy] = useState(false);
  useEffect(() => {
    if (!project || !projectId || files.length > 0 || migratedLegacy || filesLoading) return;
    if (!project.code) return;

    const extMap: Record<string, string> = {
      javascript: 'js', typescript: 'ts', python: 'py', cpp: 'cpp',
      c: 'c', java: 'java', html: 'html', css: 'css',
    };
    const ext = extMap[project.language] || 'txt';
    const fileName = project.language === 'java' ? 'Main.java' : `main.${ext}`;

    setMigratedLegacy(true);
    supabase
      .from('project_files')
      .insert({
        project_id: projectId,
        name: fileName,
        path: fileName,
        content: project.code,
        is_folder: false,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
        }
      });
  }, [project, projectId, files.length, filesLoading, migratedLegacy, queryClient]);

  // Set initial code from selected file
  useEffect(() => {
    if (selectedFile) {
      setCode(selectedFile.content || '');
    } else if (project?.code && files.length === 0) {
      // Fallback to legacy single-file code
      setCode(project.code);
    }
  }, [selectedFile, project?.code, files.length]);

  // Sync editor when files are refetched (e.g. after AI changes)
  useEffect(() => {
    if (selectedFile && files.length > 0) {
      const updatedFile = files.find(f => f.id === selectedFile.id);
      if (updatedFile && updatedFile.content !== selectedFile.content) {
        setSelectedFile(updatedFile);
        setCode(updatedFile.content || '');
      }
    }
    // Also update open tabs with fresh data
    setOpenTabs(prev =>
      prev.map(tab => {
        const fresh = files.find(f => f.id === tab.id);
        return fresh || tab;
      })
    );
  }, [files]);

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
    if (proposedAICode?.fileName === file.name) {
      setProposedAICode(null);
    }
  }, [selectedFile, openTabs, proposedAICode]);

  // Handle Application of Proposed AI Code
  const handleAcceptAICode = useCallback(() => {
    if (selectedFile && proposedAICode) {
      setCode(proposedAICode.code);
      saveFileContent(selectedFile.id, proposedAICode.code);
      broadcastCode(proposedAICode.code);
      insertAuditLog(projectId!, user!.id, 'edited_ai', selectedFile.name, files, queryClient);
      setProposedAICode(null);
      toast.success("AI changes applied successfully.");
    }
  }, [selectedFile, proposedAICode, saveFileContent, broadcastCode, projectId, user, files, queryClient]);

  // Handle code changes - broadcast and save
  const handleCodeChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      
      // Broadcast to other users immediately
      broadcastCode(value);
      
      // Debounce save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (selectedFile) {
          saveFileContent(selectedFile.id, value);
          
          // Audit Log: Debounce manual edit tracking (1 min per file)
          const now = Date.now();
          const lastLog = lastLoggedEditRef.current[selectedFile.id] || 0;
          if (now - lastLog > 60000 && user?.id) {
            insertAuditLog(projectId!, user.id, 'edited_manual', selectedFile.name, files, queryClient);
            lastLoggedEditRef.current[selectedFile.id] = now;
          }
        }
      }, 1000);
    }
  }, [selectedFile, saveFileContent, broadcastCode, projectId, user]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Feature 1: Render multiplayer cursors as Figma-style ContentWidgets
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !user || !monacoRef.current) return;

    const otherUsers = activeUsers.filter(
      u => u.id !== user.id && u.currentFileId === selectedFile?.id && u.cursorPosition
    );

    const activeUserIds = new Set(otherUsers.map(u => u.id));

    // Cleanup widgets for users who disconnected or changed files
    Object.keys(cursorWidgetsRef.current).forEach(userId => {
      if (!activeUserIds.has(userId)) {
        editor.removeContentWidget(cursorWidgetsRef.current[userId].widget);
        delete cursorWidgetsRef.current[userId];
      }
    });

    const decorations: MonacoEditor.IModelDeltaDecoration[] = [];

    otherUsers.forEach(u => {
      const color = getUserColor(u.id);
      const pos = u.cursorPosition!;

      // Caret Decoration
      decorations.push({
        range: {
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column + 1,
        },
        options: {
          className: `remote-caret-class-${u.id.slice(0, 8)}`,
          hoverMessage: { value: `**${u.username}**` },
          stickiness: 1, // monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        },
      });

      // Name Tag ContentWidget
      let widgetObj = cursorWidgetsRef.current[u.id];
      if (!widgetObj) {
        // Create DOM element for Canva-style floating name tag
        const domNode = document.createElement('div');
        domNode.textContent = u.username;
        domNode.style.backgroundColor = color;
        domNode.style.color = '#fff';
        domNode.style.fontFamily = "'Inter', sans-serif";
        domNode.style.fontWeight = '600';
        domNode.style.fontSize = '10px';
        domNode.style.padding = '2px 6px';
        domNode.style.borderRadius = '4px 4px 4px 0px'; // Tail towards the cursor
        domNode.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        domNode.style.whiteSpace = 'nowrap';
        domNode.style.pointerEvents = 'none';

        const widget: MonacoEditor.IContentWidget = {
          getId: () => `widget-${u.id}`,
          getDomNode: () => domNode,
          getPosition: () => ({
            position: pos,
            preference: [monacoRef.current!.editor.ContentWidgetPositionPreference.ABOVE, monacoRef.current!.editor.ContentWidgetPositionPreference.BELOW],
          }),
        };

        editor.addContentWidget(widget);
        cursorWidgetsRef.current[u.id] = { widget, domNode };
      } else {
        // Update position of existing widget
        widgetObj.widget.getPosition = () => ({
          position: pos,
          preference: [monacoRef.current!.editor.ContentWidgetPositionPreference.ABOVE, monacoRef.current!.editor.ContentWidgetPositionPreference.BELOW],
        });
        editor.layoutContentWidget(widgetObj.widget);
      }
    });

    // Inject styles for the thin caret vertical lines
    let styleEl = document.getElementById('remote-cursors-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'remote-cursors-style';
      document.head.appendChild(styleEl);
    }
    const cssRules = otherUsers.map(u => {
      const color = getUserColor(u.id);
      return `.remote-caret-class-${u.id.slice(0, 8)} { border-left: 2px solid ${color} !important; border-radius: 0; box-sizing: border-box; margin-left: -1px; width: 0px !important; z-index: 10; pointer-events: none; }`;
    });
    styleEl.textContent = cssRules.join('\n');

    cursorDecorationsRef.current = editor.deltaDecorations(
      cursorDecorationsRef.current,
      decorations
    );
  }, [activeUsers, selectedFile?.id, user]);

  // Feature 1: Follow Mode — navigate to user's file & scroll to their cursor
  const handleFollowUser = useCallback((targetUser: ActiveUser) => {
    if (!targetUser.currentFile) {
      toast.info(`${targetUser.username} hasn't opened a file yet`);
      return;
    }

    // Find the file by name
    const targetFile = files.find(
      f => f.name === targetUser.currentFile || f.id === targetUser.currentFileId
    );
    if (targetFile) {
      handleFileSelect(targetFile);

      // Scroll to their cursor position after a short delay
      if (targetUser.cursorPosition) {
        setTimeout(() => {
          editorRef.current?.revealLineInCenter(targetUser.cursorPosition!.lineNumber);
          editorRef.current?.setPosition(targetUser.cursorPosition!);
        }, 100);
      }

      toast.success(`Following ${targetUser.username}`);
    }
  }, [files, handleFileSelect]);

  // Feature 3 + 5: Monaco onMount handler for AI context actions + Prettier + cursor tracking
  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Broadcast cursor position on cursor change (Throttled)
    editor.onDidChangeCursorPosition((e) => {
      if (broadcastThrottleRef.current) return;
      broadcastThrottleRef.current = setTimeout(() => {
        broadcastCursor({ lineNumber: e.position.lineNumber, column: e.position.column });
        broadcastThrottleRef.current = null;
      }, 50);
    });

    // Feature 3: AI Context Menu Actions
    editor.addAction({
      id: 'ai-explain-code',
      label: 'AI: Explain this code',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 1,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = selection ? ed.getModel()?.getValueInRange(selection) : '';
        if (!selectedText?.trim()) {
          toast.error('Select some code first');
          return;
        }
        setSidebarTab('ai');
        setSidebarCollapsed(false);
        aiAgent.generateCode(`Explain this code:\n\n\`\`\`\n${selectedText}\n\`\`\``);
      },
    });

    editor.addAction({
      id: 'ai-find-bugs',
      label: 'AI: Find bugs',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 2,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = selection ? ed.getModel()?.getValueInRange(selection) : '';
        if (!selectedText?.trim()) {
          toast.error('Select some code first');
          return;
        }
        setSidebarTab('ai');
        setSidebarCollapsed(false);
        aiAgent.generateCode(`Find bugs and potential issues in this code:\n\n\`\`\`\n${selectedText}\n\`\`\``);
      },
    });

    editor.addAction({
      id: 'ai-add-comments',
      label: 'AI: Add comments',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 3,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = selection ? ed.getModel()?.getValueInRange(selection) : '';
        if (!selectedText?.trim()) {
          toast.error('Select some code first');
          return;
        }
        setSidebarTab('ai');
        setSidebarCollapsed(false);
        aiAgent.generateCode(`Add clear, helpful comments to this code. Return the full code with comments added:\n\n\`\`\`\n${selectedText}\n\`\`\``);
      },
    });

    // Feature 5: Prettier formatting via Shift+Alt+F
    editor.addAction({
      id: 'format-with-prettier',
      label: 'Format Document (Prettier)',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: async (ed) => {
        const model = ed.getModel();
        if (!model) return;

        const cursorPos = ed.getPosition();
        const source = model.getValue();
        const uri = model.uri.toString();
        const ext = uri.split('.').pop()?.toLowerCase() || '';

        let parser: string;
        if (['ts', 'tsx'].includes(ext)) parser = 'typescript';
        else if (['js', 'jsx'].includes(ext)) parser = 'babel';
        else if (ext === 'html') parser = 'html';
        else if (ext === 'css' || ext === 'scss') parser = 'css';
        else if (ext === 'json') parser = 'json';
        else if (ext === 'md') parser = 'markdown';
        else {
          toast.info('Prettier: unsupported file type');
          return;
        }

        try {
          const prettier = await import('prettier/standalone');
          const plugins = await Promise.all([
            import('prettier/plugins/estree'),
            import('prettier/plugins/babel'),
            import('prettier/plugins/typescript'),
            import('prettier/plugins/html'),
            import('prettier/plugins/postcss'),
            import('prettier/plugins/markdown'),
          ]);

          const formatted = await prettier.format(source, {
            parser,
            plugins: plugins.map(p => p.default || p),
            singleQuote: true,
            semi: true,
            tabWidth: 2,
            trailingComma: 'es5',
          });

          // Apply the formatted text preserving undo history
          ed.executeEdits('prettier', [{
            range: model.getFullModelRange(),
            text: formatted,
          }]);

          // Restore cursor position
          if (cursorPos) {
            ed.setPosition(cursorPos);
          }

          toast.success('Formatted with Prettier');
        } catch (err) {
          console.error('Prettier formatting failed:', err);
          toast.error('Formatting failed: ' + (err instanceof Error ? err.message : String(err)));
        }
      },
    });

    // Feature 4: Custom Code Snippets
    const createSnippets = (languageId: string, snippets: any[]) => {
      monaco.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems: () => {
          return {
            suggestions: snippets.map(s => ({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: s.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: s.documentation,
            }))
          };
        }
      });
    };

    createSnippets('javascript', [
      { label: 'clg', insertText: 'console.log($1);', documentation: 'Console Log' },
      { label: 'fori', insertText: 'for (let i = 0; i < ${1:array}.length; i++) {\n\t${2:element} = ${1:array}[i];\n\t$0\n}', documentation: 'For Loop' },
    ]);
    createSnippets('typescript', [
      { label: 'clg', insertText: 'console.log($1);', documentation: 'Console Log' },
      { label: 'fori', insertText: 'for (let i = 0; i < ${1:array}.length; i++) {\n\tconst ${2:element} = ${1:array}[i];\n\t$0\n}', documentation: 'For Loop' },
    ]);
    createSnippets('html', [
      { 
        label: '!html', 
        insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n</head>\n<body>\n\t$0\n</body>\n</html>', 
        documentation: 'HTML5 Boilerplate' 
      },
    ]);

  }, [broadcastCursor, aiAgent.generateCode]);

  // Feature 4: Export project
  const handleExportProject = useCallback(() => {
    if (!project) return;
    exportProjectAsZip(project.name, files);
    toast.success('Project exported!');
  }, [project, files]);

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
    setTerminalOpen(true);
    setOutput(['⏳ Executing code...']);

    try {
      const language = selectedFile 
        ? getLanguageFromFile(selectedFile.name)
        : project?.language;

      const { data, error } = await supabase.functions.invoke('execute-code', {
        body: { code, language, stdin: stdinInput },
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
  // Using a JSX variable instead of an inline component to prevent remounting on parent re-renders,
  // which would destroy AIChatPanel's local input state.
  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* Sidebar tab switcher + collapse toggle */}
      <div className="flex items-center border-b border-border/30">
        {sidebarCollapsed ? (
          // Collapsed: vertical icon buttons
          <div className="flex flex-col w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setSidebarTab('files'); setSidebarCollapsed(false); }}
                  className={cn(
                    'flex items-center justify-center py-2.5 transition-colors',
                    sidebarTab === 'files' ? 'text-foreground bg-secondary/50' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FolderTree className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setSidebarTab('users'); setSidebarCollapsed(false); }}
                  className={cn(
                    'flex items-center justify-center py-2.5 transition-colors relative',
                    sidebarTab === 'users' ? 'text-foreground bg-secondary/50' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Users className="h-4 w-4" />
                  {activeUsers.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Users ({activeUsers.length})</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setSidebarTab('ai'); setSidebarCollapsed(false); }}
                  className={cn(
                    'flex items-center justify-center py-2.5 transition-colors relative',
                    sidebarTab === 'ai' ? 'text-foreground bg-secondary/50' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  {aiAgent.status === 'generating' && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">AI Agent</TooltipContent>
            </Tooltip>
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="flex items-center justify-center py-2.5 text-muted-foreground hover:text-foreground transition-colors border-t border-border/30"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          // Expanded: horizontal tabs with collapse button
          <>
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
            <button
              onClick={() => setSidebarTab('ai')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors relative',
                sidebarTab === 'ai' 
                  ? 'text-foreground border-b-2 border-cyan-500' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI
              {aiAgent.status === 'generating' && (
                <span className="absolute top-2 right-4 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setSidebarTab('history')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors relative',
                sidebarTab === 'history' 
                  ? 'text-foreground border-b-2 border-orange-500' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    className="px-1.5 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Collapse sidebar</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Tab content (hidden when collapsed) */}
      {!sidebarCollapsed && (
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
                  aiLockedFiles={aiLockedFiles}
                />
              </div>
            </div>
          ) : sidebarTab === 'users' ? (
            <div className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Online Now ({activeUsers.length})
              </h3>
              <ActiveUsersSidebar users={activeUsers} currentUserId={user?.id} onFollowUser={handleFollowUser} />
            </div>
          ) : sidebarTab === 'history' ? (
            <AuditLogPanel files={files} />
          ) : (
            <AIChatPanel
              status={aiAgent.status}
              messages={aiAgent.messages}
              streamingText={aiAgent.streamingText}
              onSubmit={aiAgent.generateCode}
              onStop={aiAgent.stopGeneration}
              onClear={aiAgent.clearMessages}
              currentFileName={selectedFile?.name}
              canEdit={canEdit}
              onReviewCode={(newCode, fileName) => {
                const targetFile = files.find(f => f.name === fileName);
                if (targetFile) {
                  handleFileSelect(targetFile);
                  setProposedAICode({ code: newCode, fileName });
                }
              }}
            />
          )}
        </div>
      )}
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
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0">
                {sidebarContent}
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
              onFollowUser={handleFollowUser}
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
            className="hidden md:flex"
          >
            <Share2 className="h-4 w-4 md:mr-1" />
            <span className="hidden lg:inline">Share</span>
          </Button>

          {/* Export button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportProject}
                className="hidden md:flex gap-1"
              >
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">Export</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export project as ZIP</TooltipContent>
          </Tooltip>

          {/* AI button (Desktop) */}
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'hidden md:flex gap-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10',
              aiAgent.status === 'generating' && 'animate-pulse'
            )}
            onClick={() => setSidebarTab('ai')}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden lg:inline">AI</span>
            {aiAgent.status === 'generating' && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
          </Button>

          {/* AI Right Sheet (Mobile directly triggered) */}
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 border-cyan-500/30 text-cyan-400">
                  <Sparkles className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-[320px] p-0 border-l border-border/50">
                <AIChatPanel
                  status={aiAgent.status}
                  messages={aiAgent.messages}
                  streamingText={aiAgent.streamingText}
                  onSubmit={aiAgent.generateCode}
                  onStop={aiAgent.stopGeneration}
                  onClear={aiAgent.clearMessages}
                  currentFileName={selectedFile?.name}
                  canEdit={canEdit}
                  onReviewCode={(newCode, fileName) => {
                    const targetFile = files.find(f => f.name === fileName);
                    if (targetFile) {
                      handleFileSelect(targetFile);
                      setProposedAICode({ code: newCode, fileName });
                    }
                  }}
                />
              </SheetContent>
            </Sheet>
          )}

          {/* Preview toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={showPreview ? 'default' : 'outline'}
                className={cn(
                  'hidden md:flex gap-1',
                  showPreview
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                )}
                onClick={() => setShowPreview(prev => !prev)}
              >
                {showPreview ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="hidden lg:inline">{showPreview ? 'Hide' : 'Preview'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showPreview ? 'Hide live preview' : 'Show live preview'}</TooltipContent>
          </Tooltip>

          {/* Run button */}
          <Button size="sm" className="hidden md:flex gradient-primary" onClick={runCode} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="hidden lg:inline ml-1">Run</span>
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
                <DropdownMenuItem onClick={() => {
                  runCode();
                  setTerminalOpen(true);
                }}>
                  {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2 text-primary" />}
                  Run Code
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowPreview(prev => !prev)}>
                  {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2 border-emerald-500 text-emerald-400" />}
                  {showPreview ? 'Hide Preview' : 'Live Preview'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTerminalOpen(true)}>
                  <Terminal className="h-4 w-4 mr-2 border-primary text-primary" />
                  Terminal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportProject}>
                  <Download className="h-4 w-4 mr-2" />
                  Export ZIP
                </DropdownMenuItem>
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

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        files={files}
        onFileSelect={handleFileSelect}
        onRunCode={runCode}
        onToggleAI={() => { setSidebarTab('ai'); setSidebarCollapsed(false); }}
        onExportProject={handleExportProject}
        onTogglePreview={() => setShowPreview(prev => !prev)}
      />

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

            {/* AI Lock Banner (mobile) */}
            {isFileLocked && currentFileAILock && (
              <AILockBanner
                lockedBy={currentFileAILock}
                isCurrentUser={isLockedByMe}
                onStopGeneration={aiAgent.stopGeneration}
                onRequestCancel={() => aiAgent.sendCancelRequest(currentFileAILock.userId, selectedFile?.id || '')}
              />
            )}

            {/* Editor */}
            <div className="flex-1 min-h-0 relative">
              {proposedAICode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-border shadow-2xl p-2 rounded-lg">
                  <span className="text-xs font-semibold px-2">Reviewing AI Changes: {proposedAICode.fileName}</span>
                  <div className="h-4 w-px bg-border mx-1"></div>
                  <Button size="sm" className="h-8 bg-green-500/20 text-green-500 hover:bg-green-500/30 font-medium" onClick={handleAcceptAICode}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Accept All
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive font-medium" onClick={() => setProposedAICode(null)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              )}
              {selectedFile || files.length === 0 ? (
                proposedAICode ? (
                  <DiffEditor
                    height="100%"
                    language={currentLanguage}
                    original={code}
                    modified={proposedAICode.code}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: 'JetBrains Mono, monospace',
                      minimap: { enabled: false },
                      padding: { top: 60 },
                      readOnly: true,
                      automaticLayout: true,
                    }}
                  />
                ) : (
                  <Editor
                    height="100%"
                    language={currentLanguage}
                    value={code}
                    onChange={handleCodeChange}
                    onMount={handleEditorMount}
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
                      readOnly: !canEdit || (isFileLocked && !isLockedByMe),
                      automaticLayout: true,
                    }}
                  />
                )
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

            {/* Mobile Preview (shown when preview enabled) */}
            {showPreview && (
              <div className="h-64 border-t border-border/50 shrink-0">
                <LivePreview srcdoc={previewDoc} />
              </div>
            )}

            {/* Terminal/Output - Rendered as Bottom Sheet on Mobile */}
            <Sheet open={terminalOpen} onOpenChange={setTerminalOpen}>
              <SheetContent side="bottom" className="h-[50vh] p-0 flex flex-col bg-terminal border-t border-border/50">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTerminalTab('output')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors',
                        terminalTab === 'output'
                          ? 'text-foreground bg-secondary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Terminal className="h-3 w-3" />
                      Output
                    </button>
                    <button
                      onClick={() => setTerminalTab('console')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors relative',
                        terminalTab === 'console'
                          ? 'text-foreground bg-secondary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Globe className="h-3 w-3" />
                      Console
                      {consoleLogs.length > 0 && terminalTab !== 'console' && (
                        <span className="ml-1 px-1 py-0 text-[9px] rounded-full bg-emerald-500/20 text-emerald-400">
                          {consoleLogs.length}
                        </span>
                      )}
                    </button>
                    {currentLanguage === 'html' && (
                      <button
                        onClick={() => setTerminalTab('preview')}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors',
                          terminalTab === 'preview'
                            ? 'text-foreground bg-secondary'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Eye className="h-3 w-3" />
                        Live Preview
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {terminalTab === 'output' && (
                      <input
                        type="text"
                        value={stdinInput}
                        onChange={(e) => setStdinInput(e.target.value)}
                        placeholder="stdin input..."
                        className="h-5 px-1.5 text-[10px] bg-background border border-border/50 rounded text-foreground w-28 focus:outline-none focus:border-primary"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-xs px-2"
                      onClick={() => terminalTab === 'output' ? setOutput([]) : clearConsole()}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="p-2 font-mono text-xs overflow-auto flex-1">
                  {terminalTab === 'output' ? (
                    output.length === 0 ? (
                      <span className="text-muted-foreground">
                        Tap "Run" to execute...
                      </span>
                    ) : (
                      output.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap">
                          {line}
                        </div>
                      ))
                    )
                  ) : terminalTab === 'console' ? (
                    consoleLogs.length === 0 ? (
                      <span className="text-muted-foreground">
                        Console output from preview will appear here...
                      </span>
                    ) : (
                      consoleLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className={cn(
                            'whitespace-pre-wrap py-0.5 border-b border-border/10',
                            entry.method === 'error' && 'text-red-400',
                            entry.method === 'warn' && 'text-amber-400',
                            entry.method === 'info' && 'text-cyan-400'
                          )}
                        >
                          <span className="text-muted-foreground/50 mr-1.5">›</span>
                          {entry.args.join(' ')}
                        </div>
                      ))
                    )
                  ) : terminalTab === 'preview' ? (
                    <iframe 
                      sandbox="allow-scripts allow-same-origin" 
                      className="w-full h-full bg-white rounded-md" 
                      srcDoc={code} 
                      title="Live Preview"
                    />
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          // Desktop layout - resizable panels
          <PanelGroup direction="horizontal">
            {/* Sidebar with tabs */}
            {sidebarCollapsed ? (
              <div className="h-full border-r border-border/50 bg-sidebar w-12 flex-shrink-0 flex flex-col">
                {sidebarContent}
              </div>
            ) : (
              <>
                <Panel defaultSize={18} minSize={12} maxSize={30}>
                  <div className="h-full border-r border-border/50 bg-sidebar">
                    {sidebarContent}
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border/30 hover:bg-primary/50 transition-colors" />
              </>
            )}

            {/* Editor + Terminal */}
            <Panel defaultSize={sidebarCollapsed ? 100 : 82}>
              <PanelGroup direction="vertical">
                {/* Editor (+ optional Preview) with tabs */}
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
                              'flex items-center gap-1 px-3 py-1.5 text-sm border-r border-border/30 hover:bg-sidebar-accent transition-colors min-w-0',
                              selectedFile?.id === tab.id && 'bg-sidebar-accent'
                            )}
                          >
                            <span className="truncate max-w-[120px]">{tab.name}</span>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (splitFile?.id === tab.id) setSplitFile(null);
                                else setSplitFile(tab); 
                              }}
                              className={cn(
                                "hover:bg-primary/20 hover:text-primary rounded p-0.5 ml-1 transition-colors",
                                splitFile?.id === tab.id && "text-primary bg-primary/20"
                              )}
                              title={splitFile?.id === tab.id ? "Close Split" : "Split Right"}
                            >
                              <SplitSquareHorizontal className="h-3.5 w-3.5" />
                            </button>
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

                    {/* AI Lock Banner (desktop) */}
                    {isFileLocked && currentFileAILock && (
                      <AILockBanner
                        lockedBy={currentFileAILock}
                        isCurrentUser={isLockedByMe}
                        onStopGeneration={aiAgent.stopGeneration}
                        onRequestCancel={() => aiAgent.sendCancelRequest(currentFileAILock.userId, selectedFile?.id || '')}
                      />
                    )}

                    {/* Editor + Preview split */}
                    {/* Editor (+ Split Editor or Preview) */}
                    <div className="flex-1 relative">
                      {proposedAICode && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-border shadow-2xl p-2 rounded-lg">
                          <span className="text-xs font-semibold px-2">Reviewing AI Changes: {proposedAICode.fileName}</span>
                          <div className="h-4 w-px bg-border mx-1"></div>
                          <Button size="sm" className="h-8 bg-green-500/20 text-green-500 hover:bg-green-500/30 font-medium" onClick={handleAcceptAICode}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Accept All
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive font-medium" onClick={() => setProposedAICode(null)}>
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      {showPreview || splitFile ? (
                        <PanelGroup direction="horizontal">
                          <Panel defaultSize={50} minSize={25}>
                            <div className="h-full">
                              {selectedFile || files.length === 0 ? (
                                proposedAICode ? (
                                  <DiffEditor
                                    height="100%"
                                    language={currentLanguage}
                                    original={code}
                                    modified={proposedAICode.code}
                                    theme="vs-dark"
                                    options={{
                                      fontSize: 14,
                                      fontFamily: 'JetBrains Mono, monospace',
                                      minimap: { enabled: false },
                                      padding: { top: 60 },
                                      readOnly: true,
                                    }}
                                  />
                                ) : (
                                  <Editor
                                    height="100%"
                                    language={currentLanguage}
                                    value={code}
                                    onChange={handleCodeChange}
                                    onMount={handleEditorMount}
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
                                      bracketPairColorization: { enabled: true },
                                      autoClosingBrackets: 'always',
                                      autoClosingQuotes: 'always',
                                      formatOnPaste: true,
                                      readOnly: !canEdit || (isFileLocked && !isLockedByMe),
                                    }}
                                  />
                                )
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
                          </Panel>
                          <PanelResizeHandle className="w-1 bg-border/30 hover:bg-emerald-500/50 transition-colors" />
                          <Panel defaultSize={50} minSize={20}>
                            {showPreview ? (
                              <LivePreview srcdoc={previewDoc} />
                            ) : splitFile ? (
                              <div className="h-full border-l border-border/50">
                                <Editor
                                  height="100%"
                                  language={getLanguageFromFile(splitFile.name)}
                                  value={splitFile.content || ''}
                                  theme="vs-dark"
                                  options={{
                                    fontSize: 14,
                                    fontFamily: 'JetBrains Mono, monospace',
                                    minimap: { enabled: false },
                                    padding: { top: 16 },
                                    scrollBeyondLastLine: false,
                                    readOnly: true, // Split view is currently read-only to avoid sync race conditions in dual views
                                    wordWrap: 'on',
                                  }}
                                />
                                <div className="absolute top-0 right-0 bg-secondary/80 text-xs px-2 py-1 m-2 rounded backdrop-blur">
                                  Viewing: {splitFile.name} (Read Only)
                                </div>
                              </div>
                            ) : null}
                          </Panel>
                        </PanelGroup>
                      ) : (
                        // Editor only (no preview or split)
                        selectedFile || files.length === 0 ? (
                          proposedAICode ? (
                            <DiffEditor
                              height="100%"
                              language={currentLanguage}
                              original={code}
                              modified={proposedAICode.code}
                              theme="vs-dark"
                              options={{
                                fontSize: 14,
                                fontFamily: 'JetBrains Mono, monospace',
                                minimap: { enabled: true },
                                padding: { top: 60 },
                                readOnly: true,
                              }}
                            />
                          ) : (
                            <Editor
                              height="100%"
                              language={currentLanguage}
                              value={code}
                              onChange={handleCodeChange}
                              onMount={handleEditorMount}
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
                                readOnly: !canEdit || (isFileLocked && !isLockedByMe),
                              }}
                            />
                          )
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            <div className="text-center">
                              <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p>Select a file to start editing</p>
                              <p className="text-sm mt-1">or create a new file from the sidebar</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </Panel>

                <PanelResizeHandle className="h-1 bg-border/30 hover:bg-primary/50 transition-colors" />

                {/* Terminal/Output with tabs */}
                <Panel defaultSize={30} minSize={15}>
                  <div className="h-full bg-terminal border-t border-border/50">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTerminalTab('output')}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
                            terminalTab === 'output'
                              ? 'text-foreground bg-secondary'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Terminal className="h-3.5 w-3.5" />
                          Output
                        </button>
                        <button
                          onClick={() => setTerminalTab('console')}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors relative',
                            terminalTab === 'console'
                              ? 'text-foreground bg-secondary'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Console
                          {consoleLogs.length > 0 && terminalTab !== 'console' && (
                            <span className="ml-1 px-1.5 py-0 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                              {consoleLogs.length}
                            </span>
                          )}
                        </button>
                        {currentLanguage === 'html' && (
                          <button
                            onClick={() => setTerminalTab('preview')}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors relative',
                              terminalTab === 'preview'
                                ? 'text-foreground bg-secondary'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Live Preview
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {terminalTab === 'output' && (
                          <input
                            type="text"
                            value={stdinInput}
                            onChange={(e) => setStdinInput(e.target.value)}
                            placeholder="stdin input (for interactive programs)"
                            className="h-6 px-2 text-xs bg-background border border-border/50 rounded text-foreground w-64 focus:outline-none focus:border-primary"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => terminalTab === 'output' ? setOutput([]) : clearConsole()}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 font-mono text-sm overflow-auto h-[calc(100%-41px)]">
                      {terminalTab === 'output' ? (
                        output.length === 0 ? (
                          <span className="text-muted-foreground">
                            Click "Run" to execute your code...
                          </span>
                        ) : (
                          output.map((line, i) => (
                            <div key={i} className="whitespace-pre-wrap">
                              {line}
                            </div>
                          ))
                        )
                      ) : terminalTab === 'console' ? (
                        consoleLogs.length === 0 ? (
                          <span className="text-muted-foreground">
                            Console output from live preview will appear here...
                          </span>
                        ) : (
                          consoleLogs.map((entry) => (
                            <div
                              key={entry.id}
                              className={cn(
                                'whitespace-pre-wrap py-0.5 border-b border-border/10',
                                entry.method === 'error' && 'text-red-400',
                                entry.method === 'warn' && 'text-amber-400',
                                entry.method === 'info' && 'text-cyan-400'
                              )}
                            >
                              <span className="text-muted-foreground/50 mr-1.5">
                                {entry.method === 'error' ? '✕' : entry.method === 'warn' ? '⚠' : '›'}
                              </span>
                              {entry.args.join(' ')}
                            </div>
                          ))
                        )
                      ) : terminalTab === 'preview' ? (
                        <div className="h-full bg-white rounded-sm overflow-hidden">
                          <iframe 
                            sandbox="allow-scripts allow-same-origin" 
                            className="w-full h-full border-none" 
                            srcDoc={code} 
                            title="Live Preview"
                          />
                        </div>
                      ) : null}
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
