/**
 * Matriz de Permissões do Sistema
 * Define todas as ações do sistema e o mapeamento padrão por Perfil / Role.
 */

// Catálogo completo de permissões / ações do sistema
export const PERMISSIONS = {
  // Rotas de Páginas
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_CONSULTA: 'view_consulta',
  VIEW_PEDIDOS: 'view_pedidos',
  VIEW_REQUISICOES: 'view_requisicoes',
  VIEW_PREVENDA: 'view_prevenda',
  VIEW_SEPARACAO: 'view_separacao',
  VIEW_GESTAO_ADMIN: 'view_gestao_admin',
  VIEW_RELATORIOS: 'view_relatorios',
  VIEW_CONFIGURACOES: 'view_configuracoes',

  // Abas de Gestão Administrativa
  GESTAO_TAB_TASKS: 'gestao_tab_tasks',
  GESTAO_TAB_PREVENTIVE: 'gestao_tab_preventive',
  GESTAO_TAB_IT: 'gestao_tab_it',
  GESTAO_TAB_CONFIG: 'gestao_tab_config',

  // Abas de Relatórios
  RELATORIOS_TAB_GERAL: 'relatorios_tab_geral',
  RELATORIOS_TAB_AVANCADO: 'relatorios_tab_avancado',

  // Abas de Configurações
  CONFIG_TAB_PERMISSOES: 'config_tab_permissoes',
  CONFIG_TAB_SYNC: 'config_tab_sync',
  CONFIG_TAB_SENHA: 'config_tab_senha',

  // Abas e Modos de Pré-Venda
  PREVENDA_TAB_NOVA: 'prevenda_tab_nova',
  PREVENDA_TAB_HISTORICO: 'prevenda_tab_historico',
  PREVENDA_VIEW_ALL: 'prevenda_view_all',

  // Cards do Dashboard
  DASHBOARD_CARD_SEPARACOES: 'dashboard_card_separacoes',
  DASHBOARD_CARD_REQUISICOES: 'dashboard_card_requisicoes',
  DASHBOARD_CARD_ISV: 'dashboard_card_isv',
  DASHBOARD_CARD_IDADE: 'dashboard_card_idade',
  DASHBOARD_CARD_PALETES: 'dashboard_card_paletes',
  DASHBOARD_CARD_ESTOQUE: 'dashboard_card_estoque',

  // Seções da Consulta
  CONSULTA_SHEET_GERAL: 'consulta_sheet_geral',
  CONSULTA_SHEET_EXTRAS: 'consulta_sheet_extras',

  // Ações de Recursos & Botões
  DELETE_ITEMS: 'delete_items',
  EDIT_ITEMS: 'edit_items',
  EDIT_DATES: 'edit_dates',
  CREATE_ITEMS: 'create_items',
  EXPORT_REPORTS: 'export_reports',
  SYNC_MASTER: 'sync_master',
  ALLOW_SHEETS_SYNC: 'allow_sheets_sync'
};

