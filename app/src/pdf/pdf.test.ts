import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import type { ConteudoDieta, ConteudoTreino, Marca, Serie } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { agrupar } from '../dominio/agrupamento';
import { novaSerie, tecnicaVazia, normalizarTreino } from '../dominio/editorTreino';
import { normalizarMobilidade } from '../dominio/mobilidade';
import { esc, link, type Documento } from './html';
import { documentoCargas } from './pdfCargas';
import { documentoDieta } from './pdfDieta';
import { documentoListaDeCompras } from './pdfListaDeCompras';
import { documentoMobilidade } from './pdfMobilidade';
import { blocoGlossario, linhaDoGrupo, obsDoGrupo, blocoInstrucoes, documentoTreino } from './pdfTreino';

jest.mock('../dominio/uid', () => ({ novoUid: () => 'uid' }));

const marca: Marca = {
  id: 'm',
  nome: 'Consultoria <Teste>',
  corPrimaria: '#C62828',
  fonteTitulo: 'METAL',
  temaPadrao: 'ESCURO',
  logoUrl: null,
};

const s = (tipo: string, min: number | null, max: number | null, intensidade: Serie['intensidade']): Partial<Serie> => ({
  tipo,
  repsMin: min,
  repsMax: max,
  intensidade,
});

const treino: ConteudoTreino = normalizarTreino({
  objetivo: 'Secar <script>alert(1)</script>',
  sessoes: [
    {
      nome: 'Segunda - Costas',
      diaSemana: 1,
      tipo: 'TREINO',
      exercicios: [
        {
          nome: 'Remada baixa',
          videoUrl: 'https://youtu.be/abc"onmouseover="x',
          observacao: 'Tronco inclinado',
          series: [
            s('FS', 3, 3, { modo: 'PERCENTUAL_WS', percentualMin: 50 }),
            s('FS', 3, 3, { modo: 'PERCENTUAL_WS', percentualMin: 70 }),
            s('FS', 3, 3, { modo: 'PERCENTUAL_WS', percentualMin: 85 }),
            s('WS', 3, 6, { modo: 'CARGA_TRABALHO' }),
            s('Back off', 6, 8, { modo: 'PERCENTUAL_WS', percentualMin: 85 }),
            s('Back off', 6, 8, { modo: 'PERCENTUAL_WS', percentualMin: 85 }),
          ],
        },
      ],
    },
    { nome: 'Quinta - Off ativo', diaSemana: 4, tipo: 'DESCANSO_ATIVO', cardio: 'Cardio 50 min', exercicios: [] },
  ],
});

const base = { marca, logoDataUri: null, aluno: 'Aluno Demonstração', titulo: 'Plano 16', rodapePdf: null, emitidoEm: new Date('2026-10-11T19:30:00Z') };

test('PDF usa a metodologia copiada para o treino, mesmo quando a configuração global muda', () => {
  const conteudo = { ...treino, metodologia: { id: 'metodo', nome: 'Método fictício', configuracao: {
    ...CONFIGURACAO_PADRAO, tipos: CONFIGURACAO_PADRAO.tipos.map((t) => ({ ...t, nome: t.nome === 'WS' ? 'Trabalho' : t.nome })),
    arredondamentoKg: 1, instrucoesTreino: 'Instrução da versão', rodapePdf: 'Rodapé da versão',
  } } };
  const doc = documentoTreino({ ...base, inicio: null, fim: null, versao: 1, conteudo, tipoTrabalho: 'GLOBAL', instrucoesTreino: 'Global alterada' });
  expect(doc.corpo).toContain('85% da Trabalho');
  expect(doc.corpo).toContain('Instrução da versão');
  expect(doc.corpo).not.toContain('Global alterada');
});

