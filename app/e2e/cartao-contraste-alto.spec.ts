import { expect, test, type Page } from '@playwright/test';

import type { AlunoResumo } from '../src/api/tipos';
import { CLARO, ESCURO } from '../src/tema/tokens';
import { json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, PERMISSOES_FINANCEIRO, rotasDoFinanceiro } from './financeiro-falso';

/**
 * Contorno do `Cartao` no contraste alto (`docs/planos/filtros-laterais.md`, unidade 7C): com "Contraste alto" ligado o
 * contorno do cartão chega a 3:1 contra a página e contra o próprio fundo (vira `bordaCampo`), e a linha interna da
 * faixa do título continua `divisor` (as divisórias não engrossam). No contraste padrão nada muda. Três telas (Alunos,
 * Financeiro › Cobranças, Ajustes), claro e escuro, 1280 e 390 px. Só dados fictícios, API simulada; capturas em
 * `E2E_CAPTURAS` (ou na pasta do teste).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;

type Modo = { tema: 'CLARO' | 'ESCURO'; contraste: 'PADRAO' | 'ALTO' };
const MODOS: Modo[] = [
  { tema: 'CLARO', contraste: 'PADRAO' },
  { tema: 'ESCURO', contraste: 'PADRAO' },
  { tema: 'CLARO', contraste: 'ALTO' },
  { tema: 'ESCURO', contraste: 'ALTO' },
];
const nome = (m: Modo) => `${m.tema.toLowerCase()}${m.contraste === 'ALTO' ? '-alto' : ''}`;

const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
const ALUNOS: AlunoResumo[] = ['Ana Fictícia', 'Bruno Exemplo'].map((n, i) => ({
  id: `a0000000-0000-4000-8000-00000000000${i + 1}`, nome: n, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: ontem,
  responsavelId: TREINADOR.id, atualizacao: null,
}));

async function preparar(page: Page, largura: number, modo: Modo) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  await fixarHoje(page);
  await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, p), [TREINADOR.id, JSON.stringify(modo)] as const);
}

const TELAS: Record<string, (page: Page) => Promise<{ errosDaPagina: string[] }>> = {
  alunos: async (page) => {
    const api = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alunos': { corpo: { itens: ALUNOS, total: ALUNOS.length } },
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    });
    await page.goto('/treinador/alunos');
    await expect(page.getByText('Ana Fictícia').first()).toBeVisible();
    return api;
  },
  cobrancas: async (page) => {
    const base = await sessao(page, TREINADOR, { marca: MARCA, pagamentosHabilitados: true, recebimentoOnlineHabilitado: false, permissoes: [...PERMISSOES_TREINADOR, ...PERMISSOES_FINANCEIRO] });
    const login = base['POST /auth/refresh'] as { corpo: object };
    const api = await simularApi(page, {
      ...base,
      'POST /auth/refresh': (_p, route) => json(route, { ...login.corpo, marca: MARCA }),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      ...rotasDoFinanceiro(estadoFinanceiro({ cobrancas: [{ ...COBRANCA_ATRASADA, alunoNome: 'Bruna Teste' }] })),
    });
    await page.goto('/treinador/financeiro?aba=cobrancas');
    await expect(page.getByText('Bruna Teste').first()).toBeVisible();
    return api;
  },
  ajustes: async (page) => {
    const api = await simularApi(page, { ...(await sessao(page, TREINADOR)), 'GET /inscricoes': { corpo: { itens: [], total: 0 } } });
    await page.goto('/treinador/ajustes');
    await expect(page.getByRole('radiogroup', { name: 'Contraste' })).toBeVisible();
    return api;
  },
};

interface Medida { contorno: string; fundoDoCartao: string; pagina: string; contraPagina: number; contraCartao: number; faixa: string | null; linhas: string[] }

const rgbDe = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

/**
 * Cada `Cartao` (`testID="cartao"`) com a cor do contorno, o contraste dela com a página atrás e com o
 * próprio fundo (WCAG 1.4.11), a cor da linha de baixo da faixa do título, quando há faixa, e as cores das divisórias de
 * dentro (elementos com linha só em cima ou só embaixo: faixa, linhas de lista e de tabela).
 */
