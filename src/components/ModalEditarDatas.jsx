import React, { useState, useEffect } from 'react';
import { Calendar, X, Save, Loader2 } from 'lucide-react';

export default function ModalEditarDatas({
  isOpen,
  onClose,
  onSave,
  item,
  type,
  isSaving = false
}) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (item) {
      setFormData({
        entryDate: item.entryDate || '',
        dueDate: item.dueDate || '',
        lastDate: item.lastDate || '',
        sendDate: item.sendDate || '',
        expectedDate: item.expectedDate || ''
      });
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const getItemTitle = () => {
    return item.name || item.device || 'Registro';
  };

  return (
    <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-orange-50 dark:bg-orange-950/40 flex justify-between items-center">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-extrabold text-base">
            <Calendar size={18} className="flex-shrink-0" />
            <span>Editar Datas do Registro</span>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registro</span>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5 truncate">
              {getItemTitle()}
            </p>
          </div>

          {/* TAREFA DATES */}
          {type === 'task' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Data de Entrada / Criação
                </label>
                <input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Data Limite (Prazo Final)
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* PREVENTIVA DATES */}
          {type === 'preventive' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                Data da Última Realização
              </label>
              <input
                type="date"
                required
                value={formData.lastDate}
                onChange={(e) => setFormData({ ...formData, lastDate: e.target.value })}
                className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium focus:outline-none focus:border-orange-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                A próxima data de vencimento será calculada automaticamente a partir desta data com base na periodicidade.
              </p>
            </div>
          )}

          {/* IT DATES */}
          {type === 'it' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Data de Envio
                </label>
                <input
                  type="date"
                  value={formData.sendDate}
                  onChange={(e) => setFormData({ ...formData, sendDate: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Previsão de Retorno
                </label>
                <input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-zinc-600 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar Datas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
