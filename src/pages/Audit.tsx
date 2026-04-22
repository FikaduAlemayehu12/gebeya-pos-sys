import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatCard from '@/components/StatCard';
import { FileSearch, ShieldAlert, Activity, AlertTriangle, ClipboardList } from 'lucide-react';

type ActivityLog = { id: string; user_id: string; action_type: string; description: string; amount: number | null; created_at: string };
type AuditLog = { id: string; user_id: string | null; action: string; entity: string; severity: string; created_at: string; ip_address: string | null };

export default function Audit() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('');
  const [severity, setSeverity] = useState<string>('all');

  const fetchAll = async () => {
    const [a, b] = await Promise.all([
      supabase.from('pos_activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setActivities((a.data as any) || []);
    setAudits((b.data as any) || []);
  };
  useEffect(() => { fetchAll(); }, []);

  const stats = useMemo(() => ({
    total: activities.length + audits.length,
    today: [...activities, ...audits].filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length,
    critical: audits.filter(a => a.severity === 'critical').length,
    warnings: audits.filter(a => a.severity === 'warning').length,
  }), [activities, audits]);

  const filteredActs = activities.filter(a =>
    !filter || a.action_type.toLowerCase().includes(filter.toLowerCase()) || a.description.toLowerCase().includes(filter.toLowerCase())
  );
  const filteredAudits = audits.filter(a =>
    (severity === 'all' || a.severity === severity) &&
    (!filter || a.action.toLowerCase().includes(filter.toLowerCase()) || a.entity.toLowerCase().includes(filter.toLowerCase()))
  );

  const sevColor: Record<string, string> = {
    info: 'bg-info/15 text-info',
    warning: 'bg-warning/20 text-warning-foreground',
    critical: 'bg-destructive/15 text-destructive',
    success: 'bg-success/15 text-success',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FileSearch className="w-6 h-6 text-primary" /> Audit & Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">System-wide activity, audit trail, and security events.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Events" value={stats.total} icon={Activity} variant="info" />
        <StatCard label="Today" value={stats.today} icon={ClipboardList} variant="default" />
        <StatCard label="Warnings" value={stats.warnings} icon={AlertTriangle} variant="warning" />
        <StatCard label="Critical" value={stats.critical} icon={ShieldAlert} variant="destructive" />
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <Input placeholder="Filter by action / entity..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="stat-card-shadow">
          <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Severity</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredAudits.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No audit events.</TableCell></TableRow>}
                {filteredAudits.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-medium text-sm">{a.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.entity}</TableCell>
                    <TableCell><Badge variant="secondary" className={sevColor[a.severity] || ''}>{a.severity}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="stat-card-shadow">
          <CardHeader><CardTitle className="text-base">Activity Log (POS / System)</CardTitle></CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredActs.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No activity yet.</TableCell></TableRow>}
                {filteredActs.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline">{a.action_type}</Badge></TableCell>
                    <TableCell className="text-sm">{a.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
