import type { CondicaoPergunta, ConteudoQuestionario, ItemDaLista, ItemEscolhido, ItensDisponiveis, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao } from '../api/tipos';
import { cpfValido, telefoneValido as telefoneDoCadastroValido } from '@plataforma/web';

import { CAMPOS_DO_ENDERECO, errosDoEndereco } from './cadastroDoAluno';
import { dataNaFaixa, regraDaPerguntaData } from './datasValidas';
import { hojeIso } from './formatos';
import { escalaDaNota, FONTES_DE_ITENS, LIMITES_DE_ITENS, LIMITES_QUESTIONARIO, maximoDeFotos, maximoDeItens, modoDoMotivo, MOTIVOS_DE_ITENS } from './questionario';

const nota = (v: unknown, min: number = LIMITES_QUESTIONARIO.notaMinPadrao, max: number = LIMITES_QUESTIONARIO.notaMaxPadrao) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** NOTA dentro da escala da pergunta (de `min` a `max`; sem elas, de 0 a 10). */
function notaValida(p: PerguntaAtualizacao, v: unknown) {
  const { min, max } = escalaDaNota(p);
  return nota(v, min, max);
}

function numeroValido(p: PerguntaAtualizacao, v: unknown) {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > LIMITES_QUESTIONARIO.numeroAbsoluto) return false;
  const casas = typeof p.casas === 'number' ? p.casas : 0;
  if (Number(v.toFixed(casas)) !== v) return false;
  if (typeof p.min === 'number' && v < p.min) return false;
  return !(typeof p.max === 'number' && v > p.max);
}

