import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  ShoppingCart,
  Save,
  History,
  CheckSquare,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  Barcode as BarcodeIcon,
  ChevronRight,
  Search
} from 'lucide-react';
import { api } from '../lib/api';
import { generatePreVendaPDF } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { cn } from '../lib/utils';

export default function PreVenda() {
  const { user, role, hasPermission } = useAuth();
  const [cart, setCart] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [qtd, setQtd] = useState(1);
  const [preco, setPreco] = useState(0);
  const [emb, setEmb] = useState('UN');
  const [atribuicao, setAtribuicao] = useState('');

  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [estoqueAtual, setEstoqueAtual] = useState(0);

  // CORREÇÃO: Adicionado o estado filterDate
  const [filterDate, setFilterDate] = useState('');

  const { products: cacheProducts } = useProducts();

  useEffect(() => {
    const loadHistory = async () => {
      try {
        if (hasPermission('Ver Histórico de Vendas')) {
          const histRes = await api.getHistory('Prevendas');
          setHistory(Array.isArray(histRes) ? histRes : (histRes?.data || []));
        }
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
      }
    };
    loadHistory();
  }, [hasPermission]);

  const handleCodigoChange = (e) => {
    const val = e.target.value;
    setCodigo(val);

    const product = cacheProducts.find(p => String(p.codigo) === val || String(p.codigo_interno) === val);

    if (product) {
      setDescricao(product.descricao || '');
      setPreco(product.preco_unitario || 0);
      setEmb(product.embalagem || 'UN');
      setEstoqueAtual(product.estoque || 0);
    } else {
      setDescricao('');
      setPreco(0);
      setEmb('UN');
      setEstoqueAtual(0);
    }
  };

  const addItem = (e) => {
    e.preventDefault();
    if (!codigo || !descricao || qtd <= 0) return;

    const newItem = {
      id: Date.now().toString(),
      codigo,
      descricao,
      qtd: Number(qtd),
      preco: Number(preco),
      subtotal: Number(qtd) * Number(preco),
      emb: emb
    };

    setCart([...cart, newItem]);
    setCodigo('');
    setDescricao('');
    setQtd(1);
    setPreco(0);
    setEmb('UN');
    setEstoqueAtual(0);
  };

  const removeItem = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + item.subtotal, 0);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleFinalizarVenda = async () => {
    if (cart.length === 0) {
      alert("O carrinho está vazio.");
      return;
    }
    if (!atribuicao) {
      alert("Selecione o responsável pela separação.");
      return;
    }

    setSaving(true);
    try {
      const pedidoData = {
        id: `PV-${Date.now().toString().slice(-6)}`,
        data: new Date().toISOString(),
        atribuicao,
        itens: cart,
        total,
        criadoPor: user?.name,
        status: 'Aberta'
      };

      await api.createPreVenda(pedidoData);
      generatePreVendaPDF(cart, atribuicao, total); // Auto-generate PDF
      alert("Pré-Venda enviada para logística e PDF gerado!");
      setCart([]);
      setAtribuicao('');

      // Refresh history
      const histRes = await api.getHistory('Prevendas');
      setHistory(Array.isArray(histRes) ? histRes : (histRes?.data || []));
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar pré-venda na nuvem.");
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = () => {
    generatePreVendaPDF(cart, atribuicao, total);
  };

  const handleDeleteHistory = async () => {
    if (selectedHistory.length === 0) return;
    if (!hasPermission('Botão Excluir Histórico')) {
      alert("Sem permissão para excluir.");
      return;
    }

    if (window.confirm(`Excluir permanentemente ${selectedHistory.length} registros?`)) {
      setHistoryLoading(true);
      try {
        setHistory(history.filter(h => !selectedHistory.includes(h.id)));
        setSelectedHistory([]);
        alert("Registros removidos com sucesso.");
      } catch (e) {
        alert("Erro ao excluir.");
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const filteredHistory = history.filter(h => {
    if (!filterDate) return true;
    return h.data.includes(filterDate);
  });

  return (
    <div className="flex flex-col h-full space-y-8 pb-10">
      <div className="space-y-1">
        <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic">
          Painel de <span className="text-primary">Pré-Venda</span>
        </h1>
        <p className="text-muted-foreground font-bold text-sm tracking-widest uppercase">
          Gestão de Pedidos e Emissão de Documentos Fiscais
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Adicionar Itens Section */}
        <div className="xl:col-span-4 space-y-6">
          <div className="erp-card p-8 border-t-8 border-t-primary">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <Plus size={24} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Adicionar Item</h2>
            </div>

            <form onSubmit={addItem} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Código do Produto</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-primary">
                    <BarcodeIcon size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold transition-all"
                    value={codigo}
                    onChange={handleCodigoChange}
                    placeholder="Digite ou Bip o código..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Descrição do Produto</label>
                <input
                  type="text"
                  required
                  readOnly
                  className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-muted/30 text-muted-foreground font-bold"
                  value={descricao || "Produto não identificado"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-center text-xl transition-all"
                    value={qtd}
                    onChange={(e) => setQtd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Preço Unit. (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-center text-xl transition-all"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!descricao}
                className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl transition-all shadow-xl hover:shadow-primary/20 transform hover:-translate-y-1 active:scale-95 uppercase tracking-widest text-sm disabled:opacity-50 disabled:transform-none"
              >
                Incluir no Carrinho
              </button>
            </form>

            <div className="mt-10 pt-8 border-t-2 border-dashed border-border">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 block mb-3">Atribuir Separação a</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-primary">
                  <User size={18} />
                </div>
                <select
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary font-bold appearance-none cursor-pointer"
                  value={atribuicao}
                  onChange={(e) => setAtribuicao(e.target.value)}
                >
                  <option value="">Selecione um responsável</option>
                  <option value="Lider João">Líder João</option>
                  <option value="Repositor Marcos">Repositor Marcos</option>
                  <option value="Repositora Ana">Repositora Ana</option>
                  <option value="Terceirizado Log">Terceirizado Log</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Carrinho Section */}
        <div className="xl:col-span-8 flex flex-col space-y-6">
          <div className="erp-card flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShoppingCart size={24} className="text-primary" />
                <h2 className="text-xl font-black uppercase tracking-tight">Checkout de Itens</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-background px-3 py-1 rounded-full border border-border">
                  {cart.length} Itens
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-background">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground/30">
                  <ShoppingCart size={80} strokeWidth={1} />
                  <p className="mt-4 font-bold text-lg">O carrinho de pré-venda está vazio.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Item</th>
                          <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-center">Qtd</th>
                          <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-right">Unitário</th>
                          <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-right">Subtotal</th>
                          <th className="px-6 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cart.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/10 transition-all">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-black text-primary text-xs tracking-widest">{item.codigo}</span>
                                <span className="font-bold text-foreground line-clamp-1">{item.descricao}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-black">{item.qtd} {item.emb}</td>
                            <td className="px-6 py-4 text-right font-bold">{formatCurrency(item.preco)}</td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-black text-primary text-lg">{formatCurrency(item.subtotal)}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all active:scale-90"
                              >
                                <Trash2 size={20} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden flex flex-col gap-4 p-4">
                    {cart.map((item) => (
                      <div key={item.id} className="bg-card border-2 border-border p-4 rounded-2xl shadow-sm relative">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all active:scale-90"
                        >
                          <Trash2 size={18} />
                        </button>
                        <span className="font-black text-primary text-[10px] tracking-widest uppercase block mb-1">{item.codigo}</span>
                        <span className="font-bold text-foreground block mb-4 pr-8 leading-tight">{item.descricao}</span>
                        <div className="flex justify-between items-end pt-4 border-t border-dashed border-border">
                          <div>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">Valor Un.</span>
                            <span className="font-bold">{formatCurrency(item.preco)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">Qtd</span>
                            <span className="font-black bg-muted px-3 py-1 rounded-lg">{item.qtd} {item.emb}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">Subtotal</span>
                            <span className="font-black text-primary text-lg">{formatCurrency(item.subtotal)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-6 md:p-8 border-t-4 border-t-primary bg-background md:bg-primary/5 flex flex-col md:flex-row gap-6 md:gap-8 items-center justify-between sticky bottom-0 z-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] md:shadow-none">
              <div className="text-center md:text-right space-y-1 w-full md:w-auto order-1 md:order-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Total Acumulado</p>
                <p className="text-4xl md:text-5xl font-black text-primary md:text-foreground tracking-tighter">{formatCurrency(total)}</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto order-2 md:order-1">
                <button
                  onClick={generatePDF}
                  disabled={cart.length === 0}
                  className="w-full md:w-auto flex items-center justify-center gap-3 bg-card hover:bg-muted text-foreground border-2 border-border font-black py-4 px-8 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <FileText size={22} className="text-primary" />
                  Gerar PDF
                </button>
                <button
                  onClick={handleFinalizarVenda}
                  disabled={cart.length === 0 || saving}
                  className="w-full md:w-auto flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black py-4 px-12 rounded-2xl transition-all shadow-xl hover:shadow-primary/30 active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={22} /> : <Save size={22} />}
                  Finalizar Venda
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico Section */}
      {hasPermission('Ver Histórico de Vendas') && (
        <div className="erp-card flex flex-col overflow-hidden">
          <div className="p-8 border-b border-border bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-muted rounded-3xl text-primary border border-border shadow-sm">
                <History size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Histórico de Movimentação</h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Auditória completa de pré-vendas</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                  type="date"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-border bg-background focus:border-primary font-bold transition-all text-sm"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
              {selectedHistory.length > 0 && (
                <button
                  onClick={handleDeleteHistory}
                  className="flex items-center gap-2 bg-destructive text-destructive-foreground px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-lg hover:shadow-destructive/20 transition-all active:scale-95"
                >
                  <Trash2 size={16} /> Excluir ({selectedHistory.length})
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar p-0">
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-8 py-5 w-16 text-center">
                      <CheckSquare size={18} className="mx-auto text-muted-foreground" />
                    </th>
                    <th className="px-8 py-5 font-black uppercase text-[10px] tracking-widest">ID Pedido</th>
                    <th className="px-8 py-5 font-black uppercase text-[10px] tracking-widest">Data / Hora</th>
                    <th className="px-8 py-5 font-black uppercase text-[10px] tracking-widest">Responsável</th>
                    <th className="px-8 py-5 font-black uppercase text-[10px] tracking-widest text-center">Status</th>
                    <th className="px-8 py-5 font-black uppercase text-[10px] tracking-widest text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyLoading ? (
                    <tr>
                      <td colSpan="6" className="px-8 py-20 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary w-12 h-12" />
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-8 py-20 text-center text-muted-foreground/50 italic font-bold">
                        Nenhum registro encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-muted/10 transition-all">
                        <td className="px-8 py-5 text-center">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded-lg border-2 border-border text-primary focus:ring-primary transition-all cursor-pointer"
                            checked={selectedHistory.includes(h.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedHistory([...selectedHistory, h.id]);
                              else setSelectedHistory(selectedHistory.filter(id => id !== h.id));
                            }}
                          />
                        </td>
                        <td className="px-8 py-5">
                          <span className="font-black text-foreground">{h.id}</span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{new Date(h.data).toLocaleDateString()}</span>
                            <span className="text-[10px] font-black text-muted-foreground uppercase">{new Date(h.data).toLocaleTimeString()}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">
                              {h.responsavel?.charAt(0)}
                            </div>
                            <span className="font-bold">{h.responsavel}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={cn(
                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            h.status === 'Aberta' ? "bg-muted text-muted-foreground border-border" :
                              h.status === 'Finalizada' ? "bg-success/10 text-success border-success/20" :
                                "bg-primary/10 text-primary border-primary/20"
                          )}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="font-black text-lg">{formatCurrency(h.total)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden flex flex-col gap-4 p-4 bg-muted/5">
              {historyLoading ? (
                <div className="py-20 text-center">
                  <Loader2 className="animate-spin mx-auto text-primary w-12 h-12" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground/50 italic font-bold">
                  Nenhum registro encontrado.
                </div>
              ) : (
                filteredHistory.map((h) => (
                  <div key={h.id} className="bg-card border-2 border-border p-5 rounded-2xl shadow-sm relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-2 border-border text-primary focus:ring-primary transition-all cursor-pointer"
                          checked={selectedHistory.includes(h.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedHistory([...selectedHistory, h.id]);
                            else setSelectedHistory(selectedHistory.filter(id => id !== h.id));
                          }}
                        />
                        <div>
                          <span className="font-black text-foreground text-lg tracking-tight block">{h.id}</span>
                          <span className="text-[10px] font-black text-muted-foreground uppercase">{new Date(h.data).toLocaleDateString()} às {new Date(h.data).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        h.status === 'Aberta' ? "bg-muted text-muted-foreground border-border" :
                          h.status === 'Finalizada' ? "bg-success/10 text-success border-success/20" :
                            "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {h.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-dashed border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[8px]">
                          {h.responsavel?.charAt(0)}
                        </div>
                        <span className="font-bold text-sm text-muted-foreground">{h.responsavel}</span>
                      </div>
                      <span className="font-black text-lg">{formatCurrency(h.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}