import type { AgendaPessoal, EventoDetalhe, OcorrenciaDeEvento } from '../api/agendaTipos';
import { instanteDeBrasilia } from './agendaPresencial';
import {
  AJUDA_DIAS_UTEIS,
  LIMITES_DA_AGENDA,
  LIMITES_DO_EVENTO,
  NOME_DA_AGENDA_PADRAO,
  PRIVACIDADE_DO_EVENTO,
  agendaDoFormulario,
  alvoDoEvento,
  avisoDoPrimeiroDia,
  ehSerieDeEventos,
  escoposDoEvento,
  escoposParaExcluirEvento,
  explicacaoDoEscopoDoEvento,
  formularioDeEventoNovo,
  formularioDoEvento,
  garantirAgendaPadrao,
  mudouAAgendaDoEvento,
  mudouADataDoEvento,
  pedidoDaAgenda,
  pedidoDeCruzamento,
  pedidoDoEvento,
  podeCriarAgenda,
  primeiroDiaDaRegra,
  repeticaoDoEvento,
  textoDeApagarAgenda,
  textoDeExcluirEvento,
  textoDoCruzamento,
  textoDoErroDoCalendario,
  trocarTipoDaRepeticaoDoEvento,
  SEM_REPETICAO_DO_EVENTO,
  type FormularioDoEvento,
} from './agendaEvento';

const HOJE = '2026-10-29'; // quinta-feira

const agenda = (id: string, nome = `Agenda ${id}`): AgendaPessoal => ({ id, nome, cor: 'AZUL', versao: 0 });

function valido(extra: Partial<FormularioDoEvento> = {}): FormularioDoEvento {
  return { ...formularioDeEventoNovo('a1', HOJE, '09:00'), titulo: '  Reunião  ', ...extra };
}

function detalhe(extra: Partial<EventoDetalhe> = {}): EventoDetalhe {
  return {
    id: 'e1', agendaId: 'a1', titulo: 'Reunião', local: 'Sala 2', descricao: null, data: '2026-10-26', diaInteiro: false, hora: '09:00',
    duracaoMinutos: 60, repeticao: null, versao: 3, ocorrencia: null, ...extra,
  };
}

function ocorrencia(extra: Partial<OcorrenciaDeEvento> = {}): OcorrenciaDeEvento {
  return {
    eventoId: 'e1', agendaId: 'a1', dataOriginal: '2026-11-02', data: '2026-11-02', hora: '09:30', horaFim: '10:15',
    inicio: instanteDeBrasilia('2026-11-02', '09:30'), fim: instanteDeBrasilia('2026-11-02', '10:15'), diaInteiro: false,
    titulo: 'Reunião do dia', local: null, descricao: 'Pauta', recorrente: true, ...extra,
  };
}

describe('constantes do evento', () => {
  it('limites da API e textos fixos', () => {
    expect(LIMITES_DO_EVENTO).toMatchObject({ titulo: 120, local: 120, descricao: 1000, duracaoMinima: 5, duracaoMaxima: 1440, vezesMinimo: 2, vezesMaximo: 999, eventos: 1000 });
    expect(LIMITES_DA_AGENDA).toEqual({ nome: 40, agendas: 20 });
    expect(AJUDA_DIAS_UTEIS).toMatch(/Feriados/);
    expect(PRIVACIDADE_DO_EVENTO).toMatch(/aluno/);
  });
});

describe('primeiro dia da regra', () => {
  it('semanal começa no primeiro dia escolhido a partir da data; dias úteis pulam o fim de semana', () => {
    expect(primeiroDiaDaRegra(HOJE, 'SEMANAL', ['MONDAY'])).toBe('2026-11-02');
    expect(primeiroDiaDaRegra(HOJE, 'SEMANAL', ['THURSDAY', 'MONDAY'])).toBe(HOJE);
    expect(primeiroDiaDaRegra('2026-10-31', 'DIAS_UTEIS', [])).toBe('2026-11-02');
    expect(primeiroDiaDaRegra('2026-11-01', 'DIAS_UTEIS', [])).toBe('2026-11-02');
    expect(primeiroDiaDaRegra(HOJE, 'DIAS_UTEIS', [])).toBe(HOJE);
    expect(primeiroDiaDaRegra(HOJE, 'DIARIA', [])).toBe(HOJE);
    expect(primeiroDiaDaRegra('2026-01-31', 'MENSAL', [])).toBe('2026-01-31');
  });

  it('avisa quando o primeiro evento é depois da data escolhida', () => {
    expect(avisoDoPrimeiroDia('2026-10-31', 'DIAS_UTEIS', [], HOJE)).toContain('02/11');
    expect(avisoDoPrimeiroDia(HOJE, 'DIAS_UTEIS', [], HOJE)).toBeNull();
    expect(avisoDoPrimeiroDia(HOJE, 'NENHUMA', [], HOJE)).toBeNull();
  });
});

