import type { Configuracao } from '../api/tipos';

/**
 * Regras de um plano sem metodologia vinculada e ponto de partida de um modelo de metodologia ou de séries novo.
 * Espelho de `ConfiguracaoConsultoria.padrao()` na API: mudou lá, mude aqui.
 */
export const CONFIGURACAO_PADRAO: Configuracao = {
  tiposSerie: ['Aquecimento', 'FS', 'WS', 'Back off', 'Top set', 'Rest pause', 'Cluster'],
  tipoTrabalho: 'WS',
  tipoPreparacao: 'FS',
  regraPreparacao: { '1': [85], '2': [70, 85], '3': [50, 70, 85] },
  arredondamentoKg: 0.5,
  instrucoesTreino: '',
  rodapePdf: '',
  repeticoes: {
    Aquecimento: { min: 10, max: 15 },
    FS: { min: 3, max: 3 },
    WS: { min: 3, max: 6 },
    'Back off': { min: 6, max: 8 },
  },
};
