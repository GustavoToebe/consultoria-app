import type { AgendaPessoal, Compromisso, OcorrenciaDeEvento } from '../api/agendaTipos';
import type { AtualizacaoDaLista } from '../api/tipos';
import { instanteDeBrasilia } from './agendaPresencial';
import {
  agendasDoPainel,
  agendasOcultasValidas,
  agendasParaBuscar,
  agruparPorDia,
  alternarAgendaOculta,
  celulasDoMes,
  colunaDoDia,
  contagemDoAno,
  contagemPorDia,
  dataComDiaDaSemana,
  dataDaAtualizacao,
  deslocarCalendario,
  ehDataDoCalendario,
  itemDeAtualizacao,
  itemDeCompromisso,
  itemDeEvento,
  itensQueSobrepoem,
  lerDataDoCalendario,
  lerEnderecoDoCalendario,
  lerVisaoDoCalendario,
  mesclarItens,
  mesesDoAno,
  minutoDoDiaEmBrasilia,
  minutoInicialDaGrade,
  miniCalendario,
  modoDaVisao,
  periodoDoCalendario,
  ROTULOS_DAS_HORAS,
  segundaDaSemana,
  somarAnos,
  somarMeses,
  textoDoAvisoDeSobreposicao,
  tituloDoCalendario,
  visaoPadrao,
  AGENDA_ATUALIZACOES,
  AGENDA_COMPROMISSOS,
  type ItemDoCalendario,
} from './agendaCalendario';

const HOJE = '2026-10-29'; // quinta-feira
const em = (data: string, hora: string) => instanteDeBrasilia(data, hora);

const pessoal = (id: string, cor: AgendaPessoal['cor'] = 'AZUL'): AgendaPessoal => ({ id, nome: `Agenda ${id}`, cor, versao: 0 });

function compromisso(id: string, inicio: string, fim: string, extra: Partial<Compromisso> = {}): Compromisso {
  return {
    id, responsavelId: null, responsavelNome: null, inicio, fim, data: inicio.slice(0, 10), hora: '00:00', horaFim: '00:00',
    duracaoMinutos: 60, local: null, observacao: null, cancelado: false, versao: 0, serieId: null, ocorrenciaDaSerie: null,
    totalDaSerie: null, participantes: [{ id: 'p1', nome: 'Ana', situacao: 'AGENDADO' }], ...extra,
  };
}

function ocorrencia(eventoId: string, agendaId: string, inicio: string, fim: string, extra: Partial<OcorrenciaDeEvento> = {}): OcorrenciaDeEvento {
  return {
    eventoId, agendaId, dataOriginal: inicio.slice(0, 10), data: inicio.slice(0, 10), hora: null, horaFim: null, inicio, fim,
    diaInteiro: false, titulo: `Evento ${eventoId}`, local: null, descricao: null, recorrente: false, ...extra,
  } as OcorrenciaDeEvento;
}

