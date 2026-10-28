import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import type { Configuracao, ConteudoDieta, ConteudoTreino, Marca, Serie } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { agrupar } from '../dominio/agrupamento';
import { normalizarTreino } from '../dominio/editorTreino';
import { carga, exercicio, grupo, rir, rpe, serie, sessao, tecnica } from '../dominio/exemplosDeTreino.apoioTeste';
import { normalizarMobilidade } from '../dominio/mobilidade';
import { cabecalhoDoPdf, cssBase, esc, link, type Documento } from './html';
import type { LinhaCarga } from '../dominio/relatorio';
import { documentoCargas } from './pdfCargas';
import { documentoDieta } from './pdfDieta';
import { ajustarQuantidade, alternarComprado, gravarAvulso, itensDoAluno, MARCACOES_VAZIAS } from '../dominio/listaDeComprasDoAluno';
import { documentoListaDeCompras } from './pdfListaDeCompras';
import { documentoMobilidade } from './pdfMobilidade';
import { blocoGlossario, blocoInstrucoes, documentoTreino, obsDoExercicio, seriesDoPdf } from './pdfTreino';

const linhasDeSeries = (e: Parameters<typeof seriesDoPdf>[0], config: Parameters<typeof seriesDoPdf>[1]) => seriesDoPdf(e, config).map((g) => g.linha);

jest.mock('../dominio/uid', () => ({ novoUid: () => 'uid' }));

const marca: Marca = {
  id: 'm',
  nome: 'Consultoria <Teste>',
  corPrimaria: '#C62828',
  fonteTitulo: 'METAL',
  temaPadrao: 'ESCURO',
  logoUrl: null,
};

/** Série com o tipo (código), as repetições, a carga e o esforço; o resto vem da fábrica de teste. */
const s = (uid: string, tipo: string, min: number | null, max: number | null, cargaDaSerie: Serie['carga'], esforco: Serie['esforco'] = null): Serie =>
  serie(uid, { tipo, repsMin: min, repsMax: max, carga: cargaDaSerie, esforco });

const treino: ConteudoTreino = normalizarTreino({
  objetivo: 'Secar <script>alert(1)</script>',
  sessoes: [
    sessao(
      'seg',
      [
        exercicio('remada', {
          nome: 'Remada baixa',
          videoUrl: 'https://youtu.be/abc"onmouseover="x',
          observacao: 'Tronco inclinado',
          series: [
            s('f1', 'FEEDER', 3, 3, carga('PERCENTUAL_WS', 50)),
            s('f2', 'FEEDER', 3, 3, carga('PERCENTUAL_WS', 70)),
            s('f3', 'FEEDER', 3, 3, carga('PERCENTUAL_WS', 85)),
            s('w', 'WORKING', 3, 6, carga('CARGA_TRABALHO'), rir(1)),
            s('b1', 'BACK_OFF', 6, 8, carga('PERCENTUAL_WS', 85)),
            s('b2', 'BACK_OFF', 6, 8, carga('PERCENTUAL_WS', 85)),
          ],
        }),
      ],
      [],
      { nome: 'Segunda - Costas', diaSemana: 1 },
    ),
    sessao('qui', [], [], { nome: 'Quinta - Off ativo', diaSemana: 4, tipo: 'DESCANSO_ATIVO', cardio: 'Cardio 50 min' }),
  ],
});

const base = { marca, logoDataUri: null, aluno: 'Aluno Demonstração', titulo: 'Plano 16', rodapePdf: null, emitidoEm: new Date('2026-10-11T19:30:00Z') };
const dadosDoTreino = (conteudo: ConteudoTreino) => ({ ...base, inicio: null, fim: null, versao: 1, conteudo, instrucoesTreino: null });
const treinoCom = (...exercicios: ReturnType<typeof exercicio>[]) => normalizarTreino({ sessoes: [sessao('s', exercicios, [], { nome: 'Terça - Peito', diaSemana: 2 })] });

