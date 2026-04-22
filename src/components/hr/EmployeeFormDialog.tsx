import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Branch { id: string; name: string }
interface Props { open: boolean; onClose: () => void; onSaved: () => void; employee?: any | null; branches: Branch[] }

const blank = {
  employee_code: '', full_name: '', full_name_am: '', email: '', phone: '', gender: '',
  date_of_birth: '', branch_id: '', position: '', department: '', employment_type: 'full_time',
  status: 'active', hire_date: new Date().toISOString().slice(0, 10),
  base_salary: '0', transport_allowance: '0', housing_allowance: '0',
  position_allowance: '0', other_allowance: '0',
  bank_name: '', bank_account: '', tin_number: '', pension_number: '',
  emergency_contact_name: '', emergency_contact_phone: '', address: '',
};

export default function EmployeeFormDialog({ open, onClose, onSaved, employee, branches }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        ...blank,
        ...employee,
        date_of_birth: employee.date_of_birth || '',
        hire_date: employee.hire_date || new Date().toISOString().slice(0, 10),
        base_salary: String(employee.base_salary ?? 0),
        transport_allowance: String(employee.transport_allowance ?? 0),
        housing_allowance: String(employee.housing_allowance ?? 0),
        position_allowance: String(employee.position_allowance ?? 0),
        other_allowance: String(employee.other_allowance ?? 0),
      });
    } else {
      setForm({ ...blank, employee_code: 'EMP-' + Date.now().toString().slice(-6) });
    }
  }, [employee, open]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name || !form.employee_code) {
      toast({ title: 'Name and employee code required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      employee_code: form.employee_code,
      full_name: form.full_name,
      full_name_am: form.full_name_am || null,
      email: form.email || null,
      phone: form.phone || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      branch_id: form.branch_id || null,
      position: form.position || null,
      department: form.department || null,
      employment_type: form.employment_type,
      status: form.status,
      hire_date: form.hire_date,
      base_salary: Number(form.base_salary || 0),
      transport_allowance: Number(form.transport_allowance || 0),
      housing_allowance: Number(form.housing_allowance || 0),
      position_allowance: Number(form.position_allowance || 0),
      other_allowance: Number(form.other_allowance || 0),
      bank_name: form.bank_name || null,
      bank_account: form.bank_account || null,
      tin_number: form.tin_number || null,
      pension_number: form.pension_number || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      address: form.address || null,
    };
    const { error } = employee?.id
      ? await supabase.from('employees').update(payload).eq('id', employee.id)
      : await supabase.from('employees').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: employee?.id ? 'Employee updated' : 'Employee created' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{employee?.id ? 'Edit Employee' : 'New Employee'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div><Label>Employee Code *</Label><Input value={form.employee_code} onChange={e => set('employee_code', e.target.value)} /></div>
          <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
          <div><Label>Name (Amharic)</Label><Input className="font-ethiopic" value={form.full_name_am} onChange={e => set('full_name_am', e.target.value)} /></div>

          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div>
            <Label>Gender</Label>
            <Select value={form.gender || 'unspecified'} onValueChange={v => set('gender', v === 'unspecified' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">—</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
          <div><Label>Hire Date</Label><Input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} /></div>
          <div>
            <Label>Branch</Label>
            <Select value={form.branch_id || 'none'} onValueChange={v => set('branch_id', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Position</Label><Input value={form.position} onChange={e => set('position', e.target.value)} /></div>
          <div><Label>Department</Label><Input value={form.department} onChange={e => set('department', e.target.value)} /></div>
          <div>
            <Label>Employment Type</Label>
            <Select value={form.employment_type} onValueChange={v => set('employment_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3 mt-2 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Compensation (ETB / month)</p>
          </div>
          <div><Label>Base Salary</Label><Input type="number" value={form.base_salary} onChange={e => set('base_salary', e.target.value)} /></div>
          <div><Label>Transport Allowance</Label><Input type="number" value={form.transport_allowance} onChange={e => set('transport_allowance', e.target.value)} /></div>
          <div><Label>Housing Allowance</Label><Input type="number" value={form.housing_allowance} onChange={e => set('housing_allowance', e.target.value)} /></div>
          <div><Label>Position Allowance</Label><Input type="number" value={form.position_allowance} onChange={e => set('position_allowance', e.target.value)} /></div>
          <div><Label>Other Allowance</Label><Input type="number" value={form.other_allowance} onChange={e => set('other_allowance', e.target.value)} /></div>

          <div className="md:col-span-3 mt-2 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank & Identifiers</p>
          </div>
          <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></div>
          <div><Label>Bank Account</Label><Input value={form.bank_account} onChange={e => set('bank_account', e.target.value)} /></div>
          <div><Label>TIN Number</Label><Input value={form.tin_number} onChange={e => set('tin_number', e.target.value)} /></div>
          <div><Label>Pension Number</Label><Input value={form.pension_number} onChange={e => set('pension_number', e.target.value)} /></div>
          <div><Label>Emergency Contact</Label><Input value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
          <div><Label>Emergency Phone</Label><Input value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
          <div className="md:col-span-3"><Label>Address</Label><Input value={form.address} onChange={e => set('address', e.target.value)} /></div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {employee?.id ? 'Save Changes' : 'Create Employee'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
