import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart3,
  CreditCard, Menu, Bell, Search, LogOut, Shield, Briefcase,
  Wallet, Truck, Building2, FileSearch, Sparkles, CalendarCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import NotificationPanel from '@/components/NotificationPanel';
import ExchangeRateDisplay from '@/components/ExchangeRateDisplay';
import CurrencySwitcher from '@/components/CurrencySwitcher';
import CompanySwitcher from '@/components/CompanySwitcher';
import { supabase } from '@/integrations/supabase/client';

type AppRole =
  | 'admin' | 'cashier' | 'inventory_manager' | 'hr_admin' | 'payroll_officer'
  | 'manager' | 'employee' | 'finance_manager' | 'auditor' | 'branch_manager'
  | 'procurement' | 'user';

const NAV_ITEMS: { path: string; label: string; labelAm: string; icon: any; roles?: AppRole[]; requireFullAccess?: boolean }[] = [
  { path: '/', label: 'Dashboard', labelAm: 'ዳሽቦርድ', icon: LayoutDashboard },
  { path: '/pos', label: 'POS / Sales', labelAm: 'ሽያጭ', icon: ShoppingCart, roles: ['admin', 'cashier'] },
  { path: '/inventory', label: 'Inventory', labelAm: 'እቃዎች', icon: Package, roles: ['admin', 'inventory_manager', 'procurement'] },
  { path: '/customers', label: 'Customers', labelAm: 'ደንበኞች', icon: Users, roles: ['admin', 'cashier'] },
  { path: '/credit', label: 'Credit Sales', labelAm: 'ብድር', icon: CreditCard, roles: ['admin', 'cashier'], requireFullAccess: true },
  { path: '/hr', label: 'HR & Payroll', labelAm: 'ሰራተኛ', icon: Briefcase, roles: ['admin', 'hr_admin', 'payroll_officer', 'manager', 'employee'] },
  { path: '/attendance', label: 'Attendance', labelAm: 'መገኘት', icon: CalendarCheck },
  { path: '/finance', label: 'Finance', labelAm: 'ፋይናንስ', icon: Wallet, roles: ['admin', 'finance_manager', 'auditor'] },
  { path: '/procurement', label: 'Procurement', labelAm: 'ግዢ', icon: Truck, roles: ['admin', 'procurement', 'inventory_manager'] },
  { path: '/branches', label: 'Branches', labelAm: 'ቅርንጫፎች', icon: Building2, roles: ['admin', 'hr_admin', 'manager'] },
  { path: '/reports', label: 'Reports', labelAm: 'ሪፖርቶች', icon: BarChart3, roles: ['admin', 'manager', 'finance_manager'], requireFullAccess: true },
  { path: '/audit', label: 'Audit', labelAm: 'ኦዲት', icon: FileSearch, roles: ['admin', 'auditor'] },
  { path: '/copilot', label: 'ERP Copilot', labelAm: 'ኮፓይለት', icon: Sparkles },
  { path: '/admin', label: 'Admin', labelAm: 'አስተዳዳሪ', icon: Shield, roles: ['admin'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { profile, roles, accessLevel, signOut, user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel('notif-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg gradient-gold flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-accent-foreground">Gebeya POS</h1>
            <p className="text-[11px] text-sidebar-muted font-ethiopic">የገበያ ሥርዓት</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter((item) => {
            if (item.roles && !item.roles.some((r) => roles.includes(r))) return false;
            if (item.requireFullAccess && accessLevel === 'partial') return false;
            return true;
          }).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] font-ethiopic text-sidebar-muted">{item.labelAm}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {(profile?.full_name || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-sidebar-muted capitalize">{roles[0]?.replace('_', ' ') || 'User'}</p>
            </div>
            <button onClick={signOut} className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-muted" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-md hover:bg-muted text-foreground">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products, customers..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-destructive rounded-full text-[9px] font-bold text-destructive-foreground px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            <CompanySwitcher />
            <div className="hidden sm:block">
              <CurrencySwitcher />
            </div>
            <div className="hidden md:block">
              <ExchangeRateDisplay />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pattern-ethiopian">
          {children}
        </main>
      </div>
    </div>
  );
}
