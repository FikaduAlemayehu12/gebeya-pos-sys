import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole =
  | 'admin' | 'cashier' | 'inventory_manager' | 'hr_admin' | 'payroll_officer'
  | 'manager' | 'employee' | 'finance_manager' | 'auditor' | 'branch_manager'
  | 'procurement' | 'user';

interface Profile {
  full_name: string;
  father_name: string;
  grandfather_name: string;
  phone: string;
  avatar_url: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  accessLevel: string;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [accessLevel, setAccessLevel] = useState<string>('full');
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('full_name, father_name, grandfather_name, phone, avatar_url').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role, access_level').eq('user_id', userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r: any) => r.role as AppRole));
      setAccessLevel(rolesRes.data[0]?.access_level || 'full');
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setAccessLevel('full');
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      try {
        await supabase.from('pos_activity_logs').insert({
          user_id: data.user.id,
          action_type: 'user_login',
          description: `Signed in as ${email}`,
        } as any);
      } catch { /* ignore */ }
    }
    return { error };
  };

  const signOut = async () => {
    if (user) {
      try {
        await supabase.from('pos_activity_logs').insert({
          user_id: user.id,
          action_type: 'user_logout',
          description: `Signed out`,
        } as any);
      } catch { /* ignore */ }
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, roles, accessLevel, loading, hasRole, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