// Estrutura hierárquica por página e suas respectivas abas / sub-módulos
export const PAGE_PERMISSIONS_STRUCTURE = [
  {
    pageId: PERMISSIONS.VIEW_DASHBOARD,
    legacyId: 'Acesso Dashboard',
    label: 'Dashboard',
    tabs: [
      { id: PERMISSIONS.DASHBOARD_CARD_SEPARACOES, legacyId: 'Ver Separacoes Abertas', label: 'Card: Separações Abertas' },
      { id: PERMISSIONS.DASHBOARD_CARD_REQUISICOES, legacyId: 'Ver Requisicoes Pendentes', label: 'Card: Requisições Pendentes' },
      { id: PERMISSIONS.DASHBOARD_CARD_ISV, legacyId: 'Ver Itens ISV', label: 'Card: Itens ISV' },
      { id: PERMISSIONS.DASHBOARD_CARD_IDADE, legacyId: 'Ver Itens Idade', label: 'Card: Itens por Idade' },
      { id: PERMISSIONS.DASHBOARD_CARD_PALETES, legacyId: 'Ver Total Paletes', label: 'Card: Total de Paletes' },
      { id: PERMISSIONS.DASHBOARD_CARD_ESTOQUE, legacyId: 'Ver Valor Estoque', label: 'Card: Valor do Estoque' }
    ]
  },
  {
    pageId: PERMISSIONS.VIEW_CONSULTA,
    legacyId: 'Acesso Consulta',
    label: 'Consulta de Estoque',
    tabs: [
      { id: PERMISSIONS.CONSULTA_SHEET_GERAL, legacyId: 'Ver Card Geral', label: 'Detalhes Gerais do Produto' },
      { id: PERMISSIONS.CONSULTA_SHEET_EXTRAS, legacyId: 'Ver Card Extras', label: 'Informações Extras do Produto' }
    ]
  },
  {
    pageId: PERMISSIONS.VIEW_PREVENDA,
    legacyId: 'Acesso Pre-Venda',
    label: 'Pré-Venda',
    tabs: [
      { id: PERMISSIONS.PREVENDA_TAB_NOVA, legacyId: 'Criar Prevenda', label: 'Formulário: Criar Pré-Venda' },
      { id: PERMISSIONS.PREVENDA_TAB_HISTORICO, legacyId: 'Ver Historico Prevenda', label: 'Histórico de Pré-Vendas' },
      { id: PERMISSIONS.PREVENDA_VIEW_ALL, legacyId: 'Ver Todas Prevendas', label: 'Ver Pré-Vendas de Todos os Vendedores' }
    ]
  },
  {
    pageId: PERMISSIONS.VIEW_SEPARACAO,
    legacyId: 'Acesso Separacao',
    label: 'Separação & Picking',
    tabs: [
      { id: PERMISSIONS.EDIT_ITEMS, legacyId: 'Atribuir Separador', label: 'Atribuir Separadores aos Pedidos' }
    ]
  },
  {
    pageId: PERMISSIONS.VIEW_GESTAO_ADMIN,
    legacyId: 'Acesso Gestao Administrativa',
    label: 'Gestão Administrativa',
    tabs: [
      { id: PERMISSIONS.GESTAO_TAB_TASKS, legacyId: 'Aba Tarefas Diarias', label: 'Aba: Tarefas Diárias' },
      { id: PERMISSIONS.GESTAO_TAB_PREVENTIVE, legacyId: 'Aba Manutencao Preventiva', label: 'Aba: Manutenção Preventiva' },
      { id: PERMISSIONS.GESTAO_TAB_IT, legacyId: 'Aba TI e Suporte', label: 'Aba: TI & Suporte' },
      { id: PERMISSIONS.GESTAO_TAB_CONFIG, legacyId: 'Aba Config Setores', label: 'Aba: Configuração de Setores/Categorias' }
    ]
  },
  {
    pageId: PERMISSIONS.VIEW_RELATORIOS,
    legacyId: 'Acesso Relatorios',
    label: 'Relatórios',
    tabs: [
      { id: PERMISSIONS.RELATORIOS_TAB_GERAL, legacyId: 'Aba Relatorio Geral', label: 'Aba: Relatório Geral' },
      { id: PERMISSIONS.RELATORIOS_TAB_AVANCADO, legacyId: 'Aba Analise Avancada', label: 'Aba: Análise Avançada & Exportação' }
    ]
  },
  {
    pageId: PERMISSIONS.VIEW_CONFIGURACOES,
    legacyId: 'Acesso Configuracoes',
    label: 'Configurações',
    tabs: [
      { id: PERMISSIONS.CONFIG_TAB_PERMISSOES, legacyId: 'Aba Controle Permissoes', label: 'Aba: Controle de Acessos & Usuários' },
      { id: PERMISSIONS.CONFIG_TAB_SYNC, legacyId: 'Acessar Sincronização Master', label: 'Aba: Sincronização Master' },
      { id: PERMISSIONS.CONFIG_TAB_SENHA, legacyId: 'Aba Trocar Senha', label: 'Aba: Trocar Senha' }
    ]
  },
  {
    pageId: PERMISSIONS.VIEW_PEDIDOS,
    legacyId: 'Acesso Pedidos',
    label: 'Pedidos B2B',
    tabs: []
  },
  {
    pageId: PERMISSIONS.VIEW_REQUISICOES,
    legacyId: 'Acesso Requisições',
    label: 'Requisições de Estoque',
    tabs: []
  }
];

