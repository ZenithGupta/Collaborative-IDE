import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code2, Loader2, Eye, Edit2, Shield, ArrowLeft, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const roleInfo: Record<string, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  view: {
    label: 'View Only',
    description: 'You can view the project but cannot make changes',
    icon: <Eye className="h-6 w-6" />,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  },
  edit: {
    label: 'Edit Mode',
    description: 'You can edit existing files but cannot create or delete files',
    icon: <Edit2 className="h-6 w-6" />,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  full_access: {
    label: 'Full Access',
    description: 'You can do everything including creating and deleting files',
    icon: <Shield className="h-6 w-6" />,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
};

export default function JoinByLink() {
  const { projectId, password } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [projectInfo, setProjectInfo] = useState<{
    id: string;
    name: string;
    role: string;
    provisionalId: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate link and get project info
  useEffect(() => {
    const validateLink = async () => {
      if (!projectId || !password) {
        setError('Invalid link');
        setIsLoading(false);
        return;
      }
      
      // If user is not logged in, we cannot use the provisional trick
      // They must login first to get a user.id
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // 1. Check if they are already a collaborator to unlock RLS
        const { data: existingCollab } = await supabase
          .from('project_collaborators')
          .select('id, role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();

        let provisionalId = existingCollab?.id;
        
        if (!existingCollab) {
           const { data: inserted, error: insertErr } = await supabase
             .from('project_collaborators')
             .insert({
                project_id: projectId,
                user_id: user.id,
                role: 'view' // provisional
             })
             .select()
             .single();
           if (insertErr) throw insertErr;
           provisionalId = inserted.id;
        }

        // 2. Now RLS allows us to fetch the project passwords
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id, name, owner_id, view_password, edit_password, full_access_password')
          .eq('id', projectId)
          .single();

        if (projectError || !project) {
          if (!existingCollab && provisionalId) {
             await supabase.from('project_collaborators').delete().eq('id', provisionalId);
          }
          setError('Project not found. The link may be invalid or expired.');
          setIsLoading(false);
          return;
        }

        // 3. Validate password
        let matchedRole: string | null = null;
        if (project.full_access_password === password) {
          matchedRole = 'full_access';
        } else if (project.edit_password === password) {
          matchedRole = 'edit';
        } else if (project.view_password === password) {
          matchedRole = 'view';
        }

        if (!matchedRole) {
          if (!existingCollab && provisionalId) {
             await supabase.from('project_collaborators').delete().eq('id', provisionalId);
          }
          setError('Invalid password. Please check your link.');
          setIsLoading(false);
          return;
        }

        // Check if user is already the owner
        if (project.owner_id === user.id) {
          toast.info('This is your own project!');
          navigate(`/project/${project.id}`);
          return;
        }

        setProjectInfo({
          id: project.id,
          name: project.name,
          role: matchedRole,
          provisionalId: !existingCollab ? provisionalId || null : null
        });
      } catch (err) {
        console.error(err);
        setError('Failed to validate link');
      }

      setIsLoading(false);
    };

    if (!authLoading) {
      validateLink();
    }
  }, [projectId, password, user, authLoading, navigate]);

  const handleJoin = async () => {
    if (!user || !projectInfo) return;

    setIsJoining(true);

    try {
      // Since we already might have a provisional insert, update to the actual matched role
      if (projectInfo.provisionalId) {
        const { error: updateError } = await supabase
          .from('project_collaborators')
          .update({ role: projectInfo.role as 'view' | 'edit' | 'full_access' })
          .eq('id', projectInfo.provisionalId);
        if (updateError) throw updateError;
      } else {
        // We already existed as a collaborator, maybe just update our role if this link provides higher access
        const { data: existing } = await supabase
          .from('project_collaborators')
          .select('id, role')
          .eq('project_id', projectInfo.id)
          .eq('user_id', user.id)
          .single();

        if (existing && existing.role !== 'full_access' && projectInfo.role !== existing.role) {
          await supabase
            .from('project_collaborators')
            .update({ role: projectInfo.role as 'view' | 'edit' | 'full_access' })
            .eq('id', existing.id);
        }
      }

      toast.success(`Joined with ${roleInfo[projectInfo.role].label} access!`);
      navigate(`/project/${projectInfo.id}`);
    } catch (err) {
      toast.error('Failed to join project');
      setIsJoining(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-destructive/10 w-fit mb-2">
              <Code2 className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Link Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
              <Code2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>
              You need to sign in to join this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectInfo && (
              <div className={cn(
                "p-4 rounded-lg border-2 text-center",
                roleInfo[projectInfo.role].color
              )}>
                <div className="flex justify-center mb-2">
                  {roleInfo[projectInfo.role].icon}
                </div>
                <p className="font-semibold">{roleInfo[projectInfo.role].label}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {roleInfo[projectInfo.role].description}
                </p>
              </div>
            )}
            <Button 
              className="w-full gradient-primary" 
              onClick={() => navigate(`/auth?redirect=/join/${projectId}/${password}`)}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in to Join
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 rounded-full gradient-primary w-fit mb-2">
            <Code2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle>Join Project</CardTitle>
          <CardDescription>
            You've been invited to collaborate on "{projectInfo?.name}"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projectInfo && (
            <div className={cn(
              "p-4 rounded-lg border-2",
              roleInfo[projectInfo.role].color
            )}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-current/10">
                  {roleInfo[projectInfo.role].icon}
                </div>
                <div>
                  <p className="font-semibold">{roleInfo[projectInfo.role].label}</p>
                  <p className="text-sm text-muted-foreground">
                    {roleInfo[projectInfo.role].description}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard')}>
              Cancel
            </Button>
            <Button 
              className="flex-1 gradient-primary" 
              onClick={handleJoin}
              disabled={isJoining}
            >
              {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Project
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
