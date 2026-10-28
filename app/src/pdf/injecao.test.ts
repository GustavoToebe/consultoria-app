import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import type { ConteudoDieta, Marca } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { normalizarTreino } from '../dominio/editorTreino';
import { carga, exercicio, grupo, rir, serie, sessao, tecnica } from '../dominio/exemplosDeTreino.apoioTeste';
import { normalizarMobilidade } from '../dominio/mobilidade';
import type { LinhaDaLista } from '../dominio/listaDeCompras';
import { documentoCompleto, type Documento } from './html';
import { documentoCargas } from './pdfCargas';
import { documentoDieta } from './pdfDieta';
import { ajustarQuantidade, gravarAvulso, itensDoAluno, MARCACOES_VAZIAS } from '../dominio/listaDeComprasDoAluno';
import { documentoListaDeCompras } from './pdfListaDeCompras';
import { documentoMobilidade } from './pdfMobilidade';
import { documentoTreino } from './pdfTreino';

jest.mock('../dominio/uid', () => ({ novoUid: () => 'uid' }));

/**
 * Trava de segurança do `innerHTML` de `imprimir.web.ts`: os cinco geradores montam HTML por texto e a web o injeta na
 * página, então um campo de texto livre sem `esc()` viraria XSS armazenado. Aqui TODA string das entradas vira um
 * ataque (com o caminho do campo dentro dele), menos as chaves que só LIGAM objetos entre si (`LIGACAO`: se mudassem de
 * valor, o grupo perderia os exercícios e o PDF mostraria menos). Campo novo de texto livre entra no teste sozinho; se
 * ele sair sem `esc()`, o teste aponta o caminho.
 *
 * Cada gerador roda em duas variações: `tudo envenenado` (códigos, datas e enums também viram ataque, o que exercita
 * os textos de reserva, como o tipo que não está na metodologia) e `códigos preservados` (tipo, código, modalidade etc.
 * intactos, para o glossário, os grupos e as técnicas serem montados e atacados).
 */

/** Chaves que só ligam um objeto a outro (uid, referência). Nunca são texto do usuário nem aparecem no PDF. */
const LIGACAO = ['uid', 'id', 'exercicioId', 'alimentoId', 'grupoUid', 'referenciaUid'];
/** Códigos, enums e datas que escolhem uma entrada da metodologia ou um formato; o servidor os valida. */
const CODIGOS = [
  'chave', 'codigo', 'tipo', 'modo', 'papel', 'tecnica', 'modalidade', 'regiao', 'unidade', 'periodo',
  'data', 'de', 'ate', 'inicio', 'fim', 'dataInicio', 'cadencia', 'fonteTitulo', 'temaPadrao', 'logoUrl',
];
type Poupar = ReadonlySet<string>;
const VARIACOES: { nome: string; poupar: Poupar }[] = [
  { nome: 'tudo envenenado', poupar: new Set(LIGACAO) },
  { nome: 'códigos preservados', poupar: new Set([...LIGACAO, ...CODIGOS]) },
];
/** Link de vídeo/produto: o ataque precisa ser um https válido para o `<a href>` existir e a aspa ser testada de verdade. */
const LINKS = new Set(['videoUrl', 'link']);

const ataque = (caminho: string) => `"><b>${caminho}</b><img src=x onerror=alert(1)>'`;
const ataqueDeLink = (caminho: string) => `https://youtu.be/abc"onmouseover="${caminho}`;

/** Copia a entrada trocando as strings de texto livre pelo ataque; devolve também os caminhos envenenados. */
function envenenar<T>(entrada: T, poupar: Poupar): { dados: T; caminhos: string[] } {
  const caminhos: string[] = [];
  const percorrer = (v: unknown, caminho: string, chave: string): unknown => {
    if (typeof v === 'string') {
      if (poupar.has(chave)) return v;
      caminhos.push(caminho);
      return LINKS.has(chave) ? ataqueDeLink(caminho) : ataque(caminho);
    }
    if (Array.isArray(v)) return v.map((x, i) => percorrer(x, `${caminho}[${i}]`, chave));
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, percorrer(x, caminho ? `${caminho}.${k}` : k, k)]));
    }
    return v;
  };
  return { dados: percorrer(entrada, '', '') as T, caminhos };
}

