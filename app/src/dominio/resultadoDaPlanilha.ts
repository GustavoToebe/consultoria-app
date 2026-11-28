/**
 * Regras puras do resultado de uma importação da planilha completa no histórico (resultado da importação, 23/11;
 * `docs/planos/resultado-da-importacao.md`). O histórico guarda cada problema como `"<aba>: <CÓDIGO>"` com a linha, nunca o
 * valor da célula. Aqui: ler isso de volta, classificar cada código em "Ajustado" (a linha entrou de outro jeito) ou "Ficou
 * de fora" (a linha não entrou), contar por linha da planilha, agrupar por aba e montar o texto para copiar.
 */
import { inteiroComMilhar } from './formatos';
import { textoDoProblema } from './planilhaCompleta';

export type ClasseDoProblema = 'AJUSTADO' | 'FORA';

export const ROTULO_DA_CLASSE: Record<ClasseDoProblema, string> = { AJUSTADO: 'Ajustado', FORA: 'Ficou de fora' };

/**
 * Códigos em que a linha (ou o bloco, ou o excedente) não entra: na montagem da API a linha é pulada. Lido em
 * `MontagemDaImportacao`/`AnaliseDaPlanilha` (o `continue` depois do problema) e no texto de cada código.
 */
export const CODIGOS_QUE_FICAM_DE_FORA: ReadonlySet<string> = new Set([
  'ABA_SEM_LIGACAO', 'ALUNO_ANONIMIZADO', 'ALUNO_DO_BLOCO_AMBIGUO', 'ALUNO_EXISTENTE_AMBIGUO', 'ALUNO_FORA', 'ALUNO_REPETIDO', 'ALUNO_SEM_CODIGO',
  'ALUNO_SEM_NOME', 'BLOCO_SEM_ALUNO', 'CABECALHO_NAO_USADO', 'CODIGO_REPETIDO', 'DATA_INVALIDA', 'DATA_NO_FUTURO',
  'EXERCICIOS_DEMAIS_NO_TREINO', 'EXERCICIO_SEM_LETRA_DO_TREINO', 'EXERCICIO_SEM_NOME', 'INATIVO_IGNORADO', 'ITEM_SEM_ALIMENTO',
  'ITEM_SEM_OPCAO', 'ITEM_SEM_REFEICAO', 'ITENS_DEMAIS_NA_OPCAO', 'LIGACAO_AMBIGUA', 'LIMITE_DO_PLANO', 'LIMITE_DO_TREINADOR',
  'LINHA_SEM_LIGACAO', 'MAIS_DE_UM_ATIVO_PARA_O_ALUNO', 'MEDICACAO_DEMAIS', 'NOME_DO_EXERCICIO_LONGO_DEMAIS', 'NOME_LONGO_DEMAIS',
  'OPCOES_DEMAIS', 'PESO_INVALIDO', 'PESO_REPETIDO', 'REFEICOES_DEMAIS', 'SEM_DATA', 'SEM_PESO', 'SEM_REFERENCIA',
  'SUPLEMENTOS_DEMAIS', 'SUPLEMENTO_SEM_NOME', 'TREINOS_DEMAIS',
]);

/**
 * Códigos em que a linha entra de outro jeito: sem um campo, com "—", cortada, com o padrão ou com o texto na observação
 * (`TIPO_FORA_DA_METODOLOGIA` tira só a série: o exercício da linha entra, `MontagemDeSeries`).
 * Lista explícita (e não "o resto") para o teste pegar código novo sem classe.
 */
export const CODIGOS_AJUSTADOS: ReadonlySet<string> = new Set([
  'BACK_OFF_PERCENTUAL_INVALIDO', 'BACK_OFF_SEM_PERCENTUAL', 'BO_INVALIDO', 'CLUSTER_DIFERENTE_DAS_REPETICOES', 'DATA_INICIO_INVALIDA', 'DATA_INICIO_NO_FUTURO',
  'EMAIL_INVALIDO', 'ESFORCO_CONFLITANTE', 'EXERCICIO_SEM_SERIE', 'FAIXA_INVALIDA', 'FAIXA_VAZIA', 'FAIXA_VIROU_DATA',
  'FS_SEM_REGRA_DE_PERCENTUAL', 'ITEM_SEM_KCAL', 'NOME_DO_EXERCICIO_CORTADO', 'NOME_IGUAL_EMAIL_DIFERENTE', 'NOME_REPETIDO', 'OBSERVACAO_CORTADA',
  'OBSERVACAO_LONGA_DEMAIS', 'ORIENTACOES_DEMAIS', 'PESO_INICIAL_INVALIDO', 'PESO_INICIAL_SEM_DATA', 'PIRAMIDE_DIFERENTE_DAS_SERIES',
  'PRESCRICAO_NAO_ENTENDIDA', 'QUANTIDADE_AUSENTE_OU_INVALIDA', 'QUANTIDADE_DE_FS_ACIMA_DE_10', 'QUANTIDADE_DE_FS_INVALIDA',
  'QUANTIDADE_DE_SERIES_INVALIDA', 'QUANTIDADE_DE_WS_ACIMA_DE_10', 'QUANTIDADE_DE_WS_INVALIDA', 'REFEICAO_SEM_TITULO',
  'REPETICOES_VIROU_DATA', 'STATUS_NAO_RECONHECIDO', 'TECNICA_FORA_DA_METODOLOGIA', 'TECNICA_INCOMPLETA', 'TELEFONE_INVALIDO', 'TEXTO_CORTADO',
  'TEXTO_LONGO_DEMAIS', 'TIPO_FORA_DA_METODOLOGIA', 'TREINO_SEM_NOME', 'TS_INVALIDO', 'UNIDADE_DESCONHECIDA', 'VALOR_NUTRICIONAL_INVALIDO', 'VIDEO_NAO_ACEITO',
]);

