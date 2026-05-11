import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Search, 
  ShoppingCart, 
  ListChecks, 
  BarChart3, 
  Settings, 
  LogOut,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ children }) {
  const { user, role, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Consulta Inteligente', path: '/', icon: Search, condition: true },
    { name: 'Pré-Venda', path: '/pre-venda', icon: ShoppingCart, condition: role !== 'Repositor' },
    { name: 'Separação', path: '/separacao', icon: ListChecks, condition: ['Admin', 'Gerente', 'Lider', 'Repositor'].includes(role) },
    { name: 'Relatórios', path: '/relatorios', icon: BarChart3, condition: hasPermission('Ver Aba Relatórios') },
    { name: 'Configurações', path: '/configuracoes', icon: Settings, condition: role === 'Admin' },
  ];

  const filteredMenu = menuItems.filter(item => item.condition);

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-card border-r border-border transition-all duration-300 flex flex-col z-20",
          isSidebarOpen ? "w-64" : "w-20 hidden md:flex",
          "fixed md:relative h-screen"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {isSidebarOpen ? (
            <span className="font-bold text-xl tracking-tight text-primary">SmartStock ERP</span>
          ) : (
            <span className="font-bold text-xl mx-auto text-primary">SS</span>
          )}
          <button 
            className="md:hidden p-1 rounded-md hover:bg-muted text-muted-foreground" 
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <ul className="space-y-1 px-2">
            {filteredMenu.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                  )}
                  title={!isSidebarOpen ? item.name : undefined}
                >
                  <item.icon size={20} className={cn("flex-shrink-0")} />
                  {isSidebarOpen && <span className="text-sm">{item.name}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          {isSidebarOpen && (
            <div className="mb-4 px-2">
              <p className="text-sm font-bold truncate">{user?.name || 'Usuário'}</p>
              <p className="text-xs font-medium text-primary mt-0.5">{role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium",
              !isSidebarOpen && "justify-center"
            )}
            title={!isSidebarOpen ? "Sair" : undefined}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="text-sm">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu size={20} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground transition-all shadow-sm"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun size={16} className="text-primary" /> : <Moon size={16} className="text-primary" />}
              <span className="text-xs font-semibold">{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-muted/20">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-10 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
