import React, { useState, useMemo, useEffect } from 'react';
import { Search, Info, Package, Phone, X, DollarSign, Activity, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { cn } from '../lib/utils';
import { parseEstoque, getEstoqueNumerico, formatCurrency } from '../lib/utils';

export default function Consulta() {
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockFilter, setStockFilter] = useState('com_estoque'); // 'com_estoque' | 'todos'
  const { hasPermission } = useAuth();
  const { products, loading, searchLocal } = useProducts();

  // Scroll Lock: trava o body quando o painel de detalhes está aberto
  useEffect(() => {
    if (selectedProduct) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    let results = searchLocal(query);

    // Aplica filtro de estoque
    if (stockFilter === 'com_estoque') {
      results = results.filter(p => {
        const estoqueStr = p.ESTOQUE || p.QTE || p.estoque || 0;
        return parseEstoque(estoqueStr);
      });
    }

    return results;
  }, [query, products, stockFilter]);

  const visibleProducts = filteredProducts.slice(0, 100);

  const handleSearch = (e) => {
    setQuery(e.target.value);
  };

  const buildWppMessage = (p) => {
    const cod = p.CODIGO || p.codigo || '';
    const desc = p.DESCRICAO || p.descricao || '';
    const emb = p.EMBALAGEM || p.embalagem || p.emb || 'UN';
    const estoque = p.ESTOQUE || p.QTE || p.estoque || 0;
    const idade = p.IDADE || p.idade || 0;
    const isv = p.DIAS_SEM_VENDA || p.ISV || p.dias_sem_venda || 0;
    const entrada = p.ENTRADA || p.entrada || '-';
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

  // Helper blindado contra variações de cabeçalhos do banco/planilha (acentos, espaços, maiúsculas)
  const getVal = (p, ...keys) => {
    if (!p) return null;
    
    // Normaliza a string: remove acentos, transforma espaços e hífens em underline e deixa minúsculo
    const normalize = (str) => 
      str.normalize('NFD')
         .replace(/[\u0300-\u036f]/g, "")
         .trim()
         .toLowerCase()
         .replace(/[\s\-]+/g, '_');
         
    const normalizedProduct = {};
    for (const key in p) {
      normalizedProduct[normalize(key)] = p[key];
    }

    for (const k of keys) {
      const searchKey = normalize(k);
      if (normalizedProduct[searchKey] !== undefined && normalizedProduct[searchKey] !== null && normalizedProduct[searchKey] !== '') {
        let val = normalizedProduct[searchKey];
        if (typeof val === 'string' && searchKey.match(/custo|atacado|varejo|preco_atacado|preco_varejo|preco_unitario|rentabilidade/)) {
          val = val.replace(/\./g, '').replace(',', '.');
          const parsed = parseFloat(val);
          return isNaN(parsed) ? val : parsed;
        }
        return val;
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary">Consulta</h1>
          <p className="text-muted-foreground font-medium text-xs md:text-sm">Pesquisa offline no cache</p>
        </div>

        <div className="relative w-full lg:w-[400px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary shadow-sm text-base"
            placeholder="Buscar por código ou descrição..."
            value={query}
            onChange={handleSearch}
          />
        </div>
      </div>

      {/* Toggle: Com Estoque / Todos */}
      <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border shadow-sm w-fit">
        <button
          onClick={() => setStockFilter('com_estoque')}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
            stockFilter === 'com_estoque'
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          Com Estoque
        </button>
        <button
          onClick={() => setStockFilter('todos')}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
            stockFilter === 'todos'
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          Todos
        </button>
        <span className="text-xs font-bold text-muted-foreground ml-2">
          {filteredProducts.length.toLocaleString()} itens
        </span>
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

            {/* DESKTOP TABLE */}
            <table className="hidden md:table w-full text-left text-sm whitespace-nowrap">
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
                  const estoqueStr = p.ESTOQUE || p.QTE || p.estoque || '0';
                  const temEstoque = parseEstoque(estoqueStr);
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-primary/5 cursor-pointer transition-colors"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <td className="px-4 py-3 font-bold text-primary">{p.CODIGO || p.codigo}</td>
                      <td className="px-4 py-3 font-semibold truncate max-w-[400px]">
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
                          temEstoque ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {temEstoque ? String(estoqueStr) : "Sem Estoque"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* MOBILE CARD LIST */}
            <div className="md:hidden divide-y divide-border">
              {visibleProducts.map((p, idx) => {
                const estoqueStr = p.ESTOQUE || p.QTE || p.estoque || '0';
                const temEstoque = parseEstoque(estoqueStr);
                const codigo = p.CODIGO || p.codigo;
                const descricao = p.DESCRICAO || p.descricao;
                const embalagem = p.EMBALAGEM || p.embalagem || p.emb || 'UN';
                const precoAtacado = p.PRECO_ATACADO || p.preco_atacado;
                const precoVarejo = p.PRECO_VAREJO || p.preco_unitario;

                return (
                  <div
                    key={idx}
                    className="px-3 py-3 active:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedProduct(p)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-primary tracking-wide">{codigo}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        temEstoque
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {temEstoque ? `Est: ${estoqueStr}` : "Sem Est."}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
                      {descricao}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                      <span className="bg-muted px-2 py-0.5 rounded font-bold text-muted-foreground shrink-0">
                        {embalagem}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="text-foreground">At: {formatCurrency(precoAtacado)}</span>
                        <span className="text-muted-foreground">Vr: {formatCurrency(precoVarejo)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* PAINEL DETALHE — FULLSCREEN NO CELULAR / MODAL NO PC */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex flex-col md:justify-center md:items-center bg-background md:bg-background/80 md:backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full h-full md:h-auto md:max-h-[90vh] md:w-[600px] md:rounded-2xl shadow-2xl md:border border-border flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200">

            {/* Cabeçalho do Painel Fixo no Topo */}
            <div className="pt-8 md:pt-4 p-4 border-b border-border flex items-start justify-between bg-primary/5 shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <span className="text-xs font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded">
                  {getVal(selectedProduct, 'CODIGO', 'codigo') || '-'}
                </span>
                <h2 className="text-lg md:text-xl font-black mt-2 leading-tight line-clamp-2">
                  {getVal(selectedProduct, 'DESCRICAO', 'descricao') || '-'}
                </h2>
                <p className="text-xs md:text-sm font-bold text-muted-foreground mt-1 bg-muted inline-block px-2 rounded">
                  Emb: {getVal(selectedProduct, 'EMBALAGEM', 'embalagem', 'emb') || 'UN'}
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-3 bg-muted hover:bg-destructive hover:text-destructive-foreground rounded-full transition-colors shrink-0"
              >
                <X size={24} />
              </button>
            </div>

            {/* Conteúdo Rolável do Painel */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">

              {/* CARD DE DESTAQUE DO ESTOQUE */}
              {(() => {
                const estRaw = getVal(selectedProduct, 'ESTOQUE', 'QTE', 'estoque') || '0';
                const temEst = parseEstoque(estRaw);
                return (
                  <div className={cn(
                    "p-5 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1 shadow-sm transition-all",
                    temEst
                      ? "bg-green-50/80 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200"
                      : "bg-red-50/80 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
                  )}>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Situação do Estoque</span>
                    <span className="text-4xl md:text-5xl font-black tracking-tight">{estRaw}</span>
                    <span className={cn(
                      "mt-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-2xs",
                      temEst ? "bg-green-600 text-white" : "bg-red-600 text-white"
                    )}>
                      {temEst ? "✅ Disponível em Estoque" : "⚠️ Sem Estoque"}
                    </span>
                  </div>
                );
              })()}

              {/* Card Geral */}
              {hasPermission('Ver Card Geral') && (
                <div className="border border-border rounded-2xl p-4 space-y-3 bg-card shadow-2xs">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-primary border-b border-border pb-2">
                    Informações Logísticas & Operação
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Corredor / Localização</p>
                      <p className="font-black text-sm text-primary mt-0.5">{getVal(selectedProduct, 'CORREDOR', 'corredor') || '-'}</p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Palete Estoque</p>
                      <p className="font-black text-sm text-foreground mt-0.5">{getVal(selectedProduct, 'PALETE_ESTOQUE', 'PALETES', 'paletes') || '-'}</p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Idade do Produto</p>
                      <p className="font-extrabold text-sm text-foreground mt-0.5">{getVal(selectedProduct, 'IDADE', 'idade') || 0} dias</p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Dias Sem Venda (ISV)</p>
                      <p className="font-extrabold text-sm text-orange-600 dark:text-orange-400 mt-0.5">
                        {getVal(selectedProduct, 'DIAS_SEM_VENDA', 'ISV', 'dias_sem_venda') || 0} dias
                      </p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50 col-span-2">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Última Entrada no Estoque</p>
                      <p className="font-extrabold text-sm text-foreground mt-0.5">{getVal(selectedProduct, 'ENTRADA', 'entrada') || '-'}</p>
                    </div>
                  </div>

                  {hasPermission('Botao Enviar WPP') && (
                    <button
                      onClick={() => handleWppContact(buildWppMessage(selectedProduct))}
                      className="mt-3 w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-98"
                    >
                      <MessageSquare size={18} />
                      Enviar Info no WhatsApp
                    </button>
                  )}
                </div>
              )}

              {/* Card Extras */}
              {hasPermission('Ver Card Extras') && (
                <div className="border border-border rounded-2xl p-4 space-y-3 bg-card shadow-2xs">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-accent border-b border-border pb-2">
                    Métricas Complementares
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Autonomia</p>
                      <p className="font-extrabold text-sm text-foreground mt-0.5">{getVal(selectedProduct, 'autonomia_dias', 'AUTONOMIA_DIAS', 'autonomia') || 0} dias</p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Venda Mês</p>
                      <p className="font-extrabold text-sm text-foreground mt-0.5">{getVal(selectedProduct, 'venda_mes', 'VENDA_MES') || 0}</p>
                    </div>
                  </div>

                  {hasPermission('Botao Ligar Comprador') && (
                    <button
                      onClick={() => handleWppContact(`Atenção comprador, sobre o item ${getVal(selectedProduct, 'CODIGO', 'codigo')}.`)}
                      className="mt-3 w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-98"
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