import type { EtapaRegistrada } from '../api/tipos';
import { serie, tecnica } from './exemplosDeTreino.apoioTeste';
import { descansoAoIniciar, iniciarDescanso, semDescansoDe, type Descanso } from './descanso';
import {
  aplicarAcao, cargaComum, comEtapa, etapasDaSerie, ligaPausaInterna, origemDaPausa, pausaDaAcao, proximaPendente, quantidadeDeEtapas, resumoDaExecucao,
  semEtapa, somarVolumes, todasComSituacao, totalDasEtapas, volumeDaSerie,
} from './etapas';

const feita = (posicao: number, repeticoes: number | null, carga: number | null = 40): EtapaRegistrada => ({ posicao, repeticoes, carga, situacao: 'FEITA' });
const naoFeita = (posicao: number): EtapaRegistrada => ({ posicao, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' });
const cluster4x4 = serie('c', { repsMin: 16, repsMax: 16, tecnica: tecnica('CLUSTER', { blocos: [4, 4, 4, 4], pausaSegundos: 15 }) });

describe('etapas previstas (espelho de ConteudoTreino.Serie.etapas)', () => {
  it('Cluster 4×4: 4 blocos, 1 série', () => {
    const e = etapasDaSerie(cluster4x4)!;
    expect(e.map((x) => x.rotulo)).toEqual(['Bloco 1', 'Bloco 2', 'Bloco 3', 'Bloco 4']);
    expect(e.map((x) => x.meta)).toEqual(['4 reps', '4 reps', '4 reps', '4 reps']);
    expect(quantidadeDeEtapas(cluster4x4)).toBe(4);
  });

  it('Rest-pause: 1 pausa = 2 etapas, 2 pausas = 3; a etapa inicial pede as repetições da série', () => {
    const rp = serie('r', { repsMin: 6, repsMax: 8, tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20 }) });
    expect(etapasDaSerie(rp)!.map((x) => `${x.rotulo}: ${x.meta}`)).toEqual(['Etapa inicial: 6 a 8 reps', 'Retomada: até a falha']);
    const duas = { ...rp, tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 2 }) };
    expect(etapasDaSerie(duas)!.map((x) => x.rotulo)).toEqual(['Etapa inicial', 'Retomada 1', 'Retomada 2']);
  });

  it('sem técnica de etapas, cluster sem blocos válidos e cardio: a série se registra inteira', () => {
    expect(etapasDaSerie(serie('a'))).toBeNull();
    expect(etapasDaSerie(serie('b', { tecnica: tecnica('CLUSTER', { blocos: [4], pausaSegundos: 15 }) }))).toBeNull();
    expect(etapasDaSerie(serie('d', { tecnica: tecnica('DROP_SET', { quedas: 2 }) }))).toBeNull();
    expect(etapasDaSerie({ ...cluster4x4, cardio: { duracaoMin: 10 } })).toBeNull();
  });
});

describe('total e carga como o servidor (T03, T04, T25)', () => {
  it('4+4+4+2 = 14 com a meta 16 preservada; parcial não é total', () => {
    const todas = [feita(1, 4), feita(2, 4), feita(3, 4), feita(4, 2)];
    expect(totalDasEtapas(todas, 4)).toBe(14);
    expect(totalDasEtapas(todas.slice(0, 2), 4)).toBeNull();
    expect(resumoDaExecucao(todas, 4, 'blocos')).toBe('Realizadas: 14 reps · 4 de 4 blocos');
    expect(resumoDaExecucao(todas.slice(0, 2), 4, 'blocos')).toBe('Execução parcial: 8 reps em 2 de 4 blocos');
    expect(resumoDaExecucao([], 4, 'blocos')).toBe('Nenhum bloco registrado');
  });

  it('zero informado é número; vazio é não informado; não realizado é explícito', () => {
    expect(totalDasEtapas([feita(1, 4), feita(2, 0), naoFeita(3), naoFeita(4)], 4)).toBe(4);
    expect(totalDasEtapas([feita(1, 4), feita(2, null)], 2)).toBeNull();
    expect(resumoDaExecucao([feita(1, 4), naoFeita(2)], 2, 'blocos')).toBe('Realizadas: 4 reps · 1 de 2 blocos · 1 não realizada');
  });

  it('cargas diferentes: sem carga comum (nunca a maior nem a última)', () => {
    expect(cargaComum([feita(1, 4, 40), feita(2, 4, 40)])).toBe(40);
    expect(cargaComum([feita(1, 4, 40), feita(2, 4, 35)])).toBeNull();
    expect(cargaComum([feita(1, 4, null)])).toBeNull();
    expect(cargaComum([naoFeita(1)])).toBeNull();
  });

  it('volume = carga × reps de cada etapa, sem dupla contagem; faltou número = subtotal; sem carga = nada', () => {
    expect(volumeDaSerie({ carga: null, repeticoes: 14, concluida: true, etapas: [feita(1, 4), feita(2, 4), feita(3, 4), feita(4, 2)] }, false))
      .toEqual({ valor: 560, completo: true });
    expect(volumeDaSerie({ carga: null, repeticoes: null, concluida: true, etapas: [feita(1, 4, 40), feita(2, 4, 35)] }, false))
      .toEqual({ valor: 300, completo: true });
    expect(volumeDaSerie({ carga: null, repeticoes: null, concluida: false, etapas: [feita(1, 4, 40), feita(2, null, 40)] }, false))
      .toEqual({ valor: 160, completo: false });
    expect(volumeDaSerie({ carga: 40, repeticoes: 6, concluida: true }, false)).toEqual({ valor: 240, completo: true });
    expect(volumeDaSerie({ carga: 40, repeticoes: 6, concluida: false }, false)).toBeNull();
    expect(volumeDaSerie({ carga: 40, repeticoes: 6, concluida: true }, true)).toBeNull();
    expect(somarVolumes([{ valor: 560, completo: true }, { valor: 240, completo: true }], 2)).toEqual({ valor: 800, completo: true });
    expect(somarVolumes([{ valor: 560, completo: true }, null], 2)).toEqual({ valor: 560, completo: false });
    expect(somarVolumes([null], 1)).toBeNull();
  });
});

