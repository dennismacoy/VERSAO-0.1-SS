import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, CheckSquare, Square, Save, Loader2, Check, CheckCircle2 } from 'lucide-react';
import { ALL_PERMISSIONS_LIST } from '../lib/permissions';

export default function ModalCriarRole({
  isOpen,
  onClose,
  onSave,
  isSaving = false
}) {
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setRoleName('');
      // Por padrão seleciona visualização básica do Dashboard e Consulta
      setSelectedPermissions(['view_dashboard', 'view_consulta']);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTogglePermission = (permId) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  };

  const handleSelectAll = () => {
    setSelectedPermissions(ALL_PERMISSIONS_LIST.map(p => p.id));
  };

  const handleDeselectAll = () => {
    setSelectedPermissions([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roleName.trim()) {
      alert('Por favor, informe o nome da nova Role/Perfil.');
      return;
    }
    if (selectedPermissions.length === 0) {
      alert('Selecione pelo menos uma permissão para a nova Role.');
      return;
    }
    onSave(roleName.trim(), selectedPermissions);
  };

  // Agrupa permissões por categoria
  const pagesPermissions = ALL_PERMISSIONS_LIST.filter(p => p.category === 'Páginas');
  const integrationsPermissions = ALL_PERMISSIONS_LIST.filter(p => p.category === 'Integrações');
  const actionsPermissions = ALL_PERMISSIONS_LIST.filter(p => p.category === 'Ações');

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* HEADER DO MODAL */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 bg-green-50/60 dark:bg-green-950/40 flex justify-between items-center">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-extrabold text-base sm:text-lg">
            <ShieldCheck size={22} className="text-green-600 flex-shrink-0" />
            <span>Criar Nova Role / Perfil de Acesso</span>
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
        <form id="create-role-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* NOME DA ROLE */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Nome do Perfil / Role *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Auditor, Supervisor, Líder de Estoque..."
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full h-11 px-3.5 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold focus:outline-none focus:border-green-600"
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Este nome será atribuído aos usuários no cadastro de contas.
            </p>
          </div>

          {/* BOTÕES DE MARCAR / DESMARCAR TODAS */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Permissões ({selectedPermissions.length} selecionadas)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-green-600 dark:text-green-400 hover:underline"
              >
                Marcar Todas
              </button>
              <span className="text-slate-300 dark:text-zinc-700">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Desmarcar Todas
              </button>
            </div>
          </div>

          {/* SEÇÃO 1: ACESSO A PÁGINAS */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Acesso a Páginas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pagesPermissions.map((perm) => {
                const isSelected = selectedPermissions.includes(perm.id);
                return (
                  <button
                    type="button"
                    key={perm.id}
                    onClick={() => handleTogglePermission(perm.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-800 dark:text-green-200'
                        : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <Square size={16} className="text-slate-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{perm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO INTEGRAÇÃO & PLANILHA BASE */}
          {integrationsPermissions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <h4 className="text-xs font-extrabold text-green-700 dark:text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Planilha Base & Sincronização</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-extrabold">Destaque</span>
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {integrationsPermissions.map((perm) => {
                  const isSelected = selectedPermissions.includes(perm.id);
                  return (
                    <button
                      type="button"
                      key={perm.id}
                      onClick={() => handleTogglePermission(perm.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs font-extrabold transition-all shadow-xs ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isSelected ? (
                          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Square size={18} className="text-slate-400 flex-shrink-0" />
                        )}
                        <span>{perm.label}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        isSelected ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500'
                      }`}>
                        {isSelected ? 'DOWNLOAD ATIVO' : 'DOWNLOAD BLOQUEADO'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO 2: AÇÕES E RECURSOS */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Ações e Botões de Controle</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {actionsPermissions.map((perm) => {
                const isSelected = selectedPermissions.includes(perm.id);
                return (
                  <button
                    type="button"
                    key={perm.id}
                    onClick={() => handleTogglePermission(perm.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-800 dark:text-green-200'
                        : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <Square size={16} className="text-slate-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{perm.label}</span>
                  </button>
                );
              })}
            </div>
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
            Salvar Nova Role
          </button>
        </div>
      </div>
    </div>
  );
}
