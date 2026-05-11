import React, { useState, useEffect } from 'react';
import { Search, Info, MessageSquare, X, Loader2, Phone, Package, Calendar, DollarSign, TrendingUp, History, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function Consulta() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { hasPermission } = useAuth();

  // Load initial products (empty query)
  useEffect(() => {
    handleSearch('');
  }, []);

  const handleSearch = async (searchQuery) => {
    setLoading(true);
    try {
      const response = await api.searchProducts(searchQuery || '');
      if (Array.isArray(response)) {
        setProducts(response);
      } else if (response && response.data) {
        setProducts(response.data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  };

  const formatCurrency = (val) => {
    if (isNaN(val) || val === null || val === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleWhatsApp = (p) => {
    const phone = p.telefone || p.celular || p.whatsapp;
    if (!phone) {
      alert("Telefone não encontrado no cadastro do produto.");
      return;
    }
    const msg = `Olá, falo sobre o produto ${p.codigo} - ${p.descricao}. Gostaria de mais informações.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const canSeeCost = hasPermission('Ver Preço de Custo');
  const canSeeMargin = hasPermission('Ver Margem');
  const canSeePhone = hasPermission('Ver Telefone do Comprador');
  const canUseWhatsApp = hasPermission('Acionar WhatsApp');

  return (
    <div className="flex flex-col h-full space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic">
            Consulta <span className="text-primary">Inteligente</span>
          </h1>
          <p className="text-muted-foreground font-bold text-sm tracking-widest uppercase">
            Acesso em tempo real à base de 40k itens
          </p>
        </div>
        
        <div className="relative w-full lg:w-[500px] group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-transform group-focus-within:scale-110">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-32 py-4 border-2 border-border rounded-2xl bg-card text-foreground focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-xl font-bold placeholder:text-muted-foreground/50"
            placeholder="Código ou Descrição..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute inset-y-2 right-2">
            <button
              onClick={() => handleSearch(query)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest h-full transition-all shadow-lg active:scale-95"
            >
              Pesquisar
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <Loader2 className="animate-spin text-primary w-16 h-16" />
              <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-6 h-6" />
            </div>
            <p className="text-muted-foreground font-black uppercase tracking-[0.3em] text-xs animate-pulse">Sincronizando com a base...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-card rounded-3xl border-2 border-dashed border-border">
            <Package className="w-20 h-20 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-bold text-lg">Nenhum produto encontrado para sua busca.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block erp-card overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Código</th>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Descrição</th>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Emb</th>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">Preço Unit.</th>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Estoque</th>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.map((p, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-primary/5 transition-all cursor-pointer group"
                        onClick={() => setSelectedProduct(p)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-black text-primary bg-primary/10 px-2 py-1 rounded-md">{p.codigo}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors">{p.descricao}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mt-0.5">{p.razaosocial}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-black text-xs bg-muted border border-border px-2 py-1 rounded-md">{p.embalagem || 'UN'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-foreground">{formatCurrency(p.preco_unitario)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className={cn(
                              "font-black text-sm",
                              (p.estoque || 0) > 0 ? "text-success" : "text-destructive"
                            )}>
                              {p.estoque || 0}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{p.corredor || 'S/ LOC'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="p-2 rounded-full hover:bg-primary hover:text-primary-foreground transition-all">
                            <Info size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 gap-4">
              {products.map((p, idx) => (
                <div 
                  key={idx}
                  className="erp-card p-5 space-y-4"
                  onClick={() => setSelectedProduct(p)}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="font-black text-xs text-primary bg-primary/10 px-2 py-1 rounded-md uppercase tracking-widest">{p.codigo}</span>
                      <h3 className="font-bold text-lg leading-tight">{p.descricao}</h3>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{p.razaosocial}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-muted-foreground uppercase">Unidade</p>
                      <p className="text-lg font-black text-primary">{formatCurrency(p.preco_unitario)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Estoque</p>
                        <p className={cn("font-black", (p.estoque || 0) > 0 ? "text-success" : "text-destructive")}>{p.estoque || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Embalagem</p>
                        <p className="font-black">{p.embalagem || 'UN'}</p>
                      </div>
                    </div>
                    <button className="bg-muted p-2 rounded-xl text-muted-foreground">
                      <Info size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Detailed Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border-4 border-primary/20 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-border bg-primary/5 flex justify-between items-center relative">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center shadow-lg transform -rotate-3">
                  <Package className="text-primary-foreground w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tighter uppercase leading-none">
                    {selectedProduct.codigo} <span className="text-primary">—</span> {selectedProduct.descricao}
                  </h3>
                  <p className="text-sm text-muted-foreground font-bold tracking-widest uppercase mt-2">{selectedProduct.razaosocial}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="bg-muted hover:bg-destructive hover:text-destructive-foreground p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Logistics Info */}
                <div className="erp-card p-6 border-l-4 border-l-primary space-y-4">
                  <h4 className="font-black text-xs text-muted-foreground uppercase tracking-[0.2em] mb-4">Informações Logísticas</h4>
                  <div className="space-y-4">
                    <InfoItem icon={MapPin} label="Corredor" value={selectedProduct.corredor} />
                    <InfoItem icon={Package} label="Palete / Palete Estoque" value={`${selectedProduct.palete || '-'} / ${selectedProduct.palete_estoque || '-'}`} />
                    <InfoItem icon={TrendingUp} label="Venda Mês" value={selectedProduct.venda_mes} />
                    <InfoItem icon={History} label="Idade / Dias S/ Venda" value={`${selectedProduct.idade || '0'} / ${selectedProduct.dias_sem_venda || '0'} dias`} />
                    <InfoItem icon={BarcodeIcon} label="Código Interno" value={selectedProduct.codigo_interno || '-'} />
                  </div>
                </div>

                {/* Commercial Info */}
                <div className="erp-card p-6 border-l-4 border-l-primary space-y-4">
                  <h4 className="font-black text-xs text-muted-foreground uppercase tracking-[0.2em] mb-4">Informações Comerciais</h4>
                  <div className="space-y-4">
                    <InfoItem icon={DollarSign} label="Preço Atacado" value={formatCurrency(selectedProduct.preco_atacado)} />
                    <InfoItem icon={DollarSign} label="Preço Unitário" value={formatCurrency(selectedProduct.preco_unitario)} />
                    {canSeeCost && (
                      <>
                        <InfoItem icon={DollarSign} label="Custo" value={formatCurrency(selectedProduct.custo)} className="text-destructive font-black" />
                        <InfoItem icon={TrendingUp} label="Rentabilidade" value={selectedProduct.rentablidade} className="text-success font-black" />
                      </>
                    )}
                    <InfoItem icon={Calendar} label="Última Entrada" value={selectedProduct.entrada} />
                  </div>
                </div>

                {/* Stock Info */}
                <div className="erp-card p-6 border-l-4 border-l-primary space-y-4">
                  <h4 className="font-black text-xs text-muted-foreground uppercase tracking-[0.2em] mb-4">Informações de Estoque</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl">
                      <span className="text-xs font-black uppercase text-muted-foreground">Estoque Atual</span>
                      <span className={cn("text-2xl font-black", (selectedProduct.estoque || 0) > 0 ? "text-success" : "text-destructive")}>
                        {selectedProduct.estoque || 0}
                      </span>
                    </div>
                    {canSeeCost && (
                      <InfoItem icon={DollarSign} label="Valor em Estoque" value={formatCurrency(selectedProduct.valor_estoque)} className="text-primary font-black" />
                    )}
                    <InfoItem icon={Package} label="Embalagem" value={selectedProduct.embalagem} />
                    <InfoItem icon={History} label="Autonomia" value={`${selectedProduct.autonomia_dias || 0} dias`} />
                    <InfoItem icon={Search} label="Pedido Sugerido" value={selectedProduct.pedido} />
                  </div>
                </div>
              </div>

              {/* Contact Area */}
              <div className="mt-8 bg-muted/30 p-8 rounded-[2rem] border-2 border-border flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center text-primary border border-border shadow-sm">
                    <User size={32} />
                  </div>
                  <div className="text-center lg:text-left">
                    <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Comprador Responsável</p>
                    <p className="text-2xl font-black text-foreground">{selectedProduct.comprador || 'S/ RESPONSÁVEL'}</p>
                    {canSeePhone && selectedProduct.telefone && (
                      <p className="text-primary font-bold mt-1">{selectedProduct.telefone}</p>
                    )}
                  </div>
                </div>
                
                {canUseWhatsApp && (
                  <button 
                    onClick={() => handleWhatsApp(selectedProduct)}
                    className="w-full lg:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 shadow-xl transform hover:scale-105 transition-all active:scale-95"
                  >
                    <MessageSquare size={24} className="fill-white" />
                    Acionar Comprador
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, className }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className={cn("text-xs font-bold text-foreground text-right truncate max-w-[150px]", className)}>
        {value || '—'}
      </span>
    </div>
  );
}
