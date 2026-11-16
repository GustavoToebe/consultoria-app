import { createHash } from 'crypto';

import type { Marca } from '../api/tipos';
import { textosSemContraste } from './contrasteDoCss.apoioTeste';
import { documentoDeExemploDeDieta, documentoDeExemploDeTreino } from './exemplos';
import { cssBase, cssDoDoc } from './html';
import { documentoCargas } from './pdfCargas';
import { TEMAS_PDF, temaValido } from './temas';

const marca: Marca = { id: 'm', nome: 'Consultoria de Exemplo', corPrimaria: '#C62828', fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl: null };
const emitidoEm = new Date('2026-10-11T19:30:00Z');
const sha = (texto: string) => createHash('sha256').update(texto).digest('hex');

describe('temaValido e a lista de temas', () => {
  it('a lista é fechada: três temas, cada um com nome e descrição em português', () => {
    expect(TEMAS_PDF.map((t) => t.id)).toEqual(['CLASSICO', 'MINIMALISTA', 'MARCANTE']);
    for (const t of TEMAS_PDF) {
      expect(t.nome.length).toBeGreaterThan(2);
      expect(t.descricao.length).toBeGreaterThan(10);
    }
  });

  it.each(TEMAS_PDF.map((t) => t.id))('%s é aceito como está', (id) => {
    expect(temaValido(id)).toBe(id);
  });

  it.each([undefined, null, '', 'classico', 'Classico', 'OUTRO', 'CLASSICO ', 0, 1, true, {}, [], ['MARCANTE'], 'MARCANTE; } body { display:none', '"><script>alert(1)</script>'])(
    'valor %p cai em CLASSICO',
    (valor) => {
      expect(temaValido(valor)).toBe('CLASSICO');
    },
  );
});

describe('o CSS do CLASSICO não mudou um caractere', () => {
  // SHA-256 do `cssBase` de antes dos temas (16/11/2026), por cor. Se este teste quebrar, o visual de hoje mudou.
  it.each([
    ['#C62828', '751d931847090a32c4f352b09b1a8f306ddfad5fd8a49d095e8c93ab69433e51'],
    ['#FFEB3B', '8b1e52cc4cb9d7652fbe375cab5484f92e8b034834e6e6886b9b650ad7e4e7ef'],
    ['xx', '7be22e5e6bccf5f1d8ce2e153e83dec6f3233d63d4c5afb28b3b1941d906c557'],
  ])('cssBase(%s) é o de antes', (cor, hash) => {
    expect(sha(cssBase(cor))).toBe(hash);
    expect(sha(cssBase(cor, 'CLASSICO'))).toBe(hash);
  });

  it.each([undefined, null, 'OUTRO', 'minimalista', 7])('tema %p desconhecido ou ausente dá o mesmo CSS do CLASSICO', (tema) => {
    expect(cssBase('#C62828', tema)).toBe(cssBase('#C62828', 'CLASSICO'));
    expect(cssDoDoc('#C62828', tema)).toBe(cssDoDoc('#C62828', 'CLASSICO'));
  });

  it('os geradores com tema ausente ou CLASSICO saem como antes (CSS e HTML)', () => {
    const linha = { data: '2026-10-07', carga: 90, repeticoes: 6, etapas: '4+4 = 8', cargaVariavel: false, volume: { valor: 540, completo: true }, series: 5, semCarga: false, feitoSemCarga: false, observacoes: ['Observação do aluno'] };
    const cargas = (m: Marca) =>
      documentoCargas({
        marca: m, logoDataUri: null, aluno: 'Aluno de Exemplo', rodapePdf: null, emitidoEm, de: '2026-10-01', ate: '2026-10-14',
        divisoes: [{ chave: 'd', nome: 'Quarta - Pernas', exercicios: [{ chave: 'x', nome: 'Mesa flexora', linhas: [linha, { ...linha, data: '2026-10-14', carga: null, etapas: null }] }] }],
      });
    const esperado = {
      treino: '8a3967f877e60a3fa2894253f5e00072f40610d32baf534ed87bbdd3ab768c5a',
      dieta: '09036bffd5258da741783de221838a366c2a4a146607df86ae22687b79c0f543',
      cargas: '836b3c4e2132b5749596bf531fac767b8dab21d7ca0dcd6ebc932b545a156098',
    };
    for (const m of [marca, { ...marca, temaPdf: 'CLASSICO' }, { ...marca, temaPdf: 'inexistente' }, { ...marca, temaPdf: null }]) {
      expect(sha(JSON.stringify(documentoDeExemploDeTreino(m, emitidoEm)))).toBe(esperado.treino);
      expect(sha(JSON.stringify(documentoDeExemploDeDieta(m, emitidoEm)))).toBe(esperado.dieta);
      expect(sha(JSON.stringify(cargas(m)))).toBe(esperado.cargas);
    }
  });
});

