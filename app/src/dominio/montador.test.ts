import {
  alterarProp,
  buscarBloco,
  criarBloco,
  duplicar,
  inserir,
  inserirDaPaleta,
  lerJson,
  lerPontosDoGrafico,
  lerSelosDoTexto,
  montadorLiberado,
  mover,
  nomeDoArquivoJson,
  paraJson,
  remover,
  TIPOS_DE_BLOCO,
  VERSAO_MONTADOR,
  type Bloco,
  type Rascunho,
} from './montador';
import { criarRascunhoDeModelo, MODELOS_INICIAIS } from '../montador/modelosIniciais';

let mockContadorUid = 0;
jest.mock('./uid', () => ({ novoUid: () => `uid-${++mockContadorUid}` }));

function rascunhoVazio(): Rascunho {
  return {
    versao: VERSAO_MONTADOR,
    nome: 'Rascunho de teste',
    largura: 1280,
    tema: 'claro',
    blocos: [],
  };
}

describe('montadorLiberado', () => {
  const env = process.env as Record<string, string | undefined>;
  const nodeEnvOriginal = env.NODE_ENV;
  const montadorOriginal = env.EXPO_PUBLIC_MONTADOR;

  afterEach(() => {
    if (nodeEnvOriginal === undefined) {
      delete env.NODE_ENV;
    } else {
      env.NODE_ENV = nodeEnvOriginal;
    }
    if (montadorOriginal === undefined) {
      delete env.EXPO_PUBLIC_MONTADOR;
    } else {
      env.EXPO_PUBLIC_MONTADOR = montadorOriginal;
    }
  });

  it('devolve false com NODE_ENV=production e sem EXPO_PUBLIC_MONTADOR', () => {
    env.NODE_ENV = 'production';
    delete env.EXPO_PUBLIC_MONTADOR;
    expect(montadorLiberado()).toBe(false);
  });

  it('devolve false com NODE_ENV=production e EXPO_PUBLIC_MONTADOR diferente de 1', () => {
    env.NODE_ENV = 'production';
    env.EXPO_PUBLIC_MONTADOR = '0';
    expect(montadorLiberado()).toBe(false);
  });

  it('devolve true com NODE_ENV=production e EXPO_PUBLIC_MONTADOR=1', () => {
    env.NODE_ENV = 'production';
    env.EXPO_PUBLIC_MONTADOR = '1';
    expect(montadorLiberado()).toBe(true);
  });

  it('devolve true fora de produção mesmo sem EXPO_PUBLIC_MONTADOR', () => {
    env.NODE_ENV = 'development';
    delete env.EXPO_PUBLIC_MONTADOR;
    expect(montadorLiberado()).toBe(true);
  });
});

