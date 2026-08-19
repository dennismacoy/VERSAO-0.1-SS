import React, { useState, useEffect, useMemo } from 'react';
import { useProducts } from '../context/ProductsContext';
import { useAuth } from '../context/AuthContext';
import { parseEstoque, getEstoqueNumerico, parseNumericValue, formatCurrency } from '../lib/utils';
import { listenToNode } from '../lib/firebase';
import {
  Package,
  Inbox,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  ShoppingCart,
  MapPin,
  Building2,
  CheckCircle2,
  Hourglass
} from 'lucide-react';

export default function Dashboard() {
  const { products, loading } = useProducts();
  const { hasPermission } = useAuth();

  const [realtimeStats, setRealtimeStats] = useState({
    separacoes: 0,
    requisicoes: 0,
    preVendas: { abertas: 0, emSeparacao: 0, finalizadas: 0, totalValor: 0 }
  });

  // Listener em tempo real via Firebase Realtime Database
  useEffect(() => {
    const unsubRequisicoes = listenToNode('requisicoes', (data) => {
      if (!data) {
        setRealtimeStats(prev => ({ ...prev, requisicoes: 0 }));
        return;
      }
      const list = Object.values(data);
      const pending = list.filter(r => r.status === 'Pendente' || !r.completed).length;
      setRealtimeStats(prev => ({ ...prev, requisicoes: pending }));
    });

    const unsubPreVendas = listenToNode('prevendas', (data) => {
      if (!data) {
        setRealtimeStats(prev => ({
          ...prev,
          separacoes: 0,
          preVendas: { abertas: 0, emSeparacao: 0, finalizadas: 0, totalValor: 0 }
        }));
        return;
      }
      const list = Object.values(data);
      let abertas = 0;
      let emSeparacao = 0;
      let finalizadas = 0;
      let totalValor = 0;

      list.forEach(pv => {
        const st = (pv.status || 'Aberta').toLowerCase();
        const val = Number(pv.total || pv.totalValue || 0);
        totalValor += val;

        if (st === 'aberta' || st === 'pendente') abertas++;
        else if (st === 'em separacao' || st === 'separando') emSeparacao++;
        else if (st === 'finalizada' || st === 'concluida') finalizadas++;
      });

      setRealtimeStats(prev => ({
        ...prev,
        separacoes: emSeparacao + abertas,
        preVendas: { abertas, emSeparacao, finalizadas, totalValor }
      }));
    });

    return () => {
      if (typeof unsubRequisicoes === 'function') unsubRequisicoes();
      if (typeof unsubPreVendas === 'function') unsubPreVendas();
    };
  }, []);

  // Estatísticas de Estoque & ISV
  const stats = useMemo(() => {
    let data = {
      isvCount: 0, isvValue: 0,
      ageCount: 0, ageValue: 0,
      totalValue: 0
    };

    if (!products || products.length === 0) return data;

    products.forEach(p => {
      const estoqueStr = p.ESTOQUE || p.QTE || p.estoque || 0;
      const temEstoque = parseEstoque(estoqueStr);
      const numEst = getEstoqueNumerico(p);
      const val = parseNumericValue(p.VALOR_ESTOQUE ?? p.valor_estoque);

      if (temEstoque && numEst > 0) {
        data.totalValue += val;

        const diasSemVenda = Number(p.ISV || p.DIAS_SEM_VENDA || p.dias_sem_venda || 0);
        const idade = Number(p.IDADE || p.idade || 0);

        // REGRA ESTRITA DE ISV EM RISCO: dias_sem_venda > 7 E idade > 7 E estoque positivo
        if (diasSemVenda > 7 && idade > 7) {
          data.isvCount++;
          data.isvValue += val;
        }

        if (idade > 300) {
          data.ageCount++;
          data.ageValue += val;
        }
      }
    });

    return data;
  }, [products]);

  // ISV Agrupado por Corredor
  const isvByCorridor = useMemo(() => {
    const map = {};
    if (!products) return [];

    products.forEach(p => {
      const estStr = p.ESTOQUE || p.QTE || p.estoque || 0;
      const temEst = parseEstoque(estStr);
      const numEst = getEstoqueNumerico(p);
      const diasSV = Number(p.ISV || p.DIAS_SEM_VENDA || p.dias_sem_venda || 0);
      const idade = Number(p.IDADE || p.idade || 0);

      if (temEst && numEst > 0 && diasSV > 7 && idade > 7) {
        const corr = (p.CORREDOR || p.corredor || 'S/ Corredor').toString().trim() || 'S/ Corredor';
        const val = parseNumericValue(p.VALOR_ESTOQUE ?? p.valor_estoque);
        if (!map[corr]) {
          map[corr] = { corridor: corr, count: 0, totalValue: 0 };
        }
        map[corr].count += 1;
        map[corr].totalValue += val;
      }
    });

    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [products]);

  // Top 10 Razões Sociais / Fornecedores em Risco ISV
  const top10RiskSuppliers = useMemo(() => {
    const map = {};
    if (!products) return [];

    products.forEach(p => {
      const estStr = p.ESTOQUE || p.QTE || p.estoque || 0;
      const temEst = parseEstoque(estStr);
      const numEst = getEstoqueNumerico(p);
      const diasSV = Number(p.ISV || p.DIAS_SEM_VENDA || p.dias_sem_venda || 0);
      const idade = Number(p.IDADE || p.idade || 0);

      if (temEst && numEst > 0 && diasSV > 7 && idade > 7) {
        const rz = (
          p.RAZAOSOCIAL ||
          p.RAZAO_SOCIAL ||
          p.razaosocial ||
          p.razao_social ||
          p.FORNECEDOR ||
          p.fornecedor ||
          p.Fabricante ||
          'Não Informado'
        ).toString().trim() || 'Não Informado';

        const val = parseNumericValue(p.VALOR_ESTOQUE ?? p.valor_estoque);
        if (!map[rz]) {
          map[rz] = { name: rz, count: 0, totalValue: 0 };
        }
        map[rz].count += 1;
        map[rz].totalValue += val;
      }
    });

    return Object.values(map)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [products]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Activity className="animate-spin text-primary w-12 h-12" />
        <h2 className="text-xl font-bold text-muted-foreground animate-pulse">Calculando Cockpit...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO DO DASHBOARD */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase italic">Dashboard</h1>
          <p className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Cockpit de Operação & Inteligência ERP</p>
        </div>
        <div className="bg-card px-4 py-2 rounded-xl border border-border shadow-2xs flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${products.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            {products.length > 0 ? `${products.length.toLocaleString()} itens em cache` : 'Base Vazia'}
          </span>
        </div>
      </div>

      {/* CARDS PRINCIPAIS EM TEMPO REAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {hasPermission('Ver Separacoes Abertas') && (
          <div className="erp-card p-5 flex flex-col justify-between gap-3 border-l-4 border-l-primary hover:-translate-y-0.5 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Separações Ativas</p>
                <h3 className="text-3xl font-black mt-1 text-foreground">{realtimeStats.separacoes}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Package size={22} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Sincronizado em tempo real
            </p>
          </div>
        )}

        {hasPermission('Ver Requisicoes Pendentes') && (
          <div className="erp-card p-5 flex flex-col justify-between gap-3 border-l-4 border-l-orange-500 hover:-translate-y-0.5 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Requisições Pendentes</p>
                <h3 className="text-3xl font-black mt-1 text-foreground">{realtimeStats.requisicoes}</h3>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                <Inbox size={22} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold">Aguardando validação ou aprovação</p>
          </div>
        )}

        {hasPermission('Ver Itens ISV') && (
          <div className="erp-card p-5 flex flex-col justify-between gap-3 hover:-translate-y-0.5 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">ISV & Idade &gt; 7 Dias</p>
                <h3 className="text-2xl font-black mt-1 text-foreground">{stats.isvCount} <span className="text-xs font-semibold text-muted-foreground">itens</span></h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500">
                <AlertTriangle size={22} />
              </div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-900/60">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Retido: <span className="font-black">{formatCurrency(stats.isvValue)}</span></p>
            </div>
          </div>
        )}

        {hasPermission('Ver Valor Estoque') && (
          <div className="erp-card p-5 flex flex-col justify-between gap-3 border-b-4 border-b-primary hover:-translate-y-0.5 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor em Estoque</p>
                <h3 className="text-2xl font-black mt-1 text-primary">{formatCurrency(stats.totalValue)}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <DollarSign size={22} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={14} />
              <span>Base total auditada</span>
            </div>
          </div>
        )}

      </div>

      {/* BLOCO: RESUMO DE PRÉ-VENDAS */}
      <div className="erp-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
            <ShoppingCart size={18} /> Resumo Operacional de Pré-Vendas
          </h2>
          <span className="text-xs font-bold text-muted-foreground">
            Total Orçado: <span className="text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(realtimeStats.preVendas.totalValor)}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Abertas / Pendentes</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{realtimeStats.preVendas.abertas}</h4>
            </div>
            <div className="p-2.5 bg-slate-200 dark:bg-zinc-700 rounded-xl text-slate-600 dark:text-slate-300">
              <Hourglass size={20} />
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-950/40 p-4 rounded-2xl border border-orange-200 dark:border-orange-900/60 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">Em Separação</p>
              <h4 className="text-2xl font-black text-orange-800 dark:text-orange-200 mt-1">{realtimeStats.preVendas.emSeparacao}</h4>
            </div>
            <div className="p-2.5 bg-orange-200 dark:bg-orange-900/80 rounded-xl text-orange-700 dark:text-orange-200">
              <Package size={20} />
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Finalizadas</p>
              <h4 className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">{realtimeStats.preVendas.finalizadas}</h4>
            </div>
            <div className="p-2.5 bg-emerald-200 dark:bg-emerald-900/80 rounded-xl text-emerald-700 dark:text-emerald-200">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO DUPLA: ISV POR CORREDOR & TOP 10 RAZÕES SOCIAIS EM RISCO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* VALOR ISV AGRUPADO POR CORREDOR */}
        <div className="erp-card p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <MapPin size={18} /> Valor ISV Retido por Corredor
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {isvByCorridor.length} Corredores
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
            {isvByCorridor.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 font-medium">
                Nenhum produto em risco de ISV encontrado.
              </p>
            ) : (
              isvByCorridor.map((item) => (
                <div
                  key={item.corridor}
                  className="p-3.5 bg-muted/40 hover:bg-muted/80 rounded-2xl border border-border/60 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                      C{item.corridor}
                    </span>
                    <div>
                      <p className="font-extrabold text-xs text-foreground">Corredor {item.corridor}</p>
                      <p className="text-[11px] text-muted-foreground font-semibold">{item.count} item(ns) em risco</p>
                    </div>
                  </div>
                  <span className="font-black text-xs text-rose-600 dark:text-rose-400">
                    {formatCurrency(item.totalValue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOP 10 RAZÕES SOCIAIS / FORNECEDORES EM RISCO ISV */}
        <div className="erp-card p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Building2 size={18} /> Top 10 Razões Sociais em Risco ISV
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-1 rounded-md border border-rose-200 dark:border-rose-900">
              Rank Maior Valor
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
            {top10RiskSuppliers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 font-medium">
                Nenhum fornecedor com itens em risco de ISV.
              </p>
            ) : (
              top10RiskSuppliers.map((sup, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-muted/40 hover:bg-muted/80 rounded-2xl border border-border/60 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[11px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-foreground truncate">{sup.name}</p>
                      <p className="text-[11px] text-muted-foreground font-semibold">{sup.count} produto(s)</p>
                    </div>
                  </div>
                  <span className="font-black text-xs text-rose-600 dark:text-rose-400 shrink-0">
                    {formatCurrency(sup.totalValue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}