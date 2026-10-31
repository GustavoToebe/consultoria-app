/**
 * Primeiros passos do Início do treinador (D8 e D9 do plano da atualização visual; protótipo `primeiro-uso.html`).
 * Regras puras, sem React e sem acesso ao aparelho: a tela lê o que guardou (`chavePrimeirosPassos`), carrega as
 * contagens e passa tudo para `montarPrimeirosPassos`; o resultado diz o que desenhar, em que ordem e com quais botões.
 *
 * De onde sai o "feito" de cada item (nada de rota ou campo novo):
 * - Marca e logo: `useSessao().marca.logoUrl` (a sessão é atualizada quando a marca é salva).
 * - Cadastrar o primeiro aluno e Dar acesso ao app: `GET /painel?meus=false` (`alunosAtivos`, `alunosSemAcesso`,
 *   `alunosInativos`). Sempre a consultoria inteira: no filtro "Meus" um membro novo veria zero alunos.
 * - Ligar o link de inscrição: `GET /inscricoes/configuracao` (`aberta`).
 * - Conferir a metodologia e os modelos: não há dado no servidor; só o botão "Já conferi", guardado no aparelho.
 */

/* ============================== itens ============================== */

export type IdDoItem = 'marca' | 'metodologia' | 'modelos' | 'aluno' | 'convite' | 'link';
export type IdConferivel = 'metodologia' | 'modelos';

/** Cinco estados por item. "Sem informação" = a consulta falhou: nunca vira "Feito" nem conta como resolvido. */
export type EstadoDoItem = 'feito' | 'conferido' | 'falta' | 'sem_informacao' | 'deixado_para_depois';

const CONFERIVEIS: readonly IdConferivel[] = ['metodologia', 'modelos'];

/* ============================== guardado no aparelho ============================== */

/** Chave por usuário; sobrevive a sair da conta (`SOBREVIVEM_AO_SAIR`), como o `passeioVisto`. */
export const chavePrimeirosPassos = (usuarioId: string) => `treinos:${usuarioId}:primeirosPassos`;

export interface EstadoGuardado {
  /** Itens marcados com "Já conferi". */
  conferidos: readonly IdConferivel[];
  /** "Agora não" no link de inscrição. Conta como resolvido enquanto o link não estiver ligado; pode ser desfeito. */
  linkDepois: boolean;
  /** "Dispensar" (com confirmação). Volta pela Ajuda (`mostrarDeNovo`). */
  dispensado: boolean;
  /** Linha "Concluídos" tirada do Início (o X). Também volta pela Ajuda. */
  fechado: boolean;
}

export const ESTADO_INICIAL: EstadoGuardado = { conferidos: [], linkDepois: false, dispensado: false, fechado: false };

/**
 * Leitura tolerante: o que não é JSON, ou não é objeto, vira o estado inicial; campo de tipo errado volta ao padrão do
 * campo; ids desconhecidos ou repetidos saem; booleano só vale `true` de verdade. Nunca lança.
 */
export function lerEstado(bruto: string | null | undefined): EstadoGuardado {
  if (!bruto) return ESTADO_INICIAL;
  let valor: unknown;
  try {
    valor = JSON.parse(bruto);
  } catch {
    return ESTADO_INICIAL;
  }
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return ESTADO_INICIAL;
  const o = valor as Record<string, unknown>;
  const lista = Array.isArray(o.conferidos) ? o.conferidos : [];
  return {
    conferidos: CONFERIVEIS.filter((id) => lista.includes(id)),
    linkDepois: o.linkDepois === true,
    dispensado: o.dispensado === true,
    fechado: o.fechado === true,
  };
}

export const serializarEstado = (estado: EstadoGuardado): string =>
  JSON.stringify({ conferidos: estado.conferidos, linkDepois: estado.linkDepois, dispensado: estado.dispensado, fechado: estado.fechado });

/** Leitura do aparelho: ainda lendo, falhou, ou o texto guardado (nulo = nunca gravado). */
export type LeituraDoEstado = 'lendo' | 'falhou' | { valor: string | null };

/**
 * `null` = ainda lendo: a tela não mostra nem o bloco nem o Próximo passo (sem piscar). Falha na leitura = estado
 * inicial: o bloco é só um guia, não prende ninguém, e dispensar vale na sessão mesmo sem conseguir gravar.
 */
