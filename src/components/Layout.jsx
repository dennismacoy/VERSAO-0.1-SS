import React, { useState, useEffect } from 'react';
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
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ children }) {
  const { user, role, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Consulta Inteligente', path: '/', icon: Search, condition: true },
    { name: 'Pré-Venda', path: '/pre-venda', icon: ShoppingCart, condition: hasPermission('Gerar PDF Pré-Venda') },
    { name: 'Separação', path: '/separacao', icon: ListChecks, condition: hasPermission('Ver Aba Separação') },
    { name: 'Relatórios', path: '/relatorios', icon: BarChart3, condition: hasPermission('Ver Aba Relatórios') },
    { name: 'Configurações', path: '/configuracoes', icon: Settings, condition: role === 'Admin' },
  ];

  const filteredMenu = menuItems.filter(item => item.condition);

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden transition-colors duration-300">
      {/* Desktop Sidebar */}
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
                  <item.icon size={22} className={cn("flex-shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary-foreground")} />
                  {isSidebarOpen && <span className="text-sm tracking-tight">{item.name}</span>}
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 z-20 shadow-sm sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 rounded-xl hover:bg-muted text-muted-foreground transition-all active:scale-90"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="md:hidden flex items-center gap-2">
              <span className="font-black text-xl tracking-tighter text-primary">SmartStock</span>
            </div>
            <h2 className="hidden md:block font-bold text-muted-foreground text-sm uppercase tracking-widest">
              {menuItems.find(i => i.path === location.pathname)?.name || 'Início'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground transition-all shadow-sm active:scale-95 group"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun size={18} className="text-primary group-hover:rotate-45 transition-transform" /> : <Moon size={18} className="text-primary group-hover:-rotate-12 transition-transform" />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">{darkMode ? 'Claro' : 'Escuro'}</span>
            </button>
          </div>
        </header>

        {/* Page Container */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-muted/30 p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-background/95 backdrop-blur-md" />
          <div className="relative h-full flex flex-col p-6">
            <div className="flex justify-between items-center mb-12">
              <span className="font-black text-3xl tracking-tighter text-primary">SmartStock</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 bg-muted rounded-full"
              >
                <X size={28} />
              </button>
            </div>
            
            <nav className="flex-1">
              <ul className="space-y-6">
                {filteredMenu.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => cn(
                        "flex items-center gap-6 text-2xl font-black transition-all",
                        isActive ? "text-primary translate-x-4" : "text-muted-foreground"
                      )}
                    >
                      <item.icon size={32} />
                      {item.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="pt-8 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center font-black text-2xl text-primary-foreground">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-black text-xl">{user?.name || 'Usuário'}</p>
                  <p className="text-sm font-bold text-primary uppercase tracking-widest">{role}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-4 bg-destructive/10 text-destructive rounded-2xl"
              >
                <LogOut size={28} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
