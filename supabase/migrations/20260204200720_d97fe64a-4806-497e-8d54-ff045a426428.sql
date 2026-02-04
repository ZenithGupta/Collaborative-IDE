-- Add separate passwords for each access level
ALTER TABLE public.projects 
ADD COLUMN view_password VARCHAR DEFAULT NULL,
ADD COLUMN edit_password VARCHAR DEFAULT NULL,
ADD COLUMN full_access_password VARCHAR DEFAULT NULL;

-- Generate passwords for existing projects
UPDATE public.projects SET
  view_password = substr(md5(random()::text), 1, 8),
  edit_password = substr(md5(random()::text), 1, 8),
  full_access_password = substr(md5(random()::text), 1, 8)
WHERE room_code IS NOT NULL;

-- Create access requests table
CREATE TABLE public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_role collaborator_role NOT NULL,
  existing_role collaborator_role,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(project_id, user_id, status)
);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own access requests
CREATE POLICY "Users can create access requests"
ON public.access_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
ON public.access_requests FOR SELECT
USING (auth.uid() = user_id);

-- Project owners can view requests for their projects
CREATE POLICY "Owners can view project requests"
ON public.access_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = access_requests.project_id 
    AND projects.owner_id = auth.uid()
  )
);

-- Project owners can update requests (approve/reject)
CREATE POLICY "Owners can update project requests"
ON public.access_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = access_requests.project_id 
    AND projects.owner_id = auth.uid()
  )
);

-- Users can delete their own pending requests
CREATE POLICY "Users can delete their pending requests"
ON public.access_requests FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Function to get role from password
CREATE OR REPLACE FUNCTION public.get_role_from_password(_project_id uuid, _password varchar)
RETURNS collaborator_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN full_access_password = _password THEN 'full_access'::collaborator_role
      WHEN edit_password = _password THEN 'edit'::collaborator_role
      WHEN view_password = _password THEN 'view'::collaborator_role
      ELSE NULL
    END
  FROM public.projects
  WHERE id = _project_id
$$;