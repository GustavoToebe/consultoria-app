import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  AgendaPessoal, AgendaPessoalRequest, ContagemDaAgenda, DiaDoResumo, EventoDetalhe, EventoRequest, OcorrenciaDeEvento,
  RepeticaoDeEvento, ResumoDaAgenda,
} from '../api/agendaTipos';
import { CHAVES_DA_AGENDA, PALETA_DA_AGENDA } from '../tema/tokens';
import { LIMITES_DA_AGENDA, LIMITES_DO_EVENTO, textoDoErroDoCalendario } from './agendaEvento';
import { JANELA_DA_LISTAGEM, JANELA_DO_RESUMO } from './agendaCalendario';
import { OPCOES_DE_REPETICAO } from './agendaPresencial';

/**
 * Paridade com o Java: lê `AgendaCalendarioDtos` (contratos e limites públicos) e as constantes dos serviços da agenda (a
 * API é quem decide) e confere os espelhos do app. Se a API mudar um limite, um campo ou um código de erro, este teste
 * falha até o app acompanhar.
 */
const pasta = resolve(__dirname, '../../../api/src/main/java/br/com/treinos/api/agenda');
const ler = (arquivo: string) => readFileSync(resolve(pasta, arquivo), 'utf8');
const dtos = ler('AgendaCalendarioDtos.java');

/** Constante `int` (pública ou do pacote) de um arquivo Java. */
function constante(fonte: string, nome: string): number {
  const m = new RegExp(`static final int ${nome} = (\\d+);`).exec(fonte);
  if (!m) throw new Error(`Constante ${nome} não encontrada`);
  return Number(m[1]);
}

/** Os componentes de um `record` Java, na ordem (tira anotações; parênteses balanceados). */
function componentes(fonte: string, nome: string): string[] {
  const inicio = fonte.indexOf(`record ${nome}(`);
  if (inicio < 0) throw new Error(`Record ${nome} não encontrado`);
  let i = inicio + `record ${nome}(`.length;
  const comeco = i;
  for (let profundidade = 1; profundidade > 0; i += 1) {
    if (fonte[i] === '(') profundidade += 1;
    else if (fonte[i] === ')') profundidade -= 1;
  }
  const corpo = fonte.slice(comeco, i - 1).replace(/@\w+(\([^)]*\))?/g, '');
  return corpo.split(',').map((c) => c.trim().split(/\s+/).pop() as string).filter(Boolean);
}

/** Chaves de um tipo TS: o `Record<keyof T, true>` obriga a lista a ser exatamente a do tipo (o `tsc` confere). */
const chaves = (campos: Record<string, true>) => Object.keys(campos).sort();

const igual = (java: string[]) => [...java].sort();

describe('limites iguais aos da API', () => {
  it('evento: título, local, descrição, duração', () => {
    expect(LIMITES_DO_EVENTO).toMatchObject({
      titulo: constante(dtos, 'TITULO_MAXIMO'), local: constante(dtos, 'LOCAL_MAXIMO'), descricao: constante(dtos, 'DESCRICAO_MAXIMA'),
      duracaoMinima: constante(dtos, 'EVENTO_DURACAO_MINIMA'), duracaoMaxima: constante(dtos, 'EVENTO_DURACAO_MAXIMA'),
    });
  });

  it('evento: repetição, anos aceitos e total por pessoa', () => {
    const regra = ler('RecorrenciaDeEvento.java');
    expect(LIMITES_DO_EVENTO.vezesMinimo).toBe(constante(regra, 'VEZES_MINIMO'));
    expect(LIMITES_DO_EVENTO.vezesMaximo).toBe(constante(regra, 'VEZES_MAXIMO'));
    expect(regra).toContain(`PRIMEIRO_DIA = LocalDate.of(${LIMITES_DO_EVENTO.anoMinimo}, 1, 1)`);
    expect(regra).toContain(`ULTIMO_DIA = LocalDate.of(${LIMITES_DO_EVENTO.anoMaximo}, 12, 31)`);
    expect(LIMITES_DO_EVENTO.eventos).toBe(constante(ler('EventoAgendaService.java'), 'EVENTOS_MAXIMO'));
  });

  it('agenda pessoal: nome e total por pessoa', () => {
    expect(LIMITES_DA_AGENDA.nome).toBe(constante(dtos, 'NOME_DA_AGENDA_MAXIMO'));
    expect(LIMITES_DA_AGENDA.agendas).toBe(constante(ler('AgendaPessoalService.java'), 'AGENDAS_MAXIMO'));
  });

  it('janelas: listagem e eventos 62 dias; resumo e atualizações 366', () => {
    expect(JANELA_DA_LISTAGEM).toBe(constante(ler('AgendaService.java'), 'JANELA_MAXIMA_DIAS'));
    expect(JANELA_DO_RESUMO).toBe(constante(ler('ResumoDaAgendaService.java'), 'JANELA_MAXIMA_DIAS'));
  });
});