describe('repetição do evento', () => {
  const base = { ...SEM_REPETICAO_DO_EVENTO, dias: [] as typeof SEM_REPETICAO_DO_EVENTO.dias };

  it('não se repete: nada vai no pedido', () => {
    expect(repeticaoDoEvento(base, HOJE)).toEqual({ erros: {}, repeticao: null });
  });

  it('o fim é opcional: "nunca" não manda data nem vezes', () => {
    expect(repeticaoDoEvento({ ...base, tipo: 'DIARIA' }, HOJE).repeticao).toEqual({ tipo: 'DIARIA' });
    expect(repeticaoDoEvento({ ...base, tipo: 'MENSAL', fim: 'NUNCA', ate: '01/01/2030', vezes: '5' }, HOJE).repeticao).toEqual({ tipo: 'MENSAL' });
  });

  it('semanal pede ao menos um dia, mas não precisa incluir o da data', () => {
    expect(repeticaoDoEvento({ ...base, tipo: 'SEMANAL' }, HOJE).erros.dias).toBe('Escolha os dias da semana.');
    expect(repeticaoDoEvento({ ...base, tipo: 'SEMANAL', dias: ['WEDNESDAY', 'MONDAY'] }, HOJE).repeticao)
      .toEqual({ tipo: 'SEMANAL', diasDaSemana: ['MONDAY', 'WEDNESDAY'] });
  });

  it('dias da semana só vão no semanal', () => {
    expect(repeticaoDoEvento({ ...base, tipo: 'DIARIA', dias: ['MONDAY'] }, HOJE).repeticao).toEqual({ tipo: 'DIARIA' });
  });

  it('fim numa data: válida, no intervalo e não antes do primeiro dia', () => {
    const r = (ate: string, tipo: 'DIARIA' | 'DIAS_UTEIS' = 'DIARIA', primeira = HOJE) => repeticaoDoEvento({ ...base, tipo, fim: 'DATA', ate }, primeira);
    expect(r('').erros.ate).toBe('Informe a data final.');
    expect(r('31/02/2027').erros.ate).toBe('Data final inválida.');
    expect(r('01/01/2101').erros.ate).toMatch(/2000 e 2100/);
    expect(r('28/10/2026').erros.ate).toMatch(/antes do primeiro dia/);
    expect(r('29/10/2026').repeticao).toEqual({ tipo: 'DIARIA', ate: '2026-10-29' });
    // Dias úteis a partir de sábado: o primeiro dia é a segunda, então 01/11 já é antes dele.
    expect(r('01/11/2026', 'DIAS_UTEIS', '2026-10-31').erros.ate).toMatch(/antes do primeiro dia/);
    expect(r('02/11/2026', 'DIAS_UTEIS', '2026-10-31').repeticao).toEqual({ tipo: 'DIAS_UTEIS', ate: '2026-11-02' });
  });

  it('fim por vezes: de 2 a 999, só dígitos', () => {
    const r = (vezes: string) => repeticaoDoEvento({ ...base, tipo: 'DIARIA', fim: 'VEZES', vezes }, HOJE);
    expect(r('').erros.vezes).toBe('Informe quantas vezes.');
    expect(r('x').erros.vezes).toBe('Use só números.');
    expect(r('1').erros.vezes).toMatch(/2 a 999/);
    expect(r('1000').erros.vezes).toMatch(/2 a 999/);
    expect(r('2').repeticao).toEqual({ tipo: 'DIARIA', vezes: 2 });
    expect(r('999').repeticao).toEqual({ tipo: 'DIARIA', vezes: 999 });
  });

  it('semanal nasce com o dia da semana da data marcado', () => {
    expect(trocarTipoDaRepeticaoDoEvento(base, 'SEMANAL', '29/10/2026').dias).toEqual(['THURSDAY']);
    expect(trocarTipoDaRepeticaoDoEvento({ ...base, dias: ['MONDAY'] }, 'SEMANAL', '29/10/2026').dias).toEqual(['MONDAY']);
    expect(trocarTipoDaRepeticaoDoEvento({ ...base, tipo: 'SEMANAL', dias: ['MONDAY'] }, 'DIARIA', '29/10/2026').dias).toEqual([]);
  });
});

