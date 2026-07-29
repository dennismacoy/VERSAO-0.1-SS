import React from 'react';
import { Clock, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';

/**
 * Calcula a diferença em dias entre a data atual e a data alvo (zerando horas)
 */
export const calculateDaysRemaining = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  if (isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function ContadorDias({ targetDate, isCompleted = false, completedText = 'Concluído', className = '' }) {
  if (isCompleted) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 ${className}`}>
        <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
        {completedText}
      </span>
    );
  }

  const days = calculateDaysRemaining(targetDate);

  if (days === null) {
    return <span className="text-xs text-slate-400 font-medium">-</span>;
  }

  if (days < 0) {
    const absDays = Math.abs(days);
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse ${className}`} title={`Atrasado há ${absDays} dia(s)`}>
        <AlertTriangle size={13} className="text-rose-600 dark:text-rose-400" />
        Atrasado ({absDays}d)
      </span>
    );
  }

  if (days === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 ${className}`}>
        <Clock size={13} className="text-amber-600 dark:text-amber-400" />
        Vence Hoje!
      </span>
    );
  }

  if (days <= 5) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 ${className}`}>
        <Clock size={13} className="text-amber-600 dark:text-amber-400" />
        {days} {days === 1 ? 'dia restante' : 'dias restantes'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 ${className}`}>
      <Calendar size={13} className="text-emerald-600 dark:text-emerald-400" />
      {days} dias restantes
    </span>
  );
}
