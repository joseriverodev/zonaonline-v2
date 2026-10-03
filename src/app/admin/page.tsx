'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Search, Plus, Edit, Trash2, Pause, Play, Package, Tags, LogOut, X, Gem, LayoutDashboard, Minus, Check, Loader2, ImageIcon, Crown, Settings, Ticket, Image as ImageIconBanner } from 'lucide-react'
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, toggleProductActive, createCategory, updateCategory, deleteCategory, uploadVariantImage, updateStock } from '@/actions/products'
import { getSiteConfig, updateSiteConfig, getCoupons, createCoupon, deleteCoupon, getAllBanners, upsertBanner, deleteBanner } from '@/actions/config'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SidebarTrigger } from '@/components/ui/sidebar'
import imageCompression from 'browser-image-compression'
import { login, logout } from '@/actions/auth'

const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const colorMap: Record<string, string> = {
  white: '#FFFFFF', dark: '#1F1F1F', gold: '#C8A46A', pink: '#D67489',
  blue: '#3B82F6', green: '#10B981', purple: '#8B5CF6', none: 'transparent', black: '#000000'
}

const fontMap: Record<string, string> = {
  playfair: 'var(--font-playfair)', poppins: 'var(--font-poppins)', script: 'var(--font-script)'
}

const posClassMap: Record<string, string> = {
  'tl': 'justify-start items-start text-left', 'tc': 'justify-start items-center text-center', 'tr': 'justify-start items-end text-right',
  'ml': 'justify-center items-start text-left', 'mc': 'justify-center items-center text-center', 'mr': 'justify-center items-end text-right',
  'bl': 'justify-end items-start text-left', 'bc': 'justify-end items-center text-center', 'br': 'justify-end items-end text-right'
}

interface ProductVariant { id?: string; name: string; image: string; imageId: string | null; stock: number; price?: number | null; isNew?: boolean; isUploading?: boolean }
interface Product { id: string; name: string; measure: string; price: number; salePrice?: number | null; stock: number; image: string; gallery?: string[]; videoUrl?: string | null; imageId: string | null; isActive: boolean; variants: ProductVariant[]; categoryId: string; category: { id: string; name: string } }
interface Category { id: string; name: string; _count?: { products: number } }
interface Coupon { id: string; code: string; discountPercentage: number; isActive: boolean }
interface Banner { id: string; imageUrl: string; mobileImageUrl: string | null; mobileImageFocus: string; titleLine1: string | null; titleLine2: string | null; subtitle: string | null; buttonText: string | null; buttonLink: string | null; textPosition: string; textColor: string; textColor2: string; fontFamily: string; overlayColor: string; overlayOpacity: number; isActive: boolean }