describe('escopos de série', () => {
  it('avulso só aceita ESTA; série, os três, menos nas restrições da API', () => {
    expect(escoposDoEvento(false)).toEqual(['ESTA']);
    expect(escoposDoEvento(false, { mudouData: true, mudouAgenda: true })).toEqual(['ESTA']);
    expect(escoposDoEvento(true)).toEqual(['ESTA', 'SEGUINTES', 'TODAS']);
    expect(escoposDoEvento(true, { mudouData: true })).toEqual(['ESTA']);
    expect(escoposDoEvento(true, { mudouAgenda: true })).toEqual(['TODAS']);
    expect(escoposDoEvento(true, { mudouData: true, mudouAgenda: true })).toEqual([]);
    expect(escoposParaExcluirEvento(false)).toEqual(['ESTA']);
    expect(escoposParaExcluirEvento(true)).toEqual(['ESTA', 'SEGUINTES', 'TODAS']);
  });

  it('o alvo do pedido: avulso nada; ESTA e SEGUINTES levam a ocorrência; TODAS não', () => {
    expect(alvoDoEvento(false, 'ESTA', '2026-11-02')).toEqual({});
    expect(alvoDoEvento(true, 'ESTA', '2026-11-02')).toEqual({ escopo: 'ESTA', ocorrencia: '2026-11-02' });
    expect(alvoDoEvento(true, 'SEGUINTES', '2026-11-02')).toEqual({ escopo: 'SEGUINTES', ocorrencia: '2026-11-02' });
    expect(alvoDoEvento(true, 'TODAS', '2026-11-02')).toEqual({ escopo: 'TODAS' });
  });

  it('textos de explicação e de confirmar a exclusão', () => {
    expect(explicacaoDoEscopoDoEvento('ESTA', '2026-11-02', HOJE)).toContain('02/11');
    expect(explicacaoDoEscopoDoEvento('SEGUINTES', '2026-11-02', HOJE)).toMatch(/seguintes/);
    expect(explicacaoDoEscopoDoEvento('TODAS', '2026-11-02', HOJE)).toMatch(/Todos os eventos/);
    expect(textoDeExcluirEvento('ESTA', false)).toBe('Excluir este evento? Não dá para desfazer.');
    expect(textoDeExcluirEvento('ESTA', true)).toMatch(/Os outros da série continuam/);
    expect(textoDeExcluirEvento('SEGUINTES', true)).toMatch(/anteriores continuam/);
    expect(textoDeExcluirEvento('TODAS', true)).toMatch(/série inteira/);
  });
});

