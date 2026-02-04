import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProjectFile } from '@/components/FileExplorer';
import { useCallback, useRef, useEffect } from 'react';

interface UseProjectFilesOptions {
  projectId: string | undefined;
}

export function useProjectFiles({ projectId }: UseProjectFilesOptions) {
  const queryClient = useQueryClient();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch all files for the project
  const {
    data: files = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('name');

      if (error) throw error;
      return data as ProjectFile[];
    },
    enabled: !!projectId,
  });

  // Save file content mutation
  const saveFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      const { error } = await supabase
        .from('project_files')
        .update({ content })
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
    },
  });

  // Debounced save function
  const saveFileContent = useCallback(
    (fileId: string, content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveFileMutation.mutate({ fileId, content });
      }, 1000);
    },
    [saveFileMutation]
  );

  // Clean up timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get language from file extension
  const getLanguageFromFile = useCallback((fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      hpp: 'cpp',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      txt: 'plaintext',
      sql: 'sql',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
    };
    return languageMap[ext || ''] || 'plaintext';
  }, []);

  return {
    files,
    isLoading,
    error,
    saveFileContent,
    isSaving: saveFileMutation.isPending,
    getLanguageFromFile,
  };
}
