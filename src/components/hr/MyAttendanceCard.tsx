// Geo + selfie clock-in/out card for the current employee
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, LogOut, MapPin, Camera, Clock } from 'lucide-react';
import { format } from 'date-fns';

type Settings = {
  office_lat: number | null;
  office_lng: number | null;
  allowed_radius_m: number;
  expected_clock_in: string;
  late_grace_minutes: number;
  require_geo: boolean;
  require_selfie: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  office_lat: null,
  office_lng: null,
  allowed_radius_m: 200,
  expected_clock_in: '08:30',
  late_grace_minutes: 10,
  require_geo: false,
  require_selfie: false,
};

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MyAttendanceCard({ onChange }: { onChange?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<any>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [today, setToday] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSelfieRef = useRef<File | null>(null);
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [emp, st, att] = await Promise.all([
      supabase.from('employees').select('id, full_name, branch_id, photo_url').eq('user_id', user.id).maybeSingle(),
      supabase.from('attendance_settings').select('*').maybeSingle(),
      supabase
        .from('attendance')
        .select('*')
        .eq('date', today)
        .order('clock_in', { ascending: true }),
    ]);
    setEmployee(emp.data || null);
    if (st.data) setSettings({ ...DEFAULT_SETTINGS, ...st.data });
    setToday((att.data || []).filter((r) => r.employee_id === emp.data?.id));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openSession = today.find((r) => !r.clock_out);
  const sessionsCount = today.length;

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
    const tenantId = ''; // bucket policy keys on user_id only — use tenant placeholder folder
    const path = `${tenantId || 't'}/${user.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('attendance-selfies').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      toast({ title: 'Selfie upload failed', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data } = supabase.storage.from('attendance-selfies').getPublicUrl(path);
    return data.publicUrl;
  };

  const performClockIn = async () => {
    if (!employee) {
      toast({ title: 'No employee profile linked to your account', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      let geo = null as Awaited<ReturnType<typeof getGeo>>;
      if (settings.require_geo || settings.office_lat) {
        geo = await getGeo();
        if (settings.require_geo && !geo) {
          toast({ title: 'Location required', description: 'Allow location access to check in', variant: 'destructive' });
          return;
        }
        if (geo && settings.office_lat && settings.office_lng) {
          const d = distanceMeters(geo.lat, geo.lng, settings.office_lat, settings.office_lng);
          if (d > settings.allowed_radius_m) {
            toast({
              title: 'Outside allowed area',
              description: `${Math.round(d)}m from office (limit ${settings.allowed_radius_m}m)`,
              variant: 'destructive',
            });
            return;
          }
        }
      }

      let selfieUrl: string | null = null;
      if (settings.require_selfie) {
        if (!pendingSelfieRef.current) {
          setPendingAction('in');
          fileRef.current?.click();
          return;
        }
        selfieUrl = await uploadSelfie(pendingSelfieRef.current);
        if (!selfieUrl) return;
      } else if (pendingSelfieRef.current) {
        selfieUrl = await uploadSelfie(pendingSelfieRef.current);
      }

      const nowDate = new Date();
      const [eh, em] = settings.expected_clock_in.split(':').map(Number);
      const expected = new Date(nowDate);
      expected.setHours(eh || 8, em || 30, 0, 0);
      expected.setMinutes(expected.getMinutes() + (settings.late_grace_minutes || 0));
      const isLate = nowDate > expected;

      const { error } = await supabase.from('attendance').insert({
        employee_id: employee.id,
        branch_id: employee.branch_id,
        date: nowDate.toISOString().slice(0, 10),
        clock_in: nowDate.toISOString(),
        status: 'present',
        recorded_by: user?.id,
        geo_lat: geo?.lat ?? null,
        geo_lng: geo?.lng ?? null,
        geo_accuracy: geo?.acc ?? null,
        selfie_url: selfieUrl ?? '',
        is_late: isLate,
        session_number: sessionsCount + 1,
        check_in_method: geo ? 'geo' : 'manual',
      } as any);
      if (error) throw error;
      toast({ title: 'Clocked in', description: isLate ? 'Marked as late' : 'On time' });
      pendingSelfieRef.current = null;
      setPendingAction(null);
      await load();
      onChange?.();
    } catch (e: any) {
      toast({ title: 'Clock-in failed', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const performClockOut = async () => {
    if (!openSession) return;
    setBusy(true);
    try {
      let geo = null as Awaited<ReturnType<typeof getGeo>>;
      if (settings.require_geo) geo = await getGeo();

      const nowDate = new Date();
      const inTime = new Date(openSession.clock_in);
      const hours = Math.max(0, (nowDate.getTime() - inTime.getTime()) / 3600000);

      const { error } = await supabase
        .from('attendance')
        .update({
          clock_out: nowDate.toISOString(),
          hours_worked: +hours.toFixed(2),
          clock_out_lat: geo?.lat ?? null,
          clock_out_lng: geo?.lng ?? null,
        })
        .eq('id', openSession.id);
      if (error) throw error;
      toast({ title: 'Clocked out', description: `${hours.toFixed(2)}h recorded` });
      await load();
      onChange?.();
    } catch (e: any) {
      toast({ title: 'Clock-out failed', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    pendingSelfieRef.current = f;
    if (pendingAction === 'in') performClockIn();
  };

  const totalHoursToday = today.reduce((s, r) => s + Number(r.hours_worked || 0), 0);

  if (loading) {
    return (
      <Card><CardContent className="p-6 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></CardContent></Card>
    );
  }

  if (!employee) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Your user account is not linked to an employee record. Ask HR to link you so you can clock in.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> My Attendance</span>
          <span className="text-xs font-mono text-muted-foreground">{format(now, 'HH:mm')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <div className="font-medium">{employee.full_name}</div>
          <div className="text-xs text-muted-foreground">{format(now, 'EEEE, MMMM d, yyyy')}</div>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center text-xs">
          <Badge variant={openSession ? 'default' : 'secondary'} className="text-[10px]">
            {openSession ? 'Active session' : sessionsCount > 0 ? 'Clocked out' : 'Not started'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">Sessions today: {sessionsCount}</Badge>
          <Badge variant="outline" className="text-[10px]">Total: {totalHoursToday.toFixed(2)}h</Badge>
          {settings.require_geo && (
            <Badge variant="outline" className="text-[10px] gap-1"><MapPin className="w-3 h-3" /> Geo required</Badge>
          )}
          {settings.require_selfie && (
            <Badge variant="outline" className="text-[10px] gap-1"><Camera className="w-3 h-3" /> Selfie required</Badge>
          )}
        </div>

        <div className="flex gap-2">
          {!openSession ? (
            <Button onClick={performClockIn} disabled={busy} className="flex-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Clock In
            </Button>
          ) : (
            <Button onClick={performClockOut} disabled={busy} variant="outline" className="flex-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Clock Out
            </Button>
          )}
          {!settings.require_selfie && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Attach optional selfie"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={onFileChosen}
          />
        </div>

        {today.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Today's sessions</div>
            {today.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span>
                  #{r.session_number} · {format(new Date(r.clock_in), 'HH:mm')} →{' '}
                  {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '…'}
                </span>
                <span className="font-mono">{Number(r.hours_worked || 0).toFixed(2)}h{r.is_late ? ' · late' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
