import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export default function CompanySwitcher() {
  const { companies, activeCompany, switchCompany } = useAuth();

  if (!activeCompany) return null;

  // Single company → render as a static label, no switcher needed.
  if (companies.length <= 1) {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-foreground truncate max-w-[160px]">{activeCompany.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-sm transition-colors">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-foreground truncate max-w-[140px]">{activeCompany.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => c.id !== activeCompany.id && switchCompany(c.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-[10px] text-muted-foreground">{c.code} · {c.member_role}</div>
            </div>
            {c.id === activeCompany.id && <Check className="w-4 h-4 text-primary shrink-0" />}
            {c.member_role === 'owner' && <Badge variant="secondary" className="text-[9px]">owner</Badge>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
