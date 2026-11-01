import type { CondicaoPergunta, ConteudoQuestionario, DestinoNoPerfil, FinalidadeQuestionario, OpcaoPergunta, PerguntaAtualizacao, TipoPergunta } from '../api/tipos';

/**
 * Limites do questionário (atualização, anamnese e inscrição). Mudou um valor, muda também `LimitesQuestionario` no Java
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
  /** Descrição da seção (opcional; formato simples do `dominio/textoFormatado`). */
  descricaoSecaoTamanho: 4000,
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
  /** Perguntas FOTOS num questionário (cada uma com o seu `max`, de 1 a `fotosPorPergunta`). */
  perguntasFotos: 6,
  /** Escala da NOTA: ponta de baixo 0 ou 1 (padrão 0), ponta de cima de 2 a 10 (padrão 10). NOTAS_POR_DIA segue 0 a 10. */
  notaMinPadrao: 0,
  notaMinMaximo: 1,
  notaMaxMinimo: 2,
  notaMaxPadrao: 10,
  /** Texto embaixo de cada ponta da escala da NOTA (`rotuloMin`, `rotuloMax`). */
  rotuloPontaTamanho: 40,
  idTamanho: 40,
  /** Mínimo, máximo e resposta de NUMERO ficam em [-N, N] (igual a `LimitesQuestionario.NUMERO_ABSOLUTO`). */
  numeroAbsoluto: 1_000_000_000,
  /** GRADE: linhas (uma resposta por linha) e colunas (as escolhas). */
  linhasMinimo: 1,
  linhasMaximo: 30,
  colunasMinimo: 2,
  colunasMaximo: 10,
  /** Texto do ACEITE e do INFORMATIVO; frase de declaração do ACEITE. */
  textoInformativoTamanho: 4000,
  declaracaoTamanho: 200,
  telefoneTamanho: 25,
  telefoneDigitosMinimo: 10,
  telefoneDigitosMaximo: 13,
  emailTamanho: 254,
  /** Resposta de DATA entre 1900 e 2100 (com `somentePassado`, até hoje). */
  dataAnoMinimo: 1900,
  dataAnoMaximo: 2100,
  /** Imagem da pergunta ou da opção (o servidor confere de novo e regrava sem metadados). */
  imagemBytes: 300_000,
  imagemLado: 1600,
  /** Resposta do TEXTO com destino OBJETIVO: o tamanho do objetivo do cadastro. */
  objetivoTamanho: 200,
  /** Resposta do TEXTO com destino CPF: o CPF formatado (123.456.789-09) tem 14 caracteres. */
  cpfTamanho: 14,
  /** Campos da resposta ENDERECO e do endereço do aluno (colunas de `aluno`, V015). */
  enderecoCepTamanho: 9,
  enderecoLogradouroTamanho: 200,
  enderecoNumeroTamanho: 20,
  enderecoComplementoTamanho: 100,
  enderecoBairroTamanho: 100,
  enderecoCidadeTamanho: 100,
  enderecoUfTamanho: 2,
} as const;

export interface ProblemaDoQuestionario { caminho: string; mensagem: string }
export interface ResultadoDoQuestionario { erros: ProblemaDoQuestionario[]; avisos: ProblemaDoQuestionario[] }

const ID = /^[A-Za-z0-9_-]{1,40}$/;
/** Id de imagem: UUID em minúsculas, como a API devolve (igual a `LimitesQuestionario.IMAGEM_PADRAO`). */
const IMAGEM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const TIPOS_DE_PERGUNTA: readonly TipoPergunta[] = ['DATA_AUTOMATICA', 'PESO', 'NOTA', 'TEXTO', 'TEXTO_LONGO', 'NOTAS_POR_DIA', 'FOTOS',
  'ESCOLHA_UNICA', 'MULTIPLA_ESCOLHA', 'NUMERO', 'SIM_NAO', 'DATA', 'TELEFONE', 'EMAIL', 'GRADE', 'ENDERECO', 'ACEITE', 'INFORMATIVO'];
