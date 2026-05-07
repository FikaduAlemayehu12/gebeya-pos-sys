import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Mapping = { date: string; description: string; reference: string; debit: string; credit: string; balance: string };
type Step = 'upload' | 'map' | 'preview' | 'done';

interface Row { raw: Record<string, string>; parsed: { txn_date: string; description: string; reference: string; debit: number; credit: number; balance: number | null }; errors: string[]; isDuplicate: boolean }

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // simple RFC4180-ish parser handling quoted commas
  const lines: string[][] = [];
  let i = 0, field = '', row: string[] = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); lines.push(row); row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); lines.push(row); }
  const cleaned = lines.filter(r => r.some(c => c.trim() !== ''));
  if (cleaned.length === 0) return { headers: [], rows: [] };
  const headers = cleaned[0].map(h => h.trim());
  const rows = cleaned.slice(1).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}

function autoDetect(headers: string[]): Mapping {
  const find = (re: RegExp) => headers.find(h => re.test(h.toLowerCase())) || '';
  return {
    date: find(/date|txn|transaction/),
    description: find(/desc|narr|detail|particular/),
    reference: find(/ref|trace|id|cheque|trans.*id/),
    debit: find(/debit|withdraw|out|^dr$/),
    credit: find(/credit|deposit|in$|^cr$/),
    balance: find(/balance|bal/),
  };
}

