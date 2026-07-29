import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export default function ModalConfirmarExclusao({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Exclusão',
  itemName = '',
  isDeleting = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-rose-50 dark:bg-rose-950/40 flex justify-between items-center">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-extrabold text-base">
            <AlertTriangle size={20} className="flex-shrink-0" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Tem certeza de que deseja excluir o registro abaixo? Esta ação não poderá ser desfeita.
          </p>

          {itemName && (
            <div className="p-3 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Item Selecionado</span>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-0.5 break-words">
                {itemName}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-zinc-600 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
}