describe('formulário do evento', () => {
  it('evento novo: sem título, uma hora de duração e sem repetição', () => {
    const f = formularioDeEventoNovo('a1', HOJE);
    expect(f).toMatchObject({ agendaId: 'a1', titulo: '', data: '29/10/2026', diaInteiro: false, hora: '', duracao: '60' });
    expect(f.repeticao.tipo).toBe('NENHUMA');
  });

  it('abre a ocorrência com a exceção aplicada e a regra de repetição', () => {
    const e = detalhe({ repeticao: { tipo: 'SEMANAL', diasDaSemana: ['MONDAY', 'FRIDAY'], vezes: 10 }, ocorrencia: ocorrencia() });
    expect(formularioDoEvento(e)).toEqual({
      agendaId: 'a1', titulo: 'Reunião do dia', local: '', descricao: 'Pauta', data: '02/11/2026', diaInteiro: false, hora: '09:30', duracao: '45',
      repeticao: { tipo: 'SEMANAL', dias: ['MONDAY', 'FRIDAY'], fim: 'VEZES', ate: '', vezes: '10' },
    });
    expect(ehSerieDeEventos(e)).toBe(true);
    expect(ehSerieDeEventos(detalhe())).toBe(false);
    expect(ehSerieDeEventos(detalhe({ repeticao: { tipo: 'NENHUMA' } }))).toBe(false);
  });

  it('sem ocorrência (a aberta foi cancelada) usa a regra; fim numa data e dia inteiro', () => {
    const f = formularioDoEvento(detalhe({ repeticao: { tipo: 'DIARIA', ate: '2026-12-31' }, diaInteiro: true, hora: null, duracaoMinutos: null }));
    expect(f).toMatchObject({ titulo: 'Reunião', local: 'Sala 2', data: '26/10/2026', diaInteiro: true, hora: '', duracao: '60' });
    expect(f.repeticao).toMatchObject({ tipo: 'DIARIA', fim: 'DATA', ate: '31/12/2026' });
    const nunca = formularioDoEvento(detalhe({ repeticao: { tipo: 'MENSAL' } }));
    expect(nunca.repeticao.fim).toBe('NUNCA');
  });

  it('mudou a data ou a agenda', () => {
    const o = ocorrencia();
    expect(mudouADataDoEvento({ data: '02/11/2026' }, o)).toBe(false);
    expect(mudouADataDoEvento({ data: '03/11/2026' }, o)).toBe(true);
    expect(mudouAAgendaDoEvento({ agendaId: 'a2' }, detalhe())).toBe(true);
    expect(mudouAAgendaDoEvento({ agendaId: 'a1' }, detalhe())).toBe(false);
  });
});

