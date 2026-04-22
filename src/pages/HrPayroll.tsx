import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import HrAiAssistant from '@/components/hr/HrAiAssistant';
import { calculatePayroll, formatETB } from '@/lib/payroll';
import { exportPayslipPdf } from '@/lib/payslipPdf';
import {
  Loader2, Plus, Users, Building2, CalendarCheck, FileSpreadsheet, Calculator,
  Download, Banknote, ClipboardList, Search, Sparkles, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'overview' | 'employees' | 'attendance' | 'leave' | 'loans' | 'payroll' | 'branches' | 'assistant';

export default function HrPayroll() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';

  const isHrStaff = hasRole('admin') || hasRole('hr_admin') || hasRole('payroll_officer');
  const isManager = hasRole('manager');
  const isEmployee = hasRole('employee');

  const setTab = (t: Tab) => setParams({ tab: t });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HR & Payroll</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">የሰራተኛና የደመወዝ አስተዳደር</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(t) => setTab(t as Tab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><ClipboardList className="w-3.5 h-3.5 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="employees"><Users className="w-3.5 h-3.5 mr-1.5" /> Employees</TabsTrigger>
          <TabsTrigger value="attendance"><CalendarCheck className="w-3.5 h-3.5 mr-1.5" /> Attendance</TabsTrigger>
          <TabsTrigger value="leave"><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Leave</TabsTrigger>
          {(isHrStaff) && <TabsTrigger value="loans"><Banknote className="w-3.5 h-3.5 mr-1.5" /> Loans</TabsTrigger>}
          {(isHrStaff || isManager || isEmployee) && <TabsTrigger value="payroll"><Calculator className="w-3.5 h-3.5 mr-1.5" /> Payroll</TabsTrigger>}
          {isHrStaff && <TabsTrigger value="branches"><Building2 className="w-3.5 h-3.5 mr-1.5" /> Branches</TabsTrigger>}
          <TabsTrigger value="assistant"><Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="employees"><EmployeesTab canEdit={isHrStaff} /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab canManage={isHrStaff || isManager} /></TabsContent>
        <TabsContent value="leave"><LeaveTab canApprove={isHrStaff || isManager} /></TabsContent>
        {isHrStaff && <TabsContent value="loans"><LoansTab /></TabsContent>}
        <TabsContent value="payroll"><PayrollTab canRun={isHrStaff} /></TabsContent>
        {isHrStaff && <TabsContent value="branches"><BranchesTab /></TabsContent>}
        <TabsContent value="assistant"><HrAiAssistant /></TabsContent>
      </Tabs>
    </div>
  );
}

