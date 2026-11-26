import type { Marca } from '../api/tipos';
import { MODELOS_PDF, PALETA_DE_DESTAQUE, type OpcoesPdf } from '../dominio/configuracaoPdf';
import { normalizarMobilidade } from '../dominio/mobilidade';
import { contraste } from '../tema/tokens';
import { textosSemContraste } from './contrasteDoCss.apoioTeste';
import { documentoDeExemploDeDieta, documentoDeExemploDeTreino } from './exemplos';
import { coresDoPdf, cssBase, faixaDaMarca, type Documento } from './html';
import { documentoCargas } from './pdfCargas';
import { documentoListaDeCompras } from './pdfListaDeCompras';
import { documentoMobilidade } from './pdfMobilidade';
import { FUNDO_LEVE } from './cssDosTemas';
import { TEMAS_PDF, temaValido } from './temas';

/** Os seis modelos em todos os geradores: o que muda é só o CSS do código; texto da marca e do usuário nunca entra nele. */

const MODELOS = MODELOS_PDF.map((m) => m.id);
const emitidoEm = new Date('2026-10-11T19:30:00Z');
const marcaBase: Marca = { id: 'm', nome: 'Consultoria de Exemplo', corPrimaria: '#C62828', fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl: null };
const base = { logoDataUri: null, aluno: 'Aluno de Exemplo', titulo: 'Plano', rodapePdf: null, emitidoEm };
const linhaCarga = { data: '2026-10-07', carga: 90, repeticoes: 6, etapas: '4+4 = 8', cargaVariavel: false, volume: { valor: 540, completo: true }, series: 5, semCarga: false, feitoSemCarga: false, observacoes: ['Observação'] };
const linhaDaLista = { chave: 'a', nome: 'Arroz', unidade: 'g' as const, quantidade: 1225, cru: true, bruto: false, semFator: false, naDieta: 1050, quantidadeCru: 420, fatorCorrecao: null, fatorCoccao: 2.5, grupo: null };

const GERADORES: Record<string, (m: Marca) => Documento> = {
  treino: (m) => documentoDeExemploDeTreino(m, emitidoEm),
  dieta: (m) => documentoDeExemploDeDieta(m, emitidoEm),
  mobilidade: (m) => documentoMobilidade({ ...base, marca: m, versao: 1, conteudo: normalizarMobilidade({ secoes: [{ uid: 's', titulo: 'Seção', itens: [{ uid: 'i', nome: 'Gato-camelo', prescricao: '2x30s', videoUrl: null }] }] }) }),
  cargas: (m) => documentoCargas({ ...base, marca: m, de: '2026-10-01', ate: '2026-10-14', divisoes: [{ chave: 'd', nome: 'Pernas', exercicios: [{ chave: 'x', nome: 'Mesa flexora', linhas: [linhaCarga] }] }] }),
  'lista de compras': (m) => documentoListaDeCompras({ ...base, marca: m, versao: 1, periodo: 'semana', opcoes: [], linhas: [linhaDaLista] }),
};
const NOMES = Object.keys(GERADORES);

