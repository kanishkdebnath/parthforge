import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMe, useLogout } from '@/hooks/useAuth';

export function Navbar() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();

  if (!me) return null;

  const initials = me.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="border-b bg-background">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Pathforge
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
            <Avatar className="h-8 w-8">
              {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt={me.name} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{me.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{me.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await logout.mutateAsync();
                navigate('/login', { replace: true });
              }}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
