import type { ConteudoQuestionario, PerguntaAtualizacao, TipoPergunta } from '../api/tipos';

/**
 * Limites do questionário de atualização. Mudou um valor, muda também `LimitesQuestionario` no Java
 * (`api/.../questionarios`): o teste de paridade lê `limites.json` e confere os dois lados.
 * Tamanho de texto conta unidades UTF-16 (`.length`), igual ao `String.length` do Java.
 */
export const LIMITES_QUESTIONARIO = {
  secoes: 15,
  perguntasPorSecao: 40,
  perguntasTotal: 80,
  instrucoes: 10,
  instrucaoTamanho: 300,
  tituloTamanho: 80,
  rotuloTamanho: 200,
  ajudaTamanho: 300,
  rotuloCurtoTamanho: 20,
  opcoesMinimo: 2,
  opcoesMaximo: 20,
  opcaoTamanho: 80,
  unidadeTamanho: 12,
  casasMaximo: 2,
  diasMaximo: 7,
  diaValorMaximo: 14,
  destaquesMaximo: 4,
  textoCurtoCapacidade: 500,
  textoLongoCapacidade: 2000,
  /** Soma das capacidades de TEXTO e TEXTO_LONGO: garante que as respostas cabem em `respostasBytes`. */
  capacidadeDeTextoTotal: 40000,
  rascunhoBytes: 256 * 1024,
  respostasBytes: 256 * 1024,
  /** Fotos por pergunta FOTOS (o servidor limita também o tamanho de cada uma e o total por dia). */
  fotosPorPergunta: 6,
  idTamanho: 40,
  /** Mínimo, máximo e resposta de NUMERO ficam em [-N, N] (igual a `LimitesQuestionario.NUMERO_ABSOLUTO`). */
  numeroAbsoluto: 1_000_000_000,
} as const;

export interface ProblemaDoQuestionario { caminho: string; mensagem: string }
export interface ResultadoDoQuestionario { erros: ProblemaDoQuestionario[]; avisos: ProblemaDoQuestionario[] }

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const TIPOS: readonly TipoPergunta[] = ['DATA_AUTOMATICA', 'PESO', 'NOTA', 'TEXTO', 'TEXTO_LONGO', 'NOTAS_POR_DIA', 'FOTOS',
  'ESCOLHA_UNICA', 'MULTIPLA_ESCOLHA', 'NUMERO', 'SIM_NAO'];
const COM_DESTAQUE: readonly TipoPergunta[] = ['NOTA', 'NUMERO', 'SIM_NAO', 'ESCOLHA_UNICA'];
const COM_AJUDA_AUTOMATICA: readonly TipoPergunta[] = ['TEXTO', 'NUMERO'];
const UNICOS: readonly TipoPergunta[] = ['PESO', 'DATA_AUTOMATICA', 'FOTOS'];

/** Tipos que carregam a lista de opções. */
export function temOpcoes(tipo: TipoPergunta) {
  return tipo === 'ESCOLHA_UNICA' || tipo === 'MULTIPLA_ESCOLHA';
}