test('PDF usa a metodologia copiada para o treino, mesmo quando a configuração global muda', () => {
  const conteudo = { ...treino, metodologia: { id: 'metodo', nome: 'Método fictício', configuracao: {
    ...CONFIGURACAO_PADRAO, tipos: CONFIGURACAO_PADRAO.tipos.map((t) => ({ ...t, nome: t.codigo === 'WORKING' ? 'Trabalho' : t.nome })),
    arredondamentoKg: 1, instrucoesTreino: 'Instrução da versão', rodapePdf: 'Rodapé da versão',
  } } };
  const doc = documentoTreino({ ...base, inicio: null, fim: null, versao: 1, conteudo, instrucoesTreino: 'Global alterada' });
  expect(doc.corpo).toContain('85% da Trabalho');
  expect(doc.corpo).toContain('1x3 a 6 - Trabalho');
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
    instrucoesTreino: 'Linha 1\nLinha 2',
  }).corpo;

  it('escreve as séries em linguagem natural: faixa de percentual, esforço e tipo pelo nome', () => {
    expect(html).toContain('<div class="serie">3x3 - FS 50/70/85% da WS</div><div class="serie">1x3 a 6 - WS · 1 RIR</div><div class="serie">2x6 a 8 - Back off 85% da WS</div>');
  });

  it('nunca mostra o código do tipo', () => {
    for (const codigo of ['FEEDER', 'WORKING', 'BACK_OFF']) expect(html).not.toContain(codigo);
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
    const rascunho = documentoTreino({ ...dadosDoTreino(treino), versao: null }).corpo;
    expect(rascunho).toContain('RASCUNHO');
  });

  it('glossário traz só os tipos usados e o RIR (sem RPE), e vem antes das instruções', () => {
    expect(html).toContain('Como ler este treino');
    expect(html).toContain('<td class="termo">FS</td>');
    expect(html).toContain('<td class="termo">WS</td>');
    expect(html).toContain('<td class="termo">RIR</td>');
    expect(html).toContain('RIR 0 = até a falha');
    expect(html).not.toContain('<td class="termo">RPE</td>');
    expect(html).not.toContain('<td class="termo">Aquecimento</td>');
    expect(html).not.toContain('<td class="termo">Top set</td>');
    expect(html.indexOf('Como ler este treino')).toBeLessThan(html.indexOf('Instruções'));
  });
});

describe('PDF do treino: técnica separada do tipo, descanso e alvos', () => {
  const comDropSet = exercicio('supino', {
    nome: 'Supino reto',
    cadencia: '3-1-1-0',
    isometriaSegundos: 10,
    series: [
      serie('a', { repsMin: 6, repsMax: 8, descansoSegundos: 90, alvoExtra: 'Subir a carga se passar de 8', tecnica: tecnica('DROP_SET', { quedas: 2, reducaoPercentual: 20 }) }),
      serie('b', { repsMin: null, repsMax: null, amrap: true, descansoSegundos: 90 }),
    ],
  });
  const html = documentoTreino(dadosDoTreino(treinoCom(comDropSet))).corpo;

  it('o tipo continua WS, a técnica aparece separada e o descanso fica numa linha própria', () => {
    expect(html).toContain('1x6 a 8 - WS + Drop-set 2× −20% · Subir a carga se passar de 8<div class="etapas">Descanso depois da série: 1 min 30 s</div>');
    // A explicação por extenso não se repete na coluna Obs: está no glossário.
    expect(html).not.toContain('Drop-set: ao terminar');
  });

  it('AMRAP explícito aparece como AMRAP', () => {
    expect(html).toContain('1xAMRAP - WS');
  });

  it('cadência e isometria ficam junto do exercício', () => {
    expect(html).toContain('Cadência 3-1-1-0');
    expect(html).toContain('Isometria 10 s');
  });

  it('o glossário explica a técnica usada e não as outras', () => {
    expect(html).toContain('<td class="termo">Drop-set</td>');
    expect(html).not.toContain('<td class="termo">Rest pause</td>');
  });
});

describe('PDF do treino: esforço (RIR e RPE)', () => {
  it('RIR 0 vira "até a falha" no resumo e no glossário', () => {
    const html = documentoTreino(dadosDoTreino(treinoCom(exercicio('e', { series: [s('x', 'WORKING', 3, 6, carga('CARGA_TRABALHO'), rir(0))] })))).corpo;
    expect(html).toContain('1x3 a 6 - WS · até a falha');
    expect(html).toContain('<td class="termo">RIR</td>');
    expect(html).toContain('RIR 0 = até a falha');
  });

  it('RPE aparece como RPE e só ele entra no glossário', () => {
    const html = documentoTreino(dadosDoTreino(treinoCom(exercicio('e', { series: [s('x', 'WORKING', 8, 10, carga('CARGA_TRABALHO'), rpe(8.5))] })))).corpo;
    expect(html).toContain('1x8 a 10 - WS · RPE 8,5');
    expect(html).toContain('<td class="termo">RPE</td>');
    expect(html).not.toContain('<td class="termo">RIR</td>');
    expect(html).not.toContain('RIR 0');
  });

  it('sem RIR nem RPE, o glossário não fala deles', () => {
    const html = documentoTreino(dadosDoTreino(treinoCom(exercicio('e', { series: [s('x', 'FEEDER', 3, 3, carga('PERCENTUAL_WS', 85))] })))).corpo;
    expect(html).not.toContain('<td class="termo">RIR</td>');
    expect(html).not.toContain('<td class="termo">RPE</td>');
    expect(html).not.toContain('RIR 0');
  });
});

