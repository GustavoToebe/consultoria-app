import { expect, test, type Page } from '@playwright/test';

import type { Carga, DiaDeTreino, PainelAluno, RegistroEnvio, Serie, UltimaCarga } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa, fazerSerie } from './aluno';
import { json, simularApi } from './api-falsa';

/**
 * Retestes da execução (passo 4 de `docs/planos/execucao-referencia-e-progressao.md`, D4, D8, D9 e D10, 03/11):
 * C30 (o Back off só recalcula depois do ✓ da WS, regra de 31/10, com o aviso na própria série), C33 (digitar a carga na web
 * e o "0 kg" no aquecimento), C26 (a carga do período anterior aparece no período novo) e a tabela "Por divisão" do
 * histórico ("Feito, sem carga" é a única exceção ao "—"). Exercícios e números fictícios; relógio em segunda, 19/10/2026.
 */
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';

const NENHUMA: Carga = { modo: 'NENHUMA', percentualMin: null, percentualMax: null };
const DE_TRABALHO: Carga = { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null };
const aquecimento: Serie = { uid: 'aq1', tipo: 'WARM_UP', repsMin: 12, repsMax: 15, carga: NENHUMA, esforco: null, descansoSegundos: null };
const ws: Serie = { uid: 'ws1', tipo: 'WORKING', repsMin: 6, repsMax: 8, carga: DE_TRABALHO, esforco: null, descansoSegundos: null };
const backOff: Serie = { uid: 'bo1', tipo: 'BACK_OFF', repsMin: 8, repsMax: 10, carga: { modo: 'PERCENTUAL_WS', percentualMin: 80, percentualMax: 80 }, esforco: null, descansoSegundos: null };

/** Histórico do servidor montado com o que o app enviou (o servidor guarda o que chega). */
function historicoDe(enviados: RegistroEnvio[]): DiaDeTreino[] {
  const ultimos = new Map<string, RegistroEnvio>();
  for (const r of enviados) ultimos.set(r.serieUid, r);
  const series = [...ultimos.values()].filter((r) => r.concluida);
  if (!series.length) return [];
  return [{
    data: '2026-10-19',
    sessoes: [{
      sessaoUid: 'sx', sessao: 'Treino curto', planoVersaoId: 't0000000-0000-4000-8000-000000000002',
      exercicios: [{
        exercicioUid: 'sxe1', exercicioId: 'x1', nome: 'Supino de teste',
        series: series.map((r) => ({
          id: r.id, serieUid: r.serieUid, tipo: r.serieUid.startsWith('aq') ? 'Aquecimento' : 'WS', trabalho: !r.serieUid.startsWith('aq'),
          carga: r.carga, unidade: 'kg', repeticoes: r.repeticoes, concluida: r.concluida, observacao: null,
        })),
      }],
    }],
  }];
}

async function abrir(page: Page, series: Serie[], ultimasCargas: Record<string, UltimaCarga> = {}, outrosExercicios = 0) {
  await fixarHoje(page);
  const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, 1 + outrosExercicios)];
  sessoes[0]!.exercicios[0] = { ...sessoes[0]!.exercicios[0]!, exercicioId: 'x1', nome: 'Supino de teste', series };
  for (let i = 1; i <= outrosExercicios; i++) sessoes[0]!.exercicios[i] = { ...sessoes[0]!.exercicios[i]!, exercicioId: `x${i + 1}`, nome: `Remada de teste ${i}` };
  const base = await sessaoDeAlunoComTreino(page, sessoes);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const enviados: RegistroEnvio[] = [];
  const api = await simularApi(page, {
    ...base,
    'GET /aluno/painel': { corpo: { ...painel, ultimasCargas } },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      enviados.push(...lote);
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
    'GET /aluno/execucoes': (_p, route) => json(route, historicoDe(enviados)),
    'GET /aluno/pesos': { corpo: [] },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/atualizacoes': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: [] },
  });
  return { ...api, enviados };
}

const peso = (page: Page, n: number) => page.getByRole('textbox', { name: `Carga da série ${n}, em quilos`, exact: true });
const reps = (page: Page, n: number) => page.getByRole('textbox', { name: `Repetições da série ${n}`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: new RegExp(`^Marcar série ${n} como feita`) });
const AVISO_DO_MARCAR = 'As séries seguintes só usam este peso depois que você marcar a série como feita.';

