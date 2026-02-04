-- Allow project owners to view all collaborators on their projects
CREATE POLICY "Owners can view project collaborators"
ON public.project_collaborators FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id
    AND projects.owner_id = auth.uid()
  )
);