/** Minúsculas, sem acento e sem espaços nas pontas: "Sim" e " sim" são a mesma opção. */
export function normalizarOpcao(texto: string) {
  return texto.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const idValido = (id: unknown) => typeof id === 'string' && ID.test(id);
const vazio = (texto: unknown) => typeof texto !== 'string' || texto.trim() === '';

interface Estado {
  total: number;
  destaques: number;
  capacidadeDeTexto: number;
  ids: Set<string>;
  tipos: Set<TipoPergunta>;
}

/**
 * Regras de publicação, as mesmas do `ValidadorQuestionario` do Java e com os mesmos caminhos
 * (`secoes[0].perguntas[1].opcoes[2].rotulo`). Confere só a forma; nunca avalia se uma pergunta é adequada.
 * Aceita conteúdo incompleto (campo ausente é erro, não exceção).
 */
export function validarQuestionario(conteudo: Partial<ConteudoQuestionario>): ResultadoDoQuestionario {
  const erros: ProblemaDoQuestionario[] = [];
  const avisos: ProblemaDoQuestionario[] = [];
  const erro = (caminho: string, mensagem: string) => erros.push({ caminho, mensagem });
  const L = LIMITES_QUESTIONARIO;

  const instrucoes = conteudo.instrucoes ?? [];
  if (instrucoes.length > L.instrucoes) erro('instrucoes', 'Instruções demais.');
  instrucoes.forEach((texto, k) => {
    if (vazio(texto)) erro(`instrucoes[${k}]`, 'Instrução vazia.');
    else if (texto.length > L.instrucaoTamanho) erro(`instrucoes[${k}]`, 'Instrução longa demais.');
  });

  const secoes = conteudo.secoes ?? [];
  if (secoes.length === 0) erro('secoes', 'O questionário não tem nenhuma seção.');
  if (secoes.length > L.secoes) erro('secoes', 'Seções demais.');
  const estado: Estado = { total: 0, destaques: 0, capacidadeDeTexto: 0, ids: new Set(), tipos: new Set() };
  const uids = new Set<string>();
  secoes.forEach((s, i) => {
    const cs = `secoes[${i}]`;
    if (!idValido(s.uid)) erro(`${cs}.uid`, 'Falta o identificador.');
    else if (uids.has(s.uid as string)) erro(`${cs}.uid`, 'Identificador repetido.');
    else uids.add(s.uid as string);
    if (vazio(s.titulo)) erro(`${cs}.titulo`, 'Seção sem título.');
    else if (s.titulo.length > L.tituloTamanho) erro(`${cs}.titulo`, 'Título longo demais.');
    const perguntas = s.perguntas ?? [];
    if (perguntas.length === 0) erro(`${cs}.perguntas`, 'Seção sem pergunta.');
    if (perguntas.length > L.perguntasPorSecao) erro(`${cs}.perguntas`, 'Perguntas demais na seção.');
    perguntas.forEach((p, j) => pergunta(p, `${cs}.perguntas[${j}]`, estado, erro));
  });
  if (estado.total > L.perguntasTotal) erro('secoes', 'Perguntas demais.');
  if (estado.capacidadeDeTexto > L.capacidadeDeTextoTotal) erro('secoes', 'Respostas de texto demais.');
  if (estado.total > 0 && !estado.tipos.has('PESO')) {
    avisos.push({ caminho: 'secoes', mensagem: 'Sem pergunta de peso: o peso não será registrado.' });
  }
  return { erros, avisos };
}

/** Só os erros (bloqueiam a publicação). */
export function errosDoQuestionario(conteudo: Partial<ConteudoQuestionario>) {
  return validarQuestionario(conteudo).erros;
}

type Erro = (caminho: string, mensagem: string) => unknown;

function pergunta(p: PerguntaAtualizacao, cp: string, estado: Estado, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  estado.total++;
  if (!idValido(p.id)) erro(`${cp}.id`, 'Falta o identificador.');
  else if (estado.ids.has(p.id)) erro(`${cp}.id`, 'Identificador repetido.');
  else estado.ids.add(p.id);
  if (vazio(p.rotulo)) erro(`${cp}.rotulo`, 'Pergunta sem texto.');
  else if (p.rotulo.length > L.rotuloTamanho) erro(`${cp}.rotulo`, 'Texto longo demais.');
  if (p.ajuda != null && p.ajuda.length > L.ajudaTamanho) erro(`${cp}.ajuda`, 'Ajuda longa demais.');
  // Tipo desconhecido não existe no Java (a leitura falha); aqui é só defesa contra dado velho ou de outro app.
  if (p.tipo == null || !TIPOS.includes(p.tipo)) { erro(`${cp}.tipo`, 'Falta o tipo.'); return; }
  if (UNICOS.includes(p.tipo) && estado.tipos.has(p.tipo)) erro(`${cp}.tipo`, 'Este tipo só pode aparecer uma vez.');
  estado.tipos.add(p.tipo);
  if (p.tipo === 'TEXTO') estado.capacidadeDeTexto += L.textoCurtoCapacidade;
  else if (p.tipo === 'TEXTO_LONGO') estado.capacidadeDeTexto += L.textoLongoCapacidade;
  opcoes(p, cp, erro);
  dias(p, cp, erro);
  numero(p, cp, erro);
  destaque(p, cp, estado, erro);
  if (p.ajudaAutomatica != null && !COM_AJUDA_AUTOMATICA.includes(p.tipo)) {
    erro(`${cp}.ajudaAutomatica`, 'Este tipo não tem ajuda automática.');
  }
}

function opcoes(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  if (!temOpcoes(p.tipo)) {
    if (p.opcoes != null) erro(`${cp}.opcoes`, 'Este tipo não tem opções.');
    return;
  }
  const n = p.opcoes?.length ?? 0;
  if (n < L.opcoesMinimo || n > L.opcoesMaximo) erro(`${cp}.opcoes`, `Use de ${L.opcoesMinimo} a ${L.opcoesMaximo} opções.`);
  const ids = new Set<string>();
  const rotulos = new Set<string>();
  (p.opcoes ?? []).forEach((o, k) => {
    const co = `${cp}.opcoes[${k}]`;
    if (!idValido(o.id)) erro(`${co}.id`, 'Falta o identificador.');
    else if (ids.has(o.id)) erro(`${co}.id`, 'Identificador repetido.');
    else ids.add(o.id);
    if (vazio(o.rotulo)) erro(`${co}.rotulo`, 'Opção sem texto.');
    else if (o.rotulo.length > L.opcaoTamanho) erro(`${co}.rotulo`, 'Texto longo demais.');
    else if (rotulos.has(normalizarOpcao(o.rotulo))) erro(`${co}.rotulo`, 'Opção repetida.');
    else rotulos.add(normalizarOpcao(o.rotulo));
  });
}

function dias(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  if (p.tipo !== 'NOTAS_POR_DIA') {
    if (p.dias != null) erro(`${cp}.dias`, 'Este tipo não tem dias.');
    return;
  }
  if (p.dias == null || p.dias.length === 0 || p.dias.length > L.diasMaximo) erro(`${cp}.dias`, `Use de 1 a ${L.diasMaximo} dias.`);
  const vistos = new Set<number>();
  (p.dias ?? []).forEach((d, k) => {
    if (!Number.isInteger(d) || d < 1 || d > L.diaValorMaximo) erro(`${cp}.dias[${k}]`, 'Dia fora da faixa.');
    else if (vistos.has(d)) erro(`${cp}.dias[${k}]`, 'Dia repetido.');
    else vistos.add(d);
  });
}

function numero(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  if (p.tipo !== 'NUMERO') {
    if (p.min != null) erro(`${cp}.min`, 'Este tipo não tem mínimo.');
    if (p.max != null) erro(`${cp}.max`, 'Este tipo não tem máximo.');
    if (p.casas != null) erro(`${cp}.casas`, 'Este tipo não tem casas decimais.');
    if (p.unidade != null) erro(`${cp}.unidade`, 'Este tipo não tem unidade.');
    return;
  }
  if (p.casas != null && (!Number.isInteger(p.casas) || p.casas < 0 || p.casas > L.casasMaximo)) {
    erro(`${cp}.casas`, `Use de 0 a ${L.casasMaximo} casas decimais.`);
  }
  const N = L.numeroAbsoluto;
  if (p.min != null && !(Math.abs(p.min) <= N)) erro(`${cp}.min`, `Use um mínimo entre -${N} e ${N}.`);
  if (p.max != null && !(Math.abs(p.max) <= N)) erro(`${cp}.max`, `Use um máximo entre -${N} e ${N}.`);
  if (p.min != null && p.max != null && p.min > p.max) erro(`${cp}.max`, 'O máximo é menor que o mínimo.');
  if (p.unidade != null && p.unidade.length > L.unidadeTamanho) erro(`${cp}.unidade`, 'Unidade longa demais.');
}

function destaque(p: PerguntaAtualizacao, cp: string, estado: Estado, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  const destacada = p.destaque === true;
  if (destacada) {
    if (!COM_DESTAQUE.includes(p.tipo)) erro(`${cp}.destaque`, 'Este tipo não pode ir para o resumo.');
    else if (++estado.destaques > L.destaquesMaximo) erro(`${cp}.destaque`, `No máximo ${L.destaquesMaximo} perguntas no resumo.`);
  }
  if (!vazio(p.rotuloCurto)) {
    if (!destacada) erro(`${cp}.rotuloCurto`, 'O nome curto só vale para pergunta do resumo.');
    else if ((p.rotuloCurto as string).length > L.rotuloCurtoTamanho) erro(`${cp}.rotuloCurto`, 'Nome curto longo demais.');
  }
}

/** Ids cujo tipo difere do que já foi publicado: o tipo de um id não muda entre versões. */
export function tiposQueMudaram(atual: Partial<ConteudoQuestionario>, publicadas: Partial<ConteudoQuestionario>[]) {
  const todas = (c: Partial<ConteudoQuestionario>) => (c.secoes ?? []).flatMap((s) => s.perguntas ?? []).filter((p) => p.id != null && p.tipo != null);
  const antigos = new Map<string, TipoPergunta>();
  for (const v of publicadas) for (const p of todas(v)) if (!antigos.has(p.id)) antigos.set(p.id, p.tipo);
  return [...new Set(todas(atual).filter((p) => antigos.has(p.id) && antigos.get(p.id) !== p.tipo).map((p) => p.id))].sort();
}
