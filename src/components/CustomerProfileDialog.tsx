import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Download, Phone, MapPin, Star, Shield } from 'lucide-react';
import { formatETB, formatPhone } from '@/lib/ethiopian';
import { cn } from '@/lib/utils';

interface CustomerProfile {
  id: string;
  name: string;
  name_am?: string | null;
  phone: string;
  alt_phone?: string | null;
  city?: string | null;
  sub_city?: string | null;
  woreda?: string | null;
  kebele?: string | null;
  trust?: number | null;
  total_purchases?: number | null;
  credit_balance?: number | null;
  guarantor_name?: string | null;
  guarantor_phone?: string | null;
  gov_id?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  id_document_url?: string | null;
  id_document_back_url?: string | null;
  telegram_chat_id?: string | null;
}

interface CustomerProfileDialogProps {
  customer: CustomerProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CustomerProfileDialog({ customer, open, onOpenChange }: CustomerProfileDialogProps) {
  if (!customer) return null;

  const initials = customer.name.split(' ').slice(0, 2).map(n => n[0]).join('');
  const trust = customer.trust ?? 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">{customer.name}</DialogTitle>
          {customer.name_am && (
            <p className="text-sm text-muted-foreground font-ethiopic text-center">{customer.name_am}</p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          {/* Profile Photo */}
          <div className="text-center">
            <Avatar className="w-28 h-28 mx-auto border-2 border-border">
              <AvatarImage src={customer.photo_url || undefined} alt={customer.name} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            {customer.photo_url && (
              <a href={customer.photo_url} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                <Download className="w-3 h-3" /> Download Photo
              </a>
            )}
          </div>

          {/* Key Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5" />
              <span>{formatPhone ? formatPhone(customer.phone) : customer.phone}</span>
            </div>
            {customer.alt_phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{customer.alt_phone}</span>
              </div>
            )}
            {(customer.city || customer.sub_city) && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{[customer.city, customer.sub_city, customer.woreda, customer.kebele].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Trust & Balance */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={cn('w-4 h-4', i < trust ? 'text-warning fill-warning' : 'text-muted-foreground/30')} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">Trust</span>
            </div>
            {(customer.credit_balance ?? 0) > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                Credit: {formatETB(customer.credit_balance!)}
              </Badge>
            )}
          </div>

          {/* Guarantor */}
          {customer.guarantor_name && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield className="w-3 h-3" /> Guarantor</p>
              <p className="text-sm font-medium text-foreground">{customer.guarantor_name}</p>
              {customer.guarantor_phone && <p className="text-xs text-muted-foreground">{customer.guarantor_phone}</p>}
            </div>
          )}

          {/* Gov ID */}
          {customer.gov_id && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Gov ID:</span> {customer.gov_id}
            </div>
          )}

          {/* ID Documents */}
          <div className="grid grid-cols-2 gap-3">
            {customer.id_document_url && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">ID Front</p>
                <img src={customer.id_document_url} alt="ID Front" className="w-full h-24 object-cover rounded-lg border border-border" />
                <a href={customer.id_document_url} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-1 text-[10px] text-primary mt-1 hover:underline">
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            )}
            {customer.id_document_back_url && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">ID Back</p>
                <img src={customer.id_document_back_url} alt="ID Back" className="w-full h-24 object-cover rounded-lg border border-border" />
                <a href={customer.id_document_back_url} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-1 text-[10px] text-primary mt-1 hover:underline">
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            )}
          </div>

          {!customer.id_document_url && !customer.id_document_back_url && (
            <p className="text-xs text-muted-foreground text-center">No ID documents uploaded</p>
          )}

          {/* Notes */}
          {customer.notes && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="font-medium mb-1">Notes:</p>
              <p>{customer.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
