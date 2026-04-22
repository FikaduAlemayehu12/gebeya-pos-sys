import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Loader2, Users, Shield } from 'lucide-react';

interface UserWithRole {
  user_id: string;
  full_name: string;
  phone: string;
  roles: string[];
  access_level: string;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', father_name: '', grandfather_name: '', phone: '', role: 'cashier', access_level: 'full' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone, created_by_admin');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role, access_level');
    if (profiles && roles) {
      const roleMap: Record<string, { roles: string[]; access_level: string }> = {};
      roles.forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = { roles: [], access_level: r.access_level || 'full' };
        roleMap[r.user_id].roles.push(r.role);
      });
      // Filter: admin only sees users they created (or themselves)
      const filtered = profiles.filter((p: any) => p.created_by_admin === user?.id || p.user_id === user?.id);
      setUsers(filtered.map((p: any) => ({
        ...p,
        roles: roleMap[p.user_id]?.roles || [],
        access_level: roleMap[p.user_id]?.access_level || 'full',
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast({ title: 'Email, password & name required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: form.email, password: form.password, full_name: form.full_name,
        father_name: form.father_name, grandfather_name: form.grandfather_name,
        phone: form.phone, role: form.role, access_level: form.access_level,
      },
    });
    if (error) {
      toast({ title: 'Error creating user', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ User created!', description: `${form.full_name} as ${form.role}` });
      setOpen(false);
      setForm({ email: '', password: '', full_name: '', father_name: '', grandfather_name: '', phone: '', role: 'cashier', access_level: 'full' });
      fetchUsers();
    }
    setCreating(false);
  };

  if (!hasRole('admin')) {
    return <div className="text-center py-12 text-muted-foreground"><Shield className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Admin access required</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">የተጠቃሚ አስተዳደር</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs gradient-primary text-primary-foreground">
              <Plus className="w-3.5 h-3.5" /> Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create New User / አዲስ ተጠቃሚ</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Email *</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@gebeya.com" /></div>
              <div><Label>Password *</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} /></div>
                <div><Label>Father Name</Label><Input value={form.father_name} onChange={e => setForm(p => ({ ...p, father_name: e.target.value }))} /></div>
                <div><Label>G.Father Name</Label><Input value={form.grandfather_name} onChange={e => setForm(p => ({ ...p, grandfather_name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0911..." /></div>
                <div>
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Cashier / ገንዘብ ተቀባይ</SelectItem>
                      <SelectItem value="inventory_manager">Inventory Manager / የእቃ አስተዳዳሪ</SelectItem>
                      <SelectItem value="hr_admin">HR Admin</SelectItem>
                      <SelectItem value="payroll_officer">Payroll Officer</SelectItem>
                      <SelectItem value="manager">Branch Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin / አስተዳዳሪ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Access Level *</Label>
                <Select value={form.access_level} onValueChange={v => setForm(p => ({ ...p, access_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Access / ሙሉ</SelectItem>
                    <SelectItem value="partial">Partial (No Credit/Reports) / ከፊል</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="gradient-primary text-primary-foreground">
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map(u => (
            <Card key={u.user_id} className="bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {(u.full_name || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.full_name || 'No name'}</p>
                    <p className="text-xs text-muted-foreground">{u.phone || 'No phone'}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {u.roles.map(r => (
                    <Badge key={r} variant="outline" className="text-[10px] capitalize">{r.replace('_', ' ')}</Badge>
                  ))}
                  <Badge variant={u.access_level === 'full' ? 'default' : 'secondary'} className="text-[10px]">
                    {u.access_level === 'full' ? '🔓 Full' : '🔒 Partial'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
