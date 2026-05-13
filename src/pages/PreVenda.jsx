import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, FileText, ShoppingCart, Save, History, Loader2, Calendar, User, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { generatePreVendaPDF } from '../lib/pdfGenerator';
import { listenToNode } from '../lib/firebase';
import { cn, formatCurrency } from '../lib/utils';

export default function PreVenda() {
  const { user, hasPermission } = useAuth();
  const { searchLocal } = useProducts();
  const location = useLocation();

  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isNovaPreVenda, setIsNovaPreVenda] = useState(false);
  const [query, setQuery] = useState('');
  const [cliente, setCliente] = useState('');
  const [itens, setItens] = useState([]);
  const [saving, setSaving] = useState(false);
  const [repositores, setRepositores] = useState([]);

  const unsubRef = useRef(null);

  useEffect(() => {
    if (isNovaPreVenda) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isNovaPreVenda]);

  useEffect(() => {
    if (location.state?.pedidoParaConverter) {
      const p = location.state.pedidoParaConverter;
      setCliente(p.cliente);
      setItens(p.itens.map(i => ({ ...i, preco: 0 })));
      setIsNovaPreVenda(true);
    }
  }, [location]);

  useEffect(() => {
    unsubRef.current = listenToNode('prevendas', (items) => {
      let filtered = items;
      if (user?.role === 'vendedor') {
        const userName = user?.name || user?.usuario || '';
        filtered = items.filter(p => (p.usuario || '').toLowerCase() === userName.toLowerCase());
      }
      setHistorico(filtered);
      setLoading(false);
    });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [user]);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const users = await api.getUsuarios();
        const separadores = users.filter(u =>
          (u.Role || u.role || '').toLowerCase().includes('repositor') ||
          (u.Role || u.role || '').toLowerCase().includes('lider')
        );
        setRepositores(separadores);
      } catch (e) { }
    };
    fetchUsuarios();
  }, []);

  const searchResults = searchLocal(query).slice(0, 30);

  const handleAddItem = (p) => {
    const codigo = p.CODIGO || p.codigo;
    const exists = itens.find(i => i.codigo === codigo);
    if (exists) {
      setItens(itens.map(i => i.codigo === exists.codigo ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setItens([...itens, {
        codigo,
        descricao: p.DESCRICAO || p.descricao,
        embalagem: p.EMBALAGEM || p.embalagem || p.emb || 'UN',
        qtd: 1,
        preco: Number(p.PRECO_ATACADO || p.preco_atacado || 0)
      }]);
    }
  };

  const updateItem = (codigo, field, value) => {
    setItens(itens.map(i => i.codigo === codigo ? { ...i, [field]: value === '' ? '' : Number(value) } : i));
  };

  const removeItem = (codigo) => {
    setItens(itens.filter(i => i.codigo !== codigo));
  };

  const handleSalvar = async () => {
    if (!cliente) return alert('Informe o cliente.');
    if (itens.length === 0) return alert('Adicione itens.');

    setSaving(true);
    const validItems = itens.map(i => ({
      ...i,
      qtd: Number(i.qtd) || 0,
      preco: Number(i.preco) || 0,
      subtotal: (Number(i.qtd) || 0) * (Number(i.preco) || 0)
    }));

    const total = validItems.reduce((acc, i) => acc + i.subtotal, 0);

    const prevenda = {
      cliente,
      usuario: user?.usuario || user?.name || '',
      data: new Date().toISOString(),
      itens: validItems,
      total,
      status: 'Aberta',
      atribuido: '',
    };

    try {
      await api.createPreVenda(prevenda);
      setCliente('');
      setItens([]);
      setIsNovaPreVenda(false);
      alert('Pré-venda salva!');
    } catch (e) {
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const assignSeparador = async (id, separadorNome) => {
    try {
      await api.updatePreVendaStatus(id, {
        atribuido: separadorNome,
        status: separadorNome ? 'Em Separação' : 'Aberta'
      });
    } catch (e) {
      alert('Erro ao atribuir.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary">Pré-Venda</h1>
          <p className="text-muted-foreground font-medium text-sm">Geração de orçamentos e separação</p>
        </div>
        {hasPermission('Criar Prevenda') && (
          <button onClick={() => setIsNovaPreVenda(true)} className="btn-primary flex items-center gap-2 text-xs">
            <Plus size={16} /> Nova Pré-Venda
          </button>
        )}
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-primary"><Loader2 className="animate-spin mx-auto w-8 h-8" /></div>
        ) : historico.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhuma pré-venda registrada.</p>
          </div>
        ) : (
          <>
            <table className="hidden md:table w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">ID / Cliente</th>
                  <th className="px-4 py-3 font-bold">Data</th>
                  <th className="px-4 py-3 font-bold">Vendedor</th>
                  <th className="px-4 py-3 font-bold text-right">Total</th>
                  <th className="px-4 py-3 font-bold text-center">Status</th>
                  <th className="px-4 py-3 font-bold text-center">Separador</th>
                  <th className="px-4 py-3 font-bold text-center">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historico.map(h => (
                  <tr key={h.firebaseId} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-primary">#{h.firebaseId?.slice(-6) || h.id}</p>
                      <p className="text-xs truncate max-w-[150px]">{h.cliente}</p>
                    </td>
                    <td className="px-4 py-3">{new Date(h.data || h.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs">{h.usuario}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(h.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase",
                        h.status === 'Aberta' ? 'bg-orange-100 text-orange-700' :
                          h.status === 'Finalizada' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                      )}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasPermission('Acesso Requisições') ? (
                        <select
                          value={h.atribuido || ''}
                          onChange={(e) => assignSeparador(h.firebaseId, e.target.value)}
                          className="bg-background border border-border rounded px-2 py-1 text-xs"
                        >
                          <option value="">Não atribuído</option>
                          {repositores.map((r, i) => (
                            <option key={i} value={r.Usuario || r.usuario}>{r.Usuario || r.usuario}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs">{h.atribuido || 'N/A'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => generatePreVendaPDF(h)} className="text-primary hover:bg-primary/10 p-2 rounded" title="Gerar PDF">
                        <FileText size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="md:hidden divide-y divide-border">
              {historico.map(h => (
                <div key={h.firebaseId} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-primary text-sm">#{h.firebaseId?.slice(-6) || h.id}</span>
                      <p className="text-xs text-muted-foreground">{new Date(h.data || h.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase",
                      h.status === 'Aberta' ? 'bg-orange-100 text-orange-700' :
                        h.status === 'Finalizada' ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'
                    )}>{h.status}</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm truncate">{h.cliente}</p>
                    <p className="text-xs text-muted-foreground">Vend: {h.usuario}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <p className="font-black text-primary">{formatCurrency(h.total)}</p>
                    <div className="flex items-center gap-2">
                      {hasPermission('Acesso Requisições') ? (
                        <select
                          value={h.atribuido || ''}
                          onChange={(e) => assignSeparador(h.firebaseId, e.target.value)}
                          className="bg-background border border-border rounded px-2 py-1 text-xs max-w-[120px]"
                        >
                          <option value="">S/ Atrib.</option>
                          {repositores.map((r, i) => (
                            <option key={i} value={r.Usuario || r.usuario}>{r.Usuario || r.usuario}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs bg-muted px-2 py-1 rounded">{h.atribuido || 'S/ Atrib.'}</span>
                      )}
                      <button onClick={() => generatePreVendaPDF(h)} className="text-primary hover:bg-primary/10 p-1.5 rounded-lg">
                        <FileText size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL: Nova Pré-Venda */}
      {isNovaPreVenda && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col md:items-center md:justify-center bg-background md:bg-background/95 md:backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full h-full md:max-w-5xl md:h-auto md:max-h-[90vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="pt-8 md:pt-4 p-4 border-b border-border bg-primary/5 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black">Nova Pré-Venda</h2>
              <button onClick={() => setIsNovaPreVenda(false)} className="p-3 bg-muted hover:bg-destructive rounded-full hover:text-destructive-foreground">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              <div className="w-full md:w-1/2 p-4 md:border-r border-b md:border-b-0 border-border flex flex-col gap-3 shrink-0 md:shrink md:min-h-0 max-h-[50vh] md:max-h-none">
                <input
                  type="text"
                  placeholder="Nome do Cliente..."
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-background font-bold text-base"
                />
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-4 py-3 border rounded-lg bg-background text-base"
                    placeholder="Pesquisar Produto..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar min-h-0">
                  {query && searchResults.map(p => (
                    <div key={p.CODIGO || p.codigo} className="p-3 border rounded-lg hover:border-primary flex justify-between items-center bg-muted/20">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-sm text-primary">{p.CODIGO || p.codigo}</p>
                        <p className="text-xs font-semibold truncate">{p.DESCRICAO || p.descricao}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {p.EMBALAGEM || p.embalagem || 'UN'} | Atacado: {formatCurrency(p.PRECO_ATACADO || p.preco_atacado)}
                        </p>
                      </div>
                      <button onClick={() => handleAddItem(p)} className="p-2.5 bg-primary/10 text-primary rounded-lg shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <Plus size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-1/2 p-4 flex flex-col bg-muted/10 min-h-0 flex-1">
                <h3 className="font-bold text-sm uppercase mb-3 text-muted-foreground shrink-0">Itens ({itens.length})</h3>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar min-h-0">
                  {itens.map(item => (
                    <div key={item.codigo} className="p-3 border bg-card rounded-lg shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-bold text-xs truncate">{item.codigo} - {item.descricao}</p>
                          <p className="text-[10px] text-muted-foreground">Emb: {item.embalagem}</p>
                        </div>
                        <button onClick={() => removeItem(item.codigo)} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-muted-foreground block mb-1">Qtd:</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={item.qtd}
                            onChange={(e) => updateItem(item.codigo, 'qtd', e.target.value)}
                            className="w-full text-center border rounded p-1.5 font-bold text-base bg-background min-h-[44px]"
                          />
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-muted-foreground block mb-1">Preço (R$):</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={item.preco}
                            onChange={(e) => updateItem(item.codigo, 'preco', e.target.value)}
                            className="w-full text-center border rounded p-1.5 font-bold text-base bg-background min-h-[44px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t shrink-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-muted-foreground">Total:</span>
                    <span className="text-xl font-black text-primary">
                      {formatCurrency(itens.reduce((acc, i) => acc + ((Number(i.qtd) || 0) * (Number(i.preco) || 0)), 0))}
                    </span>
                  </div>
                  <button
                    onClick={handleSalvar}
                    disabled={saving}
                    className="w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2 min-h-[48px]"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Salvar Pré-Venda
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.getElementById('root') || document.body
      )}
    </div>
  );
}