-- Fix access_requests policies that reference projects directly, causing recursion
-- Use the SECURITY DEFINER function public.is_project_owner(...) instead

DROP POLICY IF EXISTS "Owners can view project requests" ON public.access_requests;
DROP POLICY IF EXISTS "Owners can update project requests" ON public.access_requests;

CREATE POLICY "Owners can view project requests"
ON public.access_requests
FOR SELECT
USING (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Owners can update project requests"
ON public.access_requests
FOR UPDATE
USING (public.is_project_owner(project_id, auth.uid()));
