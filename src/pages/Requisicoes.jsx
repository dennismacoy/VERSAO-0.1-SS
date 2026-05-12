import React, { useState } from 'react';
import { Inbox, Trash2, ArrowRightCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Requisicoes() {
  const navigate = useNavigate();
  const [requisicoes, setRequisicoes] = useState([
    {
      id: 'REQ-123456789',
      cliente: 'João da Silva (Cliente)',
      data: new Date().toISOString(),
      itens: [
        { codigo: '1001', descricao: 'Produto Exemplo A', qtd: 5 },
        { codigo: '1002', descricao: 'Produto Exemplo B', qtd: 2 }
      ],
      status: 'Pendente'
    }
  ]);

  const handleExcluir = (id) => {
    if(window.confirm('Tem certeza que deseja excluir esta requisição?')) {
      setRequisicoes(requisicoes.filter(r => r.id !== id));
    }
  };

  const handleConverter = (req) => {
    // In a real application, you would pass this state via context or router state
    // For now we'll just navigate to Pre-Venda and log it
    // In Pre-Venda we would read location.state.requisicao to pre-fill
    navigate('/pre-venda', { state: { requisicao: req } });
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {requisicoes.length === 0 ? (
          <div className="lg:col-span-2 erp-card p-12 text-center text-muted-foreground flex flex-col items-center">
            <Inbox size={48} className="mb-4 opacity-30" />
            <p className="text-xl font-bold">Nenhuma requisição pendente.</p>
          </div>
        ) : (
          requisicoes.map(req => (
            <div key={req.id} className="erp-card p-6 flex flex-col border-l-4 border-l-accent hover:shadow-lg transition-all">
              <div className="flex justify-between items-start border-b border-border pb-4 mb-4">
                <div>
                  <span className="text-xs font-bold bg-accent/10 text-accent px-2 py-1 rounded uppercase">{req.id}</span>
                  <h3 className="font-black text-lg mt-2">{req.cliente}</h3>
                  <p className="text-xs text-muted-foreground">{new Date(req.data).toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => handleExcluir(req.id)}
                  className="p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground rounded-xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
              
              <div className="flex-1 space-y-2 mb-6">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">Itens Solicitados ({req.itens.length})</h4>
                <div className="bg-muted/30 rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar text-sm">
                  {req.itens.map(item => (
                    <div key={item.codigo} className="flex justify-between border-b border-border/50 last:border-0 py-1">
                      <span className="truncate pr-4"><span className="font-bold text-primary">{item.codigo}</span> - {item.descricao}</span>
                      <span className="font-black">{item.qtd} un</span>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => handleConverter(req)}
                className="w-full btn-primary bg-accent hover:bg-accent/90 text-accent-foreground py-3 flex items-center justify-center gap-2"
              >
                <ArrowRightCircle size={20} />
                Converter em Pré-Venda
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
