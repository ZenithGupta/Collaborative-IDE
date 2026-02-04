-- Create enum for collaborator roles
CREATE TYPE public.collaborator_role AS ENUM ('view', 'edit', 'full_access');

-- Add role column to project_collaborators
ALTER TABLE public.project_collaborators 
ADD COLUMN role collaborator_role NOT NULL DEFAULT 'view';

-- Create security definer function to check collaborator role
CREATE OR REPLACE FUNCTION public.get_collaborator_role(_project_id uuid, _user_id uuid)
RETURNS collaborator_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.project_collaborators
  WHERE project_id = _project_id AND user_id = _user_id
  LIMIT 1
$$;

-- Create function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND owner_id = _user_id
  )
$$;

-- Drop existing policies on project_files
DROP POLICY IF EXISTS "Users can view files in accessible projects" ON public.project_files;
DROP POLICY IF EXISTS "Users can create files in owned/collaborated projects" ON public.project_files;
DROP POLICY IF EXISTS "Users can update files in owned/collaborated projects" ON public.project_files;
DROP POLICY IF EXISTS "Users can delete files in owned/collaborated projects" ON public.project_files;

-- SELECT: view, edit, full_access can all view (plus owner and public)
CREATE POLICY "Users can view files in accessible projects"
ON public.project_files FOR SELECT
USING (
  public.is_project_owner(project_id, auth.uid()) OR
  (SELECT is_public FROM projects WHERE id = project_id) = true OR
  public.get_collaborator_role(project_id, auth.uid()) IS NOT NULL
);

-- INSERT: only owner or full_access can create files
CREATE POLICY "Users can create files in owned or full access projects"
ON public.project_files FOR INSERT
WITH CHECK (
  public.is_project_owner(project_id, auth.uid()) OR
  public.get_collaborator_role(project_id, auth.uid()) = 'full_access'
);

-- UPDATE: owner, edit, or full_access can update
CREATE POLICY "Users can update files in owned or edit/full access projects"
ON public.project_files FOR UPDATE
USING (
  public.is_project_owner(project_id, auth.uid()) OR
  public.get_collaborator_role(project_id, auth.uid()) IN ('edit', 'full_access')
);

-- DELETE: only owner or full_access can delete
CREATE POLICY "Users can delete files in owned or full access projects"
ON public.project_files FOR DELETE
USING (
  public.is_project_owner(project_id, auth.uid()) OR
  public.get_collaborator_role(project_id, auth.uid()) = 'full_access'
);