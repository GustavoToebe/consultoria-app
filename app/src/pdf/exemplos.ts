import type { ConteudoDieta, ConteudoTreino, ExercicioPlano, Marca, RegistroPeso, Serie } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { normalizarTreino } from '../dominio/editorTreino';
import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import type { Documento } from './html';
import { documentoDieta } from './pdfDieta';
import { documentoTreino } from './pdfTreino';

/**
 * Documentos de exemplo para a prévia dos temas (plano `docs/planos/documentos-pdf-motor.md`, D9): dados 100% fictícios,
 * montados aqui, sem consultar o banco e sem aluno real. Passam pelos geradores de verdade (`documentoTreino` e
 * `documentoDieta`), então a prévia é o mesmo HTML e o mesmo CSS do PDF final. Os uids são fixos para o resultado ser
 * sempre o mesmo (a data de emissão e a marca vêm de quem chama).
 */

const NOME_DO_ALUNO = 'Aluno de Exemplo';
const VIDEO = 'https://youtu.be/exemplo';
const NOTA_DO_RODAPE = 'Documento de exemplo para visualizar o tema. Nenhum dado é real.';

const serie = (uid: string, extra: Partial<Serie> = {}): Serie => ({
  uid,
  tipo: 'WORKING',
  repsMin: 8,
  repsMax: 10,
  amrap: null,
  carga: { modo: 'CARGA_TRABALHO' },
  esforco: null,
  descansoSegundos: 90,
  tecnica: null,
  cardio: null,
  alvoExtra: null,
  ...extra,
});

const exercicio = (uid: string, nome: string, series: Serie[], extra: Partial<ExercicioPlano> = {}): ExercicioPlano => ({
  uid,
  exercicioId: null,
  nome,
  modalidade: null,
  videoUrl: VIDEO,
  observacao: null,
  progressao: true,
  unidade: 'kg',
  series,
  grupoUid: null,
  ...extra,
});

