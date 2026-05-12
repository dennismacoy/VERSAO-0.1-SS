import React, { useMemo } from 'react';
import { useProducts } from '../context/ProductsContext';
import { useAuth } from '../context/AuthContext';
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

  // Simulated metrics based on cache (In a real scenario, some might come from separate endpoints if too complex)
  const stats = useMemo(() => {
    if (!products || products.length === 0) return null;

    let isvCount = 0;
    let isvValue = 0;
    let ageCount = 0;
    let ageValue = 0;
    let totalPallets = 0;
    let totalValue = 0;

    products.forEach(p => {
      const qte = Number(p.ESTOQUE || p.QTE) || 0;
      const custo = Number(p.CUSTO || p.PRECO) || 0;
      const val = qte * custo;

      if (qte > 0) {
        totalValue += val;
        // Mock data logic if the real fields are not present
        const diasSemVenda = Number(p.ISV || Math.floor(Math.random() * 20)); 
        const idade = Number(p.IDADE || Math.floor(Math.random() * 400));
        const paletes = Number(p.PALETES || 0);

        if (diasSemVenda > 7) {
          isvCount++;
          isvValue += val;
        }
        if (idade > 300) {
          ageCount++;
          ageValue += val;
        }
        totalPallets += paletes;
      }
    });

    return {
      isvCount, isvValue,
      ageCount, ageValue,
      totalPallets, totalValue,
      separacoes: 12, // Mocked
      requisicoes: 5 // Mocked
    };
  }, [products]);

  const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading || !stats) {
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
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Cache Sincronizado</span>
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
              <p className="text-xs font-bold text-muted-foreground">Valor Retido: <span className="text-foreground">{formatMoney(stats.isvValue)}</span></p>
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
              <p className="text-xs font-bold text-muted-foreground">Valor Retido: <span className="text-foreground">{formatMoney(stats.ageValue)}</span></p>
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
                <h3 className="text-2xl font-black mt-1 text-primary">{formatMoney(stats.totalValue)}</h3>
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
