/**
 * XP e nível (plano `xp-e-niveis`): regra pura, derivada a cada leitura. Espelho de `api/.../comunidade/RegrasXp.java`
 * (mudou uma, mude a outra e o `scripts/xp/gerar-fixtures.mjs`; os dois lados leem as mesmas fixtures de `paridade-xp/`).
 * - Treino: no máximo UM por dia conta, o melhor do dia (completo 10, parcial 5). Sessão reaberta (`concluida` falso) não
 *   vale nada, então reabrir tira o XP.
 * - Semana completa +20 (uma vez por semana), cada tipo de conquista +50, recorde +15 (no máximo um por exercício por dia).
 * - Nível = 1 + XP / 100. Nada de XP por peso, medida, foto ou dieta.
 * Datas em `AAAA-MM-DD` (Brasília).
 */

export const XP_TREINO_COMPLETO = 10;
export const XP_TREINO_PARCIAL = 5;
export const XP_SEMANA_COMPLETA = 20;
export const XP_CONQUISTA = 50;
export const XP_RECORDE = 15;
export const XP_POR_NIVEL = 100;

/** Uma sessão como a API a guarda (`SessaoConcluidaDto`). */
export interface SessaoDoDia { data: string; concluida: boolean; resultado: 'COMPLETA' | 'PARCIAL' | null }
/** A semana que começa na segunda `inicio`: treinos com dia fixo previstos (`total`) e feitos (`feitas`). */
export interface SemanaDoPlano { inicio: string; feitas: number; total: number }
/** Um exercício que bateu recorde em `data` (qualquer tipo; vale um por exercício por dia). */
export interface RecordeDoDia { data: string; exercicioId: string }
/** `xpNoNivel` (0 a 99) e `faltam` (1 a 100) descrevem a barra até o próximo nível. */
export interface Xp { xp: number; nivel: number; xpNoNivel: number; faltam: number }

/** Mesma conta do `semanaCompleta` de `progressoSemana`: plano sem treino com dia fixo (`total` zero) nunca comemora. */
export const semanaCompleta = (feitas: number, total: number): boolean => total > 0 && feitas >= total;

/** Começa no nível 1 e sobe a cada 100 XP. Número negativo conta como zero. */
export const nivel = (xp: number): number => 1 + Math.floor(Math.max(0, xp) / XP_POR_NIVEL);

const valorDoTreino = (s: SessaoDoDia) => {
  if (!s.concluida) return 0;
  return s.resultado === 'COMPLETA' ? XP_TREINO_COMPLETO : s.resultado === 'PARCIAL' ? XP_TREINO_PARCIAL : 0;
};

export function calcularXp(
  sessoes: SessaoDoDia[],
  semanas: SemanaDoPlano[],
  tiposDeConquista: string[],
  recordes: RecordeDoDia[],
): Xp {
  const melhorDoDia = new Map<string, number>();
  for (const s of sessoes) melhorDoDia.set(s.data, Math.max(melhorDoDia.get(s.data) ?? 0, valorDoTreino(s)));
  let xp = 0;
  for (const v of melhorDoDia.values()) xp += v;
  xp += new Set(semanas.filter((w) => semanaCompleta(w.feitas, w.total)).map((w) => w.inicio)).size * XP_SEMANA_COMPLETA;
  xp += new Set(tiposDeConquista).size * XP_CONQUISTA;
  xp += new Set(recordes.map((r) => `${r.data}|${r.exercicioId}`)).size * XP_RECORDE;
  const xpNoNivel = xp % XP_POR_NIVEL;
  return { xp, nivel: nivel(xp), xpNoNivel, faltam: XP_POR_NIVEL - xpNoNivel };
}
