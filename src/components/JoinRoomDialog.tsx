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
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface JoinRoomDialogProps {
  trigger?: React.ReactNode;
}

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

    if (!user) {
      toast.error('You must be logged in to join a room');
      return;
    }

    setIsJoining(true);

    try {
      // Find project by room code
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, room_password, owner_id')
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

      // Verify password if set
      if (project.room_password && project.room_password !== password) {
        toast.error('Incorrect password');
        setIsJoining(false);
        return;
      }

      // Add user as collaborator
      const { error: collabError } = await supabase
        .from('project_collaborators')
        .upsert({
          project_id: project.id,
          user_id: user.id,
        }, {
          onConflict: 'project_id,user_id'
        });

      if (collabError) {
        console.error('Error joining room:', collabError);
        toast.error('Failed to join room');
        setIsJoining(false);
        return;
      }

      toast.success('Joined room successfully!');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Room</DialogTitle>
          <DialogDescription>
            Enter the room code and password (if required) to join a project
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
              className="font-mono tracking-wider"
              maxLength={8}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="room-password">Password (optional)</Label>
            <Input
              id="room-password"
              type="password"
              placeholder="Enter password if required"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isJoining}>
              {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Room
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
