import type { ExercicioPlano, PastaModelo, Receita, Sessao } from '../api/tipos';
import { normalizarTreino } from './editorTreino';
import {
  abaDaSemana, abaInicial, CHIP_SEM_COLECAO, contagemPorAba, faixaDaSemana, filtroEfetivo, filtrosDeColecao, sessaoInicial, semanasDaLista, TODAS_AS_COLECOES,
} from './listaDeSemanas';

const exercicio = (uid: string): ExercicioPlano => ({
  uid, exercicioId: null, nome: `Exercício ${uid}`, modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: false, unidade: 'kg', series: [],
});
const sessao = (uid: string, diaSemana: number | null, exercicios = 0, extra: Partial<Sessao> = {}): Sessao => ({
  uid, nome: `Sessão ${uid}`, diaSemana, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
  exercicios: Array.from({ length: exercicios }, (_, i) => exercicio(`${uid}-${i}`)), ...extra,
});
const semana = (id: string, nome: string, sessoes: Sessao[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'PLANO_TREINO', origem: 'PADRAO', nome, descricao: null, pastaId: null, ordem: 1, versao: 1,
  conteudo: { objetivo: null, orientacoes: null, sessoes }, ...extra,
});

const COLECOES: PastaModelo[] = [{ id: 'c-forca', nome: 'Força', versao: 1 }, { id: 'c-a', nome: 'Avançado', versao: 1 }, { id: 'c-vazia', nome: 'Vazia', versao: 1 }];
const SEMANAS = [
  semana('1', 'Full body', [sessao('a', 1, 3), sessao('b', 3, 2)], { pastaId: 'c-forca', descricao: 'Três vezes por semana' }),
  semana('2', 'Push pull legs', [sessao('c', 1, 4)], { pastaId: 'c-a' }),
  semana('3', 'Estrutura ABC', [sessao('d', 1), sessao('e', 2)]),
  semana('4', 'Órfã', [sessao('f', 2, 1)], { pastaId: 'apagada' }),
];

test('a aba vem da forma: sem exercício nenhum é estrutura', () => {
  expect(abaDaSemana(SEMANAS[0].conteudo)).toBe('COMPLETAS');
  expect(abaDaSemana(SEMANAS[2].conteudo)).toBe('ESTRUTURAS');
  expect(abaDaSemana(null)).toBe('ESTRUTURAS');
});

test('contagem segue a busca (sem acento) e a aba inicial é Completas, senão Estruturas', () => {
  expect(contagemPorAba(SEMANAS, '')).toEqual({ COMPLETAS: 3, ESTRUTURAS: 1 });
  expect(contagemPorAba(SEMANAS, 'orfa')).toEqual({ COMPLETAS: 1, ESTRUTURAS: 0 });
  expect(contagemPorAba(SEMANAS, 'tres vezes')).toEqual({ COMPLETAS: 1, ESTRUTURAS: 0 });
  expect(abaInicial(SEMANAS)).toBe('COMPLETAS');
  expect(abaInicial([SEMANAS[2]])).toBe('ESTRUTURAS');
  expect(abaInicial([])).toBe('COMPLETAS');
});

test('chips de coleção: Todas, as da aba em ordem alfabética e Sem coleção (coleção apagada conta como sem)', () => {
  const daAba = SEMANAS.filter((r) => abaDaSemana(r.conteudo) === 'COMPLETAS');
  expect(filtrosDeColecao(daAba, COLECOES).map((f) => f.rotulo)).toEqual(['Todas', 'Avançado', 'Força', 'Sem coleção']);
  expect(filtrosDeColecao(daAba, null)).toEqual([]);
  expect(filtroEfetivo(daAba, 'c-vazia', COLECOES)).toBe(TODAS_AS_COLECOES);
  expect(filtroEfetivo(daAba, 'c-forca', COLECOES)).toBe('c-forca');
});

test('a lista junta aba, busca e chip; chip que não existe na aba vale como Todas', () => {
  const nomes = (l: Receita[]) => l.map((r) => r.nome);
  expect(nomes(semanasDaLista(SEMANAS, { aba: 'COMPLETAS', busca: '', filtro: TODAS_AS_COLECOES }, COLECOES))).toEqual(['Full body', 'Push pull legs', 'Órfã']);
  expect(nomes(semanasDaLista(SEMANAS, { aba: 'COMPLETAS', busca: '', filtro: CHIP_SEM_COLECAO }, COLECOES))).toEqual(['Órfã']);
  expect(nomes(semanasDaLista(SEMANAS, { aba: 'COMPLETAS', busca: 'push', filtro: 'c-forca' }, COLECOES))).toEqual([]);
  expect(nomes(semanasDaLista(SEMANAS, { aba: 'ESTRUTURAS', busca: '', filtro: 'c-forca' }, COLECOES))).toEqual(['Estrutura ABC']);
});

test('faixa da semana: 7 dias, duas sessões no mesmo dia, dia sem sessão e as sem dia fixo à parte', () => {
  const c = normalizarTreino({
    sessoes: [
      sessao('seg1', 1, 2, { nome: 'Segunda - Peito' }),
      sessao('seg2', 1, 1, { nome: 'Cardio' }),
      sessao('qua', 3, 0, { nome: 'Quarta', tipo: 'DESCANSO' }),
      sessao('qui', 4, 2, { nome: 'Mobilidade', tipo: 'DESCANSO_ATIVO' }),
      sessao('livre', null, 3, { nome: 'Acessórios' }),
    ],
  });
  const { dias, semDia } = faixaDaSemana(c);
  expect(dias.map((d) => d.curto)).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
  expect(dias[0].sessoes.map((s) => [s.nome, s.exercicios, s.abre])).toEqual([['Peito', 2, true], ['Cardio', 1, true]]);
  expect(dias[1].sessoes).toEqual([]);
  // Descanso sem exercício: discreto e não abre; descanso ativo tem exercícios e abre.
  expect(dias[2].sessoes[0]).toMatchObject({ nome: 'Descanso', descanso: true, abre: false });
  expect(dias[3].sessoes[0]).toMatchObject({ nome: 'Mobilidade', descanso: false, abre: true });
  expect(semDia.map((s) => [s.indice, s.nome])).toEqual([[4, 'Acessórios']]);
});

test('a sessão que abre é a primeira com exercício na ordem da semana; estrutura não abre nenhuma', () => {
  expect(sessaoInicial(normalizarTreino({ sessoes: [sessao('qua', 3, 2), sessao('seg', 1, 0), sessao('ter', 2, 1)] }))).toBe(2);
  expect(sessaoInicial(normalizarTreino({ sessoes: [sessao('livre', null, 1), sessao('seg', 1, 0)] }))).toBe(0);
  expect(sessaoInicial(normalizarTreino(SEMANAS[2].conteudo))).toBeNull();
});
