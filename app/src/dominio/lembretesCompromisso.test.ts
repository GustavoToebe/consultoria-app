import type { CompromissoDoAluno } from '../api/agendaTipos';
import {
  identificadorDoLembreteDeCompromisso, LIMITE_DE_NOTIFICACOES_LOCAIS, lembretesDeCompromissos, NOTIFICACOES_DA_ATUALIZACAO,
  prefixoDosLembretesDeCompromisso,
} from './lembretesCompromisso';

const HORA = 3_600_000;
const agora = new Date('2026-11-04T12:00:00Z');
const em = (horas: number) => new Date(agora.getTime() + horas * HORA).toISOString();
const c = (id: string, horas: number, situacao: CompromissoDoAluno['situacao'] = 'AGENDADO') => ({ id, inicio: em(horas), situacao });

describe('lembretes de compromisso (D13)', () => {
  it('compromisso daqui a 3 dias: um dia antes e duas horas antes, com os instantes certos', () => {
    const lembretes = lembretesDeCompromissos([c('c1', 72)], agora);
    expect(lembretes.map((l) => [l.chave, l.antecedencia, l.data.toISOString()])).toEqual([
      ['c1:1d', '1d', em(48)],
      ['c1:2h', '2h', em(70)],
    ]);
    expect(lembretes[0].compromissoId).toBe('c1');
  });

  it('o texto não tem horário, observação, local nem nome (P7)', () => {
    const [umDia, duasHoras] = lembretesDeCompromissos([c('c1', 72)], agora);
    expect(umDia.texto).toBe('Você tem um compromisso amanhã. Abra o app para ver.');
    expect(duasHoras.texto).toBe('Você tem um compromisso daqui a pouco. Abra o app para ver.');
    for (const l of [umDia, duasHoras]) expect(l.texto).not.toMatch(/\d/);
  });

  it('lembrete que já passou é descartado: daqui a 3 horas só resta o de 2 horas; daqui a 1 hora, nenhum', () => {
    expect(lembretesDeCompromissos([c('c1', 3)], agora).map((l) => l.chave)).toEqual(['c1:2h']);
    expect(lembretesDeCompromissos([c('c1', 1)], agora)).toEqual([]);
    expect(lembretesDeCompromissos([c('c1', -5)], agora)).toEqual([]);
  });

  it('o instante exato de agora não agenda (precisa ser no futuro)', () => {
    expect(lembretesDeCompromissos([c('c1', 2)], agora)).toEqual([]);
    expect(lembretesDeCompromissos([c('c1', 24)], agora).map((l) => l.chave)).toEqual(['c1:2h']);
  });

  it('só os agendados: cancelado, realizado e falta não lembram', () => {
    const lista = [c('a', 72), c('b', 72, 'CANCELADO'), c('c', 72, 'REALIZADO'), c('d', 72, 'FALTOU')];
    expect([...new Set(lembretesDeCompromissos(lista, agora).map((l) => l.compromissoId))]).toEqual(['a']);
  });

  it('ordem: do mais próximo ao mais distante, intercalando compromissos; empate pela chave', () => {
    // a e m: 1 dia antes daqui a 6 h e 2 h antes daqui a 28 h; z: daqui a 76 h e 98 h.
    const lista = [c('z', 100), c('m', 30), c('a', 30)];
    expect(lembretesDeCompromissos(lista, agora).map((l) => l.chave)).toEqual(['a:1d', 'm:1d', 'a:2h', 'm:2h', 'z:1d', 'z:2h']);
  });

  it('compromisso repetido na lista conta uma vez; data inválida ou lista vazia não quebram', () => {
    expect(lembretesDeCompromissos([c('c1', 72), c('c1', 72)], agora)).toHaveLength(2);
    expect(lembretesDeCompromissos([{ id: 'x', inicio: 'não é data', situacao: 'AGENDADO' }], agora)).toEqual([]);
    expect(lembretesDeCompromissos([], agora)).toEqual([]);
    expect(lembretesDeCompromissos(null, agora)).toEqual([]);
    expect(lembretesDeCompromissos(undefined, agora)).toEqual([]);
  });

  it('não depende do fuso do aparelho nem da virada do ano: é conta de instantes', () => {
    // 01/01/2027 00:30 em Brasília = 03:30 UTC.
    const lembretes = lembretesDeCompromissos([{ id: 'ny', inicio: '2027-01-01T03:30:00Z', situacao: 'AGENDADO' }], new Date('2026-12-30T00:00:00Z'));
    expect(lembretes.map((l) => l.data.toISOString())).toEqual(['2026-12-31T03:30:00.000Z', '2027-01-01T01:30:00.000Z']);
  });

  describe('limite de notificações do iOS', () => {
    // 40 compromissos (80 lembretes), um a cada 100 horas a partir de 100 h.
    const muitos = Array.from({ length: 40 }, (_, i) => c(`c${String(i).padStart(2, '0')}`, 100 * (i + 1)));

    it('20 compromissos futuros (40 lembretes) cabem junto com os 3 da atualização', () => {
      const vinte = muitos.slice(0, 20);
      expect(lembretesDeCompromissos(vinte, agora)).toHaveLength(40);
      expect(40 + NOTIFICACOES_DA_ATUALIZACAO).toBeLessThanOrEqual(LIMITE_DE_NOTIFICACOES_LOCAIS);
    });

    it('passou do teto: ficam os mais próximos, 64 menos as reservadas pelas outras', () => {
      const lembretes = lembretesDeCompromissos(muitos, agora);
      expect(lembretes).toHaveLength(LIMITE_DE_NOTIFICACOES_LOCAIS - NOTIFICACOES_DA_ATUALIZACAO);
      const todos = lembretesDeCompromissos(muitos, agora, 0).slice(0, 61).map((l) => l.chave);
      expect(lembretes.map((l) => l.chave)).toEqual(todos);
      const datas = lembretes.map((l) => l.data.getTime());
      expect([...datas].sort((a, b) => a - b)).toEqual(datas);
    });

    it('sem reservas cabem 64; com reservas maiores que o teto, nenhum', () => {
      expect(lembretesDeCompromissos(muitos, agora, 0)).toHaveLength(64);
      expect(lembretesDeCompromissos(muitos, agora, 64)).toEqual([]);
      expect(lembretesDeCompromissos(muitos, agora, 100)).toEqual([]);
      expect(lembretesDeCompromissos(muitos, agora, -5)).toHaveLength(64);
    });
  });

  describe('identificadores', () => {
    it('determinísticos: treinos:compromisso:<usuarioId>:<compromissoId>:<1d|2h>', () => {
      const [umDia, duasHoras] = lembretesDeCompromissos([c('c1', 72)], agora);
      expect(identificadorDoLembreteDeCompromisso('u1', umDia)).toBe('treinos:compromisso:u1:c1:1d');
      expect(identificadorDoLembreteDeCompromisso('u1', duasHoras)).toBe('treinos:compromisso:u1:c1:2h');
      expect(identificadorDoLembreteDeCompromisso('u1', umDia)).toBe(identificadorDoLembreteDeCompromisso('u1', lembretesDeCompromissos([c('c1', 90)], agora)[0]));
    });

    it('o prefixo do usuário cobre os dele e não os de outro usuário', () => {
      const [umDia] = lembretesDeCompromissos([c('c1', 72)], agora);
      expect(identificadorDoLembreteDeCompromisso('u1', umDia).startsWith(prefixoDosLembretesDeCompromisso('u1'))).toBe(true);
      expect(identificadorDoLembreteDeCompromisso('u10', umDia).startsWith(prefixoDosLembretesDeCompromisso('u1'))).toBe(false);
    });
  });
});
