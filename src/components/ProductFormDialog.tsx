import { useState, useEffect } from 'react';
import { PRODUCT_CATEGORIES, ETHIOPIAN_UNITS } from '@/lib/ethiopian';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2, Barcode, AlertTriangle, Upload, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activityLogger';

interface Variant {
  name: string;
  price: number;
  stock: number;
}

interface ProductFormDialogProps {
  onSuccess: () => void;
  editProduct?: {
    id: string;
    name: string;
    name_am: string | null;
    category: string;
    barcode: string | null;
    price: number;
    cost: number;
    stock: number;
    min_stock: number;
    unit: string;
    expiry_date: string | null;
    description?: string | null;
    variants: any;
    image_url?: string | null;
  } | null;
}

export default function ProductFormDialog({ onSuccess, editProduct }: ProductFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicateFound, setDuplicateFound] = useState<{ id: string; name: string; stock: number; price: number } | null>(null);

  const [name, setName] = useState('');
  const [nameAm, setNameAm] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unit, setUnit] = useState('Piece');
  const [expiryDate, setExpiryDate] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantStock, setVariantStock] = useState('');

  useEffect(() => {
    if (editProduct && open) {
      setName(editProduct.name);
      setNameAm(editProduct.name_am || '');
      setCategory(editProduct.category);
      setBarcode(editProduct.barcode || '');
      setPrice(String(editProduct.price));
      setCost(String(editProduct.cost));
      setStock(String(editProduct.stock));
      setMinStock(String(editProduct.min_stock));
      setUnit(editProduct.unit);
      setExpiryDate(editProduct.expiry_date || '');
      setDescription(editProduct.description || '');
      setImageUrl(editProduct.image_url || '');
      setVariants(Array.isArray(editProduct.variants) ? editProduct.variants : []);
    }
  }, [editProduct, open]);

  const resetForm = () => {
    setName(''); setNameAm(''); setCategory(''); setBarcode('');
    setPrice(''); setCost(''); setStock(''); setMinStock('');
    setUnit('Piece'); setExpiryDate(''); setDescription(''); setImageUrl('');
    setVariants([]); setVariantName(''); setVariantPrice(''); setVariantStock('');
    setDuplicateFound(null);
  };

  useEffect(() => {
    if (editProduct) return;
    const timer = setTimeout(async () => {
      if (!name.trim() && !barcode.trim()) { setDuplicateFound(null); return; }
      let query = supabase.from('products').select('id, name, stock, price');
      if (barcode.trim()) {
        query = query.eq('barcode', barcode.trim());
      } else {
        query = query.ilike('name', name.trim());
      }
      const { data } = await query.limit(1);
      if (data && data.length > 0) {
        setDuplicateFound(data[0]);
      } else {
        setDuplicateFound(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [name, barcode, editProduct]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const path = `products/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } else {
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
    }
    setUploadingImage(false);
  };

  const addVariant = () => {
    if (!variantName.trim()) return;
    setVariants([...variants, { name: variantName, price: Number(variantPrice) || 0, stock: Number(variantStock) || 0 }]);
    setVariantName(''); setVariantPrice(''); setVariantStock('');
  };

  const removeVariant = (idx: number) => setVariants(variants.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category) {
      toast({ title: 'Missing fields', description: 'Name and category are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const productData = {
      name: name.trim(),
      name_am: nameAm.trim(),
      category,
      barcode: barcode.trim() || null,
      price: Number(price) || 0,
      cost: Number(cost) || 0,
      stock: Number(stock) || 0,
      min_stock: Number(minStock) || 0,
      unit,
      expiry_date: expiryDate || null,
      variants: variants.length > 0 ? JSON.parse(JSON.stringify(variants)) : [],
      description: description.trim(),
      image_url: imageUrl || '',
    };

    try {
      if (editProduct) {
        const { error } = await supabase.from('products').update(productData).eq('id', editProduct.id);
        if (error) throw error;
        await logActivity('product_updated', `Updated product: ${name}`, { productId: editProduct.id }, { productId: editProduct.id });
        toast({ title: 'Product updated!', description: `${name} has been updated.` });
      } else if (duplicateFound) {
        const { error } = await supabase.from('products').update({
          ...productData,
          stock: duplicateFound.stock + (Number(stock) || 0),
        }).eq('id', duplicateFound.id);
        if (error) throw error;
        await logActivity('stock_adjusted', `Stock +${stock} for ${duplicateFound.name}`, { productId: duplicateFound.id, added: Number(stock) }, { productId: duplicateFound.id });
        toast({ title: 'Stock updated!', description: `Added ${stock} to existing ${duplicateFound.name}.` });
      } else {
        const { data: inserted, error } = await supabase.from('products').insert([{ ...productData, created_by: user?.id }]).select('id').single();
        if (error) throw error;
        await logActivity('product_created', `Created product: ${name}`, { productId: inserted?.id }, { productId: inserted?.id });
        toast({ title: 'Product added!', description: `${name} has been registered.` });
      }
      resetForm();
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {editProduct ? (
          <Button size="sm" variant="outline" className="gap-1 text-xs">Edit</Button>
        ) : (
          <Button size="sm" className="gap-1.5 text-xs gradient-primary text-primary-foreground">
            <Plus className="w-3.5 h-3.5" /> Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProduct ? 'Edit Product / ምርት ያርትዑ' : 'Register New Product / አዲስ ምርት'}</DialogTitle>
        </DialogHeader>

        {duplicateFound && !editProduct && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Existing product found: {duplicateFound.name}</p>
              <p className="text-xs text-muted-foreground">Current stock: {duplicateFound.stock} • Price: ETB {duplicateFound.price}</p>
              <p className="text-xs text-warning mt-1">Submitting will update the existing product and add to its stock.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Image */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Product Image</Label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="Product" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                  {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                {imageUrl && (
                  <button type="button" onClick={() => setImageUrl('')} className="text-[10px] text-destructive hover:underline text-left">
                    Remove image
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. White Teff" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name (Amharic)</Label>
              <Input value={nameAm} onChange={e => setNameAm(e.target.value)} placeholder="ነጭ ጤፍ" className="font-ethiopic" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETHIOPIAN_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5" /> Barcode / UPC</Label>
            <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or enter barcode..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Selling Price (ETB) *</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cost Price (ETB)</Label>
              <Input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{duplicateFound && !editProduct ? 'Stock to Add' : 'Current Stock'}</Label>
              <Input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Min Stock Threshold</Label>
              <Input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Expiry Date</Label>
            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes..." />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Product Variants</Label>
            {variants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    {v.name} (ETB {v.price}) ×{v.stock}
                    <button type="button" onClick={() => removeVariant(i)}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input value={variantName} onChange={e => setVariantName(e.target.value)} placeholder="Variant name" className="flex-1 text-xs" />
              <Input type="number" value={variantPrice} onChange={e => setVariantPrice(e.target.value)} placeholder="Price" className="w-20 text-xs" />
              <Input type="number" value={variantStock} onChange={e => setVariantStock(e.target.value)} placeholder="Stock" className="w-20 text-xs" />
              <Button type="button" size="sm" variant="outline" onClick={addVariant}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
          </div>

          <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editProduct ? 'Update Product / ምርት ያዘምኑ' : duplicateFound ? 'Update Existing Stock / ክምችት ያዘምኑ' : 'Register Product / ምርት ይመዝግቡ'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