describe('ações do aluno (T10, T14, T18)', () => {
  const ref = { valor: 40, origem: 'BASE_DO_DIA' as const };

  it('a primeira etapa congela a referência; mudar a base depois não muda o que já foi registrado', () => {
    const r1 = aplicarAcao(null, { tipo: 'FEITA', posicao: 1, repeticoes: 4, carga: 40 }, 4, ref)!;
    expect(r1).toMatchObject({ referenciaCarga: 40, referenciaOrigem: 'BASE_DO_DIA', concluida: false, repeticoes: null, carga: 40 });
    const r2 = aplicarAcao(r1, { tipo: 'FEITA', posicao: 2, repeticoes: 4, carga: 40 }, 4, { valor: 50, origem: 'BASE_DO_DIA' })!;
    expect(r2.referenciaCarga).toBe(40);
    expect(r2.etapas.map((e) => e.carga)).toEqual([40, 40]);
  });

  it('concluir só com todas as etapas com situação; desfazer reabre; editar não muda a situação', () => {
    let r = aplicarAcao(null, { tipo: 'FEITA', posicao: 1, repeticoes: 4, carga: 40 }, 2, ref)!;
    expect(aplicarAcao(r, { tipo: 'CONCLUIR' }, 2, ref)).toBeNull();
    r = aplicarAcao(r, { tipo: 'NAO_REALIZADA', posicao: 2 }, 2, ref)!;
    r = aplicarAcao(r, { tipo: 'CONCLUIR' }, 2, ref)!;
    expect(r).toMatchObject({ concluida: true, repeticoes: 4 });
    r = aplicarAcao(r, { tipo: 'EDITAR', posicao: 1, repeticoes: 3 }, 2, ref)!;
    expect(r).toMatchObject({ concluida: true, repeticoes: 3 });
    r = aplicarAcao(r, { tipo: 'DESFAZER', posicao: 2 }, 2, ref)!;
    expect(r).toMatchObject({ concluida: false, repeticoes: null });
    expect(aplicarAcao(r, { tipo: 'EDITAR', posicao: 2, repeticoes: 1 }, 2, ref)).toBeNull();
  });

  it('sem nenhuma etapa a referência sai (a próxima primeira etapa congela a de então)', () => {
    const r = aplicarAcao(aplicarAcao(null, { tipo: 'FEITA', posicao: 1, repeticoes: 4, carga: 40 }, 4, ref), { tipo: 'DESFAZER', posicao: 1 }, 4, ref)!;
    expect(r).toMatchObject({ etapas: [], referenciaCarga: null, referenciaOrigem: null });
  });

  it('a pausa interna liga ao marcar uma etapa que não é a última e ainda não está feita', () => {
    const acao = { tipo: 'FEITA' as const, posicao: 1, repeticoes: 4, carga: 40 };
    expect(ligaPausaInterna(null, acao, 4)).toBe(true);
    expect(ligaPausaInterna({ etapas: [feita(1, 4)] }, acao, 4)).toBe(false);
    expect(ligaPausaInterna(null, { ...acao, posicao: 4 }, 4)).toBe(false);
    expect(ligaPausaInterna(null, { tipo: 'EDITAR', posicao: 1, repeticoes: 3 }, 4)).toBe(false);
    expect(ligaPausaInterna(null, { tipo: 'CONCLUIR' }, 4)).toBe(false);
  });

  it('marcar → desfazer → marcar de novo: inicia, cancela e inicia outra vez', () => {
    const marcar = { tipo: 'FEITA' as const, posicao: 1, repeticoes: 4, carga: 40 };
    const desfazer = { tipo: 'DESFAZER' as const, posicao: 1 };
    expect(pausaDaAcao(null, marcar, 4)).toEqual({ iniciar: 1 });
    const marcada = { etapas: [feita(1, 4)] };
    expect(pausaDaAcao(marcada, desfazer, 4)).toEqual({ cancelar: 1 });
    const aposDesfazer = { etapas: aplicarAcao(marcada, desfazer, 4, null)!.etapas };
    expect(pausaDaAcao(aposDesfazer, marcar, 4)).toEqual({ iniciar: 1 });
  });

  it('Cluster de 3 blocos: desfazer o bloco 1 não cancela a pausa do bloco 2, que substituiu a dele', () => {
    const execucao = 'v1|c3|2026-10-19';
    const cronometro = { atual: null as Descanso | null };
    const aplicar = (registro: { etapas: EtapaRegistrada[] }, acao: Parameters<typeof aplicarAcao>[1]) => {
      const pausa = pausaDaAcao(registro, acao, 3);
      if (pausa && 'iniciar' in pausa) {
        cronometro.atual = descansoAoIniciar(cronometro.atual, iniciarDescanso(15, 0, 'Pausa entre blocos', origemDaPausa(execucao, pausa.iniciar)), true);
      } else if (pausa) {
        cronometro.atual = semDescansoDe(cronometro.atual, origemDaPausa(execucao, pausa.cancelar));
      }
      return { etapas: [...aplicarAcao(registro, acao, 3, null)!.etapas] };
    };
    let registro: { etapas: EtapaRegistrada[] } = { etapas: [] };
    registro = aplicar(registro, { tipo: 'FEITA', posicao: 1, repeticoes: 4, carga: 40 });
    expect(cronometro.atual?.origem).toBe(origemDaPausa(execucao, 1));
    registro = aplicar(registro, { tipo: 'FEITA', posicao: 2, repeticoes: 4, carga: 40 });
    expect(cronometro.atual?.origem).toBe(origemDaPausa(execucao, 2)); // a pausa 2 tomou o lugar da 1
    registro = aplicar(registro, { tipo: 'DESFAZER', posicao: 1 });
    expect(cronometro.atual?.origem).toBe(origemDaPausa(execucao, 2)); // desfazer o bloco 1 não toca na pausa 2
    registro = aplicar(registro, { tipo: 'DESFAZER', posicao: 2 });
    expect(cronometro.atual).toBeNull();
    registro = aplicar(registro, { tipo: 'FEITA', posicao: 3, repeticoes: 4, carga: 40 }); // o último bloco não tem pausa
    expect(cronometro.atual).toBeNull();
    aplicar(registro, { tipo: 'FEITA', posicao: 1, repeticoes: 4, carga: 40 }); // marcar de novo o bloco 1: pausa nova
    expect(cronometro.atual?.origem).toBe(origemDaPausa(execucao, 1));
  });

  it('a pausa só responde a marcar e desfazer, e a última etapa não inicia pausa', () => {
    const marcada = { etapas: [feita(1, 4)] };
    expect(pausaDaAcao(null, { tipo: 'FEITA', posicao: 4, repeticoes: 4, carga: 40 }, 4)).toBeNull();
    expect(pausaDaAcao(marcada, { tipo: 'FEITA', posicao: 1, repeticoes: 4, carga: 40 }, 4)).toBeNull();
    expect(pausaDaAcao(marcada, { tipo: 'EDITAR', posicao: 1, repeticoes: 3 }, 4)).toBeNull();
    expect(pausaDaAcao(marcada, { tipo: 'NAO_REALIZADA', posicao: 2 }, 4)).toBeNull();
    expect(pausaDaAcao(marcada, { tipo: 'CONCLUIR' }, 4)).toBeNull();
    expect(pausaDaAcao(marcada, { tipo: 'REABRIR' }, 4)).toBeNull();
  });

  it('a origem da pausa distingue versão, série, data e posição', () => {
    const base = origemDaPausa('v1|s1|2026-10-19', 1);
    expect(origemDaPausa('v1|s1|2026-10-19', 1)).toBe(base);
    expect(origemDaPausa('v2|s1|2026-10-19', 1)).not.toBe(base);
    expect(origemDaPausa('v1|s2|2026-10-19', 1)).not.toBe(base);
    expect(origemDaPausa('v1|s1|2026-10-20', 1)).not.toBe(base);
    expect(origemDaPausa('v1|s1|2026-10-19', 2)).not.toBe(base);
  });

  it('lista por posição, sem duplicar', () => {
    expect(comEtapa([feita(2, 4), feita(1, 4)], feita(1, 3)).map((e) => [e.posicao, e.repeticoes])).toEqual([[1, 3], [2, 4]]);
    expect(semEtapa([feita(1, 4), feita(2, 4)], 1).map((e) => e.posicao)).toEqual([2]);
    expect(proximaPendente([feita(1, 4), naoFeita(3)], 4)).toBe(2);
    expect(todasComSituacao([feita(1, 4), naoFeita(2)], 2)).toBe(true);
  });
});