describe('pedido do evento', () => {
  it('evento novo com horário: aparado, com hora e duração, sem versão', () => {
    const { erros, pedido } = pedidoDoEvento(valido({ local: '  Sala 1 ', descricao: '   ' }));
    expect(erros).toEqual({});
    expect(pedido).toEqual({
      agendaId: 'a1', titulo: 'Reunião', local: 'Sala 1', descricao: null, data: HOJE, diaInteiro: false, hora: '09:00', duracaoMinutos: 60, repeticao: null,
    });
    expect(pedido).not.toHaveProperty('versao');
  });

  it('dia inteiro não manda hora nem duração e não confere os dois', () => {
    const { erros, pedido } = pedidoDoEvento(valido({ diaInteiro: true, hora: 'xx', duracao: '0' }));
    expect(erros).toEqual({});
    expect(pedido).toMatchObject({ diaInteiro: true, hora: null, duracaoMinutos: null });
  });

  it('confere cada campo com a regra da API', () => {
    const ruim = pedidoDoEvento(valido({ agendaId: '', titulo: ' ', hora: '', duracao: '4', data: '31/02/2026', local: 'x'.repeat(121), descricao: 'x'.repeat(1001) }));
    expect(ruim.pedido).toBeNull();
    expect(Object.keys(ruim.erros).sort()).toEqual(['agendaId', 'data', 'descricao', 'duracao', 'hora', 'local', 'titulo']);
    expect(pedidoDoEvento(valido({ titulo: 'x'.repeat(121) })).erros.titulo).toMatch(/120/);
    expect(pedidoDoEvento(valido({ hora: '25:00' })).erros.hora).toMatch(/HH:MM/);
    expect(pedidoDoEvento(valido({ duracao: '1441' })).erros.duracao).toMatch(/5 a 1440/);
    expect(pedidoDoEvento(valido({ duracao: '5' })).erros).toEqual({});
    expect(pedidoDoEvento(valido({ duracao: '1440' })).erros).toEqual({});
    expect(pedidoDoEvento(valido({ data: '' })).erros.data).toBe('Informe a data.');
    expect(pedidoDoEvento(valido({ data: '01/01/1999' })).erros.data).toMatch(/2000 e 2100/);
  });

  it('a repetição inválida vira o erro "Confira a repetição" e o detalhe por campo', () => {
    const r = pedidoDoEvento(valido({ repeticao: { ...SEM_REPETICAO_DO_EVENTO, tipo: 'SEMANAL', dias: [] } }));
    expect(r.pedido).toBeNull();
    expect(r.erros.repeticao).toBe('Confira a repetição.');
    expect(r.errosDaRepeticao.dias).toBe('Escolha os dias da semana.');
  });

  it('criar com repetição manda a regra', () => {
    const { pedido } = pedidoDoEvento(valido({ repeticao: { ...SEM_REPETICAO_DO_EVENTO, tipo: 'DIAS_UTEIS', fim: 'VEZES', vezes: '20' } }));
    expect(pedido?.repeticao).toEqual({ tipo: 'DIAS_UTEIS', vezes: 20 });
  });

  it('alterar avulso leva a versão e pode ganhar repetição', () => {
    const { pedido } = pedidoDoEvento(valido({ repeticao: { ...SEM_REPETICAO_DO_EVENTO, tipo: 'DIARIA' } }), { versao: 3 });
    expect(pedido).toMatchObject({ versao: 3, repeticao: { tipo: 'DIARIA' } });
  });

  describe('numa série', () => {
    const f = valido({ data: '02/11/2026', repeticao: { ...SEM_REPETICAO_DO_EVENTO, tipo: 'SEMANAL', dias: ['MONDAY'] } });
    const serie = (escopo: 'ESTA' | 'SEGUINTES' | 'TODAS') => ({ escopo, ocorrencia: '2026-11-02', primeiroDia: '2026-10-26' } as const);

    it('ESTA usa a data do formulário (pode mover) e não manda a repetição', () => {
      const { pedido } = pedidoDoEvento({ ...f, data: '04/11/2026' }, { versao: 3, serie: serie('ESTA') });
      expect(pedido).toMatchObject({ data: '2026-11-04', versao: 3, repeticao: null });
    });

    it('SEGUINTES leva a data da ocorrência, como a API exige, e a regra nova', () => {
      const { pedido } = pedidoDoEvento({ ...f, data: '04/11/2026' }, { versao: 3, serie: serie('SEGUINTES') });
      expect(pedido).toMatchObject({ data: '2026-11-02', repeticao: { tipo: 'SEMANAL', diasDaSemana: ['MONDAY'] } });
      const sem = pedidoDoEvento(f, { versao: 3, serie: { escopo: 'SEGUINTES', ocorrencia: null, primeiroDia: '2026-10-26' } });
      expect(sem.pedido).toBeNull();
      expect(sem.erros.data).toBeDefined();
    });

    it('TODAS leva o primeiro dia da regra', () => {
      const { pedido } = pedidoDoEvento(f, { versao: 3, serie: serie('TODAS') });
      expect(pedido).toMatchObject({ data: '2026-10-26', repeticao: { tipo: 'SEMANAL' } });
    });
  });
});

