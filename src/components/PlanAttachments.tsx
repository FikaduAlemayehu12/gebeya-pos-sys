import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Paperclip, Upload, X, FileText, FileSpreadsheet, FileArchive, FileImage, File, Loader2, Download,
} from 'lucide-react';

const ALLOWED = [
  'application/zip', 'application/x-zip-compressed',
  'application/pdf',
  'text/csv', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
];
const ALLOWED_EXT = ['.zip', '.pdf', '.csv', '.xls', '.xlsx', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function iconFor(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith('.zip')) return <FileArchive className="w-3.5 h-3.5" />;
  if (n.endsWith('.pdf')) return <FileText className="w-3.5 h-3.5" />;
  if (n.endsWith('.csv') || n.endsWith('.xls') || n.endsWith('.xlsx')) return <FileSpreadsheet className="w-3.5 h-3.5" />;
  if (n.endsWith('.doc') || n.endsWith('.docx')) return <FileText className="w-3.5 h-3.5" />;
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(n)) return <FileImage className="w-3.5 h-3.5" />;
  return <File className="w-3.5 h-3.5" />;
}

function shortName(path: string) {
  const base = path.split('/').pop() || path;
  return base.replace(/^\d+-/, '');
}

function isImage(name: string) {
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(name);
}

export function AttachmentList({ paths, onRemove, readOnly }: { paths: string[]; onRemove?: (p: string) => void; readOnly?: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Pre-sign all paths so images can render inline
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = paths.filter((p) => !urls[p]);
      if (!missing.length) return;
      const next: Record<string, string> = { ...urls };
      const res = await supabase.storage.from('plan-attachments').createSignedUrls(missing, 3600);
      if (cancelled) return;
      (res.data || []).forEach((row: any) => {
        if (row?.path && row?.signedUrl) next[row.path] = row.signedUrl;
      });
      setUrls(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join('|')]);

  const open = async (p: string) => {
    let url = urls[p];
    if (!url) {
      setBusy(p);
      const { data, error } = await supabase.storage.from('plan-attachments').createSignedUrl(p, 300);
      setBusy(null);
      if (error || !data?.signedUrl) {
        toast({ title: 'Cannot open file', description: error?.message || 'Missing or unauthorized', variant: 'destructive' });
        return;
      }
      url = data.signedUrl;
    }
    window.open(url, '_blank', 'noopener');
  };

  if (!paths.length) return null;

  const images = paths.filter(isImage);
  const docs = paths.filter((p) => !isImage(p));

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {images.map((p) => (
            <div key={p} className="relative group rounded-md overflow-hidden border bg-muted">
              <button type="button" onClick={() => open(p)} className="block w-full aspect-square">
                {urls[p] ? (
                  <img src={urls[p]} alt={shortName(p)} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                )}
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 text-[10px] text-white truncate">
                {shortName(p)}
              </div>
              {!readOnly && onRemove && (
                <button type="button" onClick={() => onRemove(p)} className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {docs.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1.5 pr-1 max-w-[260px]">
              <button type="button" onClick={() => open(p)} className="flex items-center gap-1.5 truncate">
                {busy === p ? <Loader2 className="w-3 h-3 animate-spin" /> : iconFor(p)}
                <span className="truncate text-[11px]">{shortName(p)}</span>
                <Download className="w-3 h-3 opacity-60" />
              </button>
              {!readOnly && onRemove && (
                <button type="button" onClick={() => onRemove(p)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentUploader({
  value, onChange, required, tenantId,
}: {
  value: string[];
  onChange: (paths: string[]) => void;
  required?: boolean;
  tenantId?: string | null;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tid, setTid] = useState<string | null>(tenantId || null);

  useEffect(() => {
    if (tenantId) { setTid(tenantId); return; }
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: m } = await supabase
        .from('company_members')
        .select('company_id, is_default')
        .eq('user_id', uid)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (m?.company_id) setTid(m.company_id);
    })();
  }, [tenantId]);

  const validate = (file: File) => {
    if (file.size > MAX_BYTES) return `${file.name}: too large (max 25 MB)`;
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
      return `${file.name}: file type not allowed`;
    }
    return null;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!tid) {
      toast({ title: 'No active company', description: 'Cannot determine tenant for upload', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const err = validate(file);
      if (err) { toast({ title: 'Skipped file', description: err, variant: 'destructive' }); continue; }
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
      const path = `${tid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const { error } = await supabase.storage.from('plan-attachments').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (error) {
        toast({ title: 'Upload failed', description: `${file.name}: ${error.message}`, variant: 'destructive' });
        continue;
      }
      added.push(path);
    }
    if (added.length) onChange([...value, ...added]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const remove = async (p: string) => {
    await supabase.storage.from('plan-attachments').remove([p]);
    onChange(value.filter((x) => x !== p));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".zip,.pdf,.csv,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
          Add files
        </Button>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Paperclip className="w-3 h-3" /> ZIP, PDF, CSV, XLSX, DOCX, images · max 25 MB
        </span>
      </div>
      {required && value.length === 0 && (
        <p className="text-[11px] text-destructive">At least one attachment is required.</p>
      )}
      <AttachmentList paths={value} onRemove={remove} />
    </div>
  );
}