describe('inserir e inserirDaPaleta', () => {
  it('insere no fim quando não há alvo e abaixo ou dentro quando há alvo', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'cabecalho');
    r = inserir(r, 'cartao', r.blocos[0].id, 'abaixo');
    expect(r.blocos.map((b) => b.tipo)).toEqual(['cabecalho', 'cartao']);

    const cartaoId = r.blocos[1].id;
    r = inserir(r, 'texto', cartaoId, 'dentro');
    r = inserir(r, 'botao', r.blocos[1].filhos![0].id, 'abaixo');
    expect(r.blocos[1].filhos?.map((f) => f.tipo)).toEqual(['texto', 'botao']);
  });

  it('recusa inserir dentro de bloco que não aceita filhos ou filho de tipo não permitido', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'cabecalho');
    const cabId = r.blocos[0].id;
    expect(inserir(r, 'texto', cabId, 'dentro')).toBe(r);

    r = inserir(r, 'listaDeLinhas');
    const listaId = r.blocos[1].id;
    expect(inserir(r, 'botao', listaId, 'dentro')).toBe(r);
    const comLinha = inserir(r, 'linha', listaId, 'dentro');
    expect(comLinha.blocos[1].filhos?.map((f) => f.tipo)).toEqual(['linha']);

    r = inserir(r, 'linhaDeBotoes');
    const botoesId = r.blocos[2].id;
    expect(inserir(r, 'texto', botoesId, 'dentro')).toBe(r);
    const comBotao = inserir(r, 'botao', botoesId, 'dentro');
    expect(comBotao.blocos[2].filhos?.map((f) => f.tipo)).toEqual(['botao']);
  });

  it('inserirDaPaleta coloca dentro quando o contêiner selecionado está vazio e abaixo quando já tem filho', () => {
    let r = rascunhoVazio();
    const p1 = inserirDaPaleta(r, 'cartao', null);
    r = p1.rascunho;
    const cartaoId = p1.novoId!;

    // Cartão vazio selecionado: entra dentro
    const p2 = inserirDaPaleta(r, 'texto', cartaoId);
    r = p2.rascunho;
    expect(r.blocos[0].filhos).toHaveLength(1);

    // Cartão com filho selecionado: entra abaixo do cartão
    const p3 = inserirDaPaleta(r, 'botao', cartaoId);
    r = p3.rascunho;
    expect(r.blocos.map((b) => b.tipo)).toEqual(['cartao', 'botao']);
  });

  it('inserirDaPaleta sobe para o pai quando o filho selecionado está em listaDeLinhas e o novo tipo é botão', () => {
    let r = rascunhoVazio();
    const pLista = inserirDaPaleta(r, 'listaDeLinhas', null);
    const pLinha = inserirDaPaleta(pLista.rascunho, 'linha', pLista.novoId);
    const pBotao = inserirDaPaleta(pLinha.rascunho, 'botao', pLinha.novoId);
    expect(pBotao.rascunho.blocos.map((b) => b.tipo)).toEqual(['listaDeLinhas', 'botao']);
  });
});

describe('mover', () => {
  it('move para cima e para baixo no mesmo pai e não faz nada no topo ou no fim', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'cabecalho');
    r = inserir(r, 'cartao');
    r = inserir(r, 'botao');
    const [id0, id1, id2] = r.blocos.map((b) => b.id);

    expect(mover(r, id0, 'cima')).toBe(r);
    expect(mover(r, id2, 'baixo')).toBe(r);

    const desceu = mover(r, id0, 'baixo');
    expect(desceu.blocos.map((b) => b.id)).toEqual([id1, id0, id2]);

    const subiu = mover(desceu, id0, 'cima');
    expect(subiu.blocos.map((b) => b.id)).toEqual([id0, id1, id2]);
  });

  it('move filhos dentro de um cartão sem sair do pai', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'cartao');
    const cartaoId = r.blocos[0].id;
    r = inserir(r, 'texto', cartaoId, 'dentro');
    r = inserir(r, 'selo', cartaoId, 'dentro');
    const [f0, f1] = r.blocos[0].filhos!.map((f) => f.id);

    expect(mover(r, f0, 'cima')).toBe(r);
    const trocado = mover(r, f1, 'cima');
    expect(trocado.blocos[0].filhos!.map((f) => f.id)).toEqual([f1, f0]);
  });
});

describe('duplicar e remover', () => {
  it('duplica toda a subárvore com ids novos preservando tipos e props', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'cartao');
    const cartaoId = r.blocos[0].id;
    r = alterarProp(r, cartaoId, 'titulo', 'Original');
    r = inserir(r, 'texto', cartaoId, 'dentro');
    const filhoId = r.blocos[0].filhos![0].id;

    const dup = duplicar(r, cartaoId);
    expect(dup.blocos).toHaveLength(2);
    expect(dup.blocos[1].id).not.toBe(cartaoId);
    expect(dup.blocos[1].props.titulo).toBe('Original');
    expect(dup.blocos[1].filhos![0].id).not.toBe(filhoId);
    expect(dup.blocos[1].filhos![0].tipo).toBe('texto');
  });

  it('remove bloco na raiz ou dentro de um pai', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'cartao');
    const cartaoId = r.blocos[0].id;
    r = inserir(r, 'texto', cartaoId, 'dentro');
    const filhoId = r.blocos[0].filhos![0].id;

    const semFilho = remover(r, filhoId);
    expect(semFilho.blocos[0].filhos).toHaveLength(0);

    const vazio = remover(semFilho, cartaoId);
    expect(vazio.blocos).toHaveLength(0);
  });
});