// ====================== OVERVIEW ======================
function OverviewTab() {
  const [stats, setStats] = useState<any>({ employees: 0, branches: 0, pendingLeave: 0, activeLoans: 0, presentToday: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [emp, br, leave, loans, attn] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('employee_loans').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'present'),
      ]);
      setStats({
        employees: emp.count || 0,
        branches: br.count || 0,
        pendingLeave: leave.count || 0,
        activeLoans: loans.count || 0,
        presentToday: attn.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const cards = [
    { label: 'Active Employees', value: stats.employees, icon: Users, color: 'text-blue-600' },
    { label: 'Branches', value: stats.branches, icon: Building2, color: 'text-purple-600' },
    { label: 'Present Today', value: stats.presentToday, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Pending Leave', value: stats.pendingLeave, icon: Clock, color: 'text-amber-600' },
    { label: 'Active Loans', value: stats.activeLoans, icon: Banknote, color: 'text-rose-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="bg-card">
          <CardContent className="p-4">
            <div className={`flex items-center gap-2 ${c.color}`}><c.icon className="w-4 h-4" /><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span></div>
            <p className="text-2xl font-bold mt-2">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ====================== EMPLOYEES ======================
function EmployeesTab({ canEdit }: { canEdit: boolean }) {
  const [list, setList] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [e, b] = await Promise.all([
      supabase.from('employees').select('*, branches(name)').order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ]);
    setList(e.data || []);
    setBranches(b.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = list.filter(e =>
    !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gradient-primary text-primary-foreground gap-1.5">
            <Plus className="w-4 h-4" /> New Employee
          </Button>
        )}
      </div>

      <Card className="bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" />No employees yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Position</TableHead>
                  <TableHead>Branch</TableHead><TableHead className="text-right">Salary</TableHead>
                  <TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{e.full_name}</div>
                      {e.full_name_am && <div className="text-xs text-muted-foreground font-ethiopic">{e.full_name_am}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{e.position || '-'}</div>
                      <div className="text-xs text-muted-foreground">{e.department || ''}</div>
                    </TableCell>
                    <TableCell className="text-sm">{e.branches?.name || '-'}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(e.base_salary) || 0)}</TableCell>
                    <TableCell><Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="capitalize text-[10px]">{e.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canEdit && <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>Edit</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmployeeFormDialog open={open} onClose={() => setOpen(false)} onSaved={load} employee={editing} branches={branches} />
    </div>
  );
}

// ====================== ATTENDANCE ======================
function AttendanceTab({ canManage }: { canManage: boolean }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const [a, e] = await Promise.all([
      supabase.from('attendance').select('*, employees(full_name, employee_code)').eq('date', date).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name, employee_code, branch_id').eq('status', 'active').order('full_name'),
    ]);
    setRecords(a.data || []);
    setEmployees(e.data || []);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const clockIn = async (employee_id: string, branch_id: string | null) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('attendance').upsert({
      employee_id, branch_id, date, clock_in: now, status: 'present', recorded_by: user?.id,
    } as any, { onConflict: 'employee_id,date' });
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Clocked in' });
    load();
  };

  const clockOut = async (rec: any) => {
    const now = new Date();
    const inTime = rec.clock_in ? new Date(rec.clock_in) : now;
    const hours = Math.max(0, (now.getTime() - inTime.getTime()) / 3600000);
    const { error } = await supabase.from('attendance').update({
      clock_out: now.toISOString(),
      hours_worked: +hours.toFixed(2),
    }).eq('id', rec.id);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Clocked out', description: `${hours.toFixed(2)} hours recorded` });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      {canManage && (
        <Card className="bg-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Clock-In</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {employees.map(e => {
                const rec = records.find(r => r.employee_id === e.id);
                return (
                  <div key={e.id} className="border rounded-lg p-2.5 text-xs">
                    <div className="font-medium truncate">{e.full_name}</div>
                    <div className="text-muted-foreground text-[10px] mb-1.5">{e.employee_code}</div>
                    {!rec ? (
                      <Button size="sm" className="w-full h-7 text-[11px]" onClick={() => clockIn(e.id, e.branch_id)}>Clock In</Button>
                    ) : !rec.clock_out ? (
                      <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => clockOut(rec)}>Clock Out</Button>
                    ) : (
                      <Badge variant="default" className="w-full justify-center text-[10px]">Done • {Number(rec.hours_worked).toFixed(1)}h</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance Records — {date}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No attendance records for this day</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead><TableHead>Clock In</TableHead><TableHead>Clock Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.employees?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employees?.employee_code}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '-'}</TableCell>
                    <TableCell className="text-sm">{r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '-'}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{Number(r.hours_worked || 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ====================== LEAVE ======================
function LeaveTab({ canApprove }: { canApprove: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });
  const [myEmpId, setMyEmpId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, e] = await Promise.all([
      supabase.from('leave_requests').select('*, employees(full_name, employee_code)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name, employee_code, branch_id, user_id').eq('status', 'active').order('full_name'),
    ]);
    setList(l.data || []);
    setEmployees(e.data || []);
    const me = (e.data || []).find((x: any) => x.user_id === user?.id);
    setMyEmpId(me?.id || null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const employee_id = canApprove ? form.employee_id : myEmpId;
    if (!employee_id || !form.start_date || !form.end_date) { toast({ title: 'Employee & dates required', variant: 'destructive' }); return; }
    const days = Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1);
    const emp = employees.find(x => x.id === employee_id);
    const { error } = await supabase.from('leave_requests').insert({
      employee_id, branch_id: emp?.branch_id ?? null, leave_type: form.leave_type,
      start_date: form.start_date, end_date: form.end_date, days_count: days, reason: form.reason,
    } as any);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Leave request submitted' });
    setOpen(false);
    setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    load();
  };

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('leave_requests').update({
      status, approved_by: user?.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: `Leave ${status}` });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground gap-1.5"><Plus className="w-4 h-4" /> Request Leave</Button>
      </div>

      <Card className="bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No leave requests</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead>
                  <TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(r => (
                  <TableRow key={r.id}>
                    <TableCell><div className="text-sm font-medium">{r.employees?.full_name}</div><div className="text-xs text-muted-foreground">{r.employees?.employee_code}</div></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{r.leave_type}</Badge></TableCell>
                    <TableCell className="text-sm">{format(new Date(r.start_date), 'MMM d')}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.end_date), 'MMM d')}</TableCell>
                    <TableCell className="text-sm font-mono">{r.days_count}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{r.reason || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize text-[10px]">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canApprove && r.status === 'pending' && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => decide(r.id, 'approved')}><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => decide(r.id, 'rejected')}><XCircle className="w-3.5 h-3.5" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {canApprove && (
              <div>
                <Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Type</Label>
              <Select value={form.leave_type} onValueChange={v => setForm(p => ({ ...p, leave_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="maternity">Maternity</SelectItem>
                  <SelectItem value="paternity">Paternity</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>From</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>To</Label><Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div><Label>Reason</Label><Textarea rows={3} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} /></div>
            <Button onClick={submit} className="gradient-primary text-primary-foreground">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================== LOANS ======================
function LoansTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: '', loan_amount: '0', monthly_deduction: '0', start_date: new Date().toISOString().slice(0,10), notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [l, e] = await Promise.all([
      supabase.from('employee_loans').select('*, employees(full_name, employee_code)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name, employee_code').eq('status', 'active').order('full_name'),
    ]);
    setList(l.data || []);
    setEmployees(e.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const amount = Number(form.loan_amount), monthly = Number(form.monthly_deduction);
    if (!form.employee_id || amount <= 0) { toast({ title: 'Employee and amount required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('employee_loans').insert({
      employee_id: form.employee_id, loan_amount: amount, monthly_deduction: monthly,
      remaining_balance: amount, start_date: form.start_date, notes: form.notes, approved_by: user?.id,
    } as any);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Loan recorded' });
    setOpen(false);
    setForm({ employee_id: '', loan_amount: '0', monthly_deduction: '0', start_date: new Date().toISOString().slice(0,10), notes: '' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground gap-1.5"><Plus className="w-4 h-4" /> New Loan</Button>
      </div>
      <Card className="bg-card">
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div> :
          list.length === 0 ? <div className="text-center py-12 text-muted-foreground text-sm">No loans</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Monthly</TableHead><TableHead className="text-right">Balance</TableHead>
                <TableHead>Start</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {list.map(l => (
                  <TableRow key={l.id}>
                    <TableCell><div className="text-sm font-medium">{l.employees?.full_name}</div><div className="text-xs text-muted-foreground">{l.employees?.employee_code}</div></TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(l.loan_amount))}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(l.monthly_deduction))}</TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold">{formatETB(Number(l.remaining_balance))}</TableCell>
                    <TableCell className="text-sm">{format(new Date(l.start_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell><Badge variant={l.status === 'active' ? 'default' : 'secondary'} className="capitalize text-[10px]">{l.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Employee Loan</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Employee *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Loan Amount (ETB) *</Label><Input type="number" value={form.loan_amount} onChange={e => setForm(p => ({ ...p, loan_amount: e.target.value }))} /></div>
              <div><Label>Monthly Deduction</Label><Input type="number" value={form.monthly_deduction} onChange={e => setForm(p => ({ ...p, monthly_deduction: e.target.value }))} /></div>
            </div>
            <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button onClick={submit} className="gradient-primary text-primary-foreground">Record Loan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================== PAYROLL ======================
function PayrollTab({ canRun }: { canRun: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openRun, setOpenRun] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const now = new Date();
  const [form, setForm] = useState({
    period_month: now.getMonth() + 1,
    period_year: now.getFullYear(),
    branch_id: '',
    pay_date: now.toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [r, p, b] = await Promise.all([
      supabase.from('payroll_runs').select('*, branches(name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('payslips').select('*, employees(full_name, employee_code, bank_name, bank_account, position, department, hire_date, full_name_am, tin_number, pension_number), branches(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ]);
    setRuns(r.data || []);
    setPayslips(p.data || []);
    setBranches(b.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateRun = async () => {
    setGenerating(true);
    try {
      let empQ = supabase.from('employees').select('*').eq('status', 'active');
      if (form.branch_id) empQ = empQ.eq('branch_id', form.branch_id);
      const { data: emps, error: empErr } = await empQ;
      if (empErr) throw empErr;
      if (!emps || emps.length === 0) { toast({ title: 'No active employees in this scope', variant: 'destructive' }); setGenerating(false); return; }

      const { data: loans } = await supabase.from('employee_loans').select('*').eq('status', 'active');
      const loanByEmp: Record<string, number> = {};
      (loans || []).forEach((l: any) => {
        loanByEmp[l.employee_id] = (loanByEmp[l.employee_id] || 0) + Number(l.monthly_deduction || 0);
      });

      const calculations = emps.map(e => {
        const calc = calculatePayroll({
          base_salary: Number(e.base_salary || 0),
          transport_allowance: Number(e.transport_allowance || 0),
          housing_allowance: Number(e.housing_allowance || 0),
          position_allowance: Number(e.position_allowance || 0),
          other_allowance: Number(e.other_allowance || 0),
          loan_deduction: Math.min(loanByEmp[e.id] || 0, Number(e.base_salary || 0) * 0.5),
        });
        return { emp: e, calc };
      });

      const totals = calculations.reduce((acc, { calc }) => ({
        gross: acc.gross + calc.gross_pay,
        paye: acc.paye + calc.paye_tax,
        emp_pension: acc.emp_pension + calc.employee_pension,
        er_pension: acc.er_pension + calc.employer_pension,
        loans: acc.loans + calc.loan_deduction,
        other: acc.other + calc.other_deductions,
        net: acc.net + calc.net_pay,
      }), { gross: 0, paye: 0, emp_pension: 0, er_pension: 0, loans: 0, other: 0, net: 0 });

      const run_code = `PR-${form.period_year}${String(form.period_month).padStart(2,'0')}-${Date.now().toString().slice(-5)}`;

      const { data: run, error: runErr } = await supabase.from('payroll_runs').insert({
        run_code,
        branch_id: form.branch_id || null,
        period_month: form.period_month,
        period_year: form.period_year,
        pay_date: form.pay_date,
        status: 'draft',
        total_gross: totals.gross,
        total_paye: totals.paye,
        total_employee_pension: totals.emp_pension,
        total_employer_pension: totals.er_pension,
        total_loan_deductions: totals.loans,
        total_other_deductions: totals.other,
        total_net: totals.net,
        employee_count: calculations.length,
        created_by: user?.id,
      } as any).select().single();
      if (runErr) throw runErr;

      const slipRows = calculations.map(({ emp, calc }) => ({
        payroll_run_id: run.id,
        employee_id: emp.id,
        branch_id: emp.branch_id || null,
        period_month: form.period_month,
        period_year: form.period_year,
        base_salary: calc.base_salary,
        transport_allowance: calc.transport_allowance,
        housing_allowance: calc.housing_allowance,
        position_allowance: calc.position_allowance,
        other_allowance: calc.other_allowance,
        overtime_amount: calc.overtime_amount,
        bonus: calc.bonus,
        gross_pay: calc.gross_pay,
        taxable_income: calc.taxable_income,
        paye_tax: calc.paye_tax,
        employee_pension: calc.employee_pension,
        employer_pension: calc.employer_pension,
        loan_deduction: calc.loan_deduction,
        other_deductions: calc.other_deductions,
        total_deductions: calc.total_deductions,
        net_pay: calc.net_pay,
        days_worked: 26,
        status: 'draft',
      }));
      const { error: psErr } = await supabase.from('payslips').insert(slipRows as any);
      if (psErr) throw psErr;

      toast({ title: '✅ Payroll generated', description: `${calculations.length} payslips created` });
      setOpenRun(false);
      load();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const downloadPayslip = (p: any) => {
    const e = p.employees || {};
    exportPayslipPdf({
      company: { name: 'Gebeya POS', name_am: 'የገበያ ሥርዓት', address: 'Addis Ababa, Ethiopia', phone: '+251 ...', tin: '0000000000' },
      employee: {
        employee_code: e.employee_code || '-',
        full_name: e.full_name || '-',
        full_name_am: e.full_name_am,
        position: e.position,
        department: e.department,
        branch_name: p.branches?.name,
        bank_name: e.bank_name,
        bank_account: e.bank_account,
        tin_number: e.tin_number,
        pension_number: e.pension_number,
        hire_date: e.hire_date,
      },
      period: { month: p.period_month, year: p.period_year },
      pay_date: p.created_at,
      payslip_no: `PS-${p.id.slice(0, 8).toUpperCase()}`,
      base_salary: Number(p.base_salary),
      transport_allowance: Number(p.transport_allowance),
      housing_allowance: Number(p.housing_allowance),
      position_allowance: Number(p.position_allowance),
      other_allowance: Number(p.other_allowance),
      overtime_amount: Number(p.overtime_amount),
      bonus: Number(p.bonus),
      gross_pay: Number(p.gross_pay),
      taxable_income: Number(p.taxable_income),
      paye_tax: Number(p.paye_tax),
      employee_pension: Number(p.employee_pension),
      employer_pension: Number(p.employer_pension),
      loan_deduction: Number(p.loan_deduction),
      other_deductions: Number(p.other_deductions),
      total_deductions: Number(p.total_deductions),
      net_pay: Number(p.net_pay),
      days_worked: Number(p.days_worked),
    });
  };

  return (
    <div className="space-y-4">
      {canRun && (
        <div className="flex justify-end">
          <Button onClick={() => setOpenRun(true)} className="gradient-primary text-primary-foreground gap-1.5"><Calculator className="w-4 h-4" /> Generate Payroll Run</Button>
        </div>
      )}

      <Card className="bg-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Payroll Runs</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div> :
          runs.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No payroll runs yet</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Period</TableHead><TableHead>Branch</TableHead>
                <TableHead className="text-right">Employees</TableHead><TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PAYE</TableHead><TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {runs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.run_code}</TableCell>
                    <TableCell className="text-sm">{r.period_month}/{r.period_year}</TableCell>
                    <TableCell className="text-sm">{r.branches?.name || 'All'}</TableCell>
                    <TableCell className="text-right text-sm">{r.employee_count}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(r.total_gross))}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(r.total_paye))}</TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold text-green-700">{formatETB(Number(r.total_net))}</TableCell>
                    <TableCell><Badge variant={r.status === 'approved' ? 'default' : 'secondary'} className="text-[10px] capitalize">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Payslips</CardTitle></CardHeader>
        <CardContent className="p-0">
          {payslips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No payslips</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">Pension</TableHead><TableHead className="text-right">Net Pay</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payslips.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><div className="text-sm font-medium">{p.employees?.full_name}</div><div className="text-xs text-muted-foreground">{p.employees?.employee_code}</div></TableCell>
                    <TableCell className="text-sm">{p.period_month}/{p.period_year}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(p.gross_pay))}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(p.paye_tax))}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatETB(Number(p.employee_pension))}</TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold text-green-700">{formatETB(Number(p.net_pay))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadPayslip(p)}><Download className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openRun} onOpenChange={setOpenRun}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate Payroll Run</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Month</Label><Input type="number" min={1} max={12} value={form.period_month} onChange={e => setForm(p => ({ ...p, period_month: Number(e.target.value) }))} /></div>
              <div><Label>Year</Label><Input type="number" value={form.period_year} onChange={e => setForm(p => ({ ...p, period_year: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>Pay Date</Label><Input type="date" value={form.pay_date} onChange={e => setForm(p => ({ ...p, pay_date: e.target.value }))} /></div>
            <div>
              <Label>Branch (optional)</Label>
              <Select value={form.branch_id || 'all'} onValueChange={v => setForm(p => ({ ...p, branch_id: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Will compute PAYE per Proclamation 1395/2025, employee 7% / employer 11% pension, and apply active loan deductions.</p>
            <Button onClick={generateRun} disabled={generating} className="gradient-primary text-primary-foreground">
              {generating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Generate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================== BRANCHES ======================
function BranchesTab() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', city: '', address: '', phone: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
    setList(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name || !form.code) { toast({ title: 'Name and code required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('branches').insert(form as any);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Branch created' });
    setForm({ name: '', code: '', city: '', address: '', phone: '' });
    setOpen(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground gap-1.5"><Plus className="w-4 h-4" /> New Branch</Button>
      </div>
      <Card className="bg-card">
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {list.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell className="text-sm font-medium">{b.name}</TableCell>
                    <TableCell className="text-sm">{b.city || '-'}</TableCell>
                    <TableCell className="text-sm">{b.phone || '-'}</TableCell>
                    <TableCell><Badge variant={b.is_active ? 'default' : 'secondary'} className="text-[10px]">{b.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Branch</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Code *</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <Button onClick={submit} className="gradient-primary text-primary-foreground">Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
