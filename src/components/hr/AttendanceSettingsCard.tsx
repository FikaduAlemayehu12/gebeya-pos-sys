// HR-only settings panel for attendance rules (geo, selfie, expected time)
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Save } from 'lucide-react';

export default function AttendanceSettingsCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    office_lat: '',
    office_lng: '',
    allowed_radius_m: '200',
    expected_clock_in: '08:30',
    late_grace_minutes: '10',
    require_geo: false,
    require_selfie: false,
  });
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('attendance_settings').select('*').maybeSingle();
      if (data) {
        setExistingId(data.id);
        setForm({
          office_lat: data.office_lat?.toString() ?? '',
          office_lng: data.office_lng?.toString() ?? '',
          allowed_radius_m: String(data.allowed_radius_m ?? 200),
          expected_clock_in: data.expected_clock_in?.slice(0, 5) ?? '08:30',
          late_grace_minutes: String(data.late_grace_minutes ?? 10),
          require_geo: !!data.require_geo,
          require_selfie: !!data.require_selfie,
        });
      }
      setLoading(false);
    })();
  }, []);

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast({ title: 'Geolocation not supported', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setForm((f) => ({
          ...f,
          office_lat: p.coords.latitude.toFixed(6),
          office_lng: p.coords.longitude.toFixed(6),
        })),
      (err) => toast({ title: 'Could not get location', description: err.message, variant: 'destructive' }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      office_lat: form.office_lat ? Number(form.office_lat) : null,
      office_lng: form.office_lng ? Number(form.office_lng) : null,
      allowed_radius_m: Number(form.allowed_radius_m) || 200,
      expected_clock_in: form.expected_clock_in,
      late_grace_minutes: Number(form.late_grace_minutes) || 0,
      require_geo: form.require_geo,
      require_selfie: form.require_selfie,
    };
    const { error } = existingId
      ? await supabase.from('attendance_settings').update(payload).eq('id', existingId)
      : await supabase.from('attendance_settings').insert(payload as any);
    setSaving(false);
    if (error) toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Settings saved' });
  };

  if (loading) return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></CardContent></Card>;

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance Rules</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Expected Clock-In</Label>
            <Input type="time" value={form.expected_clock_in} onChange={(e) => setForm({ ...form, expected_clock_in: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Late Grace (minutes)</Label>
            <Input type="number" min="0" value={form.late_grace_minutes} onChange={(e) => setForm({ ...form, late_grace_minutes: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Office Latitude</Label>
            <Input value={form.office_lat} onChange={(e) => setForm({ ...form, office_lat: e.target.value })} placeholder="e.g. 9.0345" />
          </div>
          <div>
            <Label className="text-xs">Office Longitude</Label>
            <Input value={form.office_lng} onChange={(e) => setForm({ ...form, office_lng: e.target.value })} placeholder="e.g. 38.7521" />
          </div>
          <div>
            <Label className="text-xs">Allowed Radius (m)</Label>
            <Input type="number" min="10" value={form.allowed_radius_m} onChange={(e) => setForm({ ...form, allowed_radius_m: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} className="gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Use my current location
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2 border-t">
          <label className="flex items-center justify-between text-sm">
            <span>Require geolocation on check-in</span>
            <Switch checked={form.require_geo} onCheckedChange={(v) => setForm({ ...form, require_geo: v })} />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Require selfie on check-in</span>
            <Switch checked={form.require_selfie} onCheckedChange={(v) => setForm({ ...form, require_selfie: v })} />
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