describe('divisão do cssBase (D11)', () => {
  it.each(TEMAS_PDF.map((t) => t.id))('%s: cssBase = regras globais + regras do .doc, e a parte do .doc não pinta a página', (tema) => {
    const doc = cssDoDoc('#C62828', tema);
    const tudo = cssBase('#C62828', tema);
    expect(tudo.endsWith(doc)).toBe(true);
    const globais = tudo.slice(0, tudo.length - doc.length);
    expect(globais).toContain('@page { size: A4; margin: 14mm; }');
    expect(globais).toContain('html, body { background: #fff; color: #111; margin: 0; }');
    expect(globais).not.toContain('.doc');
    expect(doc).not.toContain('@page');
    expect(doc).not.toMatch(/(^|\n)\s*(html|body|\*)[ ,{]/);
    expect(doc.startsWith('.doc { font-family')).toBe(true);
  });
});

describe('o CSS dos temas vem só do código', () => {
  const ruim = 'red;}</style><script>alert(1)</script>';
  it.each(TEMAS_PDF.map((t) => t.id))('%s: nada ativo no CSS, nem com cor hostil', (tema) => {
    for (const cor of ['#C62828', '#FFEB3B', ruim, '', 'url(javascript:x)']) {
      const css = cssBase(cor, tema);
      expect(css).not.toMatch(/url\(|@import|expression\(|javascript:|behavior:|<|>\s*script/i);
      expect(css).not.toContain('red;}');
    }
  });
});

describe('contraste com a marca amarela (#FFEB3B) nos três temas', () => {
  it('o verificador pega texto amarelo sobre branco e aceita texto escuro sobre o amarelo', () => {
    expect(textosSemContraste('.doc h1 { color: #FFEB3B; }')).toHaveLength(1);
    expect(textosSemContraste('.doc .topo { background: #FFEB3B; color: #FFFFFF; }')).toHaveLength(1);
    expect(textosSemContraste('', '<i style="color:#FFEB3B">x</i>')).toHaveLength(1);
    expect(textosSemContraste('.doc .topo { background: #FFEB3B; color: #000000; }', '<i style="background:#FFEB3B;color:#000000">x</i>')).toEqual([]);
  });

  it.each(TEMAS_PDF.map((t) => t.id))('%s: nenhum texto abaixo de 4,5:1 no CSS do documento', (tema) => {
    const css = cssBase('#FFEB3B', tema);
    expect(css).not.toMatch(/(^|[;\s{])color:\s*#FFEB3B/i);
    expect(textosSemContraste(css)).toEqual([]);
  });

  it('MINIMALISTA e MARCANTE: o texto do cabeçalho segue a regra (texto escuro/da marca no limpo, textoSobre no preenchido)', () => {
    expect(cssBase('#FFEB3B', 'MINIMALISTA')).toMatch(/\.doc th \{ background: transparent; color: #333;/);
    expect(cssBase('#FFEB3B', 'MARCANTE')).toMatch(/\.doc \.topo \{ background: #FFEB3B; color: #000000;/);
    expect(cssBase('#C62828', 'MARCANTE')).toMatch(/\.doc \.topo \{ background: #C62828; color: #FFFFFF;/);
    expect(cssBase('#C62828', 'MARCANTE')).toMatch(/\.doc \.topo h1, \.doc \.topo \.pequeno \{ color: #FFFFFF; \}/);
  });
});
