-- Create a helper function to check if a project is public (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_project_public(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_public FROM public.projects WHERE id = _project_id),
    false
  )
$$;

-- Fix project_files SELECT policy that references projects directly
DROP POLICY IF EXISTS "Users can view files in accessible projects" ON public.project_files;

CREATE POLICY "Users can view files in accessible projects"
ON public.project_files
FOR SELECT
USING (
  public.is_project_owner(project_id, auth.uid()) OR
  public.is_project_public(project_id) OR
  public.get_collaborator_role(project_id, auth.uid()) IS NOT NULL
);
