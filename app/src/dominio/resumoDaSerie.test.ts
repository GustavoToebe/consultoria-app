import { CONFIGURACAO_PADRAO as config } from './metodologiaPadrao';
import { carga, rir, serie, tecnica } from './exemplosDeTreino.apoioTeste';
import { estruturaDaSerie, previaDoGrupo, textoDasRepeticoesDaSerie } from './resumoDaSerie';

const cluster4x4 = serie('c', { repsMin: 16, repsMax: 16, tecnica: tecnica('CLUSTER', { blocos: [4, 4, 4, 4], pausaSegundos: 15 }) });

describe('leitura curta da série (análise 2, A6)', () => {
  it('repetições: faixa, exata, AMRAP e por tempo', () => {
    expect(textoDasRepeticoesDaSerie({ repsMin: 3, repsMax: 6, amrap: null })).toBe('3 a 6 reps');
    expect(textoDasRepeticoesDaSerie({ repsMin: 8, repsMax: 8, amrap: null })).toBe('8 reps');
    expect(textoDasRepeticoesDaSerie({ repsMin: null, repsMax: null, amrap: true })).toBe('AMRAP');
    expect(textoDasRepeticoesDaSerie({ repsMin: null, repsMax: null, amrap: null })).toBe('por tempo');
  });

  it('Cluster 4×4: blocos e pausa, sem repetir o total', () => {
    expect(estruturaDaSerie(cluster4x4, config)).toBe('4 blocos de 4 reps · pausa de 15 s');
  });

  it('Cluster desigual leva o total; sem blocos diz o que falta', () => {
    const desigual = serie('d', { repsMin: 10, repsMax: 10, tecnica: tecnica('CLUSTER', { blocos: [4, 4, 2], pausaRespiracoes: 5 }) });
    expect(estruturaDaSerie(desigual, config)).toBe('blocos de 4, 4 e 2 reps (10 no total) · pausa de 5 respirações');
    expect(estruturaDaSerie(serie('e', { tecnica: tecnica('CLUSTER', { blocos: null, pausaSegundos: 15 }) }), config)).toBe('Cluster: complete os blocos');
  });

  it('Rest-pause: etapa inicial mais as retomadas (2 pausas = 2 retomadas, 3 etapas)', () => {
    const rp = serie('r', { repsMin: 6, repsMax: 8, tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 2 }) });
    expect(estruturaDaSerie(rp, config)).toBe('6 a 8 reps + 2 retomadas · pausa de 20 s');
    expect(estruturaDaSerie({ ...rp, tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20 }) }, config)).toBe('6 a 8 reps + 1 retomada · pausa de 20 s');
  });

  it('outra técnica: repetições e o texto curto dela', () => {
    expect(estruturaDaSerie(serie('d', { repsMin: 10, repsMax: 10, tecnica: tecnica('DROP_SET', { quedas: 2, reducaoPercentual: 20 }) }), config))
      .toBe('10 reps · Drop-set 2× −20%');
  });

  it('prévia do grupo: resumo e só o que está informado', () => {
    const p = previaDoGrupo({ series: [cluster4x4] }, [cluster4x4], config, { descansoPorSerie: true });
    expect(p.resumo).toBe('1 série completa · 4 blocos de 4 reps · pausa de 15 s');
    expect(p.linhas).toEqual(['Carga: carga de trabalho (a base do dia, que o aluno informa)', 'Descanso depois da série: não informado']);
  });

  it('percentuais por série juntos, referência, esforço, descanso e alvo extra', () => {
    const a = serie('a', { tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: carga('PERCENTUAL_WS', 50), esforco: rir(2), descansoSegundos: 90, alvoExtra: 'Controle' });
    const b = { ...a, uid: 'b', carga: carga('PERCENTUAL_WS', 70) };
    const p = previaDoGrupo({ series: [a, b] }, [a, b], config, { referencia: 'Referência: a carga de trabalho do dia, que o aluno informa.' });
    expect(p.resumo).toBe('2 séries completas · 3 reps');
    expect(p.linhas).toEqual([
      'Carga: 50% · 70% da WS',
      'Referência: a carga de trabalho do dia, que o aluno informa.',
      'Esforço: 2 RIR',
      'Descanso depois da série: 1 min 30 s',
      'Observação desta série: Controle',
    ]);
  });

  it('sem carga no exercício e descanso do grupo: nada de carga nem descanso', () => {
    const p = previaDoGrupo({ series: [cluster4x4] }, [cluster4x4], config, { semCarga: true, descansoPorSerie: false });
    expect(p.linhas).toEqual([]);
  });

  it('RIR 0 diz "até a falha"', () => {
    const s = serie('x', { esforco: rir(0) });
    expect(previaDoGrupo({ series: [s] }, [s], config, {}).linhas).toContain('Esforço: até a falha');
  });
});