// Lista catalogada e amigável com labels de todas as permissões do sistema
export const ALL_PERMISSIONS_LIST = [
  { id: PERMISSIONS.VIEW_DASHBOARD, label: 'Acesso Dashboard', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_CONSULTA, label: 'Acesso Consulta', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_PEDIDOS, label: 'Acesso Pedidos', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_REQUISICOES, label: 'Acesso Requisições', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_PREVENDA, label: 'Acesso Pré-Venda', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_SEPARACAO, label: 'Acesso Separação', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_GESTAO_ADMIN, label: 'Acesso Gestão Administrativa', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_RELATORIOS, label: 'Acesso Relatórios', category: 'Páginas' },
  { id: PERMISSIONS.VIEW_CONFIGURACOES, label: 'Acesso Configurações', category: 'Páginas' },

  // Abas internas
  { id: PERMISSIONS.GESTAO_TAB_TASKS, label: 'Gestão: Tarefas Diárias', category: 'Abas' },
  { id: PERMISSIONS.GESTAO_TAB_PREVENTIVE, label: 'Gestão: Manutenção Preventiva', category: 'Abas' },
  { id: PERMISSIONS.GESTAO_TAB_IT, label: 'Gestão: TI & Suporte', category: 'Abas' },
  { id: PERMISSIONS.GESTAO_TAB_CONFIG, label: 'Gestão: Configuração de Setores', category: 'Abas' },

  { id: PERMISSIONS.RELATORIOS_TAB_GERAL, label: 'Relatórios: Visão Geral', category: 'Abas' },
  { id: PERMISSIONS.RELATORIOS_TAB_AVANCADO, label: 'Relatórios: Análise Avançada', category: 'Abas' },

  { id: PERMISSIONS.CONFIG_TAB_PERMISSOES, label: 'Config: Permissões & Usuários', category: 'Abas' },
  { id: PERMISSIONS.CONFIG_TAB_SYNC, label: 'Config: Sincronização Master', category: 'Abas' },
  { id: PERMISSIONS.CONFIG_TAB_SENHA, label: 'Config: Trocar Senha', category: 'Abas' },

  { id: PERMISSIONS.PREVENDA_TAB_NOVA, label: 'Pré-Venda: Criar Nova', category: 'Abas' },
  { id: PERMISSIONS.PREVENDA_TAB_HISTORICO, label: 'Pré-Venda: Histórico', category: 'Abas' },

  { id: PERMISSIONS.ALLOW_SHEETS_SYNC, label: 'Acesso à Planilha Base (Google Sheets)', category: 'Integrações', highlight: true },
  { id: PERMISSIONS.CREATE_ITEMS, label: 'Criar Registros / Tarefas', category: 'Ações' },
  { id: PERMISSIONS.EDIT_ITEMS, label: 'Editar Registros / Itens', category: 'Ações' },
  { id: PERMISSIONS.EDIT_DATES, label: 'Editar Datas dos Registros', category: 'Ações' },
  { id: PERMISSIONS.DELETE_ITEMS, label: 'Excluir Registros / Itens', category: 'Ações' },
  { id: PERMISSIONS.EXPORT_REPORTS, label: 'Gerar PDF / Exportar CSV', category: 'Ações' },
  { id: PERMISSIONS.SYNC_MASTER, label: 'Sincronização Master', category: 'Ações' }
];

// Mapeamento de chaves legadas para as novas ações canônicas (backward compatibility)
export const LEGACY_ACTION_MAP = {
  'Acesso Dashboard': PERMISSIONS.VIEW_DASHBOARD,
  'Acesso Consulta': PERMISSIONS.VIEW_CONSULTA,
  'Acesso Pedidos': PERMISSIONS.VIEW_PEDIDOS,
  'Acesso Requisições': PERMISSIONS.VIEW_REQUISICOES,
  'Acesso Pre-Venda': PERMISSIONS.VIEW_PREVENDA,
  'Acesso Separacao': PERMISSIONS.VIEW_SEPARACAO,
  'Acesso Gestao Administrativa': PERMISSIONS.VIEW_GESTAO_ADMIN,
  'gestao_administrativa': PERMISSIONS.VIEW_GESTAO_ADMIN,
  'Acesso Relatorios': PERMISSIONS.VIEW_RELATORIOS,
  'Acesso Configuracoes': PERMISSIONS.VIEW_CONFIGURACOES,
  'Acessar Sincronização Master': PERMISSIONS.SYNC_MASTER,
  'Botao Gerar PDF': PERMISSIONS.EXPORT_REPORTS,
  'Criar Prevenda': PERMISSIONS.CREATE_ITEMS
};