/** Um valor diferente do padrão em cada opção. */
const NAO_PADRAO: OpcoesPdf = {
  cores: { destaque: 'AZUL' },
  texto: { fonte: 'SERIFADA', tamanho: 'G' },
  cabecalho: { estilo: 'CARTAO', logo: 'CENTRO', tamanhoLogo: 'G', mostrarNome: false },
  tabelas: { estilo: 'LISTRADA', densidade: 'ESPACOSA' },
};
const comDestaque = (id: string): OpcoesPdf => ({ cores: { destaque: id as never } });
const CASOS: [string, OpcoesPdf | undefined][] = [
  ['sem sobrescritas', undefined],
  ['sobrescritas não padrão', NAO_PADRAO],
  ...PALETA_DE_DESTAQUE.map((p): [string, OpcoesPdf] => [`destaque ${p.id}`, comDestaque(p.id)]),
];
const marcaDe = (modelo: string, opcoes?: OpcoesPdf, cor = '#C62828'): Marca => ({ ...marcaBase, corPrimaria: cor, temaPdf: modelo, opcoesPdf: opcoes });
const estrutura = (html: string) => [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)].map((t) => t[1] + [...t[2].replace(/"[^"]*"/g, '""').matchAll(/\s([a-zA-Z-]+)=/g)].map((a) => a[1]).join(','));

describe('lista de temas = os seis modelos', () => {
  it('TEMAS_PDF e temaValido seguem o domínio', () => {
    expect(TEMAS_PDF.map((t) => t.id)).toEqual(['CLASSICO', 'MINIMALISTA', 'MARCANTE', 'COMPACTO', 'ELEGANTE', 'ESPORTIVO']);
    for (const id of MODELOS) expect(temaValido(id)).toBe(id);
    expect(temaValido('OUTRO')).toBe('CLASSICO');
  });
});

describe.each(MODELOS)('modelo %s em todos os geradores', (modelo) => {
  describe.each(CASOS)('%s', (_caso, opcoes) => {
    it.each(NOMES)('%s: o CSS é o do modelo e das opções, sem nada ativo nem cor crua', (nome) => {
      const d = GERADORES[nome](marcaDe(modelo, opcoes));
      expect(d.css.startsWith(cssBase('#C62828', modelo, opcoes))).toBe(true);
      expect(d.css).not.toMatch(/url\(|@import|expression\(|javascript:|behavior:|<|>\s*script/i);
      expect(d.corpo).not.toContain('<script');
    });

    it.each(NOMES)('%s: o HTML tem a mesma estrutura do CLASSICO sem opções (a diferença é CSS)', (nome) => {
      const classico = GERADORES[nome](marcaDe('CLASSICO')).corpo;
      const d = GERADORES[nome](marcaDe(modelo, opcoes)).corpo;
      expect(estrutura(d)).toEqual(estrutura(classico));
    });

    it.each(NOMES)('%s: com a marca amarela (#FFEB3B) nenhum texto fica abaixo de 4,5:1', (nome) => {
      const d = GERADORES[nome](marcaDe(modelo, opcoes, '#FFEB3B'));
      // D7 (26/11): vale para o CLASSICO também; a dieta e as cargas deixaram de pintar número na cor crua da marca.
      expect(textosSemContraste(d.css, d.corpo)).toEqual([]);
    });
  });

  it('com as opções iguais às do modelo, o CSS é o mesmo (sobrescrita igual ao modelo não muda nada)', () => {
    expect(cssBase('#C62828', modelo, { cores: { destaque: 'MARCA' } })).toBe(cssBase('#C62828', modelo));
  });

  it('modelo desconhecido ou opção inválida cai no valor do modelo', () => {
    const hostil = { cores: { destaque: 'x;}body{display:none' }, texto: { fonte: '<b>' }, cabecalho: { estilo: 1 }, tabelas: { densidade: null } };
    expect(cssBase('#C62828', modelo, hostil)).toBe(cssBase('#C62828', modelo));
    expect(cssBase('#C62828', `${modelo}"><script>`)).toBe(cssBase('#C62828', 'CLASSICO'));
  });
});

describe('os modelos se distinguem', () => {
  it('cada modelo tem CSS próprio e o destaque e as opções também mudam o CSS', () => {
    expect(new Set(MODELOS.map((m) => cssBase('#C62828', m))).size).toBe(6);
    expect(cssBase('#C62828', 'CLASSICO', NAO_PADRAO)).not.toBe(cssBase('#C62828', 'CLASSICO'));
    expect(cssBase('#C62828', 'CLASSICO', comDestaque('AZUL'))).toContain('#2563EB');
  });
});

describe('dieta e cargas seguem o estilo do cabeçalho e o destaque, não o nome do modelo', () => {
  const cargas = (m: Marca) => GERADORES.cargas(m);
  const dieta = (m: Marca) => GERADORES.dieta(m);

  it.each([
    ['MINIMALISTA', 'LINHA'],
    ['ELEGANTE', 'LINHA'],
    ['MARCANTE', 'CARTAO'],
    ['ESPORTIVO', 'CARTAO'],
    ['CLASSICO', 'FAIXA'],
    ['COMPACTO', 'FAIXA'],
  ])('%s (cabeçalho %s): as regras próprias das cargas e da dieta saem do estilo', (modelo, estilo) => {
    const c = cargas(marcaDe(modelo)).css;
    const d = dieta(marcaDe(modelo)).css;
    expect(c.includes('.doc .titulo-divisao { background: none;')).toBe(estilo === 'LINHA');
    expect(c.includes('.doc .titulo-divisao .pequeno { color: inherit; }')).toBe(estilo === 'CARTAO');
    expect(d.includes('.doc .opcao > .cab { background: none !important;')).toBe(estilo === 'LINHA');
    expect(d.includes('.doc .barra { display: none; }')).toBe(estilo === 'CARTAO');
  });

  it('trocar o estilo do cabeçalho de um modelo troca as regras próprias da dieta e das cargas', () => {
    const marca = marcaDe('CLASSICO', { cabecalho: { estilo: 'LINHA' } });
    expect(cargas(marca).css).toContain('.doc .titulo-divisao { background: none;');
    expect(dieta(marca).css).toContain('.doc .opcao > .cab { background: none !important;');
  });

  it('o destaque pinta o que o gerador desenha por conta própria (barras da dieta e título das cargas)', () => {
    const azul = marcaDe('MINIMALISTA', comDestaque('AZUL'));
    expect(dieta(azul).corpo).toContain('<div class="barra" style="background:#2563EB"></div>');
    expect(cargas(azul).css).toContain('border-bottom: 1px solid #2563EB');
    expect(cargas(marcaDe('MARCANTE', comDestaque('BRONZE'))).css).toContain('.doc .titulo-divisao { background: #9A5B13;');
  });

  it('com marca clara, todo modelo (o Clássico também, D7) usa texto de 4,5:1 e nunca a cor crua da marca', () => {
    for (const modelo of MODELOS) {
      const c = coresDoPdf(marcaDe(modelo, undefined, '#FFEB3B'));
      expect(c.texto).not.toBe('#FFEB3B');
      expect(c.textoNoCinza).not.toBe('#FFEB3B');
      expect(contraste(c.texto, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.textoNoCinza, FUNDO_LEVE)).toBeGreaterThanOrEqual(4.5);
      expect(c.sobreFundo).toBe('#000000');
    }
  });

  it('com marca de texto escuro o Clássico segue com a cor da marca (nada mudou para quem já passava)', () => {
    expect(coresDoPdf(marcaDe('CLASSICO'))).toMatchObject({ texto: '#C62828', textoNoCinza: '#C62828', fundo: '#C62828' });
  });
});

describe('cabeçalho (D6) em todos os modelos e opções', () => {
  const comLogo = 'data:image/png;base64,AAAA';

  it.each(MODELOS)('%s: a faixa é a mesma no HTML; logo e nome continuam nele (mostrarNome só esconde por CSS, e só com logo)', (modelo) => {
    for (const opcoes of [undefined, NAO_PADRAO, { cabecalho: { mostrarNome: false } } satisfies OpcoesPdf]) {
      const marca = marcaDe(modelo, opcoes);
      const faixa = faixaDaMarca(marca, comLogo);
      expect(faixa).toBe(faixaDaMarca(marcaDe('CLASSICO'), comLogo));
      expect(faixa).toContain('Consultoria de Exemplo');
      expect(faixa).toContain('<img src="data:image/png;base64,AAAA"');
    }
  });

  it('com mostrarNome desligado o nome só some quando há logo; sem logo o CSS não o esconde', () => {
    const css = cssBase('#C62828', 'CLASSICO', { cabecalho: { mostrarNome: false } });
    expect(css).toMatch(/\.faixa-marca\.com-logo \.faixa-nome \{ display: none; \}/);
    expect(css).not.toMatch(/(^|\n)\.doc \.faixa-nome \{ display: none/);
  });

  it.each(NOMES)('%s: o cabeçalho obrigatório (tipo, aluno, emitido em) sai em qualquer modelo', (nome) => {
    for (const modelo of MODELOS) {
      const corpo = GERADORES[nome](marcaDe(modelo, NAO_PADRAO)).corpo;
      expect(corpo).toContain('class="topo"');
      expect(corpo).toContain('<h1>');
      expect(corpo).toContain('Emitido em');
    }
  });
});
