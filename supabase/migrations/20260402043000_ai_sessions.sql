-- AI editing sessions table
-- Tracks when AI is actively editing files, providing persistent lock state
CREATE TABLE public.ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id UUID REFERENCES project_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
  affected_files JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  tokens_used INTEGER DEFAULT 0
);

-- Fast lookup: "is this file currently being AI-edited?"
CREATE INDEX idx_ai_sessions_active
  ON ai_sessions(project_id)
  WHERE status = 'running';

-- RLS policies
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see AI sessions for projects they collaborate on
CREATE POLICY "ai_sessions_select" ON ai_sessions
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_collaborators WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Only authenticated users can create sessions
CREATE POLICY "ai_sessions_insert" ON ai_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- The session owner or project owner can update (cancel)
CREATE POLICY "ai_sessions_update" ON ai_sessions
  FOR UPDATE USING (
    user_id = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );
