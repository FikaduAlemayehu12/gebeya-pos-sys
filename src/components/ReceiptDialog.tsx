import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatETB } from '@/lib/ethiopian';
import { Printer, X, Download, Share2, Mail, Phone } from 'lucide-react';
import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ReceiptItem {
  name: string;
  name_am?: string | null;
  quantity: number;
  price: number;
  unit: string;
}

interface ReceiptData {
  receiptId: string;
  items: ReceiptItem[];
  subtotal: number;
  vat: number;
  total: number;
  paymentMethod: string;
  date: Date;
  customerName?: string;
  dueDate?: string;
  buyerPhone?: string;
  buyerEmail?: string;
}

export default function ReceiptDialog({
  open,
  onClose,
  receipt,
}: {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const receiptUrl = receipt ? `${window.location.origin}/receipt/${encodeURIComponent(receipt.receiptId)}?total=${receipt.total}&business=GEBEYA%20POS` : '';

  const handlePrint = () => {
    if (!printRef.current) return;
    const qrEl = document.getElementById('receipt-qr-print');
    const qrSvg = qrEl?.outerHTML || '';
    const w = window.open('', '_blank', 'width=320,height=600');
    if (!w) return;
    w.document.write(`
      <html><head><title>Receipt</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 4mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .am { font-family: 'Nyala', 'Abyssinica SIL', sans-serif; }
        .qr { text-align: center; margin: 8px 0; }
        .qr svg { width: 100px; height: 100px; }
        .cut { border-top: 2px dashed #000; margin: 8px 0; }
        .total-row { font-size: 14px; font-weight: bold; }
        .credit-info { background: #f5f5f5; padding: 4px; margin: 4px 0; border-radius: 2px; }
        .label { color: #666; font-size: 11px; }
      </style></head><body>
      ${printRef.current.innerHTML}
      <div class="qr">${qrSvg}</div>
      <p class="center" style="font-size:9px;color:#666;">Scan to view receipt online</p>
      <div class="cut"></div>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
      </body></html>
    `);
    w.document.close();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${receipt?.receiptId}`,
          text: `Receipt from GEBEYA POS - Total: ${formatETB(receipt?.total || 0)}`,
          url: receiptUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(receiptUrl);
    }
  };

  if (!receipt) return null;

  const pmLabels: Record<string, string[]> = {
    cash: ['Cash', 'ጥሬ ገንዘብ'],
    telebirr: ['Telebirr', 'ቴሌብር'],
    cbe_birr: ['CBE Birr', 'CBE ብር'],
    bank_transfer: ['Bank Transfer', 'የባንክ ዝውውር'],
    credit: ['Credit', 'ብድር'],
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> Receipt / ደረሰኝ
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-0 text-xs font-mono">
          {/* Header */}
          <div className="text-center pb-2">
            <p className="font-bold text-base">GEBEYA POS</p>
            <p className="am text-muted-foreground font-ethiopic text-sm">የገበያ ሥርዓት</p>
          </div>

          <div className="space-y-0.5 text-center text-muted-foreground text-[11px]">
            <p>Transaction ID: {receipt.receiptId}</p>
            <p>Date: {receipt.date.toLocaleString()}</p>
          </div>

          {/* Buyer info */}
          {(receipt.customerName || receipt.buyerPhone || receipt.buyerEmail) && (
            <>
              <div className="border-t border-dashed border-border my-2" />
              <div className="space-y-0.5 text-[11px]">
                {receipt.customerName && <p className="text-foreground">Customer: {receipt.customerName}</p>}
                {receipt.buyerPhone && <p className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {receipt.buyerPhone}</p>}
                {receipt.buyerEmail && <p className="text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {receipt.buyerEmail}</p>}
              </div>
            </>
          )}

          <div className="border-t border-dashed border-border my-3" />

          {/* Items */}
          {receipt.items.map((item, i) => (
            <div key={i} className="mb-2">
              <p className="font-medium text-foreground">Item: {item.name}</p>
              {item.name_am && <p className="am text-muted-foreground text-[11px] font-ethiopic">{item.name_am}</p>}
              <p className="text-muted-foreground">Price: {formatETB(item.price * item.quantity)}</p>
              <p className="text-muted-foreground text-[10px]">{item.quantity} × {formatETB(item.price)} / {item.unit}</p>
              {i < receipt.items.length - 1 && (
                <div className="border-t border-dashed border-border my-2" />
              )}
            </div>
          ))}

          <div className="border-t border-dashed border-border my-3" />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal / ንዑስ ድምር</span>
              <span>{formatETB(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT 15% / ተ.እ.ታ</span>
              <span>{formatETB(receipt.vat)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border my-2" />

          <div className="flex justify-between font-bold text-sm text-foreground">
            <span>Total / ጠቅላላ</span>
            <span>{formatETB(receipt.total)}</span>
          </div>

          <div className="border-t border-dashed border-border my-3" />

          {/* Payment method */}
          <div className="text-center space-y-0.5">
            <p className="text-muted-foreground text-[11px]">Payment Method / የክፍያ ዘዴ</p>
            <p className="font-medium text-foreground">
              {pmLabels[receipt.paymentMethod]?.[0] || receipt.paymentMethod} / {pmLabels[receipt.paymentMethod]?.[1] || ''}
            </p>
          </div>

          {/* Credit info */}
          {receipt.paymentMethod === 'credit' && receipt.customerName && (
            <>
              <div className="border-t border-dashed border-border my-3" />
              <div className="p-2 bg-muted/50 rounded text-center">
                <p className="font-medium text-foreground">CREDIT SALE / የብድር ሽያጭ</p>
                <p className="text-muted-foreground">Customer: {receipt.customerName}</p>
                {receipt.dueDate && (
                  <p className="text-muted-foreground">Due Date: {new Date(receipt.dueDate).toLocaleDateString()}</p>
                )}
              </div>
            </>
          )}

          <div className="border-t border-dashed border-border my-3" />

          {/* Footer */}
          <div className="text-center space-y-0.5">
            <p className="font-medium text-foreground">Thank you! / እናመሰግናለን!</p>
            <p className="text-muted-foreground text-[11px]">It's great to see you again.</p>
            <p className="am text-muted-foreground text-[11px] font-ethiopic">ዳግመኛ መመለስዎን ማየት ደስ ይለናል🙏!</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 py-2">
          <QRCodeSVG id="receipt-qr-print" value={receiptUrl} size={100} level="M" />
          <p className="text-[10px] text-muted-foreground">Scan to view receipt online</p>
        </div>

        <div className="flex gap-2 mt-2">
          <Button onClick={handlePrint} className="flex-1 gradient-primary text-primary-foreground gap-1.5">
            <Printer className="w-4 h-4" /> Print / ያትሙ
          </Button>
          <Button variant="outline" onClick={handleShare} className="gap-1.5" title="Share receipt link">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="w-4 h-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
