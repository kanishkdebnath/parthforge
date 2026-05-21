import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TimezoneCard } from '@/components/profile/TimezoneCard';
import { useMe } from '@/hooks/useAuth';

export default function Profile() {
  const { data: me } = useMe();
  if (!me) return null;

  const initials = me.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="container py-10 max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt={me.name} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-lg font-medium">{me.name}</div>
            <div className="text-muted-foreground text-sm">{me.email}</div>
          </div>
        </CardContent>
      </Card>

      <TimezoneCard />
    </main>
  );
}
