import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import { carga, exercicio, grupo, rir, serie, sessao } from '../dominio/exemplosDeTreino.apoioTeste';
import { pacoteNoFormatoAtual } from './formatoDoPacote';

const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Pacote salvo no formato atual: treino com grupo, série com técnica, cardio, back off com referência e metodologia. */
function salvo(): Record<string, any> {
  const trabalho = serie('a', { repsMin: 3, repsMax: 6, esforco: rir(1) });
  const backOff = serie('b', { tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'a') });
  const cluster = serie('c', { tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15 }, repsMin: 6, repsMax: 6 });
  const cardio = serie('d', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 20, intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 8 } } });
  return {
    salvoEm: '2026-10-22T10:00:00Z',
    pacote: {
      configuracao: { tipoTrabalho: 'WS', arredondamentoKg: 0.5 },
      treino: {
        conteudo: {
          objetivo: null,
          orientacoes: null,
          metodologia: { id: 'm', nome: 'M', configuracao: copia(CONFIGURACAO_PADRAO) },
          sessoes: [
            sessao('s', [exercicio('e1', { series: [trabalho, backOff, cluster], grupoUid: 'g' }), exercicio('e2', { grupoUid: 'g' }), exercicio('e3', { modalidade: 'CARDIO', series: [cardio] })], [grupo('g', 'SUPERSET')]),
          ],
        },
      },
    },
  };
}

