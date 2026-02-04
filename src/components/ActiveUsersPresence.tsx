import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ActiveUser {
  id: string;
  username: string;
  avatar_url?: string;
  color?: string;
  isTyping?: boolean;
  currentFile?: string;
}

// Distinct colors for user presence
const USER_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

interface ActiveUsersPresenceProps {
  users: ActiveUser[];
  currentUserId?: string;
  className?: string;
}

export function ActiveUsersPresence({ users, currentUserId, className }: ActiveUsersPresenceProps) {
  // Filter out current user and assign colors
  const otherUsers = users
    .filter((u) => u.id !== currentUserId)
    .map((u) => ({
      ...u,
      color: getUserColor(u.id),
    }));

  if (otherUsers.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 4).map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar
                  className="h-7 w-7 border-2 transition-transform hover:scale-110 hover:z-10"
                  style={{ borderColor: user.color }}
                >
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback
                    className="text-xs font-medium text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Live indicator */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background animate-pulse"
                  style={{ backgroundColor: user.color }}
                />
                {/* Typing indicator */}
                {user.isTyping && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: user.color }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-3 w-3"
                      style={{ backgroundColor: user.color }}
                    />
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent
              className="flex flex-col items-center gap-1"
              style={{ borderColor: user.color }}
            >
              <span className="font-medium">{user.username}</span>
              {user.currentFile && (
                <span className="text-xs text-muted-foreground">
                  Editing: {user.currentFile}
                </span>
              )}
              {user.isTyping && (
                <span className="text-xs flex items-center gap-1">
                  <span className="flex gap-0.5">
                    <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  typing
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
        {otherUsers.length > 4 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                +{otherUsers.length - 4}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {otherUsers.slice(4).map((u) => u.username).join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// Sidebar version with more details
interface ActiveUsersSidebarProps {
  users: ActiveUser[];
  currentUserId?: string;
}

export function ActiveUsersSidebar({ users, currentUserId }: ActiveUsersSidebarProps) {
  const displayUsers = users.map((u) => ({
    ...u,
    color: getUserColor(u.id),
    isCurrentUser: u.id === currentUserId,
  }));

  return (
    <div className="space-y-1">
      {displayUsers.map((user) => (
        <div
          key={user.id}
          className={cn(
            'flex items-center gap-2 p-2 rounded-md transition-colors',
            'hover:bg-sidebar-accent'
          )}
        >
          <div className="relative">
            <Avatar className="h-6 w-6" style={{ borderColor: user.color }}>
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback
                className="text-xs text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background"
              style={{ backgroundColor: user.isTyping ? user.color : '#22c55e' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm truncate">
                {user.username}
                {user.isCurrentUser && (
                  <span className="text-xs text-muted-foreground ml-1">(you)</span>
                )}
              </span>
            </div>
            {user.currentFile && (
              <p className="text-xs text-muted-foreground truncate">
                {user.currentFile}
              </p>
            )}
          </div>
          {user.isTyping && !user.isCurrentUser && (
            <div className="flex gap-0.5" style={{ color: user.color }}>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      ))}
      {users.length === 0 && (
        <p className="text-xs text-muted-foreground px-2 py-1">No one else is here</p>
      )}
    </div>
  );
}
