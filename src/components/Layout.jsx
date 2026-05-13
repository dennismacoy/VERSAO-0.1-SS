import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  ShoppingCart,
  ListChecks,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  User,
  LayoutDashboard,
  ClipboardList,
  Inbox,
  GripHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ children }) {
  const { user, role, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // =========================================================================
  // BOTTOM SHEET STATE & REFS
  // =========================================================================
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef(null);
  const handleRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const sheetHeightRef = useRef(0);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  // Close bottom sheet on route change
  useEffect(() => {
    setSheetOpen(false);
    setSheetTranslateY(0);
  }, [location]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sheetOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, condition: hasPermission('Acesso Dashboard') },
    { name: 'Consulta', path: '/consulta', icon: Search, condition: hasPermission('Acesso Consulta') },
    { name: 'Pedidos', path: '/pedidos', icon: ClipboardList, condition: hasPermission('Acesso Pedidos') },
    { name: 'Requisições', path: '/requisicoes', icon: Inbox, condition: hasPermission('Acesso Requisições') },
    { name: 'Pré-Venda', path: '/pre-venda', icon: ShoppingCart, condition: hasPermission('Acesso Pre-Venda') },
    { name: 'Separação', path: '/separacao', icon: ListChecks, condition: hasPermission('Acesso Separacao') },
    { name: 'Relatórios', path: '/relatorios', icon: BarChart3, condition: hasPermission('Acesso Relatorios') },
    { name: 'Configurações', path: '/configuracoes', icon: Settings, condition: hasPermission('Acesso Configuracoes') },
  ];

  const filteredMenu = menuItems.filter(item => item.condition);

  // =========================================================================
  // TOUCH HANDLERS FOR BOTTOM SHEET (Swipe Up to Open, Swipe Down to Close)
  // =========================================================================
  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    currentYRef.current = touch.clientY;
    setIsDragging(true);

    if (sheetRef.current) {
      sheetHeightRef.current = sheetRef.current.offsetHeight;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    currentYRef.current = touch.clientY;
    const deltaY = currentYRef.current - startYRef.current;

    if (sheetOpen) {
      // When open: only allow dragging DOWN (positive deltaY)
      if (deltaY > 0) {
        setSheetTranslateY(deltaY);
      }
    } else {
      // When closed: only allow dragging UP (negative deltaY)
      if (deltaY < -10) {
        // We'll use a visual hint but open on touchEnd
        setSheetTranslateY(deltaY);
      }
    }
  }, [isDragging, sheetOpen]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const deltaY = currentYRef.current - startYRef.current;

    if (sheetOpen) {
      // If user dragged down more than 80px, close the sheet
      if (deltaY > 80) {
        setSheetOpen(false);
      }
    } else {
      // If user dragged up more than 40px, open the sheet
      if (deltaY < -40) {
        setSheetOpen(true);
      }
    }
    setSheetTranslateY(0);
  }, [isDragging, sheetOpen]);

  // Calculate the sheet's visual transform
  const getSheetStyle = () => {
    if (isDragging && sheetOpen && sheetTranslateY > 0) {
      // Dragging down while open: translate the sheet down
      return {
        transform: `translateY(${sheetTranslateY}px)`,
        transition: 'none',
      };
    }
    if (isDragging && !sheetOpen && sheetTranslateY < 0) {
      // Dragging up while closed: peek the sheet
      const peek = Math.min(Math.abs(sheetTranslateY), 200);
      return {
        transform: `translateY(calc(100% - ${peek}px))`,
        transition: 'none',
      };
    }
    if (sheetOpen) {
      return {
        transform: 'translateY(0%)',
        transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
      };
    }
    return {
      transform: 'translateY(100%)',
      transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
    };
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden transition-colors duration-300">
      {/* ================================================================ */}
      {/* DESKTOP SIDEBAR (Unchanged — visible from md breakpoint)         */}
      {/* ================================================================ */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out relative z-30 shadow-lg",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="h-20 flex items-center justify-between px-4 border-b border-border bg-primary/5">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                <span className="font-black text-primary-foreground text-xl">SS</span>
              </div>
              <span className="font-black text-xl tracking-tighter text-foreground">SmartStock</span>
            </div>
          ) : (
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg mx-auto transform rotate-3">
              <span className="font-black text-primary-foreground text-lg">SS</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-6 overflow-y-auto custom-scrollbar">
          <ul className="space-y-2 px-3">
            {filteredMenu.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md font-bold scale-[1.02]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground font-semibold"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={22} className={cn("flex-shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary-foreground")} />
                      {isSidebarOpen && <span className="text-sm tracking-tight">{item.name}</span>}
                      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-border bg-muted/10">
          {isSidebarOpen && (
            <div className="mb-4 px-3 py-3 bg-card rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                <User size={20} />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold truncate leading-tight">{user?.name || 'Usuário'}</p>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">{role}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-3 py-3 w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all font-bold group",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut size={22} className="group-hover:rotate-12 transition-transform" />
            {isSidebarOpen && <span className="text-sm">Sair do Sistema</span>}
          </button>
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-24 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md border-2 border-background z-40 hover:scale-110 transition-transform"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </aside>

      {/* ================================================================ */}
      {/* MAIN CONTENT AREA                                                */}
      {/* ================================================================ */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 z-20 shadow-sm sticky top-0">
          <div className="flex items-center gap-4">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg transform rotate-3">
                <span className="font-black text-primary-foreground text-sm">SS</span>
              </div>
              <span className="font-black text-lg tracking-tighter text-primary">SmartStock</span>
            </div>
            <h2 className="hidden md:block font-bold text-muted-foreground text-sm uppercase tracking-widest">
              {menuItems.find(i => i.path === location.pathname)?.name || 'Início'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-3 py-2 md:px-4 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground transition-all shadow-sm active:scale-95 group"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun size={18} className="text-primary group-hover:rotate-45 transition-transform" /> : <Moon size={18} className="text-primary group-hover:-rotate-12 transition-transform" />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">{darkMode ? 'Claro' : 'Escuro'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="md:hidden flex items-center justify-center p-2 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-all active:scale-95"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Container */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-muted/30 p-4 pb-28 md:p-8 md:pb-8">
          <div className="max-w-[1600px] mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>

      {/* ================================================================ */}
      {/* MOBILE BOTTOM SHEET NAVIGATION                                   */}
      {/* ================================================================ */}

      {/* Backdrop (visible when sheet is open) */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          sheetOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSheetOpen(false)}
      />

      {/* The Handle Bar — always visible at bottom of screen on mobile */}
      <div
        ref={handleRef}
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => setSheetOpen(true)}
      >
        <div className="w-full bg-card/95 backdrop-blur-lg border-t border-border rounded-t-2xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)] px-6 py-3 flex flex-col items-center gap-2 cursor-pointer">
          {/* Pill Handle */}
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />

          {/* Quick access icons row */}
          <div className="w-full flex items-center justify-around pt-1 pb-1">
            {filteredMenu.slice(0, 4).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all duration-200",
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground"
                )}
              >
                <item.icon size={20} />
                <span className="text-[9px] uppercase tracking-tight font-bold truncate max-w-[60px] text-center leading-tight">
                  {item.name}
                </span>
              </NavLink>
            ))}
            {/* "More" button to open sheet */}
            <button
              onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}
              className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-muted-foreground active:text-primary transition-all"
            >
              <GripHorizontal size={20} />
              <span className="text-[9px] uppercase tracking-tight font-bold">Mais</span>
            </button>
          </div>
        </div>
      </div>

      {/* The Full Bottom Sheet Panel */}
      <div
        ref={sheetRef}
        className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col"
        style={getSheetStyle()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bg-card rounded-t-3xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.3)] border-t border-border flex flex-col max-h-[85vh] overflow-hidden">
          {/* Sheet Handle */}
          <div className="flex flex-col items-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
            <div className="w-14 h-1.5 rounded-full bg-muted-foreground/30 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Menu de Navegação</p>
          </div>

          {/* User Info Card */}
          <div className="mx-4 mb-4 px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20 shadow-sm">
              <User size={22} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black truncate leading-tight">{user?.name || 'Usuário'}</p>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em] mt-0.5">{role}</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-background border border-border text-muted-foreground hover:text-primary transition-all active:scale-90"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* Navigation Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6">
            <div className="grid grid-cols-1 gap-2">
              {filteredMenu.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-200 active:scale-[0.97] group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-muted/50 hover:bg-muted text-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0",
                      isActive
                        ? "bg-white/20"
                        : "bg-background border border-border shadow-sm group-hover:border-primary/30"
                    )}>
                      <item.icon size={20} className={cn(
                        "transition-transform group-hover:scale-110",
                        isActive ? "text-primary-foreground" : "text-primary"
                      )} />
                    </div>
                    <div className="flex-1">
                      <span className={cn(
                        "text-sm font-bold block",
                        isActive ? "text-primary-foreground" : "text-foreground"
                      )}>
                        {item.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Página Atual</span>
                      )}
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                  </NavLink>
                );
              })}
            </div>

            {/* Logout Button */}
            <button
              onClick={() => { setSheetOpen(false); handleLogout(); }}
              className="w-full mt-4 flex items-center gap-4 px-4 py-4 rounded-2xl bg-destructive/5 border border-destructive/10 text-destructive hover:bg-destructive/10 transition-all active:scale-[0.97] group"
            >
              <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
                <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
              </div>
              <span className="text-sm font-bold">Sair do Sistema</span>
            </button>
          </div>

          {/* Safe Area Padding (iOS) */}
          <div className="h-6 bg-card" />
        </div>
      </div>
    </div>
  );
}
