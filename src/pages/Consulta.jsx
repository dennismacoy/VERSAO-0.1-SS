import React, { useState, useMemo } from 'react';
import { Search, Info, Package, Phone, X, DollarSign, Activity, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { cn } from '../lib/utils';

export default function Consulta() {
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { hasPermission } = useAuth();
  const { products, loading, searchLocal } = useProducts();

  const filteredProducts = useMemo(() => searchLocal(query), [query, products]);

  const visibleProducts = filteredProducts.slice(0, 100); // Exibir 100 itens p/ performance

  const handleSearch = (e) => {
    setQuery(e.target.value);
  };

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const buildWppMessage = (p) => {
    const cod = p.CODIGO || p.codigo || '';
    const desc = p.DESCRICAO || p.descricao || '';
    const emb = p.EMBALAGEM || p.embalagem || p.emb || 'UN';
    const estoque = p.ESTOQUE || p.QTE || 0;
    const idade = p.IDADE || 0;
    const isv = p.DIAS_SEM_VENDA || p.ISV || 0;
    const entrada = p.ENTRADA || '-';
    return [
      `📦 *PRODUTO:* ${cod} - ${desc}`,
      `📏 *EMBALAGEM:* ${emb}`,
      `--------------------------`,
      `✅ *ESTOQUE:* ${estoque}`,
      `📅 *IDADE:* ${idade} dias`,
      `🚫 *DIAS SEM VENDA:* ${isv}`,
      `🚚 *ÚLT. ENTRADA:* ${entrada}`,
    ].join('\n');
  };

  const handleWppContact = (msg) => {
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">Consulta</h1>
          <p className="text-muted-foreground font-medium text-sm">Pesquisa offline no cache</p>
        </div>

        <div className="relative w-full lg:w-[400px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
            placeholder="Buscar por código ou descrição..."
            value={query}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden erp-card">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-primary">
            <Activity className="animate-spin w-10 h-10" />
            <span className="font-bold">Carregando cache...</span>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Package size={48} className="opacity-20 mb-4" />
            <p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-xs">Código</th>
                  <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-xs">Descrição</th>
                  <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-xs text-center">Emb</th>
                  <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Preços (At/Var)</th>
                  <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-xs text-center">Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleProducts.map((p, idx) => {
                  const estoque = Number(p.ESTOQUE || p.QTE || 0);
                  return (
                    <tr 
                      key={idx} 
                      className="hover:bg-primary/5 cursor-pointer transition-colors"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <td className="px-4 py-3 font-bold text-primary">{p.CODIGO || p.codigo}</td>
                      <td className="px-4 py-3 font-semibold truncate max-w-[200px] md:max-w-[400px]">
                        {p.DESCRICAO || p.descricao}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold bg-muted/30">
                        {p.EMBALAGEM || p.embalagem || p.emb || 'UN'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col text-xs font-bold">
                          <span className="text-foreground">{formatCurrency(p.PRECO_ATACADO || p.preco_atacado)}</span>
                          <span className="text-muted-foreground">{formatCurrency(p.PRECO_VAREJO || p.preco_unitario)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-xs font-bold uppercase",
                          estoque > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {estoque > 0 ? estoque : "Sem Estoque"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BOTTOM SHEET / MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div 
            className="bg-card w-full md:w-[600px] md:rounded-2xl rounded-t-3xl shadow-2xl border border-border flex flex-col overflow-hidden max-h-[90vh] slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-300"
          >
            <div className="p-4 border-b border-border flex items-start justify-between bg-primary/5">
              <div>
                <span className="text-xs font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded">
                  {selectedProduct.CODIGO || selectedProduct.codigo}
                </span>
                <h2 className="text-xl font-black mt-2 leading-tight">
                  {selectedProduct.DESCRICAO || selectedProduct.descricao}
                </h2>
                <p className="text-sm font-bold text-muted-foreground mt-1 bg-muted inline-block px-2 rounded">
                  Emb: {selectedProduct.EMBALAGEM || selectedProduct.embalagem || selectedProduct.emb || 'UN'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="p-2 bg-muted hover:bg-destructive hover:text-destructive-foreground rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar space-y-4">
              {/* Card Geral */}
              {hasPermission('Ver Card Geral') && (
                <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                  <h3 className="font-bold text-sm uppercase text-primary border-b border-border/50 pb-2">Informações Gerais</h3>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Estoque</p>
                      <p className={cn("font-black", (selectedProduct.ESTOQUE || 0) > 0 ? "text-green-600" : "text-red-500")}>
                        {selectedProduct.ESTOQUE || selectedProduct.QTE || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Preços (At/Var)</p>
                      <p className="font-bold">{formatCurrency(selectedProduct.PRECO_ATACADO || selectedProduct.preco_atacado)} / {formatCurrency(selectedProduct.PRECO_VAREJO || selectedProduct.preco_unitario)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Idade / Dias S/ Venda</p>
                      <p className="font-bold">{selectedProduct.IDADE || 0} / {selectedProduct.DIAS_SEM_VENDA || selectedProduct.ISV || 0} dias</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Palete Estoque</p>
                      <p className="font-bold">{selectedProduct.PALETE_ESTOQUE || selectedProduct.PALETES || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Corredor</p>
                      <p className="font-bold text-accent">{selectedProduct.CORREDOR || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Última Entrada</p>
                      <p className="font-bold">{selectedProduct.ENTRADA || '-'}</p>
                    </div>
                  </div>
                  
                  {hasPermission('Botao Enviar WPP') && (
                    <button 
                      onClick={() => handleWppContact(buildWppMessage(selectedProduct))}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-2 rounded-lg font-bold transition-colors"
                    >
                      <MessageSquare size={18} />
                      Enviar Info WPP
                    </button>
                  )}
                </div>
              )}

              {/* Card Extras */}
              {hasPermission('Ver Card Extras') && (
                <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                  <h3 className="font-bold text-sm uppercase text-accent border-b border-border/50 pb-2">Informações Extras</h3>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Valor em Estoque</p>
                      <p className="font-black text-primary">{formatCurrency((selectedProduct.ESTOQUE || selectedProduct.QTE || 0) * (selectedProduct.CUSTO || selectedProduct.PRECO || 0))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Custo</p>
                      <p className="font-bold text-destructive">{formatCurrency(selectedProduct.CUSTO || selectedProduct.PRECO)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Autonomia</p>
                      <p className="font-bold">{selectedProduct.AUTONOMIA || 0} dias</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Rentabilidade</p>
                      <p className="font-bold text-green-600">{selectedProduct.RENTABILIDADE || '0'}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Venda Mês</p>
                      <p className="font-bold">{selectedProduct.VENDA_MES || 0}</p>
                    </div>
                  </div>

                  {hasPermission('Botao Ligar Comprador') && (
                    <button 
                      onClick={() => handleWppContact(`Atenção comprador, sobre o item ${selectedProduct.CODIGO || selectedProduct.codigo}.`)}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground py-2 rounded-lg font-bold transition-colors"
                    >
                      <Phone size={18} />
                      Falar com Comprador
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}