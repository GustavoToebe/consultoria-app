import type { ConteudoTreino, Exercicio, PlanoDetalhe, PlanoResumo } from '../src/api/tipos';
import { carga, exercicio, grupo, rir, serie, sessao, tecnica } from '../src/dominio/exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';

/**
 * Plano fictício do editor em lista + inspetor (`editor-inspetor.spec.ts`): três sessões, com FS/WS/Back off, Cluster,
 * Rest-pause, um Superset e um cardio. Com `comProblema`, o 2º exercício da 1ª sessão tem o único erro do plano na série
 * de Back off, que é a 2ª aba dele: o "ir ao primeiro" precisa escolher esse exercício e abrir essa aba. Só dados fictícios.
 */
export const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
export const PLANO_ID = 'p0000000-0000-4000-8000-0000000000e1';

const ID_DA_BIBLIOTECA = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A biblioteca que o editor lê ao abrir (`GET /exercicios`): dá o grupo muscular do resumo da sessão. */
export const BIBLIOTECA: Exercicio[] = [
  ['Supino reto com barra', 'Peito', 'LIVRE'],
  ['Supino inclinado com halteres', 'Peito', 'LIVRE'],
  ['Crucifixo na máquina', 'Peito', 'MAQUINA'],
  ['Tríceps na polia', 'Tríceps', 'MAQUINA'],
  ['Tríceps francês', 'Tríceps', 'LIVRE'],
  ['Paralelas', 'Tríceps', 'LIVRE'],
  ['Esteira', 'Cardio', 'CARDIO'],
].map(([nome, grupoMuscular, modalidade], i) => ({
  id: ID_DA_BIBLIOTECA(i + 1), nome, grupoMuscular, equipamento: null, modalidade: modalidade as Exercicio['modalidade'],
  videoUrl: null, observacoes: null, origem: 'PROPRIO', imagens: [], imagemPropriaEm: null,
}));

const daBiblioteca = (n: number) => ({ exercicioId: ID_DA_BIBLIOTECA(n), nome: BIBLIOTECA[n - 1].nome, modalidade: BIBLIOTECA[n - 1].modalidade as string });

export function conteudoDoPlano(comProblema: boolean): ConteudoTreino {
  const feeder = (uid: string, min: number, max: number | null = null) => serie(uid, { tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: carga('PERCENTUAL_WS', min, max) });
  const peito = sessao('sa', [
    exercicio('supino', {
      ...daBiblioteca(1), series: [
        feeder('supino-1', 50), feeder('supino-2', 70), feeder('supino-3', 85, 90),
        serie('supino-4', { repsMin: 6, repsMax: 8, esforco: rir(1), descansoSegundos: 180 }),
        serie('supino-5', { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: carga('PERCENTUAL_WS', 85), descansoSegundos: 120 }),
      ],
    }),
    exercicio('inclinado', {
      ...daBiblioteca(2), series: [
        serie('inclinado-1', { repsMin: 8, repsMax: 10, esforco: rir(1), descansoSegundos: 120 }),
        serie('inclinado-2', { repsMin: 8, repsMax: 10, esforco: rir(1), descansoSegundos: 120 }),
        // O erro do plano: mínimo maior que o máximo, na 2ª aba (Back off) do 2º exercício.
        serie('inclinado-3', { tipo: 'BACK_OFF', repsMin: comProblema ? 12 : 6, repsMax: 8, carga: carga('PERCENTUAL_WS', 85), descansoSegundos: 90 }),
      ],
    }),
    exercicio('crucifixo', {
      ...daBiblioteca(3), series: [
        serie('crucifixo-1', { repsMin: 10, repsMax: 10, esforco: rir(0), tecnica: tecnica('CLUSTER', { blocos: [4, 4, 2], pausaSegundos: 15 }), descansoSegundos: 120 }),
      ],
    }),
    exercicio('polia', { ...daBiblioteca(4), grupoUid: 'superset', series: ['1', '2', '3'].map((n) => serie(`polia-${n}`, { repsMin: 10, repsMax: 12, esforco: rir(1) })) }),
    exercicio('frances', { ...daBiblioteca(5), grupoUid: 'superset', series: ['1', '2', '3'].map((n) => serie(`frances-${n}`, { repsMin: 10, repsMax: 12, esforco: rir(1) })) }),
    exercicio('paralelas', {
      ...daBiblioteca(6), unidade: 'nenhuma', series: [
        serie('paralelas-1', { repsMin: 8, repsMax: 12, carga: null, esforco: rir(1), descansoSegundos: 90 }),
        serie('paralelas-2', { repsMin: 8, repsMax: 12, carga: null, esforco: rir(0), tecnica: tecnica('REST_PAUSE', { pausas: 1, pausaSegundos: 20 }), descansoSegundos: 90 }),
      ],
    }),
    exercicio('esteira', {
      ...daBiblioteca(7), progressao: false, unidade: 'nenhuma', series: [
        serie('esteira-1', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 20, zona: 2 } }),
      ],
    }),
  ], [grupo('superset', 'SUPERSET', { descansoAposSegundos: 90 })], { nome: 'Peito e tríceps', diaSemana: 1 });
  const costas = sessao('sb', [
    exercicio('remada', { nome: 'Remada curvada', modalidade: 'LIVRE', series: [serie('remada-1', { repsMin: 8, repsMax: 10, esforco: rir(1) }), serie('remada-2', { repsMin: 8, repsMax: 10, esforco: rir(1) })] }),
    exercicio('puxada', { nome: 'Puxada frontal', modalidade: 'MAQUINA', series: [serie('puxada-1', { repsMin: 10, repsMax: 12 })] }),
    exercicio('rosca', { nome: 'Rosca direta', modalidade: 'LIVRE', series: [serie('rosca-1', { repsMin: 10, repsMax: 12 })] }),
  ], [], { nome: 'Costas e bíceps', diaSemana: 3 });
  const pernas = sessao('sc', [
    exercicio('agachamento', { nome: 'Agachamento livre', modalidade: 'LIVRE', series: [serie('agachamento-1', { repsMin: 6, repsMax: 8, esforco: rir(2) })] }),
    exercicio('extensora', { nome: 'Cadeira extensora', modalidade: 'MAQUINA', series: [serie('extensora-1', { repsMin: 12, repsMax: 15 })] }),
  ], [], { nome: 'Pernas', diaSemana: 5 });
  return {
    metodologia: { id: 'r0000000-0000-4000-8000-0000000000e1', nome: 'Metodologia de teste', configuracao: CONFIGURACAO_PADRAO },
    objetivo: null, orientacoes: null, sessoes: [peito, costas, pernas],
  };
}

/** Plano nunca publicado e sem pasta (o "Publicar" fica liberado e não há rotas da pasta). */
export function planoDetalhe(comProblema: boolean): PlanoDetalhe<ConteudoTreino> {
  const plano: PlanoResumo = {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Treino de novembro', inicio: '2026-11-02', fim: '2026-11-29', ativo: true,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  };
  return { plano, rascunho: conteudoDoPlano(comProblema), versoes: [] };
}
