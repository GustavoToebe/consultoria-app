import { semAcento } from './telas';

/** Seções do catálogo de componentes do Montador, na ordem em que aparecem. */
export type SecaoDoCatalogo =
  | 'camposDeTexto'
  | 'escolhas'
  | 'botoes'
  | 'avisosEEstados'
  | 'listasETabelas'
  | 'estrutura'
  | 'numerosEGraficos';

export const SECOES_DO_CATALOGO: readonly { chave: SecaoDoCatalogo; titulo: string }[] = [
  { chave: 'camposDeTexto', titulo: 'Campos de texto' },
  { chave: 'escolhas', titulo: 'Escolhas' },
  { chave: 'botoes', titulo: 'Botões' },
  { chave: 'avisosEEstados', titulo: 'Avisos e estados' },
  { chave: 'listasETabelas', titulo: 'Listas e tabelas' },
  { chave: 'estrutura', titulo: 'Estrutura (cartão, abas, faixa, folha)' },
  { chave: 'numerosEGraficos', titulo: 'Números e gráficos' },
];

/** O que a busca e o agrupamento precisam de cada exemplo (o desenho fica em `montador/catalogoDeComponentes`). */
export interface ExemploDoCatalogo {
  id: string;
  /** Nome do componente como aparece no título ("Campo"). */
  componente: string;
  /** Estado mostrado ("com erro"). */
  estado: string;
  secao: SecaoDoCatalogo;
  /** Onde o componente mora, a partir de `app/src/` ("ui/Campo"). */
  caminho: string;
  /** Props usadas no exemplo, em texto curto. */
  props: string;
}

export interface GrupoDoCatalogo<E extends ExemploDoCatalogo> {
  secao: SecaoDoCatalogo;
  titulo: string;
  exemplos: E[];
}

/** Título do cartão: "Campo — com erro". */
export function tituloDoExemplo(exemplo: Pick<ExemploDoCatalogo, 'componente' | 'estado'>): string {
  return `${exemplo.componente} — ${exemplo.estado}`;
}

/**
 * Busca sem acento e sem diferença de maiúsculas no nome do componente, no estado e no caminho. Cada palavra digitada
 * precisa aparecer em algum deles ("campo erro" acha "Campo — com erro"). Busca vazia devolve tudo, na mesma ordem.
 */
export function filtrarExemplos<E extends ExemploDoCatalogo>(exemplos: readonly E[], busca: string): E[] {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...exemplos];
  return exemplos.filter((e) => {
    const alvo = semAcento(`${e.componente} ${e.estado} ${e.caminho}`);
    return termos.every((t) => alvo.includes(t));
  });
}

/** Agrupa na ordem de `SECOES_DO_CATALOGO`, mantendo a ordem dos exemplos dentro da seção; seção sem exemplo some. */
export function agruparPorSecao<E extends ExemploDoCatalogo>(exemplos: readonly E[]): GrupoDoCatalogo<E>[] {
  return SECOES_DO_CATALOGO.map(({ chave, titulo }) => ({
    secao: chave,
    titulo,
    exemplos: exemplos.filter((e) => e.secao === chave),
  })).filter((g) => g.exemplos.length > 0);
}

/** Resumo da faixa da seção: "1 exemplo", "4 exemplos". */
export function resumoDoGrupo(quantos: number): string {
  return quantos === 1 ? '1 exemplo' : `${quantos} exemplos`;
}

/** Linha acima da grade: quantos exemplos a busca mostra. */
export function resumoDaBusca(mostrados: number, total: number): string {
  if (mostrados === total) return `${total} exemplos`;
  if (mostrados === 0) return 'Nenhum componente encontrado';
  return `${mostrados} de ${total} exemplos`;
}

/** Aba do Montador lida do endereço (`?aba=catalogo`); qualquer outro valor é "Montar". */
export type AbaDoMontador = 'montar' | 'catalogo';

export function abaDoMontador(valor: unknown): AbaDoMontador {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto === 'catalogo' ? 'catalogo' : 'montar';
}