function multiplaValida(p: PerguntaAtualizacao, v: unknown) {
  if (!Array.isArray(v)) return false;
  const ids = new Set((p.opcoes ?? []).map((o) => o.id));
  const vistos = new Set<unknown>();
  return v.every((item) => typeof item === 'string' && ids.has(item) && !vistos.has(item) && !!vistos.add(item));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const TELEFONE = /^[0-9()+\-. ]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lista de ids (UUID) de fotos já enviadas, sem repetir, até `maximoDeFotos` (um por lugar com `lugares`; senão o `max`, sem ele `fotosPorPergunta`). */
function fotosValidas(p: PerguntaAtualizacao, v: unknown) {
  if (!Array.isArray(v) || v.length > maximoDeFotos(p)) return false;
  const vistos = new Set<string>();
  return v.every((id) => typeof id === 'string' && UUID.test(id) && !vistos.has(id.toLowerCase()) && !!vistos.add(id.toLowerCase()));
}

/** AAAA-MM-DD de verdade (sem 30/02), de 1900 até hoje com `somentePassado` e, sem ele, até 31/12 do ano de hoje + 5. */
function dataValida(p: PerguntaAtualizacao, v: unknown, hoje: string) {
  if (typeof v !== 'string') return false;
  const m = DATA.exec(v);
  if (!m) return false;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return false;
  return dataNaFaixa(v, regraDaPerguntaData(p.somentePassado), hoje);
}

/** Só dígitos, espaço, parênteses, +, - e ponto; de 10 a 13 dígitos (DDD + número, com ou sem o 55). */
function telefoneValido(v: unknown) {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  if (t.length > LIMITES_QUESTIONARIO.telefoneTamanho || !TELEFONE.test(t)) return false;
  const digitos = t.replace(/\D/g, '').length;
  return digitos >= LIMITES_QUESTIONARIO.telefoneDigitosMinimo && digitos <= LIMITES_QUESTIONARIO.telefoneDigitosMaximo;
}

const emailValido = (v: unknown) => typeof v === 'string' && v.trim().length <= LIMITES_QUESTIONARIO.emailTamanho && EMAIL.test(v.trim());

/** Objeto linha → coluna, só com linhas e colunas da pergunta (a obrigatória, com todas as linhas, é conferida à parte). */
function gradeValida(p: PerguntaAtualizacao, v: unknown) {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const linhas = new Set((p.linhas ?? []).map((l) => l.id));
  const colunas = new Set((p.colunas ?? []).map((c) => c.id));
  return Object.entries(v).every(([linha, coluna]) => linhas.has(linha) && typeof coluna === 'string' && colunas.has(coluna));
}

/**
 * ENDERECO: objeto só com as chaves do endereço, cada uma um texto (chave desconhecida ou valor que não é texto, incluindo
 * `null`, é inválido). O resto é a regra única do endereço (`errosDoEndereco`): vazio vale; preenchido, os cinco campos
 * obrigatórios, CEP e UF válidos e o limite de cada um contado depois do strip.
 */
function enderecoValido(v: unknown) {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  if (!Object.entries(v).every(([campo, texto]) => (CAMPOS_DO_ENDERECO as readonly string[]).includes(campo) && typeof texto === 'string')) return false;
  return Object.keys(errosDoEndereco(v as Record<string, string>)).length === 0;
}

/** Objeto só com chaves do endereço e todos os valores em branco: a API conta como "não respondido" (some, ou falta se obrigatória). */
const enderecoEmBranco = (v: unknown) =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
  && Object.entries(v).every(([campo, texto]) => (CAMPOS_DO_ENDERECO as readonly string[]).includes(campo) && typeof texto === 'string' && texto.trim() === '');

/** Tamanho máximo da resposta de texto: o do objetivo ou do CPF do cadastro quando a resposta vai para lá (anamnese). */
export function tamanhoDoTexto(p: Pick<PerguntaAtualizacao, 'tipo' | 'destino'>) {
  if (p.destino === 'OBJETIVO') return LIMITES_QUESTIONARIO.objetivoTamanho;
  if (p.destino === 'CPF') return LIMITES_QUESTIONARIO.cpfTamanho;
  return p.tipo === 'TEXTO' ? LIMITES_QUESTIONARIO.textoCurtoCapacidade : LIMITES_QUESTIONARIO.textoLongoCapacidade;
}

/** Minúsculas, sem acento, espaços simples e sem as pontas: o mesmo cálculo de `Buscas.semAcento` do Java (dois itens com o mesmo nome valem como um). */
export const nomeNormalizadoDeItem = (nome: string) => nome.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Itens gravados (`[{id, nome, motivo?}]`, o que o servidor guarda) ou a mensagem fixa do erro (nunca repete id, nome nem motivo). */
export type ConferenciaDeItens = { limpa: ItemEscolhido[] } | { erro: string };

/**
 * Resposta de ITENS_DO_PLANO, as mesmas recusas do `RespostaDeItens` do Java. `itens` é a lista de cada fonte (sem ela, toda
 * resposta é recusada). A `limpa` leva o `nome` lido da lista, na ordem escolhida, com o motivo sem as pontas (some se vazio).
 * Dado sensível (dieta, dor): a mensagem é fixa.
 */
export function conferirItens(p: PerguntaAtualizacao, v: unknown, itens: ItensDisponiveis = {}): ConferenciaDeItens {
  const modo = modoDoMotivo(p);
  const fonte = p.fonte;
  if (fonte == null || !FONTES_DE_ITENS.includes(fonte) || !MOTIVOS_DE_ITENS.includes(modo)) return { erro: 'Esta pergunta está mal configurada.' };
  if (!Array.isArray(v)) return { erro: 'Confira os itens escolhidos.' };
  if (v.length > maximoDeItens(p)) return { erro: 'Mais itens do que o permitido.' };
  const permitidos = new Map<string, ItemDaLista>();
  for (const i of itens[fonte] ?? []) if (!permitidos.has(i.id)) permitidos.set(i.id, i);
  const ids = new Set<string>();
  const nomes = new Set<string>();
  const limpa: ItemEscolhido[] = [];
  for (const escolhido of v as unknown[]) {
    if (typeof escolhido !== 'object' || escolhido === null || Array.isArray(escolhido)) return { erro: 'Confira os itens escolhidos.' };
    const { id, motivo } = escolhido as Record<string, unknown>;
    if (Object.keys(escolhido).some((k) => k !== 'id' && k !== 'motivo') || typeof id !== 'string') return { erro: 'Confira os itens escolhidos.' };
    const item = permitidos.get(id);
    if (!item) return { erro: 'Item que não está na lista.' };
    const nome = nomeNormalizadoDeItem(item.nome);
    if (ids.has(item.id) || nomes.has(nome)) return { erro: 'Item repetido.' };
    ids.add(item.id);
    nomes.add(nome);
    if (motivo != null && typeof motivo !== 'string') return { erro: 'Confira o motivo.' };
    const texto = typeof motivo === 'string' ? motivo.trim() : '';
    if (texto.length > LIMITES_DE_ITENS.motivoTamanho) return { erro: 'Motivo longo demais.' };
    if (modo === 'OBRIGATORIO' && texto === '') return { erro: 'Informe o motivo de cada item.' };
    if (modo === 'NENHUM' && texto !== '') return { erro: 'Esta pergunta não pede motivo.' };
    limpa.push({ id: item.id, nome: item.nome, ...(texto === '' ? {} : { motivo: texto }) });
  }
  return { limpa };
}

/** Os itens da resposta de ITENS_DO_PLANO (lista vazia se a resposta não tem a forma certa); o contrário de `respostaDeItens`. */
export const itensDaResposta = (valor: RespostaAtualizacao | undefined): ItemEscolhido[] =>
  Array.isArray(valor) ? (valor as unknown[]).filter((i): i is ItemEscolhido => typeof i === 'object' && i !== null && !Array.isArray(i)) : [];

/** Guarda os itens escolhidos como resposta (`RespostaAtualizacao` não os lista na união: ver `ItemEscolhido`). */
export const respostaDeItens = (itens: readonly ItemEscolhido[]): RespostaAtualizacao => itens as unknown as RespostaAtualizacao;

/** Uma resposta (já presente) respeita o tipo e os limites da pergunta. Mesmas regras do `ValidadorAtualizacao`. `itens`: só o ITENS_DO_PLANO a usa. */
export function respostaValida(p: PerguntaAtualizacao, v: unknown, hoje: string = hojeIso(), itens: ItensDisponiveis = {}) {
  switch (p.tipo) {
    case 'NOTA': return notaValida(p, v);
    case 'PESO': return typeof v === 'number' && Number.isFinite(v) && v >= 20 && v <= 400 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-8;
    case 'TEXTO': return typeof v === 'string' && v.length <= tamanhoDoTexto(p) && (p.destino !== 'CPF' || cpfValido(v));
    case 'TEXTO_LONGO': return typeof v === 'string' && v.length <= tamanhoDoTexto(p);
    case 'NOTAS_POR_DIA':
      return typeof v === 'object' && v !== null && !Array.isArray(v)
        && Object.entries(v).every(([d, n]) => (p.dias ?? []).some((dia) => String(dia) === d) && (n == null || nota(n)));
    case 'ESCOLHA_UNICA': return typeof v === 'string' && (p.opcoes ?? []).some((o) => o.id === v);
    case 'MULTIPLA_ESCOLHA': return multiplaValida(p, v);
    case 'NUMERO': return numeroValido(p, v);
    case 'SIM_NAO': return typeof v === 'boolean';
    case 'FOTOS': return fotosValidas(p, v);
    case 'DATA': return dataValida(p, v, hoje);
    case 'TELEFONE': return telefoneValido(v) && (p.destino !== 'TELEFONE' || (typeof v === 'string' && telefoneDoCadastroValido(v)));
    case 'EMAIL': return emailValido(v);
    case 'GRADE': return gradeValida(p, v);
    case 'ENDERECO': return enderecoValido(v);
    case 'ACEITE': return v === true;
    case 'ITENS_DO_PLANO': return 'limpa' in conferirItens(p, v, itens);
    default: return false;
  }
}

/** `false` e `0` são respostas; só ausência, texto em branco, lista vazia e objeto vazio (notas por dia, grade) contam como "não respondido". */
export const respondida = (v: unknown) =>
  !(v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));

