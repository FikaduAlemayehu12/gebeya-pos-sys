import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

export interface Company {
  id: string;
  name: string;
  code: string;
  logo_url: string;
  currency: string;
  plan: string;
  status: string;
  member_role: 'owner' | 'admin' | 'member';
  is_default: boolean;
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
  // multi-tenancy
  companies: Company[];
  activeCompany: Company | null;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_COMPANY_KEY = 'gebeya.activeCompanyId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [accessLevel, setAccessLevel] = useState<string>('full');
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);

  const fetchCompanies = useCallback(async (userId: string): Promise<Company[]> => {
    const { data, error } = await supabase
      .from('company_members')
      .select('member_role, is_default, companies:company_id (id, name, code, logo_url, currency, plan, status)')
      .eq('user_id', userId);
    if (error || !data) return [];
    const list: Company[] = data
      .filter((r: any) => r.companies)
      .map((r: any) => ({
        id: r.companies.id,
        name: r.companies.name,
        code: r.companies.code,
        logo_url: r.companies.logo_url || '',
        currency: r.companies.currency,
        plan: r.companies.plan,
        status: r.companies.status,
        member_role: r.member_role,
        is_default: r.is_default,
      }));
    return list;
  }, []);

  const pickActiveCompany = useCallback((list: Company[]): Company | null => {
    if (!list.length) return null;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_COMPANY_KEY) : null;
    if (stored) {
      const found = list.find((c) => c.id === stored);
      if (found) return found;
    }
    return list.find((c) => c.is_default) || list[0];
  }, []);

  const setSessionTenant = useCallback(async (companyId: string) => {
    try {
      await (supabase as any).rpc('set_active_tenant', { _company_id: companyId });
    } catch { /* ignore */ }
  }, []);

  const fetchUserData = useCallback(async (userId: string) => {
    const [profileRes, rolesRes, companyList] = await Promise.all([
      supabase.from('profiles').select('full_name, father_name, grandfather_name, phone, avatar_url').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role, access_level').eq('user_id', userId),
      fetchCompanies(userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r: any) => r.role as AppRole));
      setAccessLevel(rolesRes.data[0]?.access_level || 'full');
    }
    setCompanies(companyList);
    const active = pickActiveCompany(companyList);
    setActiveCompany(active);
    if (active) {
      localStorage.setItem(ACTIVE_COMPANY_KEY, active.id);
      await setSessionTenant(active.id);
    }
  }, [fetchCompanies, pickActiveCompany, setSessionTenant]);

  const refreshCompanies = useCallback(async () => {
    if (!user) return;
    const list = await fetchCompanies(user.id);
    setCompanies(list);
  }, [user, fetchCompanies]);

  const switchCompany = useCallback(async (companyId: string) => {
    const target = companies.find((c) => c.id === companyId);
    if (!target) return;
    await setSessionTenant(companyId);
    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    setActiveCompany(target);
    setCompanies((prev) => prev.map((c) => ({ ...c, is_default: c.id === companyId })));
    // Force a soft reload so all React Query caches re-fetch with new tenant
    window.location.reload();
  }, [companies, setSessionTenant]);

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
        setCompanies([]);
        setActiveCompany(null);
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
  }, [fetchUserData]);

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
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, roles, accessLevel, loading, hasRole, signIn, signOut,
      companies, activeCompany, switchCompany, refreshCompanies,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
