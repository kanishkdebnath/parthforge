import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDevUsers, useLogin, useMe } from '@/hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: devUsers, isPending } = useDevUsers();
  const login = useLogin();
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    if (me) navigate('/', { replace: true });
  }, [me, navigate]);

  const onContinue = async () => {
    if (!selected) return;
    await login.mutateAsync(selected);
    navigate('/', { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pick a seeded dev user. OAuth comes later.
          </p>
          <Select value={selected} onValueChange={setSelected} disabled={isPending}>
            <SelectTrigger>
              <SelectValue placeholder={isPending ? 'Loading…' : 'Choose a user'} />
            </SelectTrigger>
            <SelectContent>
              {devUsers?.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.name} — {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            disabled={!selected || login.isPending}
            onClick={onContinue}
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
