import { writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import type { IndicadoresInscricoes } from '../src/api/inscricoesTipos';
import type { Alimento, AtualizacaoDaLista, ConteudoDieta, ItemDieta, PainelTreinador, PlanoDetalhe, Receita, RecordesDaSemana, Tema } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { fixarHoje } from './aluno';
import { json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { COBRANCA_ATRASADA, estadoFinanceiro, PAINEL_COM_DADOS, PERMISSOES_FINANCEIRO, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';
import { TELAS_NOVAS, type Tela } from './capturas-telas';
import { resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Prancha das telas nos temas: Claro, Areia e Escuro (verificação final de `docs/planos/hierarquia-visual-tres-temas.md`)
 * e Céu e Rosa em 390 e 1280, Lavanda em 390 (D10 de `docs/planos/cores-de-destaque.md`). As sete primeiras telas moram
 * aqui; as que vieram com a hierarquia visual, em `capturas-telas.ts`. Só roda com `CAPTURAS_PALETAS=<pasta>`: grava
 * `<tela>-<paleta>-<largura>-<tema>.png` e, ao lado, um `.json` com a rolagem horizontal, os textos abaixo de 4,5:1 (3:1 no
 * texto grande) contra o fundo composto dos ancestrais e o que a API simulada não tratou. Só dados fictícios.
 */
const PASTA = process.env.CAPTURAS_PALETAS;
test.use({ contextOptions: { reducedMotion: 'reduce' } });

interface Paleta { nome: string; tema: 'claro' | 'escuro'; marca?: Tema; preferencia?: Tema }
const CLARO: Paleta = { nome: 'claro', tema: 'claro', preferencia: 'CLARO' };
const CEU: Paleta = { nome: 'ceu', tema: 'claro', marca: 'CEU' };
const ROSA: Paleta = { nome: 'rosa', tema: 'claro', marca: 'ROSA' };
const AREIA: Paleta = { nome: 'areia', tema: 'claro', preferencia: 'AREIA' };
const LAVANDA: Paleta = { nome: 'lavanda', tema: 'claro', marca: 'LAVANDA' };
const ESCURO: Paleta = { nome: 'escuro', tema: 'escuro', preferencia: 'ESCURO' };
const MATRIZ: [Paleta, number][] = [
  ...[CLARO, AREIA, ESCURO, CEU, ROSA].flatMap((p) => [[p, 390], [p, 1280]] as [Paleta, number][]),
  [LAVANDA, 390],
];

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Início: os mesmos números do painel.spec (pendências, interessados, agenda, financeiro, recordes).
const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 3, atualizacoesAtrasadas: 2, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 5, alunosAtivos: 24,
  alunosSemRegistro: [{ id: id(100), nome: 'Aluno Fictício 1', ultimoRegistro: null }], ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 4, pastasParaRenovar: [{ pasta: { id: 'p0000000-0000-4000-8000-000000000200', titulo: 'Ciclo 1' }, aluno: { id: id(200), nome: 'Aluna Fictícia 1' }, fim: '2026-10-23' }],
  alunosSemPastaComPeriodo: 2, alunosSemRegistroTotal: 7, alunosSemAcesso: 3, alunosInativos: 3, sessoesConcluidas7Dias: 18,
};
const RECORDES: RecordesDaSemana = {
  de: '2026-10-13', ate: '2026-10-19', total: 2,
  series: [{ alunoId: id(300), alunoNome: 'Atleta Fictício', data: '2026-10-18', exercicioId: 'x1', exercicioNome: 'Supino de teste', recordes: [{ tipo: 'MAIOR_CARGA', carga: 70, repeticoes: 8, valor: 70 }] }],
};

const atualizacao = (n: number, nome: string, fase: AtualizacaoDaLista['fase'], data: string, diasParaData: number, diasDeAtraso: number): AtualizacaoDaLista =>
  ({ id: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, pastaId: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, alunoId: id(n), nomeAluno: nome, dataAtualizacao: data, fase, diasParaData, diasDeAtraso, atrasoAte: null });
const ATUALIZACOES = [
  atualizacao(1, 'Ana Fictícia', 'ENVIADA', '2026-10-18', -1, 0),
  atualizacao(2, 'Maria Aparecida dos Santos Oliveira Fictícia de Teste', 'ENVIADA', '2026-10-12', -7, 0),
  atualizacao(3, 'Bruno Exemplo', 'ATRASADA', '2026-10-10', -9, 9),
  atualizacao(4, 'Caio Teste', 'REVISADA', '2026-10-05', -14, 0),
];

const INDICADORES: IndicadoresInscricoes = {
  de: '2026-09-30', ate: '2026-10-29', entradas: 12, pessoas: 11, aceites: 3, recusadas: 2, desistencias: 0, reaberturas: 1,
  aceitesDasEntradas: 2, conversao: 2 / 12, diasAteAceite: { mediana: 4, media: 5.5 }, porMotivo: [],
  porOrigem: [{ origem: 'INSTAGRAM', entradas: 8, aceites: 2 }, { origem: 'INDICACAO', entradas: 4, aceites: 1 }],
};

const alimento = (n: string, nome: string, kcal: number, p: number, c: number, g: number): Alimento => ({
  id: n, nome, baseQuantidade: 100, baseUnidade: 'g', kcal, proteina: p, carboidrato: c, gordura: g, gramasPorUnidade: null,
  fonte: null, origem: 'PROPRIO', fatorCorrecao: null, fatorCoccao: null, grupo: null,
});
const ALIMENTOS = [alimento('a1', 'Aveia fictícia', 393, 14, 66.7, 8.5), alimento('a2', 'Azeite fictício', 884, 0, 0, 100), alimento('a3', 'Queijo fictício', 264, 17.4, 3.2, 20.2)];

const PLANO_DIETA = 'p0000000-0000-4000-8000-0000000000a1';
const ALUNO_DIETA = 'a0000000-0000-4000-8000-0000000000a2';
const item = (uid: string, nome: string, unidade: ItemDieta['unidade'], p: number, c: number, g: number): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade, kcal: 4 * p + 4 * c + 9 * g, proteina: p, carboidrato: c, gordura: g, manual: false });
const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_DIETA, alunoId: ALUNO_DIETA, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-10-01', fim: '2026-10-31', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-10-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: {
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [], suplementacao: [], ergogenicos: [],
    refeicoes: [
      { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [
        { uid: 'ca', rotulo: 'A', itens: [item('pao', 'Pão fictício', 'g', 9, 49, 3), item('leite', 'Leite fictício', 'ml', 3, 5, 1)] },
        { uid: 'cb', rotulo: 'B', itens: [item('fruta', 'Fruta fictícia', 'un', 1, 23, 0)] },
      ] },
      { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null, opcoes: [
        { uid: 'aa', rotulo: 'A', itens: [item('arroz', 'Arroz fictício', 'g', 3, 28, 0), item('frango', 'Frango fictício', 'g', 31, 0, 4)] },
      ] },
    ],
  },
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000a4', numero: 1, publicadoEm: '2026-10-01T12:00:00Z' }],
};

