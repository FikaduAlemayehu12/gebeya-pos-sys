import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload, FileText, Trash2, Download, Image as ImageIcon } from 'lucide-react';

interface Props { employeeId: string | null; photoUrl?: string; onPhotoChange?: (url: string) => void }

const DOC_TYPES = [
  { value: 'id', label: 'ID / Passport' },
  { value: 'cv', label: 'CV / Resume' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

export default function EmployeeDocumentsSection({ employeeId, photoUrl, onPhotoChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('id');
  const [title, setTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = async () => {
    if (!employeeId) return;
    setLoading(true);
    const { data } = await supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [employeeId]);

  const signedUrl = async (path: string) => {
    const { data } = await supabase.storage.from('employee-docs').createSignedUrl(path, 3600);
    return data?.signedUrl || '';
  };

  const handleUpload = async (file: File) => {
    if (!employeeId) {
      toast({ title: 'Save employee first', description: 'Create the employee record before adding documents.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${employeeId}/${docType}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('employee-docs').upload(path, file, { upsert: false });
    if (upErr) { toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' }); setUploading(false); return; }
    const { error: dbErr } = await supabase.from('employee_documents').insert({
      employee_id: employeeId,
      doc_type: docType,
      title: title || file.name,
      file_url: path,
      file_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user?.id,
    } as any);
    setUploading(false);
    if (dbErr) { toast({ title: 'Save failed', description: dbErr.message, variant: 'destructive' }); return; }
    toast({ title: 'Document uploaded' });
    setTitle('');
    if (fileRef.current) fileRef.current.value = '';
    load();
  };

  const handleDelete = async (doc: any) => {
    if (!confirm('Delete this document?')) return;
    await supabase.storage.from('employee-docs').remove([doc.file_path]);
    await supabase.from('employee_documents').delete().eq('id', doc.id);
    toast({ title: 'Deleted' });
    load();
  };

  const openDoc = async (doc: any) => {
    const url = await signedUrl(doc.file_path);
    if (url) window.open(url, '_blank');
  };

  const handlePhoto = async (file: File) => {
    if (!employeeId) {
      toast({ title: 'Save employee first', variant: 'destructive' });
      return;
    }
    setPhotoBusy(true);
    const path = `photos/${employeeId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('asset-images').upload(path, file, { upsert: true });
    if (error) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); setPhotoBusy(false); return; }
    const { data } = supabase.storage.from('asset-images').getPublicUrl(path);
    const url = data.publicUrl;
    await supabase.from('employees').update({ photo_url: url }).eq('id', employeeId);
    onPhotoChange?.(url);
    setPhotoBusy(false);
    toast({ title: 'Photo updated' });
  };

  if (!employeeId) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Save the employee first to upload profile photo and documents (ID, CV, certificates, contracts).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile photo */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center border">
          {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
        </div>
        <div>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()} disabled={photoBusy}>
            {photoBusy && <Loader2 className="w-4 h-4 animate-spin mr-2" />} <Upload className="w-4 h-4 mr-1" /> Upload Photo
          </Button>
          <p className="text-xs text-muted-foreground mt-1">JPG/PNG up to 5MB</p>
        </div>
      </div>

      {/* Document uploader */}
      <div className="rounded-md border p-3 space-y-3">
        <p className="text-sm font-semibold">Upload Document</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Title (optional)</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. National ID front" />
          </div>
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-1" />} Choose File
        </Button>
      </div>

      {/* Document list */}
      <div className="space-y-1">
        <p className="text-sm font-semibold">Documents ({docs.length})</p>
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-xs text-muted-foreground">No documents uploaded yet.</div>
        ) : (
          <div className="divide-y border rounded-md">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{DOC_TYPES.find(t => t.value === d.doc_type)?.label || d.doc_type} · {(d.size_bytes / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => openDoc(d)}><Download className="w-4 h-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(d)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
