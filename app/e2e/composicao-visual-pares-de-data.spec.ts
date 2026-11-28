import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, AlunoResumo, CicloDaAluna, EuResponse, PastaResumo, PlanoResumo, Receita } from '../src/api/tipos';
import { ALUNO, json, MARCA, PERMISSOES_TREINADOR, rotasDaPasta, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Intervalo de datas como par padrão (`docs/planos/composicao-visual.md`, passos 5 e 6; P2 de `docs/design-e-front.md`
 * 4.6), conferido por posição e tamanho, sem capturas: o `ParDeDatas` (`ui/CamposEmLinha`) no filtro (`CamposDePeriodo`,
 * aqui na Auditoria; nos Interessados é `interessados-composicao.spec.ts`) e nas folhas Copiar pasta, Copiar plano,
 * Aplicar modelo e Registrar outra data do ciclo. Em 1280 as duas datas ficam lado a lado; em 390 o filtro continua lado
 * a lado e o formulário empilha; sempre o mesmo tamanho, o erro de um campo não desalinha o outro, o rodapé da folha
 * fica à vista e a página não rola para o lado. Nos temas Claro, Escuro, Areia e contraste alto. API simulada, só dados
 * fictícios.
 */

type Caixa = { x: number; y: number; width: number; height: number };
type Tema = { tema: 'CLARO' | 'ESCURO' | 'AREIA'; contraste?: 'ALTO' };

const TEMAS: Tema[] = [{ tema: 'CLARO' }, { tema: 'ESCURO' }, { tema: 'AREIA' }, { tema: 'CLARO', contraste: 'ALTO' }];
const nomeDoTema = (t: Tema) => `${t.tema.toLowerCase()}${t.contraste ? ' contraste alto' : ''}`;

const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-000000000017';
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const PASTAS: PastaResumo[] = [{ id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-10-06', fim: '2026-10-20', concluidaEm: null }];
const TREINO: PlanoResumo = {
  id: 'b0000000-0000-4000-8000-000000000001', alunoId: ALUNO_ID, pastaId: PASTA_ID, titulo: 'Treino do Plano 17',
  inicio: '2026-10-06', fim: '2026-10-20', ativo: true, versaoPublicada: 2, publicadoEm: '2026-10-06T12:00:00Z',
  rascunhoAlteradoDepoisDePublicar: false, versao: 3,
};
const DESTINO: AlunoResumo = {
  id: 'a0000000-0000-4000-8000-0000000000b1', nome: 'Aluna Destino', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null,
};
const MODELO: Receita = {
  id: 'r0000000-0000-4000-8000-000000000001', tipo: 'PLANO_TREINO', origem: 'CONSULTORIA', nome: 'Semana fictícia', descricao: null, conteudo: null, ordem: 1, pastaId: null, versao: 1,
};
const PERMISSOES = [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR', 'MODELO_LER', 'MODELO_APLICAR', 'AUDITORIA_LER'];

async function comTema(page: Page, largura: number, usuarioId: string, tema: Tema) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, prefs]) => localStorage.setItem(`treinos:${id}:preferencias`, prefs),
    [usuarioId, JSON.stringify({ tema: tema.tema, contraste: tema.contraste ?? 'PADRAO' })] as const);
}

/** A ficha com a Folha da pasta aberta e um aluno de destino sem pastas (a cópia cria pasta nova: as datas aparecem). */
async function abrirPasta(page: Page) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos': { corpo: { itens: [DESTINO], total: 1 } },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS },
    [`GET /alunos/${DESTINO.id}/pastas`]: { corpo: [] },
    ...rotasDaPasta({ alunoId: ALUNO_ID, pastaId: PASTA_ID, planos: [{ tipo: 'treino', plano: { ...TREINO } }], permissoes: PERMISSOES }),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
  const pasta = page.getByRole('dialog', { name: 'Pasta de 06/10 a 20/10' });
  await expect(pasta).toBeVisible();
  return { ...api, pasta };
}

async function escolherDestino(page: Page, folha: Locator) {
  await folha.getByRole('button', { name: 'Aluno: Escolher. Escolher.' }).click();
  await page.getByRole('dialog', { name: 'Escolher aluno' }).getByRole('radio', { name: DESTINO.nome }).click();
}

