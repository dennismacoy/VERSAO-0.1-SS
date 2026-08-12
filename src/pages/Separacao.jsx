import React, { useState, useEffect, useRef } from 'react';
import {
  ListChecks,
  Play,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  AlertCircle,
  Package,
  User,
  MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import { generateSeparacaoPDF } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { listenToNode, listenToUsers } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function Separacao() {
  const { user, role, hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const unsubRef = useRef(null);

  // Debug de permissões para resolver o erro de "Acesso Negado"
  useEffect(() => {
    console.log('[DEBUG SEPARAÇÃO]', {
      user: user?.usuario || user?.name,
      role: role,
      hasPermission: hasPermission('Acesso Separacao')
    });
  }, [user, role, hasPermission]);

  // Listener em tempo real para pré-vendas
  useEffect(() => {
    unsubRef.current = listenToNode('prevendas', (items) => {
      setItems(items);
      setLoading(false);
    });
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const handleUpdateStatus = async (firebaseId, currentStatus) => {
    const statusSequence = ['Aberta', 'Em Separação', 'Em Andamento', 'Finalizada'];
    const currentIndex = statusSequence.indexOf(currentStatus);

    if (currentIndex === -1 || currentIndex === statusSequence.length - 1) return;

    const nextStatus = statusSequence[currentIndex + 1];

    setUpdatingId(firebaseId);
    try {
      await api.updateStatus(firebaseId, nextStatus, 'prevendas');
    } catch (e) {
      console.error('Erro ao atualizar status:', e);
      alert('Erro ao atualizar status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleShareWhatsApp = (item) => {
    const id = item.firebaseId?.slice(-6) || item.id || 'N/A';
    const dataStr = item.data || item.createdAt ? new Date(item.data || item.createdAt).toLocaleDateString('pt-BR') : '';
    const cliente = item.cliente || 'Não Informado';
    const separador = item.atribuido || item.separador || 'Não Atribuído';
    const total = item.total ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total) : 'R$ 0,00';
    
    const itensList = (item.itens || []).map(i => {
      const cod = i.codigo || i.CODIGO || '';
      const desc = i.descricao || i.DESCRICAO || '';
      const qtd = i.qtd || i.QTD || 1;
      const emb = i.embalagem || i.EMBALAGEM || i.emb || 'UN';
      return `• *${cod}* - ${desc} (Qtd: ${qtd} ${emb})`;
    }).join('\n');

    const msg = [
      `📦 *GUIA DE SEPARAÇÃO - ATACADÃO SS*`,
      `👤 *CLIENTE:* ${cliente}`,
      `📋 *Pedido:* #${id} ${dataStr ? `| *Data:* ${dataStr}` : ''}`,
      `⚙️ *Status:* ${item.status || 'Aberta'} | *Separador:* ${separador}`,
      `----------------------------------------`,
      `📝 *PRODUTOS PARA SEPARAÇÃO:*`,
      itensList || '• Nenhum item cadastrado',
      `----------------------------------------`,
      `💰 *VALOR TOTAL:* ${total}`,
    ].join('\n');

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Verificação de permissão de acesso à página
  const canAccess = hasPermission('Acesso Separacao') || role === 'repositor' || role === 'lider' || role === 'admin' || role === 'gerente' || role === 'vendedor';
  const canAssign = role === 'admin' || role === 'gerente' || role === 'vendedor';

  if (!canAccess) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle size={64} className="mx-auto text-destructive" />
          <h2 className="text-2xl font-black uppercase">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar o módulo de separação.</p>
          <p className="text-xs text-muted-foreground">Role atual: <span className="font-bold">{role || 'N/A'}</span></p>
        </div>
      </div>
    );
  }

  // Filtra itens visíveis:
  const visibleItems = items
    .filter(item => item.status !== 'Finalizada')
    .filter(item => {
      if (canAssign) return true;

      const currentUserId = user?.firebaseId || user?.id;
      const currentUserName = (user?.usuario || user?.name || '').toLowerCase();

      const isAssignedById = Boolean(
        currentUserId && (
          item.atribuidoId === currentUserId ||
          item.separadorId === currentUserId
        )
      );
      const isAssignedByName = Boolean(
        currentUserName && (
          (item.atribuido || '').toLowerCase() === currentUserName ||
          (item.separador || '').toLowerCase() === currentUserName
        )
      );

      return isAssignedById || isAssignedByName;
    });

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
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="animate-spin text-primary w-16 h-16" />
          <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Mapeando pedidos pendentes...</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-4">
          <Package size={64} className="text-muted-foreground opacity-20" />
          <p className="text-muted-foreground font-bold">Nenhuma separação pendente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {visibleItems.map((item) => (
            <div
              key={item.firebaseId}
              className={cn(
                "erp-card p-4 md:p-6 flex flex-col border-t-8 transition-all relative overflow-hidden",
                item.status === 'Aberta' ? "border-t-muted" :
                  item.status === 'Em Separação' ? "border-t-orange-400" :
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

              {/* Destaque no Cliente */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1 min-w-0 pr-3">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">Cliente</span>
                  <h3 className="text-xl md:text-2xl font-black tracking-tight text-foreground truncate" title={item.cliente}>
                    {item.cliente || 'CLIENTE NÃO INFORMADO'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-bold">
                    <span>Pedido #{item.firebaseId?.slice(-6) || 'N/A'}</span>
                    {item.data && <span>• {new Date(item.data).toLocaleDateString('pt-BR')}</span>}
                  </p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-2xs shrink-0",
                  item.status === 'Aberta' ? "bg-muted text-muted-foreground border-border" :
                    item.status === 'Em Separação' ? "bg-orange-100 text-orange-700 border-orange-200" :
                      item.status === 'Finalizada' ? "bg-success/10 text-success border-success/20" :
                        "bg-primary/10 text-primary border-primary/20"
                )}>
                  {item.status}
                </span>
              </div>

              <div className="space-y-4 flex-1">
                {/* Separador Apenas Leitura (Sem Dropdown) */}
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <User size={18} className="text-primary" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Separador</p>
                    <p className="font-bold truncate mt-1">{item.atribuido || item.separador || 'Não Atribuído'}</p>
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

              {/* Botões de Ação com Envio Minimalista no WPP */}
              <div className="mt-8 pt-6 border-t border-dashed border-border flex items-center gap-2">
                <button
                  onClick={() => generateSeparacaoPDF(item)}
                  className="min-h-[44px] p-3.5 bg-card border border-border text-foreground hover:bg-muted rounded-2xl transition-all shadow-2xs active:scale-95 flex items-center justify-center"
                  title="Imprimir Guia de Picking (PDF)"
                >
                  <FileText size={18} />
                </button>

                <button
                  onClick={() => handleShareWhatsApp(item)}
                  className="min-h-[44px] p-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-2xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 font-extrabold text-xs"
                  title="Encaminhar via WhatsApp"
                >
                  <MessageSquare size={18} />
                </button>

                <button
                  disabled={item.status === 'Finalizada' || updatingId === item.firebaseId}
                  onClick={() => handleUpdateStatus(item.firebaseId, item.status)}
                  className={cn(
                    "min-h-[44px] flex-1 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest py-3 px-4 rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50",
                    item.status === 'Finalizada' ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground hover:shadow-primary/20"
                  )}
                >
                  {updatingId === item.firebaseId ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : item.status === 'Finalizada' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Play size={18} />
                  )}
                  {item.status === 'Aberta' && 'Iniciar Separação'}
                  {item.status === 'Em Separação' && 'Iniciar Picking'}
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