export function estadoDaLeitura(leitura: LeituraDoEstado): EstadoGuardado | null {
  if (leitura === 'lendo') return null;
  if (leitura === 'falhou') return ESTADO_INICIAL;
  return lerEstado(leitura.valor);
}

/* Transformadores imutáveis: a tela troca o estado e grava `serializarEstado(novo)`. */
export const conferir = (e: EstadoGuardado, id: IdConferivel): EstadoGuardado =>
  e.conferidos.includes(id) ? e : { ...e, conferidos: CONFERIVEIS.filter((c) => c === id || e.conferidos.includes(c)) };
export const deixarLinkParaDepois = (e: EstadoGuardado): EstadoGuardado => ({ ...e, linkDepois: true });
export const desfazerLinkParaDepois = (e: EstadoGuardado): EstadoGuardado => ({ ...e, linkDepois: false });
/** Só depois de a pessoa confirmar (`CONFIRMACAO_DE_DISPENSAR`). */
export const dispensar = (e: EstadoGuardado): EstadoGuardado => ({ ...e, dispensado: true });
/** O X da linha "Concluídos". Não pede confirmação: dá para trazer de volta pela Ajuda. */
export const fecharConcluidos = (e: EstadoGuardado): EstadoGuardado => ({ ...e, fechado: true });
/** Ajuda: "Mostrar no Início de novo". Zera dispensado e fechado; os "Já conferi" e o "Agora não" ficam. */
export const mostrarDeNovo = (e: EstadoGuardado): EstadoGuardado => ({ ...e, dispensado: false, fechado: false });

/* ============================== textos ============================== */

export const TITULO_DO_BLOCO = 'Primeiros passos';
export const DESCRICAO_DO_BLOCO = 'O que falta para começar a atender pelo app. Cada item abre a tela certa.';

/** Texto do `PainelConfirmacao` do "Dispensar". A confirmação é obrigatória para dispensar; o X do "Concluídos" não pede. */
export const CONFIRMACAO_DE_DISPENSAR = {
  titulo: 'Dispensar os primeiros passos?',
  texto: 'Eles saem do Início e o Próximo passo volta. Continuam na Ajuda, em Primeiros passos, e dá para trazer de volta de lá.',
  confirmar: 'Dispensar',
  cancelar: 'Continuar com eles',
} as const;

/** Avisos curtos (toast/aria-live) depois da ação. */
export const AVISO_DISPENSADO = 'Primeiros passos dispensados. Eles continuam na Ajuda.';
export const AVISO_DE_VOLTA = 'Os primeiros passos voltaram ao Início.';

const MENSAGEM_SEM_INFORMACAO = 'Não foi possível conferir agora. Abra a tela para ver.';
const MENSAGEM_DEIXADO = 'Conta como resolvido. Quando quiser, ligue em Interessados.';

/* ============================== permissões ============================== */

export interface Permissoes {
  /** `useSessao().pode`. */
  pode: (codigo: string) => boolean;
  /** `perfilEquipe.acessoTotal`: a tela da Marca só abre para o administrador. */
  administrador: boolean;
}

interface Definicao {
  id: IdDoItem;
  titulo: string;
  texto: string;
  rotuloAbrir: string;
  destino: string;
  opcional: boolean;
  conferivel: boolean;
  /** Perfil restrito só vê o que pode fazer. */
  visivel: (p: Permissoes) => boolean;
}

