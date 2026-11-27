import type {
  PerguntaAtualizacao, PerguntaDaRegra, RegraDeAtencao, RegraDeAtencaoEnvio, SalvarRegrasDeAtencao, TipoDePerguntaDaRegra,
  TipoDeRegraDeAtencao,
} from '../api/tipos';
import { numeroDaTela, numeroParaTela } from './formatos';

/**
 * Regras de atenção do treinador (`docs/planos/regras-de-atencao.md`, R1, C1 a C4): os 6 modelos, os textos, a validação
 * do rascunho e o corpo do lote. O número é sempre do treinador: nada aqui sugere valor, e a regra nova nasce com o campo
 * vazio. Operador **inclusivo** (C4), o mesmo do avaliador do servidor: "Sono 5 ou menos", "caiu 2 pontos ou mais",
 * "mudou 2 kg ou mais", "3 dias com treino ou menos". O app nunca reavalia regra: a legenda usa o `limiteVigente` gravado.
 * Pura (sem rede nem relógio).
 */

export const TIPOS_DE_REGRA: readonly TipoDeRegraDeAtencao[] = ['NOTA_ABAIXO', 'NOTA_CAIU', 'SIM', 'PESO_MUDOU', 'POUCOS_TREINOS', 'ITEM_MARCADO'];

export const ehTipoDeRegra = (t: unknown): t is TipoDeRegraDeAtencao => (TIPOS_DE_REGRA as readonly unknown[]).includes(t);

export interface ModeloDeRegra {
  tipo: TipoDeRegraDeAtencao;
  titulo: string;
  descricao: string;
  /** Tipo da pergunta que o modelo usa; nulo = modelo sem pergunta. */
  pergunta: TipoDePerguntaDaRegra | null;
  /** Rótulo do campo do número; nulo = modelo sem número. */
  campo: string | null;
  /** Motivo do interruptor desabilitado quando nenhum questionário tem pergunta do tipo; nulo nos modelos sem pergunta. */
  semPergunta: string | null;
}

export const MODELOS_DE_REGRA: Readonly<Record<TipoDeRegraDeAtencao, ModeloDeRegra>> = {
  NOTA_ABAIXO: {
    tipo: 'NOTA_ABAIXO', titulo: 'Nota até um número',
    descricao: 'Uma nota que você escolher ficou no número que você definir, ou abaixo dele.',
    pergunta: 'NOTA', campo: 'Nota igual ou menor que',
    semPergunta: 'Nenhum questionário de atualização publicado tem pergunta de nota.',
  },
  NOTA_CAIU: {
    tipo: 'NOTA_CAIU', titulo: 'Nota que caiu',
    descricao: 'Qualquer nota caiu esse número de pontos, ou mais, desde a atualização anterior. Vale na escala de cada nota.',
    pergunta: null, campo: 'Caiu pelo menos (pontos)', semPergunta: null,
  },
  SIM: {
    tipo: 'SIM', titulo: 'Resposta Sim',
    descricao: 'O aluno respondeu Sim numa pergunta de Sim ou Não.',
    pergunta: 'SIM_NAO', campo: null,
    semPergunta: 'Nenhum questionário de atualização publicado tem pergunta de Sim ou Não.',
  },
  PESO_MUDOU: {
    tipo: 'PESO_MUDOU', titulo: 'Peso mudou',
    descricao: 'O peso subiu ou desceu esse número, ou mais, desde a atualização anterior.',
    pergunta: null, campo: 'Mudou pelo menos (kg)', semPergunta: null,
  },
  POUCOS_TREINOS: {
    tipo: 'POUCOS_TREINOS', titulo: 'Poucos dias com treino',
    descricao: 'Os dias com treino registrado no app, no período da atualização, ficaram nesse número ou abaixo. A conta é feita no envio.',
    pergunta: null, campo: 'Dias com treino igual ou menor que', semPergunta: null,
  },
  ITEM_MARCADO: {
    tipo: 'ITEM_MARCADO', titulo: 'Item marcado',
    descricao: 'O aluno marcou um item numa pergunta de itens do plano (alimento, exercício ou dia).',
    pergunta: 'ITENS_DO_PLANO', campo: null,
    semPergunta: 'Nenhum questionário de atualização publicado tem pergunta de itens do plano.',
  },
};

