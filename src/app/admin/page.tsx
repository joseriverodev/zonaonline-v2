'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Search, Plus, Edit, Trash2, Pause, Play, Package, Tags, LogOut, X, Gem, LayoutDashboard, Check, Loader2, Crown, Settings, ImageIcon, ExternalLink, Image as ImageIconBanner } from 'lucide-react'
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, toggleProductActive, createCategory, updateCategory, deleteCategory } from '@/actions/products'
import { getSiteConfig, updateSiteConfig, getAllBanners, upsertBanner, deleteBanner } from '@/actions/config'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SidebarTrigger } from '@/components/ui/sidebar'
import imageCompression from 'browser-image-compression'
import { login, logout } from '@/actions/auth'

const CLOUD_NAME = "dg4yc"
const UPLOAD_PRESET = "zonaonline_unsigned"

function uploadDirect(file: File): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`)
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', UPLOAD_PRESET)
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText)
        if (res.secure_url) resolve({ url: res.secure_url, publicId: res.public_id })
        else reject(new Error(res.error?.message || 'Error subiendo imagen'))
      } catch (e) { reject(e) }
    }
    xhr.onerror = () => reject(new Error('Error de conexión al subir imagen'))
    xhr.send(form)
  })
}

const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const colorMap: Record<string, string> = {
  white: '#FFFFFF', dark: '#1F1F1F', gold: '#0369A1', pink: '#0369A1',
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

interface ProductVariant { id?: string; name: string; image: string; imageId: string | null; isNew?: boolean; isUploading?: boolean }
interface Product { id: string; name: string; measure: string; price: number; image: string; gallery?: string[]; videoUrl?: string | null; imageId: string | null; isActive: boolean; variants: ProductVariant[]; categoryId: string; category: { id: string; name: string } }
interface Category { id: string; name: string; _count?: { products: number } }
interface Banner { id: string; imageUrl: string; mobileImageUrl: string | null; mobileImageFocus: string; titleLine1: string | null; titleLine2: string | null; subtitle: string | null; buttonText: string | null; buttonLink: string | null; textPosition: string; textColor: string; textColor2: string; fontFamily: string; overlayColor: string; overlayOpacity: number; isActive: boolean }

function SortableImage({ url, index, onRemove, onPreview }: { url: string, index: number, onRemove: (index: number) => void, onPreview: (url: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `img-${index}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative w-full h-24 rounded-xl overflow-hidden border border-black/10 group bg-[#FAFAFA] cursor-grab active:cursor-grabbing touch-none">
      <img src={url} alt={`Imagen ${index}`} className="w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none"></div>
      <button type="button" onClick={(e) => { e.stopPropagation(); onPreview(url); }} className="absolute inset-0 bg-black/0 active:bg-black/30 sm:group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 active:opacity-100 sm:group-hover:opacity-100 z-[5]" title="Ver en grande"><span className="bg-white/90 text-[#0369A1] text-[10px] font-semibold px-2 py-1 rounded-full">Ver</span></button>
      {index === 0 && (<div className="absolute top-1 left-1 bg-[#0369A1] text-white rounded-full p-1 shadow-sm pointer-events-none"><Crown className="w-3 h-3" /></div>)}
      <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1.5 opacity-0 active:opacity-100 sm:group-hover:opacity-100 transition-opacity z-10"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'config' | 'banners'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false)
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false)
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false)
  const [isSubmittingBanner, setIsSubmittingBanner] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{ done: number; total: number } | null>(null)

  const [productName, setProductName] = useState(''); const [productMeasure, setProductMeasure] = useState(''); const [productPrice, setProductPrice] = useState(''); const [productCategory, setProductCategory] = useState(''); const [productVideoUrl, setProductVideoUrl] = useState(''); const [isDragging, setIsDragging] = useState(false); const [unifiedImages, setUnifiedImages] = useState<{ url: string; file?: File }[]>([]); const [externalImageUrl, setExternalImageUrl] = useState(''); const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [cfgWhatsapp, setCfgWhatsapp] = useState(''); const [cfgPhoneCall, setCfgPhoneCall] = useState(''); const [cfgInstagram, setCfgInstagram] = useState(''); const [cfgTiktok, setCfgTiktok] = useState('')

  const [bannerTitle1, setBannerTitle1] = useState(''); const [bannerTitle2, setBannerTitle2] = useState(''); const [bannerSubtitle, setBannerSubtitle] = useState(''); const [bannerButtonText, setBannerButtonText] = useState(''); const [bannerButtonLink, setBannerButtonLink] = useState(''); const [bannerImage, setBannerImage] = useState<File | null>(null); const [currentBannerImage, setCurrentBannerImage] = useState('')
  const [bannerTextPosition, setBannerTextPosition] = useState('ml'); const [bannerTextColor, setBannerTextColor] = useState('white'); const [bannerTextColor2, setBannerTextColor2] = useState('pink'); const [bannerFontFamily, setBannerFontFamily] = useState('playfair')
  const [bannerOverlayColor, setBannerOverlayColor] = useState('black'); const [bannerOverlayOpacity, setBannerOverlayOpacity] = useState(40)
  const [bannerMobileImage, setBannerMobileImage] = useState<File | null>(null); const [currentMobileBannerImage, setCurrentMobileBannerImage] = useState(''); const [bannerMobileImageFocus, setBannerMobileImageFocus] = useState('center')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const mobileBannerInputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  useEffect(() => { const auth = sessionStorage.getItem('adminAuth'); if (auth === 'true') setIsAuthenticated(true) }, [])
  useEffect(() => { if (isAuthenticated) fetchData() }, [isAuthenticated])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [productsData, categoriesData, configData, bannersData] = await Promise.all([getProducts(), getCategories(), getSiteConfig(), getAllBanners()])
      setProducts(productsData as Product[]); setCategories(categoriesData as Category[]); setBanners(bannersData as Banner[])
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
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? product.isActive : !product.isActive
    return matchesSearch && matchesStatus
  })

  const handleToggleActive = async (productId: string) => { try { const result = await toggleProductActive(productId); if (result.success && result.product) { setProducts(products.map(p => p.id === productId ? { ...p, isActive: result.product!.isActive } : p)) } } catch (error) { console.error(error) } }
  const handleDeleteProduct = async (productId: string) => { if (!confirm('¿Eliminar producto?')) return; try { const result = await deleteProduct(productId); if (result.success) setProducts(products.filter(p => p.id !== productId)) } catch (error) { console.error(error) } }
  const handleDeleteCategory = async (categoryId: string) => { if (!confirm('¿Eliminar categoría?')) return; try { const result = await deleteCategory(categoryId); if (result.success) setCategories(categories.filter(c => c.id !== categoryId)); else alert(result.error) } catch (error) { console.error(error) } }

  const handleAddImages = async (files: FileList | File[] | null) => { if (!files) return; const newImages: { url: string; file: File }[] = []; for (const file of Array.from(files)) { newImages.push({ url: URL.createObjectURL(file), file }) }; setUnifiedImages(prev => [...prev, ...newImages]) }
  const handleAddExternalImage = () => { if (!externalImageUrl) return alert('URL inválida.'); setUnifiedImages(prev => [...prev, { url: externalImageUrl }]); setExternalImageUrl('') }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.length) handleAddImages(e.dataTransfer.files) }
  const handleRemoveImage = (index: number) => setUnifiedImages(prev => prev.filter((_, i) => i !== index))
  const handleDragEnd = (event: DragEndEvent) => { const { active, over } = event; if (over && active.id !== over.id) { setUnifiedImages((items) => { const oldIndex = items.findIndex((_, i) => `img-${i}` === active.id); const newIndex = items.findIndex((_, i) => `img-${i}` === over.id); return arrayMove(items, oldIndex, newIndex) }) } }

  const handleAddVariant = () => setProductVariants(prev => [...prev, { name: '', image: '', imageId: null, isNew: true }])
  const handleUpdateVariant = (index: number, field: keyof ProductVariant, value: any) => setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  const handleVariantImageUpload = async (index: number, file: File | null) => {
    if (!file) return
    setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, isUploading: true } : v))
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true })
      const res = await uploadDirect(compressed)
      setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, image: res.url, imageId: res.publicId, isUploading: false } : v))
    } catch (error) {
      console.error(error)
      alert('Error al subir la imagen de la variante')
      setProductVariants(prev => prev.map((v, i) => i === index ? { ...v, isUploading: false } : v))
    }
  }

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingProduct) return; if (!productName.trim() || !productMeasure.trim() || !productPrice || parseFloat(productPrice) <= 0 || !productCategory || unifiedImages.length === 0) return alert('Faltan datos obligatorios')
    setIsSubmittingProduct(true)

    try {
      // 1. Comprimir + subir cada imagen DIRECTO a Cloudinary, en paralelo
      const filesToUpload = unifiedImages.filter(img => img.file)
      const existingUrls = unifiedImages.filter(img => !img.file)

      setUploadStatus({ done: 0, total: filesToUpload.length })

      const uploadedResults = await Promise.all(filesToUpload.map(async (img) => {
        const compressed = await imageCompression(img.file!, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true })
        const res = await uploadDirect(compressed)
        setUploadStatus(prev => prev ? { ...prev, done: prev.done + 1 } : prev)
        return { url: res.url, publicId: res.publicId }
      }))

      // 2. Armar la lista final respetando el orden de la galería (drag & drop)
      let uploadIdx = 0
      const finalImages: { url: string; publicId: string | null }[] = unifiedImages.map(img => {
        if (img.file) {
          const res = uploadedResults[uploadIdx++]
          return { url: res.url, publicId: res.publicId }
        }
        return { url: img.url, publicId: null }
      })

      setUploadStatus(null)

      // 3. Server action solo escribe en la base: sub-second
      const formData = new FormData()
      formData.append('name', productName.trim()); formData.append('measure', productMeasure.trim()); formData.append('price', productPrice); formData.append('categoryId', productCategory); formData.append('videoUrl', productVideoUrl)
      formData.append('finalImages', JSON.stringify(finalImages))
      formData.append('variants', JSON.stringify(productVariants.filter(v => v.name.trim() !== '').map(v => ({ name: v.name, image: v.image, imageId: v.imageId, stock: 99, price: null }))))

      let result = editingProduct ? await updateProduct(editingProduct.id, formData) : await createProduct(formData)
      if (result.success && result.product) {
        if (editingProduct) setProducts(products.map(p => p.id === editingProduct.id ? result.product as Product : p))
        else setProducts([result.product as Product, ...products])
        closeProductModal()
      } else alert(result.error || 'Error')
    } catch (error) {
      console.error(error)
      setUploadStatus(null)
      alert('Error al subir las imágenes. Revisa tu conexión e intenta de nuevo.')
    } finally { setIsSubmittingProduct(false) }
  }

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingCategory || !categoryName.trim()) return
    setIsSubmittingCategory(true); try { const formData = new FormData(); formData.append('name', categoryName.trim()); let result = editingCategory ? await updateCategory(editingCategory.id, formData) : await createCategory(formData); if (result.success && result.category) { if (editingCategory) setCategories(categories.map(c => c.id === editingCategory.id ? result.category as Category : c)); else setCategories([...categories, result.category as Category]); closeCategoryModal() } } catch (error) { console.error(error) } finally { setIsSubmittingCategory(false) }
  }

  const handleSubmitConfig = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmittingConfig) return; setIsSubmittingConfig(true)
    try { const formData = new FormData(); formData.append('whatsapp', cfgWhatsapp); formData.append('phoneCall', cfgPhoneCall); formData.append('instagram', cfgInstagram); formData.append('tiktok', cfgTiktok); const result = await updateSiteConfig(formData); if (result.success) { alert('Configuración guardada'); fetchData() } else alert(result.error) } catch (error) { console.error(error) } finally { setIsSubmittingConfig(false) }
  }

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
    setEditingProduct(product); setProductName(product.name); setProductMeasure(product.measure); setProductPrice(product.price.toString()); setProductCategory(product.categoryId); setProductVideoUrl(product.videoUrl || '')
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

  const closeProductModal = () => { setShowProductModal(false); setEditingProduct(null); setProductName(''); setProductMeasure(''); setProductPrice(''); setProductCategory(''); setProductVideoUrl(''); setUnifiedImages([]); setProductVariants([]); setExternalImageUrl(''); setIsSubmittingProduct(false); setUploadStatus(null); if (fileInputRef.current) fileInputRef.current.value = '' }
  const closeCategoryModal = () => { setShowCategoryModal(false); setEditingCategory(null); setCategoryName(''); setIsSubmittingCategory(false) }
  const closeBannerModal = () => { setShowBannerModal(false); setEditingBanner(null); setBannerTitle1(''); setBannerTitle2(''); setBannerSubtitle(''); setBannerButtonText(''); setBannerButtonLink(''); setBannerImage(null); setCurrentBannerImage(''); setBannerTextPosition('ml'); setBannerTextColor('white'); setBannerTextColor2('pink'); setBannerFontFamily('playfair'); setBannerOverlayColor('black'); setBannerOverlayOpacity(40); setBannerMobileImage(null); setCurrentMobileBannerImage(''); setBannerMobileImageFocus('center'); setIsSubmittingBanner(false); if (bannerInputRef.current) bannerInputRef.current.value = ''; if (mobileBannerInputRef.current) mobileBannerInputRef.current.value = '' }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F0F9FF] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 w-full max-w-md border border-black/5">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white border border-black/5 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"><Gem className="w-8 h-8 text-[#0369A1]" /></div>
            <h1 className="text-2xl font-semibold text-[#1F1F1F] tracking-tight">Panel de Administración</h1>
            <p className="text-[#6B6B6B] mt-2 text-sm">ZonaOnlineVzla</p>
          </div>
          <div className="space-y-4">
            <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="h-14 text-base border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl" />
            {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
            <Button onClick={handleLogin} className="w-full h-14 bg-[#0369A1] hover:bg-[#075985] text-white text-base font-medium rounded-xl transition-colors duration-300">Ingresar</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-black/5 sticky top-0 z-40 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-3 md:px-8 py-3 md:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-[#1F1F1F] hover:bg-black/5 rounded-lg p-2 md:hidden" />
            <img src="/icon.png" alt="Store logo" className="h-9 w-auto md:hidden" />
            <LayoutDashboard className="w-6 h-6 text-[#0369A1] hidden md:block" />
            <span className="text-base md:text-xl font-semibold text-[#1F1F1F] tracking-tight">Panel de Administración</span>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-black/10 text-[#1F1F1F] hover:bg-[#0369A1]/10 hover:text-[#1F1F1F] rounded-xl h-10 md:h-9"><LogOut className="w-4 h-4 mr-2" /> <span className="hidden md:inline">Salir</span></Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 md:px-8 py-5 md:py-8 pb-24 md:pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4 mb-5 md:mb-8">
          <div onClick={() => { setActiveTab('products'); setStatusFilter('all'); }} className={`rounded-xl md:rounded-2xl p-3 md:p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' && activeTab === 'products' ? 'border-[#0369A1] shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-[10px] md:text-xs uppercase tracking-wider mb-1">Total</p><p className="text-2xl md:text-3xl font-semibold text-[#1F1F1F]">{products.length}</p></div>
          <div onClick={() => { setActiveTab('products'); setStatusFilter('active'); }} className={`rounded-xl md:rounded-2xl p-3 md:p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${statusFilter === 'active' && activeTab === 'products' ? 'border-[#0369A1] shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-[10px] md:text-xs uppercase tracking-wider mb-1">Activos</p><p className="text-2xl md:text-3xl font-semibold text-green-600">{products.filter(p => p.isActive).length}</p></div>
          <div onClick={() => { setActiveTab('products'); setStatusFilter('paused'); }} className={`rounded-xl md:rounded-2xl p-3 md:p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${statusFilter === 'paused' && activeTab === 'products' ? 'border-[#0369A1] shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-[10px] md:text-xs uppercase tracking-wider mb-1">Pausados</p><p className="text-2xl md:text-3xl font-semibold text-[#6B6B6B]">{products.filter(p => !p.isActive).length}</p></div>
          <div onClick={() => setActiveTab('categories')} className={`rounded-xl md:rounded-2xl p-3 md:p-5 border bg-white cursor-pointer transition-all hover:shadow-md ${activeTab === 'categories' ? 'border-[#0369A1] shadow-md' : 'border-black/5 shadow-sm'}`}><p className="text-[#6B6B6B] text-[10px] md:text-xs uppercase tracking-wider mb-1">Categorías</p><p className="text-2xl md:text-3xl font-semibold text-[#1F1F1F]">{categories.length}</p></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 mb-5 md:mb-6 overflow-hidden">
          <div className="flex border-b border-black/5 overflow-x-auto">
            <button onClick={() => setActiveTab('products')} className={`flex-1 min-w-[88px] py-3.5 md:py-4 px-3 md:px-6 text-center text-sm md:text-base font-medium transition-colors ${activeTab === 'products' ? 'text-[#0369A1] bg-[#F0F9FF] border-b-2 border-[#0369A1]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><Package className="w-4 h-4 inline-block mr-1.5" /> Productos</button>
            <button onClick={() => setActiveTab('categories')} className={`flex-1 min-w-[88px] py-3.5 md:py-4 px-3 md:px-6 text-center text-sm md:text-base font-medium transition-colors ${activeTab === 'categories' ? 'text-[#0369A1] bg-[#F0F9FF] border-b-2 border-[#0369A1]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><Tags className="w-4 h-4 inline-block mr-1.5" /> Categorías</button>
            <button onClick={() => setActiveTab('banners')} className={`flex-1 min-w-[88px] py-3.5 md:py-4 px-3 md:px-6 text-center text-sm md:text-base font-medium transition-colors ${activeTab === 'banners' ? 'text-[#0369A1] bg-[#F0F9FF] border-b-2 border-[#0369A1]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><ImageIconBanner className="w-4 h-4 inline-block mr-1.5" /> Banners</button>
            <button onClick={() => setActiveTab('config')} className={`flex-1 min-w-[88px] py-3.5 md:py-4 px-3 md:px-6 text-center text-sm md:text-base font-medium transition-colors ${activeTab === 'config' ? 'text-[#0369A1] bg-[#F0F9FF] border-b-2 border-[#0369A1]' : 'text-[#6B6B6B] hover:text-[#1F1F1F] hover:bg-black/5'}`}><Settings className="w-4 h-4 inline-block mr-1.5" /> Configuración</button>
          </div>
        </div>

        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <div className="relative flex-grow"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" /><Input type="text" placeholder="Buscar productos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-12 bg-white border-black/10 rounded-xl focus:border-[#0369A1] focus:ring-[#0369A1]/20" /></div>
              <Button onClick={() => setShowProductModal(true)} className="h-12 bg-[#0369A1] hover:bg-[#075985] rounded-xl px-6 transition-colors duration-300 text-base"><Plus className="w-5 h-5 mr-2" /> Nuevo Producto</Button>
            </div>
            {loading ? (<div className="text-center py-16 bg-white rounded-2xl border border-black/5"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0369A1] mx-auto mb-4"></div><p className="text-[#6B6B6B]">Cargando...</p></div>) : (
              <>
                {/* MÓVIL: tarjetas grandes */}
                <div className="md:hidden space-y-4">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className={`bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden ${!product.isActive ? 'opacity-60' : ''}`}>
                      <div className="relative h-52 bg-[#FAFAFA]" onClick={() => setPreviewImage(product.image)}>
                        {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-[#6B6B6B]" /></div>}
                        <span className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-semibold ${product.isActive ? 'bg-[#0369A1] text-white' : 'bg-[#1F1F1F]/70 text-white'}`}>{product.isActive ? 'Activo' : 'Pausado'}</span>
                        <span className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full">Toca la foto para ampliar</span>
                      </div>
                      <div className="p-4">
                        <p className="font-semibold text-[#1F1F1F] text-base leading-snug">{product.name}</p>
                        <p className="text-sm text-[#6B6B6B] mt-0.5">{product.measure}</p>
                        <div className="flex items-center justify-between mt-2 mb-4">
                          <span className="text-xl font-bold text-[#0369A1]">${product.price.toFixed(2)}</span>
                          <span className="px-2.5 py-1 bg-[#F0F9FF] text-[#0369A1] rounded-full text-xs border border-black/5">{product.category?.name || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <a href={`/?p=${product.id}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl border border-black/10 text-[#0369A1] active:bg-[#F0F9FF] transition-colors"><ExternalLink className="w-6 h-6" /><span className="text-[11px] font-medium">Ver</span></a>
                          <button onClick={() => handleToggleActive(product.id)} className={`flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl border transition-colors ${product.isActive ? 'border-black/10 text-[#6B6B6B] active:bg-black/5' : 'border-[#0369A1] text-[#0369A1] active:bg-[#F0F9FF]'}`} title={product.isActive ? 'Pausar' : 'Activar'}>{product.isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}<span className="text-[11px] font-medium">{product.isActive ? 'Pausar' : 'Activar'}</span></button>
                          <button onClick={() => openEditProduct(product)} className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl border border-black/10 text-[#1F1F1F] active:bg-black/5 transition-colors"><Edit className="w-6 h-6" /><span className="text-[11px] font-medium">Editar</span></button>
                          <button onClick={() => handleDeleteProduct(product.id)} className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl border border-red-200 text-red-500 active:bg-red-50 transition-colors"><Trash2 className="w-6 h-6" /><span className="text-[11px] font-medium">Borrar</span></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (<div className="text-center py-16 bg-white rounded-2xl border border-black/5"><Package className="w-12 h-12 text-black/10 mx-auto mb-4" /><p className="text-[#6B6B6B]">No hay productos en esta lista.</p></div>)}
                </div>

                {/* ESCRITORIO: tabla */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
                  <div className="overflow-x-auto"><table className="w-full"><thead className="bg-[#F0F9FF] border-b border-black/5"><tr><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Producto</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Categoría</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Precio</th><th className="text-left py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Estado</th><th className="text-right py-4 px-6 font-medium text-[#6B6B6B] text-xs uppercase tracking-wider">Acciones</th></tr></thead>
                    <tbody className="divide-y divide-black/5">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className={`hover:bg-[#F0F9FF] transition-colors ${!product.isActive ? 'opacity-60' : ''}`}>
                          <td className="py-4 px-6"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#FAFAFA] rounded-xl overflow-hidden border border-black/5 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#0369A1]/30" onClick={() => setPreviewImage(product.image)} title="Ver imagen en grande">{product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-[#6B6B6B]" /></div>}</div><div><p className="font-medium text-[#1F1F1F]">{product.name}</p><p className="text-sm text-[#6B6B6B]">{product.measure.substring(0, 30)}</p></div></div></td>
                          <td className="py-4 px-6"><span className="px-3 py-1 bg-[#F0F9FF] text-[#0369A1] rounded-full text-xs border border-black/5">{product.category?.name || 'N/A'}</span></td>
                          <td className="py-4 px-6 font-semibold text-[#1F1F1F]">${product.price.toFixed(2)}</td>
                          <td className="py-4 px-6"><span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${product.isActive ? 'bg-[#0369A1]/10 text-[#0369A1]' : 'bg-black/5 text-[#6B6B6B]'}`}>{product.isActive ? 'Activo' : 'Pausado'}</span></td>
                          <td className="py-4 px-6"><div className="flex items-center justify-end gap-1"><a href={`/?p=${product.id}`} target="_blank" rel="noopener noreferrer" title="Ver publicación" className="p-2 rounded-lg text-[#0369A1] hover:bg-[#F0F9FF]"><ExternalLink className="w-4 h-4" /></a><Button variant="ghost" size="sm" onClick={() => handleToggleActive(product.id)} className={`p-2 rounded-lg ${product.isActive ? 'text-[#6B6B6B] hover:bg-black/5' : 'text-[#0369A1] hover:bg-[#F0F9FF]'}`} title={product.isActive ? 'Pausar' : 'Activar'}>{product.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button><Button variant="ghost" size="sm" onClick={() => openEditProduct(product)} className="p-2 rounded-lg text-[#1F1F1F] hover:bg-[#F0F9FF]"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                  {filteredProducts.length === 0 && (<div className="text-center py-16"><Package className="w-12 h-12 text-black/10 mx-auto mb-4" /><p className="text-[#6B6B6B]">No hay productos en esta lista.</p></div>)}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-end"><Button onClick={() => setShowCategoryModal(true)} className="bg-[#0369A1] hover:bg-[#075985] rounded-xl px-6 h-12 transition-colors duration-300 text-base"><Plus className="w-5 h-5 mr-2" /> Nueva Categoría</Button></div>
            {loading ? (<div className="text-center py-16 bg-white rounded-2xl border border-black/5"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0369A1] mx-auto mb-4"></div><p className="text-[#6B6B6B]">Cargando...</p></div>) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {categories.map((category) => (<div key={category.id} className="bg-white rounded-2xl p-4 md:p-5 border border-black/5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"><div><h3 className="font-semibold text-[#1F1F1F] text-lg">{category.name}</h3><p className="text-sm text-[#6B6B6B] mt-1">{category._count?.products || 0} productos</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => openEditCategory(category)} className="p-3 rounded-lg text-[#1F1F1F] hover:bg-[#F0F9FF]"><Edit className="w-5 h-5" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)} className="p-3 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-5 h-5" /></Button></div></div>))}
                {categories.length === 0 && <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-black/5"><Tags className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-[#6B6B6B]">No hay categorías. ¡Agrega la primera!</p></div>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'banners' && (
          <div className="space-y-4">
            <div className="flex justify-end"><Button onClick={() => setShowBannerModal(true)} className="bg-[#0369A1] hover:bg-[#075985] rounded-xl px-6 h-12 transition-colors duration-300 text-base"><Plus className="w-5 h-5 mr-2" /> Nuevo Banner</Button></div>
            {loading ? (<div className="text-center py-16 bg-white rounded-2xl border border-black/5"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0369A1] mx-auto mb-4"></div><p className="text-[#6B6B6B]">Cargando...</p></div>) : (
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
                        {banner.buttonText && <span className="text-[10px] bg-[#0369A1]/10 text-[#0369A1] px-2 py-1 rounded-full">Botón: {banner.buttonText}</span>}
                        <span className="text-[10px] bg-black/5 text-[#6B6B6B] px-2 py-1 rounded-full">Pos: {banner.textPosition}</span>
                        {banner.mobileImageUrl && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full">Img Móvil</span>}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2"><Button variant="ghost" size="sm" onClick={() => openEditBanner(banner)} className="p-2 rounded-lg text-[#1F1F1F] hover:bg-[#F0F9FF]"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteBanner(banner.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></div>
                    </div>
                  </div>
                ))}
                {banners.length === 0 && <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-black/5"><ImageIconBanner className="w-12 h-12 text-black/10 mx-auto mb-4" /><p className="text-[#6B6B6B]">No hay banners creados.</p></div>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="bg-white rounded-2xl p-4 md:p-6 border border-black/5 shadow-sm">
            <h3 className="text-lg font-semibold text-[#1F1F1F] mb-6">Contacto y Redes Sociales</h3>
            <form onSubmit={handleSubmitConfig} className="space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">WhatsApp (Solo números)</label><Input value={cfgWhatsapp} onChange={(e) => setCfgWhatsapp(e.target.value)} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" /></div>
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Teléfono Llamadas</label><Input value={cfgPhoneCall} onChange={(e) => setCfgPhoneCall(e.target.value)} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" /></div>
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Usuario Instagram</label><Input value={cfgInstagram} onChange={(e) => setCfgInstagram(e.target.value)} placeholder="tu_usuario" className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" /></div>
                <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Usuario TikTok</label><Input value={cfgTiktok} onChange={(e) => setCfgTiktok(e.target.value)} placeholder="tu_usuario" className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" /></div>
              </div>
              <div className="pt-2 md:pt-4"><Button type="submit" disabled={isSubmittingConfig} className="w-full md:w-auto md:px-8 h-12 bg-[#0369A1] hover:bg-[#075985] text-white rounded-xl transition-colors duration-300 text-base">{isSubmittingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Guardar Configuración</Button></div>
            </form>
          </div>
        )}
      </main>

      {/* Vista previa de imagen */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-6 right-6 text-white p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-[101]"><X className="w-7 h-7" /></button>
          <img src={previewImage} alt="Vista previa" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center sm:p-6 overflow-hidden">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:max-w-3xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col">
            <div className="p-4 md:p-6 border-b border-black/5 flex items-center justify-between shrink-0 sm:rounded-t-3xl bg-white">
              <div className="flex items-center gap-3">
                <h2 className="text-lg md:text-xl font-semibold text-[#1F1F1F]">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                {editingProduct && <a href={`/?p=${editingProduct.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0369A1] bg-[#F0F9FF] px-3 py-1.5 rounded-full active:bg-[#0369A1]/20"><ExternalLink className="w-3.5 h-3.5" /> Ver publicación</a>}
              </div>
              <button type="button" onClick={closeProductModal} className="p-2.5 hover:bg-black/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-[#6B6B6B]" />
              </button>
            </div>
            <form onSubmit={handleSubmitProduct} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 md:p-6 space-y-7 overflow-y-auto flex-grow">

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[#0369A1] uppercase tracking-wider">Información Básica</h3>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Nombre del producto *</label>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ej: Camiseta de algodón talla M" disabled={isSubmittingProduct || !!uploadStatus} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Descripción / Detalles *</label>
                    <Textarea value={productMeasure} onChange={(e) => setProductMeasure(e.target.value)} placeholder="Ej: Algodón, incluye bolsa de regalo." disabled={isSubmittingProduct || !!uploadStatus} className="border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl min-h-[80px] text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Categoría *</label>
                    <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} disabled={isSubmittingProduct || !!uploadStatus} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1] disabled:opacity-50 bg-white text-base">
                      <option value="">Seleccionar categoría</option>
                      {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <h3 className="text-sm font-medium text-[#0369A1] uppercase tracking-wider">Precio</h3>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">Precio ($) *</label>
                    <Input type="number" step="0.01" min="0" inputMode="decimal" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="0.00" disabled={isSubmittingProduct || !!uploadStatus} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" />
                  </div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <h3 className="text-sm font-medium text-[#0369A1] uppercase tracking-wider">Galería del Producto</h3>
                  <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`flex items-center justify-center w-full h-32 border-2 ${isDragging ? 'border-[#0369A1] bg-[#F0F9FF]' : 'border-black/10 border-dashed'} rounded-2xl cursor-pointer bg-[#FAFAFA] hover:bg-[#F0F9FF] transition-colors relative`}>
                    <label htmlFor="dropzone-file" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer w-full h-full">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className={`w-8 h-8 mb-3 ${isDragging ? 'text-[#0369A1]' : 'text-[#6B6B6B]'}`} />
                        <p className="mb-2 text-sm text-[#1F1F1F]"><span className="font-semibold">Haz clic para subir</span> o arrastra aquí</p>
                        <p className="text-xs text-[#6B6B6B]">La 1ra imagen será la portada</p>
                      </div>
                      <input id="dropzone-file" ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleAddImages(e.target.files)} disabled={isSubmittingProduct || !!uploadStatus} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Input type="text" value={externalImageUrl} onChange={(e) => setExternalImageUrl(e.target.value)} placeholder="O pega una URL de imagen externa aquí..." className="border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl" disabled={isSubmittingProduct || !!uploadStatus} />
                    <Button type="button" onClick={handleAddExternalImage} variant="outline" disabled={isSubmittingProduct || !!uploadStatus} className="border-black/10 text-[#1F1F1F] hover:bg-[#F0F9FF] rounded-xl">Añadir URL</Button>
                  </div>
                  {unifiedImages.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-black/5">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={unifiedImages.map((_, i) => `img-${i}`)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                            {unifiedImages.map((img, index) => (
                              <SortableImage key={`img-${index}`} url={img.url} index={index} onRemove={handleRemoveImage} onPreview={setPreviewImage} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                      <p className="text-[10px] text-[#6B6B6B] mt-3 text-center">Arrastra la imagen para reordenar. La primera es la portada.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <h3 className="text-sm font-medium text-[#0369A1] uppercase tracking-wider">Multimedia Extra</h3>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2">URL del Video (YouTube, TikTok, Drive) - Opcional</label>
                    <Input type="url" value={productVideoUrl} onChange={(e) => setProductVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." disabled={isSubmittingProduct || !!uploadStatus} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl" />
                    <p className="text-[10px] text-[#6B6B6B] mt-1">Si pegas un link aquí, aparecerá un botón de "Ver Video" en el producto.</p>
                  </div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#0369A1] uppercase tracking-wider">Variantes (Colores / Modelos)</h3>
                    <Button type="button" onClick={handleAddVariant} variant="outline" disabled={isSubmittingProduct || !!uploadStatus} className="border-black/10 text-[#1F1F1F] hover:bg-[#F0F9FF] rounded-xl h-10 text-sm px-4">
                      <Plus className="w-4 h-4 mr-1" /> Añadir
                    </Button>
                  </div>
                  {productVariants.length > 0 ? (
                    <div className="space-y-3">
                      {productVariants.map((variant, index) => (
                        <div key={index} className="p-3 bg-[#FAFAFA] rounded-xl border border-black/5 space-y-3">
                          <div className="flex items-center gap-3">
                            <label className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-white rounded-lg border border-black/10 cursor-pointer overflow-hidden">
                              {variant.isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-[#0369A1]" />
                              ) : variant.image ? (
                                <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-6 h-6 text-[#6B6B6B]" />
                              )}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleVariantImageUpload(index, e.target.files?.[0] || null)} disabled={isSubmittingProduct || !!uploadStatus} />
                            </label>
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                value={variant.name}
                                onChange={(e) => handleUpdateVariant(index, 'name', e.target.value)}
                                placeholder="Nombre (Ej: Rojo)"
                                className="w-full h-11 px-3 border border-black/10 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white"
                                disabled={isSubmittingProduct}
                              />
                              <input
                                type="url"
                                value={variant.image || ''}
                                onChange={(e) => {
                                  handleUpdateVariant(index, 'image', e.target.value)
                                  handleUpdateVariant(index, 'imageId', null)
                                }}
                                placeholder="O pega URL de imagen externa aquí..."
                                className="w-full h-10 px-3 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white"
                                disabled={isSubmittingProduct}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setProductVariants(prev => prev.filter((_, i) => i !== index))}
                              disabled={isSubmittingProduct}
                              className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6B6B6B] text-center py-4">Sin variantes. El producto usará su imagen principal.</p>
                  )}
                </div>
              </div>

              <div className="p-4 md:p-6 border-t border-black/5 flex gap-4 shrink-0 bg-white sm:rounded-b-3xl">
                <Button type="button" variant="outline" onClick={closeProductModal} disabled={isSubmittingProduct || !!uploadStatus} className="flex-1 h-12 border-black/10 text-[#1F1F1F] hover:bg-black/5 rounded-xl text-base">Cancelar</Button>
                <Button type="submit" disabled={isSubmittingProduct || !!uploadStatus} className="flex-1 h-12 bg-[#0369A1] hover:bg-[#075985] text-white rounded-xl transition-colors duration-300 text-base">
                  {uploadStatus ? (
                    <span>Subiendo imágenes {uploadStatus.done}/{uploadStatus.total}...</span>
                  ) : isSubmittingProduct ? (
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl">
            <div className="p-5 border-b flex items-center justify-between"><h2 className="text-xl font-bold text-[#1F1F1F]">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h2><button type="button" onClick={closeCategoryModal} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmitCategory} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-[#6B6B6B] mb-2">Nombre de la categoría *</label><Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Ej: Ropa, Calzado, Accesorios" disabled={isSubmittingCategory} className="h-12 focus:border-[#0369A1] focus:ring-[#0369A1]/20 text-base" /></div>
              <div className="flex gap-4 pt-2"><Button type="button" variant="outline" onClick={closeCategoryModal} disabled={isSubmittingCategory} className="flex-1 h-12">Cancelar</Button><Button type="submit" disabled={isSubmittingCategory} className="flex-1 h-12 bg-[#0369A1] hover:bg-[#075985] text-white">{isSubmittingCategory ? (<span className="flex items-center gap-2"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>Guardando...</span>) : editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}</Button></div>
            </form>
          </div>
        </div>
      )}

      {showBannerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center sm:p-6 overflow-hidden">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:max-w-lg sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col">
            <div className="p-4 md:p-6 border-b border-black/5 flex items-center justify-between shrink-0 sm:rounded-t-3xl bg-white"><h2 className="text-lg md:text-xl font-semibold text-[#1F1F1F]">{editingBanner ? 'Editar Banner' : 'Nuevo Banner'}</h2><button type="button" onClick={closeBannerModal} className="p-2.5 hover:bg-black/5 rounded-full transition-colors"><X className="w-5 h-5 text-[#6B6B6B]" /></button></div>
            <form onSubmit={handleSubmitBanner} onKeyDown={handleBannerKeyDown} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 md:p-6 space-y-6 overflow-y-auto flex-grow">
                <div>
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Imagen del Banner (PC) *</label>
                  <input ref={bannerInputRef} type="file" accept="image/*" onChange={(e) => setBannerImage(e.target.files?.[0] || null)} disabled={isSubmittingBanner} className="w-full text-sm text-[#6B6B6B] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#F0F9FF] file:text-[#0369A1] hover:file:bg-[#0369A1]/20 cursor-pointer" />

                  {(currentBannerImage || bannerImage) && (
                    <div className="mt-3 w-full h-40 rounded-xl overflow-hidden border border-black/10 relative">
                      <img src={bannerImage ? URL.createObjectURL(bannerImage) : currentBannerImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ backgroundColor: colorMap[bannerOverlayColor] || '#000', opacity: bannerOverlayOpacity / 100 }}></div>
                      <div className={`absolute inset-0 p-4 flex flex-col z-10 ${posClassMap[bannerTextPosition]}`}>
                        <div className="max-w-[80%]">
                          {bannerTitle1 && <h3 className="font-bold leading-tight" style={{ color: colorMap[bannerTextColor], fontFamily: fontMap[bannerFontFamily], fontSize: 'clamp(1.2rem, 4vw, 2rem)' }}>{bannerTitle1}</h3>}
                          {bannerTitle2 && <h3 className="font-bold leading-tight" style={{ color: colorMap[bannerTextColor2], fontFamily: fontMap[bannerFontFamily], fontSize: 'clamp(1.2rem, 4vw, 2rem)' }}>{bannerTitle2}</h3>}
                          {bannerSubtitle && <p className="mt-1 text-xs sm:text-sm whitespace-pre-line" style={{ color: colorMap[bannerTextColor] }}>{bannerSubtitle}</p>}
                          {bannerButtonText && <span className="mt-2 inline-block bg-[#0369A1] text-white text-[10px] px-3 py-1 rounded-full">{bannerButtonText}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-black/5 pt-4">
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Imagen para Móvil (Opcional)</label>
                  <input ref={mobileBannerInputRef} type="file" accept="image/*" onChange={(e) => setBannerMobileImage(e.target.files?.[0] || null)} disabled={isSubmittingBanner} className="w-full text-sm text-[#6B6B6B] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#F0F9FF] file:text-[#0369A1] hover:file:bg-[#0369A1]/20 cursor-pointer" />
                  {currentMobileBannerImage && <p className="text-[10px] text-green-600 mt-1">Ya tienes una imagen móvil cargada. Sube una nueva para reemplazarla.</p>}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Enfoque de Imagen en Móvil</label>
                    <select value={bannerMobileImageFocus} onChange={(e) => setBannerMobileImageFocus(e.target.value)} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white text-base">
                      <option value="top">Superior</option>
                      <option value="center">Centro</option>
                      <option value="bottom">Inferior</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-black/5 pt-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Posición</label>
                    <select value={bannerTextPosition} onChange={(e) => setBannerTextPosition(e.target.value)} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white text-base">
                      <option value="tl">Arriba Izq.</option><option value="tc">Arriba Centro</option><option value="tr">Arriba Der.</option>
                      <option value="ml">Medio Izq.</option><option value="mc">Medio Centro</option><option value="mr">Medio Der.</option>
                      <option value="bl">Abajo Izq.</option><option value="bc">Abajo Centro</option><option value="br">Abajo Der.</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Fuente</label>
                    <select value={bannerFontFamily} onChange={(e) => setBannerFontFamily(e.target.value)} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white text-base"><option value="playfair">Playfair</option><option value="poppins">Poppins</option><option value="script">Script</option></select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Color 1</label>
                    <select value={bannerTextColor} onChange={(e) => setBannerTextColor(e.target.value)} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white text-base"><option value="white">Blanco</option><option value="dark">Negro</option><option value="gold">Azul</option><option value="pink">Azul claro</option><option value="blue">Celeste</option><option value="green">Verde</option><option value="purple">Morado</option></select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Color 2</label>
                    <select value={bannerTextColor2} onChange={(e) => setBannerTextColor2(e.target.value)} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white text-base"><option value="white">Blanco</option><option value="dark">Negro</option><option value="gold">Azul</option><option value="pink">Azul claro</option><option value="blue">Celeste</option><option value="green">Verde</option><option value="purple">Morado</option></select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Color del Fondo (Overlay)</label>
                  <select value={bannerOverlayColor} onChange={(e) => setBannerOverlayColor(e.target.value)} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white text-base"><option value="black">Negro</option><option value="white">Blanco</option><option value="dark">Gris Oscuro</option><option value="gold">Azul</option><option value="pink">Azul claro</option><option value="none">Ninguno (Transparente)</option></select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-2 uppercase tracking-wider">Opacidad del Fondo ({bannerOverlayOpacity}%)</label>
                  <input type="range" min="0" max="100" value={bannerOverlayOpacity} onChange={(e) => setBannerOverlayOpacity(parseInt(e.target.value))} className="w-full h-10 flex items-center accent-[#0369A1]" />
                </div>

                <div className="space-y-4 border-t border-black/5 pt-4">
                  <p className="text-xs font-medium text-[#0369A1] uppercase tracking-wider">Textos (Opcionales)</p>
                  <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Título Línea 1</label><Input value={bannerTitle1} onChange={(e) => setBannerTitle1(e.target.value)} disabled={isSubmittingBanner} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" /></div>
                  <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Título Línea 2</label><Input value={bannerTitle2} onChange={(e) => setBannerTitle2(e.target.value)} disabled={isSubmittingBanner} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" /></div>
                  <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Subtítulo</label><Textarea value={bannerSubtitle} onChange={(e) => setBannerSubtitle(e.target.value)} disabled={isSubmittingBanner} className="border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl min-h-[60px] text-base" /></div>
                </div>

                <div className="space-y-4 border-t border-black/5 pt-4">
                  <p className="text-xs font-medium text-[#0369A1] uppercase tracking-wider">Botón (Opcional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Texto</label><Input value={bannerButtonText} onChange={(e) => setBannerButtonText(e.target.value)} disabled={isSubmittingBanner} className="h-12 border-black/10 focus:border-[#0369A1] focus:ring-[#0369A1]/20 rounded-xl text-base" /></div>
                    <div><label className="block text-xs font-medium text-[#6B6B6B] mb-2">Acción</label><select value={bannerButtonLink} onChange={(e) => setBannerButtonLink(e.target.value)} className="w-full h-12 px-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 bg-white text-base"><option value="">Sin Botón</option><option value="/">Ir a Inicio</option><option value="/#catalogo">Ir a Catálogo</option><option value="/#colecciones">Ir a Colecciones</option></select></div>
                  </div>
                </div>

              </div>
              <div className="p-4 md:p-6 border-t border-black/5 flex gap-4 shrink-0 bg-white sm:rounded-b-3xl"><Button type="button" variant="outline" onClick={closeBannerModal} disabled={isSubmittingBanner} className="flex-1 h-12 border-black/10 text-[#1F1F1F] hover:bg-black/5 rounded-xl text-base">Cancelar</Button><Button type="submit" disabled={isSubmittingBanner} className="flex-1 h-12 bg-[#0369A1] hover:bg-[#075985] text-white rounded-xl transition-colors duration-300 text-base">{isSubmittingBanner ? (<span className="flex items-center gap-2"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>Guardando...</span>) : editingBanner ? 'Guardar Cambios' : 'Crear Banner'}</Button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}