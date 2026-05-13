import React, { useState, useEffect, useRef } from 'react';
import { Inbox, Trash2, ArrowRightCircle, FileText, DollarSign, X, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { api } from '../lib/api';
import { listenToNode } from '../lib/firebase';
import { generatePreVendaPDF } from '../lib/pdfGenerator';
import { cn, formatCurrency } from '../lib/utils';

export default function Requisicoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { searchLocal } = useProducts();
  const [requisicoes, setRequisicoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [convertingReq, setConvertingReq] = useState(null);
  const [precoMap, setPrecoMap] = useState({});
  const [saving, setSaving] = useState(false);
  const unsubRef = useRef(null);

  // Listener em tempo real: lê todos os pedidos com status "Pendente"
  useEffect(() => {
    unsubRef.current = listenToNode('pedidos', (items) => {
      const pendentes = items.filter(p => p.status === 'Pendente');
      setRequisicoes(pendentes);
      setLoading(false);
    });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const handleExcluir = async (firebaseId) => {
    if (window.confirm('Tem certeza que deseja excluir esta requisição?')) {
      try {
        await api.deleteRecord('pedidos', firebaseId);
      } catch (e) {
        alert('Erro ao excluir requisição.');
      }
    }
  };

  // Abre o painel de conversão com preços pré-preenchidos do cache
  const handleAbrirConversao = (req) => {
    const initialPrecos = {};
    (req.itens || []).forEach(item => {
      const cached = searchLocal(item.codigo)[0];
      const preco = cached
        ? Number(cached.PRECO_ATACADO || cached.preco_atacado || 0)
        : 0;
      initialPrecos[item.codigo] = preco;
    });
    setPrecoMap(initialPrecos);
    setConvertingReq(req);
  };

  // Finaliza a conversão: salva como pré-venda no Firebase
  const handleFinalizarConversao = async () => {
    if (!convertingReq) return;
    setSaving(true);

    try {
      const itensComPreco = (convertingReq.itens || []).map(item => ({
        ...item,
        preco: Number(precoMap[item.codigo] || 0),
        subtotal: Number(precoMap[item.codigo] || 0) * (Number(item.qtd) || 0),
      }));

      const total = itensComPreco.reduce((acc, i) => acc + (i.subtotal || 0), 0);

      const preVendaData = {
        cliente: convertingReq.cliente || 'Cliente',
        data: new Date().toISOString(),
        itens: itensComPreco,
        total,
        status: 'Aberta',
        separador: '',
        criadoPor: user?.name || user?.usuario || 'Gerente',
        origemPedido: convertingReq.firebaseId,
      };

      // 1. Salva a pré-venda no Firebase
      await api.createPreVenda(preVendaData);

      // 2. Atualiza o status do pedido original para "Convertido"
      await api.updateStatus(convertingReq.firebaseId, 'Convertido', 'pedidos');

      setConvertingReq(null);
      setPrecoMap({});
      alert('Pré-Venda criada com sucesso!');
    } catch (e) {
      console.error('Erro na conversão:', e);
      alert('Erro ao converter requisição. Verifique o console.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-accent flex items-center gap-2">
            <Inbox size={32} /> Requisições
          </h1>
          <p className="text-muted-foreground font-medium text-sm">Caixa de entrada de pedidos de clientes B2B</p>
        </div>
      </div>

      {loading ? (
        <div className="erp-card p-12 text-center text-primary"><Loader2 className="animate-spin mx-auto w-8 h-8" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requisicoes.length === 0 ? (
            <div className="lg:col-span-2 erp-card p-12 text-center text-muted-foreground flex flex-col items-center">
              <Inbox size={48} className="mb-4 opacity-30" />
              <p className="text-xl font-bold">Nenhuma requisição pendente.</p>
            </div>
          ) : (
            requisicoes.map(req => (
              <div key={req.firebaseId} className="erp-card p-6 flex flex-col border-l-4 border-l-accent hover:shadow-lg transition-all">
                <div className="flex justify-between items-start border-b border-border pb-4 mb-4">
                  <div>
                    <span className="text-xs font-bold bg-accent/10 text-accent px-2 py-1 rounded uppercase">{req.firebaseId?.slice(-8)}</span>
                    <h3 className="font-black text-lg mt-2">{req.cliente || 'Cliente'}</h3>
                    <p className="text-xs text-muted-foreground">{new Date(req.data || req.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => generatePreVendaPDF(req)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
                      title="Gerar PDF"
                    >
                      <FileText size={20} />
                    </button>
                    <button
                      onClick={() => handleExcluir(req.firebaseId)}
                      className="p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-2 mb-6">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">Itens Solicitados ({(req.itens || []).length})</h4>
                  <div className="bg-muted/30 rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar text-sm">
                    {(req.itens || []).map(item => (
                      <div key={item.codigo} className="flex justify-between border-b border-border/50 last:border-0 py-1">
                        <span className="truncate pr-4"><span className="font-bold text-primary">{item.codigo}</span> - {item.descricao}</span>
                        <span className="font-black whitespace-nowrap">{item.qtd} {item.embalagem || 'un'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleAbrirConversao(req)}
                  className="w-full btn-primary bg-accent hover:bg-accent/90 text-accent-foreground py-3 flex items-center justify-center gap-2"
                >
                  <ArrowRightCircle size={20} />
                  Converter em Pré-Venda
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de Conversão com Preços */}
      {convertingReq && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="bg-card w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-accent/5 flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2">
                <DollarSign size={24} className="text-accent" /> Definir Preços para Pré-Venda
              </h2>
              <button onClick={() => setConvertingReq(null)} className="p-2 hover:bg-destructive rounded-full hover:text-destructive-foreground"><X size={20} /></button>
            </div>

            <div className="p-4 border-b border-border bg-muted/20">
              <p className="text-sm"><span className="font-bold">Cliente:</span> {convertingReq.cliente}</p>
              <p className="text-xs text-muted-foreground">Pedido: {convertingReq.firebaseId?.slice(-8)} | {new Date(convertingReq.data || convertingReq.createdAt).toLocaleString()}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {(convertingReq.itens || []).map(item => {
                const subtotal = (Number(precoMap[item.codigo]) || 0) * (Number(item.qtd) || 0);
                return (
                  <div key={item.codigo} className="p-4 border bg-card rounded-xl flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-primary">{item.codigo}</p>
                      <p className="text-xs">{item.descricao}</p>
                      <p className="text-[10px] text-muted-foreground">Emb: {item.embalagem || 'UN'} | Qtd: <span className="font-black">{item.qtd}</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Preço Unit.</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={precoMap[item.codigo] ?? ''}
                          onChange={(e) => setPrecoMap({ ...precoMap, [item.codigo]: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-28 text-center border-2 border-accent/30 rounded-lg p-2 font-bold text-base bg-background focus:border-accent"
                          placeholder="R$ 0,00"
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Subtotal</span>
                        <span className="font-black text-sm">{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t-2 border-accent bg-card">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Total da Pré-Venda</span>
                <span className="text-2xl font-black text-accent">
                  {formatCurrency((convertingReq.itens || []).reduce((acc, i) => acc + (Number(precoMap[i.codigo]) || 0) * (Number(i.qtd) || 0), 0))}
                </span>
              </div>
              <button
                onClick={handleFinalizarConversao}
                disabled={saving}
                className="w-full btn-primary bg-accent hover:bg-accent/90 text-accent-foreground py-4 flex items-center justify-center gap-2 text-lg shadow-xl"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Finalizar Conversão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
