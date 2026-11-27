import { corDaMarca, corDeTextoDaMarca } from '../pdf/html';
import { contraste, textoSobre } from '../tema/tokens';
import {
  colunasDaGaleria,
  coresDoDestaque,
  contarAlteracoes,
  definir,
  eDoModelo,
  MODELOS_PDF,
  modeloValido,
  normalizar,
  PALETA_DE_DESTAQUE,
  personalizado,
  resolver,
  restaurar,
  resumoDasAlteracoes,
  trocarModelo,
  valoresDoModelo,
  type ConfigPdf,
} from './configuracaoPdf';
import { PALETAS } from './paletas';

const ids = MODELOS_PDF.map((m) => m.id);
const classico: ConfigPdf = { modelo: 'CLASSICO', sobrescritas: {} };

describe('modelos', () => {
  it('são os seis, com valores completos e todos diferentes entre si', () => {
    expect(ids).toEqual(['CLASSICO', 'MINIMALISTA', 'MARCANTE', 'COMPACTO', 'ELEGANTE', 'ESPORTIVO']);
    const json = ids.map((id) => JSON.stringify(valoresDoModelo(id)));
    expect(new Set(json).size).toBe(6);
    for (const id of ids) expect(normalizar(valoresDoModelo(id))).toEqual(valoresDoModelo(id));
  });

  it('modelo desconhecido cai no Clássico', () => {
    for (const x of ['', 'X', null, undefined, 3, {}]) expect(modeloValido(x)).toBe('CLASSICO');
    expect(resolver('NAO_EXISTE', {})).toEqual(valoresDoModelo('CLASSICO'));
  });

  it('valoresDoModelo devolve cópia', () => {
    valoresDoModelo('CLASSICO').texto.tamanho = 'G';
    expect(valoresDoModelo('CLASSICO').texto.tamanho).toBe('M');
  });

  it('os três de hoje descrevem o visual atual: faixa/linha/cartão, fonte e tamanho do sistema', () => {
    expect(resolver('CLASSICO', {}).cabecalho.estilo).toBe('FAIXA');
    expect(resolver('MINIMALISTA', {}).cabecalho.estilo).toBe('LINHA');
    expect(resolver('MARCANTE', {}).cabecalho.estilo).toBe('CARTAO');
    expect(resolver('MARCANTE', {}).tabelas.estilo).toBe('CARTOES');
    for (const id of ['CLASSICO', 'MINIMALISTA', 'MARCANTE']) {
      const v = resolver(id, {});
      expect([v.cores.destaque, v.texto.fonte, v.texto.tamanho, v.cabecalho.tamanhoLogo, v.tabelas.densidade]).toEqual(['MARCA', 'SEM_SERIFA', 'M', 'M', 'NORMAL']);
    }
  });
});