function medirCartoes(page: Page): Promise<Medida[]> {
  return page.evaluate(() => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const opaco = (c: string) => { const v = rgb(c); return v.length === 3 || (v.length === 4 && v[3] === 1); };
    const luz = ([r, g, b]: number[]) => {
      const canal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };
    const razao = (a: string, b: string) => { const [x, y] = [luz(rgb(a)), luz(rgb(b))].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
    const medidas: Medida[] = [];
    for (const e of document.querySelectorAll<HTMLElement>('[data-testid="cartao"]')) {
      const s = getComputedStyle(e);
      let pagina = 'rgb(255, 255, 255)';
      for (let no = e.parentElement; no; no = no.parentElement) {
        const f = getComputedStyle(no).backgroundColor;
        if (opaco(f)) { pagina = f; break; }
      }
      const faixa = [...e.children].find((f) => parseFloat(getComputedStyle(f).borderBottomWidth) >= 1 && getComputedStyle(f).borderBottomStyle === 'solid');
      medidas.push({
        contorno: s.borderTopColor, fundoDoCartao: s.backgroundColor, pagina,
        contraPagina: razao(s.borderTopColor, pagina), contraCartao: razao(s.borderTopColor, s.backgroundColor),
        faixa: faixa ? getComputedStyle(faixa).borderBottomColor : null,
        linhas: [...new Set([...e.querySelectorAll<HTMLElement>('div')].flatMap((d) => {
          const c = getComputedStyle(d);
          if (parseFloat(c.borderLeftWidth) > 0 || parseFloat(c.borderRightWidth) > 0) return [];
          return [['Top', c.borderTopWidth, c.borderTopColor], ['Bottom', c.borderBottomWidth, c.borderBottomColor]].filter(([, w]) => parseFloat(w) >= 1).map(([, , cor]) => cor);
        }))],
      });
    }
    return medidas;
  });
}

for (const [tela, abrir] of Object.entries(TELAS)) for (const largura of [1280, 390]) for (const modo of MODOS) {
  test(`${tela} ${largura}px ${nome(modo)}: contorno do cartão e linha da faixa`, async ({ page }) => {
    await preparar(page, largura, modo);
    const { errosDaPagina } = await abrir(page);
    const medidas = await medirCartoes(page);
    expect(medidas.length).toBeGreaterThan(0);
    const distintas = [...new Set(medidas.map((m) => JSON.stringify(m)))];
    console.log(`MEDIDA ${tela} ${largura} ${nome(modo)} ${medidas.length} cartões: ${distintas.join(' | ')}`);
    await page.screenshot({ path: CAPTURAS ? `${CAPTURAS}/c-${tela}-${nome(modo)}-${largura}.png` : test.info().outputPath(`${tela}.png`) });
    // Padrão: contorno e faixa no `divisor`, como antes. Contraste alto: só o contorno vai a `bordaCampo`; a faixa e as
    // divisórias de dentro ficam na `borda` original (o `divisor` do contraste alto), sem engrossar. A linha do cabeçalho
    // da `Tabela` (Cobranças, PC) já é `bordaCampo` nos dois e não muda.
    const base = modo.tema === 'CLARO' ? CLARO : ESCURO;
    const contorno = rgbDe(modo.contraste === 'ALTO' ? base.bordaCampo : base.divisor);
    const divisoria = rgbDe(modo.contraste === 'ALTO' ? base.borda : base.divisor);
    for (const m of medidas) {
      expect(m.contorno).toBe(contorno);
      if (m.faixa) expect(m.faixa).toBe(divisoria);
      for (const linha of m.linhas) expect([divisoria, rgbDe(base.bordaCampo)]).toContain(linha);
      if (modo.contraste === 'ALTO') {
        expect(m.contraPagina).toBeGreaterThanOrEqual(3);
        expect(m.contraCartao).toBeGreaterThanOrEqual(3);
      }
    }
    expect(errosDaPagina).toEqual([]);
  });
}
