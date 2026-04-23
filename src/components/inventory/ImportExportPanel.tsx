import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  downloadWorkbook, parseSpreadsheet, validateProductRow,
  PRODUCT_TEMPLATE_COLUMNS, PRODUCT_TEMPLATE_SAMPLE,
  ASSET_TEMPLATE_COLUMNS, ASSET_TEMPLATE_SAMPLE,
} from '@/lib/inventory/importExport';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, FileWarning,
} from 'lucide-react';

interface ImportJob {
  id: string;
  job_type: string;
  file_name: string;
  status: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  quarantined_rows: number;
  created_at: string;
}

export default function ImportExportPanel({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [lastReport, setLastReport] = useState<{ imported: number; quarantined: number; failed: number; warnings: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(10);
      setJobs((data as ImportJob[]) || []);
    })();
  }, [open, importing]);

  const downloadProductTemplate = () => {
    const rows = [PRODUCT_TEMPLATE_SAMPLE, Object.fromEntries(PRODUCT_TEMPLATE_COLUMNS.map(c => [c, '']))];
    downloadWorkbook(rows, 'product-import-template.xlsx', 'Products');
    toast({ title: 'Template downloaded', description: 'Fill it with your products and re-upload.' });
  };

  const downloadAssetTemplate = () => {
    const rows = [ASSET_TEMPLATE_SAMPLE, Object.fromEntries(ASSET_TEMPLATE_COLUMNS.map(c => [c, '']))];
    downloadWorkbook(rows, 'asset-import-template.xlsx', 'Assets');
    toast({ title: 'Asset template downloaded' });
  };

  const exportProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (!data) return;
    downloadWorkbook(data as any[], `products-${Date.now()}.xlsx`, 'Products');
    toast({ title: 'Products exported', description: `${data.length} rows.` });
  };

  const exportAssets = async () => {
    const { data } = await supabase.from('assets').select('*');
    if (!data) return;
    downloadWorkbook(data as any[], `assets-${Date.now()}.xlsx`, 'Assets');
    toast({ title: 'Assets exported', description: `${data.length} rows.` });
  };

  const handleProductImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setLastReport(null);
    try {
      const rows = await parseSpreadsheet(file);
      // Build category slug map
      const { data: cats } = await supabase.from('product_categories').select('id, slug');
      const catMap = new Map<string, string>();
      (cats || []).forEach((c: any) => catMap.set(c.slug, c.id));

      // Create import job
      const { data: job, error: jobErr } = await supabase.from('import_jobs').insert({
        job_type: 'products',
        file_name: file.name,
        status: 'processing',
        total_rows: rows.length,
        performed_by: user?.id,
      }).select('id').single();
      if (jobErr) throw jobErr;

      let imported = 0, quarantined = 0, failed = 0, warnings = 0;
      const rowInserts: any[] = [];
      const productInserts: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const v = validateProductRow(rows[i], catMap);
        if (v.warnings.length > 0) warnings++;
        if (!v.valid) {
          quarantined++;
          rowInserts.push({
            job_id: job!.id, row_number: i + 1, raw_data: rows[i],
            parsed_data: v.parsed, status: 'quarantined',
            errors: v.errors, warnings: v.warnings,
          });
        } else {
          productInserts.push({
            ...v.parsed,
            created_by: user?.id,
            is_active: true,
          });
          rowInserts.push({
            job_id: job!.id, row_number: i + 1, raw_data: rows[i],
            parsed_data: v.parsed, status: 'imported',
            warnings: v.warnings,
          });
        }
      }

      if (productInserts.length > 0) {
        const { error: insErr } = await supabase.from('products').insert(productInserts);
        if (insErr) {
          failed = productInserts.length;
          imported = 0;
        } else {
          imported = productInserts.length;
        }
      }

      // Quarantine table inserts (chunk for safety)
      if (rowInserts.length > 0) {
        const chunk = 100;
        for (let i = 0; i < rowInserts.length; i += chunk) {
          await supabase.from('import_rows').insert(rowInserts.slice(i, i + chunk));
        }
      }

      await supabase.from('import_jobs').update({
        status: failed > 0 ? 'partial' : 'completed',
        imported_rows: imported,
        failed_rows: failed,
        quarantined_rows: quarantined,
        completed_at: new Date().toISOString(),
      }).eq('id', job!.id);

      setLastReport({ imported, quarantined, failed, warnings });
      toast({
        title: 'Import complete',
        description: `${imported} imported, ${quarantined} quarantined, ${failed} failed.`,
      });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Import error', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Import / Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Import & Export Manager
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="products" className="text-xs">Products</TabsTrigger>
            <TabsTrigger value="assets" className="text-xs">Assets</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4 pt-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">1. Download template</p>
                    <p className="text-xs text-muted-foreground">Get the standard Excel template with sample data and column headers.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={downloadProductTemplate}>Get Template</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Upload className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">2. Upload filled file</p>
                    <p className="text-xs text-muted-foreground">Lenient validation — invalid rows go to a quarantine queue for review.</p>
                  </div>
                  <label className="inline-flex">
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleProductImport} disabled={importing} className="hidden" />
                    <Button size="sm" className="gradient-primary text-primary-foreground" disabled={importing} asChild>
                      <span className="cursor-pointer">
                        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                        Upload
                      </span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Export current products</p>
                  <p className="text-xs text-muted-foreground">Download a snapshot of all products as Excel.</p>
                </div>
                <Button size="sm" variant="outline" onClick={exportProducts}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export All
                </Button>
              </CardContent>
            </Card>
            {lastReport && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Last import report</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div><p className="text-lg font-bold text-success">{lastReport.imported}</p><p className="text-[10px] text-muted-foreground">Imported</p></div>
                    <div><p className="text-lg font-bold text-warning">{lastReport.quarantined}</p><p className="text-[10px] text-muted-foreground">Quarantined</p></div>
                    <div><p className="text-lg font-bold text-destructive">{lastReport.failed}</p><p className="text-[10px] text-muted-foreground">Failed</p></div>
                    <div><p className="text-lg font-bold text-primary">{lastReport.warnings}</p><p className="text-[10px] text-muted-foreground">Warnings</p></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="assets" className="space-y-4 pt-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div><p className="font-medium text-sm">Asset import template</p><p className="text-xs text-muted-foreground">Standard format for fixed assets.</p></div>
                <Button size="sm" variant="outline" onClick={downloadAssetTemplate}><Download className="w-3.5 h-3.5 mr-1.5" />Get Template</Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div><p className="font-medium text-sm">Export current assets</p><p className="text-xs text-muted-foreground">Download all registered assets.</p></div>
                <Button size="sm" variant="outline" onClick={exportAssets}><Download className="w-3.5 h-3.5 mr-1.5" />Export All</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="pt-4 space-y-2">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No import history yet.</p>
            ) : jobs.map(j => (
              <Card key={j.id}><CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {j.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                  {j.status === 'partial' && <FileWarning className="w-4 h-4 text-warning shrink-0" />}
                  {j.status === 'failed' && <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                  {j.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{j.file_name || j.job_type}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(j.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">✓ {j.imported_rows}</Badge>
                  {j.quarantined_rows > 0 && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">⚠ {j.quarantined_rows}</Badge>}
                  {j.failed_rows > 0 && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">✗ {j.failed_rows}</Badge>}
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
