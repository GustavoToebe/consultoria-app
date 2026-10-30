/**
 * Regras puras do assistente de importação em etapas (análise do vídeo de 29/10, A03 e A04): etapas, arquivo aceito,
 * mapeamento escolhido por coluna, motivos de não continuar e o resumo da validação. Sem React e sem API.
 */
import { faltandoColuna, type CampoDaImportacao, type Destino } from './mapeamentoDaImportacao';

export const ETAPAS_DA_IMPORTACAO = ['Destino e arquivo', 'Configuração', 'Mapeamento', 'Validação', 'Resultado'] as const;
export type EtapaDaImportacao = 1 | 2 | 3 | 4 | 5;

/** Mapa campo → índice da coluna (nulo = não importar), como a API recebe. */
export type MapaDaImportacao = Record<string, number | null>;

/** Tipo do arquivo pelo nome. Só .xlsx e .csv são aceitos; .xls antigo não. */
export function tipoDoArquivo(nome: string): 'Excel' | 'CSV' | null {
  const minusculo = nome.trim().toLowerCase();
  if (minusculo.endsWith('.xlsx')) return 'Excel';
  if (minusculo.endsWith('.csv')) return 'CSV';
  return null;
}

/** "850 bytes", "12 KB", "1,2 MB"; nulo quando o tamanho não é conhecido. */
export function tamanhoParaTela(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Campo escolhido para a coluna, ou nulo ("Não importar"). */
export function campoDaColuna(mapa: MapaDaImportacao, coluna: number): string | null {
  return Object.entries(mapa).find(([, indice]) => indice === coluna)?.[0] ?? null;
}

/**
 * Escolhe o campo da coluna. A coluna perde o campo que tinha; o campo sai da coluna onde estava antes (cada campo vai
 * em uma coluna só, cada coluna em um campo só). Nulo = "Não importar".
 */
export function escolherCampoDaColuna(mapa: MapaDaImportacao, coluna: number, campo: string | null): MapaDaImportacao {
  const novo: MapaDaImportacao = {};
  for (const [id, indice] of Object.entries(mapa)) novo[id] = indice === coluna ? null : indice;
  if (campo !== null) novo[campo] = coluna;
  return novo;
}

/** Campos que a pessoa pode escolher: sem a permissão de dado sensível, os sensíveis ficam de fora. */
export function camposPermitidos(destino: Destino, podeSensivel: boolean): CampoDaImportacao[] {
  return destino.campos.filter((c) => podeSensivel || !c.sensivel);
}

export interface EstadoDoAssistente {
  destino: Destino | null;
  arquivo: { nome: string } | null;
  lendo: boolean;
  temColunas: boolean;
  chave: string;
  mapa: MapaDaImportacao;
}

/** Por que "Continuar" está desabilitado na etapa (nulo = pode continuar). */
export function motivoParaNaoContinuar(etapa: EtapaDaImportacao, e: EstadoDoAssistente): string | null {
  if (etapa === 1) {
    if (!e.destino) return 'Escolha o que vai importar.';
    if (!e.arquivo) return 'Escolha o arquivo da planilha.';
    if (!tipoDoArquivo(e.arquivo.nome)) return 'Envie um arquivo .xlsx ou .csv.';
    return null;
  }
  if (etapa === 2) {
    if (e.lendo) return 'Aguarde a leitura da planilha.';
    if (!e.temColunas) return 'A planilha ainda não foi lida.';
    return null;
  }
  if (etapa === 3 && e.destino) {
    const faltando = faltandoColuna(e.destino, e.chave, e.mapa);
    if (faltando.length > 0) return `Escolha a coluna de ${juntar(faltando)}.`;
  }
  return null;
}

/** "Nome", "Nome e E-mail", "Nome, E-mail e Data". */
export function juntar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** O que cada regra faz com o registro que já existe, em uma linha. */
export function explicacaoDosExistentes(valor: string): string {
  switch (valor) {
    case 'IGNORAR': return 'Deixa o cadastro como está e não usa a linha.';
    case 'COMPLETAR': return 'Preenche só o que está vazio no cadastro.';
    case 'ATUALIZAR': return 'Troca pelos valores da planilha; célula vazia não apaga.';
    case 'SUBSTITUIR': return 'Troca o peso já registrado na mesma data.';
    default: return '';
  }
}

export interface ResumoDaValidacao { total: number; comErro: number; corretas: number }

/** Total / Com erro / Corretas da prévia: as corretas são as que entram (novas, atualizadas ou ignoradas pela regra). */
export function resumoDaValidacao(previa: { linhas: number; comErro: number }): ResumoDaValidacao {
  const comErro = Math.max(0, previa.comErro);
  return { total: previa.linhas, comErro, corretas: Math.max(0, previa.linhas - comErro) };
}

/** O que a confirmação vai fazer, sem fazer parecer que as ignoradas serão criadas. */
export function textoDoQueVaiAcontecer(previa: { novos: number; atualizados: number; ignorados: number }): string {
  const partes: string[] = [];
  if (previa.novos > 0) partes.push(`criar ${previa.novos} ${previa.novos === 1 ? 'registro' : 'registros'}`);
  if (previa.atualizados > 0) partes.push(`atualizar ${previa.atualizados}`);
  const acao = partes.length > 0 ? `Ao confirmar, a importação vai ${juntar(partes)}.` : 'Ao confirmar, nada será criado nem atualizado.';
  const ignoradas = previa.ignorados > 0
    ? ` ${previa.ignorados} ${previa.ignorados === 1 ? 'linha já existe e fica' : 'linhas já existem e ficam'} como ${previa.ignorados === 1 ? 'está' : 'estão'}.`
    : '';
  return acao + ignoradas;
}

/** "Linha 4 · Nome (coluna “Aluno”): Informe o nome." — o campo pelo rótulo e, quando mapeado, a coluna de origem. */
export function textoDoErro(erro: { linha: number; campo: string; motivo: string }, destino: Destino, colunas: readonly string[], mapa: MapaDaImportacao): string {
  const campo = destino.campos.find((c) => c.id === erro.campo);
  const indice = mapa[erro.campo];
  const coluna = indice !== null && indice !== undefined && indice >= 0 ? colunas[indice] : undefined;
  const onde = campo ? `${campo.rotulo}${coluna ? ` (coluna “${coluna}”)` : ''}` : erro.campo;
  return `Linha ${erro.linha} · ${onde}: ${erro.motivo}`;
}
