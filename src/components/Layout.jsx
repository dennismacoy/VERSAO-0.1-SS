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

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Consulta Inteligente', path: '/', icon: Search, condition: hasPermission('Acesso Consulta') },
    { name: 'Pré-Venda', path: '/pre-venda', icon: ShoppingCart, condition: hasPermission('Acesso Pre-Venda') },
    { name: 'Separação', path: '/separacao', icon: ListChecks, condition: hasPermission('Acesso Separacao') },
    { name: 'Relatórios', path: '/relatorios', icon: BarChart3, condition: hasPermission('Acesso Relatorios') },
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

      {/* Main Content Area */}
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
        <div className="flex-1 overflow-auto custom-scrollbar bg-muted/30 p-4 pb-24 md:p-8 md:pb-8">
          <div className="max-w-[1600px] mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-card border-t border-border shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.3)] pb-safe">
        <ul className="flex items-center justify-around p-2">
          {filteredMenu.slice(0, 4).map((item) => (
            <li key={item.path} className="flex-1">
              <NavLink
                to={item.path}
                className={({ isActive }) => cn(
                  "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all duration-200",
                  isActive 
                    ? "text-primary font-bold scale-110" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon size={22} className="transition-transform" />
                <span className="text-[10px] uppercase tracking-tighter truncate max-w-[80px] text-center">
                  {item.name}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
