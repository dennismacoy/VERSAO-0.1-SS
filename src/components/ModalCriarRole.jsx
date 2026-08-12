import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Save, Loader2 } from 'lucide-react';

export default function ModalCriarRole({
  isOpen,
  onClose,
  onSave,
  isSaving = false
}) {
  const [roleName, setRoleName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRoleName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roleName.trim()) {
      alert('Por favor, informe o nome da nova Role/Perfil.');
      return;
    }
    onSave(roleName.trim(), []);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* HEADER DO MODAL */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 bg-green-50/60 dark:bg-green-950/40 flex justify-between items-center">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-extrabold text-base sm:text-lg">
            <ShieldCheck size={22} className="text-green-600 flex-shrink-0" />
            <span>Criar Nova Role / Perfil</span>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <form id="create-role-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Nome do Perfil / Role *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: Auditor, Supervisor, Líder de Estoque..."
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full h-11 px-3.5 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold focus:outline-none focus:border-green-600"
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Após criar a role, você poderá ativar ou desativar o acesso a cada página do sistema no painel de permissões.
            </p>
          </div>
        </form>

        {/* FOOTER FIXO */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-zinc-600 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-role-form"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Criar Role
          </button>
        </div>
      </div>
    </div>
  );
}

