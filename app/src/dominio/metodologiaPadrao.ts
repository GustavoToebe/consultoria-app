import type { Carga, Configuracao, Esforco, Tecnica, TipoDeTecnica } from '../api/tipos';

const carga = (modo: Carga['modo'], percentualMin: number | null = null, percentualMax: number | null = null): Carga => ({ modo, percentualMin, percentualMax, referenciaUid: null });
const cargaDeTrabalho = (): Carga => carga('CARGA_TRABALHO');
const percentual = (min: number, max: number | null = null): Carga => carga('PERCENTUAL_WS', min, max);
const acimaDaAnterior = (min: number, max: number): Carga => carga('ACIMA_DA_ANTERIOR', min, max);
const rir = (valor: number): Esforco => ({ rir: valor, rpe: null });

/** Técnica só com os campos do padrão (o resto nulo), como a API devolve. */
const tecnica = (tipo: TipoDeTecnica, valores: Partial<Tecnica> = {}): Tecnica => ({
  tipo,
  pausaSegundos: null,
  pausaRespiracoes: null,
  pausas: null,
  blocos: null,
  quedas: null,
  reducaoPercentual: null,
  repsPorQueda: null,
  miniSeries: null,
  repsPorMiniSerie: null,
  repsParciais: null,
  regiao: null,
  repsAssistidas: null,
  ...valores,
});

/**
 * Metodologia padrão (regras do Saraiva, nos cinco tipos da especificação), usada quando o plano ou a consultoria não
 * tem nenhuma. ESPELHO EXATO de `ConfiguracaoConsultoria.padrao()` na API: mudou um, mude o outro. Todo percentual é da
 * série de trabalho (WS). Os códigos (`WARM_UP`, `FEEDER`, `WORKING`, `TOP_SET`, `BACK_OFF`) são o que a série grava.
 */
