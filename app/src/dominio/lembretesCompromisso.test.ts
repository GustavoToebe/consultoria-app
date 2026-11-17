import {
  compromissosDoResponsavelParaLembrete, identificadorDoLembreteDeCompromisso, LIMITE_DE_NOTIFICACOES_LOCAIS, lembretesDeCompromissos, NOTIFICACOES_DA_ATUALIZACAO,
  prefixoDosLembretesDeCompromisso,
} from './lembretesCompromisso';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const agora = new Date('2026-11-04T12:00:00Z');
const em = (horas: number) => new Date(agora.getTime() + horas * HORA).toISOString();
type Entrada = { id: string; inicio: string; situacao: 'AGENDADO' | 'REALIZADO' | 'CANCELADO' | 'FALTOU'; lembretesMinutos: number[] };
const c = (id: string, horas: number, lembretesMinutos: number[] = [30], situacao: Entrada['situacao'] = 'AGENDADO'): Entrada =>
  ({ id, inicio: em(horas), situacao, lembretesMinutos });

describe('lembretes de compromisso (lista escolhida no compromisso)', () => {
  it('um lembrete por antecedência, com chave <id>:<minutos> e o instante certo', () => {
    const lembretes = lembretesDeCompromissos([c('c1', 72, [1440, 30])], agora);
    expect(lembretes.map((l) => [l.chave, l.minutos, l.data.toISOString()])).toEqual([
      ['c1:1440', 1440, em(48)],
      ['c1:30', 30, new Date(agora.getTime() + 72 * HORA - 30 * MINUTO).toISOString()],
    ]);
    expect(lembretes[0].compromissoId).toBe('c1');
  });

  it('lista vazia = nada agendado', () => {
    expect(lembretesDeCompromissos([c('c1', 72, [])], agora)).toEqual([]);
  });

  it('o limite de 40320 minutos (28 dias) vale e o de 1 minuto também', () => {
    const lembretes = lembretesDeCompromissos([c('c1', 24 * 40, [40320, 1])], agora);
    expect(lembretes.map((l) => l.chave)).toEqual(['c1:40320', 'c1:1']);
  });

  it('o texto é um só: sem horário, sem nome, sem número e sem "amanhã" (D5)', () => {
    const lembretes = lembretesDeCompromissos([c('c1', 72, [1440, 120, 30])], agora);
    expect(new Set(lembretes.map((l) => l.texto)).size).toBe(1);
    for (const l of lembretes) {
      expect(l.texto).toBe('Você tem um compromisso chegando. Abra o app para ver.');
      expect(l.texto).not.toMatch(/\d/);
    }
  });

  it('lembrete que já passou é descartado; o que sobra continua', () => {
    // Daqui a 3 h: o de 1 dia já passou, o de 2 h (daqui a 1 h) fica.
    expect(lembretesDeCompromissos([c('c1', 3, [1440, 120])], agora).map((l) => l.chave)).toEqual(['c1:120']);
    expect(lembretesDeCompromissos([c('c1', 1, [1440, 120])], agora)).toEqual([]);
    expect(lembretesDeCompromissos([c('c1', -5, [30])], agora)).toEqual([]);
  });

  it('o instante exato de agora não agenda (precisa ser no futuro)', () => {
    expect(lembretesDeCompromissos([c('c1', 2, [120])], agora)).toEqual([]);
    expect(lembretesDeCompromissos([c('c1', 2, [119])], agora)).toHaveLength(1);
  });

  it('compromisso remarcado: a lista nova gera outros instantes com as mesmas chaves', () => {
    const antes = lembretesDeCompromissos([c('c1', 10, [30])], agora)[0];
    const depois = lembretesDeCompromissos([c('c1', 20, [30])], agora)[0];
    expect(depois.chave).toBe(antes.chave);
    expect(depois.data.getTime() - antes.data.getTime()).toBe(10 * HORA);
  });

  it('só os agendados: cancelado, realizado e falta não lembram', () => {
    const lista = [c('a', 72), c('b', 72, [30], 'CANCELADO'), c('c', 72, [30], 'REALIZADO'), c('d', 72, [30], 'FALTOU')];
    expect(lembretesDeCompromissos(lista, agora).map((l) => l.compromissoId)).toEqual(['a']);
  });

  it('ordem: do disparo mais próximo ao mais distante, intercalando compromissos; empate pela chave', () => {
    // a e m: 1 dia antes = daqui a 6 h; 30 min antes = daqui a 29,5 h; z: daqui a 76 h e 99,5 h.
    const lista = [c('z', 100, [1440, 30]), c('m', 30, [30, 1440]), c('a', 30, [1440, 30])];
    expect(lembretesDeCompromissos(lista, agora).map((l) => l.chave)).toEqual(['a:1440', 'm:1440', 'a:30', 'm:30', 'z:1440', 'z:30']);
  });

  it('compromisso ou minuto repetido conta uma vez; data inválida ou lista nula não quebram', () => {
    expect(lembretesDeCompromissos([c('c1', 72, [30, 30]), c('c1', 72, [30])], agora)).toHaveLength(1);
    expect(lembretesDeCompromissos([{ id: 'x', inicio: 'não é data', situacao: 'AGENDADO', lembretesMinutos: [30] }], agora)).toEqual([]);
    expect(lembretesDeCompromissos([], agora)).toEqual([]);
    expect(lembretesDeCompromissos(null, agora)).toEqual([]);
    expect(lembretesDeCompromissos(undefined, agora)).toEqual([]);
  });

  it('não depende do fuso do aparelho nem da virada do ano: é conta de instantes', () => {
    // 01/01/2027 00:30 em Brasília = 03:30 UTC.
    const lembretes = lembretesDeCompromissos(
      [{ id: 'ny', inicio: '2027-01-01T03:30:00Z', situacao: 'AGENDADO', lembretesMinutos: [1440, 120] }], new Date('2026-12-30T00:00:00Z'),
    );
    expect(lembretes.map((l) => l.data.toISOString())).toEqual(['2026-12-31T03:30:00.000Z', '2027-01-01T01:30:00.000Z']);
  });

  describe('limite de notificações do iOS', () => {
    // 20 compromissos com 5 lembretes cada (100), um a cada 100 horas a partir de 100 h.
    const CINCO = [2880, 1440, 120, 30, 5];
    const muitos = Array.from({ length: 20 }, (_, i) => c(`c${String(i).padStart(2, '0')}`, 100 * (i + 1), CINCO));

    it('12 compromissos com 5 lembretes (60) cabem com 0 reservadas; 13 (65) passam e o corte vem', () => {
      expect(lembretesDeCompromissos(muitos.slice(0, 12), agora, 0)).toHaveLength(60);
      expect(lembretesDeCompromissos(muitos.slice(0, 13), agora)).toHaveLength(LIMITE_DE_NOTIFICACOES_LOCAIS - NOTIFICACOES_DA_ATUALIZACAO);
    });

    it('passou do teto: ficam os de disparo mais próximo, 64 menos as reservadas pelas outras', () => {
      const lembretes = lembretesDeCompromissos(muitos, agora);
      expect(lembretes).toHaveLength(LIMITE_DE_NOTIFICACOES_LOCAIS - NOTIFICACOES_DA_ATUALIZACAO);
      const todos = lembretesDeCompromissos(muitos, agora, 0).slice(0, 61).map((l) => l.chave);
      expect(lembretes.map((l) => l.chave)).toEqual(todos);
      const datas = lembretes.map((l) => l.data.getTime());
      expect([...datas].sort((a, b) => a - b)).toEqual(datas);
    });

    it('o corte é pelo disparo, não pelo início: 2 dias antes de um compromisso distante vence 5 min antes de um mais longe', () => {
      // longe: início daqui a 100 h, dispara daqui a 52 h; depois: início daqui a 200 h, dispara um pouco antes disso.
      const lista = [c('depois', 200, [5]), c('longe', 100, [2880])];
      expect(lembretesDeCompromissos(lista, agora, LIMITE_DE_NOTIFICACOES_LOCAIS - 1).map((l) => l.chave)).toEqual(['longe:2880']);
    });

    it('sem reservas cabem 64; com reservas maiores que o teto, nenhum', () => {
      expect(lembretesDeCompromissos(muitos, agora, 0)).toHaveLength(64);
      expect(lembretesDeCompromissos(muitos, agora, 64)).toEqual([]);
      expect(lembretesDeCompromissos(muitos, agora, 100)).toEqual([]);
      expect(lembretesDeCompromissos(muitos, agora, -5)).toHaveLength(64);
    });
  });

  describe('treinador responsável', () => {
    const equipe = (id: string, responsavelId: string | null, cancelado: boolean, situacoes: ('AGENDADO' | 'REALIZADO' | 'FALTOU' | 'CANCELADO')[]) => ({
      id, inicio: em(72), responsavelId, cancelado, lembretesMinutos: [30],
      participantes: situacoes.map((situacao, i) => ({ id: `a${i}`, nome: 'Aluno Fictício', situacao })),
    });

    it('só os compromissos dele; cancelado e sem aluno agendado não lembram', () => {
      const lista = [
        equipe('meu', 'u1', false, ['AGENDADO']),
        equipe('meu-misto', 'u1', false, ['REALIZADO', 'AGENDADO']),
        equipe('de-outro', 'u2', false, ['AGENDADO']),
        equipe('sem-responsavel', null, false, ['AGENDADO']),
        equipe('cancelado', 'u1', true, ['CANCELADO']),
        equipe('realizado', 'u1', false, ['REALIZADO']),
      ];
      const lembretes = lembretesDeCompromissos(compromissosDoResponsavelParaLembrete(lista, 'u1'), agora);
      expect(lembretes.map((l) => l.chave)).toEqual(['meu-misto:30', 'meu:30']);
    });
  });

  describe('identificadores', () => {
    it('determinísticos: treinos:compromisso:<usuarioId>:<compromissoId>:<minutos>', () => {
      const [primeiro, segundo] = lembretesDeCompromissos([c('c1', 72, [1440, 30])], agora);
      expect(identificadorDoLembreteDeCompromisso('u1', primeiro)).toBe('treinos:compromisso:u1:c1:1440');
      expect(identificadorDoLembreteDeCompromisso('u1', segundo)).toBe('treinos:compromisso:u1:c1:30');
      expect(identificadorDoLembreteDeCompromisso('u1', segundo)).toBe(identificadorDoLembreteDeCompromisso('u1', lembretesDeCompromissos([c('c1', 90, [30])], agora)[0]));
    });

    it('o prefixo do usuário cobre os dele e não os de outro usuário', () => {
      const [primeiro] = lembretesDeCompromissos([c('c1', 72)], agora);
      expect(identificadorDoLembreteDeCompromisso('u1', primeiro).startsWith(prefixoDosLembretesDeCompromisso('u1'))).toBe(true);
      expect(identificadorDoLembreteDeCompromisso('u10', primeiro).startsWith(prefixoDosLembretesDeCompromisso('u1'))).toBe(false);
    });
  });
});