describe('PDF do treino', () => {
  const html = documentoTreino({
    ...base,
    inicio: '2026-10-05',
    fim: '2026-10-20',
    versao: 2,
    conteudo: treino,
    tipoTrabalho: 'WS',
    instrucoesTreino: 'Linha 1\nLinha 2',
  }).corpo;

  it('agrupa as séries como no PDF do Saraiva', () => {
    expect(html).toContain('3x3 - FS<br>1x3 a 6 - WS<br>2x6 a 8 - Back off');
  });

  it('escreve a intensidade na coluna OBS', () => {
    expect(html).toContain('FS - 50/70/85% da WS');
    expect(html).toContain('Back off - 85% da WS');
  });

  it('escapa todo texto do usuário, inclusive o link do vídeo', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Consultoria &lt;Teste&gt;');
    expect(html).not.toContain('"onmouseover="');
  });

  it('dia de descanso mostra o cardio; instruções no fim, uma linha por item', () => {
    expect(html).toContain('Cardio 50 min');
    expect(html).toContain('Linha 1');
    expect(html).toContain('Linha 2');
    expect(html.indexOf('Instruções')).toBeGreaterThan(html.indexOf('Remada baixa'));
  });

  it('rascunho sai marcado', () => {
    const rascunho = documentoTreino({ ...base, inicio: null, fim: null, versao: null, conteudo: treino, tipoTrabalho: 'WS', instrucoesTreino: null }).corpo;
    expect(rascunho).toContain('RASCUNHO');
  });
});

describe('PDF do treino: técnicas da pesquisa de 19/10', () => {
  const conteudo = normalizarTreino({
    sessoes: [
      {
        nome: 'Terça - Peito',
        diaSemana: 2,
        tipo: 'TREINO',
        exercicios: [
          {
            nome: 'Supino reto',
            cadencia: '3-1-1-0',
            combinacao: 'SUPERSERIE',
            series: [
              {
                ...s('WS', 6, 8, { modo: 'CARGA_TRABALHO' }),
                tecnica: { tipo: 'DROP_SET', blocos: null, pausaSegundos: null, pausaRespiracoes: null, pausas: null, quedas: 2, reducaoPercentual: 20, repsPorQueda: null },
              },
            ],
          },
          { nome: 'Remada <curvada>', juntoComAnterior: true, isometriaSegundos: 10, series: [s('WS', 8, 10, { modo: 'CARGA_TRABALHO' })] },
          { nome: 'Rosca direta', series: [s('WS', 8, 10, { modo: 'CARGA_TRABALHO' })] },
        ],
      },
    ],
  });
  const html = documentoTreino({ ...base, inicio: null, fim: null, versao: 1, conteudo, tipoTrabalho: 'WS', instrucoesTreino: null }).corpo;

  it('drop-set na coluna de séries, cadência e isometria junto do exercício', () => {
    expect(html).toContain('1x6 a 8 - WS · Drop-set 2× −20%');
    expect(html).toContain('Cadência 3-1-1-0');
    expect(html).toContain('Isometria 10 s');
  });

  it('rótulo do grupo antes dos exercícios feitos juntos, e só deles', () => {
    expect(html).toContain('<strong>Supersérie</strong>');
    expect(html.indexOf('Supersérie')).toBeLessThan(html.indexOf('Supino reto'));
    expect(html.match(/em sequência/g)).toHaveLength(1);
    expect(html).toContain('Remada &lt;curvada&gt;');
  });
});