/** Textos fixos da tela de Configurações › Regras de atenção (a tela não escreve texto próprio). */
export const TEXTOS_DAS_REGRAS = {
  titulo: 'Regras de atenção',
  descricao: 'Escolha quando a atualização de um aluno deve chamar a sua atenção. O número é seu: o app não sugere nenhum.',
  cartao: 'Me avise quando',
  adicionarPergunta: 'Adicionar outra pergunta',
  verQuestionarios: 'Ver questionários',
  erroDeCarga: 'Não foi possível carregar as regras de atenção.',
  erroDasPerguntas: 'Não foi possível carregar as perguntas.',
  salvas: 'Regras de atenção salvas.',
  conflito: 'As regras de atenção foram alteradas por outra pessoa. Carregamos a versão atual; confira e salve de novo.',
  soLeitura: 'Para mudar as regras, peça a quem administra a consultoria.',
  desligada: 'Desligada',
  seloPerguntaFora: 'Pergunta fora dos questionários',
  ajudaPerguntaFora: 'A regra fica gravada, mas não vale até a pergunta voltar. Escolha outra pergunta se quiser.',
  comoFunciona: 'Como funciona',
  itensDoComoFunciona: [
    'A regra vale nos próximos envios; atualizações já enviadas não mudam.',
    'Cada regra de pergunta vale para quem responde o questionário dela.',
    'Na revisão, o fato que bateu aparece destacado com a sua regra.',
  ],
  avisosNoCelular: 'Avisos no celular: Aparência e preferências.',
  excecoesNaFicha: 'Exceções por aluno ficam na ficha, em Configuração do acompanhamento.',
} as const;

/** Mensagens da validação (fixas, iguais às da API sempre que ela as tem). */
export const ERROS_DAS_REGRAS = {
  escolhaAPergunta: 'Escolha a pergunta.',
  digiteONumero: 'Digite o número da regra.',
  inteiro: 'Use um número inteiro.',
  umaCasa: 'Use no máximo 1 casa decimal.',
  repetida: 'Esta pergunta já tem uma regra deste tipo.',
} as const;

/** Escala da NOTA quando a pergunta não traz (a mesma do questionário: 0 a 10). */
const ESCALA_PADRAO = { min: 0, max: 10 } as const;

/** Faixa do número de cada modelo (C3). NOTA_ABAIXO usa a escala da pergunta; a nota é sempre inteira. */
interface Faixa { min: number; max: number; inteiro: boolean; mensagem: string }
function faixaDoNumero(tipo: TipoDeRegraDeAtencao, escala: { min: number; max: number } | null): Faixa | null {
  switch (tipo) {
    case 'NOTA_ABAIXO': {
      const e = escala ?? ESCALA_PADRAO;
      return { min: e.min, max: e.max, inteiro: true, mensagem: `Use um número de ${e.min} a ${e.max}, a escala desta pergunta.` };
    }
    case 'NOTA_CAIU': return { min: 1, max: 10, inteiro: true, mensagem: 'Use um número de 1 a 10.' };
    case 'PESO_MUDOU': return { min: 0.1, max: 50, inteiro: false, mensagem: 'Use um número de 0,1 a 50.' };
    case 'POUCOS_TREINOS': return { min: 1, max: 31, inteiro: true, mensagem: 'Use um número de 1 a 31.' };
    default: return null;
  }
}

const plural = (n: number | null, um: string, varios: string) => (n === 1 ? um : varios);
const numero = (n: number | null, casas = 1) => numeroParaTela(n, casas);

