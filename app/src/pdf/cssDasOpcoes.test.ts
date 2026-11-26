import { createHash } from 'crypto';

import { MODELOS_PDF, PALETA_DE_DESTAQUE, valoresDoModelo, type ValoresPdf } from '../dominio/configuracaoPdf';
import { textosSemContraste } from './contrasteDoCss.apoioTeste';
import { cssDasOpcoes } from './cssDasOpcoes';
import { cssDaPrevia, cssDoDoc } from './html';

const sha = (texto: string) => createHash('sha256').update(texto).digest('hex');

const HOSTIL = 'red;}</style><script>alert(1)</script>';
const CORES = ['#C62828', '#FFEB3B', 'xx', '', null, undefined, HOSTIL, 'url(javascript:x)'];
const ATIVO = /url\(|@import|expression\(|javascript:|behavior:|<|>\s*script/i;

/** Uma cópia com um valor trocado (os modelos não mudam). */
function com<G extends keyof ValoresPdf, K extends keyof ValoresPdf[G]>(base: ValoresPdf, grupo: G, chave: K, valor: ValoresPdf[G][K]): ValoresPdf {
  const v = structuredClone(base);
  v[grupo][chave] = valor;
  return v;
}

describe('paridade com os temas de antes', () => {
  it.each(CORES)('CLASSICO com a marca %p não acrescenta nada', (cor) => {
    expect(cssDasOpcoes(valoresDoModelo('CLASSICO'), cor)).toBe('');
  });

  // SHA-256 do `cssDoTema` de antes (removido em 26/11 depois de este teste comparar as duas strings, caractere por caractere,
  // nestas cores e em vazio, nulo e hostil). Se quebrar, o visual de quem já escolheu Minimalista ou Marcante mudou.
  it.each([
    ['MINIMALISTA', '#C62828', '4c80bf64b5597e6c1ec4378fe5eacfe7087196e783982ff1b83eab31d5b8211f'],
    ['MINIMALISTA', '#FFEB3B', '7620d62c9c7394fa167a51bc9afc580382106086fa8c1df785952da27460b1e0'],
    ['MINIMALISTA', 'xx', '315d559f0743e2635db9dc6dcac973dee4601949b45a86811993fae5c3f9bf8b'],
    ['MARCANTE', '#C62828', 'bf0984cd9439011306a7c48c75f3e0287be9fffe3200be782e7ac09a62c4ae84'],
    ['MARCANTE', '#FFEB3B', '355c3672e70d3266a91bb592a94fd595446f1438f1f13ea792bcaba85010f751'],
    ['MARCANTE', 'xx', 'b232fc1a94314524e4cce7029ccfbf4a9fb52da93975753eb8661bab01e9a70c'],
  ])('%s com a marca %s sai igual ao tema de antes', (tema, cor, hash) => {
    expect(sha(cssDasOpcoes(valoresDoModelo(tema), cor))).toBe(hash);
  });

  it.each([null, undefined, '', HOSTIL])('marca %p cai no neutro como a "xx"', (cor) => {
    for (const tema of ['MINIMALISTA', 'MARCANTE']) expect(cssDasOpcoes(valoresDoModelo(tema), cor)).toBe(cssDasOpcoes(valoresDoModelo(tema), 'xx'));
  });
});

describe('cada opção muda o CSS só pelo trecho fixo dela', () => {
  const classico = valoresDoModelo('CLASSICO');
  const trocas: [string, ValoresPdf][] = [
    ['cores.destaque AZUL', com(classico, 'cores', 'destaque', 'AZUL')],
    ['texto.fonte SERIFADA', com(classico, 'texto', 'fonte', 'SERIFADA')],
    ['texto.fonte CONDENSADA', com(classico, 'texto', 'fonte', 'CONDENSADA')],
    ['texto.tamanho P', com(classico, 'texto', 'tamanho', 'P')],
    ['texto.tamanho G', com(classico, 'texto', 'tamanho', 'G')],
    ['cabecalho.estilo LINHA', com(classico, 'cabecalho', 'estilo', 'LINHA')],
    ['cabecalho.estilo CARTAO', com(classico, 'cabecalho', 'estilo', 'CARTAO')],
    ['cabecalho.logo CENTRO', com(classico, 'cabecalho', 'logo', 'CENTRO')],
    ['cabecalho.tamanhoLogo P', com(classico, 'cabecalho', 'tamanhoLogo', 'P')],
    ['cabecalho.tamanhoLogo G', com(classico, 'cabecalho', 'tamanhoLogo', 'G')],
    ['cabecalho.mostrarNome false', com(classico, 'cabecalho', 'mostrarNome', false)],
    ['tabelas.estilo LISTRADA', com(classico, 'tabelas', 'estilo', 'LISTRADA')],
    ['tabelas.estilo CARTOES', com(classico, 'tabelas', 'estilo', 'CARTOES')],
    ['tabelas.densidade COMPACTA', com(classico, 'tabelas', 'densidade', 'COMPACTA')],
    ['tabelas.densidade ESPACOSA', com(classico, 'tabelas', 'densidade', 'ESPACOSA')],
  ];

  it.each(trocas)('%s acrescenta regras ao Clássico', (_nome, v) => {
    expect(cssDasOpcoes(v, '#C62828')).not.toBe('');
  });

  it('as fontes são só do sistema e o tamanho M é o de hoje', () => {
    expect(cssDasOpcoes(com(classico, 'texto', 'fonte', 'SERIFADA'), '#C62828')).toBe('.doc { font-family: Georgia, "Times New Roman", serif; }\n');
    expect(cssDasOpcoes(com(classico, 'texto', 'fonte', 'CONDENSADA'), '#C62828')).toContain('"Arial Narrow", "Roboto Condensed", sans-serif');
  });

  it('esconder o nome só vale com logo (sem logo o documento ainda diz de quem é)', () => {
    expect(cssDasOpcoes(com(classico, 'cabecalho', 'mostrarNome', false), '#C62828')).toBe('.doc .faixa-marca.com-logo .faixa-nome { display: none; }\n');
  });

  it('destaque da paleta troca a cor da marca e cobre a faixa (que traz a marca no style)', () => {
    const css = cssDasOpcoes(com(classico, 'cores', 'destaque', 'VERDE'), '#C62828');
    expect(css).toContain('.doc th { color: #FFFFFF; background: #15803D; }');
    expect(css).toContain('.doc .faixa-marca { background: #15803D !important; color: #FFFFFF !important; }');
    expect(css).not.toContain('#C62828');
  });

  it('destaque igual à marca não acrescenta nada', () => {
    expect(cssDasOpcoes(com(classico, 'cores', 'destaque', 'AZUL'), '#2563EB')).toBe('');
  });

  it('o cabeçalho de tabela deriva do estilo do topo: FAIXA preenchido, LINHA e CARTAO leves', () => {
    const marcante = valoresDoModelo('MARCANTE');
    expect(cssDasOpcoes(com(marcante, 'cabecalho', 'estilo', 'FAIXA'), '#C62828')).not.toMatch(/\.doc th \{/);
    expect(cssDasOpcoes(com(classico, 'cabecalho', 'estilo', 'LINHA'), '#C62828')).toContain('.doc th { background: transparent; color: #333;');
    expect(cssDasOpcoes(com(classico, 'cabecalho', 'estilo', 'CARTAO'), '#C62828')).toContain('.doc th { background: #F3F4F6; color: #333;');
  });
});

describe('os seis modelos: contraste, nada ativo e prefixável pela prévia', () => {
  const destaques = PALETA_DE_DESTAQUE.map((p) => p.id);
  const casos = MODELOS_PDF.flatMap((m) => destaques.map((d) => [m.id, d] as const));

  it.each(casos)('%s com destaque %s', (modelo, destaque) => {
    for (const cor of CORES) {
      const opcoes = cssDasOpcoes(com(valoresDoModelo(modelo), 'cores', 'destaque', destaque), cor);
      expect(opcoes).not.toMatch(ATIVO);
      expect(opcoes).not.toContain('red;}');
      for (const regra of opcoes.split('\n').filter(Boolean)) expect(regra.startsWith('.doc')).toBe(true);
      // A prévia troca todo `.doc` por `.previa-pdf .doc`: nada das opções sobra sem prefixo.
      expect(cssDaPrevia(opcoes, 'teste').split('\n').filter((l) => l.startsWith('.doc'))).toEqual([]);
    }
    const amarela = cssDoDoc('#FFEB3B') + cssDasOpcoes(com(valoresDoModelo(modelo), 'cores', 'destaque', destaque), '#FFEB3B');
    expect(amarela).not.toMatch(/(^|[;\s{])color:\s*#FFEB3B/i);
    expect(textosSemContraste(amarela)).toEqual([]);
  });

  it('estilos de topo × tabelas × destaque com a marca amarela: nenhum texto abaixo de 4,5:1', () => {
    for (const estilo of ['FAIXA', 'LINHA', 'CARTAO'] as const) {
      for (const tabelas of ['LINHAS', 'LISTRADA', 'CARTOES'] as const) {
        for (const destaque of destaques) {
          const v = com(com(com(valoresDoModelo('CLASSICO'), 'cabecalho', 'estilo', estilo), 'tabelas', 'estilo', tabelas), 'cores', 'destaque', destaque);
          expect(textosSemContraste(cssDoDoc('#FFEB3B') + cssDasOpcoes(v, '#FFEB3B'))).toEqual([]);
        }
      }
    }
  });
});
