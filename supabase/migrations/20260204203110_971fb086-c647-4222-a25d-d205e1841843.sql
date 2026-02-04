-- Fix infinite recursion between projects <-> project_collaborators RLS
-- The projects SELECT policy references project_collaborators.
-- Some project_collaborators policies referenced projects, creating a cycle.
-- Use the SECURITY DEFINER function public.is_project_owner(...) to break recursion.

-- Drop recursive owner-based policies
DROP POLICY IF EXISTS "Owners can view project collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "Owners can update collaborator roles" ON public.project_collaborators;
DROP POLICY IF EXISTS "Owners can remove collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "Owners can add collaborators" ON public.project_collaborators;

-- Recreate policies without referencing public.projects directly
CREATE POLICY "Owners can view project collaborators"
ON public.project_collaborators
FOR SELECT
USING (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Owners can update collaborator roles"
ON public.project_collaborators
FOR UPDATE
USING (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Owners can remove collaborators"
ON public.project_collaborators
FOR DELETE
USING (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Owners can add collaborators"
ON public.project_collaborators
FOR INSERT
WITH CHECK (public.is_project_owner(project_id, auth.uid()));