// Contagens (aluno, convite) vêm do painel, então quem não vê o painel também não vê esses itens: ficariam para sempre
// em "Sem informação". O link de inscrição precisa de INSCRICAO_LER (dependência de INSCRICAO_ALTERAR), a configuração.
const DEFINICOES: readonly Definicao[] = [
  {
    id: 'marca', titulo: 'Marca e logo', opcional: false, conferivel: false, rotuloAbrir: 'Abrir Marca', destino: '/treinador/marca',
    texto: 'Envie a logo e escolha a cor. É o que os seus alunos veem quando entram no app.',
    visivel: (p) => p.administrador,
  },
  {
    id: 'metodologia', titulo: 'Conferir a metodologia', opcional: false, conferivel: true, rotuloAbrir: 'Abrir Metodologias',
    // O chip "Metodologias" é estado local da tela do Planejamento; o endereço só chega à tela de treinos.
    destino: '/treinador/planejamento?aba=treino',
    texto: 'A consultoria já vem com uma metodologia padrão (tipos de série, técnicas e combinações). Confira se ela é a sua.',
    visivel: (p) => p.pode('MODELO_ALTERAR'),
  },
  {
    id: 'modelos', titulo: 'Conferir os modelos de treino', opcional: false, conferivel: true, rotuloAbrir: 'Abrir Planejamento', destino: '/treinador/planejamento?aba=treino',
    texto: 'Já existem 3 semanas de treino e 2 dietas de exemplo no Planejamento. Ajuste uma delas ou crie a sua.',
    visivel: (p) => p.pode('MODELO_ALTERAR'),
  },
  {
    id: 'aluno', titulo: 'Cadastrar o primeiro aluno', opcional: false, conferivel: false, rotuloAbrir: 'Cadastrar aluno', destino: '/treinador/alunos/novo',
    texto: 'Só o nome é obrigatório. O treino e a dieta são montados na ficha dele, numa pasta por período.',
    visivel: (p) => p.pode('ALUNO_ALTERAR') && p.pode('PAINEL_VER'),
  },
  {
    id: 'convite', titulo: 'Dar acesso ao app ao aluno', opcional: false, conferivel: false, rotuloAbrir: 'Abrir Alunos', destino: '/treinador/alunos',
    texto: 'Gere o convite (o aluno cria a própria senha) ou defina você o e-mail e uma senha provisória.',
    visivel: (p) => p.pode('ALUNO_CONVITE') && p.pode('PAINEL_VER'),
  },
  {
    id: 'link', titulo: 'Ligar o link de inscrição', opcional: true, conferivel: false, rotuloAbrir: 'Abrir Interessados', destino: '/treinador/interessados',
    texto: 'Quem se inscreve pelo link aparece em Interessados, para você atender e aceitar como aluno. Se não for usar agora, dá para deixar para depois.',
    visivel: (p) => p.pode('INSCRICAO_ALTERAR'),
  },
];

/* ============================== entrada e resultado ============================== */

/**
 * Tudo que a tela sabe. `null` em qualquer contagem ou flag = a consulta falhou (ou não pôde ser feita): o item afetado
 * vira "Sem informação". Enquanto os dados AINDA carregam, a tela não monta o bloco (passa `null` ao
 * `oQueMostrarNoInicio`), senão ele piscaria em "Sem informação".
 */
export interface EntradaDosPrimeirosPassos extends Permissoes {
  /** `Boolean(useSessao().marca.logoUrl)`; `null` = marca ainda desconhecida. */
  temLogo: boolean | null;
  /** `GET /painel?meus=false`: sempre a consultoria inteira. */
  alunosAtivos: number | null;
  alunosSemAcesso: number | null;
  alunosInativos: number | null;
  /** `GET /inscricoes/configuracao` → `aberta`. */
  linkAberto: boolean | null;
  /** `null` = ainda lendo o aparelho: o resultado é `null` e a tela espera. */
  estado: EstadoGuardado | null;
}

export type TomDoSelo = 'sucesso' | 'neutro';
export type IconeDoSelo = 'check' | 'menos' | 'alerta' | 'cadeado' | 'circulo';
export interface SeloDoItem { rotulo: string; tom: TomDoSelo; icone: IconeDoSelo }

export type AcaoDoBotao = 'abrir' | 'conferido' | 'agora_nao' | 'desfazer';
export interface BotaoDoItem {
  acao: AcaoDoBotao;
  rotulo: string;
  /** Para leitor de tela quando o rótulo sozinho não diz de qual item é ("Abrir"). */
  rotuloAcessivel: string;
  /** Rota para `router.push` quando `acao` é `abrir`. */
  destino: string | null;
  /** Só o item que recebe o primário tem um botão `primario`: o único botão vermelho do Início. */
  primario: boolean;
  desabilitado: boolean;
}

