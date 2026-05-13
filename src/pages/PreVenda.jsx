import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, FileText, ShoppingCart, Save, History, Loader2, Calendar, User, Search, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { generatePreVendaPDF } from '../lib/pdfGenerator';
import { listenToNode, listenToUsers, updateRecordFirebase } from '../lib/firebase';
import { cn, formatCurrency } from '../lib/utils';
import { createPortal } from 'react-dom';

export default function PreVenda() {
  const { user, hasPermission } = useAuth();
  const { searchLocal } = useProducts();
  const location = useLocation();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterText, setFilterText] = useState('');
  const [repositores, setRepositores] = useState([]);

  const [isNova, setIsNova] = useState(false);
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const unsubRef = useRef(null);
  const unsubUsersRef = useRef(null);

  // Scroll Lock: trava o body quando o modal está aberto
  useEffect(() => {
    if (isNova) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isNova]);

  // Pre-fill if coming from Requisicoes
  useEffect(() => {
    if (location.state?.requisicao) {
      const req = location.state.requisicao;
      const initialCart = req.itens.map(i => {
        const prod = searchLocal(i.codigo)[0];
        return {
          id: i.codigo, codigo: i.codigo, descricao: i.descricao, qtd: i.qtd,
          preco: prod ? Number(prod.PRECO_ATACADO || prod.preco_atacado || 0) : 0,
          emb: prod ? (prod.EMBALAGEM || prod.embalagem || prod.emb || 'UN') : 'UN',
        };
      });
      setCart(initialCart);
      setIsNova(true);
    }
  }, [location]);

  useEffect(() => {
    unsubRef.current = listenToNode('prevendas', (items) => { setHistory(items); setLoading(false); });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  useEffect(() => {
    unsubUsersRef.current = listenToUsers((users) => {
      setRepositores(users.filter(u => {
        const role = (u.role || u.perfil || u.cargo || '').toLowerCase();
        return role === 'repositor' || role === 'lider' || role === 'líder';
      }));
    });
    return () => { if (unsubUsersRef.current) unsubUsersRef.current(); };
  }, []);

  const filteredHistory = history.filter(h => {
    let match = true;
    if (filterDate && !(h.data || h.createdAt || '').includes(filterDate)) match = false;
    if (filterText) {
      const lt = filterText.toLowerCase();
      const matchText = (h.cliente || '').toLowerCase().includes(lt) || (h.firebaseId || h.id || '').toLowerCase().includes(lt);
      if (!matchText) match = false;
    }
    return match;
  });

  // Aumentado de 5 para 30 resultados com scroll
  const searchResults = searchLocal(query).slice(0, 30);

  const handleAddItem = (p) => {
    const codigo = p.CODIGO || p.codigo;
    const exists = cart.find(i => i.codigo === codigo);
    if (exists) {
      setCart(cart.map(i => i.codigo === exists.codigo ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setCart([...cart, {
        id: codigo, codigo, descricao: p.DESCRICAO || p.descricao, qtd: 1,
        preco: Number(p.PRECO_ATACADO || p.preco_atacado || 0),
        emb: p.EMBALAGEM || p.embalagem || p.emb || 'UN'
      }]);
    }
  };

  const updateCartQtd = (id, value) => {
    if (value === '' || value === null || value === undefined) { setCart(cart.map(i => i.id === id ? { ...i, qtd: '' } : i)); return; }
    const qtd = Number(value);
    if (isNaN(qtd) || qtd < 0) return;
    setCart(cart.map(i => i.id === id ? { ...i, qtd } : i));
  };

  const updateCartPreco = (id, value) => {
    if (value === '' || value === null || value === undefined) { setCart(cart.map(i => i.id === id ? { ...i, preco: '' } : i)); return; }
    const preco = Number(value);
    if (isNaN(preco) || preco < 0) return;
    setCart(cart.map(i => i.id === id ? { ...i, preco } : i));
  };

  const removeCartItem = (id) => { setCart(cart.filter(i => i.id !== id)); };

  const totalCart = cart.reduce((acc, i) => acc + ((Number(i.qtd) || 0) * (Number(i.preco) || 0)), 0);

  const handleSalvarPreVenda = async () => {
    const validCart = cart.filter(i => Number(i.qtd) > 0);
    if (validCart.length === 0) return alert('Adicione itens com quantidade válida.');
    setSaving(true);
    try {
      await api.createPreVenda({
        cliente: user?.name || user?.usuario || 'Vendedor', data: new Date().toISOString(),
        itens: validCart.map(i => ({ ...i, qtd: Number(i.qtd), preco: Number(i.preco), subtotal: Number(i.qtd) * Number(i.preco) })),
        total: totalCart, status: 'Aberta', separador: '', criadoPor: user?.name || user?.usuario || 'Vendedor',
      });
      setIsNova(false); setCart([]); setQuery('');
      alert('Pré-Venda criada com sucesso!');
    } catch (e) { console.error(e); alert('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDeleteHistory = async () => {
    if (window.confirm('Excluir registros selecionados?')) {
      try { await api.deleteMultiple('prevendas', selectedIds); setSelectedIds([]); }
      catch (e) { alert('Erro ao excluir.'); }
    }
  };

  const assignSeparador = async (firebaseId, separador) => {
    try { await updateRecordFirebase('prevendas', firebaseId, { separador, status: separador ? 'Em Separação' : 'Aberta' }); }
    catch (e) { alert('Erro ao atribuir separador.'); }
  };

  const buildWhatsAppText = (preVenda) => {
    const lines = [
      `📋 *PRÉ-VENDA* #${preVenda.firebaseId?.slice(-6) || ''}`,
      `📅 ${new Date(preVenda.data || preVenda.createdAt).toLocaleDateString('pt-BR')}`,
      `👤 *Cliente:* ${preVenda.cliente || '-'}`, `──────────────────`,
    ];
    (preVenda.itens || []).forEach((item, idx) => {
      lines.push(`${idx + 1}. *${item.codigo}* — ${item.descricao}`);
      lines.push(`   Emb: ${item.emb || item.embalagem || 'UN'} | Qtd: ${item.qtd} | Preço: ${formatCurrency(item.preco)} | Sub: ${formatCurrency(item.subtotal || (item.qtd * item.preco))}`);
    });
    lines.push(`──────────────────`);
    lines.push(`💰 *TOTAL GERAL: ${formatCurrency(preVenda.total)}*`);
    return lines.join('\n');
  };

  const handleEnviarWhatsApp = (preVenda) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppText(preVenda))}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary flex items-center gap-2">
            <History size={28} /> Pré-Vendas
          </h1>
          <p className="text-muted-foreground font-medium text-sm">Gerenciamento e conversão de pedidos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button onClick={handleDeleteHistory} className="btn-primary bg-destructive text-destructive-foreground flex items-center gap-2 text-xs">
              <Trash2 size={16} /> Excluir ({selectedIds.length})
            </button>
          )}
          <button onClick={() => setIsNova(true)} className="btn-primary flex items-center gap-2 text-xs">
            <Plus size={16} /> Nova Pré-Venda
          </button>
        </div>
      </div>

      <div className="erp-card p-3 md:p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input type="text" placeholder="Filtrar por Cliente ou ID..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-base" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
        </div>
        <div className="relative w-full md:w-64">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input type="date" className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-base" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-primary"><Loader2 className="animate-spin mx-auto w-8 h-8" /></div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhuma pré-venda encontrada.</div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3"><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? filteredHistory.map(h => h.firebaseId) : [])} checked={selectedIds.length === filteredHistory.length && filteredHistory.length > 0} /></th>
                    <th className="px-4 py-3 font-bold">ID / Cliente</th>
                    <th className="px-4 py-3 font-bold">Data</th>
                    <th className="px-4 py-3 font-bold text-center">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Total</th>
                    <th className="px-4 py-3 font-bold text-center">Separador</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredHistory.map(h => (
                    <tr key={h.firebaseId} className="hover:bg-muted/30">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(h.firebaseId)} onChange={() => { if (selectedIds.includes(h.firebaseId)) setSelectedIds(selectedIds.filter(i => i !== h.firebaseId)); else setSelectedIds([...selectedIds, h.firebaseId]); }} /></td>
                      <td className="px-4 py-3"><span className="font-bold text-primary block">{h.firebaseId?.slice(-6) || h.id}</span><span className="text-xs text-muted-foreground font-semibold">{h.cliente}</span></td>
                      <td className="px-4 py-3">{new Date(h.data || h.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-center"><span className={cn("px-2 py-1 rounded text-xs font-bold uppercase", h.status === 'Aberta' ? 'bg-orange-100 text-orange-700' : h.status === 'Em Separação' ? 'bg-blue-100 text-blue-700' : h.status === 'Finalizada' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>{h.status}</span></td>
                      <td className="px-4 py-3 text-right font-black">{formatCurrency(h.total)}</td>
                      <td className="px-4 py-3 text-center">
                        {hasPermission('Acesso Requisições') ? (
                          <select value={h.separador || ''} onChange={(e) => assignSeparador(h.firebaseId, e.target.value)} className="bg-background border border-border rounded px-2 py-1 text-xs">
                            <option value="">Não atribuído</option>
                            {repositores.map(u => (<option key={u.firebaseId || u.usuario} value={u.nome || u.usuario}>{u.nome || u.usuario}</option>))}
                          </select>
                        ) : (<span className="text-xs">{h.separador || 'N/A'}</span>)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="text-primary hover:bg-primary/10 p-2 rounded" onClick={() => generatePreVendaPDF(h)}><FileText size={18} /></button>
                          <button className="text-[#25D366] hover:bg-[#25D366]/10 p-2 rounded" onClick={() => handleEnviarWhatsApp(h)}><MessageSquare size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS — Cada linha da tabela vira um card vertical */}
            <div className="md:hidden divide-y divide-border">
              {filteredHistory.map(h => (
                <div key={h.firebaseId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedIds.includes(h.firebaseId)} onChange={() => { if (selectedIds.includes(h.firebaseId)) setSelectedIds(selectedIds.filter(i => i !== h.firebaseId)); else setSelectedIds([...selectedIds, h.firebaseId]); }} className="w-5 h-5 shrink-0" />
                      <div>
                        <span className="font-black text-primary text-sm block">#{h.firebaseId?.slice(-6) || h.id}</span>
                        <span className="text-xs text-muted-foreground font-semibold">{h.cliente}</span>
                      </div>
                    </div>
                    <span className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase shrink-0", h.status === 'Aberta' ? 'bg-orange-100 text-orange-700' : h.status === 'Em Separação' ? 'bg-blue-100 text-blue-700' : h.status === 'Finalizada' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>{h.status}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground font-bold block">Data</span><span className="font-semibold">{new Date(h.data || h.createdAt).toLocaleDateString()}</span></div>
                    <div className="text-right"><span className="text-muted-foreground font-bold block">Total</span><span className="font-black text-primary">{formatCurrency(h.total)}</span></div>
                  </div>

                  {hasPermission('Acesso Requisições') && (
                    <select value={h.separador || ''} onChange={(e) => assignSeparador(h.firebaseId, e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-bold">
                      <option value="">Separador: Não atribuído</option>
                      {repositores.map(u => (<option key={u.firebaseId || u.usuario} value={u.nome || u.usuario}>{u.nome || u.usuario}</option>))}
                    </select>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary py-2 rounded-lg text-xs font-bold active:bg-primary/20" onClick={() => generatePreVendaPDF(h)}>
                      <FileText size={16} /> PDF
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 bg-[#25D366]/10 text-[#25D366] py-2 rounded-lg text-xs font-bold active:bg-[#25D366]/20" onClick={() => handleEnviarWhatsApp(h)}>
                      <MessageSquare size={16} /> WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL: Nova Pré-Venda — fullscreen no mobile */}
      {isNova && (
        <div className="fixed inset-0 z-[100] flex flex-col md:items-center md:justify-center bg-background/95 backdrop-blur-sm">
          <div className="bg-card w-full md:max-w-5xl h-full md:h-auto md:max-h-[90vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-primary/5 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black flex items-center gap-2"><ShoppingCart size={22} /> Nova Pré-Venda</h2>
              <button onClick={() => setIsNova(false)} className="p-2 hover:bg-destructive rounded-full hover:text-destructive-foreground"><X size={20} /></button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Busca — max-h no mobile com scroll na lista de resultados */}
              <div className="w-full md:w-5/12 p-4 md:border-r border-b md:border-b-0 border-border flex flex-col gap-3 shrink-0 md:shrink md:min-h-0 max-h-[40vh] md:max-h-none">
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input type="text" className="w-full pl-9 pr-4 py-3 rounded-lg border border-border bg-background text-base" placeholder="Buscar Código ou Descrição..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar min-h-0">
                  {query && searchResults.map(p => (
                    <div key={p.CODIGO || p.codigo} className="p-3 border rounded-lg hover:border-primary flex justify-between items-center bg-muted/10 active:bg-primary/10">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-sm text-primary">{p.CODIGO || p.codigo}</p>
                        <p className="text-xs font-semibold truncate">{p.DESCRICAO || p.descricao}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{p.EMBALAGEM || p.embalagem || p.emb || 'UN'} | At: {formatCurrency(p.PRECO_ATACADO || p.preco_atacado)}</p>
                      </div>
                      <button onClick={() => handleAddItem(p)} className="p-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <Plus size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carrinho */}
              <div className="w-full md:w-7/12 p-4 flex flex-col bg-muted/5 min-h-0 flex-1">
                <h3 className="font-bold text-sm uppercase mb-3 text-muted-foreground border-b pb-2 shrink-0">Itens ({cart.length})</h3>
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-0">
                  {cart.map(item => (
                    <div key={item.id} className="p-3 border bg-card rounded-lg shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-bold text-sm text-primary">{item.codigo}</p>
                          <p className="text-xs truncate">{item.descricao}</p>
                        </div>
                        <button onClick={() => removeCartItem(item.id)} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 size={16} /></button>
                      </div>
                      {/* Mobile: empilha os inputs verticalmente */}
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Qtd:</span>
                          <input type="number" inputMode="numeric" min="0" value={item.qtd} onChange={(e) => updateCartQtd(item.id, e.target.value)} className="w-16 text-center border rounded p-1.5 font-bold text-base bg-background min-h-[44px]" placeholder="0" />
                          <span className="text-[10px] font-bold">{item.emb}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">R$:</span>
                          <input type="number" inputMode="decimal" min="0" step="0.01" value={item.preco} onChange={(e) => updateCartPreco(item.id, e.target.value)} className="w-20 text-center border rounded p-1.5 font-bold text-base bg-background min-h-[44px]" placeholder="0.00" />
                        </div>
                        <span className="font-black text-sm ml-auto">{formatCurrency((Number(item.qtd) || 0) * (Number(item.preco) || 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t-2 border-primary bg-card p-3 rounded-xl shadow-lg shrink-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Total</span>
                    <span className="text-2xl font-black text-primary">{formatCurrency(totalCart)}</span>
                  </div>
                  <button onClick={handleSalvarPreVenda} disabled={saving || cart.length === 0} className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 text-base shadow-xl min-h-[48px]">
                    {saving ? <Loader2 className="animate-spin" /> : <Save />} Finalizar Pré-Venda
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}