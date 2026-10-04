'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from '@/components/ui/carousel'
import { Search, Gem, Truck, Heart, ShieldCheck, ArrowRight, ShoppingBag, Plus, Minus, X, Trash2, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'

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

interface ProductVariant { id: string; name: string; image: string; imageId: string | null; stock: number; price?: number | null }
interface Product {
  id: string; name: string; measure: string; price: number; salePrice?: number | null; stock: number;
  image: string; imageId: string | null; isActive: boolean;
  gallery?: string[]; videoUrl?: string | null;
  categoryId: string; category: { id: string; name: string }; variants?: ProductVariant[]
}
interface Category { id: string; name: string }
interface CartItem { product: Product; variant: ProductVariant | null; quantity: number; }

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [config, setConfig] = useState<any>(null)
  const [banners, setBanners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)

  const [api, setApi] = useState<CarouselApi>()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes, configRes, bannersRes] = await Promise.all([
          fetch('/api/products'), fetch('/api/categories'), fetch('/api/config'), fetch('/api/banners')
        ])
        if (productsRes.ok) setProducts((await productsRes.json()).filter((p: Product) => p.isActive !== false))
        if (categoriesRes.ok) setCategories(await categoriesRes.json())
        if (configRes.ok) setConfig(await configRes.json())
        if (bannersRes.ok) setBanners(await bannersRes.json())
      } catch (error) { console.error('Error:', error) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!api || banners.length <= 1) return
    const interval = setInterval(() => { api.scrollNext() }, 5000)
    return () => clearInterval(interval)
  }, [api, banners.length])

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash
      if (hash === '#colecciones') document.getElementById('colecciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else if (hash === '#catalogo') document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    handleHash(); window.addEventListener('hashchange', handleHash); return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const filteredProducts = products.filter(product => {
    if (product.isActive === false) return false
    const matchesCategory = activeCategory === 'Todos' || product.category?.name === activeCategory
    const matchesSearch = searchQuery === '' || normalizeText(product.name).includes(normalizeText(searchQuery)) || normalizeText(product.measure).includes(normalizeText(searchQuery)) || normalizeText(product.category?.name).includes(normalizeText(searchQuery))
    return matchesCategory && matchesSearch
  })

  const categoriesWithImages = useMemo(() => {
    return categories.map(cat => { const firstProduct = products.find(p => p.categoryId === cat.id && p.isActive); return { ...cat, image: firstProduct ? firstProduct.image : '' } }).filter(cat => cat.image)
  }, [categories, products])
  // Abre la publicación exacta si la URL trae ?p=ID (links desde el admin o compartidos)
  useEffect(() => {
    if (loading || products.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const productId = params.get('p')
    if (productId) {
      const found = products.find(p => p.id === productId)
      if (found) {
        setSelectedProduct(found)
        setModalOpen(true)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [loading, products])

  const handleCategoryClick = (catName: string) => { setActiveCategory(catName); setTimeout(() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100) }
  const handlePillClick = (catName: string) => { setActiveCategory(catName) }

  const addToCart = (product: Product, variant: ProductVariant | null, quantity: number = 1) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id && ((item.variant === null && variant === null) || (item.variant?.id === variant?.id)))
      if (existingItem) {
        return prevCart.map(item => item === existingItem ? { ...item, quantity: item.quantity + quantity } : item)
      } else { return [...prevCart, { product, variant, quantity }] }
    }); setModalOpen(false)
  }
  const removeFromCart = (index: number) => setCart(prevCart => prevCart.filter((_, i) => i !== index))
  const updateQuantity = (index: number, newQuantity: number) => { if (newQuantity < 1) return; setCart(prevCart => prevCart.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item)) }

  const subtotal = cart.reduce((total, item) => {
    const itemPrice = item.variant?.price ? item.variant.price : item.product.price
    return total + (itemPrice * item.quantity)
  }, 0)
  const total = subtotal

  const sendWhatsAppOrder = () => {
    if (cart.length === 0) return
    let message = "📦 *NUEVO PEDIDO:*\n\n"
    cart.forEach((item, index) => {
      const name = item.product.name; const variantName = item.variant ? ` (${item.variant.name})` : ""; const desc = item.product.measure
      const itemPrice = item.variant?.price ? item.variant.price : item.product.price; const price = itemPrice.toFixed(2)
      const photo = item.variant && item.variant.image ? item.variant.image : item.product.image
      message += `🔸 ${name}${variantName} - ${desc} - $${price}\n`; message += `🔗 Foto: ${photo}`; if (index < cart.length - 1) message += `\n\n`
    })
    message += `\n\n`
    message += `💰 *Total: $${total.toFixed(2)}*`
    const waNumber = config?.whatsapp || "000000000000"
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] flex flex-col">
      <header className="sticky top-0 z-50 flex h-[80px] shrink-0 items-center border-b border-black/5 bg-white px-4 md:px-8 shadow-[0_1px_0_rgba(0,0,0,0.04)] gap-4">
        <SidebarTrigger className="text-[#1F1F1F] hover:bg-black/5 rounded-lg p-2 md:hidden" />
        <a href="/" className="flex items-center shrink-0 h-10 md:h-12"><img src="/icon.png" alt="Store logo" className="h-8 md:h-15 w-auto object-contain" /></a>
        <div className="flex w-full max-w-[520px] mx-auto items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-2.5 shadow-sm focus-within:border-[#0369A1]/30 transition-colors"><Search className="h-5 h-5 text-[#6B6B6B]" /><Input type="text" placeholder="Busca productos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm text-[#1F1F1F] placeholder:text-[#6B6B6B]" /></div>
      </header>

      <main className="flex-1 px-4 md:px-8 pb-8 pt-6">

        {/* CARRUSEL BANNERS PREMIUM */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] relative">
          {banners.length > 0 ? (
            <Carousel opts={{ loop: true, align: 'start' }} setApi={setApi} className="w-full">
              <CarouselContent>
                {banners.map((banner) => {
                  const posClass = posClassMap[banner.textPosition] || posClassMap['ml'];
                  const color1 = colorMap[banner.textColor] || '#FFFFFF';
                  const color2 = colorMap[banner.textColor2] || '#0369A1';
                  const fontFamily = fontMap[banner.fontFamily] || 'var(--font-playfair)';
                  const oColor = colorMap[banner.overlayColor] || '#000000';
                  const oOpacity = (banner.overlayOpacity ?? 0) / 100;

                  const focusMap: Record<string, string> = { top: 'object-top', center: 'object-center', bottom: 'object-bottom' };
                  const mobileFocus = focusMap[banner.mobileImageFocus] || 'object-center';

                  return (
                    <CarouselItem key={banner.id}>
                      <div className="relative h-[300px] md:h-[400px] w-full overflow-hidden">
                        <img src={banner.imageUrl} alt={banner.titleLine1 || 'Banner'} className="absolute inset-0 w-full h-full object-cover hidden md:block" />
                        <img src={banner.mobileImageUrl || banner.imageUrl} alt={banner.titleLine1 || 'Banner'} className={`absolute inset-0 w-full h-full object-cover md:hidden ${mobileFocus}`} />

                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: oColor, opacity: oOpacity }}></div>

                        <div className={`absolute inset-0 p-6 md:p-12 flex flex-col z-10 overflow-hidden ${posClass}`}>
                          <div className="max-w-xl">
                            {banner.titleLine1 && <h1 className="font-bold leading-tight tracking-[-0.02em] whitespace-pre-line" style={{ color: color1, fontFamily, fontSize: 'clamp(1.8rem, 5vw, 3.5rem)' }}>{banner.titleLine1}</h1>}
                            {banner.titleLine2 && <h1 className="font-bold leading-tight tracking-[-0.02em] whitespace-pre-line" style={{ color: color2, fontFamily, fontSize: 'clamp(1.8rem, 5vw, 3.5rem)' }}>{banner.titleLine2}</h1>}
                            {banner.subtitle && <p className="mt-2 md:mt-4 font-light whitespace-pre-line" style={{ color: color1, fontSize: 'clamp(0.8rem, 2vw, 1.1rem)' }}>{banner.subtitle}</p>}
                            {banner.buttonText && banner.buttonLink && (
                              <a href={banner.buttonLink} className="mt-4 md:mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0369A1] px-5 md:px-8 py-2.5 md:py-3.5 text-xs md:text-sm font-medium text-white shadow-md hover:bg-[#075985] transition-all duration-300">
                                {banner.buttonText} <ArrowRight className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  )
                })}
              </CarouselContent>
              {banners.length > 1 && (<><CarouselPrevious className="left-4 bg-black/30 hover:bg-black/50 text-white border-none" /><CarouselNext className="right-4 bg-black/30 hover:bg-black/50 text-white border-none" /></>)}
            </Carousel>
          ) : (
            <div className="relative h-[300px] md:h-[400px] w-full bg-[#FAFAFA] flex items-center justify-center"><p className="text-[#6B6B6B]">No hay banners activos.</p></div>
          )}
        </section>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-black/5">
          {[{ icon: Gem, title: "Calidad Premium", desc: "Materiales duraderos" }, { icon: Heart, title: "Hecho con Amor", desc: "Diseños únicos" }, { icon: Truck, title: "Envío Seguro", desc: "A todo el país" }, { icon: ShieldCheck, title: "Pago Protegido", desc: "100% confiable" }].map((badge, i) => (
            <div key={i} className={`flex items-center gap-4 px-2 ${i % 2 !== 0 ? 'md:border-l border-black/5' : ''} ${i === 2 ? 'border-t md:border-t-0 border-black/5 pt-4 md:pt-0' : ''} ${i === 3 ? 'border-l border-t md:border-t-0 border-black/5 pt-4 md:pt-0' : ''}`}><badge.icon className="h-7 w-7 text-[#0369A1] flex-shrink-0" /><div><h3 className="text-sm font-medium text-[#1F1F1F] tracking-tight">{badge.title}</h3><p className="text-xs text-[#6B6B6B] mt-0.5">{badge.desc}</p></div></div>
          ))}
        </div>

        <section id="colecciones" className="mt-12 mb-8 scroll-mt-20">
          <div className="text-center mb-8"><p className="text-xs uppercase tracking-[0.2em] text-[#0369A1] font-medium mb-2">Colecciones</p><h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-[#1F1F1F]" style={{ fontFamily: 'var(--font-playfair)' }}>Categorías Destacadas</h2></div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categoriesWithImages.map(cat => (<div key={cat.id} onClick={() => handleCategoryClick(cat.name)} className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer border border-black/5 shadow-sm hover:shadow-md transition-shadow"><img src={cat.image} alt={cat.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4"><h3 className="text-white font-medium text-lg tracking-wide" style={{ fontFamily: 'var(--font-playfair)' }}>{cat.name}</h3></div><div className="absolute inset-0 bg-[#0369A1]/0 group-hover:bg-[#0369A1]/10 transition-colors"></div></div>))}
          </div>
        </section>

        <section className="mt-12 mb-4">
          <div className="flex items-end justify-between mb-6"><div><p className="text-xs uppercase tracking-[0.2em] text-[#0369A1] font-medium mb-2">Catálogo</p><h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-[#1F1F1F]" style={{ fontFamily: 'var(--font-playfair)' }}>{searchQuery ? 'Resultados' : activeCategory === 'Todos' ? 'Nuestros Productos' : activeCategory}</h2></div></div>
          <div className="flex flex-wrap gap-2 mb-8">
            <button onClick={() => handlePillClick('Todos')} className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${activeCategory === 'Todos' ? 'bg-[#0369A1] text-white border-[#0369A1]' : 'bg-white text-[#1F1F1F] border-black/10 hover:border-[#0369A1]'}`}>Todos</button>
            {categories.map(cat => (<button key={cat.id} onClick={() => handlePillClick(cat.name)} className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${activeCategory === cat.name ? 'bg-[#0369A1] text-white border-[#0369A1]' : 'bg-white text-[#1F1F1F] border-black/10 hover:border-[#0369A1]'}`}>{cat.name}</button>))}
          </div>
          <div id="catalogo" className="scroll-mt-20">
            {loading ? (<div className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0369A1] mx-auto mb-4"></div><p className="text-[#6B6B6B] text-sm">Cargando...</p></div>) : (<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">{filteredProducts.map((product) => (<ProductCard key={product.id} product={product} onClick={() => { setSelectedProduct(product); setModalOpen(true) }} />))}</div>)}
            {!loading && filteredProducts.length === 0 && (<div className="text-center py-20"><Gem className="w-12 h-12 text-[#0369A1]/30 mx-auto mb-4" /><p className="text-[#6B6B6B]">No encontramos lo que buscas.</p></div>)}
          </div>
        </section>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent showCloseButton={false} className="!w-[95vw] sm:!max-w-[800px] max-h-[90vh] p-0 overflow-hidden bg-white rounded-3xl border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.08)] flex flex-col md:grid md:grid-cols-2">
          <DialogClose className="absolute right-4 top-4 z-50 rounded-full bg-black/5 p-2 text-[#1F1F1F] hover:bg-black/10 transition-colors"><X className="w-4 h-4" /></DialogClose>
          {selectedProduct && <QuickViewContent product={selectedProduct} addToCart={addToCart} />}
        </DialogContent>
      </Dialog>

            {cart.length > 0 && (<button onClick={() => setCartOpen(true)} className="fixed bottom-4 right-4 md:bottom-8 md:right-8 bg-[#0369A1] text-white p-4 rounded-2xl shadow-lg hover:bg-[#075985] transition-colors z-30 flex items-center gap-3"><ShoppingBag className="w-6 h-6" /><span className="font-medium">{cart.length}</span></button>)}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent showCloseButton={false} className="!w-[95vw] sm:!max-w-[500px] max-h-[90vh] p-0 overflow-hidden bg-white rounded-3xl border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.08)] flex flex-col">
          <div className="p-6 border-b border-black/5 flex items-center justify-between shrink-0"><h2 className="text-xl font-semibold text-[#1F1F1F]">Tu Pedido</h2><DialogClose className="rounded-full bg-black/5 p-2 text-[#1F1F1F] hover:bg-black/10 transition-colors"><X className="w-4 h-4" /></DialogClose></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (<div className="text-center py-10"><ShoppingBag className="w-12 h-12 text-black/10 mx-auto mb-4" /><p className="text-[#6B6B6B]">Tu carrito está vacío</p></div>) : (
              <>
                                {cart.map((item, index) => { const itemPrice = item.variant?.price ? item.variant.price : item.product.price; return (
                  <div key={index} className="flex gap-4 border-b border-black/5 pb-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#FAFAFA] flex-shrink-0 border border-black/5"><img src={item.variant && item.variant.image ? item.variant.image : item.product.image} alt={item.product.name} className="w-full h-full object-cover" /></div>
                    <div className="flex-1"><h3 className="font-medium text-[#1F1F1F] text-sm">{item.product.name}</h3>{item.variant && <p className="text-xs text-[#6B6B6B]">{item.variant.name}</p>}<p className="text-sm text-[#0369A1] font-semibold mt-1">${itemPrice.toFixed(2)}</p></div>
                    <div className="flex flex-col items-end justify-between shrink-0">
                      <button onClick={() => removeFromCart(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>) })}
              </>
            )}
          </div>
          {cart.length > 0 && (<div className="p-6 border-t border-black/5 bg-white shrink-0"><div className="flex justify-between items-center mb-4"><span className="text-[#6B6B6B] text-sm font-semibold">Total:</span><span className="text-2xl font-bold text-[#0369A1]">${total.toFixed(2)}</span></div><button onClick={sendWhatsAppOrder} className="w-full bg-[#0369A1] text-white font-medium py-3 rounded-xl text-sm hover:bg-[#075985] transition-colors duration-300 flex items-center justify-center gap-2">ENVIAR PEDIDO POR WHATSAPP <ArrowRight className="w-4 h-4" /></button></div>)}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuickViewContent({ product, addToCart }: { product: Product, addToCart: (p: Product, v: ProductVariant | null) => void }) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isZoomOpen, setIsZoomOpen] = useState(false)
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({ transform: 'scale(1)' })
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const allImages = useMemo(() => Array.from(new Set([product.image, ...(product.gallery || []), ...(product.variants?.map(v => v.image).filter(Boolean) || [])])), [product.image, product.gallery, product.variants])

  const handleNext = () => { setActiveIndex((prev) => { const newIndex = (prev + 1) % allImages.length; const matchedVariant = product.variants?.find(v => v.image && v.image === allImages[newIndex]) || null; setSelectedVariant(matchedVariant); return newIndex }) }
  const handlePrev = () => { setActiveIndex((prev) => { const newIndex = (prev - 1 + allImages.length) % allImages.length; const matchedVariant = product.variants?.find(v => v.image && v.image === allImages[newIndex]) || null; setSelectedVariant(matchedVariant); return newIndex }) }
  const handleDotClick = (i: number) => { setActiveIndex(i); const matchedVariant = product.variants?.find(v => v.image && v.image === allImages[i]) || null; setSelectedVariant(matchedVariant) }
  const handleVariantSelect = (variant: ProductVariant | null) => { setSelectedVariant(variant); if (variant && variant.image) { const idx = allImages.findIndex(img => img === variant.image); if (idx !== -1) setActiveIndex(idx) } else if (!variant) { setActiveIndex(0) } }

  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX) }
  const onTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX) }
  const onTouchEnd = () => { if (!touchStart || !touchEnd) return; const distance = touchStart - touchEnd; if (distance > 50) handleNext(); if (distance < -50) handlePrev(); setTouchStart(null); setTouchEnd(null) }
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { const { left, top, width, height } = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - left) / width) * 100; const y = ((e.clientY - top) / height) * 100; setZoomStyle({ transformOrigin: `${x}% ${y}%`, transform: 'scale(2.2)' }) }
  const handleMouseLeave = () => setZoomStyle({ transform: 'scale(1)' })

  const currentPrice = selectedVariant?.price ? selectedVariant.price : product.price

  return (
    <>
      <div className="relative w-full bg-[#FAFAFA] flex items-center justify-center h-[35vh] md:h-auto md:min-h-[450px] p-4 md:p-8 border-b md:border-b-0 md:border-r border-black/5 overflow-hidden shrink-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-zoom-in group" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={() => setIsZoomOpen(true)}>
          <img src={allImages[activeIndex]} alt={product.name} style={zoomStyle} className="max-w-full max-h-[250px] md:max-h-[350px] object-contain transition-transform duration-200 ease-out pointer-events-none" />
          <div className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"><Search className="w-4 h-4 rotate-90" /></div>
          {allImages.length > 1 && (<><button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-[#1F1F1F] text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"><ChevronLeft className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-[#1F1F1F] text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"><ChevronRight className="w-4 h-4" /></button></>)}
        </div>
        {allImages.length > 1 && (<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20 bg-white/80 p-2 rounded-full backdrop-blur-sm shadow-sm">{allImages.map((img, i) => (<button key={i} onClick={() => handleDotClick(i)} className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${activeIndex === i ? 'bg-[#1F1F1F] w-6' : 'bg-[#1F1F1F]/30 hover:bg-[#1F1F1F]/60'}`} />))}</div>)}
      </div>
      <div className="w-full p-6 md:p-10 flex flex-col overflow-y-auto bg-white flex-1 md:flex-none">
        <span className="inline-block px-3 py-1 text-[11px] font-medium bg-[#F0F9FF] text-[#0369A1] rounded-full mb-6 w-fit tracking-wider uppercase border border-black/5">{product.category?.name || 'General'}</span>
        <h2 className="text-2xl md:text-[32px] font-semibold text-[#1F1F1F] mb-3 leading-tight tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>{product.name}</h2>
        <p className="text-[#6B6B6B] text-base mb-8 whitespace-pre-line">{product.measure}</p>
        <p className="text-3xl font-bold text-[#0369A1] mb-10">${currentPrice.toFixed(2)}</p>
        {product.variants && product.variants.length > 0 && (<div className="mb-8"><p className="text-[#1F1F1F]/80 font-medium mb-3 text-sm">Selecciona una opción:</p><div className="flex flex-wrap gap-2"><button onClick={() => handleVariantSelect(null)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${!selectedVariant ? 'bg-[#0369A1] text-white border-[#0369A1]' : 'bg-transparent text-[#1F1F1F] border-black/10 hover:border-[#0369A1]'}`}>Principal</button>{product.variants.map((variant) => (<button key={variant.id} onClick={() => handleVariantSelect(variant)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${selectedVariant?.id === variant.id ? 'bg-[#0369A1] text-white border-[#0369A1]' : 'bg-transparent text-[#1F1F1F] border-black/10 hover:border-[#0369A1]'}`}>{variant.name}</button>))}</div></div>)}
        {product.videoUrl && (<div className="mb-8"><a href={product.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[#1F1F1F] bg-black/5 px-4 py-2 rounded-full hover:bg-black/10 transition-colors"><PlayCircle className="w-4 h-4 text-[#0369A1]" /> Ver Video</a></div>)}
        <div className="flex-grow" />
        <button onClick={() => addToCart(product, selectedVariant)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0369A1] px-6 py-4 text-sm font-medium text-white shadow-sm hover:bg-[#075985] transition-colors duration-300 mt-4">AGREGAR <Plus className="w-4 h-4" /></button>
      </div>
      {isZoomOpen && (<div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setIsZoomOpen(false)}><button className="absolute top-6 right-6 text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-[101]"><X className="w-6 h-6" /></button><img src={allImages[activeIndex]} alt={product.name} className="max-w-full max-h-full object-contain" /></div>)}
    </>
  )
}

function ProductCard({ product, onClick }: { product: Product, onClick: () => void }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-[0_4px_14px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer" onClick={onClick}>
      <div className="relative w-full overflow-hidden h-[160px] bg-[#FAFAFA]">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover group-hover:scale-[1.05] transition-transform duration-500" />
      </div>
      <div className="p-3 flex flex-col flex-grow text-center items-center">
        <p className="text-sm font-medium text-[#1F1F1F] mb-1 line-clamp-1">{product.name}</p>
        <p className="text-sm text-[#0369A1] font-semibold mb-3">${product.price.toFixed(2)}</p>
        <div className="mt-auto w-full py-1.5 border-t border-black/5 text-[11px] uppercase tracking-wider text-[#6B6B6B] group-hover:text-[#1F1F1F] transition-colors">Ver detalle</div>
      </div>
    </article>
  )
}