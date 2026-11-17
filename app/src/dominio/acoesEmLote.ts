import type { ResultadoDoItemDoLote } from '../api/financeiroTipos';
import { SEM_RESPOSTA_DO_LOTE } from './financeiro';

/**
 * Cancelar, gerar link e exportar várias cobranças de uma vez (Fase 1 do financeiro), no estilo do lote de baixa
 * (`resumoDoLote` em `financeiro.ts`): o resultado vem por item, na ordem do pedido, e falha parcial nunca aparece como
 * sucesso. A seleção e o teto de 100 são os do lote de baixa (`LIMITE_DO_LOTE`, `problemaDoLote`). Exportar não tem
 * resultado por item (a API devolve o CSV): só o texto e o nome do arquivo.
 */

export type AcaoDoLote = 'CANCELAR' | 'LINK';

const MOTIVO_GENERICO = 'Erro inesperado.';

const MOTIVOS_COMUNS: Record<string, string> = {
  COBRANCA_NAO_ENCONTRADA: 'A cobrança não foi encontrada.',
  COBRANCA_NAO_ABERTA: 'A cobrança não está mais em aberto.',
  [SEM_RESPOSTA_DO_LOTE]: 'O servidor não respondeu por esta cobrança.',
};

const MOTIVOS_DA_ACAO: Record<AcaoDoLote, Record<string, string>> = {
  CANCELAR: {
    CONFLITO_EDICAO: 'A cobrança foi alterada por outra pessoa ou aba.',
    COBRANCA_INVALIDA: 'Os dados do cancelamento foram recusados.',
  },
  LINK: {
    COBRANCA_SEM_LINK: 'A cobrança de saída não tem link de pagamento.',
    RECEBIMENTO_ONLINE_NAO_CONFIGURADO: 'O recebimento online não está configurado.',
    PROVEDOR_INDISPONIVEL: 'A InfinitePay não respondeu. Tente de novo.',
    ALUNO_INATIVO: 'O aluno está inativo.',
    ALUNO_ANONIMIZADO: 'O aluno foi anonimizado.',
    LINK_SEM_ENDERECO: 'O servidor não devolveu o link desta cobrança.',
  },
};

/** O motivo em português de um item recusado; código desconhecido vira um texto genérico (nunca o código cru). */
export function motivoDoItemDaAcao(acao: AcaoDoLote, codigo: string | null | undefined): string {
  return (codigo && (MOTIVOS_DA_ACAO[acao][codigo] ?? MOTIVOS_COMUNS[codigo])) || MOTIVO_GENERICO;
}

export interface ItemDoResumoDaAcao {
  cobrancaId: string;
  ok: boolean;
  /** Texto quando falhou; nulo quando deu certo. */
  motivo: string | null;
  /** O link (`https`), só na ação `LINK` com sucesso. */
  url: string | null;
}

export interface ResumoDaAcaoEmLote {
  itens: ItemDoResumoDaAcao[];
  certos: number;
  falhas: number;
  tom: 'sucesso' | 'atencao' | 'perigo';
  texto: string;
}

const FRASES: Record<AcaoDoLote, {
  um: string; varios: string; naoFoi: string; naoForam: string; nenhumUm: string; nenhumVarios: (n: number) => string;
}> = {
  CANCELAR: {
    um: '1 cobrança cancelada', varios: 'cobranças canceladas', naoFoi: 'não foi cancelada', naoForam: 'não foram canceladas',
    nenhumUm: 'A cobrança não foi cancelada.', nenhumVarios: (n) => `Nenhuma das ${n} cobranças foi cancelada.`,
  },
  LINK: {
    um: '1 link gerado', varios: 'links gerados', naoFoi: 'não foi gerado', naoForam: 'não foram gerados',
    nenhumUm: 'O link não foi gerado.', nenhumVarios: (n) => `Nenhum dos ${n} links foi gerado.`,
  },
};

/**
 * Junta o pedido com a resposta, na ordem do pedido. Item sem resposta é falha. Na ação `LINK`, `ok` sem um `https` em
 * `url` também é falha (não há o que copiar). Tom `sucesso` só com todos certos; parte = `atencao`; nenhum = `perigo`.
 */
export function resumoDaAcaoEmLote(
  acao: AcaoDoLote,
  pedidos: readonly string[],
  resultados: readonly Pick<ResultadoDoItemDoLote, 'cobrancaId' | 'ok' | 'codigo' | 'url'>[],
): ResumoDaAcaoEmLote {
  const porId = new Map(resultados.map((r) => [r.cobrancaId, r]));
  const itens = pedidos.map((id): ItemDoResumoDaAcao => {
    const r = porId.get(id);
    if (!r) return { cobrancaId: id, ok: false, motivo: motivoDoItemDaAcao(acao, SEM_RESPOSTA_DO_LOTE), url: null };
    if (!r.ok) return { cobrancaId: id, ok: false, motivo: motivoDoItemDaAcao(acao, r.codigo), url: null };
    if (acao === 'LINK') {
      const url = typeof r.url === 'string' && r.url.startsWith('https://') ? r.url : null;
      return url ? { cobrancaId: id, ok: true, motivo: null, url } : { cobrancaId: id, ok: false, motivo: motivoDoItemDaAcao(acao, 'LINK_SEM_ENDERECO'), url: null };
    }
    return { cobrancaId: id, ok: true, motivo: null, url: null };
  });
  const certos = itens.filter((i) => i.ok).length;
  const falhas = itens.length - certos;
  const t = FRASES[acao];
  const feitos = certos === 1 ? t.um : `${certos} ${t.varios}`;
  const texto = falhas === 0 ? `${feitos}.`
    : certos === 0 ? (falhas === 1 ? t.nenhumUm : t.nenhumVarios(falhas))
      : `${certos} de ${itens.length} ${t.varios}. ${falhas === 1 ? `1 ${t.naoFoi}` : `${falhas} ${t.naoForam}`}: veja o motivo abaixo.`;
  return { itens, certos, falhas, tom: falhas === 0 ? 'sucesso' : certos === 0 ? 'perigo' : 'atencao', texto };
}

/** Os links gerados, um por linha, para copiar de uma vez. */
export const linksGerados = (resumo: Pick<ResumoDaAcaoEmLote, 'itens'>): string[] =>
  resumo.itens.flatMap((i) => (i.url ? [i.url] : []));

// ---- Exportar as selecionadas ----

/** "3 cobranças exportadas." (a API devolve o CSV das selecionadas, sem resultado por item). */
export const textoDaExportacaoDasSelecionadas = (n: number): string => (n === 1 ? '1 cobrança exportada.' : `${n} cobranças exportadas.`);

/** `financeiro-selecionadas-2026-11-17.csv`: o nome é montado aqui porque a requisição não expõe o cabeçalho da resposta. */
export const nomeDoCsvDasSelecionadas = (hoje: string): string => `financeiro-selecionadas-${hoje}.csv`;
