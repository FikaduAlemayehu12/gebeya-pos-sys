import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { formatETB } from '@/lib/ethiopian';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, CheckCircle, CreditCard, Smartphone, Building2, Banknote, Download, Printer, Phone, Mail, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface SaleItem {
  product_name: string;
  product_name_am: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export default function TransactionView() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [creditSale, setCreditSale] = useState<any>(null);
  const [cashier, setCashier] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!receiptId) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-receipt?receipt_id=${encodeURIComponent(receiptId)}`,
          { headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' } }
        );
        if (res.ok) {
          const data = await res.json();
          setSale(data.sale);
          setItems((data.items || []) as SaleItem[]);
          setCreditSale(data.creditSale);
          setCashier(data.cashier);
          setCustomer(data.customer);
        }
      } catch (err) {
        console.error('Failed to fetch receipt:', err);
      }
      setLoading(false);
    };
    fetchTransaction();
  }, [receiptId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!receiptRef.current) return;
    const w = window.open('', '_blank', 'width=400,height=700');
    if (!w) return;
    w.document.write(`
      <html><head><title>Receipt ${sale?.receipt_id}</title>
      <style>
        @page { margin: 10mm; size: 80mm auto; }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .am { font-family: 'Nyala', 'Abyssinica SIL', sans-serif; }
      </style></head><body>
      ${receiptRef.current.innerHTML}
      <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
      </body></html>
    `);
    w.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h1 className="text-xl font-bold text-foreground">Transaction Not Found</h1>
          <p className="text-sm text-muted-foreground mt-2">Receipt ID: {receiptId}</p>
        </div>
      </div>
    );
  }

  const pmLabels: Record<string, string[]> = {
    cash: ['Cash', 'ጥሬ ገንዘብ'], telebirr: ['Telebirr', 'ቴሌብር'],
    cbe_birr: ['CBE Birr', 'CBE ብር'], bank_transfer: ['Bank Transfer', 'የባንክ ዝውውር'],
    credit: ['Credit', 'ብድር'],
  };

  const isPaid = sale.payment_method !== 'credit' || (creditSale && Number(creditSale.paid_amount) >= Number(creditSale.total_amount));
  // Encode receipt data directly into QR code
  const qrData = JSON.stringify({
    receipt: sale.receipt_id,
    date: sale.created_at,
    items: items.map(i => ({ n: i.product_name, q: i.quantity, p: Number(i.unit_price), t: Number(i.total) })),
    subtotal: Number(sale.subtotal),
    vat: Number(sale.vat),
    total: Number(sale.total),
    method: sale.payment_method,
    ...(customer ? { customer: customer.name } : {}),
    ...(creditSale ? { credit: { paid: Number(creditSale.paid_amount), due: creditSale.due_date } } : {}),
  });

  const paymentOptions = [
    { id: 'telebirr', label: 'Telebirr / ቴሌብር', icon: Smartphone, account: '0916690051' },
    { id: 'cbe_birr', label: 'CBE Birr', icon: CreditCard, account: '1000376533577' },
    { id: 'cash', label: 'Cash / ጥሬ ገንዘብ', icon: Banknote, account: null },
    { id: 'bank_transfer', label: 'Bank Transfer / የባንክ ዝውውር', icon: Building2, account: null },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 flex flex-col items-center">
      {/* Action buttons */}
      <div className="w-full max-w-md flex gap-2 mb-4 print:hidden">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5" /> Print / ያትሙ
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleDownload}>
          <Download className="w-3.5 h-3.5" /> Download
        </Button>
      </div>

      <Card className="w-full max-w-md bg-card">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg flex items-center justify-center gap-2">
            <Receipt className="w-5 h-5" /> GEBEYA POS
          </CardTitle>
          <p className="text-xs font-ethiopic text-muted-foreground">የገበያ ሥርዓት</p>
        </CardHeader>
        <CardContent className="space-y-0 font-mono text-xs" ref={receiptRef}>
          {/* Status */}
          <div className="text-center mb-3">
            {isPaid ? (
              <Badge className="bg-green-600 text-white gap-1 text-sm px-4 py-1">
                <CheckCircle className="w-4 h-4" /> PAID / ተከፍሏል
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1 text-sm px-4 py-1">
                UNPAID / ያልተከፈለ
              </Badge>
            )}
          </div>

          {/* Transaction info */}
          <div className="text-center space-y-0.5 text-muted-foreground text-[11px]">
            <p>Receipt No: {sale.receipt_id}</p>
            <p className="flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(sale.created_at).toLocaleString()}
            </p>
            {cashier?.full_name && <p>Cashier: {cashier.full_name}</p>}
          </div>

          {/* Customer info */}
          {customer && (
            <>
              <div className="border-t border-dashed border-border my-2" />
              <div className="space-y-0.5 text-[11px]">
                <p className="text-foreground font-medium">Customer: {customer.name}</p>
                {customer.phone && <p className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</p>}
                {customer.email && <p className="text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</p>}
              </div>
            </>
          )}

          <div className="border-t border-dashed border-border my-3" />

          {/* Items with details */}
          {items.map((item, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between">
                <p className="font-medium text-foreground">{item.product_name}</p>
                <p className="font-medium text-foreground">{formatETB(Number(item.total))}</p>
              </div>
              {item.product_name_am && <p className="text-[11px] font-ethiopic text-muted-foreground">{item.product_name_am}</p>}
              <p className="text-muted-foreground text-[10px]">{item.quantity} × {formatETB(Number(item.unit_price))}</p>
              {i < items.length - 1 && <div className="border-t border-dashed border-border my-2" />}
            </div>
          ))}

          <div className="border-t border-dashed border-border my-3" />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal / ንዑስ ድምር</span>
              <span>{formatETB(Number(sale.subtotal))}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT 15% / ተ.እ.ታ</span>
              <span>{formatETB(Number(sale.vat))}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border my-2" />

          <div className="flex justify-between font-bold text-sm text-foreground">
            <span>Total / ጠቅላላ</span>
            <span>{formatETB(Number(sale.total))}</span>
          </div>

          <div className="border-t border-dashed border-border my-3" />

          {/* Payment */}
          <div className="text-center space-y-0.5">
            <p className="text-muted-foreground text-[11px]">Payment Method / የክፍያ ዘዴ</p>
            <p className="font-medium text-foreground">
              {pmLabels[sale.payment_method]?.[0] || sale.payment_method} / {pmLabels[sale.payment_method]?.[1] || ''}
            </p>
          </div>

          {/* Credit info */}
          {creditSale && (
            <>
              <div className="border-t border-dashed border-border my-3" />
              <div className="p-2 bg-muted/50 rounded text-center space-y-1">
                <p className="font-medium text-foreground">CREDIT SALE / የብድር ሽያጭ</p>
                <p className="text-muted-foreground">Customer: {(creditSale as any).customers?.name}</p>
                <p className="text-muted-foreground">
                  Paid: {formatETB(Number(creditSale.paid_amount))} / {formatETB(Number(creditSale.total_amount))}
                </p>
                <p className="text-muted-foreground">Due: {new Date(creditSale.due_date).toLocaleDateString()}</p>
              </div>
            </>
          )}

          {/* Payment options for unpaid */}
          {!isPaid && (
            <>
              <div className="border-t border-dashed border-border my-3" />
              <div className="space-y-2">
                <p className="text-center font-medium text-foreground text-sm">Pay Now / አሁን ይክፈሉ</p>
                <p className="text-center text-muted-foreground text-[11px]">
                  Remaining: {formatETB(Number(creditSale?.total_amount || sale.total) - Number(creditSale?.paid_amount || 0))}
                </p>
                <div className="space-y-2">
                  {paymentOptions.map(opt => (
                    <div key={opt.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <opt.icon className="w-4 h-4 text-primary" />
                        <span className="font-medium text-foreground text-xs">{opt.label}</span>
                      </div>
                      {opt.account && (
                        <div className="bg-muted/50 rounded p-2 mt-1">
                          <p className="text-[10px] text-muted-foreground">Account:</p>
                          <p className="font-bold text-foreground text-sm tracking-wider select-all">{opt.account}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Amount: <span className="font-bold text-foreground">{formatETB(Number(creditSale?.total_amount || sale.total) - Number(creditSale?.paid_amount || 0))}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-dashed border-border my-3" />

          {/* QR Code */}
          <div className="flex flex-col items-center gap-1 py-2">
            <QRCodeSVG value={qrData} size={100} level="L" />
            <p className="text-[10px] text-muted-foreground">Scan for receipt details / ለደረሰኝ ዝርዝር ይቃኙ</p>
          </div>

          <div className="border-t border-dashed border-border my-3" />

          {/* Footer */}
          <div className="text-center space-y-0.5">
            <p className="font-medium text-foreground">Thank you! / እናመሰግናለን!</p>
            <p className="text-muted-foreground text-[11px]">It's great to see you again.</p>
            <p className="text-muted-foreground text-[11px] font-ethiopic">ዳግመኛ መመለስዎን ማየት ደስ ይለናል🙏!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
