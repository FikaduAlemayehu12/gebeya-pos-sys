import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Edit, Upload, Camera, MessageCircle, Download, Mail } from 'lucide-react';

interface CustomerData {
  id?: string;
  name: string;
  name_am: string;
  phone: string;
  alt_phone: string;
  email: string;
  city: string;
  sub_city: string;
  woreda: string;
  kebele: string;
  trust: number;
  guarantor_name: string;
  guarantor_phone: string;
  gov_id: string;
  notes: string;
  photo_url?: string;
  id_document_url?: string;
  id_document_back_url?: string;
}

const EMPTY: CustomerData = {
  name: '', name_am: '', phone: '', alt_phone: '', email: '', city: 'Addis Ababa',
  sub_city: '', woreda: '', kebele: '', trust: 3, guarantor_name: '',
  guarantor_phone: '', gov_id: '', notes: '', photo_url: '', id_document_url: '', id_document_back_url: '',
};

function FileUploadField({ label, url, uploading, onUpload, icon, accept = "image/*,.pdf" }: {
  label: string;
  url?: string;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  accept?: string;
}) {
  return (
    <div className="text-center">
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 relative w-20 h-20 mx-auto rounded-lg bg-muted overflow-hidden border-2 border-border flex items-center justify-center">
        {url ? (
          <img src={url} className="w-full h-full object-cover" alt={label} />
        ) : (
          icon
        )}
      </div>
      <div className="flex items-center justify-center gap-2 mt-2">
        <label className="inline-flex items-center gap-1 text-[10px] text-primary cursor-pointer hover:underline">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? '...' : 'Upload'}
          <input type="file" accept={accept} onChange={onUpload} className="hidden" />
        </label>
        {url && (
          <button onClick={() => window.open(url, '_blank')} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary">
            <Download className="w-3 h-3" /> Save
          </button>
        )}
      </div>
    </div>
  );
}

export default function CustomerFormDialog({
  customer,
  onSuccess,
}: {
  customer?: CustomerData & { id: string };
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CustomerData>(customer || EMPTY);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDocFront, setUploadingDocFront] = useState(false);
  const [uploadingDocBack, setUploadingDocBack] = useState(false);
  const isEdit = !!customer;

  const set = (k: keyof CustomerData, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${prefix}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('customer-docs').upload(path, file);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = supabase.storage.from('customer-docs').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const url = await uploadFile(file, 'photos');
    if (url) set('photo_url', url);
    setUploadingPhoto(false);
  };

  const handleDocFrontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDocFront(true);
    const url = await uploadFile(file, 'id-docs');
    if (url) set('id_document_url', url);
    setUploadingDocFront(false);
  };

  const handleDocBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDocBack(true);
    const url = await uploadFile(file, 'id-docs');
    if (url) set('id_document_back_url', url);
    setUploadingDocBack(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      toast({ title: 'Name and phone are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: Record<string, any> = {
      name: form.name, name_am: form.name_am, phone: form.phone,
      alt_phone: form.alt_phone, email: form.email || '', city: form.city, sub_city: form.sub_city,
      woreda: form.woreda, kebele: form.kebele, trust: form.trust,
      guarantor_name: form.guarantor_name, guarantor_phone: form.guarantor_phone,
      gov_id: form.gov_id, notes: form.notes,
      photo_url: form.photo_url || '', id_document_url: form.id_document_url || '',
      id_document_back_url: form.id_document_back_url || '',
    };
    if (!isEdit && user) {
      payload.created_by = user.id;
    }

    if (isEdit && customer) {
      const { error } = await supabase.from('customers').update(payload).eq('id', customer.id);
      if (error) { toast({ title: 'Error updating', description: error.message, variant: 'destructive' }); }
      else { toast({ title: '✅ Customer updated!' }); setOpen(false); onSuccess(); }
    } else {
      const { error } = await supabase.from('customers').insert(payload as any);
      if (error) { toast({ title: 'Error adding', description: error.message, variant: 'destructive' }); }
      else { toast({ title: '✅ Customer added!' }); setOpen(false); setForm(EMPTY); onSuccess(); }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && customer) setForm(customer); if (o && !customer) setForm(EMPTY); }}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" className="gap-1 text-xs"><Edit className="w-3 h-3" /> Edit</Button>
        ) : (
          <Button size="sm" className="gap-1.5 text-xs gradient-primary text-primary-foreground"><Plus className="w-3.5 h-3.5" /> Add Customer</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Customer / ደንበኛ ያስተካክሉ' : 'Add Customer / ደንበኛ ያስገቡ'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Photo & ID uploads */}
          <div className="grid grid-cols-3 gap-3">
            <FileUploadField
              label="Profile Photo"
              url={form.photo_url}
              uploading={uploadingPhoto}
              onUpload={handlePhotoUpload}
              accept="image/*"
              icon={<Camera className="w-6 h-6 text-muted-foreground" />}
            />
            <FileUploadField
              label="ID Front"
              url={form.id_document_url}
              uploading={uploadingDocFront}
              onUpload={handleDocFrontUpload}
              icon={<CreditCardIcon className="w-6 h-6 text-muted-foreground" />}
            />
            <FileUploadField
              label="ID Back"
              url={form.id_document_back_url}
              uploading={uploadingDocBack}
              onUpload={handleDocBackUpload}
              icon={<CreditCardIcon className="w-6 h-6 text-muted-foreground" />}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Full Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Abebe Kebede" /></div>
            <div><Label>Name (Amharic)</Label><Input value={form.name_am} onChange={e => set('name_am', e.target.value)} placeholder="አበበ ከበደ" className="font-ethiopic" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone *</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0911234567" /></div>
            <div><Label>Alt Phone</Label><Input value={form.alt_phone} onChange={e => set('alt_phone', e.target.value)} placeholder="0922345678" /></div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@example.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>City</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><Label>Sub City</Label><Input value={form.sub_city} onChange={e => set('sub_city', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Woreda</Label><Input value={form.woreda} onChange={e => set('woreda', e.target.value)} /></div>
            <div><Label>Kebele</Label><Input value={form.kebele} onChange={e => set('kebele', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Trust Rating (1-5)</Label>
              <Input type="number" min={1} max={5} value={form.trust} onChange={e => set('trust', parseInt(e.target.value) || 3)} />
            </div>
            <div><Label>Gov ID</Label><Input value={form.gov_id} onChange={e => set('gov_id', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Guarantor Name</Label><Input value={form.guarantor_name} onChange={e => set('guarantor_name', e.target.value)} /></div>
            <div><Label>Guarantor Phone</Label><Input value={form.guarantor_phone} onChange={e => set('guarantor_phone', e.target.value)} /></div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-info" /> Telegram Username</Label>
            <Input value={(form as any).telegram_username || ''} onChange={e => set('telegram_username' as any, e.target.value)} placeholder="@username" />
            <p className="text-[10px] text-muted-foreground mt-1">For direct Telegram notifications</p>
          </div>
          <div><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isEdit ? 'Update Customer' : 'Add Customer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