/** `respondida` da pergunta: um endereço todo em branco também não conta como resposta. */
export const respondidaNaPergunta = (p: Pick<PerguntaAtualizacao, 'tipo'>, v: unknown) =>
  respondida(v) && !(p.tipo === 'ENDERECO' && enderecoEmBranco(v));

/**
 * Sem condição, visível. Com ela, a resposta (já aceita e visível) da pergunta de controle precisa ser um dos valores:
 * id da opção (escolha única), algum id marcado (múltipla) ou `sim`/`nao`. Sem resposta = escondida.
 */
export function condicaoAtendida(condicao: CondicaoPergunta | undefined, aceitas: ReadonlyMap<string, RespostaAtualizacao>) {
  if (!condicao) return true;
  const r = aceitas.get(condicao.perguntaId);
  if (r === undefined) return false;
  const valores = new Set(condicao.valores ?? []);
  if (typeof r === 'boolean') return valores.has(r ? 'sim' : 'nao');
  if (typeof r === 'string') return valores.has(r);
  if (Array.isArray(r)) return (r as unknown[]).some((item) => typeof item === 'string' && valores.has(item));
  return false;
}

/** Tipos que o aluno não responde (ou, com as fotos desligadas, não consegue responder). */
const ignorada = (p: PerguntaAtualizacao, fotosLigadas: boolean) =>
  p.tipo === 'DATA_AUTOMATICA' || p.tipo === 'INFORMATIVO' || (p.tipo === 'FOTOS' && !fotosLigadas);

