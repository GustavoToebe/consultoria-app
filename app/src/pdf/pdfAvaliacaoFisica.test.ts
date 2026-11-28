import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import type { Marca } from '../api/tipos';
import { medidasVazias } from '../dominio/avaliacaoFisica';
import { compararAvaliacoes } from '../dominio/comparacaoDeAvaliacoes';
import { MARCADOR_DO_TEMA, temMarcador, textosSemContraste } from './contrasteDoCss.apoioTeste';
import { cssBase, documentoCompleto } from './html';
import { documentoAvaliacaoFisica, type DadosPdfAvaliacaoFisica } from './pdfAvaliacaoFisica';
import { TEMAS_PDF } from './temas';

/** O gráfico sai como `<img src="data:image/svg+xml;base64,...">`: devolve o SVG decodificado (ou nulo sem imagem). */
function svgDoCorpo(corpo: string): string | null {
  const m = /<img alt="[^"]*" src="data:image\/svg\+xml;base64,([A-Za-z0-9+/]+={0,2})"/.exec(corpo);
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : null;
}

const marca = { nome: 'Consultoria <Fictícia>', corPrimaria: '#123456' } as unknown as Marca;

function avaliacao(id: string, data: string, parcial: Partial<MedidasCorporais>, pesoKg: number | null, observacao: string | null = null): AvaliacaoFisica {
  return { id, data, medidas: { ...medidasVazias(), ...parcial }, observacao, pesoKg, versao: 0, criadoEm: '', alteradoEm: '' };
}

const todas = [
  avaliacao('a', '2026-07-01', { cintura: 90, quadril: 100, bracoDireito: 35 }, 82, 'Medida <b>fictícia</b>'),
  avaliacao('b', '2026-09-01', { cintura: 85.5, bracoDireito: 35 }, null),
  avaliacao('c', '2026-10-01', { cintura: 85.5, bracoDireito: 36.2, coxaDireita: 60 }, 80, 'Segunda <script>alert("x")</script> & \'aspas\''),
  avaliacao('d', '2026-11-01', { cintura: 84, bracoDireito: 36.2, coxaDireita: 59.2 }, 79.5),
];

function gerar(escolhidas: string[], extra: Partial<DadosPdfAvaliacaoFisica> = {}) {
  return documentoAvaliacaoFisica({
    marca,
    logoDataUri: null,
    aluno: 'Aluno <script>alert(1)</script>',
    avaliacoes: todas,
    escolhidas,
    emitidoEm: new Date('2026-11-13T12:00:00Z'),
    ...extra,
  });
}

/** Todo texto que a `compararAvaliacoes` mostra tem de estar no PDF, na ordem. */
function esperadoDaTela(escolhidas: string[]): string[] {
  const c = compararAvaliacoes(todas, escolhidas);
  if (c.estado !== 'ok') throw new Error('inválido');
  return [
    ...c.colunas.map((col) => col.dataTexto),
    c.referencia,
    ...c.grupos.flatMap((g) => [g.titulo, ...g.itens.flatMap((i) => [i.rotulo, ...i.celulas.map((x) => x.texto), i.variacao.texto])]),
  ];
}

