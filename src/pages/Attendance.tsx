// Standalone Attendance module — self check-in/out, live indicators, records, history, and leave.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CheckInOutHero from '@/components/hr/CheckInOutHero';
import LiveAttendanceIndicators from '@/components/hr/LiveAttendanceIndicators';
import AttendanceSettingsCard from '@/components/hr/AttendanceSettingsCard';
import {
  CalendarCheck, Clock, Users, CheckCircle2, XCircle, Loader2, Plus, Settings,
  CalendarDays, History, FileSpreadsheet, ExternalLink, Search, AlarmClock,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

type Tab = 'today' | 'records' | 'history' | 'leave' | 'settings';

export default function Attendance() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'today';
  const setTab = (t: Tab) => setParams({ tab: t });

  const isHrStaff = hasRole('admin') || hasRole('hr_admin') || hasRole('payroll_officer');
  const isManager = hasRole('manager');
  const canManage = isHrStaff || isManager;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" /> Attendance
          </h1>
          <p className="text-sm text-muted-foreground font-ethiopic">የመገኘት ማስተዳደሪያ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/hr?tab=payroll">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Open HR & Payroll
            </Button>
          </Link>
        </div>
      </div>

      <SummaryStrip />

      <Tabs value={tab} onValueChange={(t) => setTab(t as Tab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="today"><Clock className="w-3.5 h-3.5 mr-1.5" /> Today</TabsTrigger>
          <TabsTrigger value="records"><CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Daily Records</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1.5" /> My History</TabsTrigger>
          <TabsTrigger value="leave"><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Leave</TabsTrigger>
          {canManage && <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" /> Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="today"><TodayTab canManage={canManage} /></TabsContent>
        <TabsContent value="records"><RecordsTab canManage={canManage} /></TabsContent>
        <TabsContent value="history"><MyHistoryTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab canApprove={canManage} /></TabsContent>
        {canManage && <TabsContent value="settings"><AttendanceSettingsCard /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ====================== SUMMARY STRIP ======================
function SummaryStrip() {
  const [stats, setStats] = useState({ employees: 0, present: 0, late: 0, onLeave: 0, openSessions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [emp, attn, leave] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('id, employee_id, is_late, clock_out').eq('date', today),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true })
          .eq('status', 'approved').lte('start_date', today).gte('end_date', today),
      ]);
      const recs = attn.data || [];
      const presentSet = new Set(recs.map((r: any) => r.employee_id));
      setStats({
        employees: emp.count || 0,
        present: presentSet.size,
        late: recs.filter((r: any) => r.is_late).length,
        openSessions: recs.filter((r: any) => !r.clock_out).length,
        onLeave: leave.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: 'Active Staff', value: stats.employees, icon: Users, tone: 'text-blue-600' },
    { label: 'Present Today', value: stats.present, icon: CheckCircle2, tone: 'text-green-600' },
    { label: 'Currently Clocked In', value: stats.openSessions, icon: AlarmClock, tone: 'text-emerald-600' },
    { label: 'Late Arrivals', value: stats.late, icon: Clock, tone: 'text-amber-600' },
    { label: 'On Leave', value: stats.onLeave, icon: XCircle, tone: 'text-rose-600' },
  ];

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="bg-card">
          <CardContent className="p-4">
            <div className={`flex items-center gap-2 ${c.tone}`}>
              <c.icon className="w-4 h-4" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold mt-2">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ====================== TODAY ======================
function TodayTab({ canManage }: { canManage: boolean }) {
  const [reload, setReload] = useState(0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <MyAttendanceCard onChange={() => setReload((n) => n + 1)} />
        <LiveAttendanceIndicators key={reload} />
      </div>
      {canManage && <ManagerQuickActions onChange={() => setReload((n) => n + 1)} />}
    </div>
  );
}

function ManagerQuickActions({ onChange }: { onChange: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const [e, a] = await Promise.all([
      supabase.from('employees').select('id, full_name, employee_code, branch_id').eq('status', 'active').order('full_name'),
      supabase.from('attendance').select('id, employee_id, clock_in, clock_out').eq('date', today),
    ]);
    setEmployees(e.data || []);
    setRecords(a.data || []);
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const clockIn = async (employee_id: string, branch_id: string | null) => {
    const sessions = records.filter((r) => r.employee_id === employee_id).length;
    const { error } = await supabase.from('attendance').insert({
      employee_id, branch_id, date: today, clock_in: new Date().toISOString(),
      status: 'present', recorded_by: user?.id, session_number: sessions + 1, check_in_method: 'manual',
    } as any);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    toast({ title: 'Clocked in' });
    await load(); onChange();
  };

  const clockOut = async (rec: any) => {
    const now = new Date();
    const inT = rec.clock_in ? new Date(rec.clock_in) : now;
    const hours = Math.max(0, (now.getTime() - inT.getTime()) / 3600000);
    const { error } = await supabase.from('attendance').update({
      clock_out: now.toISOString(), hours_worked: +hours.toFixed(2),
    }).eq('id', rec.id);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    toast({ title: 'Clocked out', description: `${hours.toFixed(2)}h recorded` });
    await load(); onChange();
  };

  const filtered = employees.filter((e) =>
    !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Manager Quick Clock-In/Out</CardTitle>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className="h-8 pl-8 text-xs" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map((e) => {
              const open = records.find((r) => r.employee_id === e.id && !r.clock_out);
              const sessions = records.filter((r) => r.employee_id === e.id);
              return (
                <div key={e.id} className="border rounded-lg p-2.5 text-xs">
                  <div className="font-medium truncate">{e.full_name}</div>
                  <div className="text-muted-foreground text-[10px] mb-1.5">{e.employee_code} · {sessions.length} session{sessions.length === 1 ? '' : 's'}</div>
                  {open ? (
                    <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => clockOut(open)}>Clock Out</Button>
                  ) : (
                    <Button size="sm" className="w-full h-7 text-[11px]" onClick={() => clockIn(e.id, e.branch_id)}>Clock In</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ====================== RECORDS ======================
function RecordsTab({ canManage }: { canManage: boolean }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'present' | 'late' | 'open'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('*, employees(full_name, employee_code)')
      .eq('date', date)
      .order('clock_in', { ascending: true });
    setRecords(data || []);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return records;
    if (filter === 'late') return records.filter((r) => r.is_late);
    if (filter === 'open') return records.filter((r) => !r.clock_out);
    return records.filter((r) => r.status === filter);
  }, [records, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-end justify-between">
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label className="text-xs">Filter</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All records</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late only</SelectItem>
                <SelectItem value="open">Currently in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {canManage && (
          <Link to="/hr?tab=attendance">
            <Button size="sm" variant="outline" className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Manager view</Button>
          </Link>
        )}
      </div>

      <Card className="bg-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance — {format(new Date(date), 'PPP')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No records match this filter</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.employees?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employees?.employee_code}</div>
                    </TableCell>
                    <TableCell className="text-xs">#{r.session_number || 1}</TableCell>
                    <TableCell className="text-sm">{r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '-'}</TableCell>
                    <TableCell className="text-sm">{r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : <span className="text-emerald-600">In…</span>}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{Number(r.hours_worked || 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{r.check_in_method || 'manual'}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
                      {r.is_late && <Badge variant="destructive" className="text-[10px]">late</Badge>}
                    </TableCell>
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

// ====================== MY HISTORY ======================
function MyHistoryTab() {
  const { user } = useAuth();
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState<any[]>([]);
  const [empId, setEmpId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
      if (!emp) { setLoading(false); return; }
      setEmpId(emp.id);
      const fromDate = subDays(new Date(), days).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('date', fromDate)
        .order('date', { ascending: false })
        .order('clock_in', { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, [user, days]);

  const totalHours = rows.reduce((s, r) => s + Number(r.hours_worked || 0), 0);
  const lateCount = rows.filter((r) => r.is_late).length;
  const dayCount = new Set(rows.map((r) => r.date)).size;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!empId) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        Your account isn't linked to an employee record. Ask HR to link you to view your attendance history.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <Label className="text-xs">Period</Label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3 text-xs">
          <Card className="bg-card"><CardContent className="p-3"><div className="text-muted-foreground">Days present</div><div className="text-lg font-bold">{dayCount}</div></CardContent></Card>
          <Card className="bg-card"><CardContent className="p-3"><div className="text-muted-foreground">Total hours</div><div className="text-lg font-bold">{totalHours.toFixed(2)}</div></CardContent></Card>
          <Card className="bg-card"><CardContent className="p-3"><div className="text-muted-foreground">Late</div><div className="text-lg font-bold">{lateCount}</div></CardContent></Card>
        </div>
      </div>

      <Card className="bg-card">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No attendance in this period</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{format(new Date(r.date), 'EEE MMM d')}</TableCell>
                    <TableCell className="text-xs">#{r.session_number || 1}</TableCell>
                    <TableCell className="text-sm">{r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '-'}</TableCell>
                    <TableCell className="text-sm">{r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Number(r.hours_worked || 0).toFixed(2)}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
                      {r.is_late && <Badge variant="destructive" className="text-[10px]">late</Badge>}
                    </TableCell>
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
  const [myEmpId, setMyEmpId] = useState<string | null>(null);
  const [form, setForm] = useState({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });

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
    const employee_id = canApprove && form.employee_id ? form.employee_id : myEmpId;
    if (!employee_id || !form.start_date || !form.end_date) {
      toast({ title: 'Employee & dates required', variant: 'destructive' }); return;
    }
    const days = Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1);
    const emp = employees.find((x) => x.id === employee_id);
    const { error } = await supabase.from('leave_requests').insert({
      employee_id, branch_id: emp?.branch_id ?? null, leave_type: form.leave_type,
      start_date: form.start_date, end_date: form.end_date, days_count: days, reason: form.reason,
    } as any);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    toast({ title: 'Leave request submitted' });
    setOpen(false);
    setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    load();
  };

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('leave_requests').update({
      status, approved_by: user?.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    toast({ title: `Leave ${status}` });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground gap-1.5">
          <Plus className="w-4 h-4" /> Request Leave
        </Button>
      </div>

      <Card className="bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : list.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No leave requests yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead><TableHead>Type</TableHead>
                  <TableHead>From</TableHead><TableHead>To</TableHead>
                  <TableHead>Days</TableHead><TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{r.employees?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employees?.employee_code}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{r.leave_type}</Badge></TableCell>
                    <TableCell className="text-sm">{format(new Date(r.start_date), 'MMM d')}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.end_date), 'MMM d')}</TableCell>
                    <TableCell className="text-sm font-mono">{r.days_count}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate">{r.reason || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize text-[10px]">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canApprove && r.status === 'pending' && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => decide(r.id, 'approved')}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => decide(r.id, 'rejected')}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
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
                <Label>Employee (leave blank to request for yourself)</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm((p) => ({ ...p, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Myself" /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm((p) => ({ ...p, leave_type: v }))}>
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
              <div><Label>From</Label><Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>To</Label><Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea rows={3} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
            <Button onClick={submit} className="gradient-primary text-primary-foreground">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
