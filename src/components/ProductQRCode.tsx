import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode } from 'lucide-react';
import { formatETB } from '@/lib/ethiopian';

interface ProductQRProps {
  product: {
    id: string;
    name: string;
    name_am?: string | null;
    price: number;
    unit: string;
    category: string;
    barcode?: string | null;
  };
}

export default function ProductQRCode({ product }: ProductQRProps) {
  const qrData = JSON.stringify({
    id: product.id,
    name: product.name,
    name_am: product.name_am || '',
    price: product.price,
    unit: product.unit,
    category: product.category,
    barcode: product.barcode || '',
  });

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=300,height=400');
    if (!w) return;
    const svg = document.getElementById(`qr-${product.id}`)?.outerHTML || '';
    w.document.write(`<html><head><title>QR - ${product.name}</title>
      <style>body{font-family:monospace;text-align:center;padding:20px;margin:0;}
      .name{font-size:14px;font-weight:bold;margin:10px 0 4px;}
      .price{font-size:18px;font-weight:bold;margin:8px 0;}
      .unit{font-size:11px;color:#666;}
      svg{width:180px;height:180px;}
      </style></head><body>
      ${svg}
      <div class="name">${product.name}</div>
      ${product.name_am ? `<div class="unit">${product.name_am}</div>` : ''}
      <div class="price">${formatETB(product.price)}</div>
      <div class="unit">per ${product.unit}</div>
      <script>window.print();window.close();</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Product QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4">
          <QRCodeSVG id={`qr-${product.id}`} value={qrData} size={180} level="M" />
          <p className="font-semibold text-foreground">{product.name}</p>
          {product.name_am && <p className="text-xs font-ethiopic text-muted-foreground">{product.name_am}</p>}
          <p className="text-lg font-bold text-primary">{formatETB(product.price)} / {product.unit}</p>
          <Button onClick={handlePrint} size="sm" className="gap-1.5 gradient-primary text-primary-foreground">
            <QrCode className="w-3.5 h-3.5" /> Print QR Label
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