describe('PDF do treino: top set e back off pela referência', () => {
  const top = s('top', 'TOP_SET', null, null, carga('ACIMA_DA_ANTERIOR', 1, 5));
  const back = [s('b1', 'BACK_OFF', 6, 8, carga('ABAIXO_DA_REFERENCIA', 15, null, 'top')), s('b2', 'BACK_OFF', 6, 8, carga('ABAIXO_DA_REFERENCIA', 15, null, 'top'))];

  it('escreve "abaixo da referência" com o nome do tipo da série de referência', () => {
    const linhas = linhasDeSeries({ series: [top, ...back] }, CONFIGURACAO_PADRAO);
    expect(linhas).toEqual(['1x - Top set +1 a 5% sobre a anterior', '2x6 a 8 - Back off 15% abaixo da referência (Top set)']);
  });
});

describe('PDF do treino: grupos de exercícios', () => {
  const dois = (tecnicaDoGrupo: 'SUPERSET' | 'PRE_EXAUSTAO', extra: Parameters<typeof grupo>[2]) =>
    normalizarTreino({
      sessoes: [
        sessao(
          's',
          [
            exercicio('a', { nome: 'Supino reto', grupoUid: 'g', series: [serie('a1', { descansoSegundos: 60 }), serie('a2', { descansoSegundos: 60 })] }),
            exercicio('b', { nome: 'Remada <curvada>', grupoUid: 'g', series: [serie('b1', { descansoSegundos: 60 })] }),
            exercicio('c', { nome: 'Rosca direta', series: [serie('c1', { descansoSegundos: 45 })] }),
          ],
          [grupo('g', tecnicaDoGrupo, extra)],
          { nome: 'Terça - Peito', diaSemana: 2 },
        ),
      ],
    });

  it('superset: linha do grupo com ordem e descanso após o par; os membros não repetem o descanso por série', () => {
    const html = documentoTreino(dadosDoTreino(dois('SUPERSET', { descansoAposSegundos: 90 }))).corpo;
    expect(html).toContain('<strong>Superset</strong> · 2 exercícios, nesta ordem: Supino reto → Remada &lt;curvada&gt; · descanso de 1 min 30 s depois de cada volta do grupo');
    expect(html.indexOf('Superset')).toBeLessThan(html.indexOf('Supino reto'));
    const grupoHtml = html.slice(html.indexOf('Supino reto'), html.indexOf('Rosca direta'));
    expect(grupoHtml).not.toContain('Descanso depois da série');
    // O exercício solto depois do grupo mantém o descanso da própria série.
    expect(html.slice(html.indexOf('Rosca direta'))).toContain('Descanso depois da série: 45 s');
    expect(html.match(/nesta ordem/g)).toHaveLength(1);
  });

  it('superset: o glossário explica a combinação usada', () => {
    const html = documentoTreino(dadosDoTreino(dois('SUPERSET', { descansoAposSegundos: 90 }))).corpo;
    expect(html).toContain('<td class="termo">Superset</td>');
    expect(html).not.toContain('<td class="termo">Circuito</td>');
  });

  it('pré-exaustão: cada série mantém o seu descanso', () => {
    const html = documentoTreino(dadosDoTreino(dois('PRE_EXAUSTAO', {}))).corpo;
    expect(html).toContain('<strong>Pré-exaustão</strong> · 2 exercícios, nesta ordem: Supino reto → Remada &lt;curvada&gt; · cada série mantém o seu descanso');
    expect(html.slice(html.indexOf('Supino reto'), html.indexOf('Rosca direta'))).toContain('Descanso depois da série: 1 min');
  });

  it('circuito mostra as voltas', () => {
    const conteudo = normalizarTreino({
      sessoes: [
        sessao(
          's',
          ['a', 'b', 'c'].map((u) => exercicio(u, { nome: `Exercício ${u}`, grupoUid: 'g', series: [serie(`${u}1`)] })),
          [grupo('g', 'CIRCUITO', { descansoAposSegundos: 120, voltas: 3 })],
          { nome: 'Sexta - Corpo todo', diaSemana: 5 },
        ),
      ],
    });
    const html = documentoTreino(dadosDoTreino(conteudo)).corpo;
    expect(html).toContain('<strong>Circuito</strong> · 3 exercícios, nesta ordem: Exercício a → Exercício b → Exercício c · 3 voltas · descanso de 2 min depois de cada volta do grupo');
  });
});