/** Código desconhecido (API mais nova que o app) conta como "Ajustado": não dá para afirmar que a linha ficou de fora. */
export function classeDoProblema(codigo: string): ClasseDoProblema {
  return CODIGOS_QUE_FICAM_DE_FORA.has(codigo) ? 'FORA' : 'AJUSTADO';
}

export interface ProblemaDoHistorico { aba: string; linha: number; codigo: string }

/** `"<aba>: <CÓDIGO>"` de volta aos dois (o nome da aba pode ter ": "; o código não). Sem o separador, o motivo é o código. */
export function lerProblemas(erros: readonly { linha: number; campo: string; motivo: string }[]): ProblemaDoHistorico[] {
  return erros.map((e) => {
    const i = e.motivo.lastIndexOf(': ');
    return i > 0 ? { aba: e.motivo.slice(0, i), linha: e.linha, codigo: e.motivo.slice(i + 2) } : { aba: 'Planilha', linha: e.linha, codigo: e.motivo };
  });
}

/** Linhas da planilha (aba + linha distintas): com algum problema "de fora" conta só como de fora. */
export function resumoDosProblemas(problemas: readonly ProblemaDoHistorico[]): { ajustadas: number; fora: number } {
  const linhas = new Map<string, boolean>();
  for (const p of problemas) {
    const chave = `${p.aba}\u0000${p.linha}`;
    linhas.set(chave, (linhas.get(chave) ?? false) || classeDoProblema(p.codigo) === 'FORA');
  }
  let fora = 0;
  for (const deFora of linhas.values()) if (deFora) fora++;
  return { ajustadas: linhas.size - fora, fora };
}

export interface GrupoDaAba { codigo: string; texto: string; classe: ClasseDoProblema; linhas: number[] }
export interface AbaDoResultado { aba: string; linhas: number; grupos: GrupoDaAba[] }

/** Por aba (na ordem em que aparecem), um grupo por código com as linhas em ordem; os "de fora" primeiro. */
export function abasDoResultado(problemas: readonly ProblemaDoHistorico[]): AbaDoResultado[] {
  const abas = new Map<string, Map<string, Set<number>>>();
  for (const p of problemas) {
    const codigos = abas.get(p.aba) ?? new Map<string, Set<number>>();
    abas.set(p.aba, codigos);
    const linhas = codigos.get(p.codigo) ?? new Set<number>();
    codigos.set(p.codigo, linhas);
    linhas.add(p.linha);
  }
  return [...abas].map(([aba, codigos]) => {
    const grupos = [...codigos].map(([codigo, linhas]) => ({
      codigo, texto: textoDoProblema(codigo), classe: classeDoProblema(codigo), linhas: [...linhas].sort((a, b) => a - b),
    }));
    grupos.sort((a, b) => (a.classe === b.classe ? 0 : a.classe === 'FORA' ? -1 : 1));
    return { aba, linhas: new Set(grupos.flatMap((g) => g.linhas)).size, grupos };
  });
}

/** Quantas linhas a célula mostra antes do "e mais N". */
export const LINHAS_VISIVEIS = 8;

export function linhasVisiveis(linhas: readonly number[], todas: boolean): { mostradas: number[]; resto: number } {
  if (todas || linhas.length <= LINHAS_VISIVEIS) return { mostradas: [...linhas], resto: 0 };
  return { mostradas: linhas.slice(0, LINHAS_VISIVEIS), resto: linhas.length - LINHAS_VISIVEIS };
}

const n = (q: number, um: string, varios: string) => `${inteiroComMilhar(q)} ${q === 1 ? um : varios}`;

/** "Aba “Refeições” · 3 linhas": o título da seção da aba. */
export function tituloDaAba(a: Pick<AbaDoResultado, 'aba' | 'linhas'>): string {
  return `Aba “${a.aba}” · ${n(a.linhas, 'linha', 'linhas')}`;
}

/** Problemas que a API contou e o histórico não guardou (ela guarda até 1.000). */
export function problemasSemDetalhe(comErro: number, guardados: number): number {
  return Math.max(0, comErro - guardados);
}

export function textoDosSemDetalhe(q: number): string {
  return `E mais ${n(q, 'problema que o histórico não guardou', 'problemas que o histórico não guardou')} (ele guarda os primeiros 1.000).`;
}

/**
 * O texto de "Copiar lista de problemas": por aba, cada problema com o que aconteceu e todas as linhas guardadas, para o
 * treinador corrigir a planilha. Texto simples (cola em e-mail, bloco de notas ou mensagem).
 */
export function textoDaListaDeProblemas(abas: readonly AbaDoResultado[], o: { titulo: string; semDetalhe: number }): string {
  const partes = [o.titulo];
  for (const a of abas) {
    partes.push('', tituloDaAba(a));
    for (const g of a.grupos) partes.push(`- ${g.texto} (${ROTULO_DA_CLASSE[g.classe]}) ${g.linhas.length === 1 ? 'Linha' : 'Linhas'}: ${g.linhas.join(', ')}`);
  }
  if (o.semDetalhe > 0) partes.push('', textoDosSemDetalhe(o.semDetalhe));
  return partes.join('\n');
}
