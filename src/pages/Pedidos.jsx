import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, FileText, X, Package, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { api } from '../lib/api';
import { generatePreVendaPDF } from '../lib/pdfGenerator';
import { listenToNode } from '../lib/firebase';
import { cn, parseEstoque, getEstoqueNumerico, formatCurrency } from '../lib/utils';

export default function Pedidos() {
  const { user } = useAuth();
  const { searchLocal } = useProducts();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNovoPedido, setIsNovoPedido] = useState(false);
  const [query, setQuery] = useState('');
  const [itensPedido, setItensPedido] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const unsubRef = useRef(null);

  // Listener em tempo real do Firebase, filtrado pelo usuário logado
  useEffect(() => {
    unsubRef.current = listenToNode('pedidos', (items) => {
      const userName = user?.name || user?.usuario || '';
      const filtered = items.filter(p =>
        (p.cliente || '').toLowerCase() === userName.toLowerCase() ||
        (p.usuario || '').toLowerCase() === userName.toLowerCase()
      );
      setPedidos(filtered);
      setLoading(false);
    });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [user]);

  // Pesquisa: filtrar SOMENTE itens com estoque > 10
  const searchResults = searchLocal(query)
    .filter(p => {
      const estoqueStr = p.ESTOQUE || p.QTE || p.estoque || 0;
      return getEstoqueNumerico(estoqueStr) > 10;
    })
    .slice(0, 10);

  const handleAddItem = (p) => {
    const codigo = p.CODIGO || p.codigo;
    const exists = itensPedido.find(i => i.codigo === codigo);
    if (exists) {
      setItensPedido(itensPedido.map(i => i.codigo === exists.codigo ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setItensPedido([...itensPedido, {
        codigo,
        descricao: p.DESCRICAO || p.descricao,
        embalagem: p.EMBALAGEM || p.embalagem || p.emb || 'UN',
        qtd: 1
      }]);
    }
  };

  // Permite apagar o valor sem deletar o item
  const updateQtd = (codigo, value) => {
    // Se o valor for vazio ou inválido, permite ficar sem número (não deleta)
    if (value === '' || value === null || value === undefined) {
      setItensPedido(itensPedido.map(i => i.codigo === codigo ? { ...i, qtd: '' } : i));
      return;
    }
    const qtd = Number(value);
    if (isNaN(qtd) || qtd < 0) return;
    setItensPedido(itensPedido.map(i => i.codigo === codigo ? { ...i, qtd } : i));
  };

  const removeItem = (codigo) => {
    setItensPedido(itensPedido.filter(i => i.codigo !== codigo));
  };

  const handleSalvarPedido = async () => {
    const validItems = itensPedido.filter(i => i.qtd > 0);
    if (validItems.length === 0) return alert('Adicione itens com quantidade válida ao pedido.');
    setSaving(true);

    const novoPedido = {
      cliente: user?.name || user?.usuario || 'Cliente',
      usuario: user?.usuario || user?.name || '',
      data: new Date().toISOString(),
      itens: validItems,
      status: 'Pendente',
    };

    try {
      await api.createPedido(novoPedido);
      setItensPedido([]);
      setIsNovoPedido(false);
      setQuery('');
      alert('Pedido enviado com sucesso para a loja!');
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar pedido.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExcluirMassa = async () => {
    if (window.confirm('Excluir pedidos selecionados?')) {
      try {
        await api.deleteMultiple('pedidos', selectedIds);
        setSelectedIds([]);
      } catch (e) {
        alert('Erro ao excluir.');
      }
    }
  };

  // PDF de Pedido Convertido usa o mesmo layout de Pré-Venda
  const handleGerarPDF = () => {
    const selectedPedidos = pedidos.filter(p => selectedIds.includes(p.firebaseId));
    if (selectedPedidos.length === 0) return alert('Selecione pelo menos um pedido.');
    selectedPedidos.forEach(pedido => generatePreVendaPDF(pedido));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">Meus Pedidos</h1>
          <p className="text-muted-foreground font-medium text-sm">Histórico e novos pedidos B2B</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <button onClick={handleExcluirMassa} className="btn-primary bg-destructive text-destructive-foreground flex items-center gap-2">
                <Trash2 size={18} /> Excluir ({selectedIds.length})
              </button>
              <button onClick={handleGerarPDF} className="btn-primary bg-accent text-accent-foreground flex items-center gap-2">
                <FileText size={18} /> Gerar PDF
              </button>
            </>
          )}
          <button onClick={() => setIsNovoPedido(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo Pedido
          </button>
        </div>
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-primary"><Loader2 className="animate-spin mx-auto w-8 h-8" /></div>
        ) : pedidos.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Package size={48} className="mx-auto mb-4 opacity-30" />
            <p>Você ainda não fez nenhum pedido.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? pedidos.map(p => p.firebaseId) : [])} checked={selectedIds.length === pedidos.length && pedidos.length > 0} /></th>
                <th className="px-4 py-3 font-bold">ID</th>
                <th className="px-4 py-3 font-bold">Data</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-center">Itens</th>
                <th className="px-4 py-3 text-center">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pedidos.map(p => (
                <tr key={p.firebaseId} className="hover:bg-muted/50">
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(p.firebaseId)} onChange={() => handleToggleSelect(p.firebaseId)} /></td>
                  <td className="px-4 py-3 font-bold text-primary">{p.firebaseId?.slice(-6) || p.id}</td>
                  <td className="px-4 py-3">{new Date(p.data || p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold uppercase",
                      p.status === 'Pendente' ? 'bg-orange-100 text-orange-700' :
                      p.status === 'Convertido' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    )}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold">{(p.itens || []).length}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => generatePreVendaPDF(p)} className="text-primary hover:bg-primary/10 p-2 rounded" title="Gerar PDF">
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isNovoPedido && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-primary/5 flex justify-between items-center">
              <h2 className="text-xl font-black">Criar Novo Pedido (Visão B2B)</h2>
              <button onClick={() => setIsNovoPedido(false)} className="p-2 hover:bg-destructive rounded-full hover:text-destructive-foreground"><X size={20} /></button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Lado Esquerdo: Pesquisa — mostra SOMENTE itens com estoque > 10 */}
              <div className="w-full md:w-1/2 p-4 border-r border-border flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-4 py-2 border rounded-lg bg-background text-base"
                    placeholder="Pesquisar Produto..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Exibindo apenas itens com estoque &gt; 10
                </p>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {query && searchResults.map(p => (
                    <div key={p.CODIGO || p.codigo} className="p-3 border rounded-lg hover:border-primary flex justify-between items-center bg-muted/20">
                      <div>
                        <p className="font-bold text-sm text-primary">{p.CODIGO || p.codigo}</p>
                        <p className="text-xs font-semibold">{p.DESCRICAO || p.descricao}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Emb: {p.EMBALAGEM || p.embalagem || p.emb || 'UN'} | <span className="font-black text-primary">Atacado: {formatCurrency(p.PRECO_ATACADO || p.preco_atacado)}</span>
                        </p>
                      </div>
                      <button onClick={() => handleAddItem(p)} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground">
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lado Direito: Itens do Pedido */}
              <div className="w-full md:w-1/2 p-4 flex flex-col bg-muted/10">
                <h3 className="font-bold text-sm uppercase mb-4 text-muted-foreground">Itens no Pedido ({itensPedido.length})</h3>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {itensPedido.map(item => (
                    <div key={item.codigo} className="p-3 border bg-card rounded-lg flex items-center justify-between shadow-sm">
                      <div className="flex-1">
                        <p className="font-bold text-xs">{item.codigo} - {item.descricao}</p>
                        <p className="text-[10px] text-muted-foreground">Emb: {item.embalagem}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={item.qtd}
                          onChange={(e) => updateQtd(item.codigo, e.target.value)}
                          className="w-16 text-center border rounded p-1 font-bold text-base bg-background"
                          placeholder="0"
                        />
                        <button
                          onClick={() => removeItem(item.codigo)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <button
                    onClick={handleSalvarPedido}
                    disabled={saving}
                    className="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Check size={20} />} Enviar Pedido
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
