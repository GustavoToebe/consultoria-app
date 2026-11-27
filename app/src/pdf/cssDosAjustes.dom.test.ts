/** @jest-environment jsdom */
import type { Marca } from '../api/tipos';
import { MODELOS_PDF, valoresDoModelo, type OpcoesPdf, type ValoresPdf } from '../dominio/configuracaoPdf';
import { contraste } from '../tema/tokens';
import { cascata } from './contrasteComCascata.apoioTeste';
import { LISTRA } from './cssDasOpcoes';
import { ajustesDoGerador } from './cssDosAjustes';
import { CINZA_DO_TEXTO_FRACO } from './cssDosTemas';
import { GERADORES_DE_TESTE } from './documentosDeTeste.apoioTeste';
import { cssDaPrevia } from './html';

/**
 * Os quatro defeitos dos PDFs (26/11), provados pela cascata do CSS que os geradores de verdade produzem, nos seis modelos:
 * (1) texto de cabeçalho de tabela legível sobre o fundo real, (2) cinza do macro com 4,5:1, (3) densidade e tamanho P/G
 * chegando aos seletores específicos de cada gerador, (4) uma listra só na dieta. O contraste em todas as combinações
 * está em `contrasteDosModelos.dom.test.ts`.
 */
jest.setTimeout(120000);

const MODELOS = MODELOS_PDF.map((m) => m.id);
const NAVY = '#1A1A2E';
const marcaDe = (modelo: string, opcoesPdf?: OpcoesPdf, corPrimaria = '#C62828'): Marca => ({
  id: 'm', nome: 'Consultoria de Exemplo', corPrimaria, fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl: null, temaPdf: modelo, opcoesPdf,
});
const doc = (nome: string, marca: Marca) => {
  const d = GERADORES_DE_TESTE[nome](marca);
  return cascata(d.css, d.corpo);
};
/** O valor que venceu a cascata para o primeiro elemento do seletor. */
const primeiro = (nome: string, marca: Marca, seletor: string, propriedade: string) => {
  const c = doc(nome, marca);
  const el = c.todos(seletor)[0];
  if (!el) throw new Error(`sem ${seletor} em ${nome}`);
  return c.valor(el, propriedade);
};

describe('defeito 1: cabeçalho de tabela legível em todo modelo e combinação', () => {
  it('o `th` das tabelas escuras da dieta é branco sobre o navy fixo, com a marca amarela e o destaque que for', () => {
    for (const modelo of MODELOS) {
      const c = doc('dieta', marcaDe(modelo, undefined, '#FFEB3B'));
      for (const th of c.todos('table.dark th')) {
        const cor = c.valor(th, 'color');
        const fundo = c.valor(th, 'background');
        // LINHA e CARTAO têm cabeçalho leve (texto #333 sobre nada ou sobre o cinza leve); FAIXA, o navy com texto branco.
        if (fundo === NAVY) {
          expect(cor).toBe('#fff');
          expect(contraste('#FFFFFF', NAVY)).toBeGreaterThanOrEqual(4.5);
        }
        else expect(['none', '#F3F4F6']).toContain(fundo);
      }
    }
  });

  it('Compacto (FAIXA) com a marca amarela: o `th` da dieta e o das tabelas comuns têm texto legível sobre o fundo real', () => {
    const dieta = doc('dieta', marcaDe('COMPACTO', undefined, '#FFEB3B'));
    expect(dieta.valor(dieta.todos('table.dark th')[0], 'color')).toBe('#fff');
    expect(dieta.valor(dieta.todos('table.dark th')[0], 'background')).toBe(NAVY);
    const treino = doc('treino', marcaDe('COMPACTO', undefined, '#FFEB3B'));
    expect(treino.valor(treino.todos('th')[0], 'color')).toBe('#000000');
    expect(treino.valor(treino.todos('th')[0], 'background')).toBe('#FFEB3B');
  });
});