const TIPOS = TIPOS_DE_PERGUNTA;
const COM_DESTAQUE: readonly TipoPergunta[] = ['NOTA', 'NUMERO', 'SIM_NAO', 'ESCOLHA_UNICA'];
const COM_AJUDA_AUTOMATICA: readonly TipoPergunta[] = ['TEXTO', 'NUMERO'];
const UNICOS: readonly TipoPergunta[] = ['PESO', 'DATA_AUTOMATICA'];
/**
 * Tipos fora da página pública de inscrição (D5 de `docs/planos/inscricao-com-perguntas-proprias.md`): quem preenche ainda
 * não é aluno nem tem login. Mesmo conjunto de `ValidadorQuestionario.FORA_DA_INSCRICAO` no Java.
 */
export const TIPOS_FORA_DA_INSCRICAO: readonly TipoPergunta[] = ['FOTOS', 'ENDERECO', 'PESO', 'NOTAS_POR_DIA', 'DATA_AUTOMATICA'];
/** A página pública não mostra imagem (D6). */
const SEM_IMAGEM_NA_INSCRICAO = 'A página de inscrição não mostra imagem.';
/** Tipo de pergunta que alimenta cada campo do cadastro (igual a `DestinoNoPerfil` do Java). */
export const TIPO_DO_DESTINO: Record<DestinoNoPerfil, TipoPergunta> = { PESO: 'PESO', OBJETIVO: 'TEXTO', CPF: 'TEXTO', TELEFONE: 'TELEFONE', ENDERECO: 'ENDERECO', SEXO: 'ESCOLHA_UNICA' };

/** Escala da NOTA: `min` (0 ou 1) e `max` (2 a 10) da pergunta; sem eles (ou fora da regra), 0 a 10. */
export function escalaDaNota(p: Pick<PerguntaAtualizacao, 'min' | 'max'>): { min: number; max: number } {
  const L = LIMITES_QUESTIONARIO;
  const min = Number.isInteger(p.min) && (p.min as number) >= 0 && (p.min as number) <= L.notaMinMaximo ? (p.min as number) : L.notaMinPadrao;
  const max = Number.isInteger(p.max) && (p.max as number) >= L.notaMaxMinimo && (p.max as number) <= L.notaMaxPadrao ? (p.max as number) : L.notaMaxPadrao;
  return { min, max };
}

/** Fotos que a pergunta FOTOS aceita: o `max` dela (1 a 6) ou, sem ele, `fotosPorPergunta`. */
export function maximoDeFotos(p: Pick<PerguntaAtualizacao, 'max'>): number {
  const L = LIMITES_QUESTIONARIO;
  return Number.isInteger(p.max) && (p.max as number) >= 1 && (p.max as number) <= L.fotosPorPergunta ? (p.max as number) : L.fotosPorPergunta;
}

/** Tipos que carregam a lista de opções. */
export function temOpcoes(tipo: TipoPergunta) {
  return tipo === 'ESCOLHA_UNICA' || tipo === 'MULTIPLA_ESCOLHA';
}

/** Tipos que podem controlar a condição (`mostrarSe`) de uma pergunta ou seção seguinte. */
export const controlaCondicao = (tipo: TipoPergunta) => temOpcoes(tipo) || tipo === 'SIM_NAO';

/** Tipos sem resposta do aluno. */
export const semResposta = (tipo: TipoPergunta) => tipo === 'DATA_AUTOMATICA' || tipo === 'INFORMATIVO';