const tags = (html: string) => [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)];
const nomesDasTags = (html: string) => new Set(tags(html).map((t) => t[1].toLowerCase()));
/** Valores entre aspas (um `alt` pode trazer o ataque já escapado, "onerror=" inclusive) não contam como atributo. */
const semValores = (resto: string) => resto.replace(/"[^"]*"/g, '""');
const atributos = (html: string) => new Set(tags(html).flatMap((t) => [...semValores(t[2]).matchAll(/\s([a-zA-Z-]+)=/g)].map((a) => a[1].toLowerCase())));
const comEvento = (html: string) => tags(html).filter((t) => /\son[a-z]+\s*=/i.test(semValores(t[2]))).map((t) => t[0]);

/**
 * `limpo` é o mesmo documento com o texto trocado por "x": as tags e os atributos que o gerador escreve por conta
 * própria. Qualquer tag ou atributo a mais no documento atacado veio do texto do usuário.
 */
function conferir(nomeDoGerador: string, gerar: (entrada: never) => Documento, entrada: unknown) {
  for (const { nome: variacao, poupar } of VARIACOES) conferirVariacao(`${nomeDoGerador} [${variacao}]`, gerar, entrada, poupar);
}

function conferirVariacao(nome: string, gerar: (entrada: never) => Documento, entrada: unknown, poupar: Poupar) {
  const { dados, caminhos } = envenenar(entrada, poupar);
  const doc = gerar(dados as never);
  const html = documentoCompleto(doc);
  const limpo = documentoCompleto(gerar(trocarPorX(entrada, poupar) as never));

  it(`${nome}: tem campos de texto para atacar`, () => {
    expect(caminhos.length).toBeGreaterThan(5);
  });

  it(`${nome}: nenhum texto vira tag, atributo ou evento`, () => {
    // Sem diferença de maiúsculas: o gerador pode mudar a caixa do texto (a refeição da dieta sai em caixa alta).
    const minusculas = html.toLowerCase();
    const vazados = caminhos.filter((c) => minusculas.includes(`<b>${c.toLowerCase()}</b>`) || minusculas.includes(`"onmouseover="${c.toLowerCase()}`));
    expect(vazados).toEqual([]);
    expect([...nomesDasTags(html)].filter((t) => !nomesDasTags(limpo).has(t))).toEqual([]);
    expect([...atributos(html)].filter((a) => !atributos(limpo).has(a))).toEqual([]);
    expect(comEvento(html)).toEqual([]);
    expect(html).not.toContain('<script');
  });

  it(`${nome}: o texto sai escapado (o ataque aparece como texto, não como marcação)`, () => {
    expect(html).toContain('&quot;&gt;&lt;b&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(doc.css).not.toContain('onerror');
  });
}

/** Mesma forma da entrada, com o texto livre trocado por "x" (links por um https válido). */
function trocarPorX<T>(entrada: T, poupar: Poupar): T {
  const percorrer = (v: unknown, chave: string): unknown => {
    if (typeof v === 'string') return poupar.has(chave) ? v : LINKS.has(chave) ? 'https://youtu.be/abc' : 'x';
    if (Array.isArray(v)) return v.map((x) => percorrer(x, chave));
    if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, percorrer(x, k)]));
    return v;
  };
  return percorrer(entrada, '') as T;
}

const marca: Marca = { id: 'm', nome: 'Marca', corPrimaria: '#C62828', fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl: null };
const base = {
  marca,
  logoDataUri: 'data:image/png;base64,AAAA',
  aluno: 'Aluno',
  titulo: 'Título',
  rodapePdf: 'Rodapé',
  emitidoEm: new Date('2026-10-11T19:30:00Z'),
};

/** Um grupo de cada combinação (tamanhos que o `ValidadorTreino` aceita), para o glossário das combinações também ser atacado. */
const COMBINACOES = [
  ['SUPERSET', 2], ['AGONISTA_ANTAGONISTA', 2], ['TRI_SET', 3], ['GIANT_SET', 4], ['CIRCUITO', 3], ['PRE_EXAUSTAO', 2], ['POS_EXAUSTAO', 2],
] as const;
const exerciciosDosGrupos = COMBINACOES.flatMap(([tipo, quantos]) =>
  Array.from({ length: quantos }, (_, i) => exercicio(`${tipo}${i}`, { nome: `${tipo} ${i}`, grupoUid: tipo, series: [serie(`${tipo}${i}s`, { descansoSegundos: 60 })] })),
);
const gruposDaSessao = COMBINACOES.map(([tipo]) => grupo(tipo, tipo, { descansoAposSegundos: tipo === 'PRE_EXAUSTAO' || tipo === 'POS_EXAUSTAO' ? null : 90, voltas: tipo === 'CIRCUITO' ? 3 : null }));

