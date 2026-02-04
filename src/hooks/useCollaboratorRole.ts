import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CollaboratorRole = 'view' | 'edit' | 'full_access' | null;

interface UseCollaboratorRoleOptions {
  projectId: string | undefined;
  userId: string | undefined;
}

export function useCollaboratorRole({ projectId, userId }: UseCollaboratorRoleOptions) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['collaborator-role', projectId, userId],
    queryFn: async () => {
      if (!projectId || !userId) return null;

      // First check if user is owner
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      
      if (project.owner_id === userId) {
        return 'owner' as const;
      }

      // Check collaborator role
      const { data: collaborator, error: collabError } = await supabase
        .from('project_collaborators')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();

      if (collabError) throw collabError;
      
      return collaborator?.role as CollaboratorRole;
    },
    enabled: !!projectId && !!userId,
  });

  const isOwner = data === 'owner';
  const role = isOwner ? null : (data as CollaboratorRole);
  
  // Permission checks
  const canView = isOwner || !!role;
  const canEdit = isOwner || role === 'edit' || role === 'full_access';
  const canManageFiles = isOwner || role === 'full_access';

  return {
    role,
    isOwner,
    canView,
    canEdit,
    canManageFiles,
    isLoading,
    error,
  };
}