export interface ItemDosPrimeirosPassos {
  id: IdDoItem;
  /** Posição na lista inteira dos itens visíveis (não muda quando um item sai da vista). */
  numero: number;
  titulo: string;
  /** Descrição completa (a Ajuda mostra sempre). */
  descricao: string;
  opcional: boolean;
  estado: EstadoDoItem;
  /** Feito, conferido ou deixado para depois. "Sem informação" nunca. */
  resolvido: boolean;
  selo: SeloDoItem;
  /** Motivo de o botão estar desligado ("Cadastre um aluno primeiro."); `null` se não depende de nada. */
  bloqueio: string | null;
  /** É o primeiro que falta: mostra a descrição e recebe o botão primário. */
  recebePrimario: boolean;
  /** O parágrafo do item no Início: a descrição se for o item aberto, o aviso se faltou informação ou foi deixado. */
  textoExibido: string | null;
  botoes: readonly BotaoDoItem[];
}

/**
 * `aberto`: lista na tela. `concluido`: todos resolvidos, linha "Concluídos". `dispensado`: pela confirmação.
 * `fechado`: nada no Início (X da linha, ou não há nenhum item para este perfil).
 */
export type SituacaoDoBloco = 'aberto' | 'concluido' | 'dispensado' | 'fechado';

export interface ProgressoDosPrimeirosPassos {
  resolvidos: number;
  total: number;
  /** "3 de 6". Conta feitos, conferidos e deixados para depois; "Sem informação" não conta. */
  texto: string;
  porcentagem: number;
  rotuloAcessivel: string;
}

export interface PrimeirosPassos {
  situacao: SituacaoDoBloco;
  /** Todos os itens que o perfil pode fazer, na ordem. */
  itens: readonly ItemDosPrimeirosPassos[];
  /** À vista no Início: só o que falta (inclui "Sem informação" e o que depende do aluno). */
  aVista: readonly ItemDosPrimeirosPassos[];
  /** Os resolvidos, recolhidos numa linha que abre a lista. */
  recolhidos: readonly ItemDosPrimeirosPassos[];
  /** "3 feitos e 1 deixado para depois"; `null` sem recolhidos. */
  resumoDosRecolhidos: string | null;
  progresso: ProgressoDosPrimeirosPassos;
  /** Quem recebe o botão primário; `null` se não há item para isso (ex.: só o convite, ainda bloqueado). */
  itemPrimario: IdDoItem | null;
  /** Texto da linha "Concluídos". */
  linhaConcluidos: { titulo: string; selo: string; resumo: string; rotuloFechar: string };
}

/* ============================== cálculo ============================== */

interface Apuracao { estado: EstadoDoItem; bloqueio: string | null }

function apurar(id: IdDoItem, e: EntradaDosPrimeirosPassos, guardado: EstadoGuardado): Apuracao {
  const ok = (estado: EstadoDoItem, bloqueio: string | null = null): Apuracao => ({ estado, bloqueio });
  switch (id) {
    case 'marca':
      return e.temLogo === null ? ok('sem_informacao') : ok(e.temLogo ? 'feito' : 'falta');
    case 'metodologia':
    case 'modelos':
      return ok(guardado.conferidos.includes(id) ? 'conferido' : 'falta');
    case 'aluno': {
      if (e.alunosAtivos === null) return ok('sem_informacao');
      if (e.alunosAtivos > 0) return ok('feito');
      // Sem ativos: um aluno inativo também já foi cadastrado, mas sem a contagem não dá para saber.
      if (e.alunosInativos === null) return ok('sem_informacao');
      return ok(e.alunosInativos > 0 ? 'feito' : 'falta');
    }
    case 'convite': {
      if (e.alunosAtivos === null || e.alunosSemAcesso === null) return ok('sem_informacao');
      // Convite gerado e ainda não aceito não aparece nas contagens: só conta aluno que já tem usuário (convite aceito ou e-mail e senha definidos).
      if (e.alunosAtivos - e.alunosSemAcesso > 0) return ok('feito');
      if (e.alunosAtivos > 0) return ok('falta');
      if (e.alunosInativos === null) return ok('sem_informacao');
      return ok('falta', e.alunosInativos > 0 ? 'Precisa de um aluno ativo.' : 'Cadastre um aluno primeiro.');
    }
    case 'link': {
      if (e.linkAberto === true) return ok('feito');
      // "Agora não" fica no aparelho e vence a consulta que falhou.
      if (guardado.linkDepois) return ok('deixado_para_depois');
      return e.linkAberto === null ? ok('sem_informacao') : ok('falta');
    }
  }
}

