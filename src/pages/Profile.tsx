import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserCircle, X } from 'lucide-react';

type P = {
  user_id: string; full_name: string | null; avatar_url: string | null; phone: string | null;
  address: string | null; bio: string | null; emergency_contact: any; skills: string[]; socials: any;
};

export default function Profile() {
  const { user } = useAuth();
  const [p, setP] = useState<Partial<P>>({});
  const [skill, setSkill] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      setP({ ...(data || {}), emergency_contact: data?.emergency_contact || {}, socials: data?.socials || {}, skills: data?.skills || [] });
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload = {
      full_name: p.full_name, avatar_url: p.avatar_url, phone: p.phone, address: p.address, bio: p.bio,
      emergency_contact: p.emergency_contact || {}, skills: p.skills || [], socials: p.socials || {},
    };
    const { error } = await supabase.from('profiles').update(payload).eq('user_id', user.id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success('Profile saved');
  }

  async function uploadAvatar(f: File) {
    const path = `${user!.id}/avatar-${Date.now()}-${f.name}`;
    const { error } = await supabase.storage.from('employee-docs').upload(path, f, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = await supabase.storage.from('employee-docs').createSignedUrl(path, 60 * 60 * 24 * 365);
    setP({ ...p, avatar_url: data?.signedUrl || null });
    toast.success('Avatar uploaded');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><UserCircle className="w-6 h-6" /> My Profile</h1>

      <Card>
        <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center text-2xl font-bold">
              {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.full_name || '?')[0]}
            </div>
            <label className="cursor-pointer">
              <Button variant="outline" asChild><span>Upload photo</span></Button>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </label>
          </div>
          <Input placeholder="Full name" value={p.full_name || ''} onChange={(e) => setP({ ...p, full_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Phone" value={p.phone || ''} onChange={(e) => setP({ ...p, phone: e.target.value })} />
            <Input placeholder="Address" value={p.address || ''} onChange={(e) => setP({ ...p, address: e.target.value })} />
          </div>
          <Textarea placeholder="Short bio" value={p.bio || ''} onChange={(e) => setP({ ...p, bio: e.target.value })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Add skill (e.g., React, Payroll)" value={skill} onChange={(e) => setSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && skill.trim()) { setP({ ...p, skills: [...(p.skills || []), skill.trim()] }); setSkill(''); } }} />
            <Button onClick={() => { if (skill.trim()) { setP({ ...p, skills: [...(p.skills || []), skill.trim()] }); setSkill(''); } }}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(p.skills || []).map((s, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {s}<button onClick={() => setP({ ...p, skills: (p.skills || []).filter((_, idx) => idx !== i) })}><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Input placeholder="Name" value={p.emergency_contact?.name || ''} onChange={(e) => setP({ ...p, emergency_contact: { ...p.emergency_contact, name: e.target.value } })} />
          <Input placeholder="Relationship" value={p.emergency_contact?.relationship || ''} onChange={(e) => setP({ ...p, emergency_contact: { ...p.emergency_contact, relationship: e.target.value } })} />
          <Input placeholder="Phone" value={p.emergency_contact?.phone || ''} onChange={(e) => setP({ ...p, emergency_contact: { ...p.emergency_contact, phone: e.target.value } })} />
          <Input placeholder="Email" value={p.emergency_contact?.email || ''} onChange={(e) => setP({ ...p, emergency_contact: { ...p.emergency_contact, email: e.target.value } })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Social Links</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {['linkedin', 'twitter', 'github', 'website'].map((k) => (
            <Input key={k} placeholder={k} value={p.socials?.[k] || ''} onChange={(e) => setP({ ...p, socials: { ...p.socials, [k]: e.target.value } })} />
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button></div>
    </div>
  );
}
