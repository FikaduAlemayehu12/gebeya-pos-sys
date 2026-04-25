import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, Plus, Tag, Fingerprint, DollarSign, Wrench } from 'lucide-react';

const ASSET_CATEGORIES = [
  'Land', 'Building', 'Office Furniture', 'Vehicle', 'Machinery', 'Electronics', 'IT Equipment',
  'AC System', 'Fire Safety', 'Security Equipment', 'Generator', 'Tools', 'Electrical System', 'Other',
];

const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'needs_repair', 'retired'];
const DEPRECIATION_METHODS = ['straight_line', 'declining_balance', 'units_of_production', 'none'];

export default function AssetFormDialog({ onSuccess, editAsset }: { onSuccess: () => void; editAsset?: any | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [form, setForm] = useState({
    asset_code: '', name: '', name_am: '', category: 'Other', subcategory: '', description: '',
    branch_id: '', assigned_to: '', location: '',
    serial_number: '', registration_number: '', chassis_number: '', engine_number: '',
    manufacturer: '', model: '', year_manufactured: '',
    purchase_date: '', purchase_cost: '', current_value: '', salvage_value: '',
    useful_life_years: '5', depreciation_method: 'straight_line',
    condition: 'good', status: 'active',
    warranty_expiry: '', insurance_expiry: '', next_maintenance_date: '',
    supplier_id: '', notes: '',
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [b, e, s] = await Promise.all([
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
        supabase.from('employees').select('id, full_name, employee_code').eq('status', 'active').order('full_name'),
        supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      ]);
      setBranches(b.data || []);
      setEmployees(e.data || []);
      setSuppliers(s.data || []);
    })();
  }, [open]);

  useEffect(() => {
    if (editAsset && open) {
      setForm({
        ...form,
        ...editAsset,
        year_manufactured: String(editAsset.year_manufactured || ''),
        purchase_cost: String(editAsset.purchase_cost || ''),
        current_value: String(editAsset.current_value || ''),
        salvage_value: String(editAsset.salvage_value || ''),
        useful_life_years: String(editAsset.useful_life_years || 5),
        purchase_date: editAsset.purchase_date || '',
        warranty_expiry: editAsset.warranty_expiry || '',
        insurance_expiry: editAsset.insurance_expiry || '',
        next_maintenance_date: editAsset.next_maintenance_date || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editAsset, open]);

  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload: any = {
        asset_code: form.asset_code.trim() || `AST-${Date.now()}`,
        name: form.name.trim(),
        name_am: form.name_am,
        category: form.category,
        subcategory: form.subcategory,
        description: form.description,
        branch_id: form.branch_id || null,
        assigned_to: form.assigned_to || null,
        location: form.location,
        serial_number: form.serial_number || null,
        registration_number: form.registration_number || null,
        chassis_number: form.chassis_number || null,
        engine_number: form.engine_number || null,
        manufacturer: form.manufacturer,
        model: form.model,
        year_manufactured: form.year_manufactured ? Number(form.year_manufactured) : null,
        purchase_date: form.purchase_date || null,
        purchase_cost: Number(form.purchase_cost) || 0,
        current_value: Number(form.current_value) || Number(form.purchase_cost) || 0,
        salvage_value: Number(form.salvage_value) || 0,
        useful_life_years: Number(form.useful_life_years) || 5,
        depreciation_method: form.depreciation_method,
        condition: form.condition,
        status: form.status,
        warranty_expiry: form.warranty_expiry || null,
        insurance_expiry: form.insurance_expiry || null,
        next_maintenance_date: form.next_maintenance_date || null,
        supplier_id: form.supplier_id || null,
        notes: form.notes,
        created_by: user?.id,
      };
      if (editAsset) {
        const { error } = await supabase.from('assets').update(payload).eq('id', editAsset.id);
        if (error) throw error;
        toast({ title: 'Asset updated' });
      } else {
        const { error } = await supabase.from('assets').insert(payload);
        if (error) throw error;
        toast({ title: 'Asset registered' });
      }
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const SectionHeader = ({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) => (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <span className="text-[11px] text-muted-foreground">— {hint}</span>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editAsset
          ? <Button size="sm" variant="outline" className="text-xs">Edit</Button>
          : <Button size="sm" className="gap-1.5 text-xs gradient-primary text-primary-foreground"><Plus className="w-3.5 h-3.5" /> Add Asset</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {editAsset ? 'Edit Asset' : 'Register Company Asset'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {/* GENERAL */}
          <SectionHeader icon={Tag} title="General Information" />
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Asset Code</Label><Input value={form.asset_code} onChange={e => upd('asset_code', e.target.value)} placeholder="Auto if blank" /></div>
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => upd('name', e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name (Amharic)</Label><Input value={form.name_am} onChange={e => upd('name_am', e.target.value)} className="font-ethiopic" /></div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => upd('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Subcategory</Label><Input value={form.subcategory} onChange={e => upd('subcategory', e.target.value)} placeholder="Optional" /></div>
            <div><Label className="text-xs">Location</Label><Input value={form.location} onChange={e => upd('location', e.target.value)} placeholder="Room, floor, building" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Branch</Label>
              <Select value={form.branch_id} onValueChange={v => upd('branch_id', v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assigned To</Label>
              <Select value={form.assigned_to} onValueChange={v => upd('assigned_to', v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={2} /></div>

          {/* IDENTITY */}
          <Separator />
          <SectionHeader icon={Fingerprint} title="Identity & Specifications" />
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Serial Number</Label><Input value={form.serial_number} onChange={e => upd('serial_number', e.target.value)} /></div>
            <div><Label className="text-xs">Registration #</Label><Input value={form.registration_number} onChange={e => upd('registration_number', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Chassis #</Label><Input value={form.chassis_number} onChange={e => upd('chassis_number', e.target.value)} /></div>
            <div><Label className="text-xs">Engine #</Label><Input value={form.engine_number} onChange={e => upd('engine_number', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Manufacturer</Label><Input value={form.manufacturer} onChange={e => upd('manufacturer', e.target.value)} /></div>
            <div><Label className="text-xs">Model</Label><Input value={form.model} onChange={e => upd('model', e.target.value)} /></div>
            <div><Label className="text-xs">Year</Label><Input type="number" value={form.year_manufactured} onChange={e => upd('year_manufactured', e.target.value)} /></div>
          </div>

          {/* FINANCE */}
          <Separator />
          <SectionHeader icon={DollarSign} title="Finance & Depreciation" />
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => upd('purchase_date', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Supplier</Label>
              <Select value={form.supplier_id} onValueChange={v => upd('supplier_id', v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Purchase Cost (ETB)</Label><Input type="number" step="0.01" value={form.purchase_cost} onChange={e => upd('purchase_cost', e.target.value)} /></div>
            <div><Label className="text-xs">Current Value (ETB)</Label><Input type="number" step="0.01" value={form.current_value} onChange={e => upd('current_value', e.target.value)} /></div>
            <div><Label className="text-xs">Salvage Value (ETB)</Label><Input type="number" step="0.01" value={form.salvage_value} onChange={e => upd('salvage_value', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Useful Life (years)</Label><Input type="number" value={form.useful_life_years} onChange={e => upd('useful_life_years', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Depreciation Method</Label>
              <Select value={form.depreciation_method} onValueChange={v => upd('depreciation_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPRECIATION_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* OPERATIONS */}
          <Separator />
          <SectionHeader icon={Wrench} title="Operations & Maintenance" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Condition</Label>
              <Select value={form.condition} onValueChange={v => upd('condition', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => upd('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['active', 'inactive', 'in_repair', 'disposed', 'sold'].map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Warranty Expiry</Label><Input type="date" value={form.warranty_expiry} onChange={e => upd('warranty_expiry', e.target.value)} /></div>
            <div><Label className="text-xs">Insurance Expiry</Label><Input type="date" value={form.insurance_expiry} onChange={e => upd('insurance_expiry', e.target.value)} /></div>
            <div><Label className="text-xs">Next Maintenance</Label><Input type="date" value={form.next_maintenance_date} onChange={e => upd('next_maintenance_date', e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} /></div>

          <Button type="submit" className="w-full mt-2 gradient-primary text-primary-foreground" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {editAsset ? 'Update Asset' : 'Register Asset'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