describe('alterarProp', () => {
  it('altera prop declarada com tipo certo e recusa prop não declarada ou tipo inválido', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'botao');
    const id = r.blocos[0].id;

    const atualizado = alterarProp(r, id, 'rotulo', 'Publicar plano');
    expect( buscarBloco(atualizado.blocos, id)?.props.rotulo).toBe('Publicar plano');

    // Chave não declarada no catálogo de `botao`
    expect(alterarProp(atualizado, id, 'inexistente', 'valor')).toBe(atualizado);
    // Tipo inválido (esperava booleano em `cheio`)
    expect(alterarProp(atualizado, id, 'cheio', 'sim')).toBe(atualizado);
    // Opção fora da lista em `tipo`
    expect(alterarProp(atualizado, id, 'tipo', 'invalido')).toBe(atualizado);
  });
});

describe('paraJson e lerJson', () => {
  it('exporta e reimporta o mesmo rascunho mantendo toda a estrutura', () => {
    let r = rascunhoVazio();
    r = inserir(r, 'cabecalho');
    r = alterarProp(r, r.blocos[0].id, 'titulo', 'Alunos');
    r = inserir(r, 'cartao');
    const cartaoId = r.blocos[1].id;
    r = alterarProp(r, cartaoId, 'titulo', 'Para revisar');
    r = inserir(r, 'linha', cartaoId, 'dentro');
    r = inserir(r, 'botao');

    const json = paraJson(r);
    const lido = lerJson(json);
    expect(lido).toEqual({ ok: true, rascunho: r });
  });

  it('recusa tipo desconhecido sem repetir o valor na mensagem', () => {
    const ruim = JSON.stringify({
      versao: 1,
      nome: 'Teste',
      largura: 390,
      tema: 'escuro',
      blocos: [{ id: 'b1', tipo: 'blocoSecretoInvalido', props: {} }],
    });
    const res = lerJson(ruim);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.erro).not.toContain('blocoSecretoInvalido');
    }
  });

  it('recusa propriedade desconhecida no bloco', () => {
    const ruim = JSON.stringify({
      versao: 1,
      nome: 'Teste',
      largura: 390,
      tema: 'claro',
      blocos: [{ id: 'b1', tipo: 'cabecalho', props: { titulo: 'Oi', hack: '123' } }],
    });
    const res = lerJson(ruim);
    expect(res).toEqual({ ok: false, erro: 'Propriedade desconhecida em um bloco.' });
  });

  it('recusa filhos onde o tipo não aceita filhos', () => {
    const ruim = JSON.stringify({
      versao: 1,
      nome: 'Teste',
      largura: 390,
      tema: 'claro',
      blocos: [{ id: 'b1', tipo: 'cabecalho', props: { titulo: 'Oi', subtitulo: '' }, filhos: [] }],
    });
    const res = lerJson(ruim);
    expect(res).toEqual({ ok: false, erro: 'Um bloco que não aceita filhos recebeu filhos.' });
  });

  it('recusa mais de 500 blocos', () => {
    const blocos = Array.from({ length: 501 }, (_, i) => ({
      id: `b-${i}`,
      tipo: 'texto',
      props: { texto: 'Item', variante: 'corpo', nivel: 'nenhum' },
    }));
    const res = lerJson(
      JSON.stringify({ versao: 1, nome: 'Muitos', largura: 1280, tema: 'claro', blocos }),
    );
    expect(res).toEqual({ ok: false, erro: 'O rascunho passa do limite de 500 blocos.' });
  });

  it('recusa profundidade maior que 6', () => {
    let aninhado: Bloco = criarBloco('texto');
    for (let i = 0; i < 6; i++) {
      aninhado = criarBloco('cartao', {}, [aninhado]);
    }
    const res = lerJson(
      JSON.stringify({ versao: 1, nome: 'Profundo', largura: 1280, tema: 'claro', blocos: [aninhado] }),
    );
    expect(res).toEqual({ ok: false, erro: 'Os blocos passam da profundidade máxima (6).' });
  });

  it('recusa texto de 3.000 caracteres em propriedade ou no nome', () => {
    const longo = 'a'.repeat(3000);
    const res = lerJson(
      JSON.stringify({
        versao: 1,
        nome: 'Teste',
        largura: 1280,
        tema: 'claro',
        blocos: [{ id: 'b1', tipo: 'texto', props: { texto: longo, variante: 'corpo', nivel: 'nenhum' } }],
      }),
    );
    expect(res).toEqual({ ok: false, erro: 'Texto acima do limite de 2.000 caracteres.' });
  });

  it('recusa JSON acima de 200 KB', () => {
    const gigante = ' '.repeat(205 * 1024);
    const res = lerJson(gigante);
    expect(res).toEqual({ ok: false, erro: 'O JSON passa do limite de 200 KB.' });
  });

  it('preserva texto com tags como string pura sem executar nem converter em HTML', () => {
    const textoHtml = '<script>alert("xss")</script><b>Título</b>';
    const r: Rascunho = {
      versao: 1,
      nome: 'Segurança',
      largura: 390,
      tema: 'escuro',
      blocos: [{ id: 'b1', tipo: 'texto', props: { texto: textoHtml, variante: 'corpo', nivel: 'nenhum' } }],
    };
    const lido = lerJson(paraJson(r));
    expect(lido.ok).toBe(true);
    if (lido.ok) {
      expect(lido.rascunho.blocos[0].props.texto).toBe(textoHtml);
    }
  });
});