export interface Avaliacao {
  erros: Record<string, string>;
  /** Respostas que seriam enviadas: só as válidas de perguntas visíveis (as escondidas são descartadas). */
  aceitas: RespostasAtualizacao;
  /** Ids das perguntas escondidas por condição (da pergunta ou da seção). */
  escondidas: Set<string>;
  /** Índices das seções escondidas por condição. */
  secoesEscondidas: Set<number>;
}

/**
 * Passa pelo questionário na ordem, como o `ValidadorAtualizacao` do Java: decide o que está visível (pela resposta
 * aceita das perguntas de controle), o que falta e o que seria enviado. Fotos ainda no aparelho (celular) contam como
 * respondidas e no limite da pergunta.
 */
export function avaliarRespostas(
  modelo: ConteudoQuestionario,
  respostas: RespostasAtualizacao,
  fotosLigadas = false,
  fotosNoAparelho: Readonly<Record<string, number>> = {},
  hoje: string = hojeIso(),
  /** Lista de cada fonte do ITENS_DO_PLANO (`dominio/itensDoPlano`); sem ela, a resposta dessa pergunta é recusada. */
  itens: ItensDisponiveis = {},
): Avaliacao {
  const erros: Record<string, string> = {};
  const aceitasMapa = new Map<string, RespostaAtualizacao>();
  const escondidas = new Set<string>();
  const secoesEscondidas = new Set<number>();
  modelo.secoes.forEach((secao, si) => {
    const secaoVisivel = condicaoAtendida(secao.mostrarSe, aceitasMapa);
    if (!secaoVisivel) secoesEscondidas.add(si);
    for (const p of secao.perguntas) {
      if (!secaoVisivel || !condicaoAtendida(p.mostrarSe, aceitasMapa)) { escondidas.add(p.id); continue; }
      if (ignorada(p, fotosLigadas)) continue;
      const v = respostas[p.id];
      const noAparelho = p.tipo === 'FOTOS' ? (fotosNoAparelho[p.id] ?? 0) : 0;
      if (noAparelho > 0) {
        const enviadas = Array.isArray(v) ? v.length : 0;
        if (respondidaNaPergunta(p, v) && !respostaValida(p, v, hoje)) erros[p.id] = 'Confira o formato e os limites deste campo.';
        else if (enviadas + noAparelho > maximoDeFotos(p)) erros[p.id] = 'Há fotos demais nesta pergunta.';
        else if (respondidaNaPergunta(p, v)) aceitasMapa.set(p.id, v as RespostaAtualizacao);
        continue;
      }
      if (!respondidaNaPergunta(p, v)) {
        if (p.obrigatoria) erros[p.id] = 'Preencha este campo.';
        continue;
      }
      if (p.tipo === 'GRADE' && p.obrigatoria && gradeValida(p, v) && Object.keys(v as object).length < (p.linhas ?? []).length) {
        erros[p.id] = 'Responda todas as linhas.';
        continue;
      }
      if (p.tipo === 'ITENS_DO_PLANO') {
        const conferencia = conferirItens(p, v, itens);
        if ('erro' in conferencia) { erros[p.id] = conferencia.erro; continue; }
      } else if (!respostaValida(p, v, hoje)) { erros[p.id] = 'Confira o formato e os limites deste campo.'; continue; }
      aceitasMapa.set(p.id, v);
    }
  });
  return { erros, aceitas: Object.fromEntries(aceitasMapa), escondidas, secoesEscondidas };
}

