/**
 * Regras puras do assistente de importação em etapas (análise do vídeo de 29/10, A03 e A04): etapas, arquivo aceito,
 * mapeamento escolhido por coluna, motivos de não continuar e o resumo da validação. Sem React e sem API.
 */
import { faltandoColuna, type CampoDaImportacao, type Destino } from './mapeamentoDaImportacao';
import type { OpcaoSuspensa } from './escolhaSuspensa';
import { semAcento } from './telas';

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

/** Rótulo do campo na lista do mapeamento: "Endereço > CEP" quando o campo tem grupo. */
export function rotuloNaLista(campo: CampoDaImportacao): string {
  return campo.grupo ? `${campo.grupo} > ${campo.rotulo}` : campo.rotulo;
}

/**
 * Opções do campo de uma coluna: "Não importar" primeiro e cada campo com "Obrigatório" e, se já está em outra
 * coluna, onde (escolher aqui tira de lá).
 */
export function opcoesDoCampoDaColuna(campos: readonly CampoDaImportacao[], mapa: MapaDaImportacao, coluna: number,
  nomeDaColuna: (indice: number) => string): OpcaoSuspensa<string | null>[] {
  return [
    { valor: null, rotulo: 'Não importar' },
    ...campos.map((c) => {
      const onde = mapa[c.id];
      const emOutra = onde !== null && onde !== undefined && onde !== coluna;
      const detalhe = [c.obrigatorio ? 'Obrigatório' : null, emOutra ? `Hoje na coluna “${nomeDaColuna(onde)}”` : null].filter(Boolean).join(' · ');
      return { valor: c.id as string | null, rotulo: rotuloNaLista(c), detalhe: detalhe || undefined };
    }),
  ];
}

export interface LinhaDaPlanilha { numero: number; valores: string[] }

/** Linhas por página na tabela do mapeamento: a tela não desenha mil linhas de uma vez. */
export const LINHAS_POR_PAGINA = 50;

/**
 * Correções feitas na tabela, só em memória (pedido do Gustavo em 30/10): texto novo por célula, com a chave
 * "linha:coluna" (linha = número no arquivo), e as linhas tiradas. Vão junto da configuração na prévia e na
 * confirmação; o hash da prévia os cobre.
 */
export interface AjustesDaTabela { celulas: Readonly<Record<string, string>>; removidas: readonly number[] }

export const SEM_AJUSTES: AjustesDaTabela = { celulas: {}, removidas: [] };

const chaveDaCelula = (linha: number, coluna: number) => `${linha}:${coluna}`;

/** Texto que a célula mostra: o ajustado, senão o do arquivo. */
export function valorDaCelula(ajustes: AjustesDaTabela, linha: number, coluna: number, original: string): string {
  return ajustes.celulas[chaveDaCelula(linha, coluna)] ?? original;
}

export function celulaAjustada(ajustes: AjustesDaTabela, linha: number, coluna: number): boolean {
  return chaveDaCelula(linha, coluna) in ajustes.celulas;
}

/** Grava o texto novo; igual ao do arquivo, o ajuste sai (a célula volta ao original). */
export function ajustarCelula(ajustes: AjustesDaTabela, linha: number, coluna: number, valor: string, original: string): AjustesDaTabela {
  const celulas = { ...ajustes.celulas };
  if (valor === original) delete celulas[chaveDaCelula(linha, coluna)];
  else celulas[chaveDaCelula(linha, coluna)] = valor;
  return { ...ajustes, celulas };
}

/** Tira a linha (ou a devolve, se já estava tirada). */
export function alternarRemovida(ajustes: AjustesDaTabela, linha: number): AjustesDaTabela {
  const removidas = ajustes.removidas.includes(linha) ? ajustes.removidas.filter((l) => l !== linha) : [...ajustes.removidas, linha];
  return { ...ajustes, removidas };
}

