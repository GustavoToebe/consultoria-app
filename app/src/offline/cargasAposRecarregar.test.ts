import { calcularCargasDoExercicio } from '../dominio/cargas';
import { carga, exercicio, serie } from '../dominio/exemplosDeTreino.apoioTeste';
import { fundirComServidor } from './execucoesDoServidor';
import type { RegistroLocal } from './repositorioLocal';

/**
 * B1, estado 10 (reabrir/recarregar e offline): a sugestão do Back off depois de a tela ler os registros do aparelho
 * fundidos com os do servidor (`fundirComServidor`, que o `AlunoProvider` entrega a `registroDe`). Só a conta do cartão
 * (`ExercicioAluno`: `cargasDoDia[serieUid] = registro?.carga`) sobre o resultado da fusão; a fórmula não muda.
 */
const CONFIG = { arredondamentoKg: 0.5, tipoTrabalho: 'WS' };
const DATA = '2026-10-30';

const registro = (serieUid: string, extra: Partial<RegistroLocal>): RegistroLocal => ({
  id: `r-${serieUid}`,
  planoVersaoId: 'v1',
  sessaoUid: 's1',
  exercicioUid: 'ex',
  serieUid,
  exercicioId: 'x',
  trabalho: serieUid === 'w',
  data: DATA,
  carga: null,
  repeticoes: null,
  concluida: true,
  observacao: null,
  etapas: null,
  referenciaCarga: null,
  referenciaOrigem: null,
  alteradoEm: `${DATA}T12:00:00.000Z`,
  situacao: 'LOCAL',
  motivo: null,
  ...extra,
});

const plano = exercicio('ex', {
  exercicioId: 'x',
  series: [
    serie('w', { repsMin: 3, repsMax: 6, carga: carga('CARGA_TRABALHO') }),
    serie('b', { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: carga('PERCENTUAL_WS', 80) }),
  ],
});

/** O que o cartão faz: o registro da série (se houver) vira a carga do dia da série. */
function sugestoes(locais: RegistroLocal[], doServidor: RegistroLocal[], base: number | null) {
  const fundidos = fundirComServidor(locais, doServidor);
  const cargasDoDia: Record<string, number | null> = {};
  for (const s of plano.series) cargasDoDia[s.uid] = fundidos.find((r) => r.serieUid === s.uid && r.data === DATA)?.carga ?? null;
  return calcularCargasDoExercicio(plano, base, cargasDoDia, CONFIG);
}

describe('B1 · reabrir o treino: o Back off sai da WS que ficou registrada', () => {
  it('WS gravada só no aparelho (ainda não enviada, app reaberto offline): o Back off sai dela', () => {
    const r = sugestoes([registro('w', { carga: 42 })], [], 40);
    expect(r[1].sugestao).toBe(33.5);
    expect(r[1].referencia).toEqual({ valor: 42, origem: 'WS_ANTERIOR' });
  });

  it('WS que só o servidor conhece (outro aparelho, ou depois de sair e entrar): o Back off também sai dela', () => {
    const r = sugestoes([], [registro('w', { carga: 42, situacao: 'ENVIADO' })], 40);
    expect(r[1].sugestao).toBe(33.5);
  });

  it('o aparelho ganha do servidor na mesma série e dia: a edição ainda não enviada vale', () => {
    const r = sugestoes([registro('w', { carga: 50 })], [registro('w', { carga: 42, situacao: 'ENVIADO' })], 40);
    expect(r[1].sugestao).toBe(40); // 80% de 50, não de 42
  });

  it('sem nenhum registro da WS (digitada e não confirmada antes de fechar o app): volta à base do dia', () => {
    const r = sugestoes([], [], 40);
    expect(r[1].sugestao).toBe(32);
    expect(r[1].referencia?.origem).toBe('BASE_DO_DIA');
  });

  it('a base do dia só mora no aparelho: sem ela e sem WS registrada, o Back off não é sugerido, e a WS de outro dia não conta', () => {
    const outroDia = registro('w', { carga: 42, data: '2026-10-23', situacao: 'ENVIADO' });
    const r = sugestoes([], [outroDia], null);
    expect(r.map((x) => x.sugestao)).toEqual([null, null]);
  });
});
