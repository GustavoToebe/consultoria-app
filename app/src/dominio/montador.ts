import { semAcento } from './telas';
import { novoUid } from './uid';
import type { TomDoAlerta } from '../ui/Estados';
import type { TipoSelo } from '../ui/Selo';
import type { Variante } from '../ui/tipografia';

export const VERSAO_MONTADOR = 1;

export const LIMITE_BLOCOS = 500;
export const PROFUNDIDADE_MAXIMA = 6;
export const LIMITE_TEXTO_CAMPO = 2000;
export const LIMITE_JSON_BYTES = 200 * 1024;

export type Largura = 390 | 1280;
export type TemaDoMontador = 'claro' | 'areia' | 'escuro';
export type GrupoDoBloco = 'Estrutura' | 'Listas' | 'Formulário' | 'Status' | 'Dados' | 'Rascunho';

export const GRUPOS_DO_CATALOGO: readonly GrupoDoBloco[] = [
  'Estrutura',
  'Listas',
  'Formulário',
  'Status',
  'Dados',
  'Rascunho',
];

export const TIPOS_DE_BLOCO = [
  'cabecalho',
  'cartao',
  'faixaDeGrupo',
  'grade',
  'abas',
  'texto',
  'listaDeLinhas',
  'linha',
  'itemDeLista',
  'tabela',
  'campo',
  'campoLeitura',
  'escolha',
  'interruptor',
  'botao',
  'linhaDeBotoes',
  'selo',
  'alerta',
  'barraProgresso',
  'graficoLinha',
  'chips',
  'anotacao',
  'pecaNova',
] as const;

export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export type TipoBotaoMontador = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'perigoTexto';
export type AlturaPecaNova = 'P' | 'M' | 'G';

export type CampoDoBloco =
  | { chave: string; rotulo: string; tipo: 'texto'; ajuda?: string }
  | { chave: string; rotulo: string; tipo: 'multilinhas'; ajuda?: string; linhas?: number }
  | { chave: string; rotulo: string; tipo: 'booleano'; ajuda?: string }
  | { chave: string; rotulo: string; tipo: 'numero'; ajuda?: string; inteiro?: boolean }
  | {
      chave: string;
      rotulo: string;
      tipo: 'escolha';
      opcoes: readonly { valor: string; rotulo: string }[];
      ajuda?: string;
    };

export interface DefinicaoDeBloco {
  tipo: TipoDeBloco;
  rotulo: string;
  grupo: GrupoDoBloco;
  aceitaFilhos: boolean;
  /** Quando definido, só aceita filhos destes tipos (`listaDeLinhas` → `linha`, `linhaDeBotoes` → `botao`). */
  tiposDeFilho?: readonly TipoDeBloco[];
  campos: readonly CampoDoBloco[];
  padrao: Record<string, unknown>;
}

export interface Bloco {
  id: string;
  tipo: TipoDeBloco;
  props: Record<string, unknown>;
  filhos?: Bloco[];
}

export interface Rascunho {
  versao: typeof VERSAO_MONTADOR;
  nome: string;
  largura: Largura;
  tema: TemaDoMontador;
  blocos: Bloco[];
  observacoes?: string;
}

const OPCOES_TIPO_SELO: readonly { valor: TipoSelo; rotulo: string }[] = [
  { valor: 'sucesso', rotulo: 'Sucesso' },
  { valor: 'atencao', rotulo: 'Atenção' },
  { valor: 'perigo', rotulo: 'Perigo' },
  { valor: 'neutro', rotulo: 'Neutro' },
];

const OPCOES_TIPO_BOTAO: readonly { valor: TipoBotaoMontador; rotulo: string }[] = [
  { valor: 'primario', rotulo: 'Primário' },
  { valor: 'secundario', rotulo: 'Secundário' },
  { valor: 'perigo', rotulo: 'Perigo' },
  { valor: 'fantasma', rotulo: 'Fantasma' },
  { valor: 'perigoTexto', rotulo: 'Perigo (texto)' },
];

const OPCOES_TOM_ALERTA: readonly { valor: TomDoAlerta; rotulo: string }[] = [
  { valor: 'atencao', rotulo: 'Atenção' },
  { valor: 'perigo', rotulo: 'Perigo' },
  { valor: 'sucesso', rotulo: 'Sucesso' },
];

const OPCOES_VARIANTE_TEXTO: readonly { valor: Variante; rotulo: string }[] = [
  { valor: 'corpo', rotulo: 'Corpo' },
  { valor: 'suave', rotulo: 'Suave' },
  { valor: 'pequeno', rotulo: 'Pequeno' },
  { valor: 'rotulo', rotulo: 'Rótulo' },
  { valor: 'secao', rotulo: 'Seção (caixa alta)' },
  { valor: 'bloco', rotulo: 'Bloco' },
  { valor: 'subtitulo', rotulo: 'Subtítulo' },
  { valor: 'titulo', rotulo: 'Título' },
  { valor: 'destaque', rotulo: 'Destaque' },
  { valor: 'numero', rotulo: 'Número' },
];

