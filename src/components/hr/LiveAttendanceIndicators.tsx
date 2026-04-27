import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, UserCheck, UserX, PlaneTakeoff } from 'lucide-react';
import { format } from 'date-fns';

type Status = 'present' | 'absent' | 'on_leave';
type StaffStatus = {
  employeeId: string;
  fullName: string;
  position: string | null;
  photoUrl: string | null;
  status: Status;
  clockInTime?: string;
  leaveType?: string;
  isLate?: boolean;
};

export default function LiveAttendanceIndicators() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [todayAtt, setTodayAtt] = useState<any[]>([]);
  const [todayLeave, setTodayLeave] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [emp, att, lv] = await Promise.all([
        supabase.from('employees').select('id, full_name, position, photo_url').eq('status', 'active'),
        supabase.from('attendance').select('employee_id, clock_in, clock_out, is_late').eq('date', today),
        supabase
          .from('leave_requests')
          .select('employee_id, leave_type, status, start_date, end_date')
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today),
      ]);
      if (!active) return;
      setEmployees(emp.data || []);
      setTodayAtt(att.data || []);
      setTodayLeave(lv.data || []);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const statuses = useMemo<StaffStatus[]>(() => {
    const attMap = new Map<string, any>();
    for (const a of todayAtt) {
      const cur = attMap.get(a.employee_id);
      if (!cur || (!a.clock_out && cur.clock_out)) attMap.set(a.employee_id, a);
    }
    const leaveMap = new Map<string, string>();
    for (const l of todayLeave) leaveMap.set(l.employee_id, l.leave_type);

    return employees.map((e) => {
      const att = attMap.get(e.id);
      const leave = leaveMap.get(e.id);
      let status: Status = 'absent';
      if (att) status = 'present';
      else if (leave) status = 'on_leave';
      return {
        employeeId: e.id,
        fullName: e.full_name,
        position: e.position,
        photoUrl: e.photo_url,
        status,
        clockInTime: att?.clock_in,
        leaveType: leave,
        isLate: att?.is_late,
      };
    });
  }, [employees, todayAtt, todayLeave]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, onLeave: 0, late: 0 };
    for (const s of statuses) {
      if (s.status === 'present') c.present++;
      else if (s.status === 'on_leave') c.onLeave++;
      else c.absent++;
      if (s.isLate) c.late++;
    }
    return c;
  }, [statuses]);

  const initials = (n: string) =>
    n.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox icon={Users} label="Total" value={employees.length} tone="default" />
        <StatBox icon={UserCheck} label="Present" value={counts.present} tone="success" />
        <StatBox icon={PlaneTakeoff} label="On Leave" value={counts.onLeave} tone="info" />
        <StatBox icon={UserX} label="Absent" value={counts.absent} tone={counts.absent > 0 ? 'danger' : 'default'} />
      </div>

      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Live Roster — {format(new Date(), 'EEE, MMM d')}</span>
            {counts.late > 0 && (
              <Badge variant="destructive" className="text-[10px]">{counts.late} late</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : statuses.length === 0 ? (
            <div className="text-xs text-muted-foreground">No active employees</div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap gap-2">
                {statuses.map((s) => (
                  <Tooltip key={s.employeeId}>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Avatar className="h-10 w-10 ring-2 ring-background">
                          <AvatarImage src={s.photoUrl || undefined} />
                          <AvatarFallback className="text-[11px]">{initials(s.fullName)}</AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                            s.status === 'present'
                              ? s.isLate
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                              : s.status === 'on_leave'
                                ? 'bg-blue-500'
                                : 'bg-muted-foreground'
                          }`}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <div className="font-medium">{s.fullName}</div>
                        {s.position && <div className="text-muted-foreground">{s.position}</div>}
                        <div className="mt-1 capitalize">
                          {s.status === 'present'
                            ? `In since ${s.clockInTime ? format(new Date(s.clockInTime), 'HH:mm') : '?'}${s.isLate ? ' (late)' : ''}`
                            : s.status === 'on_leave'
                              ? `On leave (${s.leaveType})`
                              : 'Not clocked in'}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: 'default' | 'success' | 'info' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-green-600'
      : tone === 'info'
        ? 'text-blue-600'
        : tone === 'danger'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <Card className="bg-card">
      <CardContent className="p-3 flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${toneClass}`} />
        <div>
          <div className={`text-lg font-semibold leading-none ${toneClass}`}>{value}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
