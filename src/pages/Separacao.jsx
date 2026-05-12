import React, { useState, useEffect } from 'react';
import {
  ListChecks,
  Play,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  AlertCircle,
  Package,
  MapPin,
  User,
  ArrowRight
} from 'lucide-react';
import { api } from '../lib/api';
import { generatePickingPDF } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function Separacao() {
  const { user, role, hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await api.getHistory('Prevendas');
      setItems(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleUpdateStatus = async (id, currentStatus) => {
    // Treat 'Iniciada' as 'Aberta' just in case old data has it
    if (currentStatus === 'Iniciada') currentStatus = 'Aberta';

    const statusSequence = ['Aberta', 'Em Andamento', 'Finalizada'];
    const currentIndex = statusSequence.indexOf(currentStatus);

    if (currentIndex === -1 || currentIndex === statusSequence.length - 1) return;

    const nextStatus = statusSequence[currentIndex + 1];

    setUpdatingId(id);
    try {
      await api.updateStatus(id, nextStatus);
      setItems(items.map(item => item.id === id ? { ...item, status: nextStatus } : item));
    } catch (e) {
      alert("Erro ao atualizar status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReatribuir = (id, newSeparador) => {
    // Simulando reatribuição via API
    setItems(items.map(item => item.id === id ? { ...item, separador: newSeparador, atribuicao: newSeparador } : item));
    alert('Reatribuído com sucesso para ' + newSeparador);
  };

  if (!hasPermission('Ver Aba Separação')) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle size={64} className="mx-auto text-destructive" />
          <h2 className="text-2xl font-black uppercase">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar o módulo de logística.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase italic">
            Fluxo de <span className="text-primary">Separação</span>
          </h1>
          <p className="text-muted-foreground font-bold text-xs md:text-sm tracking-widest uppercase">
            Controle de Picking e Expedição em Tempo Real
          </p>
        </div>
        <button
          onClick={loadItems}
          className="flex items-center gap-2 bg-card border-2 border-border px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-muted transition-all active:scale-95 shadow-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
          Sincronizar Filas
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="animate-spin text-primary w-16 h-16" />
          <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Mapeando pedidos pendentes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {items
            .filter(item => item.status !== 'Finalizada') // Quando for finalizada, some
            .filter(item => {
              if (role === 'admin' || role === 'gerente') return true;
              return item.separador === user?.name || item.atribuicao === user?.name;
            })
            .map((item) => (
            <div
              key={item.id}
              className={cn(
                "erp-card p-4 md:p-6 flex flex-col border-t-8 transition-all relative overflow-hidden",
                item.status === 'Aberta' ? "border-t-muted" :
                  item.status === 'Finalizada' ? "border-t-success" : "border-t-primary"
              )}
            >
              <div className={cn(
                "absolute -right-8 -top-8 w-24 h-24 rotate-45 flex items-end justify-center pb-2 opacity-10",
                item.status === 'Aberta' ? "bg-muted-foreground" :
                  item.status === 'Finalizada' ? "bg-success" : "bg-primary"
              )}>
                <Package size={32} />
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">Pedido ID</span>
                  <h3 className="text-2xl font-black tracking-tighter text-foreground">{item.id || item.data?.slice(-6)}</h3>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                  item.status === 'Aberta' ? "bg-muted text-muted-foreground border-border" :
                    item.status === 'Finalizada' ? "bg-success/10 text-success border-success/20" :
                      "bg-primary/10 text-primary border-primary/20"
                )}>
                  {item.status}
                </span>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <User size={18} className="text-primary" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Responsável</p>
                    <p className="font-bold truncate mt-1">{item.responsavel || item.atribuicao || item.separador || 'Não Atribuído'}</p>
                    {(role === 'admin' || role === 'gerente') && (
                      <select 
                        className="mt-2 text-xs border rounded p-1"
                        value={item.separador || item.atribuicao || ''}
                        onChange={(e) => handleReatribuir(item.id, e.target.value)}
                      >
                        <option value="">Reatribuir</option>
                        <option value="João">João (Repositor)</option>
                        <option value="Marcos">Marcos (Repositor)</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <ListChecks size={18} className="text-primary" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Itens no Pedido</p>
                    <p className="font-bold truncate mt-1">{(item.itens || []).length} Produtos cadastrados</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-dashed border-border flex gap-3">
                <button
                  onClick={() => generatePickingPDF(item)}
                  className="min-h-[44px] p-4 bg-card border-2 border-border text-foreground hover:bg-muted rounded-2xl transition-all shadow-sm active:scale-90"
                  title="Imprimir Guia de Picking"
                >
                  <FileText size={20} />
                </button>

                <button
                  disabled={item.status === 'Finalizada' || updatingId === item.id}
                  onClick={() => handleUpdateStatus(item.id, item.status)}
                  className={cn(
                    "min-h-[44px] flex-1 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50",
                    item.status === 'Finalizada' ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground hover:shadow-primary/20"
                  )}
                >
                  {updatingId === item.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : item.status === 'Finalizada' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Play size={18} />
                  )}
                  {item.status === 'Aberta' && 'Iniciar Separação'}
                  {item.status === 'Em Andamento' && 'Finalizar'}
                  {item.status === 'Finalizada' && 'Concluído'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}