describe('PDF da dieta', () => {
  const dieta: ConteudoDieta = normalizarDieta({
    objetivo: 'Construção muscular',
    profissional: 'Saraiva Team',
    refeicoes: [
      {
        nome: 'Café da manhã',
        opcoes: [
          { rotulo: 'A', itens: [{ nome: 'Pão', quantidade: 50, unidade: 'g', kcal: 133, proteina: 4.2, carboidrato: 24.8, gordura: 1.6 }] },
          { rotulo: 'B', itens: [{ nome: 'Aveia', quantidade: 40, unidade: 'g', kcal: 999, proteina: 1, carboidrato: 1, gordura: 1 }] },
        ],
      },
    ],
    suplementacao: [{ uid: 's1', nome: '', dose: '', horario: '', observacao: '', link: null }],
  });
  const html = documentoDieta({ ...base, versao: 1, conteudo: dieta, pesos: [] }).corpo;

  it('total do dia só com a opção A', () => {
    expect(html).toContain('133 kcal');
    expect(html).toContain('Total do dia considerando a opção A de cada refeição.');
    expect(html).toContain('▸ OPÇÃO B');
  });

  it('suplementação vazia e peso sem registro não aparecem', () => {
    expect(html).not.toContain('Suplementação');
    expect(html).not.toContain('Acompanhamento de peso');
  });

  it('não mostra profissional nem "Elaborado por" na capa', () => {
    expect(html).not.toContain('Profissional');
    expect(html).not.toContain('Elaborado por');
  });

  describe('link da suplementação', () => {
    const comSuplementos = (itens: { nome: string; link: string | null }[]) =>
      documentoDieta({
        ...base,
        versao: 1,
        pesos: [],
        conteudo: { ...dieta, suplementacao: itens.map((s, i) => ({ uid: `s${i}`, dose: '', horario: '', observacao: '', ...s })) },
      }).corpo;

    it('nome vira link quando o https passa na regra', () => {
      const h = comSuplementos([{ nome: 'Item de teste A (Marca)', link: 'https://exemplo.com/produto?a=1&b=2' }]);
      expect(h).toContain('<a href="https://exemplo.com/produto?a=1&amp;b=2">Item de teste A (Marca)</a>');
    });

    it('link que tenta fechar o atributo sai escapado', () => {
      const h = comSuplementos([{ nome: 'Item de teste B', link: 'https://exemplo.com/"><script>alert(1)</script>' }]);
      expect(h).not.toContain('<script>');
      expect(h).not.toContain('com/"><');
      expect(h).toContain('<a href="https://exemplo.com/&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">Item de teste B</a>');
    });

    it('nome com HTML sai escapado e link inseguro não vira link', () => {
      const h = comSuplementos([
        { nome: '<img src=x onerror=alert(1)>', link: 'https://exemplo.com/a' },
        { nome: 'Item de teste C', link: 'javascript:alert(1)' },
        { nome: 'Item de teste D', link: 'http://exemplo.com/a' },
      ]);
      expect(h).not.toContain('<img');
      expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;</a>');
      expect(h).toContain('<td>Item de teste C</td>');
      expect(h).toContain('<td>Item de teste D</td>');
      expect(h).not.toContain('javascript:');
      expect(h).not.toContain('href="http:');
    });
  });
});

describe('PDF da dieta: medicação e ergogênicos', () => {
  const base2 = normalizarDieta({ refeicoes: [] });
  const gerar = (ergogenicos: unknown) =>
    documentoDieta({ ...base, versao: 1, pesos: [], conteudo: { ...base2, ergogenicos: normalizarDieta({ ergogenicos }).ergogenicos } }).corpo;

  it('lista nula ou vazia não cria a seção', () => {
    expect(gerar(null)).not.toContain('Medicação e ergogênicos');
    expect(gerar([])).not.toContain('Medicação e ergogênicos');
  });

  it('seção entra com os campos e sem a coluna Prescrição quando nenhum item tem', () => {
    const h = gerar([{ uid: 'e1', nome: 'Item de teste A', principioAtivo: 'Princípio de Teste', concentracao: '200 mg/ml', dose: 'Dose de teste' }]);
    expect(h).toContain('Medicação e ergogênicos');
    expect(h).toContain('Item de teste A');
    expect(h).toContain('Princípio de Teste');
    expect(h).toContain('<td>200 mg/ml</td>');
    expect(h).toContain('<td>Dose de teste</td>');
    expect(h).toContain('<td>—</td>');
    expect(h).not.toContain('<th>Prescrição</th>');
  });

  it('coluna Prescrição aparece se algum item tem, e todo texto sai escapado', () => {
    const h = gerar([
      { uid: 'e1', nome: '<img src=x onerror=alert(1)>', prescricao: 'Prescrição <b>de teste</b>' },
      { uid: 'e2', nome: 'Item de teste B' },
    ]);
    expect(h).toContain('<th>Prescrição</th>');
    expect(h).not.toContain('<img');
    expect(h).not.toContain('<b>');
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(h).toContain('Prescrição &lt;b&gt;de teste&lt;/b&gt;');
  });
});

