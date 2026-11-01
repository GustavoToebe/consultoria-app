import { codigoApi, emailValido, errosPorCampo, formatarTelefone, somenteDigitos, telefoneValido } from '@plataforma/web';

import type {
  CampoDaInscricao,
  DuplicidadeInscricao,
  Encerramento,
  EtapaAberta,
  EventoInscricao,
  FiltroInscricoes,
  IndicadoresInscricoes,
  InscricaoPublicaRequest,
  Interesse,
  Modalidade,
  ModalidadeDesejada,
  MotivoEncerramento,
  Origem,
  OrigemInformada,
  PagamentoInscricao,
  Periodicidade,
  PrevisaoInicio,
  PropostaInscricao,
  SituacaoInscricao,
} from '../api/inscricoesTipos';
import type { ConteudoQuestionario, OpcaoQuestionario, RespostasAtualizacao } from '../api/tipos';
import { centavosDaTela, SEM_DADO } from './formatos';
import { respostasParaEnviar } from './respostasAtualizacao';

/**
 * Regras puras da inscrição por link e da fila de interessados. As validações espelham a API (`InscricaoPublicaRequest`
 * e `Formatos.telefone`), que decide de verdade; o telefone e o e-mail usam as regras do `@plataforma/web`, iguais ao
 * `web/Formatos.java`.
 */

export type TipoDeSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/** Limites dos campos (mesmos do `@Size` da API). */
export const LIMITES_INSCRICAO = {
  nome: 120, email: 254, objetivo: 500, texto: 2000, nota: 2000,
  motivoDetalhe: 300, motivoReabertura: 200, condicoes: 500, planoNome: 120, retorno: 200,
  modeloNome: 60, modeloTexto: 1000,
} as const;

const SITUACOES: Record<SituacaoInscricao, { texto: string; tipo: TipoDeSelo }> = {
  NOVA: { texto: 'Nova', tipo: 'atencao' },
  EM_CONTATO: { texto: 'Em contato', tipo: 'atencao' },
  EM_NEGOCIACAO: { texto: 'Em negociação', tipo: 'atencao' },
  ACEITA: { texto: 'Aceita', tipo: 'sucesso' },
  RECUSADA: { texto: 'Recusada', tipo: 'neutro' },
  DESISTIU: { texto: 'Desistiu', tipo: 'neutro' },
};

const PAGAMENTOS: Record<PagamentoInscricao, { texto: string; tipo: TipoDeSelo }> = {
  NAO_CONTROLADO: { texto: 'Não controlado', tipo: 'neutro' },
  AGUARDANDO: { texto: 'Aguardando', tipo: 'atencao' },
  CONFIRMADO_MANUAL: { texto: 'Confirmado (manual)', tipo: 'sucesso' },
};

/** Selo da situação comercial: âmbar enquanto em atendimento, verde aceita, cinza encerrada (nunca a cor da marca). */
export function seloDaSituacao(s: SituacaoInscricao): { texto: string; tipo: TipoDeSelo } {
  return SITUACOES[s];
}

export function seloDoPagamento(p: PagamentoInscricao): { texto: string; tipo: TipoDeSelo } {
  return PAGAMENTOS[p];
}

/** Filtros da lista, na ordem da tela. */
export const FILTROS_INSCRICOES: { valor: FiltroInscricoes; rotulo: string }[] = [
  { valor: 'ABERTAS', rotulo: 'Em atendimento' },
  { valor: 'NOVA', rotulo: 'Novas' },
  { valor: 'EM_CONTATO', rotulo: 'Em contato' },
  { valor: 'EM_NEGOCIACAO', rotulo: 'Em negociação' },
  { valor: 'ACEITA', rotulo: 'Aceitas' },
  { valor: 'RECUSADA', rotulo: 'Recusadas' },
  { valor: 'DESISTIU', rotulo: 'Desistiram' },
  { valor: 'TODAS', rotulo: 'Todas' },
];

export const OPCOES_PAGAMENTO: { valor: PagamentoInscricao; rotulo: string }[] = [
  { valor: 'NAO_CONTROLADO', rotulo: 'Não controlado' },
  { valor: 'AGUARDANDO', rotulo: 'Aguardando' },
  { valor: 'CONFIRMADO_MANUAL', rotulo: 'Confirmado' },
];

