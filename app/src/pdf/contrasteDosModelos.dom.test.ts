/** @jest-environment jsdom */
import type { Marca } from '../api/tipos';
import { MODELOS_PDF, PALETA_DE_DESTAQUE, coresDoDestaque, type OpcoesPdf } from '../dominio/configuracaoPdf';
import { contraste } from '../tema/tokens';
import { cascata } from './contrasteComCascata.apoioTeste';
import { LISTRA } from './cssDasOpcoes';
import { CINZA_DO_TEXTO_FRACO, FUNDO_LEVE } from './cssDosTemas';
import { GERADORES_DE_TESTE } from './documentosDeTeste.apoioTeste';

/**
 * D7 (contraste 4,5:1 vale para o PDF): cada texto de cada documento contra o fundo em que ele cai, pela cascata do CSS que o
 * gerador de verdade produz. Percorre os 6 modelos e, sobre o Clássico, todo estilo de cabeçalho × estilo de tabela × cor de
 * destaque (a paleta fechada do editor), com o `#FFEB3B` (o pior caso: amarelo) e duas marcas comuns na entrada.
 */
jest.setTimeout(180000);

const MARCA_AMARELA = '#FFEB3B';
const MARCAS = [MARCA_AMARELA, '#C62828', '#1B1B3A'];
const ESTILOS_DO_CABECALHO = ['FAIXA', 'LINHA', 'CARTAO'] as const;
const ESTILOS_DAS_TABELAS = ['LINHAS', 'LISTRADA', 'CARTOES'] as const;
const DESTAQUES = PALETA_DE_DESTAQUE.map((p) => p.id);
const NOMES = Object.keys(GERADORES_DE_TESTE);

const marcaDe = (corPrimaria: string, temaPdf: string, opcoesPdf?: OpcoesPdf): Marca => ({
  id: 'm', nome: 'Consultoria de Exemplo', corPrimaria, fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl: null, temaPdf, opcoesPdf,
});
const falhas = (nome: string, marca: Marca) => {
  const d = GERADORES_DE_TESTE[nome](marca);
  return cascata(d.css, d.corpo).textosSemContraste();
};

describe('o verificador com cascata pega o que a leitura de regra isolada não pega', () => {
  it('texto escuro herdado sobre o fundo escuro de outra regra (o `th` do Compacto com a marca amarela, antes da correção)', () => {
    const css = '.doc th { color: #000000; background: #FFEB3B; }\n.doc table.dark th { background: #1A1A2E; }';
    const r = cascata(css, '<table class="dark"><thead><tr><th>Dose</th></tr></thead></table>').textosSemContraste();
    expect(r).toEqual(['th.: #000000 sobre #1A1A2E = 1.23']);
  });

  it('cinza fraco (#777 sobre branco = 4,48:1) e a listra de uma regra por cima da outra', () => {
    expect(cascata('.doc .macros { color: #777777; }', '<span class="macros">x</span>').textosSemContraste()).toHaveLength(1);
    const c = cascata(
      '.doc tbody tr:nth-child(even) > td { background: #F7F8FA; }\n.doc table.id tr:nth-child(even) td { background: #f4f4f4; }',
      '<table class="id"><tbody><tr><td>a</td></tr><tr><td>b</td></tr></tbody></table>',
    );
    expect(c.valor(c.todos('td')[1], 'background')).toBe('#f4f4f4');
  });

  it('o `!important` da faixa vence o `style` do atributo, e `color: inherit` herda', () => {
    const css = '.doc .faixa-marca { background: #15803D !important; color: #FFFFFF !important; }\n.doc .titulo { background: #FFEB3B; color: #000; }\n.doc .titulo .pequeno { color: inherit; }';
    const corpo = '<div class="faixa-marca" style="background:#FFEB3B;color:#000000">Nome</div><div class="titulo"><span class="pequeno">n</span></div>';
    expect(cascata(css, corpo).textosSemContraste()).toEqual([]);
  });
});

describe('o cinza do macro e as superfícies neutras (defeito 2)', () => {
  it('#777 dava 4,48:1 sobre o branco; o cinza novo passa 4,5:1 em toda superfície em que o macro pode cair', () => {
    expect(contraste('#777777', '#FFFFFF')).toBeLessThan(4.5);
    for (const fundo of ['#FFFFFF', FUNDO_LEVE, LISTRA, '#F4F4F4', '#F7F7F7', '#F2F2F2']) expect(contraste(CINZA_DO_TEXTO_FRACO, fundo)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('o amarelo #FFEB3B em todos os modelos (texto sobre o destaque escuro, nada amarelo sobre branco)', () => {
  it.each(MODELOS_PDF.map((m) => m.id))('%s: nenhum texto abaixo de 4,5:1 em nenhum documento, com cada marca', (modelo) => {
    for (const marca of MARCAS) {
      for (const nome of NOMES) expect({ nome, marca, falhas: falhas(nome, marcaDe(marca, modelo)) }).toEqual({ nome, marca, falhas: [] });
    }
  });

  it('o texto sobre a cor de destaque é escuro no amarelo e claro nas cores escuras (pela luminância, nunca fixo)', () => {
    expect(coresDoDestaque('MARCA', MARCA_AMARELA).sobreFundo).toBe('#000000');
    for (const { id, cor } of PALETA_DE_DESTAQUE.filter((p) => p.cor)) {
      expect({ id, ok: contraste(coresDoDestaque(id, null).sobreFundo, cor!) >= 4.5 }).toEqual({ id, ok: true });
    }
  });
});

describe.each(MODELOS_PDF.map((m) => m.id))('%s: cabeçalho × tabelas × destaque', (modelo) => {
  // Marca amarela com todos os destaques; as outras marcas só com o destaque `MARCA` (os fixos não dependem da marca).
  const casos = [
    ...MARCAS.flatMap((marca) => ESTILOS_DO_CABECALHO.flatMap((c) => ESTILOS_DAS_TABELAS.map((t) => [marca, c, t, 'MARCA'] as const))),
    ...DESTAQUES.filter((d) => d !== 'MARCA').flatMap((d) => ESTILOS_DO_CABECALHO.flatMap((c) => ESTILOS_DAS_TABELAS.map((t) => [MARCA_AMARELA, c, t, d] as const))),
  ];

  it.each(NOMES)('%s: nenhum texto abaixo de 4,5:1 em nenhuma combinação', (nome) => {
    const abaixo: string[] = [];
    for (const [marca, cabecalho, tabelas, destaque] of casos) {
      const opcoes: OpcoesPdf = { cores: { destaque }, cabecalho: { estilo: cabecalho }, tabelas: { estilo: tabelas } };
      for (const f of falhas(nome, marcaDe(marca, modelo, opcoes))) abaixo.push(`${marca} ${cabecalho} ${tabelas} ${destaque}: ${f}`);
    }
    expect(abaixo).toEqual([]);
  });
});
