-- Drop the broken policies
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update accessible projects" ON public.projects;

-- Recreate with correct references
CREATE POLICY "Users can view accessible projects"
ON public.projects FOR SELECT
USING (
  owner_id = auth.uid() OR 
  is_public = true OR 
  EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_collaborators.project_id = projects.id
    AND project_collaborators.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update accessible projects"
ON public.projects FOR UPDATE
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_collaborators.project_id = projects.id
    AND project_collaborators.user_id = auth.uid()
  )
);