describe('PDF da mobilidade', () => {
  const conteudo = normalizarMobilidade({
    orientacoes: 'Faça <b>devagar</b>\nSem dor',
    secoes: [
      {
        uid: 's1',
        titulo: 'Aquecimento <i>geral</i>',
        itens: [
          { uid: 'i1', nome: 'Gato-camelo <script>x</script>', prescricao: '2x30s\nlado a lado', videoUrl: 'https://youtu.be/abc123' },
          { uid: 'i2', nome: 'Rotação', prescricao: null, videoUrl: 'https://youtu.be/abc"onmouseover="x' },
          { uid: 'i3', nome: 'Ponte', prescricao: '10 reps', videoUrl: 'javascript:alert(1)' },
        ],
      },
      { uid: 's2', titulo: null, itens: [] },
    ],
  });
  const dados = { ...base, versao: 3, conteudo, rodapePdf: null };
  const html = documentoMobilidade(dados).corpo;

  it('escapa todo texto do usuário e mantém as quebras de linha', () => {
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).toContain('Faça &lt;b&gt;devagar&lt;/b&gt;<br>Sem dor');
    expect(html).toContain('Aquecimento &lt;i&gt;geral&lt;/i&gt;');
    expect(html).toContain('Gato-camelo &lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('2x30s<br>lado a lado');
    expect(html).toContain('Consultoria &lt;Teste&gt;');
  });

  it('vídeo vira só o link; link inseguro ou prescrição ausente vira "—"', () => {
    expect(html).toContain('<a href="https://youtu.be/abc123">Vídeo</a>');
    expect(html).not.toContain('"onmouseover="');
    expect(html).toContain('abc&quot;onmouseover=&quot;x');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<td>—</td>');
  });

  it('seção sem itens não aparece e o título da versão publicada sai na capa', () => {
    expect(html.match(/<section/g)).toHaveLength(1);
    expect(html).toContain('Plano 16 (v3)');
    expect(html).not.toContain('RASCUNHO');
  });

  it('rascunho sai marcado e o nome do arquivo identifica o aluno', () => {
    const d = documentoMobilidade({ ...dados, versao: null });
    expect(d.corpo).toContain('RASCUNHO');
    expect(d.titulo).toBe('Mobilidade - Aluno Demonstração - Plano 16');
  });
});