const treino = normalizarTreino({
  objetivo: 'Objetivo',
  orientacoes: 'Orientações',
  metodologia: { id: 'metodo', nome: 'Método', configuracao: { ...CONFIGURACAO_PADRAO, instrucoesTreino: 'Instruções', rodapePdf: 'Rodapé da metodologia' } },
  sessoes: [
    sessao(
      'seg',
      [
        exercicio('remada', {
          nome: 'Remada',
          videoUrl: 'https://youtu.be/abc',
          observacao: 'Observação',
          cadencia: '3-1-1-0',
          isometriaSegundos: 10,
          series: [
            serie('f1', { tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: carga('PERCENTUAL_WS', 50) }),
            serie('w', { tipo: 'WORKING', repsMin: 3, repsMax: 6, esforco: rir(1), alvoExtra: 'Alvo extra', descansoSegundos: 90 }),
            serie('d', { tecnica: tecnica('DROP_SET', { quedas: 2, reducaoPercentual: 20 }) }),
            serie('n', { tecnica: tecnica('NEGATIVA') }),
            // Um de cada tipo e técnica da metodologia, para o glossário (nomes e explicações) também ser atacado.
            serie('bo', { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: carga('PERCENTUAL_WS', 85) }),
            serie('wu', { tipo: 'WARM_UP', repsMin: 10, repsMax: 15, carga: carga('NENHUMA') }),
            serie('top', { tipo: 'TOP_SET', carga: carga('ACIMA_DA_ANTERIOR', 1, 5) }),
            serie('rp', { tecnica: tecnica('REST_PAUSE', { pausas: 1, pausaSegundos: 20 }) }),
            serie('cl', { repsMin: 6, repsMax: 6, tecnica: tecnica('CLUSTER', { blocos: [4, 2], pausaSegundos: 15 }) }),
            serie('my', { tecnica: tecnica('MYO_REPS', { miniSeries: 3, repsPorMiniSerie: 3, pausaSegundos: 10 }) }),
            serie('pa', { tecnica: tecnica('PARTIAL_REPS', { repsParciais: 5, regiao: 'ALONGADA' }) }),
            serie('fo', { tecnica: tecnica('FORCED_REPS', { repsAssistidas: 2 }) }),
          ],
        }),
        ...exerciciosDosGrupos,
        exercicio('esteira', {
          nome: 'Esteira',
          modalidade: 'CARDIO',
          unidade: 'nenhuma',
          series: [serie('e1', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 30, distanciaKm: 5, ritmo: '6:00', zona: 2, intervalos: null } })],
        }),
      ],
      gruposDaSessao,
      { nome: 'Segunda', diaSemana: 1, observacao: 'Observação da sessão' },
    ),
    sessao('qui', [], [], { nome: 'Quinta', diaSemana: 4, tipo: 'DESCANSO_ATIVO', cardio: 'Cardio' }),
  ],
});

const dieta: ConteudoDieta = normalizarDieta({
  objetivo: 'Objetivo',
  profissional: 'Profissional',
  observacoes: 'Observações',
  aguaLitros: 3,
  orientacoes: [{ titulo: 'Título da orientação', texto: 'Texto da orientação' }],
  refeicoes: [
    {
      nome: 'Café',
      horario: '08:00',
      observacao: 'Observação da refeição',
      modoDePreparo: 'Modo de preparo\nSegunda linha',
      opcoes: [
        { rotulo: 'A', itens: [{ nome: 'Pão', quantidade: 50, unidade: 'g', kcal: 133, proteina: 4, carboidrato: 24, gordura: 1 }] },
        { rotulo: 'B', itens: [{ nome: 'Aveia', quantidade: 40, unidade: 'g', kcal: 99, proteina: 1, carboidrato: 1, gordura: 1 }] },
      ],
    },
  ],
  suplementacao: [{ uid: 's1', nome: 'Suplemento', dose: 'Dose', horario: 'Horário', observacao: 'Observação', link: 'https://loja.exemplo/produto' }],
  ergogenicos: [{ uid: 'e1', nome: 'Item', principioAtivo: 'Princípio', concentracao: '200 mg', dose: 'Dose', horario: 'Horário', observacao: 'Obs', prescricao: 'Prescrição' }],
});

const mobilidade = normalizarMobilidade({
  orientacoes: 'Orientações',
  secoes: [{ uid: 's1', titulo: 'Seção', itens: [{ uid: 'i1', nome: 'Gato-camelo', prescricao: '2x30s', videoUrl: 'https://youtu.be/abc' }] }],
});

const linhaDaLista = (chave: string, extra: Partial<LinhaDaLista> = {}): LinhaDaLista => ({
  chave, nome: 'Arroz', unidade: 'g', quantidade: 1225, cru: true, bruto: true, semFator: false,
  naDieta: 1050, quantidadeCru: 420, fatorCorrecao: 1.1, fatorCoccao: 2.5, grupo: 'Cereais e derivados', ...extra,
});