function normalizeDate(s: string): string {
  if (!s) return '';
  // try ISO first
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;
  // try DD/MM/YYYY or MM/DD/YYYY (assume DD/MM)
  const slash = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (slash) {
    let [_, a, b, y] = slash;
    if (y.length === 2) y = '20' + y;
    return `${y}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return '';
}
const num = (v: string) => {
  if (!v) return 0;
  const cleaned = v.replace(/[,\s]/g,'').replace(/[()]/g,'-');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
};

export default function BankCsvImportDialog({
  open, onOpenChange, bankAccountId, onImported,
}: { open: boolean; onOpenChange: (o: boolean) => void; bankAccountId: string; onImported: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string,string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ date:'', description:'', reference:'', debit:'', credit:'', balance:'' });
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const reset = () => { setStep('upload'); setHeaders([]); setRawRows([]); setMapping({date:'',description:'',reference:'',debit:'',credit:'',balance:''}); setFileName(''); };

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast({ title: 'File too large', description: 'Max 10 MB', variant: 'destructive' }); return; }
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast({ title: 'Only CSV files supported', variant: 'destructive' }); return;
    }
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) { toast({ title: 'Empty CSV', variant: 'destructive' }); return; }
    if (rows.length === 0) { toast({ title: 'No data rows found', variant: 'destructive' }); return; }
    if (rows.length > 5000) { toast({ title: 'Too many rows', description: 'Max 5,000 per import.', variant: 'destructive' }); return; }
    setFileName(file.name);
    setHeaders(headers);
    setRawRows(rows);
    setMapping(autoDetect(headers));
    // load last 90 days existing lines for dedupe
    const since = new Date(); since.setDate(since.getDate() - 90);
    const { data } = await supabase.from('bank_statement_lines' as any)
      .select('txn_date, debit, credit, reference, description')
      .eq('bank_account_id', bankAccountId)
      .gte('txn_date', since.toISOString().slice(0,10));
    const keys = new Set<string>(((data as any[])||[]).map(r => `${r.txn_date}|${Number(r.debit)}|${Number(r.credit)}|${(r.reference||'').trim()}|${(r.description||'').trim()}`));
    setExistingKeys(keys);
    setStep('map');
  };

  const previewRows: Row[] = useMemo(() => {
    if (step === 'upload' || !mapping.date) return [];
    const seen = new Set<string>();
    return rawRows.map(r => {
      const txn_date = normalizeDate(r[mapping.date] || '');
      const debit = num(r[mapping.debit] || '');
      const credit = num(r[mapping.credit] || '');
      const reference = (r[mapping.reference] || '').trim();
      const description = (r[mapping.description] || '').trim();
      const balance = mapping.balance ? num(r[mapping.balance] || '') : null;
      const errors: string[] = [];
      if (!txn_date) errors.push('Invalid date');
      if (debit === 0 && credit === 0) errors.push('Amount missing');
      if (debit > 0 && credit > 0) errors.push('Both debit & credit set');
      const key = `${txn_date}|${debit}|${credit}|${reference}|${description}`;
      const isDuplicate = existingKeys.has(key) || seen.has(key);
      seen.add(key);
      return { raw: r, parsed: { txn_date, description, reference, debit, credit, balance }, errors, isDuplicate };
    });
  }, [rawRows, mapping, existingKeys, step]);

  const valid = previewRows.filter(r => r.errors.length === 0 && !r.isDuplicate);
  const dupes = previewRows.filter(r => r.isDuplicate);
  const errs = previewRows.filter(r => r.errors.length > 0);

  const doImport = async () => {
    if (valid.length === 0) { toast({ title: 'Nothing valid to import', variant: 'destructive' }); return; }
    setImporting(true);
    const records = valid.map(r => ({ bank_account_id: bankAccountId, ...r.parsed }));
    const chunks: any[][] = [];
    for (let i=0; i<records.length; i+=500) chunks.push(records.slice(i, i+500));
    let inserted = 0;
    for (const ch of chunks) {
      const { error } = await supabase.from('bank_statement_lines' as any).insert(ch as any);
      if (error) { toast({ title: 'Import failed', description: error.message, variant: 'destructive' }); setImporting(false); return; }
      inserted += ch.length;
    }
    toast({ title: `Imported ${inserted} lines`, description: `${dupes.length} duplicates skipped, ${errs.length} errors skipped.` });
    setImporting(false);
    setStep('done');
    onImported();
  };

  const mappingValid = !!mapping.date && (!!mapping.debit || !!mapping.credit);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Import bank statement (CSV)</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-6 space-y-3">
            <Alert>
              <AlertDescription className="text-xs">
                Upload a CSV exported from your bank, Telebirr or CBE Birr portal. Max 10 MB / 5,000 rows. We'll detect columns, validate data and let you review before saving.
              </AlertDescription>
            </Alert>
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <Button onClick={() => fileRef.current?.click()}>Choose CSV file</Button>
              <p className="text-xs text-muted-foreground mt-2">First row should be column headers</p>
            </div>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{fileName} — {rawRows.length} rows. Confirm column mapping:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(['date','description','reference','debit','credit','balance'] as (keyof Mapping)[]).map(k => (
                <div key={k}>
                  <Label className="capitalize text-xs">{k}{(k==='date'||k==='debit'||k==='credit') && <span className="text-destructive"> *</span>}</Label>
                  <Select value={mapping[k] || '__none__'} onValueChange={(v) => setMapping({ ...mapping, [k]: v === '__none__' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="— none —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— none —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Alert variant={mappingValid ? 'default' : 'destructive'}>
              <AlertDescription className="text-xs">
                {mappingValid ? '✓ Mapping looks good' : 'You must map at least Date and one of Debit/Credit.'}
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button disabled={!mappingValid} onClick={() => setStep('preview')}>Preview {rawRows.length} rows</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="bg-success/15 text-success"><CheckCircle2 className="w-3 h-3 mr-1" /> {valid.length} valid</Badge>
              <Badge className="bg-warning/15 text-warning-foreground"><AlertTriangle className="w-3 h-3 mr-1" /> {dupes.length} duplicates</Badge>
              <Badge className="bg-destructive/15 text-destructive"><AlertTriangle className="w-3 h-3 mr-1" /> {errs.length} errors</Badge>
            </div>
            <div className="max-h-[50vh] overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 200).map((r, i) => (
                    <TableRow key={i} className={r.errors.length ? 'bg-destructive/5' : r.isDuplicate ? 'bg-warning/5' : ''}>
                      <TableCell>
                        {r.errors.length ? <Badge variant="destructive" className="text-[9px]">{r.errors[0]}</Badge>
                          : r.isDuplicate ? <Badge className="bg-warning/15 text-warning-foreground text-[9px]">dup</Badge>
                          : <Badge className="bg-success/15 text-success text-[9px]">ok</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{r.parsed.txn_date || '—'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]">{r.parsed.description}</TableCell>
                      <TableCell className="font-mono text-[11px]">{r.parsed.reference}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.parsed.debit || ''}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.parsed.credit || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewRows.length > 200 && <p className="text-center text-xs text-muted-foreground p-2">Showing first 200 rows…</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button disabled={importing || valid.length === 0} onClick={doImport}>
                {importing ? 'Importing…' : `Save ${valid.length} transactions`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="py-10 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <p className="text-sm">Import complete.</p>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
