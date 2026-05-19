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
import { ThemeToggle } from '@/components/ThemeToggle';
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
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Pathforge
          </Link>
          <nav className="flex items-center gap-5 text-sm text-slate-600 dark:text-slate-400">
            <Link to="/roadmaps" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Roadmaps
            </Link>
            <Link to="/jobs" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Jobs
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
              <Avatar className="h-8 w-8">
                {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt={me.name} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-700 dark:text-slate-300">{me.name}</span>
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
      </div>
    </header>
  );
}