/** Três sessões com dia fixo mais um descanso ativo; séries de aquecimento, trabalho e back off, técnicas, grupo, observações e vídeo. */
function conteudoDeTreino(): ConteudoTreino {
  return normalizarTreino({
    metodologia: {
      id: 'metodologia-exemplo',
      nome: 'Metodologia de exemplo',
      configuracao: {
        ...CONFIGURACAO_PADRAO,
        instrucoesTreino: 'Aquecimento: faça 5 minutos de esteira leve antes de começar.\nDescanso: respeite o tempo indicado em cada série.\nCarga: aumente só quando fechar todas as repetições com boa execução.',
        rodapePdf: NOTA_DO_RODAPE,
      },
    },
    objetivo: 'Objetivo de exemplo: ganho de força com boa técnica',
    orientacoes: 'Orientações de exemplo: beba água durante o treino e anote como se sentiu em cada sessão.',
    sessoes: [
      {
        uid: 'sessao-a',
        nome: 'Treino A - Peito e tríceps',
        diaSemana: 1,
        observacao: 'Observação da sessão: comece pelo exercício mais pesado.',
        exercicios: [
          exercicio(
            'supino',
            'Supino reto',
            [
              serie('supino-wu', { tipo: 'WARM_UP', repsMin: 12, repsMax: 15, carga: { modo: 'NENHUMA' }, descansoSegundos: 45 }),
              serie('supino-f1', { tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: { modo: 'PERCENTUAL_WS', percentualMin: 50, percentualMax: null } }),
              serie('supino-f2', { tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: { modo: 'PERCENTUAL_WS', percentualMin: 70, percentualMax: null } }),
              serie('supino-w', { esforco: { rir: 1, rpe: null }, alvoExtra: 'Pausa de um segundo no peito' }),
              serie('supino-b1', { tipo: 'BACK_OFF', repsMin: 8, repsMax: 10, carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: null } }),
              serie('supino-b2', { tipo: 'BACK_OFF', repsMin: 8, repsMax: 10, carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: null } }),
            ],
            { observacao: 'Observação do exercício: escápulas firmes no banco.', cadencia: '3-1-1-0' },
          ),
          exercicio('crucifixo', 'Crucifixo inclinado', [serie('cruc-1', { esforco: { rir: 2, rpe: null } }), serie('cruc-2', { esforco: { rir: 2, rpe: null } })], {
            grupoUid: 'grupo-a',
          }),
          exercicio('triceps', 'Tríceps corda', [serie('tri-1', { repsMin: 12, repsMax: 15 }), serie('tri-2', { repsMin: 12, repsMax: 15 })], { grupoUid: 'grupo-a' }),
          exercicio('triceps-testa', 'Tríceps testa', [
            serie('tt-1', { repsMin: 10, repsMax: 12 }),
            serie('tt-2', { repsMin: 10, repsMax: 12, tecnica: { tipo: 'DROP_SET', quedas: 2, reducaoPercentual: 20 } }),
          ]),
        ],
        grupos: [{ uid: 'grupo-a', tecnica: 'SUPERSET', descansoAposSegundos: 90, voltas: null }],
      },
      {
        uid: 'sessao-b',
        nome: 'Treino B - Costas e bíceps',
        diaSemana: 3,
        exercicios: [
          exercicio('remada', 'Remada baixa', [
            serie('remada-1', { repsMin: 6, repsMax: 8, esforco: { rir: 1, rpe: null } }),
            serie('remada-2', { repsMin: 6, repsMax: 8, tecnica: { tipo: 'REST_PAUSE', pausas: 1, pausaSegundos: 20 } }),
          ]),
          exercicio('puxada', 'Puxada alta', [serie('puxada-1', { tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15 }, repsMin: 6, repsMax: 6 }), serie('puxada-2')], {
            observacao: 'Observação do exercício: puxe com os cotovelos.',
          }),
          exercicio('rosca', 'Rosca direta', [serie('rosca-1', { repsMin: 10, repsMax: 12 }), serie('rosca-2', { repsMin: 10, repsMax: 12 })]),
        ],
        grupos: [],
      },
      {
        uid: 'sessao-c',
        nome: 'Treino C - Pernas',
        diaSemana: 5,
        exercicios: [
          exercicio('agachamento', 'Agachamento livre', [
            serie('agacha-w', { esforco: { rir: 2, rpe: null }, repsMin: 6, repsMax: 8 }),
            serie('agacha-b', { tipo: 'BACK_OFF', repsMin: 8, repsMax: 10, carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: null } }),
          ]),
          exercicio('leg', 'Leg press 45', [serie('leg-1', { repsMin: 10, repsMax: 12 }), serie('leg-2', { repsMin: 10, repsMax: 12 })]),
          exercicio('panturrilha', 'Panturrilha em pé', [serie('pant-1', { repsMin: 15, repsMax: 20 })], { observacao: 'Observação do exercício: suba até o topo.' }),
        ],
        grupos: [],
      },
      { uid: 'sessao-d', nome: 'Domingo - Descanso ativo', diaSemana: 7, tipo: 'DESCANSO_ATIVO', cardio: 'Caminhada leve de 30 minutos', exercicios: [], grupos: [] },
    ],
  });
}

/** Treino de exemplo pelo gerador real. `marca` traz a cor e o `temaPdf` a mostrar; sem logo, a faixa mostra só o nome. */
export function documentoDeExemploDeTreino(marca: Marca, emitidoEm: Date, logoDataUri: string | null = null): Documento {
  return documentoTreino({
    marca,
    logoDataUri,
    aluno: NOME_DO_ALUNO,
    titulo: 'Plano de Exemplo',
    inicio: '2026-01-05',
    fim: '2026-02-01',
    versao: 1,
    conteudo: conteudoDeTreino(),
    instrucoesTreino: null,
    rodapePdf: null,
    emitidoEm,
  });
}

/** `fibra` nula = sem fibra informada (o ovo e o frango): o total do dia sai "(parcial)", como na tela. */
const item = (uid: string, nome: string, quantidade: number, unidade: 'g' | 'ml' | 'un', kcal: number, proteina: number, carboidrato: number, gordura: number, fibra: number | null = null) => ({
  uid, alimentoId: null, nome, quantidade, unidade, kcal, proteina, carboidrato, gordura, fibra, manual: true,
});