describe('PDF do treino não deixa texto virar HTML', () => {
  conferir('treino', documentoTreino as never, { ...base, inicio: '2026-10-05', fim: '2026-10-20', versao: 2, conteudo: treino, instrucoesTreino: 'Instruções globais' });
});

describe('PDF da dieta não deixa texto virar HTML', () => {
  conferir('dieta', documentoDieta as never, { ...base, versao: 1, conteudo: dieta, pesos: [{ id: 'p', data: '2026-10-01', pesoKg: 80, variacao: -1, observacao: 'Observação do peso' }] });
  conferir('dieta com lista de compras', documentoDieta as never, {
    ...base, versao: 1, conteudo: dieta, pesos: [],
    lista: { periodo: 'mes', opcoes: ['Café: opção B'], linhas: [linhaDaLista('a'), linhaDaLista('b', { semFator: true, cru: false, bruto: false, fatorCorrecao: null, fatorCoccao: null })], mostrarFatores: true },
  });
});

describe('PDF da mobilidade não deixa texto virar HTML', () => {
  conferir('mobilidade', documentoMobilidade as never, { ...base, versao: 3, conteudo: mobilidade });
});

describe('PDF de cargas não deixa texto virar HTML', () => {
  const linha = { data: '2026-10-07', carga: 90, repeticoes: 6, etapas: '4+4 = 8', cargaVariavel: false, volume: { valor: 540, completo: true }, series: 5, semCarga: false, observacoes: ['Observação do aluno'] };
  conferir('cargas', documentoCargas as never, {
    ...base, aluno: 'Aluno', de: '2026-10-01', ate: '2026-10-14',
    divisoes: [{ chave: 'd', nome: 'Quarta - Pernas', exercicios: [{ chave: 'x', nome: 'Mesa flexora', linhas: [linha, { ...linha, data: '2026-10-14', carga: null, etapas: null }] }] }],
  });
});

describe('PDF da lista de compras não deixa texto virar HTML', () => {
  conferir('lista de compras', documentoListaDeCompras as never, {
    ...base, versao: 2, periodo: 'semana', opcoes: ['Café: opção B'],
    linhas: [linhaDaLista('a'), linhaDaLista('b', { semFator: true, cru: false, bruto: false, fatorCorrecao: null, fatorCoccao: null })],
  });
  const linhas = [linhaDaLista('a'), linhaDaLista('b')];
  const marcacoes = gravarAvulso(ajustarQuantidade(MARCACOES_VAZIAS, 'a', { quantidade: '1', unidade: 'pacote' }), { id: 'x', nome: 'Café', quantidade: '2', unidade: 'kg' });
  conferir('lista de compras do aluno (ajuste e avulso)', documentoListaDeCompras as never, {
    ...base, versao: 2, periodo: 'duasSemanas', opcoes: [], linhas, itensDoAluno: itensDoAluno(linhas, marcacoes),
  });
  conferir('lista de compras (prévia, sem aluno)', documentoListaDeCompras as never, {
    ...base, aluno: null, versao: null, periodo: 'mes', opcoes: [], linhas: [linhaDaLista('a')],
  });
});

describe('cor da marca nunca chega crua ao CSS nem ao HTML', () => {
  const cor = 'red;}</style><script>alert(1)</script>';
  const geradores: Record<string, (m: Marca) => Documento> = {
    treino: (m) => documentoTreino({ ...base, marca: m, inicio: null, fim: null, versao: 1, conteudo: treino, instrucoesTreino: null }),
    dieta: (m) => documentoDieta({ ...base, marca: m, versao: 1, conteudo: dieta, pesos: [] }),
    mobilidade: (m) => documentoMobilidade({ ...base, marca: m, versao: 1, conteudo: mobilidade }),
    cargas: (m) => documentoCargas({ ...base, marca: m, de: '2026-10-01', ate: '2026-10-14', divisoes: [] }),
    'lista de compras': (m) => documentoListaDeCompras({ ...base, marca: m, versao: 1, periodo: 'semana', opcoes: [], linhas: [] }),
  };
  for (const [nome, gerar] of Object.entries(geradores)) {
    it(`${nome}: cor fora de #RRGGBB cai no neutro`, () => {
      const d = gerar({ ...marca, corPrimaria: cor });
      expect(d.css).not.toContain('<script');
      expect(d.css).not.toContain('red;}');
      expect(d.corpo).not.toContain('<script');
      expect(d.corpo).not.toContain('red;}');
    });
  }
});