/**
 * A regra em palavras, com o operador inclusivo: "Sono 5 ou menos", "nota caiu 2 pontos ou mais", "resposta Sim em Sentiu
 * dores", "peso mudou 1,5 kg ou mais", "3 dias com treino ou menos", "item marcado em Quer trocar". `rotulo` é o da pergunta
 * (nos modelos com pergunta); sem ele, "Pergunta".
 */
export function textoDaRegra(tipo: TipoDeRegraDeAtencao, limite: number | null, rotulo?: string | null): string {
  const r = rotulo?.trim() || 'Pergunta';
  switch (tipo) {
    case 'NOTA_ABAIXO': return `${r} ${numero(limite)} ou menos`;
    case 'NOTA_CAIU': return `nota caiu ${numero(limite)} ${plural(limite, 'ponto', 'pontos')} ou mais`;
    case 'SIM': return `resposta Sim em ${r}`;
    case 'PESO_MUDOU': return `peso mudou ${numero(limite)} kg ou mais`;
    case 'POUCOS_TREINOS': return `${numero(limite)} ${plural(limite, 'dia', 'dias')} com treino ou menos`;
    case 'ITEM_MARCADO': return `item marcado em ${r}`;
  }
}

/**
 * Legenda do fato na revisão: "Sua regra: Sono 5 ou menos", com o rótulo da pergunta na versão do questionário da própria
 * atualização e o `limiteVigente` gravado no envio (mudar a regra depois não muda a legenda, R3). Dias com treino dizem que
 * a conta foi no envio (o check-in offline pode chegar depois).
 */
export function legendaDaRegra(tipo: TipoDeRegraDeAtencao, limiteVigente: number | null, rotulo?: string | null): string {
  const texto = `Sua regra: ${textoDaRegra(tipo, limiteVigente, rotulo)}`;
  return tipo === 'POUCOS_TREINOS' ? `${texto}, contados no envio` : texto;
}

/** Rótulo da pergunta como no "O que mudou": o curto, senão o completo, senão "Pergunta". */
export const rotuloDaPergunta = (p: Pick<PerguntaAtualizacao, 'rotulo' | 'rotuloCurto'>) =>
  p.rotuloCurto?.trim() || p.rotulo.trim() || 'Pergunta';

// ---- Perguntas que a tela oferece ----

const chaveDaPergunta = (tipo: string, id: string) => `${tipo}\u0000${id}`;

/**
 * Junta a mesma pergunta de vários questionários: o mesmo `perguntaId` E o mesmo tipo (outro questionário pode ter o mesmo id
 * com outro tipo; aí são duas). Rótulo e escala: os da primeira que a API mandou. Questionários sem repetir, na ordem.
 */
export function juntarPerguntas(perguntas: readonly PerguntaDaRegra[]): PerguntaDaRegra[] {
  const porChave = new Map<string, PerguntaDaRegra>();
  for (const p of perguntas) {
    const chave = chaveDaPergunta(p.tipo, p.perguntaId);
    const ja = porChave.get(chave);
    if (!ja) { porChave.set(chave, { ...p, questionarios: [...p.questionarios] }); continue; }
    for (const q of p.questionarios) if (!ja.questionarios.some((x) => x.id === q.id)) ja.questionarios.push(q);
  }
  return [...porChave.values()];
}

/** As perguntas que o modelo pode escolher (já juntadas); vazio nos modelos sem pergunta. */
export function perguntasDoModelo(tipo: TipoDeRegraDeAtencao, perguntas: readonly PerguntaDaRegra[]): PerguntaDaRegra[] {
  const t = MODELOS_DE_REGRA[tipo].pergunta;
  return t ? juntarPerguntas(perguntas).filter((p) => p.tipo === t) : [];
}

/** A pergunta escolhida, por id E tipo; nula se não está nos questionários (ou mudou de tipo). */
export function perguntaDaRegra(tipo: TipoDeRegraDeAtencao, perguntaId: string | null, perguntas: readonly PerguntaDaRegra[]): PerguntaDaRegra | null {
  if (!perguntaId) return null;
  return perguntasDoModelo(tipo, perguntas).find((p) => p.perguntaId === perguntaId) ?? null;
}

