import { expect, test, type Page } from '@playwright/test';

import type { Carga, RegistroEnvio, Sessao } from '../src/api/tipos';
import { PALETA_DE_IDENTIFICACAO, type ChaveDeIdentificacao } from '../src/tema/tokens';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, simularApi } from './api-falsa';

/**
 * Frente G, passo 4 (docs/planos/cores-por-tipo-de-serie.md): na execução do aluno cada série tem a barra lateral de 6 px
 * e o selo com a cor do tipo (D9, D10; o nome continua, D7), o Cluster é UM cartão com os blocos dentro, a pausa entre
 * eles, o bloco da vez com "agora" e "Feito até agora" no rodapé (D12), e o peso das etapas nasce vazio, com o painel
 * "Fez com X kg?" uma vez por série (D17). Só dados fictícios.
 */

const TRABALHO: Carga = { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null };
const SEM_TECNICA = { pausaSegundos: null, pausaRespiracoes: null, pausas: null, blocos: null, quedas: null, reducaoPercentual: null, repsPorQueda: null };

/** Aquecimento, FS, WS com Cluster 4+4+2 (15 s de pausa) e Back off: os quatro tipos padrão, cada um com a sua cor. */
function sessaoColorida(): Sessao[] {
  const sessao = sessaoFalsa('cores', 'Treino das cores', 1, 1);
  const base = { repsMin: 6, repsMax: 8, descansoSegundos: null, esforco: null, tecnica: null };
  sessao.exercicios[0] = { ...sessao.exercicios[0], uid: 'supino', nome: 'Supino de teste', series: [
    { ...base, uid: 'aq', tipo: 'WARM_UP', repsMin: 10, repsMax: 15, carga: null },
    { ...base, uid: 'fs', tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: { modo: 'PERCENTUAL_WS', percentualMin: 70, percentualMax: 70, referenciaUid: null } },
    { ...base, uid: 'cluster', tipo: 'WORKING', repsMin: 10, repsMax: 10, carga: TRABALHO, tecnica: { ...SEM_TECNICA, tipo: 'CLUSTER', blocos: [4, 4, 2], pausaSegundos: 15 } },
    { ...base, uid: 'back', tipo: 'BACK_OFF', carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: 85, referenciaUid: null } },
  ] };
  return [sessao];
}

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function barraDe(page: Page, uid: string) {
  return page.getByTestId(`serie-${uid}`).evaluate((el) => {
    const estilo = getComputedStyle(el);
    return { largura: estilo.borderLeftWidth, cor: estilo.borderLeftColor };
  });
}