const estaResolvido = (estado: EstadoDoItem) => estado !== 'falta' && estado !== 'sem_informacao';

function selo(estado: EstadoDoItem, bloqueio: string | null): SeloDoItem {
  if (estado === 'deixado_para_depois') return { rotulo: 'Deixado para depois', tom: 'neutro', icone: 'menos' };
  if (estado === 'sem_informacao') return { rotulo: 'Sem informação', tom: 'neutro', icone: 'alerta' };
  if (estado === 'feito' || estado === 'conferido') return { rotulo: 'Feito', tom: 'sucesso', icone: 'check' };
  if (bloqueio) return { rotulo: 'Depois do aluno', tom: 'neutro', icone: 'cadeado' };
  return { rotulo: 'A fazer', tom: 'neutro', icone: 'circulo' };
}

function botoes(d: Definicao, estado: EstadoDoItem, bloqueio: string | null, recebePrimario: boolean): BotaoDoItem[] {
  const abrir = (extra: Partial<BotaoDoItem>): BotaoDoItem => ({
    acao: 'abrir', rotulo: d.rotuloAbrir, rotuloAcessivel: d.rotuloAbrir, destino: d.destino, primario: false, desabilitado: false, ...extra,
  });
  if (estado === 'deixado_para_depois') {
    return [{ acao: 'desfazer', rotulo: 'Desfazer', rotuloAcessivel: `Desfazer: ${d.titulo}`, destino: null, primario: false, desabilitado: false }];
  }
  if (estaResolvido(estado)) return [];
  if (bloqueio) return [abrir({ desabilitado: true })];
  if (!recebePrimario) return [abrir({ rotulo: 'Abrir', rotuloAcessivel: `${d.rotuloAbrir}: ${d.titulo}` })];
  const lista: BotaoDoItem[] = [abrir({ primario: true })];
  if (d.conferivel) lista.push({ acao: 'conferido', rotulo: 'Já conferi', rotuloAcessivel: `Já conferi: ${d.titulo}`, destino: null, primario: false, desabilitado: false });
  if (d.opcional) lista.push({ acao: 'agora_nao', rotulo: 'Agora não', rotuloAcessivel: `Agora não: ${d.titulo}`, destino: null, primario: false, desabilitado: false });
  return lista;
}

/** "3 feitos e 1 deixado para depois" (singular e plural certos). */
function resumo(itens: readonly ItemDosPrimeirosPassos[]): string | null {
  const deixados = itens.filter((i) => i.estado === 'deixado_para_depois').length;
  const feitos = itens.length - deixados;
  const partes = [feitos ? `${feitos} ${feitos === 1 ? 'feito' : 'feitos'}` : '', deixados ? `${deixados} ${deixados === 1 ? 'deixado' : 'deixados'} para depois` : ''];
  return partes.filter(Boolean).join(' e ') || null;
}

/**
 * Monta o bloco. `null` quando `estado` é `null` (ainda lendo o aparelho).
 *
 * Situação: dispensado vence tudo. Sem itens para este perfil, nada a mostrar (`fechado`). Todos resolvidos = `concluido`
 * (ou `fechado`, se o X foi tocado). Item que volta a faltar depois de concluído reabre o bloco (como no protótipo);
 * "Sem informação" depois de fechado NÃO reabre: uma falha de rede não traz a lista de volta.
 */