describe('defeito 2: o macro por item em cinza com 4,5:1 nos seis modelos', () => {
  it.each(MODELOS)('%s', (modelo) => {
    const c = doc('dieta', marcaDe(modelo));
    const macros = c.todos('.item .macros');
    expect(macros.length).toBeGreaterThan(0);
    for (const el of macros) {
      expect(c.valor(el, 'color')).toBe(CINZA_DO_TEXTO_FRACO);
      expect(contraste(CINZA_DO_TEXTO_FRACO, c.fundo(el))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('defeito 3: densidade e tamanho chegam aos seletores específicos dos geradores', () => {
  const DENSIDADES = ['COMPACTA', 'NORMAL', 'ESPACOSA'] as const;
  const TAMANHOS = ['P', 'M', 'G'] as const;
  const opcoes = (tamanho: ValoresPdf['texto']['tamanho'], densidade: ValoresPdf['tabelas']['densidade']): OpcoesPdf => ({ texto: { tamanho }, tabelas: { densidade } });

  const PADDING_ID: Record<string, string> = { COMPACTA: '2pt 4pt', NORMAL: '4pt 8pt', ESPACOSA: '7pt 8pt' };
  const PADDING_INSTRUCOES: Record<string, string> = { COMPACTA: '2pt 4pt', NORMAL: '5pt 6pt', ESPACOSA: '7pt 8pt' };
  const PADDING_COMUM: Record<string, string> = { COMPACTA: '2pt 4pt', NORMAL: '4pt 5pt', ESPACOSA: '7pt 8pt' };
  const ITEM: Record<string, string> = { COMPACTA: '1pt 0', NORMAL: '2pt 0', ESPACOSA: '4pt 0' };
  const SERIE: Record<string, string> = { COMPACTA: '0 0 2pt', NORMAL: '0 0 4pt', ESPACOSA: '0 0 7pt' };
  const SEC: Record<string, string> = { P: '10pt', M: '11pt', G: '12pt' };
  const MACROS: Record<string, string> = { P: '8pt', M: '9pt', G: '10pt' };
  const FAIXA_DA_REFEICAO: Record<string, string> = { P: '9.5pt', M: '10.5pt', G: '11.5pt' };
  const TITULO_DA_DIVISAO: Record<string, string> = { P: '10.5pt', M: '11.5pt', G: '13pt' };

  it.each(MODELOS)('%s: padrão do modelo e todas as trocas de densidade e tamanho', (modelo) => {
    for (const densidade of DENSIDADES) {
      const m = marcaDe(modelo, opcoes(valoresDoModelo(modelo).texto.tamanho, densidade));
      expect(primeiro('dieta', m, 'table.id td', 'padding')).toBe(PADDING_ID[densidade]);
      expect(primeiro('dieta', m, 'table.macros td', 'padding')).toBe(densidade === 'NORMAL' ? '5pt 8pt' : PADDING_ID[densidade]);
      expect(primeiro('dieta', m, 'table.dark td', 'padding')).toBe(PADDING_COMUM[densidade]);
      expect(primeiro('dieta', m, '.item', 'margin')).toBe(ITEM[densidade]);
      expect(primeiro('treino', m, 'table.instrucoes td', 'padding')).toBe(PADDING_INSTRUCOES[densidade]);
      expect(primeiro('treino', m, '.serie', 'margin')).toBe(SERIE[densidade]);
      expect(primeiro('treino', m, 'table td', 'padding')).toBe(PADDING_COMUM[densidade]);
      expect(primeiro('cargas', m, '.exercicio td', 'padding')).toBe(PADDING_COMUM[densidade]);
      expect(primeiro('mobilidade', m, 'table td', 'padding')).toBe(PADDING_COMUM[densidade]);
    }
    for (const tamanho of TAMANHOS) {
      const m = marcaDe(modelo, opcoes(tamanho, valoresDoModelo(modelo).tabelas.densidade));
      expect(primeiro('dieta', m, 'h2.sec', 'font-size')).toBe(SEC[tamanho]);
      expect(primeiro('dieta', m, '.item .macros', 'font-size')).toBe(MACROS[tamanho]);
      expect(primeiro('dieta', m, '.refeicao > .cab', 'font-size')).toBe(FAIXA_DA_REFEICAO[tamanho]);
      expect(primeiro('cargas', m, '.titulo-divisao', 'font-size')).toBe(TITULO_DA_DIVISAO[tamanho]);
    }
  });

  it('o Clássico sem opções não acrescenta nenhuma regra de ajuste (M e NORMAL são o que os geradores já escrevem)', () => {
    for (const nome of ['dieta', 'treino', 'cargas']) {
      const base = GERADORES_DE_TESTE[nome](marcaDe('CLASSICO')).css;
      const igual = GERADORES_DE_TESTE[nome](marcaDe('CLASSICO', { texto: { tamanho: 'M' }, tabelas: { densidade: 'NORMAL' } })).css;
      expect(igual).toBe(base);
    }
  });
});

describe('defeito 4: uma listra só na dieta', () => {
  const TABELAS_DA_DIETA = 'table.id, table.macros, table.dark';
  const fundosDasLinhasPares = (marca: Marca) => {
    const c = doc('dieta', marca);
    const pares = c.todos(TABELAS_DA_DIETA).flatMap((t) => Array.from(t.querySelectorAll('tbody > tr:nth-child(even) > td')));
    expect(pares.length).toBeGreaterThan(0);
    return [...new Set(pares.map((td) => c.valor(td, 'background')))];
  };

  it.each(MODELOS)('%s com tabelas LISTRADA: as três tabelas da dieta ficam na listra da opção, em qualquer cabeçalho', (modelo) => {
    for (const estilo of ['FAIXA', 'LINHA', 'CARTAO'] as const) {
      expect(fundosDasLinhasPares(marcaDe(modelo, { tabelas: { estilo: 'LISTRADA' }, cabecalho: { estilo } }))).toEqual([LISTRA]);
    }
  });

  it('com LINHAS o jeito de sempre da dieta continua (cinza próprio; no cabeçalho LINHA, sem listra)', () => {
    expect(fundosDasLinhasPares(marcaDe('CLASSICO'))).toEqual(['#f4f4f4']);
    expect(fundosDasLinhasPares(marcaDe('MINIMALISTA'))).toEqual(['none']);
  });

  it('o resto do documento (a lista de compras e as outras tabelas) usa a mesma listra', () => {
    const c = doc('lista de compras', marcaDe('ESPORTIVO'));
    const pares = c.todos('tbody > tr:nth-child(even) > td');
    expect(pares.length).toBeGreaterThan(0);
    for (const td of pares) expect(c.valor(td, 'background')).toBe(LISTRA);
  });
});

describe('as regras de ajuste são só do código e prefixáveis pela prévia', () => {
  it.each(['DIETA', 'TREINO', 'CARGAS'] as const)('%s: toda regra começa em .doc e nada é ativo', (gerador) => {
    for (const modelo of MODELOS) {
      for (const tamanho of ['P', 'M', 'G'] as const) {
        for (const densidade of ['COMPACTA', 'NORMAL', 'ESPACOSA'] as const) {
          for (const estilo of ['LINHAS', 'LISTRADA', 'CARTOES'] as const) {
            const valores = valoresDoModelo(modelo);
            Object.assign(valores.texto, { tamanho });
            Object.assign(valores.tabelas, { densidade, estilo });
            const css = ajustesDoGerador(gerador, valores);
            for (const regra of css.split('\n').filter(Boolean)) expect(regra.startsWith('.doc')).toBe(true);
            expect(css).not.toMatch(/url\(|@import|expression\(|javascript:|behavior:|<|>\s*script/i);
            expect(cssDaPrevia(css, 'teste').split('\n').filter((l) => l.startsWith('.doc'))).toEqual([]);
          }
        }
      }
    }
  });
});
