import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Copy,
  Check,
  Link2,
  Key,
  Eye,
  Edit2,
  Shield,
  RefreshCw,
  Users,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    name: string;
    room_code: string | null;
    view_password?: string | null;
    edit_password?: string | null;
    full_access_password?: string | null;
  };
}

type AccessLevel = 'view' | 'edit' | 'full_access';

const accessLevels: { key: AccessLevel; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    key: 'view',
    label: 'View Only',
    description: 'Can view the project but cannot make changes',
    icon: <Eye className="h-4 w-4" />,
    color: 'text-blue-400',
  },
  {
    key: 'edit',
    label: 'Edit Mode',
    description: 'Can edit existing files but cannot create or delete files',
    icon: <Edit2 className="h-4 w-4" />,
    color: 'text-amber-400',
  },
  {
    key: 'full_access',
    label: 'Full Access',
    description: 'Can do everything including creating and deleting files',
    icon: <Shield className="h-4 w-4" />,
    color: 'text-emerald-400',
  },
];

export function ShareProjectDialog({ open, onOpenChange, project }: ShareProjectDialogProps) {
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccessLevel>('view');

  // Fetch full project data with passwords
  const { data: fullProject, isLoading } = useQuery({
    queryKey: ['project-share', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, room_code, view_password, edit_password, full_access_password')
        .eq('id', project.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Generate passwords mutation
  const generatePasswords = useMutation({
    mutationFn: async () => {
      const passwords = {
        view_password: generateRandomPassword(),
        edit_password: generateRandomPassword(),
        full_access_password: generateRandomPassword(),
      };
      
      const { error } = await supabase
        .from('projects')
        .update(passwords)
        .eq('id', project.id);
      
      if (error) throw error;
      return passwords;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-share', project.id] });
      toast.success('New passwords generated!');
    },
    onError: () => {
      toast.error('Failed to generate passwords');
    },
  });

  // Regenerate single password
  const regeneratePassword = useMutation({
    mutationFn: async (level: AccessLevel) => {
      const newPassword = generateRandomPassword();
      const updateData = { [`${level}_password`]: newPassword };
      
      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', project.id);
      
      if (error) throw error;
      return { level, password: newPassword };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-share', project.id] });
      toast.success(`${accessLevels.find(l => l.key === data.level)?.label} password regenerated`);
    },
    onError: () => {
      toast.error('Failed to regenerate password');
    },
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getShareLink = (level: AccessLevel) => {
    const password = fullProject?.[`${level}_password`];
    if (!fullProject?.room_code || !password) return null;
    return `${window.location.origin}/join/${fullProject.room_code}/${password}`;
  };

  const getPassword = (level: AccessLevel) => {
    return fullProject?.[`${level}_password`] || null;
  };

  // Auto-generate passwords if none exist
  useEffect(() => {
    if (fullProject && !fullProject.view_password && !fullProject.edit_password && !fullProject.full_access_password) {
      generatePasswords.mutate();
    }
  }, [fullProject]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Share "{project.name}"
          </DialogTitle>
          <DialogDescription>
            Share your project with different access levels. Each level has a unique password and link.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Room Code */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Room Code</Label>
                  <p className="font-mono text-2xl tracking-[0.3em] text-primary font-bold mt-1">
                    {fullProject?.room_code}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(fullProject?.room_code || '', 'room_code')}
                >
                  {copiedField === 'room_code' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Access Level Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AccessLevel)}>
              <TabsList className="grid grid-cols-3 w-full">
                {accessLevels.map((level) => (
                  <TabsTrigger
                    key={level.key}
                    value={level.key}
                    className="flex items-center gap-2 data-[state=active]:text-primary"
                  >
                    {level.icon}
                    <span className="hidden sm:inline">{level.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {accessLevels.map((level) => (
                <TabsContent key={level.key} value={level.key} className="mt-4 space-y-4">
                  <div className={cn(
                    "p-4 rounded-lg border-2 border-dashed",
                    level.key === 'view' && "border-blue-500/30 bg-blue-500/5",
                    level.key === 'edit' && "border-amber-500/30 bg-amber-500/5",
                    level.key === 'full_access' && "border-emerald-500/30 bg-emerald-500/5"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg", level.color, "bg-current/10")}>
                        {level.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{level.label}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{level.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="h-3.5 w-3.5" />
                      Password for {level.label}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={getPassword(level.key) || ''}
                        readOnly
                        className="font-mono text-lg tracking-widest"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(getPassword(level.key) || '', `${level.key}_password`)}
                      >
                        {copiedField === `${level.key}_password` ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => regeneratePassword.mutate(level.key)}
                        disabled={regeneratePassword.isPending}
                      >
                        <RefreshCw className={cn(
                          "h-4 w-4",
                          regeneratePassword.isPending && "animate-spin"
                        )} />
                      </Button>
                    </div>
                  </div>

                  {/* Shareable Link */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5" />
                      Shareable Link
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={getShareLink(level.key) || ''}
                        readOnly
                        className="text-sm"
                        placeholder="Generating link..."
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(getShareLink(level.key) || '', `${level.key}_link`)}
                        disabled={!getShareLink(level.key)}
                      >
                        {copiedField === `${level.key}_link` ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Anyone with this link can join with <span className={level.color}>{level.label}</span> permissions
                    </p>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Quick Share Buttons */}
            <div className="border-t pt-4">
              <Label className="text-sm text-muted-foreground mb-3 block">Quick Copy</Label>
              <div className="flex flex-wrap gap-2">
                {accessLevels.map((level) => (
                  <Button
                    key={level.key}
                    variant="outline"
                    size="sm"
                    className={cn("gap-2", level.color)}
                    onClick={() => copyToClipboard(getShareLink(level.key) || '', `quick_${level.key}`)}
                    disabled={!getShareLink(level.key)}
                  >
                    {level.icon}
                    Copy {level.label} Link
                    {copiedField === `quick_${level.key}` && <Check className="h-3 w-3" />}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
