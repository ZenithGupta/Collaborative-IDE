-- SECURITY DEFINER function to validate a room code + password.
-- This bypasses RLS so that users who are NOT yet collaborators
-- can look up a project by its room_code to join.
-- Returns: project id, name, owner_id, and the matched role.
-- Returns NULL row if room_code not found or password doesn't match any role.

CREATE OR REPLACE FUNCTION public.validate_room_invite(
  _room_code VARCHAR,
  _password VARCHAR
)
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  owner_id UUID,
  matched_role collaborator_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.owner_id,
    CASE 
      WHEN p.full_access_password = _password THEN 'full_access'::collaborator_role
      WHEN p.edit_password = _password THEN 'edit'::collaborator_role
      WHEN p.view_password = _password THEN 'view'::collaborator_role
      ELSE NULL
    END AS matched_role
  FROM public.projects p
  WHERE p.room_code = UPPER(_room_code)
$$;

-- Also create a simpler function for just looking up by room code (no password).
-- Returns only the project id and name — no sensitive data.
-- Used to show "You've been invited to <project>" before password validation.
CREATE OR REPLACE FUNCTION public.lookup_project_by_room_code(
  _room_code VARCHAR
)
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  owner_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.owner_id
  FROM public.projects p
  WHERE p.room_code = UPPER(_room_code)
$$;