describe('aviso de cruzamento (P5)', () => {
  it('a pergunta leva só horário e repetição; o título não importa; incompleto ou dia inteiro não pergunta', () => {
    const f = valido({ titulo: '', agendaId: '', local: 'Sala', repeticao: { ...SEM_REPETICAO_DO_EVENTO, tipo: 'DIARIA' } });
    expect(pedidoDeCruzamento(f)).toEqual({
      eventoId: null, data: HOJE, diaInteiro: false, hora: '09:00', duracaoMinutos: 60, repeticao: { tipo: 'DIARIA' },
    });
    expect(pedidoDeCruzamento(valido(), 'e1')).toMatchObject({ eventoId: 'e1', repeticao: null });
    expect(pedidoDeCruzamento(valido({ hora: '' }))).toBeNull();
    expect(pedidoDeCruzamento(valido({ hora: '25:00' }))).toBeNull();
    expect(pedidoDeCruzamento(valido({ duracao: '' }))).toBeNull();
    expect(pedidoDeCruzamento(valido({ data: '31/02/2026' }))).toBeNull();
    expect(pedidoDeCruzamento(valido({ repeticao: { ...SEM_REPETICAO_DO_EVENTO, tipo: 'SEMANAL', dias: [] } }))).toBeNull();
    expect(pedidoDeCruzamento(valido({ diaInteiro: true }))).toBeNull();
  });

  it('o texto: singular, lista, "e mais N", "pode haver mais"; zero não avisa', () => {
    expect(textoDoCruzamento(null, HOJE)).toBeNull();
    expect(textoDoCruzamento({ quantidade: 0, datas: [], incompleto: false }, HOJE)).toBeNull();
    expect(textoDoCruzamento({ quantidade: 1, datas: ['2026-11-02'], incompleto: false }, HOJE))
      .toBe('Cruza com 1 horário: 02/11. Dá para salvar mesmo assim.');
    expect(textoDoCruzamento({ quantidade: 3, datas: ['2026-11-02', '2026-11-09', '2026-11-16'], incompleto: false }, HOJE))
      .toBe('Cruza com 3 horários: 02/11, 09/11 e 16/11. Dá para salvar mesmo assim.');
    const cinco = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
    expect(textoDoCruzamento({ quantidade: 12, datas: cinco, incompleto: false }, HOJE))
      .toBe('Cruza com 12 horários: 02/11, 03/11, 04/11, 05/11, 06/11 e mais 7. Dá para salvar mesmo assim.');
    expect(textoDoCruzamento({ quantidade: 500, datas: cinco, incompleto: true }, HOJE))
      .toBe('Cruza com 500 horários, pode haver mais: 02/11, 03/11, 04/11, 05/11, 06/11 e outros. Dá para salvar mesmo assim.');
    expect(textoDoCruzamento({ quantidade: 2, datas: [], incompleto: false }, HOJE)).toBe('Cruza com 2 horários. Dá para salvar mesmo assim.');
  });

  it('o texto: data curta no ano atual e com o ano fora dele (série que passa da virada do ano)', () => {
    expect(textoDoCruzamento({ quantidade: 2, datas: ['2026-12-28', '2027-01-04'], incompleto: false }, HOJE))
      .toBe('Cruza com 2 horários: 28/12 e 04/01/2027. Dá para salvar mesmo assim.');
  });
});

describe('agenda padrão', () => {
  it('escolhe a marcada, senão "Pessoal", senão a primeira; sem agenda, nenhuma', () => {
    const lista = [agenda('a1', 'Trabalho'), agenda('a2', 'pessoal'), agenda('a3')];
    expect(agendaDoFormulario(lista, 'a3')?.id).toBe('a3');
    expect(agendaDoFormulario(lista, 'sumiu')?.id).toBe('a2');
    expect(agendaDoFormulario(lista)?.id).toBe('a2');
    expect(agendaDoFormulario([agenda('a1', 'Trabalho')])?.id).toBe('a1');
    expect(agendaDoFormulario([])).toBeNull();
  });

  it('cria a "Pessoal" azul quando ainda não existe', async () => {
    const criar = jest.fn(async (corpo) => ({ id: 'nova', nome: corpo.nome, cor: corpo.cor, versao: 0 }));
    const listar = jest.fn(async () => []);
    const a = await garantirAgendaPadrao({ criar, listar });
    expect(criar).toHaveBeenCalledWith({ nome: NOME_DA_AGENDA_PADRAO, cor: 'AZUL' });
    expect(listar).not.toHaveBeenCalled();
    expect(a.id).toBe('nova');
  });

  it('409 AGENDA_NOME_EM_USO (outra aba criou): relê a lista e usa a que existe', async () => {
    const criar = jest.fn(async () => { throw Object.assign(new Error('x'), { codigo: 'AGENDA_NOME_EM_USO' }); });
    const listar = jest.fn(async () => [agenda('a9', 'Trabalho'), agenda('a8', 'PESSOAL')]);
    expect((await garantirAgendaPadrao({ criar, listar })).id).toBe('a8');
  });

  it('outro erro, ou 409 sem a agenda na lista, sobe', async () => {
    const lista = jest.fn(async () => []);
    await expect(garantirAgendaPadrao({ criar: async () => { throw Object.assign(new Error('x'), { codigo: 'LIMITE_DE_AGENDAS' }); }, listar: lista })).rejects.toMatchObject({ codigo: 'LIMITE_DE_AGENDAS' });
    expect(lista).not.toHaveBeenCalled();
    await expect(garantirAgendaPadrao({ criar: async () => { throw Object.assign(new Error('x'), { codigo: 'AGENDA_NOME_EM_USO' }); }, listar: lista })).rejects.toMatchObject({ codigo: 'AGENDA_NOME_EM_USO' });
  });
});