/**
 * "Pergunta fora dos questionários": a regra tem pergunta escolhida, mas ela não está em nenhum questionário de atualização
 * publicado e ativo com o tipo certo. Não é erro: a regra fica gravada e não vale até a pergunta voltar.
 */
export function perguntaFora(regra: Pick<RegraEmEdicao, 'tipo' | 'perguntaId'>, perguntas: readonly PerguntaDaRegra[]): boolean {
  return !!MODELOS_DE_REGRA[regra.tipo].pergunta && !!regra.perguntaId && !perguntaDaRegra(regra.tipo, regra.perguntaId, perguntas);
}

/** "Questionário: Padrão da consultoria" ou "Questionários: A, B"; vazio sem questionário. */
export function textoDosQuestionarios(p: Pick<PerguntaDaRegra, 'questionarios'>): string {
  const nomes = p.questionarios.map((q) => q.nome.trim()).filter(Boolean);
  if (!nomes.length) return '';
  return `${nomes.length === 1 ? 'Questionário' : 'Questionários'}: ${nomes.join(', ')}`;
}

// ---- Rascunho da tela ----

/** Uma regra no rascunho: `limite` é o texto digitado (vazio = sem número; nunca preenchido pelo app). */
export interface RegraEmEdicao {
  /** Chave estável da linha: o id da regra gravada ou uma chave local da nova. */
  chave: string;
  /** Nulo = regra nova (ainda não gravada). */
  id: string | null;
  tipo: TipoDeRegraDeAtencao;
  perguntaId: string | null;
  limite: string;
  ativa: boolean;
}

const ordemDoTipo = (t: TipoDeRegraDeAtencao) => TIPOS_DE_REGRA.indexOf(t);

/** O rascunho a partir do que está gravado: na ordem dos modelos e, em cada um, na ordem da API. Tipo desconhecido fica fora. */
export function rascunhoDasRegras(regras: readonly RegraDeAtencao[]): RegraEmEdicao[] {
  return regras
    .filter((r) => ehTipoDeRegra(r.tipo))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => ordemDoTipo(a.r.tipo) - ordemDoTipo(b.r.tipo) || a.i - b.i)
    .map(({ r }) => ({
      chave: r.id, id: r.id, tipo: r.tipo, perguntaId: r.perguntaId ?? null,
      limite: r.limite === null || r.limite === undefined ? '' : numeroParaTela(r.limite, 1), ativa: r.ativa,
    }));
}

/** Regra nova, ligada, sem pergunta e com o número vazio (o app nunca sugere número). */
export function novaRegra(tipo: TipoDeRegraDeAtencao, chave: string): RegraEmEdicao {
  return { chave, id: null, tipo, perguntaId: null, limite: '', ativa: true };
}

/**
 * O interruptor do modelo. Desligar põe `ativa:false` em todas as regras dele (o número fica guardado). Ligar religa as que
 * existem, com o número de antes, e só cria uma nova (vazia) se o modelo não tiver nenhuma: os modelos sem pergunta têm uma
 * linha só (o índice único do servidor), então desligar e ligar de novo não pode criar outra.
 */
export function alternarModelo(rascunho: readonly RegraEmEdicao[], tipo: TipoDeRegraDeAtencao, ligar: boolean, chaveNova: string): RegraEmEdicao[] {
  if (ligar && !rascunho.some((r) => r.tipo === tipo)) return [...rascunho, novaRegra(tipo, chaveNova)];
  return rascunho.map((r) => (r.tipo === tipo ? { ...r, ativa: ligar } : r));
}

export const regrasDoModelo = (rascunho: readonly RegraEmEdicao[], tipo: TipoDeRegraDeAtencao) => rascunho.filter((r) => r.tipo === tipo);