describe('PDF da avaliação física', () => {
  it.each([
    ['2 datas', ['a', 'b']],
    ['3 datas', ['a', 'b', 'c']],
    ['4 datas, fora de ordem', ['d', 'b', 'a', 'c']],
  ])('conteúdo igual ao da comparação da tela com %s', (_nome, ids) => {
    const { corpo } = gerar(ids);
    for (const t of esperadoDaTela(ids)) expect(corpo).toContain(t);
    // As linhas saem na mesma ordem dos grupos da tela.
    const rotulos = esperadoDaTela(ids).filter((t) => /^[A-ZÁ-Ú][\p{L} ]+$/u.test(t) && !/\d/.test(t));
    const posicoes = rotulos.map((r) => corpo.indexOf(`<strong>${r}</strong>`)).filter((p) => p >= 0);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
    // Títulos de grupo na ordem Tronco, Braços, Pernas (só os que têm medida, como na tela).
    const grupos = ['Tronco', 'Braços', 'Pernas'].map((t) => corpo.indexOf(`<h3>${t}</h3>`)).filter((p) => p >= 0);
    expect(grupos.length).toBe(compararAvaliacoes(todas, ids).estado === 'ok' ? (ids.length === 2 ? 2 : 3) : 0);
    expect(grupos).toEqual([...grupos].sort((a, b) => a - b));
    expect(corpo).toContain('Comparativo de circunferências');
    expect(corpo).toContain('Medida (cm)');
    expect(corpo).toContain('Variação');
  });

  it('datas em ordem cronológica no cabeçalho, mesmo com a seleção fora de ordem', () => {
    const { corpo } = gerar(['c', 'a', 'b']);
    const cab = corpo.slice(corpo.indexOf('<thead>'), corpo.indexOf('</thead>'));
    expect(cab.indexOf('>01/07<')).toBeLessThan(cab.indexOf('>01/09<'));
    expect(cab.indexOf('>01/09<')).toBeLessThan(cab.indexOf('>01/10<'));
    expect(cab).not.toContain('2026'); // mesmo ano: dd/mm (D11)
    expect(corpo).toContain('primeira e última datas selecionadas');
  });

  it('datas de anos diferentes: cabeçalho da tabela e eixo do gráfico levam o ano; no mesmo ano o eixo é dd/mm', () => {
    const virada = [avaliacao('x', '2025-11-01', { cintura: 90, bracoDireito: 34 }, null), avaliacao('y', '2026-02-01', { cintura: 88, bracoDireito: 35 }, null)];
    const { corpo } = gerar(['x', 'y'], {
      avaliacoes: virada,
      grafico: { rotulo: 'Braço direito', unidade: 'cm', pontos: [{ data: '2025-11-01', valor: 34 }, { data: '2026-02-01', valor: 35 }] },
    });
    const cab = corpo.slice(corpo.indexOf('<thead>'), corpo.indexOf('</thead>'));
    expect(cab).toContain('>01/11/2025<');
    expect(cab).toContain('>01/02/2026<');
    expect(corpo).toContain('Variação = 01/02/2026 menos 01/11/2025.');
    const svg = svgDoCorpo(corpo) as string;
    expect(svg).toContain('>01/11/2025<');
    expect(svg).toContain('>01/02/2026<');

    const mesmoAno = svgDoCorpo(gerar(['a', 'b'], { grafico: { rotulo: 'Cintura', unidade: 'cm', pontos: [{ data: '2026-07-01', valor: 90 }, { data: '2026-09-01', valor: 85 }] } }).corpo) as string;
    expect(mesmoAno).toContain('>01/07<');
    expect(mesmoAno).toContain('>01/09<');
    expect(mesmoAno).not.toContain('2026');
  });

  it('variação com sinal escrito, igual e indisponível; medida ausente escrita', () => {
    const { corpo } = gerar(['a', 'b', 'c']);
    expect(corpo).toContain('−4,5 cm'); // cintura 90 → 85,5
    expect(corpo).toContain('+1,2 cm'); // braço direito 35 → 36,2
    expect(corpo).toContain('Não registrada'); // quadril só em a, coxa só em c
    expect(corpo).toContain('Indisponível'); // quadril: falta a última ponta
    const iguais = gerar(['b', 'c'], { avaliacoes: [todas[1], avaliacao('c', '2026-10-01', { cintura: 85.5, bracoDireito: 35 }, null)] });
    expect(iguais.corpo).toContain('0,0 cm');
    expect(iguais.corpo).not.toContain('+0,0');
  });

  it('variação embaixo de cada valor, a mesma do histórico da tela: desde a anterior com a medida, "Primeira", "0,0" sem seta', () => {
    const { corpo } = gerar(['a', 'c'], { meta: 'REDUZIR' });
    // Cintura: em 01/07 é a primeira; em 01/10 a anterior é 01/09 (fora da tabela), 85,5 → 85,5.
    expect(corpo).toContain('90,0 cm<div class="var">Primeira</div>');
    expect(corpo).toContain('85,5 cm<div class="var">0,0</div>');
    expect(corpo).not.toContain('▲ 0,0');
    // Braço sem meta: neutro mesmo com a meta do aluno.
    expect(corpo).toContain('36,2 cm<div class="var">▲ 1,2</div>');
    // Peso de 01/10: a anterior com peso é 01/07 (01/09 não tem), 82 → 80, a favor de reduzir.
    expect(corpo).toContain('80 kg<div class="var positivo">▼ 2,0</div>');
    // Medida não registrada: só o "Não registrada", sem variação embaixo.
    expect(corpo).not.toMatch(/Não registrada<div/);
    expect(corpo).toContain('Embaixo de cada valor, a diferença desde a avaliação anterior');
  });

  it('a cor da meta só em peso, cintura, abdômen e quadril; sem meta tudo neutro', () => {
    expect(gerar(['c', 'd'], { meta: 'REDUZIR' }).corpo).toContain('84,0 cm<div class="var positivo">▼ 1,5</div>');
    expect(gerar(['c', 'd'], { meta: 'AUMENTAR' }).corpo).toContain('84,0 cm<div class="var problema">▼ 1,5</div>');
    expect(gerar(['c', 'd'], { meta: 'REDUZIR' }).corpo).toContain('59,2 cm<div class="var">▼ 0,8</div>');
    const semMeta = gerar(['c', 'd']).corpo;
    expect(semMeta).not.toContain('var positivo');
    expect(semMeta).not.toContain('var problema');
  });

  it('peso do dia fica fora dos grupos, informativo, e sem peso nada aparece', () => {
    const { corpo } = gerar(['a', 'b', 'c']);
    expect(corpo).toContain('Peso do dia (informativo)');
    expect(corpo.indexOf('Pernas')).toBeLessThan(corpo.indexOf('Peso do dia'));
    expect(corpo).toContain('82 kg');
    expect(corpo).toContain('−2,0 kg'); // 82 → 80, com as casas do Peso ("+1,0 kg", nunca "+1 kg")
    const semPeso = gerar(['b', 'c'], { avaliacoes: [todas[1], avaliacao('c', '2026-10-01', { cintura: 85 }, null)] });
    expect(semPeso.corpo).not.toContain('Peso do dia');
  });

  it('observação por data, só as preenchidas, "dd/mm/aaaa: texto", escapada', () => {
    const { corpo } = gerar(['a', 'b', 'c']);
    expect(corpo).toContain('<strong>01/07/2026</strong>: Medida &lt;b&gt;fictícia&lt;/b&gt;');
    expect(corpo).toContain('<strong>01/10/2026</strong>: Segunda &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;aspas&#39;');
    expect(corpo).not.toContain('<strong>01/09/2026</strong>:');
    expect(gerar(['b', 'd']).corpo).not.toContain('Observações');
  });

  it('escapa nome, marca, observação e rótulos do gráfico', () => {
    const { corpo, titulo } = gerar(['a', 'c'], {
      grafico: { rotulo: 'Braço <i>x</i>', unidade: 'cm', pontos: [{ data: '2026-07-01', valor: 35 }], serieB: { rotulo: '"E" <u>', pontos: [{ data: '2026-07-01', valor: 34 }] } },
    });
    expect(corpo).not.toContain('<script>');
    expect(corpo).not.toContain('<i>');
    expect(corpo).not.toContain('<u>');
    const svg = svgDoCorpo(corpo) as string;
    expect(svg).not.toContain('<i>');
    expect(svg).not.toContain('<u>');
    expect(svg).toContain('Braço &lt;i&gt;x&lt;/i&gt; e &quot;E&quot; &lt;u&gt; (cm)');
    expect(corpo).toContain('Aluno &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(corpo).toContain('Consultoria &lt;Fictícia&gt;');
    expect(titulo).toContain('<script>'); // o título vai escapado por documentoCompleto
    expect(documentoCompleto(gerar(['a', 'c']))).not.toContain('<title>Avaliação física - Aluno <script>');
  });

  it('gráfico: sem ele não há imagem; com ele, `<img>` com SVG estático em base64, limites, pontos reais e legenda das duas séries', () => {
    expect(gerar(['a', 'b']).corpo).not.toContain('<img');
    expect(gerar(['a', 'b']).corpo).not.toContain('<svg');
    const { corpo } = gerar(['a', 'b'], {
      grafico: {
        rotulo: 'Braço direito',
        unidade: 'cm',
        pontos: [{ data: '2026-07-01', valor: 35 }, { data: '2026-09-01', valor: 36.2 }, { data: '2026-11-01', valor: 37 }],
        serieB: { rotulo: 'Braço esquerdo', pontos: [{ data: '2026-07-01', valor: 34 }, { data: '2026-11-01', valor: 34.6 }] },
      },
    });
    // O corpo não leva `<svg>` solto: só a imagem, com alt, tamanho e o prefixo exato do `src`.
    expect(corpo).not.toContain('<svg');
    expect(corpo).toMatch(/<img alt="Evolução: Braço direito e Braço esquerdo \(cm\)" src="data:image\/svg\+xml;base64,[A-Za-z0-9+/]+={0,2}" width="560" height="220" style="max-width:100%;height:auto">/);
    const svg = svgDoCorpo(corpo) as string;
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="560" height="220" viewBox="0 0 560 220">/);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('onload');
    expect(svg).toContain('#1D4ED8');
    expect(svg).toContain('#6D28D9');
    expect(svg).toContain('stroke-dasharray');
    expect(corpo).toContain('Linha contínua, círculos: Braço direito');
    expect(corpo).toContain('Linha tracejada, quadrados: Braço esquerdo');
    expect(svg).toContain('37,0 cm'); // máximo do eixo
    expect(svg).toContain('34,0 cm'); // mínimo do eixo
    expect((svg.match(/<circle /g) ?? []).length).toBe(3);
    expect((svg.match(/<rect x=/g) ?? []).length).toBe(2);
    // Datas proporcionais ao tempo: 01/09 fica a 62 dias de 123 (≈ metade), não no meio por índice.
    const xs = [...svg.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect((xs[1] - xs[0]) / (xs[2] - xs[0])).toBeCloseTo(62 / 123, 1);
  });

  describe('rótulos de data do eixo com datas próximas', () => {
    // Fonte de 9 px: ~0,6 em por caractere é uma estimativa folgada para dígitos e "/" (Helvetica/Arial dão ~0,5 em).
    const LARGURA_POR_CARACTERE = 5.4;
    const rotulosDoEixo = (svg: string) =>
      [...svg.matchAll(/<text x="([\d.]+)" y="199\.0" text-anchor="middle"[^>]*>([^<]*)<\/text>/g)].map((m) => ({ x: Number(m[1]), texto: m[2] }));
    const marcasDoEixo = (svg: string) => (svg.match(/y1="184" x2="[\d.]+" y2="188"/g) ?? []).length;
    const colisoes = (svg: string) => {
      const r = rotulosDoEixo(svg).sort((a, b) => a.x - b.x);
      return r.slice(1).filter((b, i) => r[i].x + (r[i].texto.length * LARGURA_POR_CARACTERE) / 2 > b.x - (b.texto.length * LARGURA_POR_CARACTERE) / 2);
    };
    const pontosDe = (datas: string[]) => datas.map((data, i) => ({ data, valor: 90 - i }));
    const svgCom = (grafico: DadosPdfAvaliacaoFisica['grafico']) => svgDoCorpo(gerar(['a', 'b'], { grafico }).corpo) as string;

    it('três avaliações em dias seguidos e uma distante: nenhum rótulo cobre o outro, e primeiro e último ficam', () => {
      const datas = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-10-01'];
      const svg = svgCom({ rotulo: 'Cintura', unidade: 'cm', pontos: pontosDe(datas) });
      expect(colisoes(svg)).toEqual([]);
      const textos = rotulosDoEixo(svg).map((r) => r.texto);
      expect(textos[0]).toBe('01/07');
      expect(textos[textos.length - 1]).toBe('01/10');
      // Só o texto sai: a marca no eixo e o ponto de cada data real continuam onde estavam (nada interpolado nem movido).
      expect(marcasDoEixo(svg)).toBe(4);
      expect((svg.match(/<circle /g) ?? []).length).toBe(4);
    });

    it('com a segunda série em dias entre os da primeira, a regra vale para a união das datas', () => {
      const svg = svgCom({
        rotulo: 'Braço direito', unidade: 'cm', pontos: pontosDe(['2026-07-01', '2026-07-03', '2026-10-01']),
        serieB: { rotulo: 'Braço esquerdo', pontos: pontosDe(['2026-07-02', '2026-07-04', '2026-10-01']) },
      });
      expect(colisoes(svg)).toEqual([]);
      expect(marcasDoEixo(svg)).toBe(5);
      expect((svg.match(/<circle /g) ?? []).length).toBe(3);
      expect((svg.match(/<rect x=/g) ?? []).length).toBe(3); // os três quadrados da série B (o fundo não tem `x`)
    });

    it('datas bem espaçadas mantêm todos os rótulos, e com ano os rótulos mais largos também não se cobrem', () => {
      const espacadas = svgCom({ rotulo: 'Cintura', unidade: 'cm', pontos: pontosDe(['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01']) });
      expect(rotulosDoEixo(espacadas).map((r) => r.texto)).toEqual(['01/01', '01/04', '01/07', '01/10']);
      const viradaDoAno = svgCom({ rotulo: 'Cintura', unidade: 'cm', pontos: pontosDe(['2025-12-28', '2025-12-30', '2026-01-02', '2026-03-01']) });
      expect(rotulosDoEixo(viradaDoAno)[0].texto).toBe('28/12/2025');
      expect(colisoes(viradaDoAno)).toEqual([]);
      expect(rotulosDoEixo(viradaDoAno).map((r) => r.texto).slice(-1)).toEqual(['01/03/2026']);
    });

    it('uma data só: o rótulo fica', () => {
      expect(rotulosDoEixo(svgCom({ rotulo: 'Cintura', unidade: 'cm', pontos: pontosDe(['2026-07-01']) })).map((r) => r.texto)).toEqual(['01/07']);
    });
  });

  it('gráfico com uma só série e valor constante não quebra e sem ponto válido some', () => {
    const um = gerar(['a', 'b'], { grafico: { rotulo: 'Cintura', unidade: 'cm', pontos: [{ data: '2026-07-01', valor: 90 }, { data: '2026-09-01', valor: 90 }] } });
    expect(svgDoCorpo(um.corpo)).toContain('<svg');
    expect(um.corpo).not.toContain('Linha tracejada');
    expect(svgDoCorpo(um.corpo)).not.toContain('NaN');
    const nenhum = gerar(['a', 'b'], { grafico: { rotulo: 'Cintura', unidade: 'cm', pontos: [{ data: 'lixo', valor: Number.NaN }] } });
    expect(nenhum.corpo).not.toContain('<img');
  });

  it.each([['2 datas', ['a', 'b'], 2], ['4 datas', ['d', 'b', 'a', 'c'], 4]])('colgroup: uma <col> por data, sem texto solto e larguras somando 100 (%s)', (_nome, ids, n) => {
    const { corpo } = gerar(ids);
    const grupos = corpo.match(/<colgroup>.*?<\/colgroup>/g) ?? [];
    expect(grupos.length).toBeGreaterThan(0);
    for (const g of grupos) {
      expect(g.replace(/<\/?colgroup>|<col style="width:\d+%">/g, '')).toBe('');
      const larguras = [...g.matchAll(/width:(\d+)%/g)].map((m) => Number(m[1]));
      expect(larguras).toHaveLength(n + 2);
      expect(larguras.reduce((x, y) => x + y, 0)).toBe(100);
    }
  });

  it('impressão: quebras de página e tabela estável', () => {
    const { css, corpo } = gerar(['a', 'b']);
    expect(css).toMatch(/tr \{ break-inside: avoid/);
    expect(css).toMatch(/thead[^}]*break-after: avoid/);
    expect(css).toMatch(/h3[^}]*break-after: avoid/);
    expect(css).toMatch(/\.grupo-bloco[^}]*break-inside: avoid/);
    expect(css).toContain('table-layout: fixed');
    expect(css).toContain('word-break: break-word');
    expect(corpo).toContain('<thead>'); // repetido pelo `display: table-header-group` do cssBase
    expect(css).toContain('display: table-header-group');
  });

  it('sem interpretação: nenhuma palavra proibida', () => {
    const { corpo } = gerar(['a', 'b', 'c', 'd'], { grafico: { rotulo: 'Cintura', unidade: 'cm', pontos: [{ data: '2026-07-01', valor: 90 }] } });
    // O base64 da imagem não é texto lido: confere o SVG decodificado no lugar dele.
    const t = `${corpo.replace(/base64,[A-Za-z0-9+/=]+/, '')} ${svgDoCorpo(corpo)}`.toLowerCase();
    for (const proibida of ['progresso total', 'saudável', 'saudavel', 'ruim', 'melhor', 'pior', 'meta', 'gordura', 'assimetria', 'total']) {
      expect(t).not.toContain(proibida);
    }
  });

  it('seleção fora de 2 a 4 datas lança (a tela só habilita o botão com seleção válida)', () => {
    expect(() => gerar(['a'])).toThrow(/pelo menos/);
    expect(() => gerar(['a', 'b', 'c', 'd', 'x'].concat('e'))).not.toThrow(); // ids desconhecidos são ignorados, como na tela
  });
});