describe('PDF do treino: cardio', () => {
  const cardio = exercicio('c', {
    nome: 'Esteira <leve>',
    modalidade: 'CARDIO',
    unidade: 'nenhuma',
    series: [
      serie('c1', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 30, distanciaKm: 5, ritmo: '6:00', zona: 2, intervalos: null } }),
      serie('c2', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 8 } } }),
    ],
  });
  const html = documentoTreino(dadosDoTreino(treinoCom(cardio))).corpo;

  it('mostra a prescrição de cardio, sem kg, repetições nem esforço', () => {
    expect(html).toContain('1x 30 min · 5 km · ritmo 6:00 · zona 2');
    expect(html).toContain('1x 8× 30 s / 60 s de descanso');
    expect(html).not.toContain(' kg');
    expect(html).not.toContain('reps');
    expect(html).toContain('Esteira &lt;leve&gt;');
  });

  it('cardio sozinho não gera glossário', () => {
    expect(html).not.toContain('Como ler este treino');
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

  it('refeição com várias opções diz para escolher uma, sem somar nem comparar', () => {
    expect(html).toContain('<div class="escolha">Escolha uma das opções: A ou B.</div>');
    expect(html.toLowerCase()).not.toContain('equivalente');
  });

  it('modo de preparo sai no fim da refeição, com as quebras de linha e escapado; sem ele, nada aparece', () => {
    expect(html).not.toContain('Modo de preparo');
    const comPreparo = normalizarDieta({
      refeicoes: [{ nome: 'Almoço', modoDePreparo: 'Cozinhe <b>bem</b>.\nSirva.', opcoes: [{ rotulo: 'A', itens: [] }] }],
    });
    const corpo = documentoDieta({ ...base, versao: 1, conteudo: comPreparo, pesos: [] }).corpo;
    expect(corpo).toContain('<div class="preparo"><strong>Modo de preparo</strong>Cozinhe &lt;b&gt;bem&lt;/b&gt;.<br>Sirva.</div>');
    expect(corpo).not.toContain('<div class="escolha">');
  });

  it('o nome do aluno e a emissão ficam só no cabeçalho, não repetidos na identificação', () => {
    expect(html.match(/Aluno Demonstração/g)).toHaveLength(1);
    expect(html).not.toContain('<td>Nome</td>');
  });

  it('suplementação vazia e peso sem registro não aparecem', () => {
    expect(html).not.toContain('Suplementação');
    expect(html).not.toContain('Acompanhamento de peso');
  });

  it('não mostra profissional nem "Elaborado por" na capa', () => {
    expect(html).not.toContain('Profissional');
    expect(html).not.toContain('Elaborado por');
  });

  it('sem lista, o HTML é o da dieta simples', () => {
    const simples = documentoDieta({ ...base, versao: 1, conteudo: dieta, pesos: [] }).corpo;
    expect(simples).toBe(html);
    expect(simples).not.toContain('Lista de compras');
  });

  it('detalhado acrescenta a lista no fim, com colunas ou sem elas', () => {
    const linha = {
      chave: 'a', nome: 'Arroz <script>', unidade: 'g' as const, quantidade: 420, cru: true, bruto: false, semFator: false,
      naDieta: 1050, quantidadeCru: 420, fatorCorrecao: null, fatorCoccao: 2.5,
    };
    const semFator = {
      chave: 'b', nome: 'Frango', unidade: 'g' as const, quantidade: 700, cru: false, bruto: false, semFator: true,
      naDieta: 700, quantidadeCru: null, fatorCorrecao: null, fatorCoccao: null,
    };
    const com = documentoDieta({
      ...base, versao: 1, conteudo: dieta, pesos: [],
      lista: { periodo: 'mes', opcoes: ['Almoço: opção B'], linhas: [linha, semFator], mostrarFatores: true },
    }).corpo;
    expect(com.startsWith(html.split('<div class="fim">')[0])).toBe(true);
    expect(com).toContain('Lista de compras · 30 dias');
    expect(com).toContain('>FCc<');
    expect(com).toContain('>FC<');
    expect(com).toContain('Na dieta');
    expect(com).toContain('Arroz &lt;script&gt;');
    expect(com).not.toContain('<script>');
    expect(com).toContain('(como na dieta)');
    expect(com).toContain('—');
    expect(com.indexOf('Lista de compras')).toBeGreaterThan(com.indexOf('Sugestão de plano alimentar'));
    expect(com.indexOf('class="fim"')).toBeGreaterThan(com.indexOf('Lista de compras'));

    const semColunas = documentoDieta({
      ...base, versao: 1, conteudo: dieta, pesos: [],
      lista: { periodo: 'semana', opcoes: [], linhas: [semFator], mostrarFatores: false },
    }).corpo;
    expect(semColunas).toContain('Lista de compras · 7 dias');
    expect(semColunas).not.toContain('>FCc<');
    expect(semColunas).not.toContain('>FC<');
  });

  it('prévia do detalhado diz prévia', () => {
    const previa = documentoDieta({
      ...base, versao: null, conteudo: dieta, pesos: [],
      lista: { periodo: 'semana', opcoes: [], linhas: [], mostrarFatores: true },
    }).corpo;
    expect(previa).toContain('Prévia com os fatores atuais da biblioteca');
    expect(previa).toContain('Lista de compras · 7 dias');
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
  const LINHA: LinhaCarga = { data: '2026-10-07', carga: null, repeticoes: null, etapas: null, cargaVariavel: false, volume: null, series: 1, semCarga: false, observacoes: [] };
  const pdfDe = (...linhas: LinhaCarga[]) => documentoCargas({
    marca,
    logoDataUri: null,
    aluno: 'Aluno Demo',
    de: '2026-10-01',
    ate: '2026-10-14',
    divisoes: [{ chave: 'a', nome: 'A', exercicios: [{ chave: 'x', nome: 'Remada', linhas }] }],
    rodapePdf: null,
    emitidoEm: new Date('2026-10-14T12:00:00Z'),
  }).corpo;

  it('série por etapa: os blocos com o total do servidor, a carga comum e o volume', () => {
    const corpo = pdfDe({ ...LINHA, carga: 40, repeticoes: 14, etapas: '4+4+4+2 = 14', volume: { valor: 560, completo: true } });
    expect(corpo).toContain('<td class="carga">40 kg</td>');
    expect(corpo).toContain('<td>4+4+4+2 = 14</td>');
    expect(corpo).toContain('Volume de carga: 560 kg');
    expect(corpo).not.toContain('14 reps');
  });

  it('carga variável sai escrita, sem inventar uma carga; sem carga numa etapa fica "—"', () => {
    const variavel = pdfDe({ ...LINHA, etapas: '4+4 = 8', repeticoes: 8, cargaVariavel: true });
    expect(variavel).toContain('<td class="carga">Carga variável</td>');
    expect(variavel).toContain('<td>4+4 = 8</td>');
    const semCarga = pdfDe({ ...LINHA, etapas: '4+4 = 8', repeticoes: 8 });
    expect(semCarga).toContain('<td class="carga">—</td>');
    expect(semCarga).not.toContain('Carga variável');
  });

  it('execução parcial aparece como parcial', () => {
    expect(pdfDe({ ...LINHA, carga: 40, etapas: '4+4 (parcial)' })).toContain('<td>4+4 (parcial)</td>');
  });

  it('série sem etapas segue como antes ("6 reps"), com o volume embaixo e a observação escapada', () => {
    const corpo = pdfDe({ ...LINHA, carga: 75, repeticoes: 6, volume: { valor: 450, completo: true }, observacoes: ['<i>x</i>'] });
    expect(corpo).toContain('<td>6 reps</td>');
    expect(corpo).toContain('Volume de carga: 450 kg');
    expect(corpo).toContain('&lt;i&gt;x&lt;/i&gt;');
    expect(corpo).not.toContain('<i>x</i>');
  });

  it('sem volume nem observação a última coluna é "—"', () => {
    expect(pdfDe({ ...LINHA, carga: 75, repeticoes: 6 })).toContain('<td>—</td></tr>');
  });

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
                { ...LINHA, data: '2026-10-07', carga: 90, repeticoes: 6, series: 5, observacoes: ['<b>forte</b>'] },
                { ...LINHA, data: '2026-10-14', series: 2 },
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
        { chave: 'a', nome: 'Arroz <b>cozido</b>', unidade: 'g', quantidade: 1225, cru: true, bruto: false, semFator: false, naDieta: 1050, quantidadeCru: 420, fatorCorrecao: null, fatorCoccao: 2.5 },
        { chave: 'b', nome: 'Ovo', unidade: 'un', quantidade: 20.5, cru: false, bruto: false, semFator: true, naDieta: 20.5, quantidadeCru: null, fatorCorrecao: null, fatorCoccao: null },
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

  it('lista do aluno: ajuste e avulso marcados como dele, caixas vazias mesmo com item comprado; 14 dias no título', () => {
    const linhas = [
      { chave: 'a', nome: 'Arroz', unidade: 'g' as const, quantidade: 840, cru: true, bruto: false, semFator: false, naDieta: 2100, quantidadeCru: 840, fatorCorrecao: null, fatorCoccao: 2.5 },
      { chave: 'b', nome: 'Ovo', unidade: 'un' as const, quantidade: 28, cru: false, bruto: false, semFator: true, naDieta: 28, quantidadeCru: null, fatorCorrecao: null, fatorCoccao: null },
    ];
    let m = ajustarQuantidade(MARCACOES_VAZIAS, 'b', { quantidade: '2', unidade: 'cartelas' });
    m = gravarAvulso(m, { id: 'x', nome: 'Café <moído>', quantidade: null, unidade: null });
    m = alternarComprado(m, 'a');
    const d = documentoListaDeCompras({ ...base, periodo: 'duasSemanas', opcoes: [], linhas, itensDoAluno: itensDoAluno(linhas, m) });
    expect(d.corpo).toContain('Lista de compras — 2 semanas (14 dias)');
    expect(d.corpo).toContain('Arroz <span class="suave">(cru)</span></td><td class="qtd">840 g</td>');
    expect(d.corpo).toContain('Ovo <span class="suave origem">(ajustado por você)</span></td><td class="qtd">2 cartelas <span class="suave">(calculado: 28 un)</span></td>');
    expect(d.corpo).toContain('Café &lt;moído&gt; <span class="suave origem">(adicionado por você)</span></td><td class="qtd">—</td>');
    expect(d.corpo.match(/<span class="caixa"><\/span>/g)).toHaveLength(3);
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
    treino: (m) => documentoTreino({ ...dados(m), inicio: null, fim: null, versao: 1, conteudo: treino, instrucoesTreino: null }),
    dieta: (m) => documentoDieta({ ...dados(m), versao: 1, conteudo: normalizarDieta({ refeicoes: [] }), pesos: [] }),
    mobilidade: (m) => documentoMobilidade({ ...dados(m), versao: 1, conteudo: normalizarMobilidade({ secoes: [] }) }),
    cargas: (m) => documentoCargas({ ...dados(m), de: '2026-10-01', ate: '2026-10-14', divisoes: [] }),
    'lista de compras': (m) => documentoListaDeCompras({ ...dados(m), periodo: 'semana', opcoes: [], linhas: [], versao: 1 }),
  };
  const faixa = (cor: string, texto: string) => `<div class="faixa-marca" style="background:${cor};color:${texto}"><span class="faixa-nome">Consultoria &lt;Teste&gt;</span></div>`;

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

  describe.each(Object.keys(geradores))('%s com logo', (nome) => {
    it('a logo entra na faixa, num quadro branco, antes do nome; o resto do cabeçalho segue sobre branco', () => {
      const logo = 'data:image/png;base64,AAAA';
      const html = documentoComLogo(nome, logo);
      expect(html.startsWith(
        `<div class="faixa-marca com-logo" style="background:#C62828;color:#FFFFFF"><span class="faixa-logo"><img src="${logo}" alt="Consultoria &lt;Teste&gt;"></span><span class="faixa-nome">Consultoria &lt;Teste&gt;</span></div><div class="topo">`,
      )).toBe(true);
      expect(html.match(/<img/g)).toHaveLength(1);
    });
  });

  it('a logo é pequena e mantém a proporção (nunca esticada)', () => {
    const css = geradores.treino(marca).css;
    expect(css).toMatch(/\.faixa-logo img \{[^}]*max-height: 18pt; max-width: 90pt; width: auto; height: auto;/);
    expect(css).toMatch(/\.faixa-logo \{[^}]*background: #fff;/);
  });
});

/** O mesmo documento de `geradores`, com a logo. */
function documentoComLogo(nome: string, logo: string): string {
  const dados = { ...base, logoDataUri: logo };
  switch (nome) {
    case 'treino': return documentoTreino({ ...dados, inicio: null, fim: null, versao: 1, conteudo: treino, instrucoesTreino: null }).corpo;
    case 'dieta': return documentoDieta({ ...dados, versao: 1, conteudo: normalizarDieta({ refeicoes: [] }), pesos: [] }).corpo;
    case 'mobilidade': return documentoMobilidade({ ...dados, versao: 1, conteudo: normalizarMobilidade({ secoes: [] }) }).corpo;
    case 'cargas': return documentoCargas({ ...dados, de: '2026-10-01', ate: '2026-10-14', divisoes: [] }).corpo;
    default: return documentoListaDeCompras({ ...dados, periodo: 'semana', opcoes: [], linhas: [], versao: 1 }).corpo;
  }
}

describe('cabeçalho uniforme dos PDFs', () => {
  const emitidoEm = new Date('2026-10-11T19:30:00Z');
  const comum = { marca, logoDataUri: null, emitidoEm };

  it('tipo do documento grande; título com a versão; aluno, período e emissão à direita, tudo escapado', () => {
    const html = cabecalhoDoPdf({ ...comum, documento: 'Treino <x>', titulo: 'Plano <16>', versao: 3, aluno: 'Aluno <A>', periodo: '05/10/2026 a 20/10/2026' });
    expect(html).toContain('<div class="topo"><div class="topo-titulo"><h1>Treino &lt;x&gt;</h1><div class="doc-titulo">Plano &lt;16&gt; (v3)</div></div>');
    expect(html).toContain('<div class="topo-dados pequeno">Aluno: Aluno &lt;A&gt;<br>Período: 05/10/2026 a 20/10/2026<br>Emitido em ');
    expect(html).not.toContain('<x>');
  });

  it('versão: nula = rascunho (ou o texto pedido); ausente = documento sem versão', () => {
    expect(cabecalhoDoPdf({ ...comum, documento: 'Dieta', titulo: 'Plano', versao: null })).toContain('Plano (RASCUNHO, não publicado)');
    expect(cabecalhoDoPdf({ ...comum, documento: 'Lista', titulo: 'Plano', versao: null, semVersao: 'prévia, não publicada' })).toContain('Plano (prévia, não publicada)');
    const semVersao = cabecalhoDoPdf({ ...comum, documento: 'Relatório de cargas', aluno: 'Aluno' });
    expect(semVersao).not.toContain('doc-titulo');
    expect(semVersao).not.toContain('(v');
    expect(cabecalhoDoPdf({ ...comum, documento: 'Lista' })).not.toContain('Aluno:');
  });

  it('nomes longos quebram linha sem passar por cima da outra coluna', () => {
    const css = cssBase('#C62828');
    expect(css).toMatch(/\.topo-titulo \{[^}]*min-width: 0; overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.topo-dados \{[^}]*min-width: 0; text-align: right; overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.faixa-nome \{[^}]*overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.topo \{[^}]*align-items: flex-start;[^}]*break-inside: avoid;/);
  });

  it.each([
    ['treino', 'Treino', 'Aluno: Aluno Demonstração'],
    ['dieta', 'Sugestão de plano alimentar', 'Aluno: Aluno Demonstração'],
    ['mobilidade', 'Mobilidade', 'Aluno: Aluno Demonstração'],
    ['cargas', 'Relatório de cargas', 'Período: 01/10/2026 a 14/10/2026'],
    ['lista de compras', 'Lista de compras', 'Aluno: Aluno Demonstração'],
  ])('%s usa o mesmo cabeçalho', (nome, documento, linha) => {
    const html = documentoComLogo(nome, '');
    expect(html.match(/<div class="topo">/g)).toHaveLength(1);
    expect(html).toContain(`<h1>${documento}</h1>`);
    expect(html).toContain(linha);
    expect(html).toContain('Emitido em ');
  });
});



test('PDF: série sem repetições mostra "—" no lugar delas ("1x - Top set") e com repetições mostra a faixa', () => {
  const topSet = s('t', 'TOP_SET', null, null, carga('ACIMA_DA_ANTERIOR', 1, 5));
  expect(linhasDeSeries({ series: [topSet] }, CONFIGURACAO_PADRAO)).toEqual(['1x - Top set +1 a 5% sobre a anterior']);
  expect(linhasDeSeries({ series: [{ ...topSet, repsMin: 3, repsMax: 6 }] }, CONFIGURACAO_PADRAO)).toEqual(['1x3 a 6 - Top set +1 a 5% sobre a anterior']);
});

test('PDF: glossário só com o que o treino usa, com o nome da metodologia e todo texto escapado', () => {
  const config: Configuracao = {
    ...CONFIGURACAO_PADRAO,
    tecnicas: CONFIGURACAO_PADRAO.tecnicas.map((t) => (t.tipo === 'CLUSTER' ? { ...t, nome: 'Muscle <Round>', explicacao: 'Blocos <b>curtos</b>' } : t)),
  };
  const comCluster = serie('c', { tipo: 'FEEDER', carga: carga('MESMA_CARGA'), esforco: rir(0), tecnica: tecnica('CLUSTER', { blocos: [4, 2], pausaSegundos: 15 }), repsMin: 6, repsMax: 6 });
  const conteudo = { ...treinoCom(exercicio('e', { series: [comCluster] })), metodologia: { id: 'm', nome: 'M', configuracao: config } };
  const glossario = blocoGlossario(conteudo, config);
  expect(glossario).toContain('Como ler este treino');
  expect(glossario).toContain('Muscle &lt;Round&gt;');
  expect(glossario).toContain('Blocos &lt;b&gt;curtos&lt;/b&gt;');
  expect(glossario).not.toContain('<b>curtos</b>');
  expect(glossario).toContain('<td class="termo">FS</td>');
  expect(glossario).not.toContain('Rest pause');
  expect(glossario).not.toContain('Drop-set');
  expect(glossario).not.toContain('Top set');
  expect(glossario).not.toContain('FEEDER');
  const e = conteudo.sessoes[0].exercicios[0];
  expect(seriesDoPdf(e, config)).toEqual([{ linha: '1x6 - FS com Muscle <Round> · mesma carga da WS · até a falha', detalhes: ['blocos de 4 e 2 reps (6 no total) · pausa de 15 s'] }]);
  // A explicação da técnica fica só no glossário: a coluna Obs não a repete.
  expect(obsDoExercicio(e)).toEqual([]);
});

test('PDF: Cluster com as etapas numa linha e o descanso depois da série em outra, sem repetir no grupo', () => {
  const cluster = serie('c', {
    tipo: 'WORKING',
    carga: carga('CARGA_TRABALHO'),
    tecnica: tecnica('CLUSTER', { blocos: [4, 4], pausaSegundos: 15 }),
    descansoSegundos: 90,
    repsMin: 8,
    repsMax: 8,
  });
  const solto = exercicio('e', { series: [cluster], unidade: 'kg', observacao: 'Pegada fechada' });
  expect(seriesDoPdf(solto, CONFIGURACAO_PADRAO)).toEqual([{ linha: '1x8 - WS com Cluster', detalhes: ['2 blocos de 4 reps · pausa de 15 s', 'Descanso depois da série: 1 min 30 s'] }]);
  expect(seriesDoPdf(solto, CONFIGURACAO_PADRAO, false)[0].detalhes).toEqual(['2 blocos de 4 reps · pausa de 15 s']);
  expect(obsDoExercicio(solto)).toEqual(['Pegada fechada']);
  const html = documentoTreino(dadosDoTreino(treinoCom(solto))).corpo;
  expect(html).toContain('<div class="serie">1x8 - WS com Cluster<div class="etapas">2 blocos de 4 reps · pausa de 15 s</div><div class="etapas">Descanso depois da série: 1 min 30 s</div></div>');
  expect(html).not.toContain('Encerre ao terminar');
});

test('PDF: Rest-pause mostra a etapa inicial e as retomadas', () => {
  const rp = serie('r', { repsMin: 6, repsMax: 8, tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 2 }) });
  expect(seriesDoPdf(exercicio('e', { series: [rp] }), CONFIGURACAO_PADRAO)).toEqual([{ linha: '1x6 a 8 - WS + Rest pause', detalhes: ['6 a 8 reps + 2 retomadas · pausa de 20 s'] }]);
});

test('PDF: treino sem nenhum item com explicação não gera glossário', () => {
  const vazio: Configuracao = { ...CONFIGURACAO_PADRAO, tipos: CONFIGURACAO_PADRAO.tipos.map((t) => ({ ...t, explicacao: null })) };
  expect(blocoGlossario(treinoCom(exercicio('e', { series: [serie('a')] })), vazio)).toBe('');
});

test('PDF: agrupar continua juntando séries iguais', () => {
  expect(agrupar([serie('a'), serie('b')])).toHaveLength(1);
});
