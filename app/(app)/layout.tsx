import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyPermissions } from '@/lib/permissions/server';
import { AppShell } from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    redirect('/login');
  }

  const { capabilities } = await getMyPermissions();

  return (
    <AppShell
      profile={{
        display_name: profile.display_name,
        email: profile.email,
        role: profile.role,
      }}
      capabilities={[...capabilities]}
    >
      {children}
    </AppShell>
  );
}