// MATRIZ DE PERMISSÕES PADRÃO MAPEADA POR ROLE (Apenas 'admin' é nativo)
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: ['*'] // Admin é a única role nativa do sistema com acesso irrestrito por padrão
};

/**
 * Verifica se uma dada Role possui permissão para executar uma Action.
 * NENHUMA VALIDAÇÃO HARDCODED É REALIZADA (ex: `role === 'admin'`).
 * Toda a validação provém única e exclusivamente da matriz dinâmica de permissões.
 * 
 * @param {string} userRole - Role do usuário logado (ex: 'admin', 'gerente', 'operador')
 * @param {string|string[]} action - Permissão necessária (ex: 'delete_items') ou array de permissões
 * @param {Object} [customMatrix] - Matriz opcional vinda do Firebase ou contexto
 * @returns {boolean} true se permitido, false caso contrário
 */
export const hasRolePermission = (userRole, action, customMatrix = null) => {
  if (!userRole) return false;

  const role = userRole.trim().toLowerCase();

  // Trata array de ações (se qualquer uma for permitida, retorna true)
  if (Array.isArray(action)) {
    return action.some(act => hasRolePermission(userRole, act, customMatrix));
  }

  // Normaliza o nome da ação se for legado
  const canonicalAction = LEGACY_ACTION_MAP[action] || action;

  // 1. Se existir uma matriz customizada vinda do Firebase ou estado
  if (customMatrix && typeof customMatrix === 'object') {
    // Caso A: Matriz formato por Role { [role]: [actions] }
    if (customMatrix[role] && Array.isArray(customMatrix[role])) {
      const allowedActions = customMatrix[role];
      return allowedActions.includes('*') || allowedActions.includes(canonicalAction) || allowedActions.includes(action);
    }

    // Caso B: Matriz formato por Ação { [action]: [roles] }
    const allowedRolesForAction = customMatrix[canonicalAction] || customMatrix[action];
    if (Array.isArray(allowedRolesForAction)) {
      return allowedRolesForAction.some(r => String(r).toLowerCase() === role);
    }
  }

  // 2. Consulta na Matriz Padrão de Roles (Fallback caso a role não esteja customizada na matriz)
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(canonicalAction) || rolePermissions.includes(action);
};

// LISTA DE PRIORIDADE DE PÁGINAS PARA ROTA INICIAL DINÂMICA
export const PAGE_PRIORITY_LIST = [
  { path: '/', action: PERMISSIONS.VIEW_DASHBOARD },
  { path: '/consulta', action: PERMISSIONS.VIEW_CONSULTA },
  { path: '/pedidos', action: PERMISSIONS.VIEW_PEDIDOS },
  { path: '/pre-venda', action: PERMISSIONS.VIEW_PREVENDA },
  { path: '/separacao', action: PERMISSIONS.VIEW_SEPARACAO },
  { path: '/gestao-administrativa', action: PERMISSIONS.VIEW_GESTAO_ADMIN },
  { path: '/relatorios', action: PERMISSIONS.VIEW_RELATORIOS },
  { path: '/configuracoes', action: PERMISSIONS.VIEW_CONFIGURACOES }
];

/**
 * Retorna o path (caminho) da primeira página que a role do usuário tem permissão para visualizar.
 * Se não tiver permissão para nenhuma, retorna '/sem-acesso'.
 */
export const getDefaultRoute = (userRole, customMatrix = null) => {
  if (!userRole) return '/login';

  for (const page of PAGE_PRIORITY_LIST) {
    if (hasRolePermission(userRole, page.action, customMatrix)) {
      return page.path;
    }
  }

  return '/sem-acesso';
};