export function montarPrimeirosPassos(e: EntradaDosPrimeirosPassos): PrimeirosPassos | null {
  const guardado = e.estado;
  if (!guardado) return null;
  const visiveis = DEFINICOES.filter((d) => d.visivel(e));
  const apurados = visiveis.map((d) => ({ d, ...apurar(d.id, e, guardado) }));
  const livre = (a: Apuracao) => !estaResolvido(a.estado) && !a.bloqueio;
  const primario = apurados.find((a) => livre(a) && a.estado !== 'sem_informacao') ?? apurados.find(livre) ?? null;

  const itens: ItemDosPrimeirosPassos[] = apurados.map((a, k) => {
    const recebePrimario = a === primario;
    const resolvido = estaResolvido(a.estado);
    const textoExibido =
      a.estado === 'sem_informacao' ? MENSAGEM_SEM_INFORMACAO
      : recebePrimario ? a.d.texto
      : a.estado === 'deixado_para_depois' ? MENSAGEM_DEIXADO
      : null;
    return {
      id: a.d.id, numero: k + 1, titulo: a.d.titulo, descricao: a.d.texto, opcional: a.d.opcional, estado: a.estado, resolvido,
      selo: selo(a.estado, a.bloqueio), bloqueio: a.bloqueio, recebePrimario, textoExibido, botoes: botoes(a.d, a.estado, a.bloqueio, recebePrimario),
    };
  });

  const total = itens.length;
  const recolhidos = itens.filter((i) => i.resolvido);
  const resolvidos = recolhidos.length;
  const concluido = total > 0 && resolvidos === total;
  const temFaltaConhecida = itens.some((i) => i.estado === 'falta');

  let situacao: SituacaoDoBloco;
  if (guardado.dispensado || total === 0) situacao = guardado.dispensado ? 'dispensado' : 'fechado';
  else if (concluido) situacao = guardado.fechado ? 'fechado' : 'concluido';
  else situacao = guardado.fechado && !temFaltaConhecida ? 'fechado' : 'aberto';

  const texto = `${resolvidos} de ${total}`;
  return {
    situacao,
    itens,
    aVista: itens.filter((i) => !i.resolvido),
    recolhidos,
    resumoDosRecolhidos: resumo(recolhidos),
    progresso: {
      resolvidos, total, texto, porcentagem: total ? Math.round((resolvidos / total) * 100) : 0,
      rotuloAcessivel: `Primeiros passos: ${resolvidos} de ${total} feitos ou deixados para depois`,
    },
    itemPrimario: primario ? primario.d.id : null,
    linhaConcluidos: { titulo: TITULO_DO_BLOCO, selo: 'Concluídos', resumo: `${texto} · também na Ajuda`, rotuloFechar: 'Tirar os primeiros passos do Início' },
  };
}

/* ============================== lugar do Próximo passo ============================== */

export interface OQueMostrarNoInicio<P> {
  /** Ainda lendo o aparelho: a tela não mostra nem o bloco nem o Próximo passo. */
  aguardando: boolean;
  /** Qual versão do bloco desenhar, ou nenhuma. */
  bloco: 'aberto' | 'concluido' | null;
  /** O Próximo passo do `inicioTreinador.ts`, ou `null` se o bloco aberto ocupa o lugar dele. */
  proximoPasso: P | null;
  /** Dono do único botão primário (vermelho) do Início. O item é `itemPrimario` do bloco. */
  primario: 'primeiros-passos' | 'proximo-passo' | null;
  itemPrimario: IdDoItem | null;
}

/**
 * Decide o que o Início mostra no topo. Genérica no Próximo passo: recebe o de `inicioTreinador.ts` (ou `null`, se não
 * há) e o devolve intacto ou o retira. Enquanto o bloco está aberto e tem um item para receber o primário, ele toma o
 * lugar do Próximo passo (sem repetir o item nem o botão). Aberto sem esse item (ex.: só o convite, ainda bloqueado),
 * concluído, dispensado ou fechado: o Próximo passo continua ou volta.
 */
export function oQueMostrarNoInicio<P>(bloco: PrimeirosPassos | null, proximo: P | null): OQueMostrarNoInicio<P> {
  if (!bloco) return { aguardando: true, bloco: null, proximoPasso: null, primario: null, itemPrimario: null };
  const ocupa = bloco.situacao === 'aberto' && bloco.itemPrimario !== null;
  const proximoPasso = ocupa ? null : proximo;
  return {
    aguardando: false,
    bloco: bloco.situacao === 'aberto' ? 'aberto' : bloco.situacao === 'concluido' ? 'concluido' : null,
    proximoPasso,
    primario: ocupa ? 'primeiros-passos' : proximoPasso !== null ? 'proximo-passo' : null,
    itemPrimario: ocupa ? bloco.itemPrimario : null,
  };
}