/** Etapas abertas, na ordem do atendimento (as colunas do Kanban). */
export const ETAPAS_ABERTAS: readonly EtapaAberta[] = ['NOVA', 'EM_CONTATO', 'EM_NEGOCIACAO'];
/** Situações encerradas, mostradas à parte ("Mostrar encerradas"). */
export const SITUACOES_ENCERRADAS: readonly SituacaoInscricao[] = ['ACEITA', 'RECUSADA', 'DESISTIU'];

export const estaAberta = (s: SituacaoInscricao): s is EtapaAberta => (ETAPAS_ABERTAS as readonly string[]).includes(s);
export const estaEncerradaSemAluno = (s: SituacaoInscricao): s is Encerramento => s === 'RECUSADA' || s === 'DESISTIU';

/**
 * Situações que a pessoa pode escolher no andamento: de uma etapa aberta, só as abertas (encerrar e aceitar têm botão
 * próprio, com motivo e conferência); encerrada ou aceita fica como está (só "Reabrir" volta ao atendimento).
 */
export function situacoesDoAndamento(atual: SituacaoInscricao): { valor: SituacaoInscricao; rotulo: string }[] {
  if (!estaAberta(atual)) return [{ valor: atual, rotulo: SITUACOES[atual].texto }];
  return ETAPAS_ABERTAS.map((valor) => ({ valor, rotulo: SITUACOES[valor].texto }));
}

/** Aceitar e encerrar só de uma etapa aberta; de encerrada, primeiro "Reabrir". */
export const podeAceitar = (s: SituacaoInscricao) => estaAberta(s);
export const podeEncerrar = (s: SituacaoInscricao) => estaAberta(s);
export const podeReabrir = (s: SituacaoInscricao) => estaEncerradaSemAluno(s);

// ---- Rótulos do CRM ----

export const MOTIVOS: Record<MotivoEncerramento, string> = {
  PRECO: 'Preço',
  SEM_RETORNO: 'Sem retorno',
  MOMENTO: 'Momento inadequado',
  OUTRO_SERVICO: 'Escolheu outro serviço',
  SERVICO_INCOMPATIVEL: 'Serviço incompatível',
  OUTRO: 'Outro',
};
export const OPCOES_MOTIVO = (Object.keys(MOTIVOS) as MotivoEncerramento[]).map((valor) => ({ valor, rotulo: MOTIVOS[valor] }));
/** Motivo do encerramento; registros antigos (nulo) = "Não informado". */
export const rotuloDoMotivo = (m: MotivoEncerramento | null | undefined) => (m ? MOTIVOS[m] : 'Não informado');

export const ENCERRAMENTOS: { valor: Encerramento; rotulo: string }[] = [
  { valor: 'RECUSADA', rotulo: 'Recusada pela equipe' },
  { valor: 'DESISTIU', rotulo: 'A pessoa desistiu' },
];

export const MODALIDADES: Record<Modalidade, string> = { ONLINE: 'Online', PRESENCIAL: 'Presencial', HIBRIDO: 'Híbrido' };
export const OPCOES_MODALIDADE = (Object.keys(MODALIDADES) as Modalidade[]).map((valor) => ({ valor, rotulo: MODALIDADES[valor] }));

export const PERIODICIDADES: Record<Periodicidade, string> = {
  MENSAL: 'Mensal', TRIMESTRAL: 'Trimestral', SEMESTRAL: 'Semestral', ANUAL: 'Anual', PARCELA_UNICA: 'Parcela única',
};
export const OPCOES_PERIODICIDADE = (Object.keys(PERIODICIDADES) as Periodicidade[]).map((valor) => ({ valor, rotulo: PERIODICIDADES[valor] }));

const NAO_SEI = 'Ainda não sei';
export const INTERESSES: Record<Interesse, string> = { TREINO: 'Treino', DIETA: 'Dieta', TREINO_E_DIETA: 'Treino e dieta', NAO_SEI };
export const MODALIDADES_DESEJADAS: Record<ModalidadeDesejada, string> = { ...MODALIDADES, NAO_SEI };
export const PREVISOES: Record<PrevisaoInicio, string> = { AGORA: 'Agora', ESTE_MES: 'Este mês', PROXIMO_MES: 'Próximo mês', NAO_SEI };
export const ORIGENS_INFORMADAS: Record<OrigemInformada, string> = { INDICACAO: 'Indicação', INSTAGRAM: 'Instagram', GOOGLE: 'Google', OUTRA: 'Outra' };
export const ORIGENS: Record<Origem, string> = { INDICACAO: 'Indicação', INSTAGRAM: 'Instagram', GOOGLE: 'Google', CAMPANHA: 'Campanha', OUTRA: 'Outra' };
export const OPCOES_ORIGEM = (Object.keys(ORIGENS) as Origem[]).map((valor) => ({ valor, rotulo: ORIGENS[valor] }));
export const rotuloDaOrigem = (o: Origem | null | undefined) => (o ? ORIGENS[o] : 'Não informada');