function atualizacao(id: string | null, dataAtualizacao: string | null, extra: Partial<AtualizacaoDaLista> = {}): AtualizacaoDaLista {
  return { id, pastaId: 'pasta1', alunoId: 'aluno1', nomeAluno: 'Bia', dataAtualizacao, fase: 'ABERTA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: null, ...extra } as AtualizacaoDaLista;
}

const evento = (eventoId: string, de: string, ate: string, extra: Partial<OcorrenciaDeEvento> = {}) =>
  itemDeEvento(ocorrencia(eventoId, 'a1', em(HOJE, de), em(HOJE, ate), extra), [pessoal('a1')]);

describe('datas do calendário', () => {
  it('só aceita data que existe e que a API aceita (2000 a 2100)', () => {
    for (const ok of ['2000-01-01', '2026-02-28', '2024-02-29', '2100-12-31']) expect(ehDataDoCalendario(ok)).toBe(true);
    for (const ruim of ['2026-02-31', '2025-02-29', '1999-12-31', '2101-01-01', '2026-13-01', '2026-1-1', '20261029', '', null, 5, undefined]) {
      expect(ehDataDoCalendario(ruim)).toBe(false);
    }
  });

  it('a semana vai de segunda a domingo', () => {
    expect(segundaDaSemana('2026-10-29')).toBe('2026-10-26');
    expect(segundaDaSemana('2026-10-26')).toBe('2026-10-26');
    expect(segundaDaSemana('2026-11-01')).toBe('2026-10-26'); // domingo
    expect(periodoDoCalendario('semana', '2026-11-01')).toEqual({ de: '2026-10-26', ate: '2026-11-01' });
  });

  it('soma meses limitando o dia ao fim do mês e vira o ano', () => {
    expect(somarMeses('2026-03-31', -1)).toBe('2026-02-28');
    expect(somarMeses('2024-01-31', 1)).toBe('2024-02-29');
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15');
    expect(somarMeses('2026-01-15', -1)).toBe('2025-12-15');
    expect(somarAnos('2024-02-29', 1)).toBe('2025-02-28');
  });

  it('dia da semana por extenso em pt-BR, sem Intl', () => {
    expect(dataComDiaDaSemana(HOJE)).toBe('quinta-feira, 29 de outubro de 2026');
    expect(dataComDiaDaSemana('2026-11-01')).toBe('domingo, 1 de novembro de 2026');
  });
});

describe('visões, endereço e período', () => {
  it('visão e data do endereço têm padrão seguro', () => {
    expect(lerVisaoDoCalendario('mes')).toBe('mes');
    expect(lerVisaoDoCalendario(['ano', 'dia'])).toBe('ano');
    expect(lerVisaoDoCalendario('xyz')).toBe('semana');
    expect(lerVisaoDoCalendario(undefined, 'dia')).toBe('dia');
    expect(lerDataDoCalendario('2026-02-31', HOJE)).toBe(HOJE);
    expect(lerDataDoCalendario('1999-01-01', HOJE)).toBe(HOJE);
    expect(lerDataDoCalendario('2026-05-10', HOJE)).toBe('2026-05-10');
    expect(lerDataDoCalendario(null, HOJE)).toBe(HOJE);
    expect(lerEnderecoDoCalendario({ visao: 'xyz', data: '2026-02-31' }, HOJE, 1000)).toEqual({ visao: 'semana', data: HOJE });
    expect(lerEnderecoDoCalendario({ visao: 'ano', data: '2026-05-10' }, HOJE, 390)).toEqual({ visao: 'ano', data: '2026-05-10' });
  });

  it('a visão padrão é Semana; o modo muda com a largura (corte de 760 px)', () => {
    expect(visaoPadrao(390)).toBe('semana');
    expect(visaoPadrao(1280)).toBe('semana');
    expect(modoDaVisao('semana', 759)).toBe('lista');
    expect(modoDaVisao('dia', 759)).toBe('lista');
    expect(modoDaVisao('semana', 760)).toBe('grade');
    expect(modoDaVisao('mes', 400)).toBe('mesCompacto');
    expect(modoDaVisao('mes', 1200)).toBe('mes');
    expect(modoDaVisao('ano', 400)).toBe('ano');
  });

  it('o período a buscar de cada visão', () => {
    expect(periodoDoCalendario('dia', HOJE)).toEqual({ de: HOJE, ate: HOJE });
    expect(periodoDoCalendario('semana', HOJE)).toEqual({ de: '2026-10-26', ate: '2026-11-01' });
    // O Mês são as 6 semanas desenhadas: da segunda da semana do dia 1 (28/09) por 42 dias.
    expect(periodoDoCalendario('mes', '2026-10-15')).toEqual({ de: '2026-09-28', ate: '2026-11-08' });
    expect(periodoDoCalendario('ano', '2026-10-15')).toEqual({ de: '2026-01-01', ate: '2026-12-31' });
  });

  it('o Mês cabe na janela de 62 dias da listagem', () => {
    for (const data of ['2026-02-10', '2026-03-10', '2027-06-01', '2028-02-15']) {
      const { de, ate } = periodoDoCalendario('mes', data);
      expect((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000 + 1).toBe(42);
    }
  });

  it('anterior e próximo de cada visão; nunca sai de 2000 a 2100', () => {
    expect(deslocarCalendario('dia', HOJE, 1)).toBe('2026-10-30');
    expect(deslocarCalendario('semana', HOJE, -1)).toBe('2026-10-22');
    expect(deslocarCalendario('mes', '2026-03-31', -1)).toBe('2026-02-28');
    expect(deslocarCalendario('ano', '2026-10-29', 1)).toBe('2027-10-29');
    expect(deslocarCalendario('dia', '2000-01-01', -1)).toBe('2000-01-01');
    expect(deslocarCalendario('ano', '2100-06-01', 1)).toBe('2100-06-01');
  });

  it('títulos em pt-BR', () => {
    expect(tituloDoCalendario('dia', HOJE)).toBe('29 de outubro de 2026');
    expect(tituloDoCalendario('semana', HOJE)).toBe('26 de out. – 1 de nov. de 2026');
    expect(tituloDoCalendario('semana', '2026-11-04')).toBe('2 – 8 de nov. de 2026');
    expect(tituloDoCalendario('semana', '2026-12-30')).toBe('28 de dez. de 2026 – 3 de jan. de 2027');
    expect(tituloDoCalendario('mes', HOJE)).toBe('outubro de 2026');
    expect(tituloDoCalendario('ano', HOJE)).toBe('2026');
  });
});

describe('células do Mês, do Ano e mini calendário', () => {
  it('o Mês tem 42 células de segunda a domingo, com os dias de fora esmaecidos', () => {
    const celulas = celulasDoMes('2026-10-15', HOJE, { data: '2026-10-15' });
    expect(celulas).toHaveLength(42);
    expect(celulas[0]).toMatchObject({ data: '2026-09-28', dia: 28, doMes: false });
    expect(celulas[3]).toMatchObject({ data: '2026-10-01', doMes: true });
    expect(celulas[41].data).toBe('2026-11-08');
    expect(celulas.filter((c) => c.hoje).map((c) => c.data)).toEqual([HOJE]);
    expect(celulas.filter((c) => c.selecionado).map((c) => c.data)).toEqual(['2026-10-15']);
    expect(celulas.find((c) => c.data === '2026-10-03')?.fimDeSemana).toBe(true); // sábado
    expect(celulas.find((c) => c.data === '2026-10-05')?.fimDeSemana).toBe(false);
  });

  it('o Ano tem os 12 meses, cada um com 6 semanas', () => {
    const meses = mesesDoAno(2026, HOJE);
    expect(meses).toHaveLength(12);
    expect(meses[2]).toMatchObject({ mes: 3, nome: 'março', primeiroDia: '2026-03-01' });
    expect(meses.every((m) => m.semanas.length === 6 && m.semanas.every((s) => s.length === 7))).toBe(true);
  });

  it('o mini calendário destaca o período da visão e navega por mês', () => {
    const mini = miniCalendario('2026-10-15', 'semana', HOJE, HOJE);
    expect(mini.titulo).toBe('outubro de 2026');
    expect(mini.cabecalho).toHaveLength(7);
    expect(mini.anterior).toBe('2026-09-01');
    expect(mini.proximo).toBe('2026-11-01');
    const destacados = mini.semanas.flat().filter((c) => c.destaque).map((c) => c.data);
    expect(destacados).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(miniCalendario('2026-10-15', 'ano', HOJE, HOJE).semanas.flat().some((c) => c.destaque)).toBe(false);
    const mes = miniCalendario('2026-10-15', 'mes', HOJE, HOJE).semanas.flat().filter((c) => c.destaque);
    expect(mes).toHaveLength(31);
  });
});

describe('agendas do painel', () => {
  it('as fixas dependem da permissão e as pessoais vêm depois', () => {
    const lista = agendasDoPainel([pessoal('a1', 'TERRA')], [AGENDA_ATUALIZACOES, 'a1'], { compromissos: true, atualizacoes: true });
    expect(lista.map((a) => [a.chave, a.visivel, a.fixa])).toEqual([
      [AGENDA_COMPROMISSOS, true, true], [AGENDA_ATUALIZACOES, false, true], ['a1', false, false],
    ]);
    expect(lista[2]).toMatchObject({ nome: 'Agenda a1', cor: 'TERRA', versao: 0 });
    expect(agendasDoPainel([], [], { compromissos: false, atualizacoes: false })).toEqual([]);
    expect(agendasDoPainel([pessoal('a1')], [], { compromissos: false, atualizacoes: true }).map((a) => a.chave)).toEqual([AGENDA_ATUALIZACOES, 'a1']);
  });

  it('tira da preferência só as agendas pessoais que sumiram', () => {
    expect(agendasOcultasValidas(['a1', 'a2', AGENDA_COMPROMISSOS, AGENDA_ATUALIZACOES], ['a1'])).toEqual(['a1', AGENDA_COMPROMISSOS, AGENDA_ATUALIZACOES]);
  });

  it('esconder e mostrar uma agenda, com teto', () => {
    expect(alternarAgendaOculta([], 'a1')).toEqual(['a1']);
    expect(alternarAgendaOculta(['a1', 'a2'], 'a1')).toEqual(['a2']);
    expect(alternarAgendaOculta(['a1', 'a2'], 'a3', 2)).toEqual(['a1', 'a2']);
    expect(alternarAgendaOculta(['a1', 'a2'], 'a2', 2)).toEqual(['a1']);
  });

  it('quais agendas pedir à API: vazio = todas, e nunca pedir "todas" por engano', () => {
    const duas = [pessoal('a1'), pessoal('a2')];
    expect(agendasParaBuscar(duas, [])).toEqual({ ids: [], semEventos: false });
    expect(agendasParaBuscar(duas, [AGENDA_COMPROMISSOS])).toEqual({ ids: [], semEventos: false });
    expect(agendasParaBuscar(duas, ['a1'])).toEqual({ ids: ['a2'], semEventos: false });
    expect(agendasParaBuscar(duas, ['a1', 'a2'])).toEqual({ ids: [], semEventos: true });
    expect(agendasParaBuscar([], [])).toEqual({ ids: [], semEventos: true });
    // id velho na preferência não esconde nada que existe.
    expect(agendasParaBuscar(duas, ['sumiu'])).toEqual({ ids: [], semEventos: false });
  });
});

describe('itens do calendário', () => {
  it('compromisso: título dos alunos, dias que toca e cancelado', () => {
    const c = compromisso('c1', em(HOJE, '23:30'), em('2026-10-30', '00:30'));
    const item = itemDeCompromisso(c);
    expect(item.fonte).toEqual({ origem: 'COMPROMISSO', compromisso: c });
    expect(item).toMatchObject({ chave: 'compromisso:c1', origem: 'COMPROMISSO', agendaId: AGENDA_COMPROMISSOS, titulo: 'Ana', data: HOJE, dataFim: '2026-10-30', cancelado: false, recorrente: false });
    expect(itemDeCompromisso(compromisso('c2', em(HOJE, '10:00'), em(HOJE, '11:00'), { cancelado: true, serieId: 's' }))).toMatchObject({ cancelado: true, recorrente: true });
    // Termina exatamente à meia-noite: não toca o dia seguinte.
    expect(itemDeCompromisso(compromisso('c3', em(HOJE, '23:00'), em('2026-10-30', '00:00'))).dataFim).toBe(HOJE);
  });

  it('evento: chave por ocorrência, cor da agenda e cor neutra quando a agenda sumiu', () => {
    const o = ocorrencia('e1', 'a1', em(HOJE, '09:00'), em(HOJE, '10:00'), { dataOriginal: '2026-10-22', recorrente: true });
    expect(itemDeEvento(o, [pessoal('a1', 'OLIVA')])).toMatchObject({ chave: 'evento:e1:2026-10-22', ocorrencia: '2026-10-22', cor: 'OLIVA', recorrente: true, data: HOJE });
    expect(itemDeEvento(o, []).cor).toBe('ARDOSIA');
  });

  it('atualização: dia inteiro no dia do prazo; sem data não vira item; pasta sem linha ainda tem chave', () => {
    expect(dataDaAtualizacao(atualizacao('u1', '2026-10-29T12:00:00'))).toBe(HOJE);
    expect(dataDaAtualizacao(atualizacao('u1', null))).toBeNull();
    expect(dataDaAtualizacao(atualizacao('u1', '2026-02-31'))).toBeNull();
    const item = itemDeAtualizacao(atualizacao('u1', HOJE))!;
    expect(item).toMatchObject({ chave: 'atualizacao:u1', origem: 'ATUALIZACAO', diaInteiro: true, data: HOJE, dataFim: HOJE, titulo: 'Bia', agendaId: AGENDA_ATUALIZACOES });
    const semLinha = itemDeAtualizacao(atualizacao(null, HOJE))!;
    expect(semLinha).toMatchObject({ chave: 'atualizacao:pasta1', refId: null });
    expect(item.refId).toBe('u1');
    expect(item.fonte).toMatchObject({ origem: 'ATUALIZACAO', atualizacao: { id: 'u1', pastaId: 'pasta1' } });
    expect(itemDeAtualizacao(atualizacao('u2', null))).toBeNull();
    expect(itemDeAtualizacao(atualizacao('u3', HOJE, { nomeAluno: null }))?.titulo).toBe('Aluno');
  });

  it('mescla as três fontes: dia inteiro primeiro, depois por horário, e sem as agendas escondidas', () => {
    const itens = mesclarItens({
      compromissos: [compromisso('c1', em(HOJE, '10:00'), em(HOJE, '11:00'))],
      eventos: [ocorrencia('e1', 'a1', em(HOJE, '08:00'), em(HOJE, '09:00')), ocorrencia('e2', 'a1', em(HOJE, '00:00'), em('2026-10-30', '00:00'), { diaInteiro: true })],
      atualizacoes: [atualizacao('u1', HOJE), atualizacao('u2', null)],
      agendas: [pessoal('a1')],
    });
    expect(itens.map((i) => i.chave)).toEqual(['atualizacao:u1', 'evento:e2:2026-10-29', 'evento:e1:2026-10-29', 'compromisso:c1']);
    const sem = mesclarItens({ compromissos: [compromisso('c1', em(HOJE, '10:00'), em(HOJE, '11:00'))], eventos: [ocorrencia('e1', 'a1', em(HOJE, '08:00'), em(HOJE, '09:00'))],
      atualizacoes: [atualizacao('u1', HOJE)], agendas: [pessoal('a1')], ocultas: [AGENDA_COMPROMISSOS, 'a1'] });
    expect(sem.map((i) => i.chave)).toEqual(['atualizacao:u1']);
    expect(mesclarItens({})).toEqual([]);
  });

  it('agrupa por dia (todos os dias, vazios também) e repete o que cruza a meia-noite', () => {
    const noite = itemDeCompromisso(compromisso('c1', em(HOJE, '23:30'), em('2026-10-30', '00:30')));
    const dias = agruparPorDia([noite, evento('e1', '08:00', '09:00')], '2026-10-28', '2026-10-31');
    expect(dias.map((d) => d.data)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
    expect(dias.map((d) => d.itens.map((i) => i.refId))).toEqual([[], ['e1', 'c1'], ['c1'], []]);
    expect(agruparPorDia([noite], '2026-10-29', '2026-10-29')[0].itens).toHaveLength(1);
  });

  it('conta os itens de cada dia', () => {
    const noite = itemDeCompromisso(compromisso('c1', em(HOJE, '23:30'), em('2026-10-30', '00:30')));
    const contagem = contagemPorDia([noite, evento('e1', '08:00', '09:00')]);
    expect(contagem.get(HOJE)).toBe(2);
    expect(contagem.get('2026-10-30')).toBe(1);
    expect(contagem.get('2026-10-31')).toBeUndefined();
  });
});

describe('aviso de evento no mesmo horário (P5)', () => {
  const intervalo = { inicio: em(HOJE, '10:00'), fim: em(HOJE, '11:00') };

  it('só eventos contam por padrão; encostar não é sobrepor; dia inteiro e cancelado não contam', () => {
    const itens: ItemDoCalendario[] = [
      evento('e1', '10:30', '11:30'),
      evento('e2', '11:00', '12:00'),
      evento('e3', '09:00', '10:00'),
      evento('e4', '00:00', '23:59', { diaInteiro: true }),
      itemDeCompromisso(compromisso('c1', em(HOJE, '10:00'), em(HOJE, '11:00'))),
      itemDeCompromisso(compromisso('c2', em(HOJE, '10:00'), em(HOJE, '11:00'), { cancelado: true })),
    ];
    expect(itensQueSobrepoem(itens, intervalo).map((i) => i.refId)).toEqual(['e1']);
    expect(itensQueSobrepoem(itens, intervalo, { origens: ['EVENTO', 'COMPROMISSO'] }).map((i) => i.refId)).toEqual(['e1', 'c1']);
  });

  it('ao editar, o próprio evento (ou a própria ocorrência) fica de fora', () => {
    const a = evento('e1', '10:00', '11:00');
    const b = evento('e1', '10:30', '11:30', { dataOriginal: '2026-10-30' });
    expect(itensQueSobrepoem([a, b], intervalo, { ignorarEventoId: 'e1' })).toEqual([]);
    expect(itensQueSobrepoem([a, b], intervalo, { ignorarChave: a.chave }).map((i) => i.chave)).toEqual([b.chave]);
  });

  it('o texto do aviso nunca traz o título', () => {
    expect(textoDoAvisoDeSobreposicao(0)).toBeNull();
    expect(textoDoAvisoDeSobreposicao(1)).toBe('Você já tem um evento neste horário. Dá para salvar mesmo assim.');
    expect(textoDoAvisoDeSobreposicao(3)).toBe('Você já tem 3 eventos neste horário. Dá para salvar mesmo assim.');
  });
});

describe('contagem do Ano', () => {
  const resumo = [{ data: '2026-10-29', compromissos: 2, eventos: 1 }, { data: '2026-10-30', compromissos: 0, eventos: 0 }];

  it('soma compromissos, eventos e atualizações do dia; dia sem nada fica de fora', () => {
    const mapa = contagemDoAno(resumo, [atualizacao('u1', HOJE), atualizacao('u2', '2026-11-02'), atualizacao('u3', null)], { ocultas: [], semEventos: false });
    expect(mapa.get(HOJE)).toEqual({ compromissos: 2, eventos: 1, atualizacoes: 1, total: 4 });
    expect(mapa.get('2026-11-02')).toEqual({ compromissos: 0, eventos: 0, atualizacoes: 1, total: 1 });
    expect(mapa.has('2026-10-30')).toBe(false);
  });

  it('zera o que está escondido ou sem eventos', () => {
    const mapa = contagemDoAno(resumo, [atualizacao('u1', HOJE)], { ocultas: [AGENDA_COMPROMISSOS, AGENDA_ATUALIZACOES], semEventos: false });
    expect(mapa.get(HOJE)).toEqual({ compromissos: 0, eventos: 1, atualizacoes: 0, total: 1 });
    const sem = contagemDoAno(resumo, [], { ocultas: [AGENDA_COMPROMISSOS], semEventos: true });
    expect(sem.size).toBe(0);
  });
});

describe('grade de horários', () => {
  const grade = { alturaPorHora: 60 }; // 1 px por minuto

  it('posiciona pelo horário de Brasília', () => {
    const { segmentos } = colunaDoDia([evento('e1', '10:00', '11:30')], HOJE, grade);
    expect(segmentos).toHaveLength(1);
    expect(segmentos[0]).toMatchObject({ minutoInicio: 600, minutoFim: 690, topo: 600, altura: 90, coluna: 0, colunas: 1, esquerda: 0, largura: 1, continuaDeOntem: false, continuaAmanha: false });
  });

  it('sobrepostos dividem a largura; quem encosta fica em colunas separadas do grupo', () => {
    const dois = colunaDoDia([evento('e1', '10:00', '11:00'), evento('e2', '10:30', '11:30')], HOJE, grade).segmentos;
    expect(dois.map((s) => [s.item.refId, s.coluna, s.colunas, s.esquerda, s.largura])).toEqual([['e1', 0, 2, 0, 0.5], ['e2', 1, 2, 0.5, 0.5]]);
    const seguidos = colunaDoDia([evento('e1', '10:00', '11:00'), evento('e2', '11:00', '12:00')], HOJE, grade).segmentos;
    expect(seguidos.map((s) => [s.coluna, s.colunas])).toEqual([[0, 1], [0, 1]]);
  });

  it('o grupo é conectado: o terceiro reaproveita a coluna livre', () => {
    const tres = colunaDoDia([evento('a', '10:00', '12:00'), evento('b', '10:30', '11:00'), evento('c', '11:15', '11:45')], HOJE, grade).segmentos;
    expect(tres.map((s) => [s.item.refId, s.coluna, s.colunas])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 1, 2]]);
  });

  it('a altura mínima conta na hora de achar sobrepostos (item curto não pinta por cima)', () => {
    const curtos = colunaDoDia([evento('e1', '10:00', '10:05'), evento('e2', '10:10', '10:15')], HOJE, { alturaPorHora: 60, alturaMinima: 24 }).segmentos;
    expect(curtos.map((s) => [s.altura, s.coluna, s.colunas])).toEqual([[24, 0, 2], [24, 1, 2]]);
    const separados = colunaDoDia([evento('e1', '10:00', '10:05'), evento('e2', '10:30', '10:35')], HOJE, { alturaPorHora: 60, alturaMinima: 24 }).segmentos;
    expect(separados.map((s) => s.colunas)).toEqual([1, 1]);
  });

  it('o item no fim do dia não passa de 24 horas', () => {
    const [s] = colunaDoDia([evento('e1', '23:58', '23:59')], HOJE, { alturaPorHora: 60, alturaMinima: 24 }).segmentos;
    expect(s.topo + s.altura).toBeLessThanOrEqual(1440);
  });

  it('corta no dia o que atravessa a meia-noite, um pedaço em cada dia', () => {
    const noite = itemDeCompromisso(compromisso('c1', em(HOJE, '23:30'), em('2026-10-30', '00:30')));
    const hoje = colunaDoDia([noite], HOJE, grade).segmentos[0];
    const amanha = colunaDoDia([noite], '2026-10-30', grade).segmentos[0];
    expect(hoje).toMatchObject({ minutoInicio: 1410, minutoFim: 1440, continuaAmanha: true, continuaDeOntem: false, chave: `compromisso:c1@${HOJE}` });
    expect(amanha).toMatchObject({ minutoInicio: 0, minutoFim: 30, continuaDeOntem: true, continuaAmanha: false, chave: 'compromisso:c1@2026-10-30' });
    expect(colunaDoDia([noite], '2026-10-31', grade).segmentos).toEqual([]);
    expect(colunaDoDia([noite], '2026-10-28', grade).segmentos).toEqual([]);
  });

  it('dia inteiro vai para a faixa do topo, em todos os dias que cobre', () => {
    const tudo = itemDeAtualizacao(atualizacao('u1', HOJE))!;
    const varios = evento('e9', '00:00', '00:00', { diaInteiro: true, inicio: em(HOJE, '00:00'), fim: em('2026-10-31', '00:00') });
    const col = colunaDoDia([tudo, varios, evento('e1', '08:00', '09:00')], HOJE, grade);
    expect(col.diaInteiro.map((i) => i.chave)).toEqual(['atualizacao:u1', 'evento:e9:2026-10-29']);
    expect(col.segmentos).toHaveLength(1);
    expect(colunaDoDia([varios], '2026-10-30', grade).diaInteiro).toHaveLength(1);
    expect(colunaDoDia([varios], '2026-10-31', grade).diaInteiro).toHaveLength(0);
  });

  it('a hora de agora e os rótulos', () => {
    expect(minutoDoDiaEmBrasilia('2026-10-29T15:30:00Z')).toBe(750);
    expect(minutoDoDiaEmBrasilia('2026-10-29T02:00:00Z')).toBe(23 * 60);
    expect(ROTULOS_DAS_HORAS).toHaveLength(24);
    expect(ROTULOS_DAS_HORAS[0]).toBe('00:00');
    expect(ROTULOS_DAS_HORAS[23]).toBe('23:00');
  });

  it('abre rolada às 07:00, ou uma hora antes do primeiro item mais cedo', () => {
    expect(minutoInicialDaGrade([], [HOJE])).toBe(420);
    expect(minutoInicialDaGrade([evento('e1', '05:00', '06:00')], [HOJE])).toBe(240);
    expect(minutoInicialDaGrade([evento('e1', '12:00', '13:00')], [HOJE])).toBe(420);
    expect(minutoInicialDaGrade([evento('e1', '07:30', '08:00')], [HOJE])).toBe(390);
    expect(minutoInicialDaGrade([evento('e1', '00:30', '01:00')], [HOJE])).toBe(0);
  });
});
