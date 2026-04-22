import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Phone, Mail, CheckCircle } from 'lucide-react';

interface BuyerInfo {
  name: string;
  phone: string;
  email: string;
}

interface BuyerInfoFormProps {
  onConfirm: (info: BuyerInfo) => void;
  onSkip: () => void;
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
}

export default function BuyerInfoForm({ onConfirm, onSkip, defaultName = '', defaultPhone = '', defaultEmail = '' }: BuyerInfoFormProps) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <User className="w-3.5 h-3.5" />
        Buyer Info / የገዢ መረጃ
      </p>
      <p className="text-[10px] text-muted-foreground">Fill in to send receipt via SMS/Email</p>

      <div className="space-y-2">
        <div>
          <Label className="text-[10px]">Name / ስም</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0911234567" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email" className="h-8 text-xs" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 gradient-primary text-primary-foreground text-xs h-8 gap-1"
          onClick={() => onConfirm({ name, phone, email })}
        >
          <CheckCircle className="w-3 h-3" /> Confirm & Complete
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}