describe('auxiliares de formatação e leitura', () => {
  it('gera o nome do arquivo JSON em slug', () => {
    expect(nomeDoArquivoJson('Histórico do aluno, proposta 2')).toBe('montador-historico-do-aluno-proposta-2.json');
    expect(nomeDoArquivoJson('   ')).toBe('montador-rascunho.json');
  });

  it('lê selos e pontos do gráfico a partir do texto', () => {
    expect(lerSelosDoTexto('Para revisar;atencao\nEm dia;sucesso\nOutro;desconhecido')).toEqual([
      { texto: 'Para revisar', tipo: 'atencao' },
      { texto: 'Em dia', tipo: 'sucesso' },
      { texto: 'Outro', tipo: 'neutro' },
    ]);
    expect(lerPontosDoGrafico('01/10;78,5\n15/10;80\ninvalido')).toEqual([
      { rotulo: '01/10', valor: 78.5 },
      { rotulo: '15/10', valor: 80 },
    ]);
  });

  it('valida todos os tipos do catálogo e todos os modelos iniciais em ida e volta JSON', () => {
    const todosOsTipos: Rascunho = {
      versao: VERSAO_MONTADOR,
      nome: 'Catálogo completo',
      largura: 1280,
      tema: 'claro',
      blocos: TIPOS_DE_BLOCO.map((tipo) => criarBloco(tipo)),
    };
    const lidoCatalogo = lerJson(paraJson(todosOsTipos));
    expect(lidoCatalogo).toEqual({ ok: true, rascunho: todosOsTipos });

    for (const modelo of MODELOS_INICIAIS) {
      const rascunho = criarRascunhoDeModelo(modelo.chave);
      const lido = lerJson(paraJson(rascunho));
      expect(lido).toEqual({ ok: true, rascunho });
    }
  });
});
