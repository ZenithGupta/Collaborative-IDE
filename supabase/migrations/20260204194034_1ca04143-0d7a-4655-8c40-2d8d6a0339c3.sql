-- Create project_files table for multi-file support
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_folder BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES public.project_files(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for path within a project
ALTER TABLE public.project_files ADD CONSTRAINT unique_file_path UNIQUE (project_id, path);

-- Enable RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_files (same access as projects)
CREATE POLICY "Users can view files in accessible projects"
ON public.project_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND (
      p.owner_id = auth.uid()
      OR p.is_public = true
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can create files in owned/collaborated projects"
ON public.project_files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND (
      p.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can update files in owned/collaborated projects"
ON public.project_files
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND (
      p.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can delete files in owned/collaborated projects"
ON public.project_files
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND (
      p.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_project_files_updated_at
BEFORE UPDATE ON public.project_files
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();