import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Eye, Edit2, Shield, ArrowUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CollaboratorRole } from '@/hooks/useCollaboratorRole';

interface RequestAccessDialogProps {
  projectId: string;
  currentRole: CollaboratorRole;
  trigger?: React.ReactNode;
}

type RequestableRole = 'edit' | 'full_access';

const roleInfo: Record<RequestableRole, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  edit: {
    label: 'Edit Mode',
    description: 'Can edit existing files but cannot create or delete files',
    icon: <Edit2 className="h-4 w-4" />,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
  },
  full_access: {
    label: 'Full Access',
    description: 'Can do everything including creating and deleting files',
    icon: <Shield className="h-4 w-4" />,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  },
};

export function RequestAccessDialog({ projectId, currentRole, trigger }: RequestAccessDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RequestableRole>('edit');
  const [message, setMessage] = useState('');

  // Filter available roles based on current role
  const availableRoles = (Object.entries(roleInfo) as [RequestableRole, typeof roleInfo[RequestableRole]][]).filter(
    ([role]) => {
      if (currentRole === 'view') return true;
      if (currentRole === 'edit') return role === 'full_access';
      return false;
    }
  );

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('access_requests').insert({
        project_id: projectId,
        user_id: user.id,
        requested_role: selectedRole,
        existing_role: currentRole,
        message: message.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Access request sent to project owner');
      setIsOpen(false);
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('You already have a pending request for this access level');
      } else {
        toast.error('Failed to send request');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRequest.mutate();
  };

  // Don't show if user already has full access
  if (currentRole === 'full_access' || !currentRole) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowUp className="h-4 w-4" />
            Request Access
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUp className="h-5 w-5 text-primary" />
            Request Higher Access
          </DialogTitle>
          <DialogDescription>
            Request additional permissions from the project owner
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Current Role */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Current Access</Label>
            <div className="flex items-center gap-2 mt-1">
              {currentRole === 'view' && <Eye className="h-4 w-4 text-blue-400" />}
              {currentRole === 'edit' && <Edit2 className="h-4 w-4 text-amber-400" />}
              <span className="font-medium">
                {currentRole === 'view' ? 'View Only' : 'Edit Mode'}
              </span>
            </div>
          </div>

          {/* Requested Role */}
          <div className="space-y-3">
            <Label>Request Access Level</Label>
            <RadioGroup
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as RequestableRole)}
              className="space-y-2"
            >
              {availableRoles.map(([role, info]) => (
                <label
                  key={role}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                    selectedRole === role
                      ? info.color
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value={role} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {info.icon}
                      <span className="font-medium text-sm">{info.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Tell the owner why you need this access..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary gap-2" disabled={createRequest.isPending}>
              {createRequest.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
