import { useState, useEffect, useMemo } from 'react';
import { ETHIOPIAN_UNITS } from '@/lib/ethiopian';
import { CATEGORY_TEMPLATES, mergeTemplate, CategoryTemplate, CustomField } from '@/lib/inventory/categoryTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, X, Loader2, Barcode, AlertTriangle, Upload, ImageIcon, Sparkles, Tag, Layers,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activityLogger';

interface Variant { name: string; price: number; stock: number; }

interface ProductFormDialogProps {
  onSuccess: () => void;
  editProduct?: any | null;
  trigger?: React.ReactNode;
}

interface CategoryRow {
  id: string;
  name: string;
  name_am: string;
  slug: string;
  parent_id: string | null;
}

export default function ProductFormDialog({ onSuccess, editProduct, trigger }: ProductFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [duplicateFound, setDuplicateFound] = useState<{ id: string; name: string; stock: number; price: number } | null>(null);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [schemas, setSchemas] = useState<Record<string, any>>({});
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Core fields
  const [name, setName] = useState('');
  const [nameAm, setNameAm] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategory, setSubcategory] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [unit, setUnit] = useState('Piece');
  const [taxRate, setTaxRate] = useState('15');
  const [expiryDate, setExpiryDate] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [branchId, setBranchId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [storageConditions, setStorageConditions] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [trackBatch, setTrackBatch] = useState(false);
  const [trackSerial, setTrackSerial] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);

  const [attributes, setAttributes] = useState<Record<string, any>>({});
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantStock, setVariantStock] = useState('');

  const selectedCategory = categories.find(c => c.id === categoryId);
  const template: CategoryTemplate = useMemo(() => {
    if (!selectedCategory) return {};
    const base = CATEGORY_TEMPLATES[selectedCategory.slug];
    return mergeTemplate(base, schemas[selectedCategory.id]);
  }, [selectedCategory, schemas]);

  // Load metadata once dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      const [catsRes, schemaRes, branchRes, supRes] = await Promise.all([
        supabase.from('product_categories').select('id, name, name_am, slug, parent_id').eq('is_active', true).order('sort_order'),
        supabase.from('category_field_schemas').select('*'),
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
        supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (cancelled) return;
      setCategories((catsRes.data as CategoryRow[]) || []);
      const sm: Record<string, any> = {};
      (schemaRes.data || []).forEach((s: any) => { sm[s.category_id] = s; });
      setSchemas(sm);
      setBranches(branchRes.data || []);
      setSuppliers(supRes.data || []);
      setLoadingMeta(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Apply template defaults when category changes (only when not editing)
  useEffect(() => {
    if (editProduct || !template) return;
    if (template.defaultUnit) setUnit(template.defaultUnit);
    if (template.defaultTaxRate != null) setTaxRate(String(template.defaultTaxRate));
    if (template.defaultReorderPoint != null) setReorderPoint(String(template.defaultReorderPoint));
    if (template.storageConditions) setStorageConditions(template.storageConditions);
    if (template.defaultWarrantyMonths) setWarrantyMonths(String(template.defaultWarrantyMonths));
    setTrackExpiry(!!template.trackExpiry);
    setTrackBatch(!!template.trackBatch);
    setTrackSerial(!!template.trackSerial);
  }, [categoryId, template, editProduct]);

  // Hydrate when editing
  useEffect(() => {
    if (editProduct && open) {
      setName(editProduct.name || '');
      setNameAm(editProduct.name_am || '');
      setCategoryId(editProduct.category_id || '');
      setSubcategory(editProduct.subcategory || '');
      setSku(editProduct.sku || '');
      setBarcode(editProduct.barcode || '');
      setPrice(String(editProduct.price ?? ''));
      setCost(String(editProduct.cost ?? ''));
      setStock(String(editProduct.stock ?? ''));
      setMinStock(String(editProduct.min_stock ?? ''));
      setReorderPoint(String(editProduct.reorder_point ?? ''));
      setMaxStock(editProduct.max_stock != null ? String(editProduct.max_stock) : '');
      setUnit(editProduct.unit || 'Piece');
      setTaxRate(String(editProduct.tax_rate ?? 15));
      setExpiryDate(editProduct.expiry_date || '');
      setDescription(editProduct.description || '');
      setImageUrl(editProduct.image_url || '');
      setBranchId(editProduct.branch_id || '');
      setSupplierId(editProduct.supplier_id || '');
      setStorageConditions(editProduct.storage_conditions || '');
      setWarrantyMonths(String(editProduct.warranty_months || ''));
      setTrackBatch(!!editProduct.track_batch);
      setTrackSerial(!!editProduct.track_serial);
      setTrackExpiry(!!editProduct.track_expiry);
      setAttributes(editProduct.attributes || {});
      setVariants(Array.isArray(editProduct.variants) ? editProduct.variants : []);
    }
  }, [editProduct, open]);

  const resetForm = () => {
    setName(''); setNameAm(''); setCategoryId(''); setSubcategory(''); setSku('');
    setBarcode(''); setPrice(''); setCost(''); setStock(''); setMinStock('');
    setReorderPoint(''); setMaxStock(''); setUnit('Piece'); setTaxRate('15');
    setExpiryDate(''); setDescription(''); setImageUrl(''); setBranchId('');
    setSupplierId(''); setStorageConditions(''); setWarrantyMonths('');
    setTrackBatch(false); setTrackSerial(false); setTrackExpiry(false);
    setAttributes({}); setVariants([]);
    setVariantName(''); setVariantPrice(''); setVariantStock('');
    setDuplicateFound(null);
  };

  // Duplicate detection
  useEffect(() => {
    if (editProduct) return;
    const timer = setTimeout(async () => {
      if (!name.trim() && !barcode.trim()) { setDuplicateFound(null); return; }
      let query = supabase.from('products').select('id, name, stock, price');
      if (barcode.trim()) query = query.eq('barcode', barcode.trim());
      else query = query.ilike('name', name.trim());
      const { data } = await query.limit(1);
      setDuplicateFound(data && data.length > 0 ? (data[0] as any) : null);
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

  const updateAttr = (key: string, value: any) => setAttributes(a => ({ ...a, [key]: value }));

  const renderCustomField = (f: CustomField) => {
    const val = attributes[f.key] ?? '';
    const common = { id: `attr-${f.key}`, value: val, onChange: (e: any) => updateAttr(f.key, e.target.value) };
    if (f.type === 'select') return (
      <Select value={String(val || '')} onValueChange={v => updateAttr(f.key, v)}>
        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>{f.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
    if (f.type === 'boolean') return (
      <div className="flex items-center gap-2 pt-1">
        <Switch checked={!!val} onCheckedChange={v => updateAttr(f.key, v)} />
        <span className="text-xs text-muted-foreground">{val ? 'Yes' : 'No'}</span>
      </div>
    );
    if (f.type === 'textarea') return <Textarea {...common} placeholder={f.placeholder} rows={2} />;
    if (f.type === 'number' || f.type === 'currency') return <Input type="number" step="0.01" {...common} placeholder={f.placeholder} />;
    if (f.type === 'date') return <Input type="date" {...common} />;
    return <Input {...common} placeholder={f.placeholder} />;
  };

  const addVariant = () => {
    if (!variantName.trim()) return;
    setVariants([...variants, { name: variantName, price: Number(variantPrice) || 0, stock: Number(variantStock) || 0 }]);
    setVariantName(''); setVariantPrice(''); setVariantStock('');
  };
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: 'Missing fields', description: 'Product name is required.', variant: 'destructive' }); return; }
    // Required custom fields
    for (const f of (template.customFields || [])) {
      if (f.required && !attributes[f.key]) {
        toast({ title: `Missing: ${f.label}`, description: 'This field is required for this category.', variant: 'destructive' });
        return;
      }
    }
    setSaving(true);

    const productData: any = {
      name: name.trim(),
      name_am: nameAm.trim(),
      category: selectedCategory?.slug || 'general',
      category_id: categoryId || null,
      subcategory: subcategory.trim(),
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      price: Number(price) || 0,
      cost: Number(cost) || 0,
      stock: Number(stock) || 0,
      min_stock: Number(minStock) || 0,
      reorder_point: Number(reorderPoint) || 5,
      max_stock: maxStock ? Number(maxStock) : null,
      unit,
      tax_rate: Number(taxRate) || 0,
      expiry_date: expiryDate || null,
      description: description.trim(),
      image_url: imageUrl || '',
      branch_id: branchId || null,
      supplier_id: supplierId || null,
      storage_conditions: storageConditions,
      warranty_months: Number(warrantyMonths) || 0,
      track_batch: trackBatch,
      track_serial: trackSerial,
      track_expiry: trackExpiry,
      attributes,
      variants: variants.length > 0 ? JSON.parse(JSON.stringify(variants)) : [],
    };

    try {
      if (editProduct) {
        const before = editProduct.stock || 0;
        const { error } = await supabase.from('products').update(productData).eq('id', editProduct.id);
        if (error) throw error;
        if (Number(stock) !== before) {
          await supabase.from('stock_movements').insert({
            product_id: editProduct.id,
            movement_type: 'adjustment',
            quantity_change: Number(stock) - before,
            quantity_before: before,
            quantity_after: Number(stock) || 0,
            reason: 'Manual edit',
            performed_by: user?.id,
            branch_id: branchId || null,
          });
        }
        await logActivity('product_updated', `Updated product: ${name}`, { productId: editProduct.id }, { productId: editProduct.id });
        toast({ title: 'Product updated', description: `${name} saved.` });
      } else if (duplicateFound) {
        const newStock = duplicateFound.stock + (Number(stock) || 0);
        const { error } = await supabase.from('products').update({ ...productData, stock: newStock }).eq('id', duplicateFound.id);
        if (error) throw error;
        await supabase.from('stock_movements').insert({
          product_id: duplicateFound.id,
          movement_type: 'in',
          quantity_change: Number(stock) || 0,
          quantity_before: duplicateFound.stock,
          quantity_after: newStock,
          reason: 'Duplicate restock',
          performed_by: user?.id,
          branch_id: branchId || null,
        });
        await logActivity('stock_adjusted', `Stock +${stock} for ${duplicateFound.name}`, { productId: duplicateFound.id }, { productId: duplicateFound.id });
        toast({ title: 'Stock merged', description: `Added ${stock} to existing ${duplicateFound.name}.` });
      } else {
        const { data: inserted, error } = await supabase
          .from('products').insert([{ ...productData, created_by: user?.id }]).select('id').single();
        if (error) throw error;
        if (Number(stock) > 0) {
          await supabase.from('stock_movements').insert({
            product_id: inserted!.id,
            movement_type: 'in',
            quantity_change: Number(stock),
            quantity_before: 0,
            quantity_after: Number(stock),
            reason: 'Initial stock',
            performed_by: user?.id,
            branch_id: branchId || null,
          });
        }
        await logActivity('product_created', `Created product: ${name}`, { productId: inserted?.id }, { productId: inserted?.id });
        toast({ title: 'Product registered', description: `${name} added.` });
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

  const subcatOptions = template.subcategories || [];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (editProduct ? (
          <Button size="sm" variant="outline" className="gap-1 text-xs">Edit</Button>
        ) : (
          <Button size="sm" className="gap-1.5 text-xs gradient-primary text-primary-foreground">
            <Plus className="w-3.5 h-3.5" /> Add Product
          </Button>
        ))}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editProduct ? 'Edit Product' : 'Register New Product'}
            <span className="text-xs font-normal text-muted-foreground font-ethiopic">/ ምርት</span>
            {selectedCategory && (
              <Badge variant="secondary" className="ml-2 gap-1 text-[10px]">
                <Sparkles className="w-3 h-3" /> Smart fields active
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {duplicateFound && !editProduct && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Existing product found: {duplicateFound.name}</p>
              <p className="text-xs text-muted-foreground">Current stock: {duplicateFound.stock} • Price: ETB {duplicateFound.price}</p>
              <p className="text-xs text-warning mt-1">Submitting will add {stock || 0} to its stock.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs">Pricing & Stock</TabsTrigger>
              <TabsTrigger value="smart" className="text-xs gap-1">
                <Sparkles className="w-3 h-3" /> Smart
              </TabsTrigger>
              <TabsTrigger value="variants" className="text-xs">Variants</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Product Image</Label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
                    {imageUrl ? <img src={imageUrl} alt="Product" className="w-full h-full object-cover rounded-lg" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                      {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    {imageUrl && <button type="button" onClick={() => setImageUrl('')} className="text-[10px] text-destructive hover:underline text-left">Remove</button>}
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
                  <Label className="text-xs flex items-center gap-1.5"><Tag className="w-3 h-3" /> Category *</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder={loadingMeta ? 'Loading...' : 'Select category'} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {categories.filter(c => !c.parent_id).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.name_am && <span className="text-[10px] text-muted-foreground font-ethiopic ml-1">{c.name_am}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subcategory</Label>
                  {subcatOptions.length > 0 ? (
                    <Select value={subcategory} onValueChange={setSubcategory}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{subcatOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="Optional" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">SKU</Label>
                  <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Auto or custom" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5" /> Barcode</Label>
                  <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or enter..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Branch</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger><SelectValue placeholder="All / select branch" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Selling Price *</Label>
                  <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cost Price</Label>
                  <Input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tax Rate (%)</Label>
                  <Input type="number" min="0" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ETHIOPIAN_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Storage Conditions</Label>
                  <Input value={storageConditions} onChange={e => setStorageConditions(e.target.value)} placeholder="e.g. Cold storage" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{duplicateFound && !editProduct ? 'Stock to Add' : 'Stock'}</Label>
                  <Input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Stock</Label>
                  <Input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reorder Point</Label>
                  <Input type="number" min="0" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Stock</Label>
                  <Input type="number" min="0" value={maxStock} onChange={e => setMaxStock(e.target.value)} placeholder="∞" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Expiry Date</Label>
                  <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Warranty (months)</Label>
                  <Input type="number" min="0" value={warrantyMonths} onChange={e => setWarrantyMonths(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="smart" className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <Switch checked={trackExpiry} onCheckedChange={setTrackExpiry} />
                  <Label className="text-xs cursor-pointer">Track Expiry</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={trackBatch} onCheckedChange={setTrackBatch} />
                  <Label className="text-xs cursor-pointer">Track Batch</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={trackSerial} onCheckedChange={setTrackSerial} />
                  <Label className="text-xs cursor-pointer">Track Serial</Label>
                </div>
              </div>

              {(template.customFields?.length || 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Select a category to load smart fields.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {template.customFields!.map(f => (
                    <div key={f.key} className="space-y-1.5">
                      <Label className="text-xs">
                        {f.label} {f.required && <span className="text-destructive">*</span>}
                      </Label>
                      {renderCustomField(f)}
                      {f.helper && <p className="text-[10px] text-muted-foreground">{f.helper}</p>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="variants" className="space-y-3 pt-4">
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
                <Input type="number" value={variantPrice} onChange={e => setVariantPrice(e.target.value)} placeholder="Price" className="w-24 text-xs" />
                <Input type="number" value={variantStock} onChange={e => setVariantStock(e.target.value)} placeholder="Stock" className="w-24 text-xs" />
                <Button type="button" size="sm" variant="outline" onClick={addVariant}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" className="w-full mt-6 gradient-primary text-primary-foreground" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {editProduct ? 'Update Product' : duplicateFound ? 'Update Existing Stock' : 'Register Product'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