function excedeBytes(respostas: RespostasAtualizacao) {
  const bytes = Array.from(JSON.stringify(respostas)).reduce((total, c) => {
    const codigo = c.codePointAt(0) ?? 0;
    return total + (codigo < 128 ? 1 : codigo < 2048 ? 2 : codigo < 65536 ? 3 : 4);
  }, 0);
  return bytes > LIMITES_QUESTIONARIO.respostasBytes;
}

/**
 * Validação para marcar o campo; o servidor sempre valida novamente contra sua versão. Mesmas regras do
 * `ValidadorAtualizacao` do Java (o teste de paridade confere os campos com erro). Lista vazia, texto em branco e
 * objeto vazio contam como "não respondido"; pergunta escondida por condição não é obrigatória. Com as fotos desligadas
 * (padrão do servidor) a pergunta FOTOS é ignorada; ligadas, a resposta é a lista de ids das fotos já enviadas.
 */
export function errosRespostasAtualizacao(
  modelo: ConteudoQuestionario,
  respostas: RespostasAtualizacao,
  fotosLigadas = false,
  /** Fotos ainda no aparelho (celular), por pergunta: vão subir no envio, então já contam como respondidas e no limite. */
  fotosNoAparelho: Readonly<Record<string, number>> = {},
  hoje: string = hojeIso(),
  itens: ItensDisponiveis = {},
) {
  const { erros } = avaliarRespostas(modelo, respostas, fotosLigadas, fotosNoAparelho, hoje, itens);
  if (excedeBytes(respostas)) return { respostas: 'As respostas ultrapassam o limite de 256 KiB.', ...erros };
  return erros;
}

/**
 * O que vai no envio: as respostas que o aluno vê, sem as das perguntas escondidas por condição (que nunca viram "não").
 * Fotos e respostas ainda não válidas seguem como estão: o servidor confere e aponta o campo.
 */
export function respostasParaEnviar(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao, fotosLigadas = false): RespostasAtualizacao {
  const { escondidas } = avaliarRespostas(modelo, respostas, fotosLigadas);
  const deItens = new Set(modelo.secoes.flatMap((s) => s.perguntas).filter((p) => p.tipo === 'ITENS_DO_PLANO').map((p) => p.id));
  return Object.fromEntries(Object.entries(respostas).filter(([id]) => !escondidas.has(id)).map(([id, v]) => [id, deItens.has(id) ? semNomeDosItens(v) : v]));
}

/** O servidor recusa `nome` vindo do cliente (ele lê o nome da lista): o envio leva só `{id, motivo?}`. */
const semNomeDosItens = (v: RespostaAtualizacao): RespostaAtualizacao =>
  Array.isArray(v)
    ? respostaDeItens((v as unknown[]).map((i) => (typeof i === 'object' && i !== null && !Array.isArray(i) ? Object.fromEntries(Object.entries(i).filter(([k]) => k !== 'nome')) : i)) as ItemEscolhido[])
    : v;