/** Minúsculas, sem acento e sem espaços nas pontas: "Sim" e " sim" são a mesma opção. */
export function normalizarOpcao(texto: string) {
  return texto.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const idValido = (id: unknown) => typeof id === 'string' && ID.test(id);
const vazio = (texto: unknown) => typeof texto !== 'string' || texto.trim() === '';

interface Estado {
  finalidade: FinalidadeQuestionario;
  /** Perguntas já vistas, na ordem do formulário: a condição só aponta para uma delas. */
  anteriores: Map<string, PerguntaAtualizacao>;
  total: number;
  destaques: number;
  capacidadeDeTexto: number;
  ids: Set<string>;
  tipos: Set<TipoPergunta>;
  /** Perguntas FOTOS já vistas: até `perguntasFotos` por questionário. */
  fotos: number;
  /** Campos do perfil já alimentados: um destino por questionário. */
  destinos: Set<DestinoNoPerfil>;
  /** Caminho da pergunta PESO → id da DATA da pesagem, conferido no fim (a DATA pode vir depois). */
  pesagens: [string, string][];
}

/**
 * Regras de publicação, as mesmas do `ValidadorQuestionario` do Java e com os mesmos caminhos
 * (`secoes[0].perguntas[1].opcoes[2].rotulo`). Confere só a forma; nunca avalia se uma pergunta é adequada.
 * Aceita conteúdo incompleto (campo ausente é erro, não exceção).
 */
export function validarQuestionario(conteudo: Partial<ConteudoQuestionario>, finalidade: FinalidadeQuestionario = 'ATUALIZACAO'): ResultadoDoQuestionario {
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
  const estado: Estado = { finalidade, anteriores: new Map(), total: 0, destaques: 0, capacidadeDeTexto: 0, ids: new Set(), tipos: new Set(), fotos: 0, destinos: new Set(), pesagens: [] };
  const uids = new Set<string>();
  secoes.forEach((s, i) => {
    const cs = `secoes[${i}]`;
    if (!idValido(s.uid)) erro(`${cs}.uid`, 'Falta o identificador.');
    else if (uids.has(s.uid as string)) erro(`${cs}.uid`, 'Identificador repetido.');
    else uids.add(s.uid as string);
    if (vazio(s.titulo)) erro(`${cs}.titulo`, 'Seção sem título.');
    else if (s.titulo.length > L.tituloTamanho) erro(`${cs}.titulo`, 'Título longo demais.');
    if (s.descricao != null && s.descricao.length > L.descricaoSecaoTamanho) erro(`${cs}.descricao`, 'Descrição longa demais.');
    condicao(s.mostrarSe, cs, estado, erro);
    const perguntas = s.perguntas ?? [];
    if (perguntas.length === 0) erro(`${cs}.perguntas`, 'Seção sem pergunta.');
    if (perguntas.length > L.perguntasPorSecao) erro(`${cs}.perguntas`, 'Perguntas demais na seção.');
    perguntas.forEach((p, j) => pergunta(p, `${cs}.perguntas[${j}]`, estado, erro));
  });
  for (const [cp, id] of estado.pesagens) {
    const alvo = estado.anteriores.get(id);
    if (!alvo || alvo.tipo !== 'DATA' || alvo.somentePassado !== true) erro(`${cp}.destinoData`, 'A data da pesagem precisa ser uma pergunta de data que aceita só hoje ou antes.');
  }
  if (estado.total > L.perguntasTotal) erro('secoes', 'Perguntas demais.');
  if (estado.capacidadeDeTexto > L.capacidadeDeTextoTotal) erro('secoes', 'Respostas de texto demais.');
  if (finalidade === 'ATUALIZACAO' && estado.total > 0 && !estado.tipos.has('PESO')) {
    avisos.push({ caminho: 'secoes', mensagem: 'Sem pergunta de peso: o peso não será registrado.' });
  }
  return { erros, avisos };
}

/** Só os erros (bloqueiam a publicação). */
export function errosDoQuestionario(conteudo: Partial<ConteudoQuestionario>, finalidade: FinalidadeQuestionario = 'ATUALIZACAO') {
  return validarQuestionario(conteudo, finalidade).erros;
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
  if (p.imagemId != null && estado.finalidade === 'INSCRICAO') erro(`${cp}.imagemId`, SEM_IMAGEM_NA_INSCRICAO);
  else if (p.imagemId != null && !IMAGEM.test(p.imagemId)) erro(`${cp}.imagemId`, 'Imagem inválida.');
  condicao(p.mostrarSe, cp, estado, erro);
  // Tipo desconhecido não existe no Java (a leitura falha); aqui é só defesa contra dado velho ou de outro app.
  if (p.tipo == null || !TIPOS.includes(p.tipo)) { erro(`${cp}.tipo`, 'Falta o tipo.'); return; }
  if (p.id != null && !estado.anteriores.has(p.id)) estado.anteriores.set(p.id, p);
  if (estado.finalidade === 'ANAMNESE' && p.tipo === 'DATA_AUTOMATICA') erro(`${cp}.tipo`, 'Este tipo só vale no questionário de atualização.');
  if (estado.finalidade === 'ATUALIZACAO' && p.tipo === 'ENDERECO') erro(`${cp}.tipo`, 'Este tipo só vale no questionário de anamnese.');
  if (estado.finalidade === 'INSCRICAO' && TIPOS_FORA_DA_INSCRICAO.includes(p.tipo)) erro(`${cp}.tipo`, 'Este tipo não vale no formulário de inscrição.');
  if (UNICOS.includes(p.tipo) && estado.tipos.has(p.tipo)) erro(`${cp}.tipo`, 'Este tipo só pode aparecer uma vez.');
  if (p.tipo === 'FOTOS' && ++estado.fotos > L.perguntasFotos) erro(`${cp}.tipo`, `No máximo ${L.perguntasFotos} perguntas de fotos.`);
  estado.tipos.add(p.tipo);
  if (p.tipo === 'TEXTO') estado.capacidadeDeTexto += L.textoCurtoCapacidade;
  else if (p.tipo === 'TEXTO_LONGO') estado.capacidadeDeTexto += L.textoLongoCapacidade;
  opcoes(p, cp, estado.finalidade === 'INSCRICAO' ? SEM_IMAGEM_NA_INSCRICAO : null, erro);
  dias(p, cp, erro);
  numero(p, cp, erro);
  escala(p, cp, erro);
  destaque(p, cp, estado, erro);
  if (p.ajudaAutomatica != null && !COM_AJUDA_AUTOMATICA.includes(p.tipo)) {
    erro(`${cp}.ajudaAutomatica`, 'Este tipo não tem ajuda automática.');
  } else if (p.ajudaAutomatica != null && estado.finalidade !== 'ATUALIZACAO') {
    erro(`${cp}.ajudaAutomatica`, 'Esta ajuda só vale no questionário de atualização.');
  }
  if (p.somentePassado != null && p.tipo !== 'DATA') erro(`${cp}.somentePassado`, 'Este tipo não tem esta opção.');
  textos(p, cp, erro);
  grade(p, cp, erro);
  destino(p, cp, estado, erro);
}

/** Destino no perfil (só na anamnese): tipo compatível e um por campo; `destinoData` só no PESO com destino. */
function destino(p: PerguntaAtualizacao, cp: string, estado: Estado, erro: Erro) {
  const d = p.destino;
  if (d != null) {
    if (estado.finalidade !== 'ANAMNESE') erro(`${cp}.destino`, 'O campo do perfil só vale na anamnese.');
    else if (TIPO_DO_DESTINO[d] !== p.tipo) erro(`${cp}.destino`, 'Este tipo de pergunta não alimenta este campo.');
    else if (estado.destinos.has(d)) erro(`${cp}.destino`, 'Outra pergunta já alimenta este campo.');
    else estado.destinos.add(d);
    if (d === 'SEXO') sexoNasOpcoes(p, cp, erro);
  }
  if (p.destinoData != null) {
    if (d !== 'PESO') erro(`${cp}.destinoData`, 'Só o peso guardado no perfil usa a data da pesagem.');
    else estado.pesagens.push([cp, p.destinoData]);
  }
}

const SEXOS = new Set(['MASCULINO', 'FEMININO', 'OUTRO']);

/** Destino SEXO: ao menos uma opção aponta para um valor do cadastro. Fora desse destino o campo é ignorado. */
function sexoNasOpcoes(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  let algum = false;
  (p.opcoes ?? []).forEach((o, i) => {
    const valor = o.valorNoCadastro?.trim();
    if (!valor) return;
    if (!SEXOS.has(valor)) erro(`${cp}.opcoes[${i}].valorNoCadastro`, 'Escolha Masculino, Feminino ou Outro.');
    else algum = true;
  });
  if (!algum) erro(`${cp}.opcoes`, 'Marque o sexo de ao menos uma opção.');
}

/** `texto` do ACEITE (obrigatório) e do INFORMATIVO (opcional); `declaracao` só do ACEITE (obrigatória). */
function textos(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  const temTexto = p.tipo === 'ACEITE' || p.tipo === 'INFORMATIVO';
  if (!temTexto) {
    if (p.texto != null) erro(`${cp}.texto`, 'Este tipo não tem texto.');
  } else if (p.tipo === 'ACEITE' && vazio(p.texto)) erro(`${cp}.texto`, 'Falta o texto.');
  else if (p.texto != null && p.texto.length > L.textoInformativoTamanho) erro(`${cp}.texto`, 'Texto longo demais.');
  if (p.tipo !== 'ACEITE') {
    if (p.declaracao != null) erro(`${cp}.declaracao`, 'Este tipo não tem declaração.');
  } else if (vazio(p.declaracao)) erro(`${cp}.declaracao`, 'Falta a frase de declaração.');
  else if ((p.declaracao as string).length > L.declaracaoTamanho) erro(`${cp}.declaracao`, 'Frase longa demais.');
}

function grade(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  if (p.tipo !== 'GRADE') {
    if (p.linhas != null) erro(`${cp}.linhas`, 'Este tipo não tem linhas.');
    if (p.colunas != null) erro(`${cp}.colunas`, 'Este tipo não tem colunas.');
    return;
  }
  lista(p.linhas, `${cp}.linhas`, L.linhasMinimo, L.linhasMaximo, 'linhas', 'Só opção de escolha tem imagem.', erro);
  lista(p.colunas, `${cp}.colunas`, L.colunasMinimo, L.colunasMaximo, 'colunas', 'Só opção de escolha tem imagem.', erro);
}

/** Condição: aponta para uma pergunta de escolha já vista e lista respostas que existem nela, sem repetir. */
function condicao(m: CondicaoPergunta | undefined, base: string, estado: Estado, erro: Erro) {
  if (m == null) return;
  const alvo = m.perguntaId == null ? undefined : estado.anteriores.get(m.perguntaId);
  if (!alvo || alvo.tipo == null || !controlaCondicao(alvo.tipo)) {
    erro(`${base}.mostrarSe.perguntaId`, 'A condição precisa apontar para uma pergunta de escolha anterior.');
    return;
  }
  const valores = m.valores ?? [];
  if (valores.length === 0 || valores.length > LIMITES_QUESTIONARIO.opcoesMaximo) {
    erro(`${base}.mostrarSe.valores`, 'Escolha ao menos uma resposta para a condição.');
    return;
  }
  const validos = new Set(alvo.tipo === 'SIM_NAO' ? ['sim', 'nao'] : (alvo.opcoes ?? []).map((o) => o.id));
  const vistos = new Set<string>();
  for (const v of valores) {
    if (typeof v !== 'string' || !validos.has(v) || vistos.has(v)) {
      erro(`${base}.mostrarSe.valores`, 'A condição tem uma resposta que não existe na pergunta.');
      return;
    }
    vistos.add(v);
  }
}

/** `semImagem`: nulo = a opção pode ter imagem; senão, a mensagem de quando ela traz uma. */
function opcoes(p: PerguntaAtualizacao, cp: string, semImagem: string | null, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  if (!temOpcoes(p.tipo)) {
    if (p.opcoes != null) erro(`${cp}.opcoes`, 'Este tipo não tem opções.');
    return;
  }
  lista(p.opcoes, `${cp}.opcoes`, L.opcoesMinimo, L.opcoesMaximo, 'opções', semImagem, erro);
}

/**
 * Opções de escolha, linhas e colunas da GRADE: mesma regra de quantidade, id e texto sem repetir. `semImagem` nulo =
 * imagem permitida (o formato é conferido); senão, é a mensagem do erro quando o item traz imagem.
 */
function lista(itens: OpcaoPergunta[] | undefined, caminho: string, minimo: number, maximo: number, nome: string, semImagem: string | null, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  const n = itens?.length ?? 0;
  if (n < minimo || n > maximo) erro(caminho, `Use de ${minimo} a ${maximo} ${nome}.`);
  const ids = new Set<string>();
  const rotulos = new Set<string>();
  (itens ?? []).forEach((o, k) => {
    const co = `${caminho}[${k}]`;
    if (!idValido(o.id)) erro(`${co}.id`, 'Falta o identificador.');
    else if (ids.has(o.id)) erro(`${co}.id`, 'Identificador repetido.');
    else ids.add(o.id);
    if (vazio(o.rotulo)) erro(`${co}.rotulo`, 'Texto vazio.');
    else if (o.rotulo.length > L.opcaoTamanho) erro(`${co}.rotulo`, 'Texto longo demais.');
    else if (rotulos.has(normalizarOpcao(o.rotulo))) erro(`${co}.rotulo`, 'Texto repetido.');
    else rotulos.add(normalizarOpcao(o.rotulo));
    if (o.imagemId != null && (semImagem != null || !IMAGEM.test(o.imagemId))) erro(`${co}.imagemId`, semImagem ?? 'Imagem inválida.');
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

/** `min`/`max`: faixa do NUMERO, pontas da escala da NOTA e (só `max`) fotos aceitas na FOTOS. `casas` e `unidade` só no NUMERO. */
function numero(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  const L = LIMITES_QUESTIONARIO;
  if (p.tipo !== 'NUMERO') {
    if (p.min != null && p.tipo !== 'NOTA') erro(`${cp}.min`, 'Este tipo não tem mínimo.');
    if (p.max != null && p.tipo !== 'NOTA' && p.tipo !== 'FOTOS') erro(`${cp}.max`, 'Este tipo não tem máximo.');
    if (p.casas != null) erro(`${cp}.casas`, 'Este tipo não tem casas decimais.');
    if (p.unidade != null) erro(`${cp}.unidade`, 'Este tipo não tem unidade.');
    if (p.tipo === 'NOTA') {
      if (p.min != null && !inteiroEntre(p.min, 0, L.notaMinMaximo)) erro(`${cp}.min`, 'A escala começa em 0 ou 1.');
      if (p.max != null && !inteiroEntre(p.max, L.notaMaxMinimo, L.notaMaxPadrao)) erro(`${cp}.max`, `A escala termina entre ${L.notaMaxMinimo} e ${L.notaMaxPadrao}.`);
    }
    if (p.tipo === 'FOTOS' && p.max != null && !inteiroEntre(p.max, 1, L.fotosPorPergunta)) erro(`${cp}.max`, `Use de 1 a ${L.fotosPorPergunta} fotos.`);
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

/** Texto embaixo das pontas da escala: só na NOTA, até `rotuloPontaTamanho` cada. */
function escala(p: PerguntaAtualizacao, cp: string, erro: Erro) {
  const ponta = (texto: string | undefined, caminho: string, foraDoTipo: string) => {
    if (texto == null) return;
    if (p.tipo !== 'NOTA') erro(caminho, foraDoTipo);
    else if (texto.length > LIMITES_QUESTIONARIO.rotuloPontaTamanho) erro(caminho, 'Texto longo demais.');
  };
  ponta(p.rotuloMin, `${cp}.rotuloMin`, 'Este tipo não tem texto na ponta de baixo.');
  ponta(p.rotuloMax, `${cp}.rotuloMax`, 'Este tipo não tem texto na ponta de cima.');
}

/** Inteiro de `minimo` a `maximo`: 1,5 não é ponta de escala nem quantidade de fotos. */
const inteiroEntre = (v: number, minimo: number, maximo: number) => Number.isInteger(v) && v >= minimo && v <= maximo;

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
