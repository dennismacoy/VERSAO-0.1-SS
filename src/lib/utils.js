import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Determina se um item tem estoque com base na string de estoque.
 * Formatos esperados:
 *   "0 CXA (12) + 12"  → true  (12 avulsas)
 *   "0 CXA (24)"       → false (0 caixas, 0 avulsas)
 *   "1 FDO (32)"       → true  (1 fardo)
 *   "3 CXA (12) + 5"   → true
 *
 * Regra: Se a quantidade principal (antes do tipo de embalagem) > 0
 *        OU a quantidade avulsa (depois do "+") > 0, retorna true.
 *
 * Também aceita valores numéricos simples (ex: "150" ou 150).
 *
 * @param {string|number} estoqueString
 * @returns {boolean}
 */
export function parseEstoque(estoqueString) {
  if (estoqueString === null || estoqueString === undefined || estoqueString === '') {
    return false;
  }

  // Se for um número puro, basta checar > 0
  if (typeof estoqueString === 'number') {
    return estoqueString > 0;
  }

  const str = String(estoqueString).trim();

  // Tenta interpretar como número simples primeiro
  const asNum = Number(str);
  if (!isNaN(asNum) && str.length > 0 && !/[A-Za-z]/.test(str)) {
    return asNum > 0;
  }

  // Regex para o formato "QTD TIPO (capacidade) + avulsas"
  // Ex: "0 CXA (12) + 12", "1 FDO (32)", "3 CXA (12) + 5"
  const match = str.match(/^(\d+)\s*[A-Za-zÀ-ÿ]+/);
  const qtdPrincipal = match ? parseInt(match[1], 10) : 0;

  // Busca avulsas após o "+"
  const plusMatch = str.match(/\+\s*(\d+)/);
  const qtdAvulsa = plusMatch ? parseInt(plusMatch[1], 10) : 0;

  return qtdPrincipal > 0 || qtdAvulsa > 0;
}

/**
 * Extrai o valor de estoque bruto do objeto de produto sem que o operador || pule o número 0.
 * @param {object} item
 * @returns {string|number}
 */
export function getItemEstoqueVal(item) {
  if (!item || typeof item !== 'object') return 0;
  if (item.ESTOQUE !== undefined && item.ESTOQUE !== null && item.ESTOQUE !== '') return item.ESTOQUE;
  if (item.estoque !== undefined && item.estoque !== null && item.estoque !== '') return item.estoque;
  if (item.QTE !== undefined && item.QTE !== null && item.QTE !== '') return item.QTE;
  return 0;
}

/**
 * Determina estritamente se um produto possui estoque no sistema (maior que zero).
 * Retorna false para estoque zero, nulo, vazio ou negativo.
 * @param {object|string|number} itemOrString
 * @returns {boolean}
 */
export function isEstoquePositivo(itemOrString) {
  if (itemOrString === null || itemOrString === undefined || itemOrString === '') return false;
  
  const val = typeof itemOrString === 'object' ? getItemEstoqueVal(itemOrString) : itemOrString;
  
  const num = getEstoqueNumerico(val);
  if (num <= 0) return false;

  return parseEstoque(val);
}

/**
 * Extrai a quantidade numérica total de uma string de estoque.
 * "0 CXA (12) + 12" → 12 (0*12 + 12 = 12)
 * "1 FDO (32)"      → 32 (1*32 = 32)
 * "3 CXA (12) + 5"  → 41 (3*12 + 5 = 41)
 * "150"             → 150
 *
 * @param {string|number} estoqueString
 * @returns {number}
 */
export function getEstoqueNumerico(estoqueString) {
  if (estoqueString === null || estoqueString === undefined || estoqueString === '') {
    return 0;
  }

  if (typeof estoqueString === 'number') {
    return estoqueString;
  }

  const str = String(estoqueString).trim();

  // Número simples
  const asNum = Number(str);
  if (!isNaN(asNum) && str.length > 0 && !/[A-Za-z]/.test(str)) {
    return asNum;
  }

  // Formato complexo
  const mainMatch = str.match(/^(\d+)\s*[A-Za-zÀ-ÿ]+/);
  const capMatch = str.match(/\((\d+)\)/);
  const plusMatch = str.match(/\+\s*(\d+)/);

  const qtdPrincipal = mainMatch ? parseInt(mainMatch[1], 10) : 0;
  const capacidade = capMatch ? parseInt(capMatch[1], 10) : 1;
  const qtdAvulsa = plusMatch ? parseInt(plusMatch[1], 10) : 0;

  return (qtdPrincipal * capacidade) + qtdAvulsa;
}

/**
 * Formata um valor como moeda brasileira (BRL).
 * @param {number} val
 * @returns {string}
 */
export function formatCurrency(val) {
  const num = Number(val);
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

/**
 * Converte valores numéricos ou strings formatadas (ex: "R$ 1.500,00", "1.500,50", "25,00")
 * em um número float válido em JavaScript para ordenações matemáticas e cálculos.
 * @param {string|number} val
 * @returns {number}
 */
export function parseNumericValue(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim().replace(/R\$\s?/gi, '').replace(/\s+/g, '');
  if (!str) return 0;

  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if ((str.match(/\./g) || []).length > 1) {
    str = str.replace(/\./g, '');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