const METODOLOGIA_ID = 'm0000000-0000-4000-8000-000000000010';
const METODOLOGIA: Receita = { id: METODOLOGIA_ID, tipo: 'METODOLOGIA', nome: 'Metodologia fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: CONFIGURACAO_PADRAO };

const TELAS: Tela[] = [
  {
    nome: 'inicio', caminho: '/treinador',
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR, {
        permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'REGISTRO_LER', 'TREINO_LER', 'AGENDA_LER', 'FINANCEIRO_LER', 'MODELO_ALTERAR'],
        pagamentosHabilitados: true, retornoHabilitado: true,
      })),
      'GET /painel': { corpo: PAINEL },
      'GET /inscricoes/contagens': { corpo: { porSituacao: { NOVA: 4, EM_CONTATO: 4, EM_NEGOCIACAO: 2 }, abertas: 10, todas: 10, retornosAtrasados: 1, retornosHoje: 1 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /recordes/semana': { corpo: RECORDES },
      'GET /agenda/resumo': { corpo: { dias: [{ data: '2026-10-19', compromissos: 4, eventos: 1 }, { data: '2026-10-21', compromissos: 5, eventos: 0 }] } },
      'GET /financeiro/painel': { corpo: PAINEL_COM_DADOS },
      'GET /financeiro/inadimplentes': { corpo: { itens: [], total: 4, valorTotalCentavos: 124_000, pagina: 0 } },
      'GET /inscricoes/configuracao': { corpo: { aberta: false, codigo: null, link: null, responsavelId: null, texto: null, versao: null } },
    }),
    pronto: async (page) => {
      await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Atualizações atrasadas: 2' })).toBeVisible();
    },
  },
  {
    nome: 'atualizacoes', caminho: '/treinador/atualizacoes?situacao=PARA_REVISAR',
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /painel': { corpo: { ...PAINEL } },
      'GET /responsaveis': { corpo: [] },
      'GET /atualizacoes/pagina': { corpo: { itens: ATUALIZACOES, total: ATUALIZACOES.length } },
      'GET /atualizacoes/contagens': { corpo: { PARA_REVISAR: 2, ATRASADAS: 1, AVISARAM_ATRASO: 0, PROXIMAS: 5 } },
    }),
    pronto: async (page) => { await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toBeVisible(); },
  },
  {
    nome: 'interessados', caminho: '/treinador/interessados?visao=indicadores',
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR)),
      ...rotasDaTela(),
      'GET /inscricoes': { corpo: { itens: [resumoFalso(1), resumoFalso(2)], total: 2 } },
      'GET /inscricoes/indicadores': { corpo: INDICADORES },
    }),
    pronto: async (page) => { await expect(page.getByText('Dias até o aceite (mediana)')).toBeVisible(); },
  },
  {
    nome: 'financeiro', caminho: '/treinador/financeiro',
    rotas: async (page) => ({
      ...(await sessaoComFinanceiro(page, PERMISSOES_FINANCEIRO, false)),
      ...rotasDoFinanceiro(estadoFinanceiro({ painel: PAINEL_COM_DADOS, cobrancas: [{ ...COBRANCA_ATRASADA }] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    }),
    pronto: async (page) => { await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible(); await expect(page.getByText('A receber').first()).toBeVisible(); },
  },
  {
    nome: 'biblioteca', caminho: '/treinador/biblioteca?aba=alimentos',
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: ALIMENTOS },
    }),
    pronto: async (page) => { await expect(page.getByRole('button', { name: 'Editar Aveia fictícia' })).toBeVisible(); },
  },
  {
    nome: 'dieta', caminho: `/treinador/dietas/${PLANO_DIETA}`,
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_DIETA}`]: { corpo: { id: ALUNO_DIETA, nome: 'Aluna Fictícia' } },
      [`GET /planos-dieta/${PLANO_DIETA}`]: { corpo: DIETA },
    }),
    pronto: async (page) => { await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible(); },
  },
  {
    nome: 'metodologia', caminho: `/treinador/planejamento/modelo/${METODOLOGIA_ID}`,
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /pastas-modelos': { corpo: [] },
      'GET /exercicios': { corpo: [] },
      'GET /receitas': (_p, route) => json(route, [METODOLOGIA]),
      [`GET /receitas/${METODOLOGIA_ID}`]: { corpo: METODOLOGIA },
    }),
    pronto: async (page) => { await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible(); },
  },
  ...TELAS_NOVAS,
];

/** Troca a marca do login e do `/eu` pela da paleta (o tema "Da consultoria" do treinador segue o `temaPadrao`). */
function comMarca(rotas: RespostasApi, tema: Tema): RespostasApi {
  const marca = { ...MARCA, temaPadrao: tema };
  for (const chave of ['POST /auth/refresh', 'GET /eu']) {
    const r = rotas[chave] as { corpo: object };
    rotas[chave] = { corpo: { ...r.corpo, marca } };
  }
  return rotas;
}

/** Textos visíveis abaixo do mínimo contra o fundo composto dos ancestrais (aproximação: ignora sobreposição absoluta e SVG). */
function textosAbaixoDoMinimo() {
  type C = { r: number; g: number; b: number; a: number };
  const ler = (s: string): C | null => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const sobre = (t: C, f: C): C => ({ r: t.r * t.a + f.r * (1 - t.a), g: t.g * t.a + f.g * (1 - t.a), b: t.b * t.a + f.b * (1 - t.a), a: 1 });
  const lum = (c: C) => {
    const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const fundoDe = (el: Element): C => {
    const camadas: C[] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = ler(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; }
    }
    return camadas.reduceRight<C>((base, c) => sobre(c, base), { r: 255, g: 255, b: 255, a: 1 });
  };
  const hex = (c: C) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const falhas: { texto: string; razao: number; cor: string; fundo: string; minimo: number; desabilitado: boolean }[] = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg')) continue;
    const proprio = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
    if (!proprio) continue;
    const r = el.getBoundingClientRect();
    const est = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || est.visibility === 'hidden' || Number(est.opacity) === 0) continue;
    const corBruta = ler(est.color);
    if (!corBruta) continue;
    const fundo = fundoDe(el);
    const cor = corBruta.a < 1 ? sobre(corBruta, fundo) : corBruta;
    const [a, b] = [lum(cor), lum(fundo)].sort((x, y) => y - x);
    const razao = (a + 0.05) / (b + 0.05);
    const px = parseFloat(est.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(est.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (razao < minimo) {
      falhas.push({ texto: proprio.slice(0, 50), razao: Math.round(razao * 100) / 100, cor: hex(cor), fundo: hex(fundo), minimo, desabilitado: !!el.closest('[aria-disabled="true"],[disabled]') });
    }
  }
  return falhas;
}

for (const tela of TELAS) for (const [paleta, largura] of MATRIZ) {
  const nome = `${tela.nome}-${paleta.nome}-${largura}-${paleta.tema}`;
  test(`captura ${nome}`, async ({ page }) => {
    test.skip(!PASTA, 'sem CAPTURAS_PALETAS');
    await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
    await fixarHoje(page);
    if (paleta.preferencia) {
      await page.addInitScript(([u, t]) => localStorage.setItem(`treinos:${u}:preferencias`, JSON.stringify({ tema: t })), [tela.usuarioId ?? TREINADOR.id, paleta.preferencia] as const);
    }
    const rotas = await tela.rotas(page);
    const api = await simularApi(page, paleta.marca ? comMarca(rotas, paleta.marca) : rotas);
    await page.goto(tela.caminho);
    await tela.pronto(page);
    await page.waitForTimeout(400);
    const rolagemLateral = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const contraste = await page.evaluate(textosAbaixoDoMinimo);
    // A página toda numa imagem: a janela cresce o que ainda rola (na folha aberta, só o dela; barras fixas ficam de fora da
    // rolagem, por isso mede o que sobra e não a altura do conteúdo) e mede de novo até não sobrar rolagem.
    for (let i = 0; i < 4; i++) {
      const altura = await page.evaluate(() => {
        const raiz = [...document.querySelectorAll('[role="dialog"]')].at(-1) ?? document.documentElement;
        const rolaveis = [raiz, ...raiz.querySelectorAll('*')].filter((e) => e === document.documentElement || /(auto|scroll)/.test(getComputedStyle(e).overflowY));
        return window.innerHeight + Math.max(0, ...rolaveis.map((e) => e.scrollHeight - e.clientHeight));
      });
      const atual = page.viewportSize()!.height;
      const nova = Math.min(Math.max(altura, 844), 6000);
      if (nova <= atual + 1) break;
      await page.setViewportSize({ width: largura, height: nova });
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${PASTA}/${nome}.png`, animations: 'disabled' });
    writeFileSync(`${PASTA}/${nome}.json`, JSON.stringify({ rolagemLateral, contraste, naoTratadas: api.naoTratadas, errosDaPagina: api.errosDaPagina }, null, 2));
    expect(api.errosDaPagina).toEqual([]);
  });
}
