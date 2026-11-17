import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  calcularXp,
  nivel,
  semanaCompleta,
  XP_CONQUISTA,
  XP_POR_NIVEL,
  XP_RECORDE,
  XP_SEMANA_COMPLETA,
  XP_TREINO_COMPLETO,
  XP_TREINO_PARCIAL,
  type RecordeDoDia,
  type SemanaDoPlano,
  type SessaoDoDia,
  type Xp,
} from './xp';
import { semanaCompleta as semanaCompletaDoPlano } from './progressoSemana';

/**
 * Paridade com o Java: lê as mesmas fixtures de `RegrasXpTest` (`api/src/test/resources/paridade-xp/`, geradas por
 * `scripts/xp/gerar-fixtures.mjs`). Dados fictícios.
 */
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../api/src/test/resources/paridade-xp/casos.json'), 'utf8'),
) as {
  constantes: Record<string, number>;
  niveis: { xp: number; nivel: number }[];
  casos: { nome: string; entrada: { sessoes: SessaoDoDia[]; semanas: SemanaDoPlano[]; conquistas: string[]; recordes: RecordeDoDia[] }; esperado: Xp }[];
};

it('constantes iguais às da fixture (e às do Java)', () => {
  expect({
    treinoCompleto: XP_TREINO_COMPLETO, treinoParcial: XP_TREINO_PARCIAL, semanaCompleta: XP_SEMANA_COMPLETA,
    conquista: XP_CONQUISTA, recorde: XP_RECORDE, porNivel: XP_POR_NIVEL,
  }).toEqual(fixture.constantes);
});

it.each(fixture.niveis.map((n) => [n.xp, n.nivel] as const))('nível com %i XP é %i', (xp, esperado) => {
  expect(nivel(xp)).toBe(esperado);
});

it('semana completa exige treino previsto e feito, como o "Sua semana"', () => {
  expect(semanaCompleta(0, 0)).toBe(false);
  expect(semanaCompleta(2, 3)).toBe(false);
  expect(semanaCompleta(3, 3)).toBe(true);
  expect(semanaCompleta(4, 3)).toBe(true);
  // Mesma resposta do `semanaCompleta` do progresso da semana para os mesmos números.
  for (const [feitas, total] of [[0, 0], [2, 3], [3, 3], [4, 3]]) {
    expect(semanaCompleta(feitas, total)).toBe(semanaCompletaDoPlano({ feitas, total }));
  }
});

it('há casos de paridade', () => expect(fixture.casos.length).toBeGreaterThan(20));
it.each(fixture.casos.map((c) => [c.nome, c] as const))('xp: %s', (_nome, caso) => {
  const { sessoes, semanas, conquistas, recordes } = caso.entrada;
  expect(calcularXp(sessoes, semanas, conquistas, recordes)).toEqual(caso.esperado);
});