/** Opções de uma resposta opcional do formulário público: "Não informar" (vazio) e as do mapa. */
export function opcoesOpcionais<T extends string>(rotulos: Record<T, string>): { valor: T | ''; rotulo: string }[] {
  return [{ valor: '', rotulo: 'Não informar' }, ...(Object.keys(rotulos) as T[]).map((valor) => ({ valor, rotulo: rotulos[valor] }))];
}

/** Texto de uma resposta opcional do formulário (nulo = "—"). */
export function rotuloOpcional<T extends string>(rotulos: Record<T, string>, valor: T | null | undefined): string {
  return valor ? rotulos[valor] ?? SEM_DADO : SEM_DADO;
}

/** Parâmetro `?origem=` do link: só `[a-z0-9_-]{1,40}` (em minúsculas); qualquer outro valor é ignorado. */
export function origemDoLink(param: string | string[] | null | undefined): string | null {
  const bruto = Array.isArray(param) ? param[0] : param;
  if (!bruto) return null;
  const valor = bruto.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(valor) ? valor : null;
}

/**
 * Link do WhatsApp sem texto pré-preenchido (nada de dado da pessoa na URL): `https://wa.me/55<DDD+número>`. Telefone
 * fora do padrão (sem DDD, curto) não vira link.
 */
export function linkDoWhatsApp(whatsapp: string | null | undefined): string | null {
  if (!whatsapp || !telefoneValido(whatsapp)) return null;
  let d = somenteDigitos(whatsapp);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return `https://wa.me/55${d}`;
}