/** O modelo está ligado quando tem ao menos uma regra ligada. */
export const modeloLigado = (rascunho: readonly RegraEmEdicao[], tipo: TipoDeRegraDeAtencao) => rascunho.some((r) => r.tipo === tipo && r.ativa);

/** Resumo da faixa do cartão: "Nenhuma regra ligada", "1 de 6 ligada", "2 de 6 ligadas" (por modelo). */
export function resumoDasRegras(rascunho: readonly RegraEmEdicao[]): string {
  const n = TIPOS_DE_REGRA.filter((t) => modeloLigado(rascunho, t)).length;
  if (n === 0) return 'Nenhuma regra ligada';
  return `${n} de ${TIPOS_DE_REGRA.length} ${n === 1 ? 'ligada' : 'ligadas'}`;
}

/** Motivo de "Adicionar outra pergunta" desabilitado no teto (C2); nulo = pode adicionar. Toda linha conta (a desligada também é linha). */
export function motivoDoTeto(rascunho: readonly RegraEmEdicao[], teto: number): string | null {
  return rascunho.length >= teto ? `Limite de ${teto} regras de atenção.` : null;
}

/**
 * O que vai no lote: toda regra gravada (sair do corpo apaga a regra e as exceções dela, então só o "Remover" tira uma
 * gravada do rascunho) e toda nova ligada. Nova desligada não vai: não há nada para guardar.
 */
export const vaiNoLote = (r: RegraEmEdicao) => r.id !== null || r.ativa;

/** Leitura (sem `REGRA_ATENCAO_ALTERAR`): "Ligada: Sono 5 ou menos" ou "Desligada". */
export function textoDaLeitura(regra: RegraEmEdicao, perguntas: readonly PerguntaDaRegra[]): string {
  if (!regra.ativa) return TEXTOS_DAS_REGRAS.desligada;
  const p = perguntaDaRegra(regra.tipo, regra.perguntaId, perguntas);
  const limite = numeroDaTela(regra.limite);
  return `Ligada: ${textoDaRegra(regra.tipo, typeof limite === 'number' ? limite : null, p?.rotulo)}`;
}

// ---- Validação ----

export interface ErrosDaRegra { perguntaId?: string; limite?: string }

function erroDoNumero(regra: RegraEmEdicao, perguntas: readonly PerguntaDaRegra[]): string | undefined {
  const escala = perguntaDaRegra(regra.tipo, regra.perguntaId, perguntas)?.escala ?? null;
  const faixa = faixaDoNumero(regra.tipo, escala);
  if (!faixa) return undefined;
  const texto = regra.limite.trim();
  if (!texto) return ERROS_DAS_REGRAS.digiteONumero;
  const n = numeroDaTela(texto, faixa.inteiro);
  if (n === undefined || n === null) return faixa.inteiro ? ERROS_DAS_REGRAS.inteiro : faixa.mensagem;
  if (!faixa.inteiro && (texto.split(/[.,]/)[1]?.length ?? 0) > 1) return ERROS_DAS_REGRAS.umaCasa;
  return n < faixa.min || n > faixa.max ? faixa.mensagem : undefined;
}

/**
 * Erros de cada regra que vai no lote (`vaiNoLote`), pela chave. Valida também a gravada desligada (ela vai no corpo): a tela
 * mostra os campos do modelo que tiver erro. Pergunta repetida no mesmo modelo marca da segunda em diante (o índice único
 * do servidor conta as desligadas também).
 */
export function errosDasRegras(rascunho: readonly RegraEmEdicao[], perguntas: readonly PerguntaDaRegra[]): Record<string, ErrosDaRegra> {
  const erros: Record<string, ErrosDaRegra> = {};
  const vistas = new Set<string>();
  for (const r of rascunho.filter(vaiNoLote)) {
    const e: ErrosDaRegra = {};
    if (MODELOS_DE_REGRA[r.tipo].pergunta) {
      if (!r.perguntaId) e.perguntaId = ERROS_DAS_REGRAS.escolhaAPergunta;
      else {
        const chave = chaveDaPergunta(r.tipo, r.perguntaId);
        if (vistas.has(chave)) e.perguntaId = ERROS_DAS_REGRAS.repetida;
        vistas.add(chave);
      }
    }
    const limite = erroDoNumero(r, perguntas);
    if (limite) e.limite = limite;
    if (e.perguntaId || e.limite) erros[r.chave] = e;
  }
  return erros;
}