test('C30: o Back off só recalcula depois do ✓ da WS (regra de 31/10), e a própria série avisa', async ({ page }) => {
  const api = await abrir(page, [ws, backOff]);
  await page.goto(EXERCICIO);
  await page.getByRole('textbox', { name: 'Carga de trabalho de hoje, em quilos', exact: true }).fill('40');
  await expect(peso(page, 2)).toHaveAttribute('placeholder', '32');
  // O aviso só aparece com carga digitada na WS e sem o ✓ (25/11).
  await expect(page.getByText(AVISO_DO_MARCAR, { exact: true })).toHaveCount(0);

  // Carga digitada sem o ✓ não conta: o Back off segue partindo da base do dia, e o aviso aparece na WS.
  await peso(page, 1).fill('50');
  await expect(page.getByText(AVISO_DO_MARCAR, { exact: true })).toHaveCount(1);
  await expect(peso(page, 2)).toHaveAttribute('placeholder', '32');
  await expect(peso(page, 2)).toHaveValue('');

  // Com o ✓ a WS passa a valer: 80% de 50 kg.
  await reps(page, 1).fill('6');
  await fazerSerie(page, 1);
  await expect(marcar(page, 1)).toBeChecked();
  await expect(peso(page, 2)).toHaveAttribute('placeholder', '40');
  await expect(page.getByText(AVISO_DO_MARCAR, { exact: true })).toHaveCount(0);
  await expect(peso(page, 2)).toHaveValue(''); // a sugestão nunca vai para o campo
  await expect.poll(() => api.enviados.find((r) => r.serieUid === 'ws1')?.carga).toBe(50);

  // Desmarcar a WS tira a carga da conta de novo.
  await fazerSerie(page, 1);
  await expect(marcar(page, 1)).not.toBeChecked();
  await expect(peso(page, 2)).toHaveAttribute('placeholder', '32');
  expect(api.errosDaPagina).toEqual([]);
});

test('C33: digitar a carga na web grava o que foi digitado, e o aquecimento sem carga nunca mostra "0 kg"', async ({ page }) => {
  const api = await abrir(page, [aquecimento, ws]);
  await page.goto(EXERCICIO);
  // Aquecimento sem carga prescrita: o campo nasce vazio, sem "0 kg", e o ✓ espera o kg (25/11: o ✓ exige kg e reps).
  await expect(marcar(page, 1)).toBeDisabled();
  await expect(peso(page, 1)).toHaveValue('');
  await expect(peso(page, 1)).toHaveAttribute('placeholder', '—');
  await expect(page.getByText('Digite a carga para marcar a série.', { exact: true })).toBeVisible();
  await expect(page.getByText(/(^|\s)0 kg/)).toHaveCount(0);
  expect(api.enviados.filter((r) => r.serieUid === 'aq1')).toEqual([]);

  // Tecla a tecla numa série já registrada: o campo mostra o que foi digitado e o servidor recebe o número inteiro (52, não 252 nem 5).
  await reps(page, 2).fill('6');
  await peso(page, 2).fill('');
  await peso(page, 2).pressSequentially('52', { delay: 40 });
  await expect(peso(page, 2)).toHaveValue('52');
  await fazerSerie(page, 2);
  await expect(marcar(page, 2)).toBeChecked();
  await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').at(-1)).toMatchObject({ carga: 52, repeticoes: 6, concluida: true });
  // A série feita mostra o resumo; "Editar" reabre os campos.
  await page.getByRole('button', { name: 'Editar série 2', exact: true }).click();
  await peso(page, 2).fill('');
  await peso(page, 2).pressSequentially('5', { delay: 40 });
  await peso(page, 2).pressSequentially('5', { delay: 40 });
  await expect(peso(page, 2)).toHaveValue('55');
  await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').at(-1)).toMatchObject({ carga: 55, concluida: true });
  // Apagar o campo grava carga vazia, não 0.
  await peso(page, 2).fill('');
  await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').at(-1)).toMatchObject({ carga: null });
  await expect(page.getByText(/(^|\s)0 kg/)).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

test('C26: a carga do período anterior aparece no período novo (sem registro neste período), só como dica', async ({ page }) => {
  // O plano começa em 05/10; a última carga do exercício x1 é de 28/09 (período anterior). O x2 nunca teve carga.
  await abrir(page, [ws], { x1: { carga: 60, repeticoes: 7, data: '2026-09-28' } }, 1);
  await page.goto(EXERCICIO);
  await expect(page.getByText('Último registro: 60 kg × 7 em 28/09', { exact: true })).toBeVisible();
  await expect(peso(page, 1)).toHaveAttribute('placeholder', '60');
  await expect(reps(page, 1)).toHaveAttribute('placeholder', '8');
  await expect(peso(page, 1)).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Carga de trabalho de hoje, em quilos', exact: true })).toHaveValue('');

  await page.goto('/aluno/sessao/sx/sxe2?data=2026-10-19');
  await expect(page.getByText('Sem registro anterior', { exact: true })).toBeVisible();
  await expect(peso(page, 1)).toHaveAttribute('placeholder', '—');
});

// O "Feito, sem carga" do histórico não nasce mais desta tela (o ✓ exige o kg desde 25/11); o texto segue em `dominio/relatorio.test.ts`.