describe('agendas pessoais', () => {
  const existentes = [agenda('a1', 'Trabalho'), agenda('a2', 'Casa')];

  it('nome de 1 a 40, único sem diferenciar maiúsculas, cor da paleta', () => {
    expect(pedidoDaAgenda('  Estudos ', 'VIOLETA', existentes)).toEqual({ erros: {}, pedido: { nome: 'Estudos', cor: 'VIOLETA' } });
    expect(pedidoDaAgenda('', 'AZUL', existentes).erros.nome).toBe('Informe o nome da agenda.');
    expect(pedidoDaAgenda('x'.repeat(41), 'AZUL', existentes).erros.nome).toMatch(/40/);
    expect(pedidoDaAgenda('x'.repeat(40), 'AZUL', existentes).erros).toEqual({});
    expect(pedidoDaAgenda('TRABALHO', 'AZUL', existentes).erros.nome).toBe('Você já tem uma agenda com esse nome.');
    expect(pedidoDaAgenda('Rosa', 'ROSA', existentes).erros.cor).toBe('Escolha uma das cores da lista.');
    expect(pedidoDaAgenda('Rosa', 'ROSA', existentes).pedido).toBeNull();
  });

  it('renomear mantém o próprio nome e leva a versão', () => {
    expect(pedidoDaAgenda('trabalho', 'TERRA', existentes, { id: 'a1', versao: 4 })).toEqual({ erros: {}, pedido: { nome: 'trabalho', cor: 'TERRA', versao: 4 } });
    expect(pedidoDaAgenda('Casa', 'TERRA', existentes, { id: 'a1', versao: 4 }).erros.nome).toBeDefined();
  });

  it('no máximo 20 agendas: criar a 21ª é recusado, renomear não', () => {
    const vinte = Array.from({ length: 20 }, (_, i) => agenda(`a${i}`));
    expect(podeCriarAgenda(19)).toBe(true);
    expect(podeCriarAgenda(20)).toBe(false);
    expect(pedidoDaAgenda('Nova', 'AZUL', vinte).erros.geral).toMatch(/20 agendas/);
    expect(pedidoDaAgenda('Nova', 'AZUL', vinte, { id: 'a1', versao: 0 }).erros).toEqual({});
  });

  it('o texto de apagar diz quantos eventos vão junto', () => {
    expect(textoDeApagarAgenda(0)).toMatch(/não tem eventos/);
    expect(textoDeApagarAgenda(1)).toBe('Apagar esta agenda e 1 evento dela? Não dá para desfazer.');
    expect(textoDeApagarAgenda(7)).toBe('Apagar esta agenda e 7 eventos dela? Não dá para desfazer.');
  });
});

describe('erros do calendário', () => {
  it('um texto em português por código da API', () => {
    const codigos = [
      'LIMITE_DE_AGENDAS', 'AGENDA_NOME_EM_USO', 'AGENDA_INVALIDA', 'COR_INVALIDA', 'LIMITE_DE_EVENTOS', 'REPETICAO_INVALIDA', 'EVENTO_INVALIDO',
      'EVENTO_SEM_SERIE', 'OCORRENCIA_OBRIGATORIA', 'DATA_SO_NESTA_OCORRENCIA', 'AGENDA_SO_NA_SERIE_TODA', 'CONFLITO_EDICAO', 'PERIODO_INVALIDO', 'FILTRO_INVALIDO',
    ];
    for (const codigo of codigos) expect(textoDoErroDoCalendario({ codigo })).toEqual(expect.any(String));
  });

  it('outros erros, e valores que não são erro, deixam a mensagem da API', () => {
    expect(textoDoErroDoCalendario({ codigo: 'NAO_ENCONTRADO' })).toBeNull();
    expect(textoDoErroDoCalendario(null)).toBeNull();
    expect(textoDoErroDoCalendario('x')).toBeNull();
  });

  it('o conflito de edição diz se é a agenda ou o evento', () => {
    expect(textoDoErroDoCalendario({ codigo: 'CONFLITO_EDICAO' }, 'agenda')).toMatch(/esta agenda/);
    expect(textoDoErroDoCalendario({ codigo: 'CONFLITO_EDICAO' }, 'evento')).toMatch(/este evento/);
  });
});