export const temErros = (erros: Readonly<Record<string, ErrosDaRegra>>) => Object.keys(erros).length > 0;

// ---- Lote (C1) ----

function paraEnvio(r: RegraEmEdicao): RegraDeAtencaoEnvio {
  const modelo = MODELOS_DE_REGRA[r.tipo];
  const limite = modelo.campo ? numeroDaTela(r.limite) : null;
  return {
    ...(r.id ? { id: r.id } : {}),
    tipo: r.tipo,
    perguntaId: modelo.pergunta ? r.perguntaId : null,
    limite: typeof limite === 'number' ? limite : null,
    ativa: r.ativa,
  };
}

/**
 * Corpo do `PUT /regras-de-atencao`, só com o que `vaiNoLote`. `chaves[i]` é a linha do rascunho de `regras[i]`, para levar o
 * 422 (`regras[i].campo`) de volta à linha certa. Chame depois de `errosDasRegras` vazio. `gravadas`: as regras de tipo que
 * esta versão do app não conhece (fora do rascunho) voltam como estão, senão o lote as apagaria com as exceções.
 */
export function corpoDoLote(versao: number, rascunho: readonly RegraEmEdicao[], gravadas: readonly RegraDeAtencao[] = []):
  { corpo: SalvarRegrasDeAtencao; chaves: string[] } {
  const enviadas = rascunho.filter(vaiNoLote);
  const desconhecidas = gravadas.filter((r) => !ehTipoDeRegra(r.tipo));
  return {
    corpo: {
      versao,
      regras: [
        ...enviadas.map(paraEnvio),
        ...desconhecidas.map((r) => ({ id: r.id, tipo: r.tipo, perguntaId: r.perguntaId, limite: r.limite, ativa: r.ativa })),
      ],
    },
    chaves: [...enviadas.map((r) => r.chave), ...desconhecidas.map((r) => r.id)],
  };
}

/** O rascunho difere do gravado? (a barra "Alterações não salvas" e a guarda de saída). Nova desligada não conta. */
export function rascunhoMudou(rascunho: readonly RegraEmEdicao[], gravadas: readonly RegraDeAtencao[]): boolean {
  const assinatura = (lista: readonly RegraEmEdicao[]) =>
    JSON.stringify(lista.filter(vaiNoLote).map((r) => [r.id, r.tipo, r.perguntaId, r.limite.trim(), r.ativa]));
  return assinatura(rascunho) !== assinatura(rascunhoDasRegras(gravadas));
}

/**
 * Os erros do 422 `REGRA_INVALIDA` (`fieldErrors` já por campo): `regras[i].perguntaId|limite` vão para a linha `chaves[i]`
 * do lote enviado; o que não aponta uma linha conhecida vai para `geral` (a mensagem não se perde).
 */
export function errosDoLoteDaApi(campos: Readonly<Record<string, string>>, chaves: readonly string[]):
  { porRegra: Record<string, ErrosDaRegra>; geral?: string } {
  const porRegra: Record<string, ErrosDaRegra> = {};
  let geral: string | undefined;
  for (const [campo, mensagem] of Object.entries(campos)) {
    const m = /^regras\[(\d+)\]\.(perguntaId|limite)$/.exec(campo);
    const chave = m ? chaves[Number(m[1])] : undefined;
    if (m && chave) porRegra[chave] = { ...porRegra[chave], [m[2]]: mensagem };
    else geral ??= mensagem;
  }
  return { porRegra, ...(geral ? { geral } : {}) };
}