describe('formato do pacote salvo no aparelho', () => {
  it('aceita o formato atual completo', () => {
    expect(pacoteNoFormatoAtual(salvo())).toBe(true);
  });

  it('aceita pacote sem treino e sem metodologia', () => {
    const p = salvo();
    p.pacote.treino = null;
    expect(pacoteNoFormatoAtual(p)).toBe(true);
    const q = salvo();
    delete q.pacote.treino.conteudo.metodologia;
    expect(pacoteNoFormatoAtual(q)).toBe(true);
  });

  it('aceita carga por bloco do Cluster e retomadas do Rest-pause e confere o formato delas', () => {
    const p = salvo();
    const t = p.pacote.treino.conteudo.sessoes[0].exercicios[0].series[2].tecnica;
    t.cargasDosBlocos = [{ modo: 'DA_SERIE', percentual: null }, { modo: 'PERCENTUAL_WS', percentual: 90 }];
    t.retomadas = [{ repsMin: 2, repsMax: 3, amrap: null, carga: { modo: 'DA_SERIE', percentual: null } }];
    expect(pacoteNoFormatoAtual(p)).toBe(true);
    t.cargasDosBlocos = [{ modo: 'ACIMA_DA_ANTERIOR', percentual: 5 }];
    expect(pacoteNoFormatoAtual(p)).toBe(false);
    t.cargasDosBlocos = null;
    t.retomadas = [{ repsMin: '2', repsMax: 3, carga: null }];
    expect(pacoteNoFormatoAtual(p)).toBe(false);
  });

  it('recusa o que não é pacote', () => {
    for (const ruim of [null, 'x', [], {}, { salvoEm: 1, pacote: {} }, { salvoEm: 'x', pacote: { configuracao: {} } }]) expect(pacoteNoFormatoAtual(ruim)).toBe(false);
  });

  it('recusa a série do formato antigo (intensidade, tipo em texto sem os campos novos)', () => {
    const p = salvo();
    const s = p.pacote.treino.conteudo.sessoes[0].exercicios[0].series[0];
    delete s.carga;
    s.intensidade = { modo: 'CARGA_TRABALHO', rir: 1 };
    expect(pacoteNoFormatoAtual(p)).toBe(false);
  });

  it('recusa campo desconhecido na série, na carga, no esforço, na técnica e no cardio', () => {
    const alterar = (fn: (series: Record<string, any>[]) => void) => {
      const p = salvo();
      fn(p.pacote.treino.conteudo.sessoes[0].exercicios[0].series);
      return p;
    };
    expect(pacoteNoFormatoAtual(alterar((s) => (s[0].alvoTexto = 'x')))).toBe(false);
    expect(pacoteNoFormatoAtual(alterar((s) => (s[0].carga.extra = 1)))).toBe(false);
    expect(pacoteNoFormatoAtual(alterar((s) => (s[0].esforco.extra = 1)))).toBe(false);
    expect(pacoteNoFormatoAtual(alterar((s) => (s[2].tecnica.extra = 1)))).toBe(false);
    const c = salvo();
    c.pacote.treino.conteudo.sessoes[0].exercicios[2].series[0].cardio.extra = 1;
    expect(pacoteNoFormatoAtual(c)).toBe(false);
  });

  it('recusa modo de carga, técnica, papel e região fora da lista, e números que não são números', () => {
    const p = salvo();
    p.pacote.treino.conteudo.sessoes[0].exercicios[0].series[0].carga.modo = 'RPE';
    expect(pacoteNoFormatoAtual(p)).toBe(false);
    const q = salvo();
    q.pacote.treino.conteudo.sessoes[0].exercicios[0].series[2].tecnica.tipo = 'OUTRA';
    expect(pacoteNoFormatoAtual(q)).toBe(false);
    const r = salvo();
    r.pacote.treino.conteudo.sessoes[0].exercicios[0].series[0].repsMin = '3';
    expect(pacoteNoFormatoAtual(r)).toBe(false);
    const t = salvo();
    t.pacote.treino.conteudo.metodologia.configuracao.tipos[0].papel = 'QUALQUER';
    expect(pacoteNoFormatoAtual(t)).toBe(false);
  });

  it('grupo da sessão: exigido e conferido', () => {
    const p = salvo();
    delete p.pacote.treino.conteudo.sessoes[0].grupos;
    expect(pacoteNoFormatoAtual(p)).toBe(false);
    const q = salvo();
    q.pacote.treino.conteudo.sessoes[0].grupos[0].tecnica = 'OUTRO';
    expect(pacoteNoFormatoAtual(q)).toBe(false);
    const r = salvo();
    r.pacote.treino.conteudo.sessoes[0].exercicios[0].juntoComAnterior = true;
    expect(pacoteNoFormatoAtual(r)).toBe(false);
  });

  it('a metodologia do formato antigo é recusada: tipos sem código e sem combinações', () => {
    const semCodigo = salvo();
    delete semCodigo.pacote.treino.conteudo.metodologia.configuracao.tipos[0].codigo;
    expect(pacoteNoFormatoAtual(semCodigo)).toBe(false);
    const antiga = salvo();
    const conf = antiga.pacote.treino.conteudo.metodologia.configuracao;
    conf.tipos[0].intensidadePadrao = null;
    expect(pacoteNoFormatoAtual(antiga)).toBe(false);
    const semCombinacoes = salvo();
    // A API sempre devolve as sete; sem o campo, a lista não é a atual (campo desconhecido ou ausente é recusado pelo `lista`).
    semCombinacoes.pacote.treino.conteudo.metodologia.configuracao.combinacoes = undefined;
    expect(pacoteNoFormatoAtual(semCombinacoes)).toBe(false);
  });

  it('o pacote da configuração precisa trazer o rótulo da série de trabalho e o arredondamento', () => {
    const p = salvo();
    delete p.pacote.configuracao.tipoTrabalho;
    expect(pacoteNoFormatoAtual(p)).toBe(false);
    const q = salvo();
    q.pacote.configuracao.arredondamentoKg = '0.5';
    expect(pacoteNoFormatoAtual(q)).toBe(false);
  });

  it('recordes pessoais (Engajamento 0.2): ausentes aceitos; presentes, conferidos', () => {
    const p = salvo();
    p.pacote.recordes = { ate: '2026-10-22', exercicios: { x1: { maiorCarga: 70, maiorVolume: 720, repeticoesPorCarga: [{ carga: 60, repeticoes: 12 }] } } };
    expect(pacoteNoFormatoAtual(p)).toBe(true);
    const vazio = salvo();
    vazio.pacote.recordes = { ate: '2026-10-22', exercicios: {} };
    expect(pacoteNoFormatoAtual(vazio)).toBe(true);
    for (const ruim of [
      { exercicios: {} },
      { ate: '2026-10-22', exercicios: [] },
      { ate: '2026-10-22', exercicios: { x1: { maiorCarga: '70', maiorVolume: 720, repeticoesPorCarga: [] } } },
      { ate: '2026-10-22', exercicios: { x1: { maiorCarga: 70, maiorVolume: 720, repeticoesPorCarga: [{ carga: 60 }] } } },
    ]) {
      const q = salvo();
      q.pacote.recordes = ruim;
      expect(pacoteNoFormatoAtual(q)).toBe(false);
    }
  });
});
