import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatETB, PAYMENT_METHODS } from '@/lib/ethiopian';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search, Plus, Minus, ShoppingCart, Banknote, Smartphone,
  CreditCard, Building2, HandCoins, X, Loader2, CheckCircle, ScanBarcode, Eye, ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ReceiptDialog from '@/components/ReceiptDialog';
import CreditCustomerSelector from '@/components/CreditCustomerSelector';
import CustomerProfileDialog from '@/components/CustomerProfileDialog';
import BuyerInfoForm from '@/components/BuyerInfoForm';
import { logActivity } from '@/lib/activityLogger';
import { useCurrency } from '@/contexts/CurrencyContext';

const ICON_MAP: Record<string, any> = {
  Banknote, Smartphone, CreditCard, Building2, HandCoins
};

interface Product {
  id: string;
  name: string;
  name_am: string | null;
  price: number;
  unit: string;
  category: string;
  stock: number;
  barcode: string | null;
  image_url?: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function POS() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { formatMoney, currency } = useCurrency();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<string>('cash');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showCreditSelector, setShowCreditSelector] = useState(false);
  const [showBuyerInfo, setShowBuyerInfo] = useState(false);
  const [scannerMode, setScannerMode] = useState(false);
  const [viewCustomerProfile, setViewCustomerProfile] = useState<any>(null);
  const barcodeBufferRef = useRef('');
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, name_am, price, unit, category, stock, barcode, image_url')
        .gt('stock', 0)
        .order('name');
      setProducts((data as Product[]) || []);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const handleBarcodeProduct = useCallback((scanned: string) => {
    try {
      const qrData = JSON.parse(scanned);
      if (qrData.id) {
        const product = products.find(p => p.id === qrData.id);
        if (product) {
          addToCart(product);
          toast({ title: '📱 QR Scanned', description: `${product.name} added to cart` });
          return;
        }
      }
    } catch {
      // Not JSON, treat as barcode
    }

    const product = products.find(p => p.barcode === scanned);
    if (product) {
      addToCart(product);
      toast({ title: '🔊 Scanned', description: `${product.name} added to cart` });
    } else {
      toast({ title: 'Product not found', description: `No product with barcode: ${scanned}`, variant: 'destructive' });
    }
  }, [products]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter' && barcodeBufferRef.current.length >= 3) {
        e.preventDefault();
        handleBarcodeProduct(barcodeBufferRef.current.trim());
        barcodeBufferRef.current = '';
        return;
      }

      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = setTimeout(() => {
          barcodeBufferRef.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBarcodeProduct]);

  const addToCart = (product: Product) => {
    const inCart = cart.find(i => i.product.id === product.id);
    const currentQty = inCart ? inCart.quantity : 0;
    if (currentQty >= product.stock) {
      toast({ title: 'Out of stock', description: `Only ${product.stock} available.`, variant: 'destructive' });
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== id) return i;
      const newQty = Math.max(0, i.quantity + delta);
      if (newQty > i.product.stock) return i;
      return { ...i, quantity: newQty };
    }).filter(i => i.quantity > 0));
  };

  const setQty = (id: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(i => {
      if (i.product.id !== id) return i;
      const clamped = Math.min(qty, i.product.stock);
      return { ...i, quantity: clamped };
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.product.id !== id));

  const subtotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const completeSale = async (creditCustomer?: { id: string; name: string }, creditDueDate?: string, buyerInfo?: { name: string; phone: string; email: string }) => {
    if (cart.length === 0) return;
    setCompleting(true);
    setShowCreditSelector(false);
    setShowBuyerInfo(false);

    const receiptId = `TXN-${Date.now().toString(36).toUpperCase()}`;
    const isCredit = selectedPayment === 'credit';

    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          receipt_id: receiptId,
          cashier_id: (await supabase.auth.getUser()).data.user?.id,
          subtotal,
          vat,
          total,
          payment_method: selectedPayment,
          customer_id: creditCustomer?.id || null,
        })
        .select('id')
        .single();

      if (saleError) throw saleError;

      const saleItems = cart.map(i => ({
        sale_id: saleData.id,
        product_id: i.product.id,
        product_name: i.product.name,
        product_name_am: i.product.name_am,
        quantity: i.quantity,
        unit_price: i.product.price,
        total: i.product.price * i.quantity,
      }));
      await supabase.from('sale_items').insert(saleItems);

      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id);
      }

      if (isCredit && creditCustomer && creditDueDate) {
        await supabase.from('credit_sales').insert({
          sale_id: saleData.id,
          customer_id: creditCustomer.id,
          total_amount: total,
          paid_amount: 0,
          due_date: new Date(creditDueDate).toISOString(),
          status: 'active',
          currency: 'ETB',
        });

        const { data: custData } = await supabase.from('customers').select('credit_balance').eq('id', creditCustomer.id).single();
        if (custData) {
          await supabase.from('customers').update({
            credit_balance: Number(custData.credit_balance || 0) + total,
          }).eq('id', creditCustomer.id);
        }

        const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
        if (adminRoles) {
          const notifications = adminRoles.map((r: any) => ({
            user_id: r.user_id,
            title: `New Credit Sale: ${creditCustomer.name}`,
            message: `${creditCustomer.name} bought on credit for ${formatETB(total)}. Due: ${creditDueDate}`,
            type: 'credit_new',
            related_id: saleData.id,
          }));
          await supabase.from('notifications').insert(notifications);
        }
      }

      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(i => i.product.id === p.id);
        if (cartItem) return { ...p, stock: p.stock - cartItem.quantity };
        return p;
      }).filter(p => p.stock > 0));

      const receiptPayload = {
        receiptId,
        items: cart.map(i => ({ name: i.product.name, name_am: i.product.name_am, quantity: i.quantity, price: i.product.price, unit: i.product.unit })),
        subtotal, vat, total,
        paymentMethod: selectedPayment,
        date: new Date(),
        customerName: creditCustomer?.name || buyerInfo?.name,
        dueDate: creditDueDate,
        buyerPhone: buyerInfo?.phone,
        buyerEmail: buyerInfo?.email,
      };
      setReceiptData(receiptPayload);
      setShowReceipt(true);

      // Log activity
      await logActivity(
        isCredit ? 'credit_sale_created' : 'sale_created',
        `Sale ${receiptId}: ${formatETB(total)} via ${selectedPayment}${creditCustomer ? ` (${creditCustomer.name})` : ''} — ${cart.length} item(s)`,
        { items: cart.map(i => ({ name: i.product.name, qty: i.quantity, price: i.product.price })), paymentMethod: selectedPayment },
        { saleId: saleData.id, customerId: creditCustomer?.id, amount: total }
      );

      // Send SMS if buyer phone provided
      if (buyerInfo?.phone) {
        const receiptUrl = `${window.location.origin}/receipt/${encodeURIComponent(receiptId)}`;
        supabase.functions.invoke('send-sms', {
          body: {
            to: buyerInfo.phone.startsWith('+') ? buyerInfo.phone : `+251${buyerInfo.phone.replace(/^0/, '')}`,
            message: `Thank you for your purchase at GEBEYA POS! Receipt: ${receiptUrl} Total: ${formatETB(total)}`,
          },
        }).catch(() => {}); // fire and forget
      }

      toast({
        title: '✅ Sale Complete!',
        description: `${receiptId} • ${formatETB(total)} via ${selectedPayment}${creditCustomer ? ` • ${creditCustomer.name}` : ''} • ${cart.length} item(s)`,
      });

      setCart([]);
    } catch (err: any) {
      toast({ title: 'Sale failed', description: err.message, variant: 'destructive' });
    } finally {
      setCompleting(false);
    }
  };

  const handlePaymentSelect = (pmId: string) => {
    setSelectedPayment(pmId);
    setShowCreditSelector(pmId === 'credit');
    setShowBuyerInfo(false);
  };

  const handleCreditCustomerSelect = (customer: any, dueDate: string) => {
    completeSale(customer, dueDate);
  };

  const handleCompleteSaleClick = () => {
    if (cart.length === 0) return;
    setShowBuyerInfo(true);
  };

  const filteredProducts = products.filter(p =>
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.name_am || '').includes(search))
  );

  const categories = ['All', ...new Set(products.map(p => p.category))];

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-7rem)] lg:h-[calc(100vh-7rem)]">
      {/* Products */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Point of Sale</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">ሽያጭ ማስተናገጃ</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder={scannerMode ? "Scan barcode... / ባርኮድ ይቃኙ..." : "Search products... / ፈልግ..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (scannerMode && e.key === 'Enter' && search.length >= 3) {
                  e.preventDefault();
                  handleBarcodeProduct(search.trim());
                  setSearch('');
                }
              }}
              className="pl-9"
            />
          </div>
          <Button
            variant={scannerMode ? 'default' : 'outline'}
            size="icon"
            onClick={() => {
              setScannerMode(!scannerMode);
              if (!scannerMode) searchInputRef.current?.focus();
            }}
            title="Toggle barcode scanner mode"
          >
            <ScanBarcode className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No products available. Add products in Inventory first.</p>
            </div>
          ) : (
            filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-card rounded-xl p-4 text-left stat-card-shadow hover:ring-2 hover:ring-primary/30 transition-all group"
              >
                {product.image_url ? (
                  <div className="w-full h-20 rounded-lg overflow-hidden mb-2">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-[10px]">{product.category}</Badge>
                    {product.stock <= 5 && (
                      <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    )}
                  </div>
                )}
                {product.image_url && (
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px]">{product.category}</Badge>
                    {product.stock <= 5 && (
                      <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    )}
                  </div>
                )}
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{product.name}</p>
                {product.name_am && <p className="text-[11px] font-ethiopic text-muted-foreground">{product.name_am}</p>}
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-base font-bold text-primary">{formatMoney(product.price)}</p>
                  <p className="text-[10px] text-muted-foreground">/{product.unit}</p>
                </div>
                {currency !== 'ETB' && (
                  <p className="text-[10px] text-muted-foreground tabular-nums">≈ ETB {Number(product.price).toFixed(2)}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">Stock: {product.stock}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Cart */}
      <Card className="w-full lg:w-96 flex flex-col bg-card shrink-0 max-h-full">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Cart
            <span className="font-ethiopic text-xs text-muted-foreground ml-1">ጋሪ</span>
            {cart.length > 0 && (
              <Badge className="ml-auto bg-primary text-primary-foreground text-[10px]">{cart.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <div className="flex-1 overflow-y-auto px-6 divide-y divide-border">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-[11px] font-ethiopic">ጋሪው ባዶ ነው</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(item.product.price)} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-md bg-muted flex items-center justify-center hover:bg-accent">
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => setQty(item.product.id, parseInt(e.target.value) || 0)}
                      className="w-14 h-7 text-center text-sm font-semibold bg-muted rounded-md border-0 focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={1}
                      max={item.product.stock}
                    />
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-md bg-muted flex items-center justify-center hover:bg-accent">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeFromCart(item.product.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-destructive hover:bg-destructive/10 ml-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-4 space-y-4 shrink-0">
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_METHODS.map(pm => {
                const Icon = ICON_MAP[pm.icon];
                return (
                  <button
                    key={pm.id}
                    onClick={() => handlePaymentSelect(pm.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-all',
                      selectedPayment === pm.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="truncate w-full text-center">
                      {pm.id === 'bank_transfer' ? 'Bank' : pm.id === 'cbe_birr' ? 'CBE' : pm.id === 'credit' ? 'Credit' : pm.id.charAt(0).toUpperCase() + pm.id.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Credit customer selector */}
            {showCreditSelector && cart.length > 0 && (
              <CreditCustomerSelector
                total={total}
                onSelectCustomer={handleCreditCustomerSelect}
                onAddNewCustomer={() => navigate('/customers')}
              />
            )}

            {/* Buyer info form */}
            {showBuyerInfo && !showCreditSelector && cart.length > 0 && (
              <BuyerInfoForm
                onConfirm={(info) => completeSale(undefined, undefined, info)}
                onSkip={() => completeSale()}
              />
            )}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>VAT (15%)</span>
                <span>{formatMoney(vat)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
              {currency !== 'ETB' && (
                <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Recorded as</span>
                  <span className="tabular-nums">{formatETB(total)}</span>
                </div>
              )}
            </div>

            {selectedPayment !== 'credit' && !showBuyerInfo && (
              <Button
                className="w-full gradient-primary text-primary-foreground font-semibold h-11"
                disabled={cart.length === 0 || completing}
                onClick={handleCompleteSaleClick}
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Complete Sale • ሽያጩን ያጠናቅቁ
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ReceiptDialog open={showReceipt} onClose={() => setShowReceipt(false)} receipt={receiptData} />
      <CustomerProfileDialog customer={viewCustomerProfile} open={!!viewCustomerProfile} onOpenChange={o => !o && setViewCustomerProfile(null)} />
    </div>
  );
}
