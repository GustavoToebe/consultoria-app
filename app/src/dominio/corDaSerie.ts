import type { PapelDaSerie } from '../api/tipos';
import type { ChaveDeIdentificacao } from '../tema/tokens';

/**
 * Qual cor de identificação (Frente G, D9 e D13) vai num tipo de série, numa divisão do treino ou numa refeição. Só
 * devolve a CHAVE da paleta; o tom do tema em uso vem de `useTema().identificacao[chave]` (`cor` para texto, ícone e
 * barra, `fundo` para o selo). A cor nunca é a única informação: o selo de texto continua (D7).
 */

/** Os quatro tipos padrão da metodologia, pelo código (D9: por tipo, não só por papel). */
const COR_DO_TIPO: Readonly<Record<string, ChaveDeIdentificacao>> = {
  WARM_UP: 'CIANO',
  FEEDER: 'AZUL',
  WORKING: 'INDIGO',
  BACK_OFF: 'MAGENTA',
};

/** Tipo criado pelo treinador usa a cor do papel; "Outro" fica sem cor (selo neutro). */
const COR_DO_PAPEL: Readonly<Record<PapelDaSerie, ChaveDeIdentificacao | null>> = {
  AQUECIMENTO: 'CIANO',
  PREPARACAO: 'AZUL',
  TRABALHO: 'INDIGO',
  POS_TRABALHO: 'MAGENTA',
  OUTRO: null,
};

/** A, B e C bem diferentes entre si (azul, magenta, ciano); depois violeta e índigo, em ciclo (prévia aprovada). */
const CORES_DAS_DIVISOES: readonly ChaveDeIdentificacao[] = ['AZUL', 'MAGENTA', 'CIANO', 'VIOLETA', 'INDIGO'];

/** Refeições na ordem do dia (D14, prévia aprovada), em ciclo. */
const CORES_DAS_REFEICOES: readonly ChaveDeIdentificacao[] = ['CIANO', 'AZUL', 'VIOLETA', 'MAGENTA', 'INDIGO'];

/**
 * Cor de um tipo de série: os quatro códigos padrão têm cor própria; qualquer outro código (tipo criado pelo treinador)
 * cai na cor do papel. Sem código conhecido e sem papel (ou papel "Outro"), `null` = sem cor.
 */
export function corDoTipoDeSerie(
  codigo: string | null | undefined,
  papel: PapelDaSerie | null | undefined,
): ChaveDeIdentificacao | null {
  if (codigo && Object.hasOwn(COR_DO_TIPO, codigo)) return COR_DO_TIPO[codigo];
  return papel && Object.hasOwn(COR_DO_PAPEL, papel) ? COR_DO_PAPEL[papel] : null;
}

function emCiclo(cores: readonly ChaveDeIdentificacao[], indice: number): ChaveDeIdentificacao {
  const i = Number.isInteger(indice) && indice >= 0 ? indice : 0;
  return cores[i % cores.length];
}

/** Cor da divisão pelo índice (0 = A). Índice inválido conta como 0. */
export function corDaDivisao(indice: number): ChaveDeIdentificacao {
  return emCiclo(CORES_DAS_DIVISOES, indice);
}

/** Cor da refeição pelo índice na dieta (0 = a primeira). Índice inválido conta como 0. */
export function corDaRefeicao(indice: number): ChaveDeIdentificacao {
  return emCiclo(CORES_DAS_REFEICOES, indice);
}
