-- Allow project owners to insert collaborators (for approving access requests)
CREATE POLICY "Owners can add collaborators"
ON public.project_collaborators FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id
    AND projects.owner_id = auth.uid()
  )
);

-- Allow project owners to update collaborator roles
CREATE POLICY "Owners can update collaborator roles"
ON public.project_collaborators FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id
    AND projects.owner_id = auth.uid()
  )
);

-- Allow project owners to remove collaborators
CREATE POLICY "Owners can remove collaborators"
ON public.project_collaborators FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id
    AND projects.owner_id = auth.uid()
  )
);

-- Allow users to leave projects (delete their own collaboration)
CREATE POLICY "Users can leave projects"
ON public.project_collaborators FOR DELETE
USING (auth.uid() = user_id);