import React, { useState } from 'react';
import { Plus, Search, Trash2, FileText, X, Package, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { api } from '../lib/api';
import { generateB2BPDF } from '../lib/pdfGenerator';

export default function Pedidos() {
  const { user } = useAuth();
  const { searchLocal } = useProducts();
  const [pedidos, setPedidos] = useState([]);
  const [isNovoPedido, setIsNovoPedido] = useState(false);
  const [query, setQuery] = useState('');
  const [itensPedido, setItensPedido] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // Visão Cega: Apenas pesquisa Codigo e Descricao
  const searchResults = searchLocal(query).slice(0, 10);

  const handleAddItem = (p) => {
    const exists = itensPedido.find(i => i.codigo === (p.CODIGO || p.codigo));
    if (exists) {
      setItensPedido(itensPedido.map(i => i.codigo === exists.codigo ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setItensPedido([...itensPedido, { 
        codigo: p.CODIGO || p.codigo, 
        descricao: p.DESCRICAO || p.descricao, 
        embalagem: p.EMBALAGEM || p.emb || 'UN',
        qtd: 1 
      }]);
    }
  };

  const updateQtd = (codigo, qtd) => {
    if (qtd <= 0) {
      setItensPedido(itensPedido.filter(i => i.codigo !== codigo));
      return;
    }
    setItensPedido(itensPedido.map(i => i.codigo === codigo ? { ...i, qtd } : i));
  };

  const handleSalvarPedido = async () => {
    if (itensPedido.length === 0) return alert('Adicione itens ao pedido.');
    
    const novoPedido = {
      id: `REQ-${Date.now()}`,
      cliente: user?.name || 'Cliente',
      data: new Date().toISOString(),
      itens: itensPedido,
      status: 'Pendente', // Vai para a aba Requisições
    };

    try {
      // In a real app, this goes to a specific API endpoint for Requisicoes
      // await api.createRequisicao(novoPedido);
      setPedidos([novoPedido, ...pedidos]);
      setItensPedido([]);
      setIsNovoPedido(false);
      alert('Pedido enviado com sucesso para a loja!');
    } catch (e) {
      alert('Erro ao enviar pedido.');
    }
  };

  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExcluirMassa = () => {
    if(window.confirm('Excluir pedidos selecionados?')) {
      setPedidos(pedidos.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    }
  };

  const handleGerarPDF = () => {
    const selectedPedidos = pedidos.filter(p => selectedIds.includes(p.id));
    if (selectedPedidos.length === 0) return alert('Selecione pelo menos um pedido.');
    selectedPedidos.forEach(pedido => generateB2BPDF(pedido));
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
        {pedidos.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Package size={48} className="mx-auto mb-4 opacity-30" />
            <p>Você ainda não fez nenhum pedido.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? pedidos.map(p=>p.id) : [])} checked={selectedIds.length === pedidos.length && pedidos.length > 0} /></th>
                <th className="px-4 py-3 font-bold">ID</th>
                <th className="px-4 py-3 font-bold">Data</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-center">Itens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pedidos.map(p => (
                <tr key={p.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => handleToggleSelect(p.id)} /></td>
                  <td className="px-4 py-3 font-bold">{p.id}</td>
                  <td className="px-4 py-3">{new Date(p.data).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className="bg-accent/20 text-accent px-2 py-1 rounded text-xs font-bold uppercase">{p.status}</span></td>
                  <td className="px-4 py-3 text-center font-bold">{p.itens.length}</td>
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
              <button onClick={() => setIsNovoPedido(false)} className="p-2 hover:bg-destructive rounded-full hover:text-destructive-foreground"><X size={20}/></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Lado Esquerdo: Pesquisa (Visao Cega) */}
              <div className="w-full md:w-1/2 p-4 border-r border-border flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input 
                    type="text" 
                    className="w-full pl-9 pr-4 py-2 border rounded-lg bg-background text-sm" 
                    placeholder="Pesquisar Produto..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {query && searchResults.map(p => (
                    <div key={p.CODIGO || p.codigo} className="p-3 border rounded-lg hover:border-primary flex justify-between items-center bg-muted/20">
                      <div>
                        <p className="font-bold text-sm text-primary">{p.CODIGO || p.codigo}</p>
                        <p className="text-xs font-semibold">{p.DESCRICAO || p.descricao}</p>
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
                          min="0"
                          value={item.qtd}
                          onChange={(e) => updateQtd(item.codigo, Number(e.target.value))}
                          className="w-16 text-center border rounded p-1 font-bold text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <button 
                    onClick={handleSalvarPedido}
                    className="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
                  >
                    <Check size={20} /> Enviar Pedido
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
