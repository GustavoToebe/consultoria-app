import { novaSessao } from './editorTreino';
import { treinoEmAndamento } from './treinoEmAndamento';

const HOJE = '2026-10-19';
const a = { ...novaSessao(1), uid: 'a', nome: 'Treino A' };
const b = { ...novaSessao(3), uid: 'b', nome: 'Treino B' };
const marcada = { planoVersaoId: 'v', sessaoUid: 'a', data: HOJE, concluida: true, alteradoEm: '2026-10-19T15:00:00.000Z' };
const nenhumaConcluida = () => false;
const caso = (registros: (typeof marcada)[], extra: Partial<Parameters<typeof treinoEmAndamento>[0]> = {}) =>
  treinoEmAndamento({ versaoId: 'v', sessoes: [a, b], registros, hoje: HOJE, concluidaHoje: nenhumaConcluida, ...extra });

describe('treino em andamento no Início', () => {
  it('aparece com uma série marcada hoje na sessão do plano', () => {
    expect(caso([marcada])).toBe(a);
  });

  it('ausência não aparece: sem registro, sem treino', () => {
    expect(caso([])).toBeNull();
    expect(caso([marcada], { versaoId: null })).toBeNull();
  });

  it('série desmarcada (mesmo registro com concluida=false) não conta', () => {
    expect(caso([{ ...marcada, concluida: false }])).toBeNull();
  });

  it('só hoje, só a versão em uso e só sessão que ainda está no plano', () => {
    expect(caso([{ ...marcada, data: '2026-10-18' }])).toBeNull();
    expect(caso([{ ...marcada, planoVersaoId: 'antiga' }])).toBeNull();
    expect(caso([{ ...marcada, sessaoUid: 'saiu' }])).toBeNull();
  });

  it('sessão concluída hoje não aparece; a outra, ainda aberta, sim', () => {
    const concluidaA = (uid: string) => uid === 'a';
    expect(caso([marcada], { concluidaHoje: concluidaA })).toBeNull();
    expect(caso([marcada, { ...marcada, sessaoUid: 'b', alteradoEm: '2026-10-19T14:00:00.000Z' }], { concluidaHoje: concluidaA })).toBe(b);
  });

  it('duas sessões abertas: vale a da série marcada por último, em qualquer ordem', () => {
    const maisNova = { ...marcada, sessaoUid: 'b', alteradoEm: '2026-10-19T16:00:00.000Z' };
    expect(caso([marcada, maisNova])).toBe(b);
    expect(caso([maisNova, marcada])).toBe(b);
  });
});