export const CONFIGURACAO_PADRAO: Configuracao = {
  tipos: [
    {
      codigo: 'WARM_UP',
      nome: 'Aquecimento',
      papel: 'AQUECIMENTO',
      repeticoes: { min: 10, max: 15 },
      cargaPadrao: null,
      esforcoPadrao: null,
      porModalidade: null,
      regraPercentuais: null,
      explicacao: 'Série leve, só para preparar o movimento. Fica longe da falha.',
    },
    {
      codigo: 'FEEDER',
      nome: 'FS',
      papel: 'PREPARACAO',
      repeticoes: { min: 3, max: 3 },
      cargaPadrao: percentual(85),
      esforcoPadrao: null,
      porModalidade: null,
      regraPercentuais: {
        '1': [{ min: 85, max: null }],
        '2': [{ min: 70, max: null }, { min: 85, max: 90 }],
        '3': [{ min: 50, max: null }, { min: 70, max: null }, { min: 85, max: 90 }],
      },
      explicacao:
        'Feeder set: série de reconhecimento. Aumente a carga a cada série, dentro das repetições, para chegar à carga da série de trabalho. Não chega na falha.',
    },
    {
      codigo: 'WORKING',
      nome: 'WS',
      papel: 'TRABALHO',
      repeticoes: { min: 3, max: 6 },
      cargaPadrao: cargaDeTrabalho(),
      esforcoPadrao: rir(1),
      porModalidade: {
        LIVRE: { carga: cargaDeTrabalho(), esforco: rir(1) },
        MAQUINA: { carga: cargaDeTrabalho(), esforco: rir(0) },
      },
      regraPercentuais: null,
      explicacao:
        'Working set: a série de trabalho, com a carga máxima do dia nas repetições propostas. Peso livre: 1 repetição na reserva. Máquina: até a falha. Se passar das repetições, aumente a carga na semana seguinte.',
    },
    {
      codigo: 'TOP_SET',
      nome: 'Top set',
      papel: 'TRABALHO',
      repeticoes: null,
      cargaPadrao: acimaDaAnterior(1, 5),
      esforcoPadrao: null,
      porModalidade: {
        LIVRE: { carga: acimaDaAnterior(1, 5), esforco: null },
        MAQUINA: { carga: acimaDaAnterior(5, 10), esforco: null },
      },
      regraPercentuais: null,
      explicacao: 'Uma série mais pesada que a anterior: suba a carga de 1 a 5% no peso livre ou de 5 a 10% na máquina.',
    },
    {
      codigo: 'BACK_OFF',
      nome: 'Back off',
      papel: 'POS_TRABALHO',
      repeticoes: { min: 6, max: 8 },
      cargaPadrao: percentual(85),
      esforcoPadrao: null,
      porModalidade: null,
      regraPercentuais: null,
      explicacao: 'Depois da série de trabalho, com 85% da carga dela.',
    },
  ],
  tecnicas: [
    {
      tipo: 'REST_PAUSE',
      nome: 'Rest pause',
      explicacao: 'Faça a série, pause 20 segundos e continue com a mesma carga até a falha.',
      padrao: tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 1 }),
    },
    {
      tipo: 'CLUSTER',
      nome: 'Cluster',
      explicacao: 'Muscle Round: a série é dividida em blocos de repetições com uma pausa curta entre eles, com a mesma carga.',
      padrao: tecnica('CLUSTER', { pausaSegundos: 15 }),
    },
    {
      tipo: 'DROP_SET',
      nome: 'Drop-set',
      explicacao: 'Ao terminar a série, reduza a carga e continue sem descanso.',
      padrao: tecnica('DROP_SET', { quedas: 1 }),
    },
    {
      tipo: 'MYO_REPS',
      nome: 'Myo-reps',
      explicacao: 'Uma série de ativação até perto da falha e, depois de poucas respirações, várias mini-séries curtas com a mesma carga.',
      padrao: tecnica('MYO_REPS', { pausaRespiracoes: 5 }),
    },
    {
      tipo: 'PARTIAL_REPS',
      nome: 'Partial reps',
      explicacao: 'Ao chegar à falha, continue com repetições parciais, sem completar o movimento.',
      padrao: tecnica('PARTIAL_REPS', { regiao: 'LIVRE' }),
    },
    {
      tipo: 'FORCED_REPS',
      nome: 'Forced reps',
      explicacao: 'Ao chegar à falha, um parceiro ajuda só o necessário para você fazer mais repetições.',
      padrao: tecnica('FORCED_REPS'),
    },
  ],
  combinacoes: [
    {
      tipo: 'SUPERSET',
      nome: 'Superset',
      explicacao: 'Dois exercícios feitos em sequência, sem descanso entre eles. O descanso vem depois do par.',
    },
    {
      tipo: 'AGONISTA_ANTAGONISTA',
      nome: 'Agonista-antagonista',
      explicacao: 'Dois exercícios de músculos opostos (por exemplo, peito e costas) feitos em sequência, sem descanso entre eles.',
    },
    {
      tipo: 'TRI_SET',
      nome: 'Tri-set',
      explicacao: 'Três exercícios feitos em sequência, sem descanso entre eles. O descanso vem depois do trio.',
    },
    {
      tipo: 'GIANT_SET',
      nome: 'Giant set',
      explicacao: 'Quatro ou mais exercícios feitos em sequência, sem descanso entre eles.',
    },
    {
      tipo: 'CIRCUITO',
      nome: 'Circuito',
      explicacao: 'Três ou mais exercícios feitos em sequência e repetidos pelo número de voltas, com o descanso depois de cada volta.',
    },
    {
      tipo: 'PRE_EXAUSTAO',
      nome: 'Pré-exaustão',
      explicacao: 'Dois exercícios em sequência: primeiro um que isola o músculo e depois o composto. Cada série mantém o próprio descanso.',
    },
    {
      tipo: 'POS_EXAUSTAO',
      nome: 'Pós-exaustão',
      explicacao: 'Dois exercícios em sequência: primeiro o composto e depois um que isola o músculo. Cada série mantém o próprio descanso.',
    },
  ],
  arredondamentoKg: 0.5,
  instrucoesTreino: '',
  rodapePdf: '',
};
