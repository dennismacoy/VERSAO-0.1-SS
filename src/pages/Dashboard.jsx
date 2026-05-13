import React, { useMemo } from 'react';
import { useProducts } from '../context/ProductsContext';
import { useAuth } from '../context/AuthContext';
import { parseEstoque, getEstoqueNumerico, formatCurrency } from '../lib/utils';
import {
  Package,
  Inbox,
  AlertTriangle,
  Clock,
  Layers,
  DollarSign,
  TrendingUp,
  Activity
} from 'lucide-react';

export default function Dashboard() {
  const { products, loading } = useProducts();
  const { hasPermission, role } = useAuth();

  const stats = useMemo(() => {
    let data = {
      isvCount: 0, isvValue: 0,
      ageCount: 0, ageValue: 0,
      totalPallets: 0, totalValue: 0,
      separacoes: 0, requisicoes: 0
    };

    if (!products || products.length === 0) return data;

    products.forEach(p => {
      // Usar parseEstoque para determinar se tem estoque real
      const estoqueStr = p.ESTOQUE || p.QTE || p.estoque || 0;
      const temEstoque = parseEstoque(estoqueStr);
      const estoqueNum = getEstoqueNumerico(estoqueStr);
      const custo = Number(p.CUSTO || p.PRECO || p.custo || 0);
      const val = estoqueNum * custo;

      if (temEstoque) {
        // Valor de Estoque: Somatório financeiro de TODOS os itens em estoque
        data.totalValue += val;

        // ISV: Contar apenas itens com estoque > 0 E dias sem venda > 7
        const diasSemVenda = Number(p.ISV || p.DIAS_SEM_VENDA || p.dias_sem_venda || 0);
        if (diasSemVenda > 7) {
          data.isvCount++;
          data.isvValue += val;
        }

        // Idade: Contar itens com estoque > 0 E dias de idade > 300
        const idade = Number(p.IDADE || p.idade || 0);
        if (idade > 300) {
          data.ageCount++;
          data.ageValue += val;
        }

        // Total Paletes: Somar valor numérico da coluna "estoque paletes"
        const paletes = Number(p.PALETES || p.PALETE_ESTOQUE || p.paletes || 0);
        data.totalPallets += paletes;
      }
    });

    return data;
  }, [products]);

  // A condição de carregamento agora APENAS verifica o estado "loading"
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Activity className="animate-spin text-primary w-12 h-12" />
        <h2 className="text-xl font-bold text-muted-foreground animate-pulse">Calculando Cockpit...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Dashboard</h1>
          <p className="text-muted-foreground font-medium">Cockpit de Gestão ERP</p>
        </div>
        <div className="bg-card px-4 py-2 rounded-xl border border-border shadow-sm flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${products.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {products.length > 0 ? `${products.length.toLocaleString()} itens` : 'Base Vazia'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {hasPermission('Ver Separacoes Abertas') && (
          <div className="erp-card p-6 flex flex-col gap-4 border-l-4 border-l-primary hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Separações</p>
                <h3 className="text-3xl font-black mt-1">{stats.separacoes}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Package size={24} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Abertas e em andamento</p>
          </div>
        )}

        {hasPermission('Ver Requisicoes Pendentes') && (
          <div className="erp-card p-6 flex flex-col gap-4 border-l-4 border-l-accent hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Requisições</p>
                <h3 className="text-3xl font-black mt-1">{stats.requisicoes}</h3>
              </div>
              <div className="p-3 bg-accent/10 rounded-xl text-accent">
                <Inbox size={24} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Pendentes de aprovação</p>
          </div>
        )}

        {hasPermission('Ver Itens ISV') && (
          <div className="erp-card p-6 flex flex-col gap-4 hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">ISV &gt; 7 Dias</p>
                <h3 className="text-2xl font-black mt-1">{stats.isvCount} <span className="text-sm font-medium text-muted-foreground">itens</span></h3>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                <AlertTriangle size={24} />
              </div>
            </div>
            <div className="bg-muted p-2 rounded-lg">
              <p className="text-xs font-bold text-muted-foreground">Valor Retido: <span className="text-foreground">{formatCurrency(stats.isvValue)}</span></p>
            </div>
          </div>
        )}

        {hasPermission('Ver Itens Idade') && (
          <div className="erp-card p-6 flex flex-col gap-4 hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Idade &gt; 300 Dias</p>
                <h3 className="text-2xl font-black mt-1">{stats.ageCount} <span className="text-sm font-medium text-muted-foreground">itens</span></h3>
              </div>
              <div className="p-3 bg-destructive/10 rounded-xl text-destructive">
                <Clock size={24} />
              </div>
            </div>
            <div className="bg-muted p-2 rounded-lg">
              <p className="text-xs font-bold text-muted-foreground">Valor Retido: <span className="text-foreground">{formatCurrency(stats.ageValue)}</span></p>
            </div>
          </div>
        )}

        {hasPermission('Ver Total Paletes') && (
          <div className="erp-card p-6 flex flex-col gap-4 hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Paletes</p>
                <h3 className="text-3xl font-black mt-1">{stats.totalPallets}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                <Layers size={24} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Paletes armazenados no estoque</p>
          </div>
        )}

        {hasPermission('Ver Valor Estoque') && (
          <div className="erp-card p-6 flex flex-col gap-4 border-b-4 border-b-primary hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Valor em Estoque</p>
                <h3 className="text-2xl font-black mt-1 text-primary">{formatCurrency(stats.totalValue)}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <DollarSign size={24} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-green-600 dark:text-green-400 mt-2">
              <TrendingUp size={14} />
              <span>Atualizado em tempo real via Cache</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}