/** O que vai para a API: listas ordenadas, sem nada em branco. */
export function ajustesParaApi(ajustes: AjustesDaTabela): { celulas: { linha: number; coluna: number; valor: string }[]; removidas: number[] } {
  const celulas = Object.entries(ajustes.celulas).map(([chave, valor]) => {
    const [linha, coluna] = chave.split(':').map(Number);
    return { linha, coluna, valor };
  }).filter((c) => !ajustes.removidas.includes(c.linha)).sort((a, b) => a.linha - b.linha || a.coluna - b.coluna);
  return { celulas, removidas: [...ajustes.removidas].sort((a, b) => a - b) };
}

/** Quantos ajustes valem (célula de linha tirada não conta). */
export function totalDeAjustes(ajustes: AjustesDaTabela): { celulas: number; removidas: number } {
  const api = ajustesParaApi(ajustes);
  return { celulas: api.celulas.length, removidas: api.removidas.length };
}

/**
 * Erros da última validação pela tabela: o motivo de cada célula (o campo do erro na coluna mapeada) e, por linha,
 * os motivos que não têm coluna (campo sem coluna, linha inteira).
 */
export function errosNaTabela(erros: readonly { linha: number; campo: string; motivo: string }[], mapa: MapaDaImportacao) {
  const porCelula = new Map<string, string>();
  const porLinha = new Map<number, string[]>();
  for (const e of erros) {
    const coluna = mapa[e.campo];
    if (coluna !== null && coluna !== undefined && coluna >= 0) {
      const chave = chaveDaCelula(e.linha, coluna);
      porCelula.set(chave, porCelula.has(chave) ? `${porCelula.get(chave)} ${e.motivo}` : e.motivo);
    } else {
      porLinha.set(e.linha, [...(porLinha.get(e.linha) ?? []), e.motivo]);
    }
  }
  const linhas = new Set<number>(erros.map((e) => e.linha));
  return { motivoDaCelula: (linha: number, coluna: number) => porCelula.get(chaveDaCelula(linha, coluna)) ?? null, motivosDaLinha: (linha: number) => porLinha.get(linha) ?? [], linhas };
}

/**
 * Linhas da amostra com o número de cada uma no arquivo, sem as tiradas, filtradas pela busca (sem acento, no texto
 * que a célula mostra ou pelo número da linha) e, com `somente`, só as dessas linhas (as que deram erro). Sem os
 * números da API, conta a partir da primeira linha de dados.
 */
export function linhasDaPlanilha(amostra: readonly string[][], numeros: readonly number[] | undefined, cabecalho: boolean,
  busca: string, ajustes: AjustesDaTabela = SEM_AJUSTES, somente?: ReadonlySet<number>): LinhaDaPlanilha[] {
  const primeira = cabecalho ? 2 : 1;
  const termo = semAcento(busca.trim());
  const linhas: LinhaDaPlanilha[] = [];
  amostra.forEach((originais, i) => {
    const numero = numeros?.[i] ?? primeira + i;
    if (ajustes.removidas.includes(numero) || (somente && !somente.has(numero))) return;
    const valores = originais.map((v, c) => valorDaCelula(ajustes, numero, c, v));
    if (termo && String(numero) !== termo && !valores.some((v) => semAcento(v).includes(termo))) return;
    linhas.push({ numero, valores });
  });
  return linhas;
}

/** A página pedida, ajustada para dentro do total (a busca encolhe a lista). */
export function paginaDaPlanilha(linhas: readonly LinhaDaPlanilha[], pagina: number, porPagina = LINHAS_POR_PAGINA) {
  const total = Math.max(1, Math.ceil(linhas.length / porPagina));
  const atual = Math.min(Math.max(pagina, 0), total - 1);
  return { linhas: linhas.slice(atual * porPagina, (atual + 1) * porPagina), pagina: atual, total };
}

/** Aviso quando a tela não recebeu o arquivo todo; a validação continua conferindo todas as linhas. */
export function avisoDoCorte(colunas: { linhas: number; amostra: readonly unknown[]; amostraCortada?: boolean }): string | null {
  if (!colunas.amostraCortada && colunas.amostra.length >= colunas.linhas) return null;
  return `Mostrando as primeiras ${colunas.amostra.length} de ${colunas.linhas} linhas. A validação confere todas.`;
}
