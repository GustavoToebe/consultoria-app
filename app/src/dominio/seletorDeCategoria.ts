/**
 * Regra pura do seletor de categoria (`treinador/SeletorDeCategoria`, usado na Vitrine e na Biblioteca › Outros): o que o
 * texto digitado na busca vira. O filtro da lista (sem acento e sem caixa) é o da `EscolhaSuspensa`
 * (`dominio/escolhaSuspensa.filtrarOpcoesSuspensas`); aqui só mora o "escolher a que já existe ou criar". Sem React.
 */
import { semAcento } from './telas';

/** A primeira opção do seletor e o grupo dos itens sem categoria, nas duas telas. */
export const SEM_CATEGORIA = 'Sem categoria';

/** O texto como nome de categoria: espaços sobrando (nas pontas e repetidos no meio) saem. */
export const limparNomeDaCategoria = (texto: string): string => texto.replace(/\s+/g, ' ').trim();

const chave = (nome: string): string => semAcento(limparNomeDaCategoria(nome));

/**
 * O que o texto digitado vira: vazio = `null` (nada a oferecer); igual a uma categoria que já existe (sem acento, caixa nem
 * espaços sobrando) = essa categoria, com a grafia dela, para não nascer outra repetida; senão, o nome limpo para criar.
 */
export function categoriaDoDigitado<C extends { nome: string }>(texto: string, categorias: readonly C[]): { existente: C } | { nova: string } | null {
  const nome = limparNomeDaCategoria(texto);
  if (!nome) return null;
  const existente = categorias.find((c) => chave(c.nome) === chave(nome));
  return existente ? { existente } : { nova: nome };
}
