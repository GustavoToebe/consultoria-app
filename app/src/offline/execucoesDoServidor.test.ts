import type { DiaDeTreino } from '../api/tipos';
import { fundirComServidor, registrosDoServidor, trocarPeriodo } from './execucoesDoServidor';
import type { RegistroLocal } from './repositorioLocal';

const dia = (data: string, serieUid: string, concluida = true): DiaDeTreino => ({
  data,
  sessoes: [{ sessaoUid: 'seg', sessao: 'Segunda', planoVersaoId: 'v1', exercicios: [{ exercicioUid: 'e1', exercicioId: 'x1', nome: 'Remada', series: [
    { id: `srv-${serieUid}-${data}`, serieUid, tipo: 'WS', trabalho: true, carga: 40, unidade: 'kg', repeticoes: 8, concluida, observacao: null },
  ] }] }],
});

const local: RegistroLocal = {
  id: 'loc', planoVersaoId: 'v1', sessaoUid: 'seg', exercicioUid: 'e1', serieUid: 's1', exercicioId: 'x1', trabalho: true,
  data: '2026-10-19', carga: 42, repeticoes: 6, concluida: false, observacao: null, alteradoEm: '2026-10-19T10:00:00.000Z',
  situacao: 'LOCAL', motivo: null, etapas: null, referenciaCarga: null, referenciaOrigem: null,
};

describe('execuções do servidor', () => {
  it('vira registro já enviado, com o id do servidor e a hora no começo do dia', () => {
    const [r] = registrosDoServidor([dia('2026-10-19', 's1')]);
    expect(r).toMatchObject({ id: 'srv-s1-2026-10-19', planoVersaoId: 'v1', sessaoUid: 'seg', exercicioUid: 'e1', serieUid: 's1',
      exercicioId: 'x1', trabalho: true, carga: 40, repeticoes: 8, concluida: true, situacao: 'ENVIADO', alteradoEm: '2026-10-19T00:00:00.000Z' });
  });

  it('o do aparelho ganha na mesma série e dia; do servidor só entra o que falta, sem duplicar', () => {
    const doServidor = registrosDoServidor([dia('2026-10-19', 's1'), dia('2026-10-19', 's2'), dia('2026-10-19', 's2')]);
    const todos = fundirComServidor([local], doServidor);
    expect(todos.map((r) => r.id).sort()).toEqual(['loc', 'srv-s2-2026-10-19']);
    expect(todos.find((r) => r.serieUid === 's1')?.concluida).toBe(false);
    expect(fundirComServidor([local], [])).toEqual([local]);
  });

  it('trocar o período tira o que sumiu no servidor e mantém as outras semanas', () => {
    const antes = registrosDoServidor([dia('2026-10-12', 's1'), dia('2026-10-19', 's1')]);
    const depois = trocarPeriodo(antes, '2026-10-19', '2026-10-25', registrosDoServidor([dia('2026-10-20', 's2')]));
    expect(depois.map((r) => r.data).sort()).toEqual(['2026-10-12', '2026-10-20']);
  });
});
