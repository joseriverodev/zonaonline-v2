"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Percent, LayoutGrid, MessageCircle, Instagram, Facebook, ShoppingBag, Phone, Copy, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("");
  const [config, setConfig] = useState<any>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(setConfig);
    
    const handleHash = () => setActiveHash(window.location.hash.replace('#', ''));
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (href === "/") {
      setActiveHash("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (href.startsWith("/#")) {
      e.preventDefault();
      const id = href.substring(2);
      setActiveHash(id); 
      if (window.location.hash === `#${id}`) {
        const event = new Event('hashchange');
        window.dispatchEvent(event);
      } else {
        window.location.hash = id;
      }
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" && !activeHash;
    if (href.startsWith("/#")) return activeHash === href.substring(2);
    return pathname === href;
  };

  const menuItems = [
    { title: "Inicio", href: "/", icon: Home },
    { title: "Colecciones", href: "/#colecciones", icon: LayoutGrid },
    { title: "Catálogo", href: "/#catalogo", icon: ShoppingBag },
    { title: "Ofertas", href: "/#ofertas", icon: Percent },
  ];

  const waNumber = config?.whatsapp || "000000000000";
  const phoneCall = config?.phoneCall;
  const igUser = config?.instagram;
  const tiktokUser = config?.tiktok;

  const handleCopyPhone = () => {
    if (phoneCall) {
      navigator.clipboard.writeText(phoneCall);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Sidebar 
        style={{ "--sidebar-width": "280px" } as React.CSSProperties}
        className="h-screen border-r border-black/5 bg-white px-6 flex flex-col"
      >
        <SidebarHeader className="pt-6 pb-4 px-0 flex justify-center items-center">
  <Link href="/" className="flex items-center justify-center" onClick={(e) => handleNavClick(e, "/")}>
    <img src="/icon.png" alt="Store logo" className="h-12 w-auto object-contain" />
  </Link>
</SidebarHeader>

        <SidebarSeparator className="bg-black/5 mb-8 w-full" />

        <SidebarContent className="px-0 flex-1">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-4">
                <li className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#6B6B6B] mb-2 pl-5">Navegación</li>
                {menuItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <a href={item.href} onClick={(e) => handleNavClick(e, item.href)} className={`group w-full flex items-center gap-4 rounded-xl px-5 py-4 text-base transition-all duration-300 font-medium border ${active ? 'bg-[#D67489]/30 text-[#1F1F1F] font-semibold border-[#D67489] shadow-sm' : 'text-[#1F1F1F] border-transparent hover:bg-[#FFF5F7] hover:border-[#D67489]/20'}`}>
                        <item.icon className={`w-5 h-5 transition-colors duration-300 ${active ? 'text-[#C8A46A]' : 'text-[#6B6B6B] group-hover:text-[#C8A46A]'}`} />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-0 pb-10 pt-4 space-y-3">
          <div className="bg-[#FFF9FA] rounded-2xl p-4 border border-black/5 space-y-2">
            <p className="text-xs text-[#6B6B6B] mb-1 text-center">¿Necesitas ayuda con tu pedido?</p>
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D67489] px-4 py-3 text-white shadow-sm hover:bg-[#C8A46A] transition-all duration-300 text-xs font-semibold uppercase tracking-[0.1em]">
              <MessageCircle className="w-4 h-4" /> ESCRÍBENOS POR WHATSAPP
            </a>
            {phoneCall && (
              <>
                {/* Botón para Móvil (Llama directamente) */}
                <a href={`tel:${phoneCall}`} className="md:hidden w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-[#D67489] text-[#D67489] px-4 py-3 shadow-sm hover:bg-[#D67489] hover:text-white transition-all duration-300 text-xs font-semibold uppercase tracking-[0.1em]">
                  <Phone className="w-4 h-4" /> Llamar Ahora
                </a>
                {/* Botón para PC (Abre Modal) */}
                <button onClick={() => setCallModalOpen(true)} className="hidden md:flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-[#D67489] text-[#D67489] px-4 py-3 shadow-sm hover:bg-[#D67489] hover:text-white transition-all duration-300 text-xs font-semibold uppercase tracking-[0.1em]">
                  <Phone className="w-4 h-4" /> Llamar Ahora
                </button>
              </>
            )}
          </div>

          <div className="flex justify-center gap-8 pt-2">
            {igUser && <a href={`https://instagram.com/${igUser}`} target="_blank" rel="noopener noreferrer" className="text-[#6B6B6B] hover:text-[#C8A46A] transition-colors duration-300"><Instagram className="w-5 h-5" /></a>}
            {tiktokUser && <a href={`https://tiktok.com/@${tiktokUser}`} target="_blank" rel="noopener noreferrer" className="text-[#6B6B6B] hover:text-[#C8A46A] transition-colors duration-300"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg></a>}
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Modal de Llamada para PC */}
      <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
        <DialogContent showCloseButton={false} className="!w-[90vw] sm:!max-w-[400px] p-0 overflow-hidden bg-white rounded-3xl border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.08)] flex flex-col">
          <div className="p-6 border-b border-black/5 flex items-center justify-between shrink-0">
            <h2 className="text-xl font-semibold text-[#1F1F1F]">Llámanos</h2>
            <DialogClose className="rounded-full bg-black/5 p-2 text-[#1F1F1F] hover:bg-black/10 transition-colors"><X className="w-4 h-4" /></DialogClose>
          </div>
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-[#FFF9FA] rounded-full flex items-center justify-center border border-[#D67489]/20">
              <Phone className="w-8 h-8 text-[#D67489]" />
            </div>
            <p className="text-[#6B6B6B] text-sm">Si prefieres atención inmediata, márcanos en tu teléfono:</p>
            <p className="text-3xl font-bold text-[#1F1F1A] tracking-wide">{phoneCall}</p>
            <Button onClick={handleCopyPhone} className="mt-4 w-full bg-[#1F1F1F] hover:bg-[#C8A46A] text-white rounded-xl">
              {copied ? <><Check className="w-4 h-4 mr-2" /> Copiado</> : <><Copy className="w-4 h-4 mr-2" /> Copiar Número</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}