/** A caixa com borda em volta do controle (o `input` da data fica dentro dela, com o ícone do calendário). */
function caixa(alvo: Locator): Promise<Caixa> {
  return alvo.evaluate((el) => {
    let e: Element | null = el;
    while (e && e !== document.body && !(parseFloat(getComputedStyle(e).borderTopWidth) > 0)) e = e.parentElement;
    const r = (e ?? el).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
const perto = (a: number, b: number, folga = 1) => Math.abs(a - b) <= folga;

/** Lado a lado (mesmo topo, o fim à direita) ou empilhados (mesma borda esquerda, o fim embaixo); sempre o mesmo tamanho. */
async function conferirPar(inicio: Locator, fim: Locator, ladoALado: boolean, largura: number) {
  // Medidos juntos: uma mensagem que chega entre duas medidas mudaria a linha.
  const [de, ate] = await Promise.all([caixa(inicio), caixa(fim)]);
  expect(perto(de.height, ate.height) && perto(de.width, ate.width), `mesmo tamanho: ${JSON.stringify({ de, ate })}`).toBe(true);
  expect(de.height).toBeGreaterThanOrEqual(44);
  if (ladoALado) {
    expect(perto(de.y, ate.y), `mesmo topo: ${de.y} e ${ate.y}`).toBe(true);
    expect(ate.x).toBeGreaterThan(de.x + de.width - 1);
  } else {
    expect(perto(de.x, ate.x), `mesma borda: ${de.x} e ${ate.x}`).toBe(true);
    expect(ate.y).toBeGreaterThan(de.y + de.height - 1);
  }
  for (const c of [de, ate]) {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(largura);
  }
}

/** A data inteira cabe sem cortar e a página não rola para o lado. */
async function semCorteNemRolagem(page: Page, campos: Locator[]) {
  for (const campo of campos) {
    await campo.fill('31/12/2026');
    expect(await campo.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await campo.fill('');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

interface Caso {
  nome: string;
  /** Lado a lado também em 390 (variante `filtro` do `ParDeDatas`). */
  filtro?: boolean;
  usuarioId: string;
  /** Abre a tela e a folha; devolve o diálogo, os dois campos, a ação principal do rodapé e os erros da página. */
  abrir: (page: Page) => Promise<{ dialogo: Locator; inicio: Locator; fim: Locator; principal: Locator; errosDaPagina: string[] }>;
  /** Põe erro só num dos campos e devolve a mensagem que deve aparecer. */
  erro: (inicio: Locator, fim: Locator) => Promise<string | RegExp>;
}

const CASOS: Caso[] = [
  {
    nome: 'filtro de Auditoria (CamposDePeriodo)',
    filtro: true,
    usuarioId: TREINADOR.id,
    abrir: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /auditoria/pessoas': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
        'GET /auditoria': (_p, route) => json(route, {
          itens: [{ id: 'e1', usuarioId: TREINADOR.id, nomeUsuario: TREINADOR.nome, acao: 'ALUNO_CRIADO', entidade: 'ALUNO', entidadeId: null, resumo: 'Cadastrou um aluno.', criadoEm: '2026-10-20T13:00:00Z' }],
          total: 1, pagina: 0,
        }),
      });
      await page.goto('/treinador/auditoria');
      await expect(page.getByText('Cadastrou um aluno.').first()).toBeVisible();
      await page.getByRole('button', { name: /^Filtros/ }).click();
      const dialogo = page.getByRole('dialog', { name: 'Filtros de eventos' });
      const inicio = dialogo.getByRole('textbox', { name: 'De', exact: true });
      await expect(inicio).toBeVisible();
      // Rótulo de grupo à vista e, dentro dele, os rótulos "De" e "Até" à vista (WCAG 3.3.2).
      await expect(dialogo.getByRole('group', { name: 'Período' })).toBeVisible();
      return { dialogo, inicio, fim: dialogo.getByRole('textbox', { name: 'Até', exact: true }), principal: dialogo.getByRole('button', { name: /^(Aplicar filtros|Mostrar )/ }), errosDaPagina };
    },
    erro: async (inicio, fim) => {
      await inicio.fill('10/10/2026');
      await fim.fill('01/10/2026');
      return 'Fim antes do início.';
    },
  },
  {
    nome: 'Copiar pasta para outro aluno',
    usuarioId: TREINADOR.id,
    abrir: async (page) => {
      const { pasta, errosDaPagina } = await abrirPasta(page);
      await pasta.getByRole('button', { name: 'Mais ações da pasta de 06/10 a 20/10' }).click();
      await page.getByRole('button', { name: /Copiar pasta para outro aluno/ }).click();
      const dialogo = page.getByRole('dialog', { name: 'Copiar pasta para outro aluno' });
      await escolherDestino(page, dialogo);
      return {
        dialogo, inicio: dialogo.getByRole('textbox', { name: 'Início (opcional)', exact: true }), fim: dialogo.getByRole('textbox', { name: 'Fim (opcional)', exact: true }),
        principal: dialogo.getByRole('button', { name: 'Copiar pasta', exact: true }), errosDaPagina,
      };
    },
    erro: async (inicio, fim) => {
      await inicio.fill('10/10/2026');
      await fim.fill('01/10/2026');
      return 'O fim vem antes do início.';
    },
  },
  {
    nome: 'Copiar plano para outro aluno',
    usuarioId: TREINADOR.id,
    abrir: async (page) => {
      const { pasta, errosDaPagina } = await abrirPasta(page);
      await pasta.getByRole('button', { name: `Mais ações de ${TREINO.titulo}`, exact: true }).click();
      await page.getByRole('button', { name: /^Copiar para outro aluno/ }).click();
      const dialogo = page.getByRole('dialog', { name: 'Copiar para outro aluno' });
      await escolherDestino(page, dialogo);
      return {
        dialogo, inicio: dialogo.getByRole('textbox', { name: 'Início (opcional)', exact: true }), fim: dialogo.getByRole('textbox', { name: 'Fim (opcional)', exact: true }),
        principal: dialogo.getByRole('button', { name: 'Copiar para o aluno', exact: true }), errosDaPagina,
      };
    },
    erro: async (inicio) => {
      await inicio.fill('01/01/1999');
      return /^Início do período: use uma data entre 01\/01\/2000/;
    },
  },
  {
    nome: 'Aplicar modelo ao aluno',
    usuarioId: TREINADOR.id,
    abrir: async (page) => {
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /receitas': { corpo: [MODELO] },
        'GET /pastas-modelos': { corpo: [] },
        'GET /alunos': { corpo: { itens: [DESTINO], total: 1 } },
        [`GET /alunos/${DESTINO.id}/pastas`]: { corpo: [] },
      });
      await page.goto('/treinador/planejamento');
      await page.getByRole('button', { name: 'Aplicar ao aluno', exact: true }).first().click();
      const dialogo = page.getByRole('dialog', { name: `Aplicar: ${MODELO.nome}` });
      await escolherDestino(page, dialogo);
      return {
        dialogo, inicio: dialogo.getByRole('textbox', { name: 'Início (opcional)', exact: true }), fim: dialogo.getByRole('textbox', { name: 'Fim (opcional)', exact: true }),
        principal: dialogo.getByRole('button', { name: 'Criar cópia para o aluno', exact: true }), errosDaPagina,
      };
    },
    erro: async (_inicio, fim) => {
      await fim.fill('01/01/1999');
      return /^Fim do período: use uma data entre 01\/01\/2000/;
    },
  },
  {
    nome: 'Registrar outra data do ciclo (aluna)',
    usuarioId: ALUNO.id,
    abrir: async (page) => {
      const rotas = await sessaoDeAluno(page);
      const eu = (rotas['GET /eu'] as { corpo: EuResponse }).corpo;
      const ciclo: CicloDaAluna = {
        disponivel: true, ativo: true, consentimentoVersaoAtual: 1, duracaoHabitual: 28, mostrarFases: true, registros: [], dias: [], textosDasFases: null,
      };
      const respostas: RespostasApi = {
        ...rotas,
        'GET /eu': { corpo: { ...eu, cicloHabilitado: true, aluno: { id: ALUNO_ID, nome: ALUNO.nome, sexo: 'FEMININO' } } },
        'GET /aluno/ciclo': { corpo: ciclo },
      };
      const { errosDaPagina } = await simularApi(page, respostas);
      await page.goto('/aluno/ciclo');
      await expect(page.getByRole('heading', { name: 'Ciclo menstrual', level: 1 })).toBeVisible();
      await page.getByRole('button', { name: 'Registrar outra data', exact: true }).click();
      const dialogo = page.getByRole('dialog', { name: 'Registrar outra data' });
      return {
        dialogo, inicio: dialogo.getByRole('textbox', { name: 'Início', exact: true }), fim: dialogo.getByRole('textbox', { name: 'Fim (opcional)', exact: true }),
        principal: dialogo.getByRole('button', { name: 'Salvar', exact: true }), errosDaPagina,
      };
    },
    erro: async (_inicio, fim) => {
      await fim.fill('31/02/2026');
      return 'Data inválida.';
    },
  },
];

for (const largura of [390, 1280]) {
  for (const tema of TEMAS) {
    for (const caso of CASOS) {
      test(`${caso.nome} ${largura}px ${nomeDoTema(tema)}: par de datas, erro num campo só, rodapé à vista e sem rolagem lateral`, async ({ page }) => {
        await comTema(page, largura, caso.usuarioId, tema);
        const { dialogo, inicio, fim, principal, errosDaPagina } = await caso.abrir(page);
        await expect(inicio).toBeVisible();
        const ladoALado = largura >= 768 || !!caso.filtro;
        await conferirPar(inicio, fim, ladoALado, largura);
        await semCorteNemRolagem(page, [inicio, fim]);

        // Erro só num campo: a mensagem fica nele e as duas caixas continuam alinhadas e do mesmo tamanho.
        const mensagem = await caso.erro(inicio, fim);
        await expect(dialogo.getByText(mensagem)).toBeVisible();
        await conferirPar(inicio, fim, ladoALado, largura);

        // O rodapé da folha fica à vista, sem nada por cima da ação principal.
        await expect(principal).toBeInViewport();
        const livre = await principal.evaluate((e) => {
          const r = e.getBoundingClientRect();
          const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!no && (no === e || e.contains(no));
        });
        expect(livre).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(errosDaPagina).toEqual([]);
      });
    }
  }
}