function SortableImage({ url, index, onRemove }: { url: string, index: number, onRemove: (index: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `img-${index}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative w-full h-24 rounded-xl overflow-hidden border border-black/10 group bg-[#FAFAFA] cursor-grab active:cursor-grabbing touch-none">
      <img src={url} alt={`Imagen ${index}`} className="w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none"></div>
      {index === 0 && (<div className="absolute top-1 left-1 bg-[#C8A46A] text-white rounded-full p-1 shadow-sm pointer-events-none"><Crown className="w-3 h-3" /></div>)}
      <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"><X className="w-3 h-3" /></button>
    </div>
  )
}

function StockEditor({ product, onStockUpdate }: { product: Product, onStockUpdate: (id: string, stock: number) => Promise<void> }) {
  const [stock, setStock] = useState(product.stock)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => { setStock(product.stock) }, [product.stock])
  const handleChange = (newVal: number) => {
    if (newVal < 0) newVal = 0
    setStock(newVal); setStatus('saving')
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => { await onStockUpdate(product.id, newVal); setStatus('saved'); setTimeout(() => setStatus('idle'), 1000) }, 600)
  }
  return (
    <div className="flex items-center gap-1 bg-black/5 rounded-lg p-1">
      <button onClick={() => handleChange(stock - 1)} className="p-1 rounded-md hover:bg-white text-[#6B6B6B] transition-colors"><Minus className="w-3 h-3" /></button>
      <input type="number" value={stock} onChange={(e) => handleChange(parseInt(e.target.value) || 0)} className="w-10 text-center bg-transparent focus:outline-none text-sm font-medium text-[#1F1F1F] appearance-none" />
      <button onClick={() => handleChange(stock + 1)} className="p-1 rounded-md hover:bg-white text-[#6B6B6B] transition-colors"><Plus className="w-3 h-3" /></button>
      <div className="w-3 ml-1">{status === 'saving' && <Loader2 className="w-3 h-3 animate-spin text-[#C8A46A]" />}{status === 'saved' && <Check className="w-3 h-3 text-green-500" />}</div>
    </div>
  )
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'config' | 'coupons' | 'banners'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'out_of_stock'>('all')
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false)
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false)
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false)
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState(false)
  const [isSubmittingBanner, setIsSubmittingBanner] = useState(false)
  
  const [productName, setProductName] = useState(''); const [productMeasure, setProductMeasure] = useState(''); const [productPrice, setProductPrice] = useState(''); const [productSalePrice, setProductSalePrice] = useState(''); const [productStock, setProductStock] = useState('0'); const [productCategory, setProductCategory] = useState(''); const [productVideoUrl, setProductVideoUrl] = useState(''); const [isDragging, setIsDragging] = useState(false); const [unifiedImages, setUnifiedImages] = useState<{ url: string; file?: File }[]>([]); const [externalImageUrl, setExternalImageUrl] = useState(''); const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [cfgWhatsapp, setCfgWhatsapp] = useState(''); const [cfgPhoneCall, setCfgPhoneCall] = useState(''); const [cfgInstagram, setCfgInstagram] = useState(''); const [cfgTiktok, setCfgTiktok] = useState('')
  const [couponCode, setCouponCode] = useState(''); const [couponDiscount, setCouponDiscount] = useState('')
  
  const [bannerTitle1, setBannerTitle1] = useState(''); const [bannerTitle2, setBannerTitle2] = useState(''); const [bannerSubtitle, setBannerSubtitle] = useState(''); const [bannerButtonText, setBannerButtonText] = useState(''); const [bannerButtonLink, setBannerButtonLink] = useState(''); const [bannerImage, setBannerImage] = useState<File | null>(null); const [currentBannerImage, setCurrentBannerImage] = useState('')
  const [bannerTextPosition, setBannerTextPosition] = useState('ml'); const [bannerTextColor, setBannerTextColor] = useState('white'); const [bannerTextColor2, setBannerTextColor2] = useState('pink'); const [bannerFontFamily, setBannerFontFamily] = useState('playfair')
  const [bannerOverlayColor, setBannerOverlayColor] = useState('black'); const [bannerOverlayOpacity, setBannerOverlayOpacity] = useState(40)
  const [bannerMobileImage, setBannerMobileImage] = useState<File | null>(null); const [currentMobileBannerImage, setCurrentMobileBannerImage] = useState(''); const [bannerMobileImageFocus, setBannerMobileImageFocus] = useState('center')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const mobileBannerInputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  useEffect(() => { const auth = sessionStorage.getItem('adminAuth'); if (auth === 'true') setIsAuthenticated(true) }, [])
  useEffect(() => { if (isAuthenticated) fetchData() }, [isAuthenticated])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [productsData, categoriesData, configData, couponsData, bannersData] = await Promise.all([getProducts(), getCategories(), getSiteConfig(), getCoupons(), getAllBanners()])
      setProducts(productsData as Product[]); setCategories(categoriesData as Category[]); setCoupons(couponsData as Coupon[]); setBanners(bannersData as Banner[])
      if (configData) { setCfgWhatsapp(configData.whatsapp || ''); setCfgPhoneCall(configData.phoneCall || ''); setCfgInstagram(configData.instagram || ''); setCfgTiktok(configData.tiktok || '') }
    } catch (error) { console.error('Error:', error) } finally { setLoading(false) }
  }

    const handleLogin = async () => {
    const result = await login(password)
    if (result.success) {
      setIsAuthenticated(true)
      sessionStorage.setItem('adminAuth', 'true')
      setAuthError('')
    } else {
      setAuthError(result.error || 'Contraseña incorrecta')
    }
  }
  const handleLogout = async () => {
    await logout()
    setIsAuthenticated(false)
    sessionStorage.removeItem('adminAuth')
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = normalizeText(product.name).includes(normalizeText(searchQuery));
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? product.isActive : statusFilter === 'paused' ? !product.isActive : statusFilter === 'out_of_stock' ? product.stock === 0 : false
    return matchesSearch && matchesStatus
  })

  const handleToggleActive = async (productId: string) => { try { const result = await toggleProductActive(productId); if (result.success && result.product) { setProducts(products.map(p => p.id === productId ? { ...p, isActive: result.product!.isActive } : p)) } } catch (error) { console.error(error) } }
  const handleStockUpdate = async (productId: string, newStock: number) => { setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p)); try { await updateStock(productId, newStock) } catch (error) { console.error(error); fetchData() } }
  const handleDeleteProduct = async (productId: string) => { if (!confirm('¿Eliminar producto?')) return; try { const result = await deleteProduct(productId); if (result.success) setProducts(products.filter(p => p.id !== productId)) } catch (error) { console.error(error) } }
  const handleDeleteCategory = async (categoryId: string) => { if (!confirm('¿Eliminar categoría?')) return; try { const result = await deleteCategory(categoryId); if (result.success) setCategories(categories.filter(c => c.id !== categoryId)); else alert(result.error) } catch (error) { console.error(error) } }

  const handleAddImages = async (files: FileList | File[] | null) => { if (!files) return; const newImages: { url: string; file: File }[] = []; for (const file of Array.from(files)) { newImages.push({ url: URL.createObjectURL(file), file }) }; setUnifiedImages(prev => [...prev, ...newImages]) }
  const handleAddExternalImage = () => { if (!externalImageUrl) return alert('URL inválida.'); setUnifiedImages(prev => [...prev, { url: externalImageUrl }]); setExternalImageUrl('') }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.length) handleAddImages(e.dataTransfer.files) }
  const handleRemoveImage = (index: number) => setUnifiedImages(prev => prev.filter((_, i) => i !== index))
  const handleDragEnd = (event: DragEndEvent) => { const { active, over } = event; if (over && active.id !== over.id) { setUnifiedImages((items) => { const oldIndex = items.findIndex((_, i) => `img-${i}` === active.id); const newIndex = items.findIndex((_, i) => `img-${i}` === over.id); return arrayMove(items, oldIndex, newIndex) }) } }

  const handleAddVariant = () => setProductVariants(prev => [...prev, { id: `temp-${Date.now()}`, name: '', image: '', imageId: null, stock: 0, price: null, isNew: true }])
  const handleUpdateVariant = (index: number, field: keyof ProductVariant, value: any) => setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  const handleVariantImageUpload = async (index: number, file: File | null) => { if (!file) return; setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, isUploading: true } : v)); try { const compressed = await imageCompression(file, { maxSizeMB: 4.0, maxWidthOrHeight: 4096, useWebWorker: true }); const formData = new FormData(); formData.append('image', compressed); const result = await uploadVariantImage(formData); if (result.success) setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, image: result.image!, imageId: result.imageId!, isUploading: false } : v)) } catch (error) { console.error(error); setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, isUploading: false } : v)) } }

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingProduct) return; if (!productName.trim() || !productMeasure.trim() || !productPrice || parseFloat(productPrice) <= 0 || !productCategory || unifiedImages.length === 0) return alert('Faltan datos obligatorios')
    setIsSubmittingProduct(true); const formData = new FormData()
    formData.append('name', productName.trim()); formData.append('measure', productMeasure.trim()); formData.append('price', productPrice); formData.append('salePrice', productSalePrice); formData.append('stock', productStock); formData.append('categoryId', productCategory); formData.append('videoUrl', productVideoUrl)
    formData.append('variants', JSON.stringify(productVariants.filter(v => v.name.trim() !== '').map(v => ({ name: v.name, image: v.image, imageId: v.imageId, stock: Number(v.stock) || 0, price: v.price ? Number(v.price) : null }))))
    formData.append('orderedUrls', JSON.stringify(unifiedImages.map(img => img.file ? 'NEW_FILE' : img.url)))
    unifiedImages.forEach(img => { if (img.file) formData.append('images', img.file) })
    try { let result = editingProduct ? await updateProduct(editingProduct.id, formData) : await createProduct(formData); if (result.success && result.product) { if (editingProduct) setProducts(products.map(p => p.id === editingProduct.id ? result.product as Product : p)); else setProducts([result.product as Product, ...products]); closeProductModal() } else alert(result.error || 'Error') } catch (error) { console.error(error); alert('Error') } finally { setIsSubmittingProduct(false) }
  }

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingCategory || !categoryName.trim()) return
    setIsSubmittingCategory(true); try { const formData = new FormData(); formData.append('name', categoryName.trim()); let result = editingCategory ? await updateCategory(editingCategory.id, formData) : await createCategory(formData); if (result.success && result.category) { if (editingCategory) setCategories(categories.map(c => c.id === editingCategory.id ? result.category as Category : c)); else setCategories([...categories, result.category as Category]); closeCategoryModal() } } catch (error) { console.error(error) } finally { setIsSubmittingCategory(false) }
  }

  const handleSubmitConfig = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingConfig) return; setIsSubmittingConfig(true)
    try { const formData = new FormData(); formData.append('whatsapp', cfgWhatsapp); formData.append('phoneCall', cfgPhoneCall); formData.append('instagram', cfgInstagram); formData.append('tiktok', cfgTiktok); const result = await updateSiteConfig(formData); if (result.success) { alert('Configuración guardada'); fetchData() } else alert(result.error) } catch (error) { console.error(error) } finally { setIsSubmittingConfig(false) }
  }

  const handleSubmitCoupon = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingCoupon || !couponCode.trim() || !couponDiscount) return; setIsSubmittingCoupon(true)
    try { const formData = new FormData(); formData.append('code', couponCode.trim()); formData.append('discountPercentage', couponDiscount); const result = await createCoupon(formData); if (result.success) { setCouponCode(''); setCouponDiscount(''); fetchData() } else alert(result.error) } catch (error) { console.error(error) } finally { setIsSubmittingCoupon(false) }
  }
  const handleDeleteCoupon = async (id: string) => { if (!confirm('¿Eliminar cupón?')) return; try { const result = await deleteCoupon(id); if (result.success) setCoupons(coupons.filter(c => c.id !== id)) } catch (error) { console.error(error) } }

  const handleBannerKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); const target = e.target as HTMLInputElement | HTMLTextAreaElement; if (target.tagName === 'TEXTAREA') { const start = target.selectionStart; const end = target.selectionEnd; target.value = target.value.substring(0, start) + '\n' + target.value.substring(end); target.selectionStart = target.selectionEnd = start + 1 } } }

  const handleSubmitBanner = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingBanner) return; if (!bannerImage && !currentBannerImage) return alert('La imagen es obligatoria')
    setIsSubmittingBanner(true); try {
      const formData = new FormData()
      if (editingBanner) formData.append('id', editingBanner.id)
      formData.append('titleLine1', bannerTitle1); formData.append('titleLine2', bannerTitle2); formData.append('subtitle', bannerSubtitle); formData.append('buttonText', bannerButtonText); formData.append('buttonLink', bannerButtonLink)
      formData.append('textPosition', bannerTextPosition); formData.append('textColor', bannerTextColor); formData.append('textColor2', bannerTextColor2); formData.append('fontFamily', bannerFontFamily)
      formData.append('overlayColor', bannerOverlayColor); formData.append('overlayOpacity', String(bannerOverlayOpacity))
      formData.append('mobileImageFocus', bannerMobileImageFocus)
      formData.append('currentImage', currentBannerImage || '')
      if (bannerImage) formData.append('image', bannerImage)
      formData.append('currentMobileImage', currentMobileBannerImage || '')
      if (bannerMobileImage) formData.append('mobileImage', bannerMobileImage)
      const result = await upsertBanner(formData)
      if (result.success) { closeBannerModal(); fetchData() } else alert(result.error)
    } catch (error) { console.error(error) } finally { setIsSubmittingBanner(false) }
  }
  const handleDeleteBanner = async (id: string) => { if (!confirm('¿Eliminar banner?')) return; try { const result = await deleteBanner(id); if (result.success) setBanners(banners.filter(b => b.id !== id)) } catch (error) { console.error(error) } }

  const openEditProduct = (product: Product) => {
    setEditingProduct(product); setProductName(product.name); setProductMeasure(product.measure); setProductPrice(product.price.toString()); setProductSalePrice(product.salePrice ? product.salePrice.toString() : ''); setProductStock(product.stock.toString()); setProductCategory(product.categoryId); setProductVideoUrl(product.videoUrl || '')
    const existingImgs = [{ url: product.image, file: undefined }]; if (product.gallery) product.gallery.forEach(url => existingImgs.push({ url, file: undefined }))
    setUnifiedImages(existingImgs); setProductVariants(product.variants || []); setShowProductModal(true)
  }
  const openEditCategory = (category: Category) => { setEditingCategory(category); setCategoryName(category.name); setShowCategoryModal(true) }
  const openEditBanner = (banner: Banner) => {
    setEditingBanner(banner); setBannerTitle1(banner.titleLine1 || ''); setBannerTitle2(banner.titleLine2 || ''); setBannerSubtitle(banner.subtitle || ''); setBannerButtonText(banner.buttonText || ''); setBannerButtonLink(banner.buttonLink || '')
    setBannerTextPosition(banner.textPosition || 'ml'); setBannerTextColor(banner.textColor || 'white'); setBannerTextColor2(banner.textColor2 || 'pink'); setBannerFontFamily(banner.fontFamily || 'playfair')
    setBannerOverlayColor(banner.overlayColor || 'black'); setBannerOverlayOpacity(banner.overlayOpacity ?? 40)
    setBannerMobileImageFocus(banner.mobileImageFocus || 'center'); setCurrentMobileBannerImage(banner.mobileImageUrl || ''); setBannerMobileImage(null)
    setCurrentBannerImage(banner.imageUrl); setBannerImage(null); setShowBannerModal(true)
  }

  const closeProductModal = () => { setShowProductModal(false); setEditingProduct(null); setProductName(''); setProductMeasure(''); setProductPrice(''); setProductSalePrice(''); setProductStock('0'); setProductCategory(''); setProductVideoUrl(''); setUnifiedImages([]); setProductVariants([]); setExternalImageUrl(''); setIsSubmittingProduct(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  const closeCategoryModal = () => { setShowCategoryModal(false); setEditingCategory(null); setCategoryName(''); setIsSubmittingCategory(false) }
  const closeBannerModal = () => { setShowBannerModal(false); setEditingBanner(null); setBannerTitle1(''); setBannerTitle2(''); setBannerSubtitle(''); setBannerButtonText(''); setBannerButtonLink(''); setBannerImage(null); setCurrentBannerImage(''); setBannerTextPosition('ml'); setBannerTextColor('white'); setBannerTextColor2('pink'); setBannerFontFamily('playfair'); setBannerOverlayColor('black'); setBannerOverlayOpacity(40); setBannerMobileImage(null); setCurrentMobileBannerImage(''); setBannerMobileImageFocus('center'); setIsSubmittingBanner(false); if (bannerInputRef.current) bannerInputRef.current.value = ''; if (mobileBannerInputRef.current) mobileBannerInputRef.current.value = '' }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 w-full max-w-md border border-black/5">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white border border-black/5 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"><Gem className="w-8 h-8 text-[#C8A46A]" /></div>
            <h1 className="text-2xl font-semibold text-[#1F1F1F] tracking-tight">Panel de Administración</h1>
            <p className="text-[#6B6B6B] mt-2 text-sm">Store Administration</p>
          </div>
          <div className="space-y-4">
            <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="h-12 text-base border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" />
            {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
            <Button onClick={handleLogin} className="w-full h-12 bg-[#1F1F1F] hover:bg-[#C8A46A] text-white text-base font-medium rounded-xl transition-colors duration-300">Ingresar</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-black/5 sticky top-0 z-40 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-[#1F1F1F] hover:bg-black/5 rounded-lg p-2 md:hidden" />
            <img src="/icon.png" alt="Store logo" className="h-8 w-auto md:hidden" />
            <LayoutDashboard className="w-6 h-6 text-[#C8A46A] hidden md:block" />
            <span className="text-base md:text-xl font-semibold text-[#1F1F1F] tracking-tight">Gestión de Inventario</span>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-black/10 text-[#1F1F1F] hover:bg-[#D67489]/10 hover:text-[#1F1F1F] rounded-xl"><LogOut className="w-4 h-4 mr-2" /> <span className="hidden md:inline">Salir</span></Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div onClick={() => { setActiveTab('products'); setStatusFilter('all'); }} className={`rounded-2xl p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' && activeTab === 'products' ? 'border-[#C8A46A] shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-xs uppercase tracking-wider mb-1">Total Productos</p><p className="text-3xl font-semibold text-[#1F1F1F]">{products.length}</p></div>
          <div onClick={() => { setActiveTab('products'); setStatusFilter('active'); }} className={`rounded-2xl p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${statusFilter === 'active' && activeTab === 'products' ? 'border-[#D67489] shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-xs uppercase tracking-wider mb-1">Activos</p><p className="text-3xl font-semibold text-[#1F1F1F]">{products.filter(p => p.isActive).length}</p></div>
          <div onClick={() => { setActiveTab('products'); setStatusFilter('out_of_stock'); }} className={`rounded-2xl p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${statusFilter === 'out_of_stock' && activeTab === 'products' ? 'border-red-400 shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-xs uppercase tracking-wider mb-1">Agotados (Stock 0)</p><p className="text-3xl font-semibold text-red-500">{products.filter(p => p.stock === 0).length}</p></div>
          <div onClick={() => setActiveTab('categories')} className={`rounded-2xl p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${activeTab === 'categories' ? 'border-[#C8A46A] shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-xs uppercase tracking-wider mb-1">Categorías</p><p className="text-3xl font-semibold text-[#1F1F1F]">{categories.length}</p></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 mb-6 overflow-hidden">
          <div className="flex border-b border-black/5 overflow-x-auto">
            <button onClick={() => setActiveTab('products')} className={`flex-1 min-w-[120px] py-4 px-6 text-center font-medium transition-colors ${activeTab === 'products' ? 'text-[#1F1F1F] bg-[#FFF9FA] border-b-2 border-[#C8A46A]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><Package className="w-4 h-4 inline-block mr-2" /> Productos</button>
            <button onClick={() => setActiveTab('categories')} className={`flex-1 min-w-[120px] py-4 px-6 text-center font-medium transition-colors ${activeTab === 'categories' ? 'text-[#1F1F1F] bg-[#FFF9FA] border-b-2 border-[#C8A46A]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><Tags className="w-4 h-4 inline-block mr-2" /> Categorías</button>
            <button onClick={() => setActiveTab('banners')} className={`flex-1 min-w-[120px] py-4 px-6 text-center font-medium transition-colors ${activeTab === 'banners' ? 'text-[#1F1F1F] bg-[#FFF9FA] border-b-2 border-[#C8A46A]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><ImageIconBanner className="w-4 h-4 inline-block mr-2" /> Banners</button>
            <button onClick={() => setActiveTab('coupons')} className={`flex-1 min-w-[120px] py-4 px-6 text-center font-medium transition-colors ${activeTab === 'coupons' ? 'text-[#1F1F1F] bg-[#FFF9FA] border-b-2 border-[#C8A46A]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><Ticket className="w-4 h-4 inline-block mr-2" /> Cupones</button>
            <button onClick={() => setActiveTab('config')} className={`flex-1 min-w-[120px] py-4 px-6 text-center font-medium transition-colors ${activeTab === 'config' ? 'text-[#1F1F1F] bg-[#FFF9FA] border-b-2 border-[#C8A46A]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><Settings className="w-4 h-4 inline-block mr-2" /> Configuración</button>
          </div>
        </div>

        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" /><Input type="text" placeholder="Buscar productos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-12 bg-white border-black/10 rounded-xl focus:border-[#C8A46A] focus:ring-[#C8A46A]/20" /></div>
              <Button onClick={() => setShowProductModal(true)} className="h-12 bg-[#1F1F1F] hover:bg-[#C8A46A] rounded-xl px-6 transition-colors duration-300"><Plus className="w-5 h-5 mr-2" /> Nuevo Producto</Button>
            </div>
            {loading ? (<div className="text-center py-16 bg-white rounded-2xl border border-black/5"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C8A46A] mx-auto mb-4"></div><p className="text-[#6B6B6B]">Cargando...</p></div>) : (
              <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full"><thead className="bg-[#FAFAFA] border-b border-black/5"><tr><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Producto</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider hidden md:table-cell">Categoría</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Precio</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Inventario</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Estado</th><th className="text-right py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Acciones</th></tr></thead>
                  <tbody className="divide-y divide-black/5">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className={`hover:bg-[#FFF9FA] transition-colors ${!product.isActive ? 'opacity-60' : ''} ${product.stock === 0 ? 'bg-red-50/30' : ''}`}>
                        <td className="py-4 px-6"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#FAFAFA] rounded-xl overflow-hidden border border-black/5 flex-shrink-0">{product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-[#6B6B6B]" /></div>}</div><div><p className="font-medium text-[#1F1F1F]">{product.name}</p><p className="text-sm text-[#6B6B6B]">{product.measure.substring(0, 30)}</p></div></div></td>
                        <td className="py-4 px-6 hidden md:table-cell"><span className="px-3 py-1 bg-[#FFF9FA] text-[#1F1F1F] rounded-full text-xs border border-black/5">{product.category?.name || 'N/A'}</span></td>
                        <td className="py-4 px-6 font-semibold text-[#1F1F1F]">${product.price.toFixed(2)} {product.salePrice ? <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-[#D67489]/20 text-[#1F1F1F] rounded-full">Oferta</span> : null}</td>
                        <td className="py-4 px-6"><StockEditor product={product} onStockUpdate={handleStockUpdate} /></td>
                        <td className="py-4 px-6"><span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${product.isActive ? 'bg-[#D67489]/20 text-[#1F1F1F]' : 'bg-black/5 text-[#6B6B6B]'}`}>{product.isActive ? 'Activo' : 'Pausado'}</span></td>
                        <td className="py-4 px-6"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => handleToggleActive(product.id)} className={`p-2 rounded-lg ${product.isActive ? 'text-[#6B6B6B] hover:bg-black/5' : 'text-[#C8A46A] hover:bg-[#FFF9FA]'}`} title={product.isActive ? 'Pausar' : 'Activar'}>{product.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button><Button variant="ghost" size="sm" onClick={() => openEditProduct(product)} className="p-2 rounded-lg text-[#1F1F1F] hover:bg-[#FFF9FA]"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                {filteredProducts.length === 0 && (<div className="text-center py-16"><Package className="w-12 h-12 text-black/10 mx-auto mb-4" /><p className="text-[#6B6B6B]">No hay productos en esta lista.</p></div>)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-end"><Button onClick={() => setShowCategoryModal(true)} className="bg-[#1F1F1F] hover:bg-[#C8A46A] rounded-xl px-6 transition-colors duration-300"><Plus className="w-5 h-5 mr-2" /> Nueva Categoría</Button></div>
            {loading ? (<div className="text-center py-16 bg-white rounded-2xl border border-black/5"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C8A46A] mx-auto mb-4"></div><p className="text-[#6B6B6B]">Cargando...</p></div>) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (<div key={category.id} className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"><div><h3 className="font-semibold text-[#1F1F1F] text-lg">{category.name}</h3><p className="text-sm text-[#6B6B6B] mt-1">{category._count?.products || 0} productos</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => openEditCategory(category)} className="p-2 rounded-lg text-[#1F1F1F] hover:bg-[#FFF9FA]"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></div></div>))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'banners' && (
          <div className="space-y-4">
            <div className="flex justify-end"><Button onClick={() => setShowBannerModal(true)} className="bg-[#1F1F1F] hover:bg-[#C8A46A] rounded-xl px-6 transition-colors duration-300"><Plus className="w-5 h-5 mr-2" /> Nuevo Banner</Button></div>
            {loading ? (<div className="text-center py-16 bg-white rounded-2xl border border-black/5"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C8A46A] mx-auto mb-4"></div><p className="text-[#6B6B6B]">Cargando...</p></div>) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {banners.map((banner) => (
                  <div key={banner.id} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
                    <div className="relative w-full h-32 bg-[#FAFAFA]">
                      <img src={banner.imageUrl} alt={banner.titleLine1 || 'Banner'} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-end p-3" style={{ backgroundColor: colorMap[banner.overlayColor] || '#000', opacity: (banner.overlayOpacity || 0) / 100 }}>
                        <h3 className="font-semibold text-lg truncate" style={{ color: colorMap[banner.textColor] }}>{banner.titleLine1} {banner.titleLine2 && <span style={{ color: colorMap[banner.textColor2] }}>{banner.titleLine2}</span>}</h3>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {banner.buttonText && <span className="text-[10px] bg-[#D67489]/10 text-[#D67489] px-2 py-1 rounded-full">Botón: {banner.buttonText}</span>}
                        <span className="text-[10px] bg-black/5 text-[#6B6B6B] px-2 py-1 rounded-full">Pos: {banner.textPosition}</span>
                        {banner.mobileImageUrl && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full">Img Móvil</span>}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2"><Button variant="ghost" size="sm" onClick={() => openEditBanner(banner)} className="p-2 rounded-lg text-[#1F1F1F] hover:bg-[#FFF9FA]"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteBanner(banner.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></div>
                    </div>
                  </div>
                ))}
                {banners.length === 0 && <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-black/5"><ImageIconBanner className="w-12 h-12 text-black/10 mx-auto mb-4" /><p className="text-[#6B6B6B]">No hay banners creados.</p></div>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'coupons' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
              <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4">Crear Nuevo Cupón</h3>
              <form onSubmit={handleSubmitCoupon} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full"><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Código del Cupón</label><Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Ej: AÑONUEVO123" className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl uppercase" disabled={isSubmittingCoupon} /></div>
                <div className="flex-1 w-full"><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Descuento (%)</label><Input type="number" min="1" max="100" value={couponDiscount} onChange={(e) => setCouponDiscount(e.target.value)} placeholder="10" className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" disabled={isSubmittingCoupon} /></div>
                <Button type="submit" disabled={isSubmittingCoupon} className="bg-[#1F1F1F] hover:bg-[#C8A46A] text-white rounded-xl px-6 h-10 transition-colors duration-300">{isSubmittingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Crear</Button>
              </form>
            </div>
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full"><thead className="bg-[#FAFAFA] border-b border-black/5"><tr><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Código</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Descuento</th><th className="text-right py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Acción</th></tr></thead>
                <tbody className="divide-y divide-black/5">{coupons.map((coupon) => (<tr key={coupon.id} className="hover:bg-[#FFF9FA] transition-colors"><td className="py-4 px-6 font-mono font-medium text-[#1F1F1F]">{coupon.code}</td><td className="py-4 px-6 text-[#C8A46A] font-semibold">{coupon.discountPercentage}%</td><td className="py-4 px-6 text-right"><Button variant="ghost" size="sm" onClick={() => handleDeleteCoupon(coupon.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></td></tr>))}</tbody>
              </table></div>
              {coupons.length === 0 && <div className="text-center py-16"><Ticket className="w-12 h-12 text-black/10 mx-auto mb-4" /><p className="text-[#6B6B6B]">No hay cupones creados.</p></div>}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
            <h3 className="text-lg font-semibold text-[#1F1F1F] mb-6">Contacto y Redes Sociales</h3>
            <form onSubmit={handleSubmitConfig} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">WhatsApp (Solo números)</label><Input value={cfgWhatsapp} onChange={(e) => setCfgWhatsapp(e.target.value)} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Teléfono Llamadas</label><Input value={cfgPhoneCall} onChange={(e) => setCfgPhoneCall(e.target.value)} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Usuario Instagram</label><Input value={cfgInstagram} onChange={(e) => setCfgInstagram(e.target.value)} placeholder="tu_usuario" className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Usuario TikTok</label><Input value={cfgTiktok} onChange={(e) => setCfgTiktok(e.target.value)} placeholder="tu_usuario" className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
              </div>
              <div className="pt-4"><Button type="submit" disabled={isSubmittingConfig} className="bg-[#1F1F1F] hover:bg-[#C8A46A] text-white rounded-xl px-8 transition-colors duration-300">{isSubmittingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Guardar Configuración</Button></div>
            </form>
          </div>
        )}
      </main>

      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
            <div className="p-6 border-b border-black/5 flex items-center justify-between shrink-0 rounded-t-3xl bg-white">
              <h2 className="text-xl font-semibold text-[#1F1F1F]">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button type="button" onClick={closeProductModal} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-[#6B6B6B]" />
              </button>
            </div>
            <form onSubmit={handleSubmitProduct} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-8 overflow-y-auto flex-grow">
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[#C8A46A] uppercase tracking-wider">Información Básica</h3>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Nombre del producto *</label>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ej: Camiseta de algodón talla M" disabled={isSubmittingProduct} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Descripción / Detalles *</label>
                    <Textarea value={productMeasure} onChange={(e) => setProductMeasure(e.target.value)} placeholder="Ej: Algodón, incluye bolsa de regalo." disabled={isSubmittingProduct} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl min-h-[80px]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Categoría *</label>
                    <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} disabled={isSubmittingProduct} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 focus:border-[#C8A46A] disabled:opacity-50 bg-white">
                      <option value="">Seleccionar categoría</option>
                      {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <h3 className="text-sm font-medium text-[#C8A46A] uppercase tracking-wider">Precios e Inventario</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Precio Base ($)*</label>
                      <Input type="number" step="0.01" min="0" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="0.00" disabled={isSubmittingProduct} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Precio Oferta ($)</label>
                      <Input type="number" step="0.01" min="0" value={productSalePrice} onChange={(e) => setProductSalePrice(e.target.value)} placeholder="0.00" disabled={isSubmittingProduct} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" />
                      <p className="text-[10px] text-[#6B6B6B] mt-1">Opcional. Si lo llenas, aparecerá en "Ofertas".</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Inventario (Stock)*</label>
                      <Input type="number" min="0" value={productStock} onChange={(e) => setProductStock(e.target.value)} placeholder="0" disabled={isSubmittingProduct} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <h3 className="text-sm font-medium text-[#C8A46A] uppercase tracking-wider">Galería del Producto</h3>
                  <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`flex items-center justify-center w-full h-32 border-2 ${isDragging ? 'border-[#C8A46A] bg-[#FFF9FA]' : 'border-black/10 border-dashed'} rounded-2xl cursor-pointer bg-[#FAFAFA] hover:bg-[#FFF9FA] transition-colors relative`}>
                    <label htmlFor="dropzone-file" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer w-full h-full">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className={`w-8 h-8 mb-3 ${isDragging ? 'text-[#C8A46A]' : 'text-[#6B6B6B]'}`} />
                        <p className="mb-2 text-sm text-[#1F1F1F]"><span className="font-semibold">Haz clic para subir</span> o arrastra aquí</p>
                        <p className="text-xs text-[#6B6B6B]">La 1ra imagen será la portada</p>
                      </div>
                      <input id="dropzone-file" ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleAddImages(e.target.files)} disabled={isSubmittingProduct} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Input type="text" value={externalImageUrl} onChange={(e) => setExternalImageUrl(e.target.value)} placeholder="O pega una URL de imagen externa aquí..." className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" disabled={isSubmittingProduct} />
                    <Button type="button" onClick={handleAddExternalImage} variant="outline" disabled={isSubmittingProduct} className="border-black/10 text-[#1F1F1F] hover:bg-[#FFF9FA] rounded-xl">Añadir URL</Button>
                  </div>
                  {unifiedImages.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-black/5">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={unifiedImages.map((_, i) => `img-${i}`)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                            {unifiedImages.map((img, index) => (
                              <SortableImage key={`img-${index}`} url={img.url} index={index} onRemove={handleRemoveImage} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                      <p className="text-[10px] text-[#6B6B6B] mt-3 text-center">Arrastra la imagen para reordenar. La primera es la portada.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <h3 className="text-sm font-medium text-[#C8A46A] uppercase tracking-wider">Multimedia Extra</h3>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">URL del Video (YouTube, TikTok, Drive) - Opcional</label>
                    <Input type="url" value={productVideoUrl} onChange={(e) => setProductVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." disabled={isSubmittingProduct} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" />
                    <p className="text-[10px] text-[#6B6B6B] mt-1">Si pegas un link aquí, aparecerá un botón de "Ver Video" en el producto.</p>
                  </div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#C8A46A] uppercase tracking-wider">Variantes</h3>
                    <Button type="button" onClick={handleAddVariant} variant="outline" disabled={isSubmittingProduct} className="border-black/10 text-[#1F1F1F] hover:bg-[#FFF9FA] rounded-xl h-8 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Añadir
                    </Button>
                  </div>
                  {productVariants.length > 0 ? (
                    <div className="space-y-3">
                      {productVariants.map((variant, index) => (
                        <div key={index} className="p-3 bg-[#FAFAFA] rounded-xl border border-black/5 space-y-3">
                          {/* Fila 1: Imagen, Nombre y URL de imagen externa */}
                          <div className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-12 md:col-span-3 relative">
                              <label className="w-full h-20 md:h-20 flex items-center justify-center bg-white rounded-lg border border-black/10 cursor-pointer overflow-hidden">
                                {variant.isUploading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-[#C8A46A]" />
                                ) : variant.image ? (
                                  <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="w-6 h-6 text-[#6B6B6B]" />
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleVariantImageUpload(index, e.target.files?.[0] || null)} disabled={isSubmittingProduct} />
                              </label>
                            </div>
                            <div className="col-span-12 md:col-span-9 space-y-2">
                              <input 
                                type="text" 
                                value={variant.name} 
                                onChange={(e) => handleUpdateVariant(index, 'name', e.target.value)} 
                                placeholder="Nombre (Ej: Rojo)" 
                                className="w-full h-9 px-3 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white" 
                                disabled={isSubmittingProduct} 
                              />
                              <input 
                                type="url" 
                                value={variant.image || ''} 
                                onChange={(e) => {
                                  handleUpdateVariant(index, 'image', e.target.value)
                                  handleUpdateVariant(index, 'imageId', null) // Limpiar el ID si se usa una URL externa
                                }} 
                                placeholder="O pega URL de imagen externa aquí..." 
                                className="w-full h-9 px-3 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white" 
                                disabled={isSubmittingProduct} 
                              />
                            </div>
                          </div>
                          {/* Fila 2: Precio, Stock y Eliminar */}
                          <div className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-5 md:col-span-5">
                              <input 
                                type="number" 
                                step="0.01" 
                                value={variant.price ?? ''} 
                                onChange={(e) => handleUpdateVariant(index, 'price', e.target.value)} 
                                placeholder="Precio" 
                                className="w-full h-9 px-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white" 
                                disabled={isSubmittingProduct} 
                              />
                            </div>
                            <div className="col-span-5 md:col-span-5">
                              <input 
                                type="number" 
                                min="0" 
                                value={variant.stock} 
                                onChange={(e) => handleUpdateVariant(index, 'stock', e.target.value)} 
                                placeholder="Stock" 
                                className="w-full h-9 px-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white" 
                                disabled={isSubmittingProduct} 
                              />
                            </div>
                            <div className="col-span-2 md:col-span-2 flex justify-end">
                              <button 
                                type="button" 
                                onClick={() => setProductVariants(prev => prev.filter((_, i) => i !== index))} 
                                disabled={isSubmittingProduct} 
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6B6B6B] text-center py-4">Sin variantes. El producto usará el precio base.</p>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-black/5 flex gap-4 shrink-0 bg-white rounded-b-3xl">
                <Button type="button" variant="outline" onClick={closeProductModal} disabled={isSubmittingProduct} className="flex-1 border-black/10 text-[#1F1F1F] hover:bg-black/5 rounded-xl">Cancelar</Button>
                <Button type="submit" disabled={isSubmittingProduct} className="flex-1 bg-[#1F1F1F] hover:bg-[#C8A46A] text-white rounded-xl transition-colors duration-300">
                  {isSubmittingProduct ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Guardando...
                    </span>
                  ) : editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
            <div className="p-6 border-b border-black/5 flex items-center justify-between"><h2 className="text-xl font-semibold text-[#1F1F1F]">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h2><button type="button" onClick={closeCategoryModal} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X className="w-5 h-5 text-[#6B6B6B]" /></button></div>
            <form onSubmit={handleSubmitCategory} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Nombre de la categoría *</label><Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Ej: Collares, Pulseras" disabled={isSubmittingCategory} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
              <div className="flex gap-4 pt-4"><Button type="button" variant="outline" onClick={closeCategoryModal} disabled={isSubmittingCategory} className="flex-1 border-black/10 text-[#1F1F1F] hover:bg-black/5 rounded-xl">Cancelar</Button><Button type="submit" disabled={isSubmittingCategory} className="flex-1 bg-[#1F1F1F] hover:bg-[#C8A46A] text-white rounded-xl transition-colors duration-300">{isSubmittingCategory ? (<span className="flex items-center gap-2"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>Guardando...</span>) : editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}</Button></div>
            </form>
          </div>
        </div>
      )}

      {showBannerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
            <div className="p-6 border-b border-black/5 flex items-center justify-between shrink-0 rounded-t-3xl bg-white"><h2 className="text-xl font-semibold text-[#1F1F1F]">{editingBanner ? 'Editar Banner' : 'Nuevo Banner'}</h2><button type="button" onClick={closeBannerModal} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X className="w-5 h-5 text-[#6B6B6B]" /></button></div>
            <form onSubmit={handleSubmitBanner} onKeyDown={handleBannerKeyDown} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto flex-grow">
                <div>
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Imagen del Banner (PC) *</label>
                  <input ref={bannerInputRef} type="file" accept="image/*" onChange={(e) => setBannerImage(e.target.files?.[0] || null)} disabled={isSubmittingBanner} className="w-full text-sm text-[#6B6B6B] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#FFF9FA] file:text-[#1F1F1F] hover:file:bg-[#D67489]/20 cursor-pointer" />
                  
                  {(currentBannerImage || bannerImage) && (
                    <div className="mt-3 w-full h-40 rounded-xl overflow-hidden border border-black/10 relative">
                      <img src={bannerImage ? URL.createObjectURL(bannerImage) : currentBannerImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ backgroundColor: colorMap[bannerOverlayColor] || '#000', opacity: bannerOverlayOpacity / 100 }}></div>
                      <div className={`absolute inset-0 p-4 flex flex-col z-10 ${posClassMap[bannerTextPosition]}`}>
                        <div className="max-w-[80%]">
                          {bannerTitle1 && <h3 className="font-bold leading-tight" style={{ color: colorMap[bannerTextColor], fontFamily: fontMap[bannerFontFamily], fontSize: 'clamp(1.2rem, 4vw, 2rem)' }}>{bannerTitle1}</h3>}
                          {bannerTitle2 && <h3 className="font-bold leading-tight" style={{ color: colorMap[bannerTextColor2], fontFamily: fontMap[bannerFontFamily], fontSize: 'clamp(1.2rem, 4vw, 2rem)' }}>{bannerTitle2}</h3>}
                          {bannerSubtitle && <p className="mt-1 text-xs sm:text-sm whitespace-pre-line" style={{ color: colorMap[bannerTextColor] }}>{bannerSubtitle}</p>}
                          {bannerButtonText && <span className="mt-2 inline-block bg-[#D67489] text-white text-[10px] px-3 py-1 rounded-full">{bannerButtonText}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-black/5 pt-4">
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Imagen para Móvil (Opcional)</label>
                  <input ref={mobileBannerInputRef} type="file" accept="image/*" onChange={(e) => setBannerMobileImage(e.target.files?.[0] || null)} disabled={isSubmittingBanner} className="w-full text-sm text-[#6B6B6B] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#FFF9FA] file:text-[#1F1F1F] hover:file:bg-[#D67489]/20 cursor-pointer" />
                  {currentMobileBannerImage && <p className="text-[10px] text-green-600 mt-1">Ya tienes una imagen móvil cargada. Sube una nueva para reemplazarla.</p>}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Enfoque de Imagen en Móvil (Si no subes imagen móvil)</label>
                    <select value={bannerMobileImageFocus} onChange={(e) => setBannerMobileImageFocus(e.target.value)} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white">
                      <option value="top">Superior (Ideal si la cara/modelo está arriba)</option>
                      <option value="center">Centro</option>
                      <option value="bottom">Inferior</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-black/5 pt-4">
                  <div className="col-span-2 md:col-span-2">
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Posición (9 Puntos)</label>
                    <select value={bannerTextPosition} onChange={(e) => setBannerTextPosition(e.target.value)} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white">
                      <option value="tl">Superior Izquierda</option><option value="tc">Superior Centro</option><option value="tr">Superior Derecha</option>
                      <option value="ml">Medio Izquierda</option><option value="mc">Medio Centro</option><option value="mr">Medio Derecha</option>
                      <option value="bl">Inferior Izquierda</option><option value="bc">Inferior Centro</option><option value="br">Inferior Derecha</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Fuente</label>
                    <select value={bannerFontFamily} onChange={(e) => setBannerFontFamily(e.target.value)} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white"><option value="playfair">Playfair</option><option value="poppins">Poppins</option><option value="script">Script</option></select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Color 1</label>
                    <select value={bannerTextColor} onChange={(e) => setBannerTextColor(e.target.value)} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white"><option value="white">Blanco</option><option value="dark">Negro</option><option value="gold">Dorado</option><option value="pink">Rosa</option><option value="blue">Azul</option><option value="green">Verde</option><option value="purple">Morado</option></select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Color 2 (Línea 2)</label>
                    <select value={bannerTextColor2} onChange={(e) => setBannerTextColor2(e.target.value)} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white"><option value="white">Blanco</option><option value="dark">Negro</option><option value="gold">Dorado</option><option value="pink">Rosa</option><option value="blue">Azul</option><option value="green">Verde</option><option value="purple">Morado</option></select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-black/5">
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Color del Fondo (Overlay)</label>
                    <select value={bannerOverlayColor} onChange={(e) => setBannerOverlayColor(e.target.value)} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white"><option value="black">Negro</option><option value="white">Blanco</option><option value="dark">Gris Oscuro</option><option value="pink">Rosa</option><option value="gold">Dorado</option><option value="none">Ninguno (Transparente)</option></select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Opacidad del Fondo ({bannerOverlayOpacity}%)</label>
                    <input type="range" min="0" max="100" value={bannerOverlayOpacity} onChange={(e) => setBannerOverlayOpacity(parseInt(e.target.value))} className="w-full h-10 flex items-center accent-[#C8A46A]" />
                  </div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-4">
                  <p className="text-xs font-medium text-[#C8A46A] uppercase tracking-wider">Textos (Opcionales)</p>
                  <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Título Línea 1</label><Input value={bannerTitle1} onChange={(e) => setBannerTitle1(e.target.value)} placeholder="Ej: Descubre detalles" disabled={isSubmittingBanner} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
                  <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Título Línea 2</label><Input value={bannerTitle2} onChange={(e) => setBannerTitle2(e.target.value)} placeholder="Ej: que enamoran" disabled={isSubmittingBanner} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
                  <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Subtítulo</label><Textarea value={bannerSubtitle} onChange={(e) => setBannerSubtitle(e.target.value)} placeholder="Ej: Joyería & Accesorios (Enter para salto de línea)" disabled={isSubmittingBanner} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl min-h-[60px]" /></div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-4">
                  <p className="text-xs font-medium text-[#C8A46A] uppercase tracking-wider">Botón (Opcional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Texto</label><Input value={bannerButtonText} onChange={(e) => setBannerButtonText(e.target.value)} placeholder="Ej: Ver Colección" disabled={isSubmittingBanner} className="border-black/10 focus:border-[#C8A46A] focus:ring-[#C8A46A]/20 rounded-xl" /></div>
                    <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Acción</label><select value={bannerButtonLink} onChange={(e) => setBannerButtonLink(e.target.value)} className="w-full h-10 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8A46A]/20 bg-white"><option value="">Sin Botón</option><option value="/">Ir a Inicio</option><option value="/#catalogo">Ir a Catálogo</option><option value="/#colecciones">Ir a Colecciones</option><option value="/#ofertas">Ir a Ofertas</option></select></div>
                  </div>
                </div>

              </div>
              <div className="p-6 border-t border-black/5 flex gap-4 shrink-0 bg-white rounded-b-3xl"><Button type="button" variant="outline" onClick={closeBannerModal} disabled={isSubmittingBanner} className="flex-1 border-black/10 text-[#1F1F1F] hover:bg-black/5 rounded-xl">Cancelar</Button><Button type="submit" disabled={isSubmittingBanner} className="flex-1 bg-[#1F1F1F] hover:bg-[#C8A46A] text-white rounded-xl transition-colors duration-300">{isSubmittingBanner ? (<span className="flex items-center gap-2"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>Guardando...</span>) : editingBanner ? 'Guardar Cambios' : 'Crear Banner'}</Button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}