/** Quatro refeições (uma com opções A e B e outra com modo de preparo), orientações, suplementos com cupom e três pesos. */
function conteudoDeDieta(): ConteudoDieta {
  return normalizarDieta({
    objetivo: 'Objetivo de exemplo: manter a rotina alimentar',
    dataInicio: '2026-01-05',
    profissional: 'Profissional de Exemplo',
    aguaLitros: 3,
    refeicoes: [
      {
        uid: 'ref-cafe',
        nome: 'Café da manhã',
        horario: '07:30',
        observacao: 'Observação da refeição: escolha uma das opções.',
        opcoes: [
          { uid: 'cafe-a', rotulo: 'A', itens: [item('i1', 'Pão integral', 50, 'g', 125, 5, 22, 2, 3.4), item('i2', 'Ovo cozido', 2, 'un', 140, 12, 1, 10)] },
          { uid: 'cafe-b', rotulo: 'B', itens: [item('i3', 'Iogurte natural', 170, 'g', 105, 6, 8, 5, 0), item('i4', 'Aveia em flocos', 30, 'g', 115, 4, 20, 2, 2.9)] },
        ],
      },
      {
        uid: 'ref-almoco',
        nome: 'Almoço',
        horario: '12:30',
        modoDePreparo: 'Cozinhe o arroz em fogo baixo.\nGrelhe o frango com temperos naturais.',
        opcoes: [{ uid: 'almoco-a', rotulo: 'A', itens: [item('i5', 'Arroz cozido', 120, 'g', 155, 3, 34, 0, 1.9), item('i6', 'Frango grelhado', 150, 'g', 240, 45, 0, 5), item('i7', 'Salada de folhas', 80, 'g', 15, 1, 3, 0, 1.6)] }],
      },
      {
        uid: 'ref-lanche',
        nome: 'Lanche da tarde',
        horario: '16:00',
        opcoes: [{ uid: 'lanche-a', rotulo: 'A', itens: [item('i8', 'Banana', 1, 'un', 90, 1, 23, 0, 2), item('i9', 'Castanhas', 20, 'g', 130, 3, 4, 12, 1.5)] }],
      },
      {
        uid: 'ref-jantar',
        nome: 'Jantar',
        horario: '20:00',
        opcoes: [{ uid: 'jantar-a', rotulo: 'A', itens: [item('i10', 'Omelete de legumes', 1, 'un', 220, 15, 6, 15), item('i11', 'Batata-doce cozida', 100, 'g', 90, 2, 21, 0, 2.2)] }],
      },
    ],
    orientacoes: [{ titulo: 'Hidratação', texto: 'Orientação de exemplo: distribua a água ao longo do dia.' }],
    observacoes: 'Observações de exemplo: combine qualquer troca de alimento com o seu treinador.',
    suplementacao: [
      { uid: 'sup-1', nome: 'Proteína em pó (exemplo)', dose: '30 g', horario: 'Depois do treino', observacao: 'Misturar com água', link: 'https://loja.example/proteina', cupom: 'EXEMPLO10' },
      { uid: 'sup-2', nome: 'Creatina (exemplo)', dose: '3 g', horario: 'Qualquer horário', observacao: 'Todos os dias', link: null },
    ],
    ergogenicos: [],
  });
}

const PESOS: RegistroPeso[] = [
  { id: 'peso-1', data: '2026-01-05', pesoKg: 80, variacao: null, observacao: null, metaDoPeso: 'REDUZIR' },
  { id: 'peso-2', data: '2026-01-19', pesoKg: 79.2, variacao: -0.8, observacao: null, metaDoPeso: 'REDUZIR' },
  { id: 'peso-3', data: '2026-02-02', pesoKg: 79.5, variacao: 0.3, observacao: null, metaDoPeso: 'REDUZIR' },
];

/** Dieta de exemplo pelo gerador real. Sem lista de compras (é outro documento); `marca` traz a cor e o `temaPdf`. */
export function documentoDeExemploDeDieta(marca: Marca, emitidoEm: Date, logoDataUri: string | null = null): Documento {
  return documentoDieta({
    marca,
    logoDataUri,
    aluno: NOME_DO_ALUNO,
    titulo: 'Plano de Exemplo',
    versao: 1,
    conteudo: conteudoDeDieta(),
    pesos: PESOS,
    rodapePdf: NOTA_DO_RODAPE,
    emitidoEm,
  });
}
