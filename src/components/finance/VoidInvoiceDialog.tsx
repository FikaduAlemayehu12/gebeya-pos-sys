import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const REASON_PRESETS = [
  'Customer return / refund',
  'Pricing error on invoice',
  'Wrong customer or branch',
  'Duplicate invoice issued',
  'Tax / VAT calculation error',
  'Cancelled order before delivery',
  'Other (specify in notes)',
];

interface Props {
  open: boolean;
  onClose: () => void;
  sale: { id: string; receipt_id: string; total: number; created_at: string; status?: string } | null;
  onVoided?: () => void;
}

export default function VoidInvoiceDialog({ open, onClose, sale, onVoided }: Props) {
  const { toast } = useToast();
  const [preset, setPreset] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const days = sale ? Math.floor((Date.now() - new Date(sale.created_at).getTime()) / 86400000) : 0;
  const lateWindow = days > 7;
  const fullReason = `${preset}${notes ? ` — ${notes.trim()}` : ''}`.trim();
  const reasonValid = preset && fullReason.length >= 5;

  const submit = async () => {
    if (!sale || !reasonValid) {
      toast({ title: 'Reason required', description: 'Pick a reason and add details (min 5 chars).', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('request_void_sale', {
      _sale_id: sale.id,
      _reason: fullReason,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Void failed', description: error.message, variant: 'destructive' });
      return;
    }
    const result: any = data;
    if (result?.status === 'voided') {
      toast({ title: 'Invoice voided', description: `Credit note created. Stock restored. Receipt ${sale.receipt_id} reversed.` });
    } else {
      toast({
        title: 'Sent for admin approval',
        description: `Invoice is ${result?.days_since} days old (>7d). Admin must approve before void executes.`,
      });
    }
    onVoided?.();
    onClose();
    setPreset(''); setNotes('');
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" /> Void Invoice {sale.receipt_id}
          </DialogTitle>
          <DialogDescription>
            MoR Directive 1099/2025 — voided invoices are preserved with full audit trail; a credit note is auto-issued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/30 text-sm flex items-center justify-between gap-2">
            <div>
              <div className="font-mono">{sale.receipt_id}</div>
              <div className="text-xs text-muted-foreground">
                Issued {new Date(sale.created_at).toLocaleString()} • {days} day{days === 1 ? '' : 's'} ago
              </div>
            </div>
            <Badge variant={lateWindow ? 'destructive' : 'secondary'}>
              {lateWindow ? `Late: ${days}d` : `Within 7-day window`}
            </Badge>
          </div>

          {lateWindow && (
            <div className="flex gap-2 items-start rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <div>
                Beyond the 7-day legal window. This will be filed as a request and only an <b>admin</b> can approve it.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason for cancellation *</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
              <SelectContent>
                {REASON_PRESETS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Additional details</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Customer name, communication, evidence reference..."
              rows={3}
            />
            <div className="text-[10px] text-muted-foreground text-right">{notes.length}/500</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || !reasonValid}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {lateWindow ? 'File void request' : 'Confirm void'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
