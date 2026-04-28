// Netlink-style prominent real-time Check In / Check Out panel.
// Big live clock, large action buttons, today's session summary,
// optional geo + selfie, and self-link CTA if user isn't tied to an employee.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, LogIn, LogOut, MapPin, Camera, Clock, UserPlus, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { splitWorkHours, isEthiopianHoliday } from '@/lib/ethiopianHolidays';

type Settings = {
  office_lat: number | null;
  office_lng: number | null;
  allowed_radius_m: number;
  expected_clock_in: string;
  late_grace_minutes: number;
  require_geo: boolean;
  require_selfie: boolean;
};

const DEFAULTS: Settings = {
  office_lat: null, office_lng: null, allowed_radius_m: 200,
  expected_clock_in: '08:30', late_grace_minutes: 10,
  require_geo: false, require_selfie: false,
};

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CheckInOutHero({ onChange }: { onChange?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());
  const [employee, setEmployee] = useState<any>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [today, setToday] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSelfie = useRef<File | null>(null);
  const [pendingAction, setPendingAction] = useState<'in' | null>(null);

  // Self-link state
  const [unlinkedEmployees, setUnlinkedEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [linking, setLinking] = useState(false);

  // Live ticking clock (every second for big display)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const dateStr = new Date().toISOString().slice(0, 10);
    const [emp, st] = await Promise.all([
      supabase.from('employees').select('id, full_name, employee_code, branch_id, photo_url').eq('user_id', user.id).maybeSingle(),
      supabase.from('attendance_settings').select('*').maybeSingle(),
    ]);
    setEmployee(emp.data || null);
    if (st.data) setSettings({ ...DEFAULTS, ...st.data });

    if (emp.data) {
      const { data: att } = await supabase.from('attendance')
        .select('*').eq('employee_id', emp.data.id).eq('date', dateStr)
        .order('clock_in', { ascending: true });
      setToday(att || []);
    } else {
      // Show unlinked employees so user can self-link
      const { data: ue } = await supabase.from('employees')
        .select('id, full_name, employee_code').is('user_id', null).eq('status', 'active').order('full_name');
      setUnlinkedEmployees(ue || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const openSession = today.find((r) => !r.clock_out);
  const sessions = today.length;
  const totalHoursToday = today.reduce((s, r) => s + Number(r.hours_worked || 0), 0);

  const linkSelf = async () => {
    if (!selectedEmpId || !user) return;
    setLinking(true);
    const { error } = await supabase.from('employees').update({ user_id: user.id }).eq('id', selectedEmpId);
    setLinking(false);
    if (error) return toast({ title: 'Could not link', description: error.message, variant: 'destructive' });
    toast({ title: 'Linked to employee record' });
    await load();
  };

  const getGeo = (): Promise<{ lat: number; lng: number; acc: number } | null> =>
    new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });

  const uploadSelfie = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const path = `t/${user.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('attendance-selfies').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) {
      toast({ title: 'Selfie upload failed', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data } = supabase.storage.from('attendance-selfies').getPublicUrl(path);
    return data.publicUrl;
  };

  const doCheckIn = async () => {
    if (!employee) return;
    setBusy(true);
    try {
      let geo: Awaited<ReturnType<typeof getGeo>> = null;
      if (settings.require_geo || settings.office_lat) {
        geo = await getGeo();
        if (settings.require_geo && !geo) {
          toast({ title: 'Location required', description: 'Allow location access to check in', variant: 'destructive' });
          return;
        }
        if (geo && settings.office_lat && settings.office_lng) {
          const d = distanceMeters(geo.lat, geo.lng, settings.office_lat, settings.office_lng);
          if (d > settings.allowed_radius_m) {
            toast({ title: 'Outside allowed area', description: `${Math.round(d)}m from office (limit ${settings.allowed_radius_m}m)`, variant: 'destructive' });
            return;
          }
        }
      }

      let selfieUrl: string | null = null;
      if (settings.require_selfie) {
        if (!pendingSelfie.current) {
          setPendingAction('in');
          fileRef.current?.click();
          return;
        }
        selfieUrl = await uploadSelfie(pendingSelfie.current);
        if (!selfieUrl) return;
      } else if (pendingSelfie.current) {
        selfieUrl = await uploadSelfie(pendingSelfie.current);
      }

      const nowDate = new Date();
      const [eh, em] = settings.expected_clock_in.split(':').map(Number);
      const expected = new Date(nowDate);
      expected.setHours(eh || 8, em || 30, 0, 0);
      expected.setMinutes(expected.getMinutes() + (settings.late_grace_minutes || 0));
      const isLate = nowDate > expected;

      const { error } = await supabase.from('attendance').insert({
        employee_id: employee.id, branch_id: employee.branch_id,
        date: nowDate.toISOString().slice(0, 10), clock_in: nowDate.toISOString(),
        status: 'present', recorded_by: user?.id,
        geo_lat: geo?.lat ?? null, geo_lng: geo?.lng ?? null, geo_accuracy: geo?.acc ?? null,
        selfie_url: selfieUrl ?? '', is_late: isLate,
        session_number: sessions + 1, check_in_method: geo ? 'geo' : 'manual',
      } as any);
      if (error) throw error;
      toast({ title: 'Checked in', description: isLate ? 'Marked as late' : 'On time' });
      pendingSelfie.current = null;
      setPendingAction(null);
      await load(); onChange?.();
    } catch (e: any) {
      toast({ title: 'Check-in failed', description: e.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const doCheckOut = async () => {
    if (!openSession) return;
    setBusy(true);
    try {
      let geo: Awaited<ReturnType<typeof getGeo>> = null;
      if (settings.require_geo) geo = await getGeo();
      const nowDate = new Date();
      const inTime = new Date(openSession.clock_in);
      const inDay = inTime.toISOString().slice(0, 10);
      const nowDay = nowDate.toISOString().slice(0, 10);
      const effectiveOut = inDay !== nowDay ? new Date(inDay + 'T23:59:59') : nowDate;
      const { total, overtime } = splitWorkHours(inTime, effectiveOut);

      const { error } = await supabase.from('attendance').update({
        clock_out: effectiveOut.toISOString(),
        hours_worked: total, overtime_hours: overtime,
        clock_out_lat: geo?.lat ?? null, clock_out_lng: geo?.lng ?? null,
      }).eq('id', openSession.id);
      if (error) throw error;
      const holiday = isEthiopianHoliday(inDay);
      toast({ title: 'Checked out', description: `${total.toFixed(2)}h total · ${overtime.toFixed(2)}h overtime${holiday ? ` · ${holiday.name}` : ''}` });
      await load(); onChange?.();
    } catch (e: any) {
      toast({ title: 'Check-out failed', description: e.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    pendingSelfie.current = f;
    if (pendingAction === 'in') doCheckIn();
  };

  // ====== Renders ======

  if (loading) {
    return (
      <Card className="bg-card">
        <CardContent className="p-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Self-link flow if not linked to employee
  if (!employee) {
    return (
      <Card className="bg-card border-2 border-dashed">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3"><UserPlus className="w-5 h-5 text-primary" /></div>
            <div>
              <h3 className="font-semibold">Link your account to start checking in</h3>
              <p className="text-xs text-muted-foreground">Pick your employee record below to enable real-time check in / check out.</p>
            </div>
          </div>
          {unlinkedEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unlinked employee records found. Ask HR to create one for you and link it to your account.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select your name…" /></SelectTrigger>
                <SelectContent>
                  {unlinkedEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.employee_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={linkSelf} disabled={!selectedEmpId || linking} className="gap-2">
                {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Link & continue
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
      <CardContent className="p-6">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr] items-center">
          {/* Live clock */}
          <div className="text-center lg:text-left">
            <div className="text-5xl sm:text-6xl font-bold font-mono tracking-tight tabular-nums text-foreground">
              {format(now, 'HH:mm:ss')}
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 justify-center lg:justify-start">
              <Clock className="w-3.5 h-3.5" />
              {format(now, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Welcome, </span>
              <span className="font-semibold text-foreground">{employee.full_name}</span>
            </div>
          </div>

          {/* Action area */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5 justify-center lg:justify-end">
              <Badge variant={openSession ? 'default' : 'secondary'}>
                {openSession ? '● Active session' : sessions > 0 ? 'Checked out' : 'Not started'}
              </Badge>
              <Badge variant="outline">Sessions: {sessions}</Badge>
              <Badge variant="outline">Total: {totalHoursToday.toFixed(2)}h</Badge>
              {settings.require_geo && <Badge variant="outline" className="gap-1"><MapPin className="w-3 h-3" /> Geo</Badge>}
              {settings.require_selfie && <Badge variant="outline" className="gap-1"><Camera className="w-3 h-3" /> Selfie</Badge>}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="lg"
                onClick={doCheckIn}
                disabled={busy || !!openSession}
                className="flex-1 h-14 text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {busy && !openSession ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                Check In
              </Button>
              <Button
                size="lg"
                onClick={doCheckOut}
                disabled={busy || !openSession}
                variant="outline"
                className="flex-1 h-14 text-base gap-2 border-2"
              >
                {busy && openSession ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                Check Out
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                title="Attach selfie"
                onClick={() => fileRef.current?.click()}
                className="h-14 w-14"
              >
                <Camera className="w-5 h-5" />
              </Button>
              <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFileChosen} />
            </div>

            {today.length > 0 && (
              <div className="border-t pt-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Today's sessions</div>
                {today.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span>
                      #{r.session_number} · {format(new Date(r.clock_in), 'HH:mm')} →{' '}
                      {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : <span className="text-emerald-600 font-medium">in progress…</span>}
                    </span>
                    <span className="font-mono">
                      {Number(r.hours_worked || 0).toFixed(2)}h
                      {r.overtime_hours ? ` · ${Number(r.overtime_hours).toFixed(2)} OT` : ''}
                      {r.is_late ? ' · late' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
