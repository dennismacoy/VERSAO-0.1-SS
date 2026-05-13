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
