import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasRolePermission } from '../lib/permissions';

/**
 * Hook customizado para verificar se o usuário logado possui permissão para uma determinada ação ou recurso.
 * 
 * @param {string|string[]} action - Ação ou lista de ações a verificar (ex: 'delete_items', 'view_gestao_admin')
 * @returns {boolean} true se o usuário tiver permissão, false caso contrário
 * 
 * Exemplo de uso:
 * const canDelete = usePermission('delete_items');
 * const canEdit = usePermission('edit_items');
 */
export default function usePermission(action) {
  const { role, permissions } = useAuth();

  const hasPermission = useMemo(() => {
    if (!role) return false;
    return hasRolePermission(role, action, permissions);
  }, [role, action, permissions]);

  return hasPermission;
}

export { usePermission };
