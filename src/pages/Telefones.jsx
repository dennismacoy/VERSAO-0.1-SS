import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone,
  Search,
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  PhoneCall,
  Loader2,
  Building2,
  Tag,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Save
} from 'lucide-react';
import { listenToNode } from '../lib/firebase';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSortableData } from '../hooks/useSortableData';
import { cn } from '../lib/utils';

export default function Telefones() {
  const { hasPermission } = useAuth();
  const [telefones, setTelefones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const unsubRef = useRef(null);

  // Estados do Modal de Criação / Edição
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    nome: '',
    marca: '',
    telefone: '',
    setor: '',
    observacoes: ''
  });
  const [saving, setSaving] = useState(false);

  // Sincronização em tempo real via Firebase
  useEffect(() => {
    unsubRef.current = listenToNode('telefones', (items) => {
      setTelefones(items || []);
      setLoading(false);
    });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  // Filtragem instantânea por Nome, Marca ou Telefone
  const filteredTelefones = useMemo(() => {
    if (!searchQuery.trim()) return telefones;
    const q = searchQuery.toLowerCase().trim();
    return telefones.filter(item => {
      const nome = (item.nome || '').toLowerCase();
      const marca = (item.marca || '').toLowerCase();
      const tel = (item.telefone || '').toLowerCase();
      const setor = (item.setor || '').toLowerCase();
      return nome.includes(q) || marca.includes(q) || tel.includes(q) || setor.includes(q);
    });
  }, [telefones, searchQuery]);

  // Hook de ordenação dinâmica das colunas
  const { items: sortedTelefones, requestSort, sortConfig } = useSortableData(filteredTelefones, { key: 'nome', direction: 'asc' });

  // Utilitário para formatar link do WhatsApp
  const getWppLink = (telStr) => {
    if (!telStr) return '#';
    const cleaned = telStr.replace(/\D/g, '');
    const num = cleaned.length <= 11 && !cleaned.startsWith('55') ? `55${cleaned}` : cleaned;
    return `https://wa.me/${num}`;
  };

  // Utilitário para formatar link de chamada
  const getTelLink = (telStr) => {
    if (!telStr) return '#';
    const cleaned = telStr.replace(/\D/g, '');
    return `tel:${cleaned}`;
  };

  // Abrir Modal para Criar
  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ nome: '', marca: '', telefone: '', setor: '', observacoes: '' });
    setShowModal(true);
  };

  // Abrir Modal para Editar
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setForm({
      nome: item.nome || '',
      marca: item.marca || '',
      telefone: item.telefone || '',
      setor: item.setor || '',
      observacoes: item.observacoes || ''
    });
    setShowModal(true);
  };

  // Salvar (Criar ou Atualizar)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) {
      alert('Por favor, preencha pelo menos o Nome e o Telefone.');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await api.updateRecord('telefones', editingItem.firebaseId, form);
      } else {
        await api.createRecord('telefones', form);
      }
      setShowModal(false);
      setForm({ nome: '', marca: '', telefone: '', setor: '', observacoes: '' });
    } catch (err) {
      console.error('Erro ao salvar telefone:', err);
      alert('Erro ao salvar registro no Firebase.');
    } finally {
      setSaving(false);
    }
  };

  // Excluir Registro
  const handleDelete = async (item) => {
    if (window.confirm(`Tem certeza que deseja excluir o contato "${item.nome}"?`)) {
      try {
        await api.deleteRecord('telefones', item.firebaseId);
      } catch (err) {
        console.error('Erro ao excluir telefone:', err);
        alert('Erro ao excluir contato do Firebase.');
      }
    }
  };

  const renderSortHeader = (title, key, align = 'left') => {
    const isActive = sortConfig?.key === key;
    return (
      <th
        onClick={() => requestSort(key)}
        className={`px-4 py-3 cursor-pointer select-none hover:bg-muted/80 transition-colors ${
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
        }`}
        title={`Clique para ordenar por ${title}`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
          <span className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
          {isActive ? (
            sortConfig.direction === 'asc' ? (
              <ArrowUp size={13} className="text-primary font-bold" />
            ) : (
              <ArrowDown size={13} className="text-primary font-bold" />
            )
          ) : (
            <ArrowUpDown size={12} className="text-muted-foreground opacity-50 hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-primary flex items-center gap-2.5">
            <Phone className="text-primary shrink-0" size={28} />
            Telefones & Ramais
          </h1>
          <p className="text-muted-foreground font-medium text-xs md:text-sm mt-0.5">
            Agenda telefônica, contatos de fornecedores e ramais internos
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="btn-primary flex items-center justify-center gap-2 text-xs py-2.5 px-4 rounded-xl shadow-md uppercase tracking-wider font-extrabold shrink-0"
        >
          <Plus size={18} />
          <span>Novo Telefone</span>
        </button>
      </div>

      {/* BANNER DE FILTROS & BUSCA */}
      <div className="erp-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Nome, Marca, Telefone ou Setor..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-lg shrink-0">
          Total de Contatos: <span className="text-primary font-black">{filteredTelefones.length}</span>
        </div>
      </div>

      {/* LISTAGEM PRINCIPAL */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="font-bold text-sm">Carregando telefones...</p>
        </div>
      ) : sortedTelefones.length === 0 ? (
        <div className="erp-card p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
          <Phone size={48} className="opacity-20 text-primary" />
          <p className="font-bold text-base">Nenhum telefone encontrado.</p>
          <p className="text-xs opacity-75">
            {searchQuery ? 'Tente alterar a busca.' : 'Clique no botão "Novo Telefone" para cadastrar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TABELA DESKTOP */}
          <div className="hidden md:block erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    {renderSortHeader('Nome / Contato', 'nome')}
                    {renderSortHeader('Marca / Empresa', 'marca')}
                    {renderSortHeader('Telefone', 'telefone')}
                    {renderSortHeader('Setor', 'setor')}
                    <th className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-muted-foreground">Observações</th>
                    <th className="px-4 py-3 font-extrabold text-xs uppercase tracking-wider text-muted-foreground text-center">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedTelefones.map((item) => (
                    <tr key={item.firebaseId || item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/10 rounded-lg text-primary shrink-0">
                            <Phone size={14} />
                          </div>
                          <span>{item.nome}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-muted-foreground">
                        {item.marca ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-secondary/20 text-secondary-foreground text-[11px] font-bold">
                            <Tag size={12} />
                            {item.marca}
                          </span>
                        ) : (
                          <span className="opacity-40">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-extrabold text-primary text-sm tracking-wide">
                        {item.telefone}
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-muted-foreground">
                        {item.setor ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <Building2 size={12} className="text-muted-foreground" />
                            {item.setor}
                          </span>
                        ) : (
                          <span className="opacity-40">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-medium text-muted-foreground max-w-xs truncate">
                        {item.observacoes || '-'}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Botão Chamada */}
                          <a
                            href={getTelLink(item.telefone)}
                            className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/60 transition-colors"
                            title="Discar / Ligar"
                          >
                            <PhoneCall size={16} />
                          </a>

                          {/* Botão WhatsApp */}
                          <a
                            href={getWppLink(item.telefone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-900/60 transition-colors"
                            title="Abrir WhatsApp"
                          >
                            <MessageSquare size={16} />
                          </a>

                          {/* Editar */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
                            title="Editar contato"
                          >
                            <Edit2 size={16} />
                          </button>

                          {/* Excluir */}
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Excluir contato"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CARDS MOBILE */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {sortedTelefones.map((item) => (
              <div
                key={item.firebaseId || item.id}
                className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                      <Phone size={15} className="text-primary" />
                      {item.nome}
                    </h3>
                    {item.marca && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">
                        {item.marca}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-muted-foreground">Telefone:</span>
                    <span className="font-black text-primary text-sm">{item.telefone}</span>
                  </div>
                  {item.setor && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-muted-foreground">Setor:</span>
                      <span className="font-semibold text-foreground">{item.setor}</span>
                    </div>
                  )}
                  {item.observacoes && (
                    <p className="text-[11px] text-muted-foreground font-medium pt-1 border-t border-border/50 mt-2">
                      {item.observacoes}
                    </p>
                  )}
                </div>

                {/* BOTÕES DE AÇÃO RÁPIDA MOBILE */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <a
                    href={getTelLink(item.telefone)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all"
                  >
                    <PhoneCall size={14} />
                    <span>Ligar</span>
                  </a>

                  <a
                    href={getWppLink(item.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#25D366] text-white font-bold text-xs shadow-2xs active:scale-95 transition-all"
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR TELEFONE */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header do Modal */}
            <div className="p-4 border-b border-border bg-primary/5 flex items-center justify-between">
              <h3 className="font-extrabold text-base uppercase text-foreground flex items-center gap-2">
                <Phone size={18} className="text-primary" />
                {editingItem ? 'Editar Telefone' : 'Novo Telefone'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                  Nome / Contato <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: João da Silva / Suporte Técnico"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-border rounded-xl bg-background focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                    Marca / Empresa
                  </label>
                  <input
                    type="text"
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    placeholder="Ex: Ambev / Dell"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold border border-border rounded-xl bg-background focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                    Telefone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold border border-border rounded-xl bg-background focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                  Setor (Opcional)
                </label>
                <input
                  type="text"
                  value={form.setor}
                  onChange={(e) => setForm({ ...form, setor: e.target.value })}
                  placeholder="Ex: TI / Comercial / Manutenção"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-border rounded-xl bg-background focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows="2"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Ex: Falar preferencialmente no período da manhã"
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-border rounded-xl bg-background focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-extrabold uppercase rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-5 py-2.5 text-xs font-extrabold uppercase rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  <span>{editingItem ? 'Salvar Alterações' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
