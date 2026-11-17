// Gera a fixture de paridade Java/TS do XP em api/src/test/resources/paridade-xp/ (`node scripts/xp/gerar-fixtures.mjs`).
// Os esperados são escritos aqui à mão (xp somado na cabeça de cada caso), não calculados por RegrasXp nem por xp.ts.
// Mudou uma regra? Ajuste o caso, gere de novo e rode os dois lados (`RegrasXpTest` e `xp.test.ts`). O JSON é versionado, não se edita à mão.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const SAIDA = `${RAIZ}/api/src/test/resources/paridade-xp`;

const constantes = { treinoCompleto: 10, treinoParcial: 5, semanaCompleta: 20, conquista: 50, recorde: 15, porNivel: 100 };

// Só a conta da barra (100 por nível), independente da regra sob teste.
const esp = (xp) => ({ xp, nivel: 1 + Math.floor(xp / 100), xpNoNivel: xp % 100, faltam: 100 - (xp % 100) });
const dia = (n) => `2026-10-${String(n).padStart(2, '0')}`;
const sessao = (data, resultado, concluida = true) => ({ data, concluida, resultado: concluida ? resultado : null });
const dias = (de, ate, resultado) => Array.from({ length: ate - de + 1 }, (_, i) => sessao(dia(de + i), resultado));
const semana = (inicio, feitas, total) => ({ inicio, feitas, total });

const casos = [];
const c = (nome, entrada, xp) =>
  casos.push({ nome, entrada: { sessoes: [], semanas: [], conquistas: [], recordes: [], ...entrada }, esperado: esp(xp) });

c('dia_sem_treino', {}, 0);
c('treino_completo', { sessoes: [sessao(dia(1), 'COMPLETA')] }, 10);
c('treino_parcial', { sessoes: [sessao(dia(1), 'PARCIAL')] }, 5);
c('concluida_sem_resultado_nao_vale', { sessoes: [{ data: dia(1), concluida: true, resultado: null }] }, 0);
c('dois_dias_distintos', { sessoes: [sessao(dia(1), 'COMPLETA'), sessao(dia(2), 'PARCIAL')] }, 15);
c('dois_treinos_no_mesmo_dia_vale_o_melhor', { sessoes: [sessao(dia(1), 'PARCIAL'), sessao(dia(1), 'COMPLETA')] }, 10);
c('dois_treinos_no_mesmo_dia_ordem_inversa', { sessoes: [sessao(dia(1), 'COMPLETA'), sessao(dia(1), 'PARCIAL')] }, 10);
c('dois_completos_no_mesmo_dia', { sessoes: [sessao(dia(1), 'COMPLETA'), sessao(dia(1), 'COMPLETA')] }, 10);
c('reabrir_tira_o_xp', { sessoes: [sessao(dia(1), 'COMPLETA', false)] }, 0);
c('reabrir_a_completa_e_sobra_a_parcial', { sessoes: [sessao(dia(1), 'COMPLETA', false), sessao(dia(1), 'PARCIAL')] }, 5);

c('semana_completa', { semanas: [semana('2026-10-05', 3, 3)] }, 20);
c('semana_completa_com_treino_a_mais', { semanas: [semana('2026-10-05', 4, 3)] }, 20);
c('semana_incompleta', { semanas: [semana('2026-10-05', 2, 3)] }, 0);
c('semana_sem_dia_fixo_nao_comemora', { semanas: [semana('2026-10-05', 0, 0)] }, 0);
c('semana_repetida_conta_uma_vez', { semanas: [semana('2026-10-05', 3, 3), semana('2026-10-05', 3, 3)] }, 20);
c('duas_semanas', { semanas: [semana('2026-10-05', 3, 3), semana('2026-10-12', 1, 1), semana('2026-10-19', 0, 2)] }, 40);

c('recorde', { recordes: [{ data: dia(1), exercicioId: 'ex-1' }] }, 15);
c('recorde_repetido_no_mesmo_exercicio_e_dia', { recordes: [{ data: dia(1), exercicioId: 'ex-1' }, { data: dia(1), exercicioId: 'ex-1' }] }, 15);
c('recordes_de_exercicios_e_dias_diferentes',
  { recordes: [{ data: dia(1), exercicioId: 'ex-1' }, { data: dia(1), exercicioId: 'ex-2' }, { data: dia(2), exercicioId: 'ex-1' }] }, 45);

c('conquista', { conquistas: ['PRIMEIRO_TREINO'] }, 50);
c('conquista_repetida_conta_uma_vez', { conquistas: ['PRIMEIRO_TREINO', 'PRIMEIRO_TREINO'] }, 50);
c('duas_conquistas_fecham_o_nivel_2', { conquistas: ['PRIMEIRO_TREINO', 'SEMANA_COMPLETA'] }, 100);

// Bordas da barra: 95 (falta 5), 100 (sobe) e 105. 99 e 101 não existem em somas de 5 (ver `niveis`).
c('borda_95_xp_nivel_1', { sessoes: [...dias(1, 9, 'COMPLETA'), sessao(dia(10), 'PARCIAL')] }, 95);
c('borda_100_xp_sobe_para_o_nivel_2', { sessoes: dias(1, 10, 'COMPLETA') }, 100);
c('borda_105_xp_nivel_2', { sessoes: [...dias(1, 10, 'COMPLETA'), sessao(dia(11), 'PARCIAL')] }, 105);

// 3 completos (30) + 1 parcial (5) + semana (20) + 2 conquistas (100) + 2 recordes (30) = 185.
c('tudo_junto', {
  sessoes: [...dias(1, 3, 'COMPLETA'), sessao(dia(4), 'PARCIAL'), sessao(dia(5), 'COMPLETA', false)],
  semanas: [semana('2026-09-28', 3, 3), semana('2026-10-05', 1, 2)],
  conquistas: ['PRIMEIRO_TREINO', 'SEMANA_COMPLETA'],
  recordes: [{ data: dia(2), exercicioId: 'ex-1' }, { data: dia(3), exercicioId: 'ex-1' }],
}, 185);

// nivel(xp) isolado, nas bordas (inclusive 99 e 101, que a soma dos eventos não alcança) e com negativo.
const niveis = [[-1, 1], [0, 1], [99, 1], [100, 2], [101, 2], [199, 2], [200, 3], [1000, 11]].map(([xp, nivel]) => ({ xp, nivel }));

writeFileSync(`${SAIDA}/casos.json`, JSON.stringify({ constantes, niveis, casos }, null, 1) + '\n');
console.log(`${casos.length} casos de XP`);
