import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import type { Marca } from '../api/tipos';
import { medidasVazias } from '../dominio/avaliacaoFisica';
import { compararAvaliacoes } from '../dominio/comparacaoDeAvaliacoes';
import { documentoCompleto } from './html';
import { documentoAvaliacaoFisica, type DadosPdfAvaliacaoFisica } from './pdfAvaliacaoFisica';

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

  it('peso do dia fica fora dos grupos, informativo, e sem peso nada aparece', () => {
    const { corpo } = gerar(['a', 'b', 'c']);
    expect(corpo).toContain('Peso do dia (informativo)');
    expect(corpo.indexOf('Pernas')).toBeLessThan(corpo.indexOf('Peso do dia'));
    expect(corpo).toContain('82 kg');
    expect(corpo).toContain('−2 kg'); // 82 → 80
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
