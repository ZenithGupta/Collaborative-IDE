-- Add room_code and room_password columns to projects for room-based access
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS room_code VARCHAR(8) UNIQUE,
ADD COLUMN IF NOT EXISTS room_password VARCHAR(100);

-- Create a function to generate random room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate room code on project creation
CREATE OR REPLACE FUNCTION set_room_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.room_code IS NULL THEN
    NEW.room_code := generate_room_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_set_room_code ON public.projects;
CREATE TRIGGER trigger_set_room_code
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION set_room_code();

-- Update existing projects with room codes
UPDATE public.projects SET room_code = generate_room_code() WHERE room_code IS NULL;

-- Create collaborators table for tracking who has joined a project
CREATE TABLE IF NOT EXISTS public.project_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on collaborators
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators can view their own entries
CREATE POLICY "Users can view their collaborations"
ON public.project_collaborators FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert themselves as collaborators (after password validation happens in app)
CREATE POLICY "Users can join projects"
ON public.project_collaborators FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update projects SELECT policy to allow collaborators and public access
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view public projects" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON public.projects;

CREATE POLICY "Users can view accessible projects"
ON public.projects FOR SELECT
USING (
  owner_id = auth.uid() 
  OR is_public = true 
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators 
    WHERE project_id = id AND user_id = auth.uid()
  )
);

-- Collaborators can update project code (for real-time sync)
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;

CREATE POLICY "Users can update accessible projects"
ON public.projects FOR UPDATE
USING (
  owner_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators 
    WHERE project_id = id AND user_id = auth.uid()
  )
);