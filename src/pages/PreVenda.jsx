import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, ShoppingCart, Save, History, Loader2, Calendar, User, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { generatePreVendaPDF } from '../lib/pdfGenerator';

export default function PreVenda() {
  const { user, hasPermission } = useAuth();
  const { searchLocal } = useProducts();
  const location = useLocation();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterText, setFilterText] = useState('');
  
  const [isNova, setIsNova] = useState(false);
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill if coming from Requisicoes
  useEffect(() => {
    if (location.state?.requisicao) {
      const req = location.state.requisicao;
      const initialCart = req.itens.map(i => {
        const prod = searchLocal(i.codigo)[0]; // get more info from cache if available
        return {
          id: i.codigo,
          codigo: i.codigo,
          descricao: i.descricao,
          qtd: i.qtd,
          preco: prod ? (prod.PRECO_ATACADO || prod.preco_atacado || 0) : 0,
          emb: prod ? (prod.EMBALAGEM || prod.emb || 'UN') : 'UN',
        };
      });
      setCart(initialCart);
      setIsNova(true);
    }
  }, [location]);

  // Mock History Loading
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setHistory([
        { id: 'PV-001', data: new Date().toISOString(), cliente: 'Empresa A', total: 1500.50, status: 'Aberta', separador: '' },
        { id: 'PV-002', data: new Date().toISOString(), cliente: 'Empresa B', total: 3200.00, status: 'Em Separação', separador: 'João' }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredHistory = history.filter(h => {
    let match = true;
    if (filterDate && !h.data.includes(filterDate)) match = false;
    if (filterText && !h.cliente.toLowerCase().includes(filterText.toLowerCase()) && !h.id.toLowerCase().includes(filterText.toLowerCase())) match = false;
    return match;
  });

  const searchResults = searchLocal(query).slice(0, 5);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleAddItem = (p) => {
    const exists = cart.find(i => i.codigo === (p.CODIGO || p.codigo));
    if (exists) {
      setCart(cart.map(i => i.codigo === exists.codigo ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setCart([...cart, { 
        id: p.CODIGO || p.codigo,
        codigo: p.CODIGO || p.codigo, 
        descricao: p.DESCRICAO || p.descricao, 
        qtd: 1,
        preco: Number(p.PRECO_ATACADO || p.preco_atacado || 0),
        emb: p.EMBALAGEM || p.emb || 'UN'
      }]);
    }
  };

  const updateCartQtd = (id, qtd) => {
    if(qtd <= 0) {
      setCart(cart.filter(i => i.id !== id));
      return;
    }
    setCart(cart.map(i => i.id === id ? { ...i, qtd } : i));
  };

  const totalCart = cart.reduce((acc, i) => acc + (i.qtd * i.preco), 0);

  const handleSalvarPreVenda = async () => {
    if (cart.length === 0) return alert('Adicione itens.');
    setSaving(true);
    try {
      // Simulate API Call
      const newPv = {
        id: `PV-${Date.now().toString().slice(-4)}`,
        data: new Date().toISOString(),
        cliente: user?.name || 'Vendedor',
        total: totalCart,
        status: 'Aberta',
        separador: ''
      };
      setHistory([newPv, ...history]);
      setIsNova(false);
      setCart([]);
      alert('Pré-Venda criada com sucesso!');
    } catch (e) {
      alert('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistory = () => {
    if(window.confirm('Excluir registros selecionados?')) {
      setHistory(history.filter(h => !selectedIds.includes(h.id)));
      setSelectedIds([]);
    }
  };

  const assignSeparador = (id, separador) => {
    setHistory(history.map(h => h.id === id ? { ...h, separador, status: 'Em Separação' } : h));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <History size={32} /> Histórico de Pré-Vendas
          </h1>
          <p className="text-muted-foreground font-medium text-sm">Gerenciamento e conversão de pedidos</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <button onClick={handleDeleteHistory} className="btn-primary bg-destructive text-destructive-foreground flex items-center gap-2">
                <Trash2 size={18} /> Excluir ({selectedIds.length})
              </button>
            </>
          )}
          <button onClick={() => setIsNova(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Nova Pré-Venda
          </button>
        </div>
      </div>

      <div className="erp-card p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input 
            type="text" 
            placeholder="Filtrar por Cliente ou ID..." 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <div className="relative w-full md:w-64">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input 
            type="date" 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-primary"><Loader2 className="animate-spin mx-auto w-8 h-8" /></div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhuma pré-venda encontrada.</div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? filteredHistory.map(h=>h.id) : [])} checked={selectedIds.length === filteredHistory.length && filteredHistory.length > 0} /></th>
                <th className="px-4 py-3 font-bold">ID / Cliente</th>
                <th className="px-4 py-3 font-bold">Data</th>
                <th className="px-4 py-3 font-bold text-center">Status</th>
                <th className="px-4 py-3 font-bold text-right">Total</th>
                <th className="px-4 py-3 font-bold text-center">Separador (Apenas Gerentes)</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredHistory.map(h => (
                <tr key={h.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(h.id)} onChange={() => {
                    if (selectedIds.includes(h.id)) setSelectedIds(selectedIds.filter(i => i !== h.id));
                    else setSelectedIds([...selectedIds, h.id]);
                  }} /></td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-primary block">{h.id}</span>
                    <span className="text-xs text-muted-foreground font-semibold">{h.cliente}</span>
                  </td>
                  <td className="px-4 py-3">{new Date(h.data).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("px-2 py-1 rounded text-xs font-bold uppercase", h.status === 'Aberta' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-black">{formatCurrency(h.total)}</td>
                  <td className="px-4 py-3 text-center">
                    {hasPermission('Acesso Requisições') ? (
                       <select 
                        value={h.separador} 
                        onChange={(e) => assignSeparador(h.id, e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs"
                      >
                         <option value="">Não atribuído</option>
                         <option value="João">João (Repositor)</option>
                         <option value="Marcos">Marcos (Repositor)</option>
                       </select>
                    ) : (
                      <span className="text-xs">{h.separador || 'N/A'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      className="text-primary hover:bg-primary/10 p-2 rounded" 
                      title="Gerar PDF Profissional"
                      onClick={() => generatePreVendaPDF(h)}
                    >
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isNova && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="bg-card w-full max-w-5xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-primary/5 flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2"><ShoppingCart size={24} /> Criação de Pré-Venda</h2>
              <button onClick={() => setIsNova(false)} className="p-2 hover:bg-destructive rounded-full hover:text-destructive-foreground"><X size={20}/></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="w-full md:w-5/12 p-4 border-r border-border flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input 
                    type="text" 
                    className="w-full pl-9 pr-4 py-3 rounded-lg border border-border bg-background" 
                    placeholder="Buscar Código ou Descrição..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {query && searchResults.map(p => (
                    <div key={p.CODIGO || p.codigo} className="p-3 border rounded-lg hover:border-primary flex justify-between items-center bg-muted/10">
                      <div>
                        <p className="font-bold text-sm text-primary">{p.CODIGO || p.codigo}</p>
                        <p className="text-xs font-semibold line-clamp-1">{p.DESCRICAO || p.descricao}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Atacado: {formatCurrency(p.PRECO_ATACADO || p.preco_atacado)}</p>
                      </div>
                      <button onClick={() => handleAddItem(p)} className="p-2 bg-primary text-primary-foreground rounded-lg shadow-sm">
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-7/12 p-4 flex flex-col bg-muted/5">
                <h3 className="font-bold text-sm uppercase mb-4 text-muted-foreground border-b pb-2">Itens ({cart.length})</h3>
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                  {cart.map(item => (
                    <div key={item.id} className="p-3 border bg-card rounded-lg flex flex-col shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-sm text-primary">{item.codigo}</p>
                          <p className="text-xs line-clamp-1">{item.descricao}</p>
                        </div>
                        <button onClick={() => updateCartQtd(item.id, 0)} className="text-muted-foreground hover:text-destructive"><Trash2 size={16}/></button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Qtd:</span>
                          <input 
                            type="number" 
                            min="0"
                            value={item.qtd}
                            onChange={(e) => updateCartQtd(item.id, Number(e.target.value))}
                            className="w-16 text-center border rounded p-1 font-bold text-sm bg-background"
                          />
                          <span className="text-[10px] font-bold">{item.emb}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground block">Subtotal</span>
                          <span className="font-black">{formatCurrency(item.qtd * item.preco)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t-2 border-primary bg-card p-4 rounded-xl shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Total da Pré-Venda</span>
                    <span className="text-3xl font-black text-primary">{formatCurrency(totalCart)}</span>
                  </div>
                  <button 
                    onClick={handleSalvarPreVenda}
                    disabled={saving || cart.length === 0}
                    className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg shadow-xl"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Save />} Finalizar Pré-Venda
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}