describe('html', () => {
  it('esc e link', () => {
    expect(esc(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    expect(link('javascript:alert(1)', 'Vídeo')).toBe('—');
  });
});

describe('PDF de cargas', () => {
  it('agrupa por divisão, escapa texto do aluno e mostra "—" para o que não foi registrado', () => {
    const d = documentoCargas({
      marca,
      logoDataUri: null,
      aluno: 'Aluno Demo',
      de: '2026-10-01',
      ate: '2026-10-14',
      divisoes: [
        {
          chave: 'quarta - pernas',
          nome: 'Quarta - Pernas',
          exercicios: [
            {
              chave: 'mesa',
              nome: 'Mesa flexora',
              linhas: [
                { data: '2026-10-07', carga: 90, repeticoes: 6, series: 5, semCarga: false, observacoes: ['<b>forte</b>'] },
                { data: '2026-10-14', carga: null, repeticoes: null, series: 2, semCarga: false, observacoes: [] },
              ],
            },
          ],
        },
      ],
      rodapePdf: null,
      emitidoEm: new Date('2026-10-14T12:00:00Z'),
    });
    expect(d.corpo).toContain('Quarta - Pernas');
    expect(d.corpo).toContain('90 kg');
    expect(d.corpo).toContain('2 registros');
    expect(d.corpo).toContain('&lt;b&gt;forte&lt;/b&gt;');
    expect(d.corpo).not.toContain('<b>forte</b>');
    expect(d.corpo).toContain('<td class="carga">—</td>');
  });
});

describe('instruções do PDF do treino', () => {
  it('separa termo e explicação, mantém linhas seguintes sob o termo e escapa HTML', () => {
    const html = blocoInstrucoes('Feeder Set (FS): série <b>de</b> reconhecimento\n1º FS - 50%\n2º FS - 70%\nAnote a carga');
    expect(html).toContain('<td class="termo">Feeder Set (FS)</td>');
    expect(html).toContain('série &lt;b&gt;de&lt;/b&gt; reconhecimento');
    expect(html).toContain('<div class="sub">1º FS - 50%</div>');
    expect(html).toContain('<div class="sub">Anote a carga</div>');
  });
  it('texto vazio não gera bloco', () => {
    expect(blocoInstrucoes('  \n ')).toBe('');
  });
});

describe('PDF da lista de compras', () => {
  const base = { marca, logoDataUri: null, aluno: 'Aluno <Fictício>', titulo: 'Dieta & ciclo', versao: 2, emitidoEm: new Date('2026-10-19T12:00:00Z') };

  it('quantidade arredondada para cima, marca "cru" e escapa todo texto', () => {
    const d = documentoListaDeCompras({
      ...base,
      periodo: 'semana',
      opcoes: ['Café <da> manhã: opção B'],
      linhas: [
        { chave: 'a', nome: 'Arroz <b>cozido</b>', unidade: 'g', quantidade: 1225, cru: true, bruto: false, semFator: false },
        { chave: 'b', nome: 'Ovo', unidade: 'un', quantidade: 20.5, cru: false, bruto: false, semFator: true },
      ],
    });
    expect(d.titulo).toBe('Lista de compras - Aluno <Fictício> - Dieta & ciclo');
    expect(d.corpo).toContain('Lista de compras — Semana (7 dias)');
    expect(d.corpo).toContain('Arroz &lt;b&gt;cozido&lt;/b&gt; <span class="suave">(cru)</span>');
    expect(d.corpo).toContain('1,23 kg');
    expect(d.corpo).toContain('21 un');
    expect(d.corpo).toContain('Café &lt;da&gt; manhã: opção B');
    expect(d.corpo).toContain('Aluno: Aluno &lt;Fictício&gt;');
    expect(d.corpo).not.toContain('<b>cozido</b>');
    expect(d.corpo).toContain('sem fator, vale a quantidade da dieta');
  });

  it('prévia do editor (sem versão) avisa que não é a publicada; modelo sai sem aluno', () => {
    const d = documentoListaDeCompras({ ...base, aluno: null, versao: null, periodo: 'semana', opcoes: [], linhas: [] });
    expect(d.titulo).toBe('Lista de compras - Modelo - Dieta & ciclo');
    expect(d.corpo).not.toContain('Aluno:');
    expect(d.corpo).toContain('Dieta &amp; ciclo (prévia, não publicada)');
    expect(d.corpo).toContain('Prévia com os fatores atuais da biblioteca');
    expect(documentoListaDeCompras({ ...base, periodo: 'semana', opcoes: [], linhas: [] }).corpo).not.toContain('Prévia com');
  });

  it('lista vazia vira "—"', () => {
    const d = documentoListaDeCompras({ ...base, periodo: 'mes', opcoes: [], linhas: [] });
    expect(d.corpo).toContain('Mês (30 dias)');
    expect(d.corpo).toContain('<div class="suave">—</div>');
  });
});

describe('faixa da marca no alto dos cinco PDFs', () => {
  const dados = (m: Marca) => ({ ...base, marca: m });
  const geradores: Record<string, (m: Marca) => Documento> = {
    treino: (m) => documentoTreino({ ...dados(m), inicio: null, fim: null, versao: 1, conteudo: treino, tipoTrabalho: 'WS', instrucoesTreino: null }),
    dieta: (m) => documentoDieta({ ...dados(m), versao: 1, conteudo: normalizarDieta({ refeicoes: [] }), pesos: [] }),
    mobilidade: (m) => documentoMobilidade({ ...dados(m), versao: 1, conteudo: normalizarMobilidade({ secoes: [] }) }),
    cargas: (m) => documentoCargas({ ...dados(m), de: '2026-10-01', ate: '2026-10-14', divisoes: [] }),
    'lista de compras': (m) => documentoListaDeCompras({ ...dados(m), periodo: 'semana', opcoes: [], linhas: [], versao: 1 }),
  };
  const faixa = (cor: string, texto: string) => `<div class="faixa-marca" style="background:${cor};color:${texto}">Consultoria &lt;Teste&gt;</div>`;

  describe.each(Object.entries(geradores))('%s', (_nome, gerar) => {
    it('cor escura: faixa na cor da marca com texto branco, antes de qualquer outro bloco', () => {
      const d = gerar(marca);
      expect(d.corpo.startsWith(faixa('#C62828', '#FFFFFF'))).toBe(true);
      expect(d.corpo.match(/faixa-marca/g)).toHaveLength(1);
    });

    it('cor clara: texto preto', () => {
      expect(gerar({ ...marca, corPrimaria: '#FFEB3B' }).corpo.startsWith(faixa('#FFEB3B', '#000000'))).toBe(true);
    });

    it('faixa pede para o navegador imprimir o fundo; o corpo segue preto no branco', () => {
      const css = gerar(marca).css;
      expect(css).toMatch(/\.faixa-marca \{[^}]*-webkit-print-color-adjust: exact; print-color-adjust: exact;/);
      expect(css).toContain('html, body { background: #fff; color: #111; margin: 0; }');
      expect(css).toContain('.doc { font-family');
      expect(css).not.toMatch(/\.doc \{[^}]*background/);
    });

    it.each(['red', '#FFF', '#C62828; } body { display: none', 'url(javascript:x)', '#GGGGGG', ''])('cor inválida %p não vaza: faixa neutra e nada da cor no HTML', (ruim) => {
      const d = gerar({ ...marca, corPrimaria: ruim });
      expect(d.corpo.startsWith(faixa('#333333', '#FFFFFF'))).toBe(true);
      const tudo = d.corpo + d.css;
      for (const trecho of ['display: none', 'javascript', 'GGGGGG', 'red;', 'background:red', '#FFF;']) expect(tudo).not.toContain(trecho);
    });
  });

  it('fora da faixa, treino, mobilidade, cargas e lista de compras não têm fundo na cor da marca no corpo', () => {
    for (const nome of ['treino', 'mobilidade', 'cargas', 'lista de compras']) {
      const corpo = geradores[nome](marca).corpo;
      expect(corpo.match(/background:\s*#C62828/gi)).toHaveLength(1);
    }
  });

  it('o logo continua fora da faixa, sobre branco', () => {
    const d = documentoMobilidade({ ...base, logoDataUri: 'data:image/png;base64,AAAA', versao: 1, conteudo: normalizarMobilidade({ secoes: [] }) });
    expect(d.corpo.indexOf('faixa-marca')).toBeLessThan(d.corpo.indexOf('<img'));
    expect(d.corpo).toMatch(/<\/div><div class="topo"><div><img src="data:image\/png;base64,AAAA"/);
  });
});

test('PDF: série sem repetições mostra "—" no lugar delas ("1x— - Top set")', () => {
  const topSet = { ...novaSerie(CONFIGURACAO_PADRAO, 'Top set'), repsMin: null, repsMax: null, intensidade: { modo: 'ACIMA_DA_ANTERIOR' as const, percentualMin: 1, percentualMax: 5 } };
  expect(linhaDoGrupo(agrupar([topSet])[0], CONFIGURACAO_PADRAO)).toBe('1x— - Top set');
  const comReps = { ...topSet, repsMin: 3, repsMax: 6 };
  expect(linhaDoGrupo(agrupar([comReps])[0], CONFIGURACAO_PADRAO)).toBe('1x3 a 6 - Top set');
});

test('PDF: técnica sem tipo, faixas e RIR zero; glossário só com prescrições usadas e texto escapado', () => {
  const config = { ...CONFIGURACAO_PADRAO, tecnicas: CONFIGURACAO_PADRAO.tecnicas.map((t) => t.tipo === 'CLUSTER' ? { ...t, nome: 'Muscle <Round>' } : t) };
  const tecnica = { ...novaSerie(config, null), repsMin: 6, repsMax: 6, intensidade: { modo: 'MESMA_CARGA' as const, rir: 0 }, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaSegundos: 15 } };
  const grupo = agrupar([tecnica])[0];
  expect(linhaDoGrupo(grupo, config)).toContain('Muscle <Round>');
  expect(obsDoGrupo(grupo, 'WS', config)).toBe('Muscle <Round> - mesma carga da WS · até a falha');
  const fs = { ...novaSerie(config, 'FS'), intensidade: { modo: 'PERCENTUAL_WS' as const, percentualMin: 85, percentualMax: 90, rir: 0 } };
  expect(obsDoGrupo(agrupar([fs])[0], 'WS')).toBe('FS - 85 a 90% da WS · até a falha');
  const conteudo = normalizarTreino({ sessoes: [{ exercicios: [{ series: [tecnica] }] }] });
  const glossario = blocoGlossario(conteudo, config);
  expect(glossario).toContain('Como ler este treino');
  expect(glossario).toContain('Muscle &lt;Round&gt;');
  expect(glossario).not.toContain('Feeder set');
  expect(glossario).not.toContain('Rest pause');
});