describe('PDF da avaliação física nos temas (marca.temaPdf)', () => {
  const comTema = (tema: unknown, cor = '#123456') => ({ marca: { ...marca, corPrimaria: cor, temaPdf: tema } as unknown as Marca });
  const classico = gerar(['a', 'b', 'c'], comTema('CLASSICO'));

  it.each(TEMAS_PDF.map((t) => t.id))('%s: CSS do tema, HTML idêntico ao do CLASSICO e cabeçalho de tabela cinza da avaliação preservado', (tema) => {
    const d = gerar(['a', 'b', 'c'], comTema(tema));
    expect(d.css.startsWith(cssBase('#123456', tema))).toBe(true);
    if (temMarcador(tema)) expect(d.css).toMatch(MARCADOR_DO_TEMA[tema]('#123456'));
    expect(d.corpo).toBe(classico.corpo);
    // A tabela comparativa tem fundo cinza próprio, com texto escuro, em qualquer tema (nada de texto da marca sobre fundo da marca).
    expect(d.css).toMatch(/.doc table.comp th { background: #f1f3f5; color: #111;/);
  });

  it.each(TEMAS_PDF.map((t) => t.id))('%s: marca amarela (#FFEB3B) não deixa texto abaixo de 4,5:1', (tema) => {
    const d = gerar(['a', 'b', 'c'], comTema(tema, '#FFEB3B'));
    expect(textosSemContraste(d.css, d.corpo)).toEqual([]);
  });

  it.each(['OUTRO', null, undefined, '', 5])('temaPdf %p cai em CLASSICO', (valor) => {
    expect(gerar(['a', 'b', 'c'], comTema(valor))).toEqual(classico);
  });
});