for (const tema of ['CLARO', 'ESCURO'] as const) {
  for (const largura of [390, 1280]) {
    test(`execução com cor por tipo, Cluster em um cartão e peso das etapas (${largura}px, ${tema.toLowerCase()})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await fixarHoje(page);
      await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema] as const);
      const enviados: RegistroEnvio[] = [];
      const api = await simularApi(page, {
        ...(await sessaoDeAlunoComTreino(page, sessaoColorida())),
        'POST /aluno/execucoes/lote': (p, route) => {
          const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
          enviados.push(...lote);
          return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
        },
      });
      const ultimo = (uid: string) => enviados.filter((r) => r.serieUid === uid).at(-1);
      await page.goto('/aluno/sessao/cores/supino?data=2026-10-19');

      // D9 e D10: barra de 6 px na cor do tipo, no tema em uso; o nome do tipo continua escrito no selo (D7).
      const paleta = PALETA_DE_IDENTIFICACAO[tema === 'ESCURO' ? 'escuro' : 'claro'];
      const esperado: [string, ChaveDeIdentificacao, string][] = [['aq', 'CIANO', 'Aquecimento'], ['fs', 'AZUL', 'FS'], ['cluster', 'INDIGO', 'WS'], ['back', 'MAGENTA', 'Back off']];
      for (const [uid, chave, nome] of esperado) {
        await expect(page.getByTestId(`serie-${uid}`)).toBeVisible();
        expect(await barraDe(page, uid)).toEqual({ largura: '6px', cor: rgb(paleta[chave]) });
        await expect(page.getByTestId(`serie-${uid}`).getByRole('button', { name: new RegExp(`^Explicação de ${nome}, série`) })).toBeVisible();
      }

      // D12: o Cluster é um cartão só, com os três blocos dentro, a pausa entre eles e o rodapé.
      await page.getByRole('textbox', { name: 'Carga de trabalho do dia', exact: true }).fill('40');
      const cartao = page.getByTestId('serie-cluster');
      const blocos = cartao.getByRole('group', { name: 'Blocos do Cluster, série 3' });
      await expect(blocos).toBeVisible();
      await expect(blocos.getByText('Pausa entre blocos: 15 s', { exact: true })).toHaveCount(2);
      await expect(blocos.getByText('Meta 4 reps · agora', { exact: true })).toHaveCount(1);
      await expect(cartao.getByText('Feito até agora: 0 de 10 reps', { exact: true })).toBeVisible();
      await expect(cartao.getByText('Faltam 3 blocos para concluir.', { exact: true })).toBeVisible();
      await expect(cartao.getByRole('button', { name: 'Concluir a série 3', exact: true })).toBeDisabled();

      // D17: o peso nasce vazio, com "Sugestão: 40 kg" ao lado do bloco da vez.
      const peso = (n: number) => cartao.getByRole('textbox', { name: `Peso, bloco ${n} da série 3, em quilos`, exact: true });
      const reps = (n: number) => cartao.getByRole('textbox', { name: `Repetições feitas, bloco ${n} da série 3`, exact: true });
      const marcar = (n: number) => cartao.getByRole('checkbox', { name: `Bloco ${n} feito, série 3`, exact: true });
      for (const n of [1, 2, 3]) await expect(peso(n)).toHaveValue('');
      await expect(cartao.getByLabel(/^Dica do bloco 1 da série 3: Sugestão: 40 kg/)).toBeVisible();

      // Primeiro ✓ com o peso vazio: o painel pergunta na tela; "Sim" grava 40 kg e preenche os blocos vazios.
      await reps(1).fill('4');
      await marcar(1).click();
      await expect(cartao.getByText('Fez com 40 kg?', { exact: true })).toBeVisible();
      await cartao.screenshot({ path: testInfo.outputPath(`painel-etapa-${largura}-${tema}.png`) });
      await cartao.getByRole('button', { name: 'Sim, 40 kg, série 3', exact: true }).click();
      await expect(marcar(1)).toBeChecked();
      await expect(peso(2)).toHaveValue('40');
      await expect(peso(3)).toHaveValue('40');
      await expect(blocos.getByText('Meta 4 reps · agora', { exact: true })).toHaveCount(1);
      await expect(cartao.getByText('Feito até agora: 4 de 10 reps', { exact: true })).toBeVisible();
      await expect.poll(() => ultimo('cluster')?.etapas?.[0]?.carga).toBe(40);

      // Peso diferente digitado no bloco 3 não é sobrescrito; o segundo ✓ (bloco 2) não abre o painel de novo.
      await peso(3).fill('42');
      await reps(2).fill('4');
      await marcar(2).click();
      await expect(marcar(2)).toBeChecked();
      await expect(cartao.getByText(/^Fez com/)).toHaveCount(0);
      await expect(peso(3)).toHaveValue('42');
      await reps(3).fill('2');
      await marcar(3).click();
      await expect(cartao.getByText(/^Fez com/)).toHaveCount(0);
      await cartao.getByRole('button', { name: 'Concluir a série 3', exact: true }).click();
      await expect(cartao.getByText('Feito: 10 de 10 reps', { exact: true })).toBeVisible();
      await expect(cartao.getByText('Série concluída.', { exact: true })).toBeVisible();
      await expect.poll(() => ultimo('cluster')?.concluida).toBe(true);
      expect(ultimo('cluster')?.etapas?.map((e) => e.carga)).toEqual([40, 40, 42]);

      // Reabrir não reabre o painel: as etapas continuam feitas.
      await cartao.getByRole('button', { name: 'Reabrir a série 3', exact: true }).click();
      await marcar(3).click();
      await expect(marcar(3)).not.toBeChecked();
      await expect(peso(3)).toHaveValue('42');
      await marcar(3).click();
      await expect(marcar(3)).toBeChecked();
      await expect(cartao.getByText(/^Fez com/)).toHaveCount(0);
      await cartao.screenshot({ path: testInfo.outputPath(`cluster-${largura}-${tema}.png`) });

      expect(api.errosDaPagina).toEqual([]);
      expect(api.naoTratadas).toEqual([]);
    });
  }
}