const OPCOES_NIVEL_TEXTO: readonly { valor: string; rotulo: string }[] = [
  { valor: 'nenhum', rotulo: 'Nenhum' },
  { valor: '2', rotulo: 'h2' },
  { valor: '3', rotulo: 'h3' },
  { valor: '1', rotulo: 'h1' },
];

export const DEFINICOES_DE_BLOCO: Record<TipoDeBloco, DefinicaoDeBloco> = {
  cabecalho: {
    tipo: 'cabecalho',
    rotulo: 'Cabeçalho',
    grupo: 'Estrutura',
    aceitaFilhos: false,
    campos: [
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
      { chave: 'subtitulo', rotulo: 'Subtítulo', tipo: 'texto' },
    ],
    padrao: { titulo: 'Alunos', subtitulo: 'Acompanhamento e planos em uso' },
  },
  cartao: {
    tipo: 'cartao',
    rotulo: 'Cartão',
    grupo: 'Estrutura',
    aceitaFilhos: true,
    campos: [
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      { chave: 'recolhivel', rotulo: 'Recolhível', tipo: 'booleano' },
      { chave: 'faixa', rotulo: 'Faixa no topo', tipo: 'booleano' },
    ],
    padrao: { titulo: 'Para revisar', descricao: '', recolhivel: false, faixa: true },
  },
  faixaDeGrupo: {
    tipo: 'faixaDeGrupo',
    rotulo: 'Faixa de grupo',
    grupo: 'Estrutura',
    aceitaFilhos: false,
    campos: [
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
      { chave: 'resumo', rotulo: 'Resumo', tipo: 'texto' },
      {
        chave: 'linha',
        rotulo: 'Linha inferior',
        tipo: 'escolha',
        opcoes: [
          { valor: 'forte', rotulo: 'Forte (3 px)' },
          { valor: 'fina', rotulo: 'Fina (1 px)' },
        ],
      },
    ],
    padrao: { titulo: 'Segunda-feira · Treino A', resumo: '5 exercícios · 16 séries', linha: 'forte' },
  },
  grade: {
    tipo: 'grade',
    rotulo: 'Grade',
    grupo: 'Estrutura',
    aceitaFilhos: true,
    campos: [],
    padrao: {},
  },
  abas: {
    tipo: 'abas',
    rotulo: 'Abas',
    grupo: 'Estrutura',
    aceitaFilhos: false,
    campos: [
      { chave: 'abas', rotulo: 'Rótulos das abas (um por linha)', tipo: 'multilinhas', linhas: 3 },
      { chave: 'ativa', rotulo: 'Aba ativa', tipo: 'texto' },
    ],
    padrao: { abas: 'Treino\nDieta\nHistórico', ativa: 'Treino' },
  },
  texto: {
    tipo: 'texto',
    rotulo: 'Texto',
    grupo: 'Estrutura',
    aceitaFilhos: false,
    campos: [
      { chave: 'texto', rotulo: 'Texto', tipo: 'multilinhas', linhas: 2 },
      { chave: 'variante', rotulo: 'Variante', tipo: 'escolha', opcoes: OPCOES_VARIANTE_TEXTO },
      { chave: 'nivel', rotulo: 'Nível de título', tipo: 'escolha', opcoes: OPCOES_NIVEL_TEXTO },
    ],
    padrao: { texto: 'Texto de exemplo na tela.', variante: 'corpo', nivel: 'nenhum' },
  },
  listaDeLinhas: {
    tipo: 'listaDeLinhas',
    rotulo: 'Lista de linhas',
    grupo: 'Listas',
    aceitaFilhos: true,
    tiposDeFilho: ['linha'],
    campos: [{ chave: 'emColunas', rotulo: 'Em colunas no PC', tipo: 'booleano' }],
    padrao: { emColunas: false },
  },
  linha: {
    tipo: 'linha',
    rotulo: 'Linha da lista',
    grupo: 'Listas',
    aceitaFilhos: false,
    campos: [
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
      { chave: 'metadados', rotulo: 'Metadados', tipo: 'texto' },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      {
        chave: 'selos',
        rotulo: 'Selos (texto;tipo por linha)',
        tipo: 'multilinhas',
        linhas: 2,
        ajuda: 'Tipos: sucesso, atencao, perigo ou neutro. Ex.: Para revisar;atencao',
      },
    ],
    padrao: {
      titulo: 'Ana Carolina Souza',
      metadados: 'Treino A/B/C · Atualização enviada hoje',
      descricao: '',
      selos: 'Para revisar;atencao',
    },
  },
  itemDeLista: {
    tipo: 'itemDeLista',
    rotulo: 'Item de lista',
    grupo: 'Listas',
    aceitaFilhos: false,
    campos: [
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
      { chave: 'detalhe', rotulo: 'Detalhe', tipo: 'texto' },
      { chave: 'seloTexto', rotulo: 'Texto do selo', tipo: 'texto' },
      { chave: 'seloTipo', rotulo: 'Tipo do selo', tipo: 'escolha', opcoes: OPCOES_TIPO_SELO },
    ],
    padrao: {
      titulo: 'Histórico de avaliações',
      detalhe: '3 registros neste ciclo',
      seloTexto: 'Em dia',
      seloTipo: 'sucesso',
    },
  },
  tabela: {
    tipo: 'tabela',
    rotulo: 'Tabela',
    grupo: 'Listas',
    aceitaFilhos: false,
    campos: [
      { chave: 'colunas', rotulo: 'Colunas (uma por linha)', tipo: 'multilinhas', linhas: 3 },
      {
        chave: 'linhas',
        rotulo: 'Linhas (células separadas por ;)',
        tipo: 'multilinhas',
        linhas: 3,
      },
    ],
    padrao: {
      colunas: 'Aluno\nPlano\nSituação',
      linhas: 'Ana Carolina;Hipertrofia;Em dia\nBruno Lima;Força;Para revisar',
    },
  },
  campo: {
    tipo: 'campo',
    rotulo: 'Campo',
    grupo: 'Formulário',
    aceitaFilhos: false,
    campos: [
      { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto' },
      { chave: 'valor', rotulo: 'Valor de exemplo', tipo: 'texto' },
      { chave: 'ajuda', rotulo: 'Ajuda', tipo: 'texto' },
      { chave: 'erro', rotulo: 'Erro', tipo: 'texto' },
      { chave: 'linhas', rotulo: 'Linhas', tipo: 'numero', inteiro: true },
    ],
    padrao: { rotulo: 'Nome do aluno', valor: 'Ana Carolina Souza', ajuda: '', erro: '', linhas: 1 },
  },
  campoLeitura: {
    tipo: 'campoLeitura',
    rotulo: 'Campo só leitura',
    grupo: 'Formulário',
    aceitaFilhos: false,
    campos: [
      { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto' },
      { chave: 'valor', rotulo: 'Valor', tipo: 'texto' },
    ],
    padrao: { rotulo: 'Objetivo', valor: 'Hipertrofia e condicionamento' },
  },
  escolha: {
    tipo: 'escolha',
    rotulo: 'Escolha',
    grupo: 'Formulário',
    aceitaFilhos: false,
    campos: [
      { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto' },
      { chave: 'opcoes', rotulo: 'Opções (uma por linha)', tipo: 'multilinhas', linhas: 3 },
      { chave: 'selecionada', rotulo: 'Opção selecionada', tipo: 'texto' },
    ],
    padrao: { rotulo: 'Modalidade', opcoes: 'Presencial\nOnline\nHíbrido', selecionada: 'Online' },
  },
  interruptor: {
    tipo: 'interruptor',
    rotulo: 'Interruptor',
    grupo: 'Formulário',
    aceitaFilhos: false,
    campos: [
      { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto' },
      { chave: 'ligado', rotulo: 'Ligado', tipo: 'booleano' },
    ],
    padrao: { rotulo: 'Mostrar gráficos de evolução', ligado: true },
  },
  botao: {
    tipo: 'botao',
    rotulo: 'Botão',
    grupo: 'Formulário',
    aceitaFilhos: false,
    campos: [
      { chave: 'rotulo', rotulo: 'Rótulo', tipo: 'texto' },
      { chave: 'tipo', rotulo: 'Tipo', tipo: 'escolha', opcoes: OPCOES_TIPO_BOTAO },
      { chave: 'desabilitado', rotulo: 'Desabilitado', tipo: 'booleano' },
      { chave: 'motivo', rotulo: 'Motivo (quando desabilitado)', tipo: 'texto' },
      { chave: 'cheio', rotulo: 'Largura cheia', tipo: 'booleano' },
    ],
    padrao: { rotulo: 'Salvar alterações', tipo: 'primario', desabilitado: false, motivo: '', cheio: false },
  },
  linhaDeBotoes: {
    tipo: 'linhaDeBotoes',
    rotulo: 'Linha de botões',
    grupo: 'Formulário',
    aceitaFilhos: true,
    tiposDeFilho: ['botao'],
    campos: [],
    padrao: {},
  },
  selo: {
    tipo: 'selo',
    rotulo: 'Selo',
    grupo: 'Status',
    aceitaFilhos: false,
    campos: [
      { chave: 'texto', rotulo: 'Texto', tipo: 'texto' },
      { chave: 'tipo', rotulo: 'Tipo', tipo: 'escolha', opcoes: OPCOES_TIPO_SELO },
    ],
    padrao: { texto: 'Em dia', tipo: 'sucesso' },
  },
  alerta: {
    tipo: 'alerta',
    rotulo: 'Alerta',
    grupo: 'Status',
    aceitaFilhos: false,
    campos: [
      { chave: 'tom', rotulo: 'Tom', tipo: 'escolha', opcoes: OPCOES_TOM_ALERTA },
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
      { chave: 'texto', rotulo: 'Texto', tipo: 'multilinhas', linhas: 2 },
    ],
    padrao: {
      tom: 'atencao',
      titulo: 'Atenção antes de publicar',
      texto: 'Confira os campos obrigatórios desta seção.',
    },
  },
  barraProgresso: {
    tipo: 'barraProgresso',
    rotulo: 'Barra de progresso',
    grupo: 'Status',
    aceitaFilhos: false,
    campos: [
      { chave: 'feitas', rotulo: 'Feitas', tipo: 'numero', inteiro: true },
      { chave: 'total', rotulo: 'Total', tipo: 'numero', inteiro: true },
    ],
    padrao: { feitas: 3, total: 5 },
  },
  graficoLinha: {
    tipo: 'graficoLinha',
    rotulo: 'Gráfico de linha',
    grupo: 'Dados',
    aceitaFilhos: false,
    campos: [
      {
        chave: 'pontos',
        rotulo: 'Pontos (data;valor por linha)',
        tipo: 'multilinhas',
        linhas: 3,
      },
      { chave: 'unidade', rotulo: 'Unidade', tipo: 'texto' },
    ],
    padrao: {
      pontos: '01/10;78,5\n15/10;79,2\n01/11;80,0',
      unidade: 'kg',
    },
  },
  chips: {
    tipo: 'chips',
    rotulo: 'Chips',
    grupo: 'Dados',
    aceitaFilhos: false,
    campos: [{ chave: 'rotulos', rotulo: 'Rótulos (um por linha)', tipo: 'multilinhas', linhas: 3 }],
    padrao: { rotulos: 'Todos\nPara revisar\nAtrasados\nEm dia' },
  },
  anotacao: {
    tipo: 'anotacao',
    rotulo: 'Anotação',
    grupo: 'Rascunho',
    aceitaFilhos: false,
    campos: [{ chave: 'texto', rotulo: 'Texto da anotação', tipo: 'multilinhas', linhas: 2 }],
    padrao: { texto: 'Aqui entra o gráfico de cargas da semana' },
  },
  pecaNova: {
    tipo: 'pecaNova',
    rotulo: 'Peça nova',
    grupo: 'Rascunho',
    aceitaFilhos: false,
    campos: [
      { chave: 'nome', rotulo: 'Nome da peça', tipo: 'texto' },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'multilinhas', linhas: 2 },
      {
        chave: 'altura',
        rotulo: 'Altura',
        tipo: 'escolha',
        opcoes: [
          { valor: 'P', rotulo: 'Pequena (P)' },
          { valor: 'M', rotulo: 'Média (M)' },
          { valor: 'G', rotulo: 'Grande (G)' },
        ],
      },
    ],
    padrao: {
      nome: 'Seletor de divisão da semana',
      descricao: 'Faixa horizontal com os dias de treino e indicador de concluído.',
      altura: 'M',
    },
  },
};

/** Libera a tela `/montador` apenas em desenvolvimento (`__DEV__`) ou quando `EXPO_PUBLIC_MONTADOR === '1'`. */
export function montadorLiberado(): boolean {
  const devGlobal = (globalThis as { __DEV__?: unknown }).__DEV__;
  const dev = typeof devGlobal === 'boolean' ? devGlobal : typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
  return dev || process.env.EXPO_PUBLIC_MONTADOR === '1';
}

export function ehTipoDeBloco(valor: unknown): valor is TipoDeBloco {
  return typeof valor === 'string' && (TIPOS_DE_BLOCO as readonly string[]).includes(valor);
}

/** Cria um bloco novo com as props padrão do catálogo. */
export function criarBloco(tipo: TipoDeBloco, propsParciais?: Record<string, unknown>, filhos?: Bloco[]): Bloco {
  const def = DEFINICOES_DE_BLOCO[tipo];
  const props: Record<string, unknown> = { ...def.padrao };
  if (propsParciais) {
    for (const campo of def.campos) {
      if (campo.chave in propsParciais && valorValidoDoCampo(campo, propsParciais[campo.chave])) {
        props[campo.chave] = propsParciais[campo.chave];
      }
    }
  }
  return def.aceitaFilhos ? { id: novoUid(), tipo, props, filhos: filhos ?? [] } : { id: novoUid(), tipo, props };
}

/** Diz se o bloco `pai` aceita um filho do `tipo` informado. */
export function podeInserirDentro(pai: Bloco, tipo: TipoDeBloco): boolean {
  const def = DEFINICOES_DE_BLOCO[pai.tipo];
  if (!def.aceitaFilhos) return false;
  if (def.tiposDeFilho && !def.tiposDeFilho.includes(tipo)) return false;
  return true;
}

function contarBlocos(blocos: readonly Bloco[]): number {
  let total = 0;
  for (const b of blocos) {
    total += 1 + (b.filhos ? contarBlocos(b.filhos) : 0);
  }
  return total;
}

/** Procura um bloco pelo `id` em toda a árvore. */
export function buscarBloco(blocos: readonly Bloco[], id: string): Bloco | null {
  for (const b of blocos) {
    if (b.id === id) return b;
    if (b.filhos) {
      const achado = buscarBloco(b.filhos, id);
      if (achado) return achado;
    }
  }
  return null;
}

/**
 * Insere um bloco novo do `tipo` no rascunho:
 * - sem `alvoId`: no fim da raiz;
 * - com `alvoId` e `posicao === 'dentro'`: no fim de `filhos` do alvo (se aceitar filhos e o tipo for permitido);
 * - com `alvoId` e `posicao === 'abaixo'`: logo abaixo do alvo no mesmo pai (se o pai aceitar o tipo).
 */
export function inserir(
  rascunho: Rascunho,
  tipo: TipoDeBloco,
  alvoId?: string,
  posicao: 'abaixo' | 'dentro' = 'abaixo',
): Rascunho {
  if (!ehTipoDeBloco(tipo)) return rascunho;
  if (contarBlocos(rascunho.blocos) >= LIMITE_BLOCOS) return rascunho;
  const novo = criarBloco(tipo);

  if (!alvoId) {
    return { ...rascunho, blocos: [...rascunho.blocos, novo] };
  }

  let inserido = false;

  const percorrer = (lista: readonly Bloco[], pai: Bloco | null, nivel: number): Bloco[] => {
    const saida: Bloco[] = [];
    for (const item of lista) {
      if (item.id === alvoId) {
        if (posicao === 'dentro') {
          if (podeInserirDentro(item, tipo) && nivel + 1 <= PROFUNDIDADE_MAXIMA) {
            inserido = true;
            saida.push({ ...item, filhos: [...(item.filhos ?? []), novo] });
            continue;
          }
          saida.push(item);
          continue;
        }
        // posicao === 'abaixo'
        const aceitoNoPai = pai === null || podeInserirDentro(pai, tipo);
        if (aceitoNoPai && nivel <= PROFUNDIDADE_MAXIMA) {
          inserido = true;
          saida.push(item, novo);
          continue;
        }
      }
      if (item.filhos) {
        const novosFilhos = percorrer(item.filhos, item, nivel + 1);
        if (novosFilhos !== item.filhos) {
          saida.push({ ...item, filhos: novosFilhos });
          continue;
        }
      }
      saida.push(item);
    }
    return inserido ? saida : (lista as Bloco[]);
  };

  const novosBlocos = percorrer(rascunho.blocos, null, 1);
  if (!inserido) return rascunho;
  return { ...rascunho, blocos: novosBlocos };
}

/**
 * Regra de clique na paleta:
 * - se nada estiver selecionado (ou o selecionado não existir): insere no fim da raiz;
 * - se o selecionado aceita filhos, está vazio e aceita `tipo`: insere `dentro`;
 * - caso contrário: insere `abaixo` do selecionado (ou do ancestral mais próximo que aceite `tipo`, se o pai imediato restringir filhos).
 */
export function inserirDaPaleta(
  rascunho: Rascunho,
  tipo: TipoDeBloco,
  selecionadoId: string | null,
  forcarAbaixo = false,
): { rascunho: Rascunho; novoId: string | null } {
  const antes = new Set<string>();
  const coletar = (lista: readonly Bloco[]) => {
    for (const b of lista) {
      antes.add(b.id);
      if (b.filhos) coletar(b.filhos);
    }
  };
  coletar(rascunho.blocos);

  let atualizado = rascunho;
  const alvo = selecionadoId ? buscarBloco(rascunho.blocos, selecionadoId) : null;
  if (!alvo) {
    atualizado = inserir(rascunho, tipo);
  } else if (!forcarAbaixo && podeInserirDentro(alvo, tipo) && (alvo.filhos?.length ?? 0) === 0) {
    atualizado = inserir(rascunho, tipo, alvo.id, 'dentro');
  } else {
    atualizado = inserir(rascunho, tipo, alvo.id, 'abaixo');
    // Se o pai imediato restringia o tipo (ex.: `linha` selecionada dentro de `listaDeLinhas` e clicou em `botao`),
    // sobe ao pai para inserir logo abaixo do contêiner.
    if (atualizado === rascunho) {
      const pai = encontrarPai(rascunho.blocos, alvo.id);
      if (pai) {
        atualizado = inserir(rascunho, tipo, pai.id, 'abaixo');
      }
    }
  }

  if (atualizado === rascunho) return { rascunho, novoId: null };
  let novoId: string | null = null;
  const acharNovo = (lista: readonly Bloco[]) => {
    for (const b of lista) {
      if (!antes.has(b.id)) {
        novoId = b.id;
        return;
      }
      if (b.filhos) acharNovo(b.filhos);
    }
  };
  acharNovo(atualizado.blocos);
  return { rascunho: atualizado, novoId };
}

function encontrarPai(lista: readonly Bloco[], idFilho: string): Bloco | null {
  for (const item of lista) {
    if (item.filhos) {
      if (item.filhos.some((f) => f.id === idFilho)) return item;
      const dentro = encontrarPai(item.filhos, idFilho);
      if (dentro) return dentro;
    }
  }
  return null;
}

/** Move um bloco para cima ou para baixo dentro do mesmo pai; no topo ou no fim não faz nada. */
export function mover(rascunho: Rascunho, id: string, direcao: 'cima' | 'baixo'): Rascunho {
  let movido = false;

  const percorrer = (lista: readonly Bloco[]): Bloco[] => {
    const idx = lista.findIndex((b) => b.id === id);
    if (idx >= 0) {
      const destino = direcao === 'cima' ? idx - 1 : idx + 1;
      if (destino < 0 || destino >= lista.length) return lista as Bloco[];
      movido = true;
      const copia = [...lista];
      const [item] = copia.splice(idx, 1);
      copia.splice(destino, 0, item);
      return copia;
    }
    return lista.map((item) => {
      if (!item.filhos) return item;
      const novosFilhos = percorrer(item.filhos);
      return novosFilhos === item.filhos ? item : { ...item, filhos: novosFilhos };
    });
  };

  const novosBlocos = percorrer(rascunho.blocos);
  return movido ? { ...rascunho, blocos: novosBlocos } : rascunho;
}

function clonarComNovosIds(bloco: Bloco): Bloco {
  return {
    id: novoUid(),
    tipo: bloco.tipo,
    props: { ...bloco.props },
    ...(bloco.filhos ? { filhos: bloco.filhos.map(clonarComNovosIds) } : {}),
  };
}

/** Duplica um bloco logo abaixo dele, gerando novos `id`s em toda a subárvore. */
export function duplicar(rascunho: Rascunho, id: string): Rascunho {
  const original = buscarBloco(rascunho.blocos, id);
  if (!original) return rascunho;
  const totalAtual = contarBlocos(rascunho.blocos);
  const tamanhoSubarvore = contarBlocos([original]);
  if (totalAtual + tamanhoSubarvore > LIMITE_BLOCOS) return rascunho;

  let duplicado = false;
  const percorrer = (lista: readonly Bloco[]): Bloco[] => {
    const idx = lista.findIndex((b) => b.id === id);
    if (idx >= 0) {
      duplicado = true;
      const copia = [...lista];
      copia.splice(idx + 1, 0, clonarComNovosIds(lista[idx]));
      return copia;
    }
    return lista.map((item) => {
      if (!item.filhos) return item;
      const novosFilhos = percorrer(item.filhos);
      return novosFilhos === item.filhos ? item : { ...item, filhos: novosFilhos };
    });
  };

  const novosBlocos = percorrer(rascunho.blocos);
  return duplicado ? { ...rascunho, blocos: novosBlocos } : rascunho;
}

/** Remove um bloco (e toda a sua subárvore) pelo `id`. */
export function remover(rascunho: Rascunho, id: string): Rascunho {
  let removido = false;
  const percorrer = (lista: readonly Bloco[]): Bloco[] => {
    const filtrada = lista.filter((b) => {
      if (b.id === id) {
        removido = true;
        return false;
      }
      return true;
    });
    return filtrada.map((item) => {
      if (!item.filhos) return item;
      const novosFilhos = percorrer(item.filhos);
      return novosFilhos === item.filhos ? item : { ...item, filhos: novosFilhos };
    });
  };

  const novosBlocos = percorrer(rascunho.blocos);
  return removido ? { ...rascunho, blocos: novosBlocos } : rascunho;
}

function valorValidoDoCampo(campo: CampoDoBloco, valor: unknown): boolean {
  switch (campo.tipo) {
    case 'texto':
    case 'multilinhas':
      return typeof valor === 'string' && valor.length <= LIMITE_TEXTO_CAMPO;
    case 'booleano':
      return typeof valor === 'boolean';
    case 'numero':
      if (typeof valor !== 'number' || !Number.isFinite(valor)) return false;
      return campo.inteiro ? Number.isInteger(valor) : true;
    case 'escolha':
      return typeof valor === 'string' && campo.opcoes.some((o) => o.valor === valor);
  }
}

/**
 * Altera uma propriedade do bloco `id`. Recusa chaves que o catálogo do tipo não declara ou valores com tipo inválido.
 */
export function alterarProp(rascunho: Rascunho, id: string, chave: string, valor: unknown): Rascunho {
  let alterado = false;

  const percorrer = (lista: readonly Bloco[]): Bloco[] =>
    lista.map((item) => {
      if (item.id === id) {
        const def = DEFINICOES_DE_BLOCO[item.tipo];
        const campo = def.campos.find((c) => c.chave === chave);
        if (!campo || !valorValidoDoCampo(campo, valor)) return item;
        alterado = true;
        return { ...item, props: { ...item.props, [chave]: valor } };
      }
      if (!item.filhos) return item;
      const novosFilhos = percorrer(item.filhos);
      return novosFilhos === item.filhos ? item : { ...item, filhos: novosFilhos };
    });

  const novosBlocos = percorrer(rascunho.blocos);
  return alterado ? { ...rascunho, blocos: novosBlocos } : rascunho;
}

/** Exporta o rascunho como JSON formatado. */
export function paraJson(rascunho: Rascunho): string {
  return JSON.stringify(rascunho, null, 2);
}

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

const CHAVES_RASCUNHO = new Set(['versao', 'nome', 'largura', 'tema', 'blocos', 'observacoes']);
const CHAVES_BLOCO = new Set(['id', 'tipo', 'props', 'filhos']);

/**
 * Lê e valida um JSON de rascunho: versão, tipos conhecidos, props declaradas e com o tipo certo, filhos só onde o
 * tipo aceita (e do tipo permitido), até 500 blocos, profundidade até 6, texto até 2.000 caracteres por campo e JSON
 * até 200 KB.
 */
export function lerJson(texto: string): { ok: true; rascunho: Rascunho } | { ok: false; erro: string } {
  if (typeof texto !== 'string') {
    return { ok: false, erro: 'Cole um JSON para importar.' };
  }
  const tamanhoBytes = typeof Buffer !== 'undefined' ? Buffer.byteLength(texto, 'utf8') : texto.length;
  if (tamanhoBytes > LIMITE_JSON_BYTES) {
    return { ok: false, erro: 'O JSON passa do limite de 200 KB.' };
  }
  if (texto.trim().length === 0) {
    return { ok: false, erro: 'Cole um JSON para importar.' };
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'Formato JSON inválido.' };
  }

  if (!ehObjetoSimples(bruto)) {
    return { ok: false, erro: 'O rascunho precisa ser um objeto JSON.' };
  }

  for (const chave of Object.keys(bruto)) {
    if (!CHAVES_RASCUNHO.has(chave)) {
      return { ok: false, erro: 'Propriedade desconhecida na raiz do rascunho.' };
    }
  }

  if (bruto.versao !== VERSAO_MONTADOR) {
    return { ok: false, erro: 'Versão do rascunho incompatível.' };
  }

  if (typeof bruto.nome !== 'string' || bruto.nome.trim().length === 0) {
    return { ok: false, erro: 'O nome do rascunho é obrigatório.' };
  }
  if (bruto.nome.length > LIMITE_TEXTO_CAMPO) {
    return { ok: false, erro: 'Texto acima do limite de 2.000 caracteres.' };
  }

  if (bruto.largura !== 390 && bruto.largura !== 1280) {
    return { ok: false, erro: 'Largura inválida (use 390 ou 1280).' };
  }

  if (bruto.tema !== 'claro' && bruto.tema !== 'areia' && bruto.tema !== 'escuro') {
    return { ok: false, erro: 'Tema inválido (use claro, areia ou escuro).' };
  }

  if (bruto.observacoes !== undefined) {
    if (typeof bruto.observacoes !== 'string') {
      return { ok: false, erro: 'O campo de observações precisa ser texto.' };
    }
    if (bruto.observacoes.length > LIMITE_TEXTO_CAMPO) {
      return { ok: false, erro: 'Texto acima do limite de 2.000 caracteres.' };
    }
  }

  if (!Array.isArray(bruto.blocos)) {
    return { ok: false, erro: 'A lista de blocos é inválida.' };
  }

  let totalBlocos = 0;

  const validarBloco = (
    item: unknown,
    nivel: number,
    pai: DefinicaoDeBloco | null,
  ): { ok: true; bloco: Bloco } | { ok: false; erro: string } => {
    if (nivel > PROFUNDIDADE_MAXIMA) {
      return { ok: false, erro: 'Os blocos passam da profundidade máxima (6).' };
    }
    totalBlocos += 1;
    if (totalBlocos > LIMITE_BLOCOS) {
      return { ok: false, erro: 'O rascunho passa do limite de 500 blocos.' };
    }
    if (!ehObjetoSimples(item)) {
      return { ok: false, erro: 'Bloco inválido no rascunho.' };
    }
    for (const chave of Object.keys(item)) {
      if (!CHAVES_BLOCO.has(chave)) {
        return { ok: false, erro: 'Propriedade desconhecida em um bloco.' };
      }
    }
    if (typeof item.id !== 'string' || item.id.trim().length === 0 || item.id.length > 120) {
      return { ok: false, erro: 'Identificador de bloco inválido.' };
    }
    if (!ehTipoDeBloco(item.tipo)) {
      return { ok: false, erro: 'Tipo de bloco desconhecido.' };
    }
    if (pai?.tiposDeFilho && !pai.tiposDeFilho.includes(item.tipo)) {
      return { ok: false, erro: 'Bloco filho não permitido neste contêiner.' };
    }
    if (!ehObjetoSimples(item.props)) {
      return { ok: false, erro: 'Propriedades do bloco inválidas.' };
    }

    const def = DEFINICOES_DE_BLOCO[item.tipo];
    const camposPorChave = new Map(def.campos.map((c) => [c.chave, c]));
    const propsLidas: Record<string, unknown> = { ...def.padrao };

    for (const [chave, valor] of Object.entries(item.props)) {
      const campo = camposPorChave.get(chave);
      if (!campo) {
        return { ok: false, erro: 'Propriedade desconhecida em um bloco.' };
      }
      if (typeof valor === 'string' && valor.length > LIMITE_TEXTO_CAMPO) {
        return { ok: false, erro: 'Texto acima do limite de 2.000 caracteres.' };
      }
      if (!valorValidoDoCampo(campo, valor)) {
        return { ok: false, erro: 'Valor de propriedade com tipo inválido.' };
      }
      propsLidas[chave] = valor;
    }

    if (!def.aceitaFilhos) {
      if (item.filhos !== undefined) {
        return { ok: false, erro: 'Um bloco que não aceita filhos recebeu filhos.' };
      }
      return { ok: true, bloco: { id: item.id, tipo: item.tipo, props: propsLidas } };
    }

    if (item.filhos !== undefined && !Array.isArray(item.filhos)) {
      return { ok: false, erro: 'A lista de filhos do bloco é inválida.' };
    }

    const filhosLidos: Bloco[] = [];
    for (const f of item.filhos ?? []) {
      const r = validarBloco(f, nivel + 1, def);
      if (!r.ok) return r;
      filhosLidos.push(r.bloco);
    }

    return { ok: true, bloco: { id: item.id, tipo: item.tipo, props: propsLidas, filhos: filhosLidos } };
  };

  const blocosValidados: Bloco[] = [];
  for (const item of bruto.blocos) {
    const r = validarBloco(item, 1, null);
    if (!r.ok) return r;
    blocosValidados.push(r.bloco);
  }

  const rascunho: Rascunho = {
    versao: VERSAO_MONTADOR,
    nome: bruto.nome,
    largura: bruto.largura,
    tema: bruto.tema,
    blocos: blocosValidados,
    ...(bruto.observacoes !== undefined ? { observacoes: bruto.observacoes } : {}),
  };

  return { ok: true, rascunho };
}

/** Nome do arquivo `.json` para download na web (`montador-<nome-em-slug>.json`). */
export function nomeDoArquivoJson(nome: string): string {
  const slug = semAcento(nome)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `montador-${slug || 'rascunho'}.json`;
}

/** Lê a lista de selos a partir do texto `texto;tipo` (um por linha). */
export function lerSelosDoTexto(texto: string): { texto: string; tipo: TipoSelo }[] {
  const tiposValidos: readonly TipoSelo[] = ['sucesso', 'atencao', 'perigo', 'neutro'];
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((linha) => {
      const partes = linha.split(';');
      const rotulo = partes[0]?.trim() ?? '';
      const tipoBruto = partes[1]?.trim().toLowerCase() ?? 'neutro';
      const tipo: TipoSelo = (tiposValidos as readonly string[]).includes(tipoBruto)
        ? (tipoBruto as TipoSelo)
        : 'neutro';
      return { texto: rotulo, tipo };
    })
    .filter((s) => s.texto.length > 0);
}

/** Lê os pontos do gráfico a partir do texto `rotulo;valor` (um por linha, aceita vírgula ou ponto). */
export function lerPontosDoGrafico(texto: string): { rotulo: string; valor: number }[] {
  const pontos: { rotulo: string; valor: number }[] = [];
  for (const linha of texto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa) continue;
    const [rotuloBruto, valorBruto] = limpa.split(';');
    const rotulo = rotuloBruto?.trim() ?? '';
    const valorLimpo = (valorBruto ?? '').trim().replace(',', '.');
    if (!rotulo || !valorLimpo) continue;
    const numero = Number(valorLimpo);
    if (Number.isFinite(numero)) {
      pontos.push({ rotulo, valor: numero });
    }
  }
  return pontos;
}