describe('normalizar', () => {
  it('descarta chave, grupo e valor desconhecidos e mantém o válido', () => {
    expect(
      normalizar({
        cores: { destaque: 'AZUL', fundo: 'AZUL' },
        texto: { fonte: 'COMIC', tamanho: 'G' },
        cabecalho: { mostrarNome: 'sim', logo: 'CENTRO' },
        tabelas: 'LINHAS',
        extra: { x: 1 },
      }),
    ).toEqual({ cores: { destaque: 'AZUL' }, texto: { tamanho: 'G' }, cabecalho: { logo: 'CENTRO' } });
  });

  it('booleano só aceita boolean', () => {
    expect(normalizar({ cabecalho: { mostrarNome: false } })).toEqual({ cabecalho: { mostrarNome: false } });
    expect(normalizar({ cabecalho: { mostrarNome: 0 } })).toEqual({});
  });

  it('entrada que não é objeto vira vazio; texto JSON é lido', () => {
    for (const x of [null, undefined, 1, 'x', '[1]', '{quebrado', [], true]) expect(normalizar(x)).toEqual({});
    expect(normalizar('{"texto":{"tamanho":"P"}}')).toEqual({ texto: { tamanho: 'P' } });
  });

  it('não herda do protótipo nem o polui', () => {
    const lixo = JSON.parse('{"__proto__":{"x":1},"cores":{"__proto__":{"destaque":"AZUL"}},"constructor":{"a":1}}');
    expect(normalizar(lixo)).toEqual({});
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe('resolver', () => {
  it('modelo ⊕ sobrescritas; valor desconhecido cai no do modelo', () => {
    const v = resolver('ELEGANTE', { texto: { fonte: 'DESCONHECIDA', tamanho: 'G' }, tabelas: { densidade: 'COMPACTA' } });
    expect(v.texto).toEqual({ fonte: 'SERIFADA', tamanho: 'G' });
    expect(v.tabelas.densidade).toBe('COMPACTA');
    expect(v.cabecalho.logo).toBe('CENTRO');
  });

  it('não altera o modelo', () => {
    resolver('CLASSICO', { texto: { tamanho: 'G' } });
    expect(valoresDoModelo('CLASSICO').texto.tamanho).toBe('M');
  });
});

describe('personalização', () => {
  it('sobrescrita igual ao modelo não conta como alteração', () => {
    const c: ConfigPdf = { modelo: 'CLASSICO', sobrescritas: { texto: { tamanho: 'M' }, cores: { destaque: 'AZUL' } } };
    expect(contarAlteracoes(c)).toBe(1);
    expect(personalizado(c)).toBe(true);
    expect(eDoModelo({ modelo: 'CLASSICO', sobrescritas: { texto: { tamanho: 'M' } } })).toBe(true);
    expect(eDoModelo(classico)).toBe(true);
  });

  it('definir grava a diferença e remove ao voltar ao valor do modelo', () => {
    const a = definir(classico, 'texto', 'tamanho', 'G');
    expect(a.sobrescritas).toEqual({ texto: { tamanho: 'G' } });
    expect(classico.sobrescritas).toEqual({});
    const b = definir(a, 'cabecalho', 'mostrarNome', false);
    expect(contarAlteracoes(b)).toBe(2);
    expect(definir(definir(b, 'texto', 'tamanho', 'M'), 'cabecalho', 'mostrarNome', true)).toEqual(classico);
  });

  it('trocarModelo zera as sobrescritas e restaurar volta ao modelo', () => {
    const c = definir(classico, 'cores', 'destaque', 'BRONZE');
    expect(trocarModelo('MARCANTE')).toEqual({ modelo: 'MARCANTE', sobrescritas: {} });
    expect(trocarModelo('XX')).toEqual(classico);
    expect(restaurar(c)).toEqual(classico);
    expect(resolver(restaurar(c).modelo, restaurar(c).sobrescritas)).toEqual(valoresDoModelo('CLASSICO'));
  });

  it('resumo em português', () => {
    let c = classico;
    expect(resumoDasAlteracoes(c)).toBe('Sem alterações');
    c = definir(c, 'texto', 'fonte', 'SERIFADA');
    expect(resumoDasAlteracoes(c)).toBe('1 alteração: Fonte');
    c = definir(c, 'texto', 'tamanho', 'G');
    expect(resumoDasAlteracoes(c)).toBe('2 alterações: Fonte e Tamanho do texto');
    c = definir(c, 'tabelas', 'densidade', 'COMPACTA');
    expect(resumoDasAlteracoes(c)).toBe('3 alterações: Fonte, Tamanho do texto e Densidade das tabelas');
    c = definir(c, 'cabecalho', 'logo', 'CENTRO');
    expect(resumoDasAlteracoes(c)).toBe('4 alterações: Fonte, Tamanho do texto e mais 2');
  });
});

describe('paleta de destaque', () => {
  const fixas = PALETA_DE_DESTAQUE.filter((p) => p.cor !== null);

  it('tem as 8 cores: marca (sem cor própria), Grafite e 6 de dominio/paletas.ts', () => {
    expect(PALETA_DE_DESTAQUE.map((p) => p.nome)).toEqual(['Cor da marca', 'Grafite', 'Azul', 'Índigo', 'Verde', 'Turquesa', 'Magenta', 'Bronze']);
    expect(PALETA_DE_DESTAQUE[0].cor).toBeNull();
    for (const p of fixas.slice(1)) expect(PALETAS.find((x) => x.nome === p.nome)?.cor).toBe(p.cor);
  });

  it.each(fixas)('$nome: texto sobre o papel branco passa de 4,5:1 e o fundo leva texto legível', (p) => {
    expect(p.cor).toMatch(/^#[0-9A-F]{6}$/);
    expect(contraste(p.cor as string, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    const c = coresDoDestaque(p.id, '#FFEB3B');
    expect(c).toEqual({ fundo: p.cor, texto: p.cor, sobreFundo: textoSobre(p.cor as string) });
    expect(contraste(c.sobreFundo, c.fundo)).toBeGreaterThanOrEqual(4.5);
  });

  it('cor fixa não depende da marca', () => {
    expect(coresDoDestaque('AZUL', '#FF0000')).toEqual(coresDoDestaque('AZUL', null));
  });

  it.each(['#FFEB3B', '#FFFF00', '#1E88E5', '#000000', '#C62828'])('MARCA %s confere com corDeTextoDaMarca e textoSobre do PDF', (marca) => {
    const c = coresDoDestaque('MARCA', marca);
    expect(c.fundo).toBe(corDaMarca(marca));
    expect(c.texto).toBe(corDeTextoDaMarca(marca));
    expect(c.sobreFundo).toBe(textoSobre(marca));
    expect(contraste(c.texto, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('marca amarela clara escurece no texto e mantém o fundo', () => {
    const c = coresDoDestaque('MARCA', '#FFEB3B');
    expect(c.fundo).toBe('#FFEB3B');
    expect(c.texto).not.toBe('#FFEB3B');
    expect(c.sobreFundo).toBe('#000000');
  });

  it('marca inválida usa o neutro como corDaMarca; destaque desconhecido cai na marca', () => {
    expect(coresDoDestaque('MARCA', 'vermelho').fundo).toBe(corDaMarca('vermelho'));
    expect(coresDoDestaque('MARCA', null).fundo).toBe(corDaMarca(null));
    expect(coresDoDestaque('XX', '#FFEB3B').fundo).toBe('#FFEB3B');
  });
});

describe('colunasDaGaleria', () => {
  it('1, 2 ou 3 colunas (divisores de 6), sem passar de 3', () => {
    expect([0, 350, 390, 415].map(colunasDaGaleria)).toEqual([1, 1, 1, 1]);
    expect([416, 500, 631].map(colunasDaGaleria)).toEqual([2, 2, 2]);
    expect([632, 700, 1100, 3000].map(colunasDaGaleria)).toEqual([3, 3, 3, 3]);
  });
});
