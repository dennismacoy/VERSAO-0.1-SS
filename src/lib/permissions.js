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

  // Ações de Recursos & Botões
  DELETE_ITEMS: 'delete_items',
  EDIT_ITEMS: 'edit_items',
  EDIT_DATES: 'edit_dates',
  CREATE_ITEMS: 'create_items',
  EXPORT_REPORTS: 'export_reports',
  SYNC_MASTER: 'sync_master'
};

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

// MATRIZ DE PERMISSÕES PADRÃO MAPEADA POR ROLE
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: ['*'], // Wildcard: acesso irrestrito a todas as ações

  gerente: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CONSULTA,
    PERMISSIONS.VIEW_REQUISICOES,
    PERMISSIONS.VIEW_PREVENDA,
    PERMISSIONS.VIEW_SEPARACAO,
    PERMISSIONS.VIEW_GESTAO_ADMIN,
    PERMISSIONS.VIEW_RELATORIOS,
    PERMISSIONS.VIEW_CONFIGURACOES,
    PERMISSIONS.DELETE_ITEMS,
    PERMISSIONS.EDIT_ITEMS,
    PERMISSIONS.EDIT_DATES,
    PERMISSIONS.CREATE_ITEMS,
    PERMISSIONS.EXPORT_REPORTS
  ],

  administrativo: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CONSULTA,
    PERMISSIONS.VIEW_PREVENDA,
    PERMISSIONS.VIEW_GESTAO_ADMIN,
    PERMISSIONS.VIEW_RELATORIOS,
    PERMISSIONS.VIEW_CONFIGURACOES,
    PERMISSIONS.DELETE_ITEMS,
    PERMISSIONS.EDIT_ITEMS,
    PERMISSIONS.EDIT_DATES,
    PERMISSIONS.CREATE_ITEMS,
    PERMISSIONS.EXPORT_REPORTS
  ],

  vendedor: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CONSULTA,
    PERMISSIONS.VIEW_PREVENDA,
    PERMISSIONS.VIEW_GESTAO_ADMIN,
    PERMISSIONS.VIEW_CONFIGURACOES,
    PERMISSIONS.EDIT_ITEMS,
    PERMISSIONS.EDIT_DATES,
    PERMISSIONS.CREATE_ITEMS,
    PERMISSIONS.EXPORT_REPORTS
  ],

  repositor: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CONSULTA,
    PERMISSIONS.VIEW_SEPARACAO,
    PERMISSIONS.VIEW_GESTAO_ADMIN,
    PERMISSIONS.VIEW_CONFIGURACOES,
    PERMISSIONS.EDIT_ITEMS,
    PERMISSIONS.CREATE_ITEMS
  ],

  operador: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CONSULTA,
    PERMISSIONS.VIEW_GESTAO_ADMIN,
    PERMISSIONS.EDIT_ITEMS
  ],

  clientes: [
    PERMISSIONS.VIEW_PEDIDOS,
    PERMISSIONS.VIEW_CONFIGURACOES
  ]
};

/**
 * Verifica se uma dada Role possui permissão para executar uma Action.
 * 
 * @param {string} userRole - Role do usuário logado (ex: 'admin', 'gerente', 'operador')
 * @param {string|string[]} action - Permissão necessária (ex: 'delete_items') ou array de permissões
 * @param {Object} [customMatrix] - Matriz opcional vinda do Firebase ou contexto
 * @returns {boolean} true se permitido, false caso contrário
 */
export const hasRolePermission = (userRole, action, customMatrix = null) => {
  if (!userRole) return false;

  const role = userRole.trim().toLowerCase();

  // Admin sempre possui acesso total
  if (role === 'admin') return true;

  // Trata array de ações (se qualquer uma for permitida, retorna true)
  if (Array.isArray(action)) {
    return action.some(act => hasRolePermission(userRole, act, customMatrix));
  }

  // Normaliza o nome da ação se for legado
  const canonicalAction = LEGACY_ACTION_MAP[action] || action;

  // 1. Se existir uma matriz customizada vinda do Firebase ou estado
  if (customMatrix && typeof customMatrix === 'object') {
    // Se a matriz customizada contiver a role diretamente como chave
    if (customMatrix[role] && Array.isArray(customMatrix[role])) {
      const allowedActions = customMatrix[role];
      if (allowedActions.includes('*') || allowedActions.includes(canonicalAction)) {
        return true;
      }
    }

    // Compatibilidade reversa: se a matriz customizada for formato { action: [roles] }
    const allowedRolesForAction = customMatrix[canonicalAction] || customMatrix[action];
    if (Array.isArray(allowedRolesForAction)) {
      if (allowedRolesForAction.some(r => r.toLowerCase() === role)) {
        return true;
      }
    }
  }

  // 2. Consulta na Matriz Padrão de Roles
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(canonicalAction);
};
