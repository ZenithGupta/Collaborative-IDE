import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Bell,
  Check,
  X,
  Eye,
  Edit2,
  Shield,
  ArrowRight,
  Loader2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface AccessRequestsPanelProps {
  projectId: string;
}

interface AccessRequest {
  id: string;
  project_id: string;
  user_id: string;
  requested_role: 'view' | 'edit' | 'full_access';
  existing_role: 'view' | 'edit' | 'full_access' | null;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  created_at: string;
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  };
}

const roleLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  view: { label: 'View Only', icon: <Eye className="h-3.5 w-3.5" />, color: 'text-blue-400' },
  edit: { label: 'Edit Mode', icon: <Edit2 className="h-3.5 w-3.5" />, color: 'text-amber-400' },
  full_access: { label: 'Full Access', icon: <Shield className="h-3.5 w-3.5" />, color: 'text-emerald-400' },
};

export function AccessRequestsPanel({ projectId }: AccessRequestsPanelProps) {
  const queryClient = useQueryClient();

  // Fetch pending requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['access-requests', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_requests')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AccessRequest[];
    },
  });

  // Approve request
  const approveRequest = useMutation({
    mutationFn: async (request: AccessRequest) => {
      // Check if collaborator already exists
      const { data: existing } = await supabase
        .from('project_collaborators')
        .select('id')
        .eq('project_id', request.project_id)
        .eq('user_id', request.user_id)
        .maybeSingle();

      if (existing) {
        // Update existing collaborator role
        const { error: updateError } = await supabase
          .from('project_collaborators')
          .update({ role: request.requested_role })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Insert new collaborator
        const { error: insertError } = await supabase
          .from('project_collaborators')
          .insert({
            project_id: request.project_id,
            user_id: request.user_id,
            role: request.requested_role,
          });

        if (insertError) throw insertError;
      }

      // Update request status
      const { error: requestError } = await supabase
        .from('access_requests')
        .update({ status: 'approved', responded_at: new Date().toISOString() })
        .eq('id', request.id);

      if (requestError) throw requestError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests', projectId] });
      toast.success('Access request approved');
    },
    onError: () => {
      toast.error('Failed to approve request');
    },
  });

  // Reject request
  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('access_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests', projectId] });
      toast.success('Access request rejected');
    },
    onError: () => {
      toast.error('Failed to reject request');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Access Requests</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {requests.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Pending requests for higher access levels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => {
          const requestedRole = roleLabels[request.requested_role];
          const existingRole = request.existing_role ? roleLabels[request.existing_role] : null;

          return (
            <div
              key={request.id}
              className="p-3 rounded-lg bg-background/50 border border-border space-y-3"
            >
              {/* User info */}
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={request.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {request.profiles?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {request.profiles?.username || 'Unknown User'}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>

              {/* Role change */}
              <div className="flex items-center gap-2 text-sm">
                {existingRole && (
                  <>
                    <div className={cn("flex items-center gap-1", existingRole.color)}>
                      {existingRole.icon}
                      <span>{existingRole.label}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </>
                )}
                <div className={cn("flex items-center gap-1 font-medium", requestedRole.color)}>
                  {requestedRole.icon}
                  <span>{requestedRole.label}</span>
                </div>
              </div>

              {/* Message */}
              {request.message && (
                <p className="text-xs text-muted-foreground italic">
                  "{request.message}"
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1 h-8"
                  onClick={() => approveRequest.mutate(request)}
                  disabled={approveRequest.isPending || rejectRequest.isPending}
                >
                  {approveRequest.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 h-8 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                  onClick={() => rejectRequest.mutate(request.id)}
                  disabled={approveRequest.isPending || rejectRequest.isPending}
                >
                  {rejectRequest.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
