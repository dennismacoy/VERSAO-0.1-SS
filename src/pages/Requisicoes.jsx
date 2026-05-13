import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Inbox, CheckCircle2, AlertCircle, X, Search, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { listenToNode } from '../lib/firebase';
import { generatePreVendaPDF } from '../lib/pdfGenerator';
import { formatCurrency, cn } from '../lib/utils';

export default function Requisicoes() {
  const { user } = useAuth();
  const [requisicoes, setRequisicoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  const [reqToConvert, setReqToConvert] = useState(null);
  const [precosManuais, setPrecosManuais] = useState({});

  useEffect(() => {
    if (reqToConvert) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [reqToConvert]);

  useEffect(() => {
    unsubRef.current = listenToNode('pedidos', (items) => {
      setRequisicoes(items);
      setLoading(false);
    });
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const handleAbrirConversao = (req) => {
    setReqToConvert(req);
    const initialPrices = {};
    req.itens.forEach(i => {
      initialPrices[i.codigo] = 0;
    });
    setPrecosManuais(initialPrices);
  };

  const confirmarConversao = async () => {
    const itensComPreco = reqToConvert.itens.map(it => ({
      ...it,
      preco: precosManuais[it.codigo] || 0,
      subtotal: (precosManuais[it.codigo] || 0) * (Number(it.qtd) || 0)
    }));

    const total = itensComPreco.reduce((acc, curr) => acc + curr.subtotal, 0);

    const payload = {
      usuario: user.usuario || user.name,
      cliente: reqToConvert.cliente,
      itens: itensComPreco,
      total: total,
      status: 'Aberta',
      atribuido: ""
    };

    try {
      await api.createPreVenda(payload);
      await api.updatePedidoStatus(reqToConvert.firebaseId, 'Convertido');
      alert("Pré-venda gerada com sucesso!");
      setReqToConvert(null);
    } catch (e) {
      alert("Erro ao converter: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-primary">Requisições</h1>
        <p className="text-muted-foreground font-medium text-sm">Aprovação e conversão de pedidos em pré-vendas</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-12 text-center text-primary">Carregando requisições...</div>
        ) : requisicoes.length === 0 ? (
          <div className="erp-card p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <Inbox size={48} className="opacity-20 mb-4" />
            <p>Não há requisições no momento.</p>
          </div>
        ) : (
          requisicoes.map((req) => (
            <div key={req.firebaseId} className="erp-card p-5 border-l-4 flex flex-col md:flex-row gap-4 md:items-center justify-between hover:-translate-y-1 transition-all"
              style={{ borderLeftColor: req.status === 'Pendente' ? '#f97316' : '#22c55e' }}>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-muted rounded text-xs font-bold text-muted-foreground uppercase">
                    #{req.firebaseId?.slice(-6) || req.id}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1",
                    req.status === 'Pendente' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  )}>
                    {req.status === 'Pendente' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                    {req.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-lg leading-tight">{req.cliente}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviado por: <span className="font-bold">{req.usuario}</span> em {new Date(req.data || req.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-3 mt-2">
                  <p className="text-xs font-bold text-muted-foreground mb-2 uppercase">Itens Solicitados ({req.itens?.length || 0})</p>
                  <ul className="space-y-1 text-sm">
                    {req.itens?.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-start border-b border-border/50 pb-1 last:border-0 last:pb-0">
                        <span className="truncate pr-2 flex-1"><span className="text-muted-foreground text-xs">{item.codigo}</span> - {item.descricao}</span>
                        <span className="font-black bg-background px-2 rounded text-xs">{item.qtd} {item.embalagem}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-row md:flex-col gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
                <button
                  onClick={() => generatePreVendaPDF(req)}
                  className="flex-1 md:w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent hover:text-accent-foreground text-accent font-bold py-2 px-4 rounded-xl transition-colors text-sm"
                >
                  <FileText size={16} /> Ver PDF
                </button>
                {req.status === 'Pendente' && (
                  <button
                    onClick={() => handleAbrirConversao(req)}
                    className="flex-1 md:w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl transition-colors text-sm shadow-md"
                  >
                    Converter em PV
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE CONVERSÃO */}
      {reqToConvert && createPortal(
        <div className="fixed inset-0 z-[100] bg-background md:bg-black/80 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center animate-in fade-in duration-200">
          <div className="bg-surface w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="pt-8 md:pt-4 p-4 border-b bg-primary/5 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black text-primary">Definir Preços</h2>
                <p className="text-xs text-muted-foreground">Pedido de: {reqToConvert.cliente}</p>
              </div>
              <button onClick={() => setReqToConvert(null)} className="p-3 bg-muted hover:bg-destructive rounded-full hover:text-destructive-foreground">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
              {reqToConvert.itens.map((item, index) => (
                <div key={index} className="flex flex-col gap-1 border-b pb-4">
                  <span className="font-bold text-sm leading-tight">{item.codigo} - {item.descricao}</span>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">Qtd: {item.qtd} {item.embalagem}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={precosManuais[item.codigo] || ''}
                        onChange={(e) => setPrecosManuais({
                          ...precosManuais,
                          [item.codigo]: parseFloat(e.target.value) || 0
                        })}
                        className="border-2 border-muted focus:border-primary p-2 rounded-lg w-28 text-right font-black text-base bg-background"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t shrink-0 bg-muted/10">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-muted-foreground">Total Calculado:</span>
                <span className="text-2xl font-black text-primary">
                  {formatCurrency(reqToConvert.itens.reduce((acc, it) => acc + ((precosManuais[it.codigo] || 0) * (Number(it.qtd) || 0)), 0))}
                </span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const itensComPreco = reqToConvert.itens.map(it => ({
                      ...it,
                      preco: precosManuais[it.codigo] || 0,
                      subtotal: (precosManuais[it.codigo] || 0) * (Number(it.qtd) || 0)
                    }));
                    const total = itensComPreco.reduce((acc, curr) => acc + curr.subtotal, 0);
                    const payload = {
                      usuario: user.usuario || user.name,
                      cliente: reqToConvert.cliente,
                      itens: itensComPreco,
                      total: total,
                      status: 'Aberta',
                      atribuido: ""
                    };
                    await api.createPreVenda(payload);
                    await api.updatePedidoStatus(reqToConvert.firebaseId, 'Convertido');
                    alert("Pré-venda gerada com sucesso!");
                    setReqToConvert(null);
                  } catch (e) {
                    alert("Erro ao converter: " + e.message);
                  }
                }}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-lg"
              >
                Confirmar Conversão
              </button>
            </div>

          </div>
        </div>,
        document.getElementById('root') || document.body
      )}
    </div>
  );
}