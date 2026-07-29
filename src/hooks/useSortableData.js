import { useState, useMemo } from 'react';

/**
 * Hook customizado para ordenação de arrays de dados.
 * 
 * @param {Array} items - Lista de itens a serem ordenados
 * @param {Object} defaultConfig - Configuração padrão { key: 'name', direction: 'asc' }
 */
export default function useSortableData(items = [], defaultConfig = null) {
  const [sortConfig, setSortConfig] = useState(defaultConfig);

  const sortedItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    let sortableItems = [...items];

    if (sortConfig !== null && sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = getNestedValue(a, sortConfig.key);
        let bValue = getNestedValue(b, sortConfig.key);

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        // Trata ordenação de datas (strings no formato ISO 'YYYY-MM-DD')
        if (typeof aValue === 'string' && typeof bValue === 'string' && isDateString(aValue) && isDateString(bValue)) {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }

        // Trata números
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Trata strings gerais
        const strA = String(aValue).toLowerCase();
        const strB = String(bValue).toLowerCase();

        const comp = strA.localeCompare(strB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? comp : -comp;
      });
    }

    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig, setSortConfig };
}

// Auxiliar para pegar propriedades simples ou aninhadas
function getNestedValue(obj, key) {
  if (!obj) return null;
  if (typeof key === 'function') return key(obj);
  return obj[key];
}

// Verifica se a string tem formato de data ISO 'YYYY-MM-DD'
function isDateString(val) {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val);
}
