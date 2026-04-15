import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Users, Eye, Edit2, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface JoinRoomDialogProps {
  trigger?: React.ReactNode;
}

const roleInfo: Record<string, { label: string; icon: React.ReactNode }> = {
  view: { label: 'View Only', icon: <Eye className="h-4 w-4" /> },
  edit: { label: 'Edit Mode', icon: <Edit2 className="h-4 w-4" /> },
  full_access: { label: 'Full Access', icon: <Shield className="h-4 w-4" /> },
};

export function JoinRoomDialog({ trigger }: JoinRoomDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [password, setPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectId.trim()) {
      toast.error('Please enter a Project ID');
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter the access password');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to join a room');
      return;
    }

    setIsJoining(true);

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
              project_id: projectId.trim(),
              user_id: user.id,
              role: 'view' // provisional
           })
           .select()
           .single();
         if (insertErr) throw insertErr;
         provisionalId = inserted.id;
      }

      // 2. Now that RLS permits, fetch the project details and passwords
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, owner_id, view_password, edit_password, full_access_password')
        .eq('id', projectId.trim())
        .single();

      if (projectError || !project) {
        if (!existingCollab && provisionalId) {
           await supabase.from('project_collaborators').delete().eq('id', provisionalId);
        }
        toast.error('Project not found. Please check the Project ID.');
        setIsJoining(false);
        return;
      }

      // Check if user is already the owner
      if (project.owner_id === user.id) {
        toast.info('This is your own project!');
        navigate(`/project/${project.id}`);
        setIsOpen(false);
        setIsJoining(false);
        return;
      }

      // 3. Validate password
      let matchedRole: 'view' | 'edit' | 'full_access' | null = null;
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
        toast.error('Incorrect password');
        setIsJoining(false);
        return;
      }

      const role = matchedRole;

      // Update to correct role if different (from provisional or existing)
      if (provisionalId) {
        if (!existingCollab || (existingCollab && existingCollab.role !== 'full_access' && role !== existingCollab.role)) {
          const { error: updateError } = await supabase
            .from('project_collaborators')
            .update({ role })
            .eq('id', provisionalId);
          if (updateError) throw updateError;
        }
      }

      toast.success(`Joined with ${roleInfo[role].label} access!`);
      navigate(`/project/${project.id}`);
      setIsOpen(false);
      setProjectId('');
      setPassword('');
    } catch (error) {
      console.error('Join room error:', error);
      toast.error('An error occurred while joining the project');
    }

    setIsJoining(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Users className="h-4 w-4" />
            Join Room
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Join a Room
          </DialogTitle>
          <DialogDescription>
            Enter the room code and password shared by the project owner
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleJoin} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID</Label>
            <Input
              id="project-id"
              placeholder="e.g. 123e4567-e89b-..."
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="font-mono text-sm tracking-wide text-center"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="room-password">Access Password</Label>
            <Input
              id="room-password"
              placeholder="Enter the password"
              value={password}
              onChange={(e) => setPassword(e.target.value.toUpperCase())}
              className="font-mono text-lg tracking-widest text-center"
              maxLength={8}
            />
            <p className="text-xs text-muted-foreground">
              The password determines your access level (View, Edit, or Full Access)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary gap-2" disabled={isJoining}>
              {isJoining && <Loader2 className="h-4 w-4 animate-spin" />}
              Join Room
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
