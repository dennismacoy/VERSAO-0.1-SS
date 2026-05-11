import React, { useState, useEffect } from 'react';
import { Search, Info, MessageSquare, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
        // Mock fallback if API fails
        setProducts([
          { codigo: '1001', descricao: 'REFRIGERANTE COLA 2L', emb: 'UN', precoata: 7.99, precouni: 8.50, estoque: 150, comprador: 'Joao', telefone: '5511999999999', entrada: '10/05/2026', custo: 5.00, idade: 30, categoria: 'Bebidas', marca: 'MarcaA' },
          { codigo: '1002', descricao: 'SABAO EM PO 1KG', emb: 'CX', precoata: 12.50, precouni: 14.00, estoque: 80, comprador: 'Maria', telefone: '5511988888888', entrada: '05/05/2026', custo: 9.00, idade: 45, categoria: 'Limpeza', marca: 'MarcaB' },
        ]);
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
    if (isNaN(val) || val === null || val === undefined) return val;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleWhatsApp = (p) => {
    const msg = `Olá, falo sobre o produto ${p.codigo} - ${p.descricao}. Gostaria de mais informações.`;
    const phone = p.telefone || p.celular || p.whatsapp;
    if (!phone) {
      alert("Telefone não encontrado no cadastro do produto.");
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const canSeeCost = hasPermission('Ver Preço de Custo');
  const canUseWhatsApp = hasPermission('Acionar WhatsApp');

  return (
    <div className="flex flex-col h-full space-y-6 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Consulta Inteligente</h1>
          <p className="text-muted-foreground mt-1">Busque produtos diretamente na base central</p>
        </div>
        
        <div className="relative w-full md:w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-24 py-3 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm font-medium"
            placeholder="Digite código ou descrição..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute inset-y-1 right-1">
            <button
              onClick={() => handleSearch(query)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-bold text-sm h-full transition-colors"
            >
              Buscar
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left h-full">
            <thead className="bg-muted text-muted-foreground font-semibold uppercase tracking-wider text-xs border-b border-border sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4 text-center">Emb</th>
                <th className="px-6 py-4 text-right">Preço</th>
                <th className="px-6 py-4 text-center">Estoque</th>
                <th className="px-6 py-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin mb-2" size={32} />
                      <p>Buscando na base de dados...</p>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-muted-foreground font-medium">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedProduct(p)}
                  >
                    <td className="px-6 py-4 font-bold text-foreground">{p.codigo || p.id}</td>
                    <td className="px-6 py-4 font-medium">{p.descricao || p.nome}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-secondary text-secondary-foreground border border-border">
                        {p.emb || p.embalagem || 'UN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {formatCurrency(p.precouni || p.precoata || p.preco || p.valor || 0)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${(p.estoque || p.qtd) > 0 ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                        <span className="font-bold text-foreground">{p.estoque || p.qtd || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-full hover:bg-primary/10 mx-auto block">
                        <Info size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Product Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-xl border border-border flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-start bg-muted/30 rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  {selectedProduct.codigo || selectedProduct.id} - {selectedProduct.descricao || selectedProduct.nome}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 font-medium">Detalhes completos do produto (Mapeamento Dinâmico)</p>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.keys(selectedProduct).map(key => {
                  // Skip cost if no permission
                  if (!canSeeCost && (key.toLowerCase().includes('custo') || key.toLowerCase().includes('margem'))) {
                    return null;
                  }
                  
                  let val = selectedProduct[key];
                  
                  // Format value if it looks like currency or is null
                  if (val === null || val === undefined || val === '') val = '-';
                  else if (typeof val === 'number' && (key.toLowerCase().includes('preco') || key.toLowerCase().includes('custo') || key.toLowerCase().includes('valor'))) {
                    val = formatCurrency(val);
                  }

                  return (
                    <div key={key} className="bg-background border border-border p-3 rounded-xl shadow-sm">
                      <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-semibold text-foreground text-sm break-words">
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>

              {canUseWhatsApp && (
                <div className="mt-8 border-t border-border pt-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-muted/30 p-5 rounded-2xl border border-border gap-4">
                    <div>
                      <p className="font-bold text-lg text-foreground">Acionar Comprador / Responsável</p>
                      <p className="text-sm text-muted-foreground">Inicie uma conversa via WhatsApp sobre este item.</p>
                    </div>
                    <button 
                      onClick={() => handleWhatsApp(selectedProduct)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md transform hover:scale-105 active:scale-95"
                    >
                      <MessageSquare size={20} />
                      WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
