import { expect, test, type Page } from '@playwright/test';

import type { AnamneseDetalhe, ConteudoQuestionario, PerguntaAtualizacao, QuestionarioDetalhe, SalvarQuestionarioRequest } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';
import { pngDeCor } from './imagens-falsas';

/**
 * Fotos guiadas (docs/planos/fotos-guiadas.md, passo 3): a pergunta FOTOS com `lugares` mostra ao aluno um espaço por
 * lugar, com o nome, na ordem e sem buraco (só o próximo recebe a foto e só a última sai), com o texto fixo do guia. No
 * editor, "Lugares das fotos" tira o "Quantas fotos" (o max acompanha), mostra o erro na linha e a prévia mostra o guia.
 * Só dados fictícios.
 */
const ANAMNESE_ID = 'n0000000-0000-4000-8000-000000000011';
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const FOTO_1 = 'f0000000-0000-4000-8000-000000000001';
const QUESTIONARIO_ID = 'q0000000-0000-4000-8000-000000000021';
const LUGARES = ['Frente', 'Costas', 'Lado direito'];

const FOTOS: PerguntaAtualizacao = { id: 'corpo', tipo: 'FOTOS', rotulo: 'Fotos do período', obrigatoria: false, max: 3, lugares: LUGARES };
const MODELO: ConteudoQuestionario = { formato: 2, instrucoes: [], secoes: [{ uid: 's1', titulo: 'Fotos', perguntas: [FOTOS] }] };

const PENDENTE: AnamneseDetalhe = {
  id: ANAMNESE_ID, alunoId: ALUNO_ID, nomeAluno: null, situacao: 'PENDENTE',
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000011', questionarioVersaoNumero: 1, questionarioNome: null,
  modelo: MODELO, respostas: {}, atribuidaEm: '2026-11-10T12:00:00Z', atribuidaPorNome: null, enviadaEm: null,
  revisadaEm: null, revisadaPorNome: null, dispensadaEm: null, dispensadaPorNome: null, alteracoes: [], dispensaMotivo: null, versao: 1,
};

/** JPEG fictício gerado no navegador (um quadrado de uma cor, sem pessoa nenhuma). */
async function jpegFicticio(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#5a7d9a';
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

for (const largura of [390, 1280]) {
  test(`aluno: um espaço por lugar, na ordem; a foto vai para o próximo e só a última sai (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/fotos/configuracao': { corpo: { habilitado: true, maximoPorPergunta: 6, bytesMaximo: 1_000_000, porDia: 12 } },
      'GET /aluno/anamnese': { corpo: PENDENTE },
      'POST /aluno/fotos': (_p, route) => json(route, { id: FOTO_1 }),
      [`GET /aluno/fotos/${FOTO_1}`]: (_p, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(16, [90, 125, 154]) }),
    });
    await page.goto('/aluno/anamnese');

    await expect(page.getByText('Tire a foto no lugar indicado.')).toBeVisible();
    for (const lugar of LUGARES) await expect(page.getByText(lugar, { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Frente: próxima foto', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Costas: sem foto', exact: true })).toBeVisible();
    await expect(page.getByText('Próxima foto: Frente')).toBeVisible();
    // Os nomes ficam na ordem dos lugares.
    await expect(page.getByText(/^(Frente|Costas|Lado direito)$/)).toHaveText(LUGARES);

    const jpeg = await jpegFicticio(page);
    const [seletor] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Adicionar foto' }).click()]);
    await seletor.setFiles({ name: 'foto-ficticia.jpg', mimeType: 'image/jpeg', buffer: jpeg });

    // A miniatura é um botão com a imagem dentro, os dois com o mesmo nome: basta o primeiro.
    await expect(page.getByLabel('Foto: Frente', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Próxima foto: Costas')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Costas: próxima foto', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover a foto: Frente' })).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/aluno/fotos')).toHaveLength(1);
    // Nada de opinião sobre o corpo: só o texto fixo do guia.
    await expect(page.getByText(/postura|gordura|magr|defini/i)).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`editor: "Lugares das fotos" tira o "Quantas fotos", erra na linha, salva com o max e a prévia mostra o guia (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const semLugares: ConteudoQuestionario = { ...MODELO, secoes: [{ ...MODELO.secoes[0], perguntas: [{ ...FOTOS, max: 4, lugares: undefined }] }] };
    let detalhe: QuestionarioDetalhe = {
      id: QUESTIONARIO_ID, nome: 'Atualização com fotos', descricao: null, finalidade: 'ATUALIZACAO', padrao: false, arquivado: false,
      versaoPublicada: 0, publicadoEm: null, alteradoDesdePublicacao: true, rascunhoAlteradoEm: '2026-11-10T12:00:00Z',
      uso: { alunos: 0, pastas: 0, envios: 0 }, versao: 1, rascunho: semLugares, versoes: [],
    };
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /questionarios/${QUESTIONARIO_ID}`]: (_p, route) => json(route, detalhe),
      [`PUT /questionarios/${QUESTIONARIO_ID}`]: (p, route) => {
        detalhe = { ...detalhe, rascunho: (p.corpo as SalvarQuestionarioRequest).conteudo, versao: detalhe.versao + 1 };
        return json(route, detalhe);
      },
    });
    await page.goto(`/treinador/planejamento/questionario/${QUESTIONARIO_ID}`);
    await page.getByRole('button', { name: /^Pergunta 1: Fotos do período/ }).click();

    // Sem lugares, como hoje.
    await expect(page.getByRole('radiogroup', { name: 'Quantas fotos o aluno pode anexar' })).toBeVisible();
    await expect(page.getByText('Lugares das fotos (opcional)')).toBeVisible();

    const adicionar = page.getByRole('button', { name: 'Adicionar lugar' });
    await adicionar.click();
    await page.getByLabel('Lugar 1').fill('Frente');
    await adicionar.click();
    await page.getByLabel('Lugar 2').fill('frente');
    // Com lugares, o "Quantas fotos" some e o max acompanha.
    await expect(page.getByRole('radiogroup', { name: 'Quantas fotos o aluno pode anexar' })).toHaveCount(0);
    await expect(page.getByText('Uma foto por lugar: o aluno anexa 2 fotos, na ordem dos lugares.')).toBeVisible();
    await expect(page.getByText('Lugares das fotos (2 de 6)')).toBeVisible();
    // O erro da regra pura aparece na linha.
    await expect(page.getByText('Texto repetido.')).toBeVisible();
    await page.getByLabel('Lugar 2').fill('Costas');
    await expect(page.getByText('Texto repetido.')).toHaveCount(0);

    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const enviada = (pedidos.find((p) => p.metodo === 'PUT')!.corpo as SalvarQuestionarioRequest).conteudo.secoes[0].perguntas[0];
    expect(enviada).toMatchObject({ tipo: 'FOTOS', lugares: ['Frente', 'Costas'], max: 2 });

    // A prévia mostra o guia: o nome de cada lugar e o texto fixo.
    await page.getByRole('tab', { name: 'Prévia' }).click();
    await expect(page.getByText('Tire a foto no lugar indicado.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Frente: próxima foto', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Costas: sem foto', exact: true })).toBeVisible();

    // Tirar todos os lugares volta ao "Quantas fotos".
    await page.getByRole('tab', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Remover lugar 2' }).click();
    await page.getByRole('button', { name: 'Remover lugar 1' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Quantas fotos o aluno pode anexar' })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
