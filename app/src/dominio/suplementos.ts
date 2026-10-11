import type { SuplementoDaBiblioteca } from '../api/tipos';
import { SEM_DADO } from './formatos';

/**
 * Regras de apresentação dos suplementos da biblioteca (sem tela). O suplemento é só nome, marca, categoria, porção,
 * sabores e link: nada aqui soma, calcula nem sugere dose. Ausência de dado é "—".
 */

export const MAX_SABORES = 20;

/** "2 dosadores (15g) · 30 porções". Número puro vira "N porções"; texto ("cerca de 26") ganha "porções". */
export function descricaoDaPorcao(s: Pick<SuplementoDaBiblioteca, 'porcao' | 'porcoesPorEmbalagem'>): string {
  const porcao = s.porcao?.trim() || SEM_DADO;
  const total = s.porcoesPorEmbalagem?.trim();
  if (!total) return porcao;
  const rotulo = /^\d+$/.test(total) ? (total === '1' ? '1 porção' : `${total} porções`) : `${total} porções`;
  return `${porcao} · ${rotulo}`;
}

export function saboresParaTela(s: Pick<SuplementoDaBiblioteca, 'sabores'>): string {
  return s.sabores.length ? s.sabores.join(', ') : SEM_DADO;
}

/** Marca e categoria numa linha só ("Heavy Suppz · Whey"); o que faltar some. */
export function marcaECategoria(s: Pick<SuplementoDaBiblioteca, 'marca' | 'categoria'>): string {
  const partes = [s.marca?.trim(), s.categoria?.trim()].filter((p): p is string => !!p);
  return partes.length ? partes.join(' · ') : SEM_DADO;
}

/** Texto digitado separado por vírgula → lista sem vazios nem repetidos (ignora caixa), no máximo `MAX_SABORES`. */
export function saboresDoTexto(texto: string): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const bruto of texto.split(',')) {
    const s = bruto.trim().replace(/\s+/g, ' ');
    const chave = s.toLocaleLowerCase('pt-BR');
    if (!s || vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(s);
  }
  return lista.slice(0, MAX_SABORES);
}

export function saboresParaCampo(sabores: string[]): string {
  return sabores.join(', ');
}

/** Nome para a linha de suplementação da dieta: "<nome> (<marca>)". */
export function nomeParaDieta(s: Pick<SuplementoDaBiblioteca, 'nome' | 'marca'>): string {
  const marca = s.marca?.trim();
  return marca ? `${s.nome} (${marca})` : s.nome;
}

/** Busca sem acento e sem caixa, no nome e na marca; categoria vazia = todas. */
export function filtrarSuplementos(lista: SuplementoDaBiblioteca[], busca: string, categoria: string): SuplementoDaBiblioteca[] {
  const termo = semAcentoMinusculo(busca);
  return lista.filter((s) => {
    if (categoria && s.categoria !== categoria) return false;
    return !termo || semAcentoMinusculo(`${s.nome} ${s.marca ?? ''}`).includes(termo);
  });
}

export function categoriasDe(lista: Pick<SuplementoDaBiblioteca, 'categoria'>[]): string[] {
  return [...new Set(lista.map((s) => s.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function semAcentoMinusculo(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