/** Objetivo curto para a linha da lista; ausente é "—". */
export function resumoDoObjetivo(texto: string | null | undefined, maximo = 80): string {
  const limpo = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpo) return SEM_DADO;
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}…`;
}

/** Aviso de possível duplicidade (só aviso: nada é fundido); `null` sem duplicidade. */
export function textoDaDuplicidade(d: DuplicidadeInscricao | null | undefined): string | null {
  if (!d) return null;
  const partes: string[] = [];
  if (d.alunoExistente) partes.push('Já existe um aluno com este e-mail.');
  if (d.outrasInscricoesAbertas === 1) partes.push('Há outra inscrição em atendimento com o mesmo e-mail ou WhatsApp.');
  if (d.outrasInscricoesAbertas > 1) {
    partes.push(`Há outras ${d.outrasInscricoesAbertas} inscrições em atendimento com o mesmo e-mail ou WhatsApp.`);
  }
  const anteriores = d.outrasInscricoesAnteriores ?? 0;
  if (anteriores === 1) partes.push('Há 1 inscrição anterior com o mesmo e-mail ou WhatsApp.');
  if (anteriores > 1) partes.push(`Há ${anteriores} inscrições anteriores com o mesmo e-mail ou WhatsApp.`);
  return partes.length ? partes.join(' ') : null;
}

/** Há algo para avisar como possível duplicidade. */
export const temDuplicidade = (d: DuplicidadeInscricao | null | undefined) => textoDaDuplicidade(d) !== null;

/**
 * Campos fixos que o treinador pode esconder da página (D4 de `docs/planos/inscricao-com-perguntas-proprias.md`), na
 * ordem da página. Nome, WhatsApp e a ciência do texto nunca se escondem e não estão aqui.
 */
export const CAMPOS_DA_INSCRICAO: readonly { valor: CampoDaInscricao; rotulo: string; uso: string }[] = [
  { valor: 'EMAIL', rotulo: 'E-mail', uso: 'Usado no convite de acesso ao app, se a pessoa virar aluno.' },
  { valor: 'SEXO', rotulo: 'Sexo', uso: 'Vai para o cadastro do aluno no aceite.' },
  { valor: 'OBJETIVO', rotulo: 'Objetivo', uso: 'Vai para o cadastro do aluno no aceite.' },
  { valor: 'INTERESSE', rotulo: 'O que procura', uso: 'Aparece no CRM.' },
  { valor: 'MODALIDADE', rotulo: 'Como prefere o acompanhamento', uso: 'Aparece no CRM.' },
  { valor: 'PREVISAO_INICIO', rotulo: 'Quando quer começar', uso: 'Aparece no CRM.' },
  { valor: 'ORIGEM', rotulo: 'Como conheceu a consultoria', uso: 'Aparece no CRM e nos indicadores por origem.' },
];

/** Todos os campos fixos (o que a página mostra sem nada escondido). */
export const TODOS_OS_CAMPOS: readonly CampoDaInscricao[] = CAMPOS_DA_INSCRICAO.map((c) => c.valor);

/** Liga ou desliga um campo na lista de escondidos, sempre na ordem da página e sem repetir. */
export function alternarCampoOculto(ocultos: readonly CampoDaInscricao[], campo: CampoDaInscricao, esconder: boolean): CampoDaInscricao[] {
  const conjunto = new Set(ocultos);
  if (esconder) conjunto.add(campo);
  else conjunto.delete(campo);
  return TODOS_OS_CAMPOS.filter((c) => conjunto.has(c));
}

/** Aviso fixo do editor das perguntas da inscrição (D7): não dá para impedir por regra, porque o texto é livre. */
export const AVISO_SAUDE_NA_INSCRICAO = 'Não peça informação de saúde aqui; ela fica para a anamnese, depois do aceite.';

/** Campos da página pública, como a pessoa digita. */
export interface DadosDaInscricao {
  nome: string;
  whatsapp: string;
  email: string;
  objetivo: string;
  sexo: string;
  /** Qualificação rápida (opcional; vazio = não informado). */
  interesse: Interesse | '';
  modalidade: ModalidadeDesejada | '';
  previsaoInicio: PrevisaoInicio | '';
  origem: OrigemInformada | '';
}

export const INSCRICAO_VAZIA: DadosDaInscricao = {
  nome: '', whatsapp: '', email: '', objetivo: '', sexo: '', interesse: '', modalidade: '', previsaoInicio: '', origem: '',
};

/** Máscara do WhatsApp enquanto digita: `(11) 98765-4321`. */
export const mascaraWhatsapp = (texto: string) => formatarTelefone(texto);

/**
 * Erros por campo antes de enviar (vazio = pode enviar). `exigeCiencia` quando a consultoria tem texto; `campos` são os
 * fixos visíveis (o escondido não é conferido nem enviado).
 */
export function errosDaInscricao(d: DadosDaInscricao, exigeCiencia: boolean, ciencia: boolean,
  campos: readonly CampoDaInscricao[] = TODOS_OS_CAMPOS): Record<string, string> {
  const mostra = (c: CampoDaInscricao) => campos.includes(c);
  const erros: Record<string, string> = {};
  const nome = d.nome.trim();
  if (!nome) erros.nome = 'Informe seu nome.';
  else if (nome.length > LIMITES_INSCRICAO.nome) erros.nome = `Use até ${LIMITES_INSCRICAO.nome} caracteres.`;
  if (!d.whatsapp.trim()) erros.whatsapp = 'Informe o WhatsApp com DDD.';
  else if (!telefoneValido(d.whatsapp)) erros.whatsapp = 'WhatsApp inválido. Informe o DDD e o número.';
  const email = d.email.trim();
  if (mostra('EMAIL') && email && (!emailValido(email) || email.length > LIMITES_INSCRICAO.email)) erros.email = 'E-mail inválido.';
  if (mostra('OBJETIVO') && d.objetivo.trim().length > LIMITES_INSCRICAO.objetivo) erros.objetivo = `Use até ${LIMITES_INSCRICAO.objetivo} caracteres.`;
  if (exigeCiencia && !ciencia) erros.cienciaPrivacidade = 'Marque que você leu o texto acima.';
  return erros;
}

/**
 * O que vai das perguntas do treinador: só as respostas das perguntas desta versão que estão visíveis (a escondida pela
 * condição não vai; a de uma pergunta que saiu numa versão nova, também não).
 */
export function respostasDaPagina(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao): RespostasAtualizacao {
  const ids = new Set(modelo.secoes.flatMap((s) => s.perguntas.map((p) => p.id)));
  return Object.fromEntries(Object.entries(respostasParaEnviar(modelo, respostas)).filter(([id]) => ids.has(id)));
}

/** As perguntas do treinador respondidas: a versão que a página mostrou e as respostas (só as visíveis vão). */
export interface RespostasDoEnvio {
  versaoId: string;
  respostas: RespostasAtualizacao;
}

/**
 * Corpo do envio: textos sem espaços nas pontas e vazio = nulo. O token só vai quando há. `textoVersao` é a do texto que
 * a página mostrou (a API recusa a ciência de um texto que mudou). Campo fixo escondido (`campos` são os visíveis) vai
 * nulo. `perguntas` nulo = a página não tinha perguntas.
 */
export function corpoDaInscricao(d: DadosDaInscricao, ciencia: boolean, token: string | null,
  textoVersao: string | null = null, origemLink: string | null = null,
  campos: readonly CampoDaInscricao[] = TODOS_OS_CAMPOS, perguntas: RespostasDoEnvio | null = null): InscricaoPublicaRequest {
  const opcional = (t: string) => (t.trim() ? t.trim() : null);
  const mostra = (c: CampoDaInscricao) => campos.includes(c);
  const corpo: InscricaoPublicaRequest = {
    nome: d.nome.trim(),
    whatsapp: d.whatsapp.trim(),
    email: mostra('EMAIL') ? opcional(d.email) : null,
    objetivo: mostra('OBJETIVO') ? opcional(d.objetivo) : null,
    ...(d.sexo && mostra('SEXO') ? { sexo: d.sexo } : {}),
    interesse: mostra('INTERESSE') ? d.interesse || null : null,
    modalidade: mostra('MODALIDADE') ? d.modalidade || null : null,
    previsaoInicio: mostra('PREVISAO_INICIO') ? d.previsaoInicio || null : null,
    origem: mostra('ORIGEM') ? d.origem || null : null,
    origemLink,
    cienciaPrivacidade: ciencia,
    textoVersao,
    questionarioVersaoId: perguntas?.versaoId ?? null,
    respostas: perguntas ? perguntas.respostas : null,
  };
  if (token) corpo.turnstileToken = token;
  return corpo;
}

/** Rótulo de "não mandar anamnese junto com o aceite". */
export const ROTULO_NAO_ENVIAR_ANAMNESE = 'Não enviar agora';

/** Opção do seletor da anamnese no aceite (compatível com `Escolha` e `EscolhaEmFolha`). `null` = não enviar agora. */
export interface OpcaoDeAnamneseDoAceite {
  valor: string | null;
  rotulo: string;
}

/** Anamnese que já vem marcada no aceite: a padrão publicada; sem padrão, `null` ("Não enviar agora"). */
export function anamneseInicialDoAceite(opcoes: readonly OpcaoQuestionario[]): string | null {
  return opcoes.find((o) => o.padrao)?.id ?? null;
}

/** Opções do seletor: "Não enviar agora" primeiro e depois cada anamnese publicada, a padrão com "(padrão)". */
export function opcoesDeAnamneseDoAceite(opcoes: readonly OpcaoQuestionario[]): OpcaoDeAnamneseDoAceite[] {
  return [
    { valor: null, rotulo: ROTULO_NAO_ENVIAR_ANAMNESE },
    ...opcoes.map((o) => ({ valor: o.id, rotulo: o.padrao ? `${o.nome} (padrão)` : o.nome })),
  ];
}

/**
 * Aluno apontado por um 409 do aceite: `ALUNO_JA_EXISTE` (e-mail de um aluno que já existe) ou `INSCRICAO_JA_ACEITA`
 * (aceite repetido). A API manda o id em `fieldErrors` (`alunoId`); `null` em qualquer outro erro.
 */
export function alunoDoConflito(erro: unknown): string | null {
  const codigo = codigoApi(erro);
  if (codigo !== 'ALUNO_JA_EXISTE' && codigo !== 'INSCRICAO_JA_ACEITA') return null;
  return errosPorCampo(erro).alunoId ?? null;
}

/**
 * Página da lista depois de uma mudança: a atual se ainda tem itens; vazia (a última inscrição dela saiu do filtro), a
 * última página que existe para o total, nunca abaixo de zero.
 */
export function paginaQueSobra(pagina: number, dados: { itens: readonly unknown[]; total: number } | undefined,
  tamanho: number): number {
  if (!dados || dados.itens.length > 0 || pagina === 0) return pagina;
  return Math.max(0, Math.ceil(dados.total / tamanho) - 1);
}

// ---- Respostas prontas (WhatsApp) ----

/** Variáveis aceitas nos modelos de mensagem, com o que cada uma vira. */
export const VARIAVEIS_DA_MENSAGEM: { chave: string; descricao: string }[] = [
  { chave: '{primeiro_nome}', descricao: 'primeiro nome da pessoa' },
  { chave: '{consultoria}', descricao: 'nome da consultoria' },
  { chave: '{plano}', descricao: 'plano da proposta' },
];

/**
 * Troca as variáveis do modelo. Variável sem valor fica no texto e entra em `faltando` (assim como qualquer `{...}`
 * desconhecido): a mensagem só pode ser copiada ou aberta no WhatsApp sem nada faltando.
 */
export function mensagemComVariaveis(texto: string, valores: { primeiroNome?: string | null; consultoria?: string | null; plano?: string | null }): { texto: string; faltando: string[] } {
  const mapa: Record<string, string | null | undefined> = {
    primeiro_nome: valores.primeiroNome?.trim(),
    consultoria: valores.consultoria?.trim(),
    plano: valores.plano?.trim(),
  };
  const trocado = texto.replace(/\{([^{}]*)\}/g, (inteiro, nome: string) => {
    const valor = mapa[nome.trim()];
    return valor ? valor : inteiro;
  });
  return { texto: trocado, faltando: variaveisQueFaltam(trocado) };
}

/** `{...}` que ainda estão no texto (sem repetir), na ordem em que aparecem. */
export function variaveisQueFaltam(texto: string): string[] {
  const vistas: string[] = [];
  for (const m of texto.matchAll(/\{[^{}]*\}/g)) if (!vistas.includes(m[0])) vistas.push(m[0]);
  return vistas;
}

/** Primeiro nome para a mensagem ("Ana Paula Souza" → "Ana"). */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * Link do WhatsApp com o texto preparado (`wa.me/55...?text=`). Só abre o aplicativo com o texto: quem envia é a pessoa,
 * e abrir não quer dizer que a mensagem foi enviada. Sem número válido ou sem texto, `null`.
 */
export function linkDoWhatsAppComTexto(whatsapp: string | null | undefined, texto: string | null | undefined): string | null {
  const base = linkDoWhatsApp(whatsapp);
  if (!base || !texto?.trim()) return null;
  return `${base}?text=${encodeURIComponent(texto)}`;
}

// ---- Histórico ----

const rotuloDeCodigo = (codigo: string | null): string => {
  if (!codigo) return SEM_DADO;
  if (codigo in SITUACOES) return SITUACOES[codigo as SituacaoInscricao].texto;
  if (codigo in PAGAMENTOS) return PAGAMENTOS[codigo as PagamentoInscricao].texto;
  if (codigo in ORIGENS) return ORIGENS[codigo as Origem];
  return codigo;
};

/** Uma linha do histórico, sem autor nem data (a tela põe). Nunca o texto de uma mensagem. */
export function textoDoEvento(e: Pick<EventoInscricao, 'tipo' | 'de' | 'para' | 'motivo' | 'detalhe'>): string {
  const comDetalhe = (base: string) => (e.detalhe ? `${base}: ${e.detalhe}` : base);
  switch (e.tipo) {
    case 'CRIADA': return 'Inscrição recebida';
    case 'ETAPA': return `Etapa: ${rotuloDeCodigo(e.de)} → ${rotuloDeCodigo(e.para)}`;
    case 'RESPONSAVEL': return `Responsável: ${e.detalhe ?? 'Sem responsável'}`;
    case 'PAGAMENTO': return `Pagamento: ${rotuloDeCodigo(e.de)} → ${rotuloDeCodigo(e.para)}`;
    case 'ENCERRADA': {
      const base = `Encerrada: ${rotuloDeCodigo(e.para)} · ${rotuloDoMotivo(e.motivo)}`;
      return e.detalhe ? `${base} (${e.detalhe})` : base;
    }
    case 'REABERTA': return comDetalhe('Reaberta');
    case 'ACEITA': return 'Aceita: virou aluno';
    case 'PROPOSTA': return comDetalhe('Proposta');
    case 'MENSAGEM_PREPARADA': {
      const acao = e.para === 'WHATSAPP_ABERTO' ? 'WhatsApp aberto' : 'copiada';
      return `Mensagem preparada: ${e.detalhe ?? 'texto livre'} (${acao})`;
    }
    case 'RETORNO_MARCADO': return comDetalhe('Retorno marcado');
    case 'RETORNO_ALTERADO': return comDetalhe('Retorno reagendado');
    case 'RETORNO_CONCLUIDO': return comDetalhe('Retorno concluído');
    case 'RELACIONADA': return 'Relacionada a outra inscrição';
    case 'RELACAO_DESFEITA': return 'Relação com outra inscrição desfeita';
    case 'ORIGEM': return `Origem: ${e.de ? rotuloDeCodigo(e.de) : 'Não informada'} → ${e.para ? rotuloDeCodigo(e.para) : 'Não informada'}`;
    default: return e.detalhe ?? 'Atualização';
  }
}

/** Item do histórico: evento ou nota, para a tela ordenar junto. */
export type ItemDoHistorico =
  | { tipo: 'evento'; id: string; quando: string; autor: string | null; texto: string }
  | { tipo: 'nota'; id: string; quando: string; autor: string | null; texto: string };

/** Eventos e notas juntos, do mais novo ao mais antigo (empate: nota depois do evento do mesmo instante). */
export function historicoDaInscricao(
  eventos: readonly EventoInscricao[],
  notas: readonly { id: string; texto: string; autorNome: string | null; criadaEm: string }[],
): ItemDoHistorico[] {
  const itens: ItemDoHistorico[] = [
    ...eventos.map((e) => ({ tipo: 'evento' as const, id: e.id, quando: e.criadoEm, autor: e.autorNome, texto: textoDoEvento(e) })),
    ...notas.map((n) => ({ tipo: 'nota' as const, id: n.id, quando: n.criadaEm, autor: n.autorNome, texto: n.texto })),
  ];
  return itens.sort((a, b) => (a.quando === b.quando ? (a.tipo === b.tipo ? 0 : a.tipo === 'nota' ? -1 : 1) : a.quando < b.quando ? 1 : -1));
}

// ---- Kanban ----

/** Destino de um cartão: outra etapa aberta (move direto), aceitar, encerrar ou reabrir (abrem a confirmação). */
export type DestinoDoCartao =
  | { tipo: 'etapa'; situacao: EtapaAberta; rotulo: string }
  | { tipo: 'aceitar'; rotulo: string }
  | { tipo: 'encerrar'; situacao: Encerramento; rotulo: string }
  | { tipo: 'reabrir'; rotulo: string };

/** Para onde o cartão pode ir: de aberta, as outras abertas, aceitar e os dois encerramentos; encerrada, reabrir. */
export function destinosDoCartao(situacao: SituacaoInscricao): DestinoDoCartao[] {
  if (estaAberta(situacao)) {
    return [
      ...ETAPAS_ABERTAS.filter((s) => s !== situacao).map((s) => ({ tipo: 'etapa' as const, situacao: s, rotulo: SITUACOES[s].texto })),
      { tipo: 'aceitar', rotulo: 'Aceitar (cadastrar aluno)' },
      { tipo: 'encerrar', situacao: 'RECUSADA', rotulo: 'Recusar' },
      { tipo: 'encerrar', situacao: 'DESISTIU', rotulo: 'Desistiu' },
    ];
  }
  if (estaEncerradaSemAluno(situacao)) return [{ tipo: 'reabrir', rotulo: 'Reabrir atendimento' }];
  return [];
}

/** Destino ao soltar o cartão numa coluna (`null` = nada a fazer: mesma coluna ou transição que não existe). */
export function destinoDaColuna(de: SituacaoInscricao, coluna: SituacaoInscricao): DestinoDoCartao | null {
  if (de === coluna) return null;
  return destinosDoCartao(de).find((d) => {
    if (d.tipo === 'etapa' || d.tipo === 'encerrar') return d.situacao === coluna;
    if (d.tipo === 'aceitar') return coluna === 'ACEITA';
    return d.tipo === 'reabrir' && estaAberta(coluna);
  }) ?? null;
}

/** Cabeçalho da coluna: o total da contagem e, se carregou menos, "Mostrando 20 de 34". */
export function textoDaColuna(carregados: number, total: number | null | undefined): string | null {
  if (total === null || total === undefined) return null;
  return carregados < total ? `Mostrando ${carregados} de ${total}` : null;
}

// ---- Estados vazios ----

export function estadoVazio(p: { filtro: FiltroInscricoes; meus: boolean; busca: string; temFiltros: boolean }): { titulo: string; texto: string } {
  if (p.busca.trim()) return { titulo: 'Nada encontrado para esta busca.', texto: 'Confira o nome, o e-mail ou os dígitos do WhatsApp.' };
  if (p.meus) return { titulo: 'Nenhuma inscrição atribuída a você nesta lista.', texto: 'Escolha "Toda a equipe" no filtro de responsável para ver as inscrições de todos.' };
  if (p.temFiltros) return { titulo: 'Nenhuma inscrição com estes filtros.', texto: 'Tire um filtro para ver mais.' };
  if (p.filtro === 'ABERTAS') return { titulo: 'Nenhuma inscrição nesta lista', texto: 'Divulgue o link de inscrição: quem se inscrever aparece aqui.' };
  return { titulo: 'Nenhuma inscrição nesta lista', texto: 'Tente outra situação.' };
}

// ---- Retornos ----

/** Selo do retorno pela data de Brasília: antes de hoje = atrasado (vermelho), hoje (âmbar), depois só a data. */
export function seloDoRetorno(data: string, hoje: string): { texto: string; tipo: TipoDeSelo } | null {
  if (data < hoje) return { texto: 'Atrasado', tipo: 'perigo' };
  if (data === hoje) return { texto: 'Hoje', tipo: 'atencao' };
  return null;
}

// ---- Proposta ----

/** Desconto da proposta sobre a referência, em % inteiro; nulo sem os dois valores ou sem desconto. */
export function descontoDaProposta(p: Pick<PropostaInscricao, 'valorReferenciaCentavos' | 'valorCentavos'>): number | null {
  const ref = p.valorReferenciaCentavos;
  const valor = p.valorCentavos;
  if (ref === null || valor === null || ref <= 0 || valor >= ref) return null;
  return Math.round(((ref - valor) / ref) * 100);
}

export const temProposta = (p: PropostaInscricao | null | undefined) =>
  !!p && (p.planoNome !== null || p.valorCentavos !== null || p.modalidade !== null || p.periodicidade !== null || !!p.condicoes);

/** Valor em reais digitado na proposta: vazio = nulo (sem valor), inválido = erro. Zero é aceito (cortesia). */
export function valorDaProposta(texto: string): { valor: number | null; erro: string | null } {
  const t = texto.trim();
  if (!t) return { valor: null, erro: null };
  if (/^(R\$\s*)?0+([,.]0{1,2})?$/i.test(t)) return { valor: 0, erro: null };
  const centavos = centavosDaTela(t);
  return centavos === null ? { valor: null, erro: 'Valor inválido. Use, por exemplo, 199,90.' } : { valor: centavos, erro: null };
}

// ---- Indicadores ----

/** Conversão de 0 a 1 em "37%"; nulo = "—". */
export function porcentagem(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SEM_DADO;
  return `${Math.round(valor * 100)}%`;
}

/** Dias com uma casa ("3,5 dias"); nulo = "—". */
export function dias(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SEM_DADO;
  const arredondado = Math.round(valor * 10) / 10;
  const texto = Number.isInteger(arredondado) ? String(arredondado) : arredondado.toFixed(1).replace('.', ',');
  return `${texto} ${arredondado === 1 ? 'dia' : 'dias'}`;
}

/** Períodos prontos dos indicadores, em datas de Brasília. */
export type PeriodoDosIndicadores = '30' | '90' | 'ano';
export const PERIODOS_DOS_INDICADORES: { valor: PeriodoDosIndicadores; rotulo: string }[] = [
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 90 dias' },
  { valor: 'ano', rotulo: 'Este ano' },
];

export function intervaloDoPeriodo(periodo: PeriodoDosIndicadores, hoje: string): { de: string; ate: string } {
  if (periodo === 'ano') return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
  const [a, m, d] = hoje.split('-').map(Number);
  const inicio = new Date(Date.UTC(a, m - 1, d - (Number(periodo) - 1)));
  return { de: inicio.toISOString().slice(0, 10), ate: hoje };
}

/** Linhas da tabela "Por motivo", do maior ao menor (nulo = "Não informado"). */
export function linhasPorMotivo(ind: Pick<IndicadoresInscricoes, 'porMotivo'>): { rotulo: string; quantidade: number }[] {
  return [...ind.porMotivo].sort((a, b) => b.quantidade - a.quantidade).map((l) => ({ rotulo: rotuloDoMotivo(l.motivo), quantidade: l.quantidade }));
}

export function linhasPorOrigem(ind: Pick<IndicadoresInscricoes, 'porOrigem'>): { rotulo: string; entradas: number; aceites: number }[] {
  return [...ind.porOrigem].sort((a, b) => b.entradas - a.entradas).map((l) => ({ rotulo: rotuloDaOrigem(l.origem), entradas: l.entradas, aceites: l.aceites }));
}