describe('paleta das agendas', () => {
  it('as chaves são as de CORES, e cada tema tem as mesmas', () => {
    const trecho = /CORES = Set\.of\(([^)]*)\)/.exec(dtos);
    if (!trecho) throw new Error('CORES não encontrado');
    const java = [...trecho[1].matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
    expect(java).toHaveLength(8);
    expect([...CHAVES_DA_AGENDA].sort()).toEqual(igual(java));
    expect(Object.keys(PALETA_DA_AGENDA.claro).sort()).toEqual(igual(java));
    expect(Object.keys(PALETA_DA_AGENDA.escuro).sort()).toEqual(igual(java));
  });
});

describe('campos iguais aos dos records da API', () => {
  it('agenda pessoal', () => {
    const pedido: Record<keyof AgendaPessoalRequest, true> = { nome: true, cor: true, versao: true };
    const resposta: Record<keyof AgendaPessoal, true> = { id: true, nome: true, cor: true, versao: true };
    const contagem: Record<keyof ContagemDaAgenda, true> = { eventos: true };
    expect(chaves(pedido)).toEqual(igual(componentes(dtos, 'AgendaRequest')));
    expect(chaves(resposta)).toEqual(igual(componentes(dtos, 'AgendaResponse')));
    expect(chaves(contagem)).toEqual(igual(componentes(dtos, 'ContagemDaAgenda')));
  });

  it('evento: pedido, repetição, ocorrência e detalhe', () => {
    const repeticao: Record<keyof RepeticaoDeEvento, true> = { tipo: true, diasDaSemana: true, ate: true, vezes: true };
    const pedido: Record<keyof EventoRequest, true> = {
      agendaId: true, titulo: true, local: true, descricao: true, data: true, diaInteiro: true, hora: true, duracaoMinutos: true, repeticao: true, versao: true,
    };
    const ocorrencia: Record<keyof OcorrenciaDeEvento, true> = {
      eventoId: true, agendaId: true, dataOriginal: true, data: true, hora: true, horaFim: true, inicio: true, fim: true, diaInteiro: true, titulo: true,
      local: true, descricao: true, recorrente: true,
    };
    const detalhe: Record<keyof EventoDetalhe, true> = {
      id: true, agendaId: true, titulo: true, local: true, descricao: true, data: true, diaInteiro: true, hora: true, duracaoMinutos: true, repeticao: true,
      versao: true, ocorrencia: true,
    };
    expect(chaves(repeticao)).toEqual(igual(componentes(dtos, 'RepeticaoDeEvento')));
    expect(chaves(pedido)).toEqual(igual(componentes(dtos, 'EventoRequest')));
    expect(chaves(ocorrencia)).toEqual(igual(componentes(dtos, 'OcorrenciaDeEvento')));
    expect(chaves(detalhe)).toEqual(igual(componentes(dtos, 'EventoResponse')));
  });

  it('resumo do Ano', () => {
    const dia: Record<keyof DiaDoResumo, true> = { data: true, compromissos: true, eventos: true };
    const resumo: Record<keyof ResumoDaAgenda, true> = { dias: true };
    expect(chaves(dia)).toEqual(igual(componentes(dtos, 'DiaDoResumo')));
    expect(chaves(resumo)).toEqual(igual(componentes(dtos, 'ResumoDaAgenda')));
  });

  it('os tipos de repetição são os de TipoDeRecorrencia', () => {
    const enumJava = /enum TipoDeRecorrencia \{([\s\S]*?)\}/.exec(ler('TipoDeRecorrencia.java'));
    if (!enumJava) throw new Error('TipoDeRecorrencia não encontrado');
    const valores = [...enumJava[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\b([A-Z_]{4,})\b/g)].map((m) => m[1]);
    expect(OPCOES_DE_REPETICAO.map((o) => o.valor).sort()).toEqual(igual(valores));
  });
});

describe('códigos de erro', () => {
  it('todo código que os serviços do calendário lançam tem texto próprio no app (ou está na lista de quem não precisa)', () => {
    // Códigos que o calendário não trata de propósito: o app mostra a mensagem da API.
    const semTexto = new Set<string>();
    const achados = new Set<string>();
    for (const arquivo of ['EventoAgendaService.java', 'AgendaPessoalService.java', 'ResumoDaAgendaService.java', 'RecorrenciaDeEvento.java', 'AgendaCalendarioController.java']) {
      for (const m of ler(arquivo).matchAll(/new (?:BadRequest|Conflict)Exception\([^;]*?"([A-Z_]+)"\s*\)/g)) achados.add(m[1]);
    }
    expect(achados.size).toBeGreaterThanOrEqual(12);
    const faltando = [...achados].filter((c) => !semTexto.has(c) && textoDoErroDoCalendario({ codigo: c }) === null);
    expect(faltando).toEqual([]);
  });
});
