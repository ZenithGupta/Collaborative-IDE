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
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomCode.trim()) {
      toast.error('Please enter a room code');
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
      // Find project by room code
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, owner_id, view_password, edit_password, full_access_password')
        .eq('room_code', roomCode.toUpperCase())
        .single();

      if (projectError || !project) {
        toast.error('Room not found. Please check the room code.');
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

      // Determine role from password
      let role: 'view' | 'edit' | 'full_access' | null = null;
      if (project.full_access_password === password) {
        role = 'full_access';
      } else if (project.edit_password === password) {
        role = 'edit';
      } else if (project.view_password === password) {
        role = 'view';
      }

      if (!role) {
        toast.error('Incorrect password');
        setIsJoining(false);
        return;
      }

      // Check if collaborator record exists
      const { data: existing } = await supabase
        .from('project_collaborators')
        .select('id')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('project_collaborators')
          .update({ role })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('project_collaborators')
          .insert({
            project_id: project.id,
            user_id: user.id,
            role,
          });
        if (insertError) throw insertError;
      }

      toast.success(`Joined with ${roleInfo[role].label} access!`);
      navigate(`/project/${project.id}`);
      setIsOpen(false);
      setRoomCode('');
      setPassword('');
    } catch (error) {
      console.error('Join room error:', error);
      toast.error('An error occurred while joining the room');
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
            <Label htmlFor="room-code">Room Code</Label>
            <Input
              id="room-code"
              placeholder="e.g. ABC12345"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="font-mono text-lg tracking-widest text-center"
              maxLength={8}
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
