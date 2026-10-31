import type { Painel as PainelFinanceiro, PaginaInadimplentes } from '../api/financeiroTipos';
import type { ContagensInscricoes } from '../api/inscricoesTipos';
import type { ResumoDaAgenda } from '../api/agendaTipos';
import type { PainelTreinador, RecordesDaSemana } from '../api/tipos';
import { periodoDoCalendario } from './agendaCalendario';
import { caminhoListaAtualizacoes } from './atualizacao';
import { dataRelativa } from './datasRelativas';
import { centavosParaTela, dataCurta, SEM_DADO } from './formatos';
import { hojeEmBrasilia, periodoDoPainel } from './financeiro';
import { contadorDeRetornos } from './inicioTreinador';
import { rotuloDoMes } from './numeros';
import { textoDoRecorde } from './recordesPessoais';
import { ehRetornoDesligado } from './retornoDesligado';
import { BLOCOS_DO_PAINEL, type BlocoDoPainelId, ehBlocoDoPainel, PAINEL_DO_INICIO_PADRAO, type PainelDoInicioPreferido } from './painelBlocos';

export { BLOCOS_DO_PAINEL, ehBlocoDoPainel, PAINEL_DO_INICIO_PADRAO };
export type { BlocoDoPainelId, PainelDoInicioPreferido };

/**
 * Regras do painel novo do Início do treinador (passo 8 de `docs/planos/atualizacao-visual-app-full.md`, D7 e D9; protótipo
 * `docs/prototipos/painel.html`). Só regras puras, sem React: decide quais blocos aparecem (permissões, chaves do `/eu` e
 * preferência), quais consultas cada bloco precisa, e monta os cartões, a linha, os gráficos e as Folhas a partir do que a
 * tela já carregou. Só contagens nos blocos (nenhum nome de aluno); as Folhas listam alunos.
 *
 * Regras de ausência (valem em tudo aqui):
 *  - recurso desligado ou sem permissão: o bloco ou o cartão SOME;
 *  - bloco visível, mas a consulta falhou ou veio sem o número: o cartão fica "Não carregou" (`estado: 'naoCarregou'`);
 *  - `null` nunca vira zero; zero de verdade fica em cinza (`tom: 'neutro'`).
 */

// ---- Blocos ----

export const TITULOS_DOS_BLOCOS: Record<BlocoDoPainelId, string> = {
  atualizacoes: 'Atualizações',
  interessados: 'Interessados',
  treinos: 'Treinos',
  pastas: 'Pastas',
  agenda: 'Agenda',
  financeiro: 'Financeiro',
  recebido: 'Recebido e lançamentos',
  alunos: 'Alunos',
};

/** Frase pequena do "Editar" sob o nome de cada bloco. */
export const DESCRICOES_DOS_BLOCOS: Record<BlocoDoPainelId, string> = {
  atualizacoes: 'Para revisar, atrasadas e próximos 7 dias',
  interessados: 'Novos, retornos e em contato ou negociação',
  treinos: 'Concluídos e recordes dos últimos 7 dias, sem registro',
  pastas: 'A renovar em 7 dias e sem pasta com período',
  agenda: 'Compromissos desta semana (segunda a domingo)',
  financeiro: 'Vencidas, vencendo e recebido no mês',
  recebido: 'Gráfico de barras dos últimos 6 meses',
  alunos: 'Rosca: ativos com e sem acesso, inativos',
};

// ---- Textos fixos (protótipo) ----

export const FRASE_INICIO_SEM_ALUNOS = 'Os números da consultoria (atualizações, treinos, pastas e o resto) aparecem aqui quando houver alunos.';
export const MOTIVO_EDITAR_SEM_ALUNOS = 'O painel aparece quando houver alunos.';
export const FRASE_NENHUM_BLOCO = 'Nenhum bloco ligado. Use "Editar" para escolher o que aparece aqui.';
export const NOTA_SEM_RETORNO = 'Concluídos e recordes aparecem com o "Concluir treino" ligado.';
export const PERIODO_DOS_TREINOS = 'Últimos 7 dias';
export const SO_OS_MEUS = 'Só os meus alunos';
export const TEXTO_NAO_CARREGOU = 'Não carregou';

/**
 * Início sem alunos: nenhum aluno ativo nem inativo. Recebe o `/painel` de **Todos** (`meus=false`): com "Meus", um
 * membro sem alunos próprios veria a consultoria inteira como vazia. `/painel` que falhou, está carregando ou veio nulo NÃO
 * é "sem alunos" (devolve `false`).
 */
export function inicioSemAlunos(painelDeTodos: Pick<PainelTreinador, 'alunosAtivos' | 'alunosInativos'> | null | undefined): boolean {
  if (!painelDeTodos) return false;
  return painelDeTodos.alunosAtivos === 0 && painelDeTodos.alunosInativos === 0;
}

// ---- Contexto e disponibilidade ----

/** O que o painel precisa saber da sessão: `useSessao()` entrega os três. */
export interface ContextoDoPainel {
  pode: (codigo: string) => boolean;
  /** Chave do `/eu`: o financeiro está ligado na plataforma. */
  pagamentosHabilitados: boolean;
  /** Chave do `/eu`: "Concluir treino" ligado. */
  retornoHabilitado: boolean;
}

/**
 * O bloco existe para esta pessoa? Permissões de cada fonte hoje: `/painel` pede `PAINEL_VER` (o Início inteiro já pede);
 * Atualizações, `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER` (sem elas o `/painel` devolve 0, que não pode aparecer como número);
 * Interessados, `INSCRICAO_LER`; Treinos, `REGISTRO_LER` + `ALUNO_LER`; Pastas, `TREINO_LER` + `ALUNO_LER`; Agenda,
 * `AGENDA_LER`; Financeiro e Recebido, `pagamentosHabilitados` + `FINANCEIRO_LER`; Alunos (rosca), `ALUNO_LER`.
 */
export function blocoDisponivel(id: BlocoDoPainelId, ctx: ContextoDoPainel): boolean {
  const { pode } = ctx;
  switch (id) {
    case 'atualizacoes': return pode('PAINEL_VER') && pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
    case 'interessados': return pode('INSCRICAO_LER');
    case 'treinos': return pode('PAINEL_VER') && pode('REGISTRO_LER') && pode('ALUNO_LER');
    case 'pastas': return pode('PAINEL_VER') && pode('TREINO_LER') && pode('ALUNO_LER');
    case 'agenda': return pode('AGENDA_LER');
    case 'financeiro':
    case 'recebido': return ctx.pagamentosHabilitados && pode('FINANCEIRO_LER');
    case 'alunos': return pode('PAINEL_VER') && pode('ALUNO_LER');
  }
}

/** Blocos que a pessoa pode ver, na ordem da preferência (inclui os escondidos: é a lista do "Editar"). */
export function blocosPermitidos(ctx: ContextoDoPainel, pref: PainelDoInicioPreferido = PAINEL_DO_INICIO_PADRAO): BlocoDoPainelId[] {
  return pref.ordem.filter((id) => blocoDisponivel(id, ctx));
}

/** Blocos que aparecem no painel: permitidos e não escondidos, na ordem da preferência. */
export function blocosVisiveis(ctx: ContextoDoPainel, pref: PainelDoInicioPreferido = PAINEL_DO_INICIO_PADRAO): BlocoDoPainelId[] {
  return blocosPermitidos(ctx, pref).filter((id) => !pref.escondidos.includes(id));
}

export interface BlocoParaEditar {
  id: BlocoDoPainelId;
  titulo: string;
  descricao: string;
  ligado: boolean;
  /** Posição entre os permitidos (1 a N) e o total, para "posição 2 de 7" no leitor de tela. */
  posicao: number;
  total: number;
  podeSubir: boolean;
  podeDescer: boolean;
}

/** A lista do "Editar": todos os blocos permitidos, com o interruptor e os botões de subir e descer. */
export function blocosParaEditar(ctx: ContextoDoPainel, pref: PainelDoInicioPreferido): BlocoParaEditar[] {
  const ids = blocosPermitidos(ctx, pref);
  return ids.map((id, i) => ({
    id, titulo: TITULOS_DOS_BLOCOS[id], descricao: DESCRICOES_DOS_BLOCOS[id], ligado: !pref.escondidos.includes(id),
    posicao: i + 1, total: ids.length, podeSubir: i > 0, podeDescer: i < ids.length - 1,
  }));
}

/** Liga ou desliga um bloco. Id desconhecido não muda nada. */
export function alternarBloco(pref: PainelDoInicioPreferido, id: BlocoDoPainelId): PainelDoInicioPreferido {
  if (!ehBlocoDoPainel(id)) return pref;
  const escondidos = pref.escondidos.includes(id) ? pref.escondidos.filter((x) => x !== id) : [...pref.escondidos, id];
  return { ordem: [...pref.ordem], escondidos, meus: { ...pref.meus } };
}

/**
 * Sobe (`-1`) ou desce (`1`) um bloco entre os **permitidos** à pessoa: troca de lugar com o vizinho permitido, sem mexer
 * na posição dos blocos que ela não vê (eles guardam o lugar para outro perfil ou para quando a permissão voltar).
 */
export function moverBloco(pref: PainelDoInicioPreferido, id: BlocoDoPainelId, sentido: -1 | 1, permitidos: readonly BlocoDoPainelId[]): PainelDoInicioPreferido {
  const entre = pref.ordem.filter((x) => permitidos.includes(x));
  const i = entre.indexOf(id);
  const j = i + sentido;
  if (i < 0 || j < 0 || j >= entre.length) return pref;
  const vizinho = entre[j];
  const ordem = [...pref.ordem];
  const a = ordem.indexOf(id);
  const b = ordem.indexOf(vizinho);
  ordem[a] = vizinho;
  ordem[b] = id;
  return { ordem, escondidos: [...pref.escondidos], meus: { ...pref.meus } };
}

// ---- Fontes (o que a tela já carregou) ----

/** Estado de uma consulta, como a tela a entrega. */
export type Fonte<T> =
  | { situacao: 'carregando' }
  | { situacao: 'falhou' }
  /** O recurso está desligado na plataforma (503 `RETORNO_INDISPONIVEL`): não é erro, o cartão some. */
  | { situacao: 'desligada' }
  | { situacao: 'pronta'; dados: T };

export const FONTE_CARREGANDO: Fonte<never> = { situacao: 'carregando' };
export const FONTE_FALHOU: Fonte<never> = { situacao: 'falhou' };
export const FONTE_DESLIGADA: Fonte<never> = { situacao: 'desligada' };
export const fontePronta = <T>(dados: T): Fonte<T> => ({ situacao: 'pronta', dados });

/**
 * Converte o retorno do `useCarregar` (`dados`, `erro`, `carregando`) em `Fonte`. Erro: o 503 `RETORNO_INDISPONIVEL` é
 * `desligada`, o resto é `falhou`. Dados `null` (consulta que o chamador engoliu) também é `falhou`. Sem dados, sem erro e
 * ainda carregando: `carregando`. Consulta que a tela não fez (chave nula) é `falhou`: não pedir o que não aparece.
 */
export function fonteDaConsulta<T>(c: { dados?: T | null; erro?: unknown; carregando?: boolean }): Fonte<T> {
  if (c.erro !== undefined && c.erro !== null) return ehRetornoDesligado(c.erro) ? FONTE_DESLIGADA : FONTE_FALHOU;
  if (c.dados !== undefined && c.dados !== null) return fontePronta(c.dados);
  if (c.dados === undefined && c.carregando) return FONTE_CARREGANDO;
  return FONTE_FALHOU;
}

export interface FontesDoPainel {
  /** `GET /painel?meus=&dias=` do escopo do bloco. */
  painel?: Fonte<PainelTreinador>;
  /** `GET /inscricoes/contagens` do escopo do bloco. */
  interessados?: Fonte<ContagensInscricoes>;
  /** `GET /recordes/semana?meus=`. */
  recordes?: Fonte<RecordesDaSemana>;
  /** `GET /agenda/resumo` da semana (ver {@link consultaDaAgenda}). */
  agenda?: Fonte<ResumoDaAgenda>;
  /** `GET /financeiro/inadimplentes?meus=` (página 0: só `total` e `valorTotalCentavos` importam). */
  inadimplentes?: Fonte<PaginaInadimplentes>;
  /** `GET /financeiro/painel` do período {@link periodoDoFinanceiroNoPainel} e do escopo do bloco. */
  financeiro?: Fonte<PainelFinanceiro>;
}

// ---- Consultas ----

export type ConsultaDoPainel =
  | { fonte: 'painel'; meus: boolean; dias: number }
  | { fonte: 'interessados'; meus: boolean }
  | { fonte: 'recordes'; meus: boolean }
  | { fonte: 'agenda'; de: string; ate: string; responsavel: string | null }
  | { fonte: 'inadimplentes'; meus: boolean }
  | { fonte: 'financeiro'; meus: boolean; de: string; ate: string };

/** Chave estável da consulta: dois blocos com a mesma chave compartilham a resposta (uma chamada só). */
export function chaveDaConsulta(c: ConsultaDoPainel): string {
  switch (c.fonte) {
    case 'painel': return `painel:${c.meus ? 'meus' : 'todos'}:${c.dias}`;
    case 'interessados': return `interessados:${c.meus ? 'meus' : 'todos'}`;
    case 'recordes': return `recordes:${c.meus ? 'meus' : 'todos'}`;
    case 'agenda': return `agenda:${c.de}:${c.ate}:${c.responsavel ?? 'todos'}`;
    case 'inadimplentes': return `inadimplentes:${c.meus ? 'meus' : 'todos'}`;
    case 'financeiro': return `financeiro:${c.meus ? 'meus' : 'todos'}:${c.de}:${c.ate}`;
  }
}

/** Período das barras e do "Recebido no mês": os 6 meses que terminam no mês corrente (o mesmo padrão da API). */
export function periodoDoFinanceiroNoPainel(hoje: string): { de: string; ate: string } {
  return periodoDoPainel('6m', hoje);
}

/**
 * Agenda "Esta semana": segunda a domingo de `hoje` (Brasília), o mesmo período da visão Semana. "Meus" vira
 * `responsavel=<id do usuário>` (como a Agenda faz em `useCalendario`: `membro ?? (meus ? usuarioId : null)`); "Todos" vai
 * sem `responsavel`. Sem `situacao` a API já tira os cancelados e sem `agendas` não filtra nada (só os eventos usam). Em
 * "Meus" sem o id do usuário não há consulta correta (`null`): o cartão fica "Não carregou" em vez de contar a equipe toda.
 */
export function consultaDaAgenda(o: { hoje: string; meus: boolean; usuarioId: string | null }): Extract<ConsultaDoPainel, { fonte: 'agenda' }> | null {
  if (o.meus && !o.usuarioId) return null;
  const { de, ate } = periodoDoCalendario('semana', o.hoje);
  return { fonte: 'agenda', de, ate, responsavel: o.meus ? o.usuarioId : null };
}

export interface OpcoesDoBloco {
  meus: boolean;
  /** Preferência `diasSemRegistro`. */
  dias: number;
  /** Preferência `graficos`: desligado, os gráficos vêm sem desenho (`desenhar: false`) e fica a lista. */
  graficos: boolean;
  /** Hoje de Brasília (`hojeEmBrasilia()`), AAAA-MM-DD. */
  hoje: string;
  /** Id do usuário da sessão (para o "Meus" da Agenda). */
  usuarioId: string | null;
}

/** As consultas que o bloco precisa agora (vazio se o bloco não existe para a pessoa). */
export function consultasDoBloco(id: BlocoDoPainelId, ctx: ContextoDoPainel, o: OpcoesDoBloco): ConsultaDoPainel[] {
  if (!blocoDisponivel(id, ctx)) return [];
  const { meus } = o;
  switch (id) {
    case 'atualizacoes':
    case 'pastas':
    case 'alunos': return [{ fonte: 'painel', meus, dias: o.dias }];
    case 'interessados': return [{ fonte: 'interessados', meus }];
    case 'treinos': {
      const lista: ConsultaDoPainel[] = [{ fonte: 'painel', meus, dias: o.dias }];
      if (ctx.retornoHabilitado) lista.push({ fonte: 'recordes', meus });
      return lista;
    }
    case 'agenda': {
      const c = consultaDaAgenda(o);
      return c ? [c] : [];
    }
    case 'financeiro': {
      const lista: ConsultaDoPainel[] = [{ fonte: 'financeiro', meus, ...periodoDoFinanceiroNoPainel(o.hoje) }];
      // `/financeiro/inadimplentes` pede também `ALUNO_LER`; sem ela o cartão Vencidas nem existe.
      if (ctx.pode('ALUNO_LER')) lista.push({ fonte: 'inadimplentes', meus });
      return lista;
    }
    case 'recebido': return [{ fonte: 'financeiro', meus, ...periodoDoFinanceiroNoPainel(o.hoje) }];
  }
}

// ---- Cartões ----

/** Nome do token de cor de status (`Cores`): vermelho problema, âmbar atenção, verde positivo, cinza neutro/zero. */
export type TomDoCartao = 'perigo' | 'atencao' | 'sucesso' | 'neutro';

export type DestinoDoCartao =
  | { tipo: 'endereco'; href: string }
  /** Abre uma `Folha` (use {@link folhaSemRegistro}, {@link folhaPastasARenovar} ou {@link folhaRecordes}). */
  | { tipo: 'folha'; folha: FolhaDoPainelId };

export type FolhaDoPainelId = 'semRegistro' | 'pastasARenovar' | 'recordes';

export interface CartaoDoPainel {
  chave: string;
  /** Rótulo curto do cartão ("Para revisar"). */
  rotulo: string;
  /** `valor`: número disponível; `naoCarregou`: consulta falhou ou veio sem o número; `semDado`: a API respondeu sem valor (mostra "—"); `carregando`. */
  estado: 'valor' | 'naoCarregou' | 'semDado' | 'carregando';
  /** Contagem, ou centavos quando `moeda`. `null` fora de `estado: 'valor'`. */
  valor: number | null;
  /** O que a tela escreve: "12", "R$ 1.240" (sem centavos), "Não carregou", "—" ou "…". */
  texto: string;
  moeda: boolean;
  /** Linha pequena sob o número ("4 cobranças", "1 atrasado · 1 para hoje"). */
  detalhe: string | null;
  tom: TomDoCartao;
  /** Rótulo do leitor de tela (valor completo em R$ com centavos). */
  falado: string;
  /** `null` quando não dá para abrir (Folha sem dados). */
  destino: DestinoDoCartao | null;
  /** Ocupa a linha inteira da grade de cartões. */
  largo: boolean;
}

/** R$ sem centavos, arredondado (R$ 1.240,60 → "R$ 1.241"); o valor completo vai no `falado`. Sem `Intl` (Hermes). */
export function reaisSemCentavos(centavos: number): string {
  const reais = Math.round(Math.abs(centavos) / 100);
  return `${centavos < 0 && reais > 0 ? '-' : ''}R$ ${String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const milhares = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

interface EntradaDeCartao {
  chave: string;
  rotulo: string;
  /** Nome completo, para o leitor de tela ("Atualizações para revisar"). */
  nome: string;
  situacao: Fonte<unknown>['situacao'];
  valor: number | null | undefined;
  tom: TomDoCartao;
  destino: DestinoDoCartao | null;
  moeda?: boolean;
  largo?: boolean;
  detalhe?: string | null;
  detalheFalado?: string | null;
  /** O cartão abre Folha: o leitor de tela avisa. */
  abreLista?: boolean;
}

function cartao(e: EntradaDeCartao): CartaoDoPainel {
  const base = { chave: e.chave, rotulo: e.rotulo, moeda: !!e.moeda, largo: !!e.largo };
  if (e.situacao === 'carregando') {
    return { ...base, estado: 'carregando', valor: null, texto: '…', detalhe: null, tom: 'neutro', falado: `${e.nome}: carregando`, destino: e.destino };
  }
  if (e.situacao !== 'pronta' || !ehNumero(e.valor)) {
    // Folha sem dados não abre; a lista de endereço continua valendo.
    const destino = e.destino?.tipo === 'folha' ? null : e.destino;
    return { ...base, estado: 'naoCarregou', valor: null, texto: TEXTO_NAO_CARREGOU, detalhe: null, tom: 'neutro', falado: `${e.nome}: não carregou`, destino };
  }
  const texto = e.moeda ? reaisSemCentavos(e.valor) : milhares(Math.round(e.valor));
  const falado = e.moeda ? centavosParaTela(e.valor) : milhares(Math.round(e.valor));
  const aviso = e.abreLista && e.destino ? '. Abre a lista' : '';
  return {
    ...base, estado: 'valor', valor: e.valor, texto, detalhe: e.detalhe ?? null,
    tom: e.valor > 0 ? e.tom : 'neutro',
    falado: `${e.nome}: ${falado}${e.detalheFalado ? `, ${e.detalheFalado}` : ''}${aviso}`,
    destino: e.destino,
  };
}

/** Cartão cuja API respondeu sem valor (soma vazia): "—", nunca zero. */
function cartaoSemDado(e: Omit<EntradaDeCartao, 'situacao' | 'valor'>): CartaoDoPainel {
  return {
    chave: e.chave, rotulo: e.rotulo, moeda: !!e.moeda, largo: !!e.largo, estado: 'semDado', valor: null, texto: SEM_DADO,
    detalhe: null, tom: 'neutro', falado: `${e.nome}: sem dado`, destino: e.destino,
  };
}

// ---- Endereços ----

function comConsulta(base: string, ...params: (string | false | null | undefined)[]): string {
  const q = params.filter((p): p is string => !!p).join('&');
  return q ? `${base}${base.includes('?') ? '&' : '?'}${q}` : base;
}

const meusQ = (meus: boolean) => meus && 'meus=true';

/** Destino do ícone "abrir a tela" da faixa de cada bloco. */
export function enderecoDoBloco(id: BlocoDoPainelId, meus: boolean): string {
  switch (id) {
    case 'atualizacoes': return comConsulta('/treinador/atualizacoes', meusQ(meus));
    case 'interessados': return comConsulta('/treinador/interessados', meusQ(meus));
    case 'treinos':
    case 'pastas':
    case 'alunos': return comConsulta('/treinador/alunos', meusQ(meus));
    case 'agenda': return comConsulta('/treinador/agenda', 'visao=semana', meusQ(meus));
    case 'financeiro': return comConsulta('/treinador/financeiro', meusQ(meus));
    // As barras vêm do mesmo `/financeiro/painel` da Visão geral, que respeita `?meus=`; a aba Lançamentos não filtra por aluno.
    case 'recebido': return comConsulta('/treinador/financeiro', 'aba=visao', meusQ(meus));
  }
}

// ---- Gráficos ----

export interface FatiaDaRosca {
  chave: 'comAcesso' | 'semAcesso' | 'inativos';
  rotulo: string;
  valor: number;
  cor: TomDoCartao;
  /** Fração do total (0 a 1) e onde começa (0 a 1, a partir do topo, sentido horário). */
  fracao: number;
  inicio: number;
}

export interface RoscaDoPainel {
  tipo: 'rosca';
  titulo: string;
  /** Ativos + inativos. */
  total: number;
  fatias: FatiaDaRosca[];
  /** Preferência `graficos` desligada: só a lista (legenda/tabela), sem desenhar o anel. */
  desenhar: boolean;
  /** Sem nenhum aluno: não há o que desenhar. */
  vazia: boolean;
  resumo: string;
  /** Texto alternativo do desenho, para o leitor de tela. */
  descricao: string;
}

export type SerieDaBarra = 'recebido' | 'lancamentos';

export interface MesDasBarras {
  mes: string;
  rotulo: string;
  parcial: boolean;
  recebido: number | null;
  entradasAvulsas: number | null;
  saidasAvulsas: number | null;
  /** O valor que vira a segunda barra (ver {@link LANCAMENTOS_NAS_BARRAS}). */
  lancamentos: number | null;
  recebidoTexto: string;
  lancamentosTexto: string;
  entradasTexto: string;
  saidasTexto: string;
}

/**
 * Qual lançamento avulso é a segunda barra. O `MesDoPainel` traz entradas e saídas avulsas, não um "lançamentos": o protótipo
 * não diz qual. Provisório: `entradas` (PERGUNTA ao Gustavo); os dois valores seguem em cada mês para trocar sem mudar a API.
 */
export const LANCAMENTOS_NAS_BARRAS: 'entradas' | 'saidas' = 'entradas';

export interface BarrasDoPainel {
  tipo: 'barras';
  titulo: string;
  desenhar: boolean;
  series: { chave: SerieDaBarra; rotulo: string; cor: 'texto' | 'neutro' }[];
  meses: MesDasBarras[];
  /** Maior valor das barras (centavos), 0 sem nenhum dado. */
  maximo: number;
  semDados: boolean;
  /** Legendas de rodapé ("* mês em andamento", "Com Meus..."). */
  notas: string[];
  descricao: string;
}

// ---- Bloco ----

export interface BlocoDoPainel {
  id: BlocoDoPainelId;
  titulo: string;
  /** "Últimos 7 dias" (Treinos com o retorno ligado). */
  periodo: string | null;
  /** "Só os meus alunos" quando o bloco está em Meus. */
  escopo: string | null;
  meus: boolean;
  /** Mostra o ícone Todos/Meus (todos os blocos, D9). */
  temFiltro: boolean;
  /** Rótulo do leitor de tela do ícone Todos/Meus. */
  rotuloDoFiltro: string;
  /** Endereço do ícone "abrir a tela". */
  abrir: string;
  cartoes: CartaoDoPainel[];
  /** A linha neutra de baixo ("Nos próximos 7 dias" das Atualizações). */
  linha: CartaoDoPainel | null;
  grafico: RoscaDoPainel | BarrasDoPainel | null;
  /** Frase pequena sob os cartões. */
  nota: string | null;
  /** Alguma consulta do bloco ainda carrega. */
  carregando: boolean;
  /** Nada do bloco carregou (todos os cartões "Não carregou", ou o gráfico sem dados): a tela pode mostrar o alerta com "Atualizar". */
  falhou: boolean;
}

function cabecalho(id: BlocoDoPainelId, meus: boolean, extra: { periodo?: string | null } = {}): Omit<BlocoDoPainel, 'cartoes' | 'linha' | 'grafico' | 'nota' | 'carregando' | 'falhou'> {
  const titulo = TITULOS_DOS_BLOCOS[id];
  return {
    id, titulo, periodo: extra.periodo ?? null, escopo: meus ? SO_OS_MEUS : null, meus, temFiltro: true,
    rotuloDoFiltro: `${titulo}: ${meus ? 'mostrando só os meus alunos' : 'mostrando todos os alunos'}. ${meus ? 'Mostrar todos' : 'Mostrar só os meus'}`,
    abrir: enderecoDoBloco(id, meus),
  };
}

function fechar(base: ReturnType<typeof cabecalho>, partes: { cartoes?: CartaoDoPainel[]; linha?: CartaoDoPainel | null; grafico?: BlocoDoPainel['grafico']; nota?: string | null; falhouGrafico?: boolean }): BlocoDoPainel {
  const cartoes = partes.cartoes ?? [];
  const todos = [...cartoes, ...(partes.linha ? [partes.linha] : [])];
  return {
    ...base, cartoes, linha: partes.linha ?? null, grafico: partes.grafico ?? null, nota: partes.nota ?? null,
    carregando: todos.some((c) => c.estado === 'carregando'),
    falhou: todos.length > 0 ? todos.every((c) => c.estado === 'naoCarregou') : !!partes.falhouGrafico,
  };
}

const situacaoDe = (f: Fonte<unknown> | undefined): Fonte<unknown>['situacao'] => f?.situacao ?? 'carregando';
const dadosDe = <T>(f: Fonte<T> | undefined): T | null => (f && f.situacao === 'pronta' ? f.dados : null);

/**
 * Monta um bloco. Devolve `null` quando ele não existe para a pessoa (permissão ou chave do `/eu`). `fontes` traz só as
 * consultas do bloco (veja {@link consultasDoBloco}); fonte ausente conta como `carregando`.
 */
export function montarBloco(id: BlocoDoPainelId, ctx: ContextoDoPainel, o: OpcoesDoBloco & { fontes: FontesDoPainel }): BlocoDoPainel | null {
  if (!blocoDisponivel(id, ctx)) return null;
  switch (id) {
    case 'atualizacoes': return blocoAtualizacoes(o);
    case 'interessados': return blocoInteressados(o);
    case 'treinos': return blocoTreinos(ctx, o);
    case 'pastas': return blocoPastas(o);
    case 'agenda': return blocoAgenda(o);
    case 'financeiro': return blocoFinanceiro(ctx, o);
    case 'recebido': return blocoRecebido(o);
    case 'alunos': return blocoAlunos(o);
  }
}

type Entrada = OpcoesDoBloco & { fontes: FontesDoPainel };

function blocoAtualizacoes(o: Entrada): BlocoDoPainel {
  const sit = situacaoDe(o.fontes.painel);
  const p = dadosDe(o.fontes.painel);
  const base = { situacao: sit, tom: 'neutro' as TomDoCartao };
  const ir = (situacao: 'PARA_REVISAR' | 'ATRASADAS' | 'PROXIMAS'): DestinoDoCartao => ({ tipo: 'endereco', href: caminhoListaAtualizacoes(situacao, o.meus) });
  return fechar(cabecalho('atualizacoes', o.meus), {
    cartoes: [
      cartao({ ...base, chave: 'atualizacoes.paraRevisar', rotulo: 'Para revisar', nome: 'Atualizações para revisar', valor: p?.atualizacoesParaRevisar, tom: 'atencao', destino: ir('PARA_REVISAR') }),
      cartao({ ...base, chave: 'atualizacoes.atrasadas', rotulo: 'Atrasadas', nome: 'Atualizações atrasadas', valor: p?.atualizacoesAtrasadas, tom: 'perigo', destino: ir('ATRASADAS') }),
    ],
    linha: cartao({ ...base, chave: 'atualizacoes.proximas', rotulo: 'Nos próximos 7 dias', nome: 'Atualizações nos próximos 7 dias', valor: p?.atualizacoesProximas, destino: ir('PROXIMAS') }),
  });
}

function blocoInteressados(o: Entrada): BlocoDoPainel {
  const sit = situacaoDe(o.fontes.interessados);
  const c = dadosDe(o.fontes.interessados);
  const fim = meusQ(o.meus);
  const href = (...p: string[]): DestinoDoCartao => ({ tipo: 'endereco', href: comConsulta('/treinador/interessados', ...p, fim) });
  const novos = c?.porSituacao?.NOVA;
  const contato = ehNumero(c?.porSituacao?.EM_CONTATO) && ehNumero(c?.porSituacao?.EM_NEGOCIACAO) ? c.porSituacao.EM_CONTATO + c.porSituacao.EM_NEGOCIACAO : null;
  const retornosOk = ehNumero(c?.retornosAtrasados) && ehNumero(c?.retornosHoje);
  const r = retornosOk ? contadorDeRetornos(c.retornosAtrasados, c.retornosHoje) : null;
  const falado = r ? [c!.retornosAtrasados > 0 ? plural(c!.retornosAtrasados, 'atrasado', 'atrasados') : '', c!.retornosHoje > 0 ? `${c!.retornosHoje} de hoje` : ''].filter(Boolean).join(' e ') : '';
  return fechar(cabecalho('interessados', o.meus), {
    cartoes: [
      cartao({ chave: 'interessados.novos', rotulo: 'Novos', nome: 'Interessados novos', situacao: sit, valor: novos, tom: 'atencao', destino: href('situacao=NOVA') }),
      cartao({
        chave: 'interessados.retornos', rotulo: 'Retornos', nome: 'Retornos a interessados atrasados ou de hoje', situacao: sit, valor: r?.numero,
        tom: r?.tom === 'perigo' ? 'perigo' : 'atencao', destino: href('retornos=ATE_HOJE'), detalhe: r?.detalhe ?? null, detalheFalado: falado || null,
      }),
      cartao({
        chave: 'interessados.contato', rotulo: 'Em contato ou negociação', nome: 'Interessados em contato ou negociação', situacao: sit, valor: contato,
        tom: 'neutro', destino: href('visao=kanban', 'etapas=EM_CONTATO,EM_NEGOCIACAO'), largo: true,
      }),
    ],
  });
}

function blocoTreinos(ctx: ContextoDoPainel, o: Entrada): BlocoDoPainel {
  const sitPainel = situacaoDe(o.fontes.painel);
  const p = dadosDe(o.fontes.painel);
  const { dias } = o;
  // Retorno desligado: pela chave do `/eu` ou porque `/recordes/semana` respondeu 503 (a chave ainda não tinha caído).
  const retorno = ctx.retornoHabilitado && o.fontes.recordes?.situacao !== 'desligada';
  const sitRecordes = situacaoDe(o.fontes.recordes);
  const semRegistro = cartao({
    chave: 'treinos.semRegistro', rotulo: `Sem registro há ${dias} dias`, nome: `Alunos sem registro há ${dias} dias`, situacao: sitPainel,
    valor: p?.alunosSemRegistroTotal, tom: 'atencao', destino: { tipo: 'folha', folha: 'semRegistro' }, largo: retorno, abreLista: true,
  });
  if (!retorno) return fechar(cabecalho('treinos', o.meus), { cartoes: [semRegistro], nota: NOTA_SEM_RETORNO });
  const alunos: DestinoDoCartao = { tipo: 'endereco', href: comConsulta('/treinador/alunos', meusQ(o.meus)) };
  const recordes = dadosDe(o.fontes.recordes);
  return fechar(cabecalho('treinos', o.meus, { periodo: PERIODO_DOS_TREINOS }), {
    cartoes: [
      cartao({ chave: 'treinos.concluidos', rotulo: 'Concluídos', nome: 'Sessões concluídas nos últimos 7 dias, completas e parciais', situacao: sitPainel, valor: p?.sessoesConcluidas7Dias, tom: 'sucesso', destino: alunos }),
      cartao({ chave: 'treinos.recordes', rotulo: 'Recordes', nome: 'Recordes nos últimos 7 dias', situacao: sitRecordes, valor: recordes?.total, tom: 'sucesso', destino: { tipo: 'folha', folha: 'recordes' }, abreLista: true }),
      semRegistro,
    ],
  });
}

function blocoPastas(o: Entrada): BlocoDoPainel {
  const sit = situacaoDe(o.fontes.painel);
  const p = dadosDe(o.fontes.painel);
  return fechar(cabecalho('pastas', o.meus), {
    cartoes: [
      cartao({ chave: 'pastas.aRenovar', rotulo: 'A renovar em 7 dias', nome: 'Pastas a renovar em 7 dias', situacao: sit, valor: p?.pastasARenovar, tom: 'atencao', destino: { tipo: 'folha', folha: 'pastasARenovar' }, abreLista: true }),
      cartao({ chave: 'pastas.semPasta', rotulo: 'Sem pasta com período', nome: 'Alunos sem pasta com período', situacao: sit, valor: p?.alunosSemPastaComPeriodo, tom: 'neutro', destino: { tipo: 'endereco', href: comConsulta('/treinador/alunos', meusQ(o.meus)) } }),
    ],
  });
}

/** Soma `compromissos` de todos os dias do resumo. Dia sem nada não vem na resposta: ausência de dia é zero de verdade. */
export function compromissosDaSemana(resumo: Pick<ResumoDaAgenda, 'dias'>): number {
  return resumo.dias.reduce((soma, d) => soma + (ehNumero(d.compromissos) ? d.compromissos : 0), 0);
}

function blocoAgenda(o: Entrada): BlocoDoPainel {
  // Meus sem o id do usuário: não há consulta correta, então o cartão não carregou.
  const semConsulta = o.meus && !o.usuarioId;
  const sit = semConsulta ? 'falhou' : situacaoDe(o.fontes.agenda);
  const r = dadosDe(o.fontes.agenda);
  return fechar(cabecalho('agenda', o.meus), {
    cartoes: [
      cartao({
        chave: 'agenda.semana', rotulo: 'Esta semana', nome: 'Compromissos nesta semana, de segunda a domingo', situacao: sit,
        valor: r && Array.isArray(r.dias) ? compromissosDaSemana(r) : null, tom: 'neutro', largo: true,
        destino: { tipo: 'endereco', href: enderecoDoBloco('agenda', o.meus) },
      }),
    ],
  });
}

function blocoFinanceiro(ctx: ContextoDoPainel, o: Entrada): BlocoDoPainel {
  const fim = meusQ(o.meus);
  const href = (...p: string[]): DestinoDoCartao => ({ tipo: 'endereco', href: comConsulta('/treinador/financeiro', ...p, fim) });
  const cartoes: CartaoDoPainel[] = [];
  const quantidade = (n: number) => (n > 0 ? plural(n, 'cobrança', 'cobranças') : null);

  // Vencidas: todas as vencidas, a mesma consulta da lista `?situacao=VENCIDA` (não o `cartoes.emAtraso`, que recorta o período).
  if (ctx.pode('ALUNO_LER')) {
    const sit = situacaoDe(o.fontes.inadimplentes);
    const i = dadosDe(o.fontes.inadimplentes);
    const destino = href('aba=cobrancas', 'situacao=VENCIDA');
    const n = i && ehNumero(i.total) ? i.total : null;
    // Soma vazia chega sem valor (nulo) com 0 cobranças: quem manda é a contagem, e zero de verdade fica cinza.
    const valor = n === 0 ? 0 : i?.valorTotalCentavos;
    cartoes.push(cartao({
      chave: 'financeiro.vencidas', rotulo: 'Vencidas', nome: 'Cobranças vencidas', situacao: n === null && sit === 'pronta' ? 'falhou' : sit, valor,
      tom: 'perigo', destino, moeda: true, detalhe: n ? quantidade(n) : null, detalheFalado: n ? quantidade(n) : null,
    }));
  }

  const sitF = situacaoDe(o.fontes.financeiro);
  const f = dadosDe(o.fontes.financeiro);
  const em7 = f?.proximosRecebimentos?.em7Dias;
  const q7 = em7 && ehNumero(em7.cobrancas) ? em7.cobrancas : null;
  cartoes.push(cartao({
    chave: 'financeiro.vencendo', rotulo: 'Vencendo em 7 dias', nome: 'Cobranças vencendo em 7 dias', situacao: q7 === null && sitF === 'pronta' ? 'falhou' : sitF,
    valor: q7 === 0 ? 0 : em7?.valorCentavos, tom: 'atencao', moeda: true, detalhe: q7 ? quantidade(q7) : null, detalheFalado: q7 ? quantidade(q7) : null,
    destino: href('aba=cobrancas', 'situacao=ABERTA', 'vencimento=PROXIMOS_7_DIAS'),
  }));

  // Recebido no mês: o `cartoes.recebidoCentavos` cobre o período inteiro (6 meses); o do mês corrente é o do
  // `resultadoDoMes` (mesma consulta, do dia 1 a hoje). Sem pagamento no mês a soma vem nula: "—", nunca zero.
  const recebido = f ? f.resultadoDoMes?.recebidoCentavos : undefined;
  const entradaRecebido = {
    chave: 'financeiro.recebido', rotulo: 'Recebido no mês (bruto)', nome: 'Recebido no mês, valor bruto', tom: 'sucesso' as TomDoCartao, moeda: true, largo: true,
    destino: href('aba=visao'),
  };
  cartoes.push(sitF === 'pronta' && f && !ehNumero(recebido) && f.resultadoDoMes ? cartaoSemDado(entradaRecebido) : cartao({ ...entradaRecebido, situacao: sitF, valor: recebido }));
  return fechar(cabecalho('financeiro', o.meus), { cartoes });
}

function blocoRecebido(o: Entrada): BlocoDoPainel {
  const sit = situacaoDe(o.fontes.financeiro);
  const f = dadosDe(o.fontes.financeiro);
  const base = cabecalho('recebido', o.meus);
  if (sit === 'carregando') return { ...fechar(base, {}), carregando: true };
  if (!f || !Array.isArray(f.serie)) return { ...fechar(base, { falhouGrafico: true }), falhou: true };
  return fechar(base, { grafico: barrasDoRecebido(f.serie, o.meus, o.graficos) });
}

/** Dados prontos das barras: `serie[]` do `/financeiro/painel`. Valor ausente fica `null` ("—"), nunca zero. */
export function barrasDoRecebido(serie: PainelFinanceiro['serie'], meus: boolean, graficos: boolean): BarrasDoPainel {
  const nomeLanc = LANCAMENTOS_NAS_BARRAS === 'entradas' ? 'Entradas avulsas' : 'Saídas avulsas';
  const valor = (v: number | null | undefined) => (ehNumero(v) ? v : null);
  const texto = (v: number | null) => (v === null ? SEM_DADO : reaisSemCentavos(v));
  const meses: MesDasBarras[] = serie.map((m) => {
    const recebido = valor(m.recebidoCentavos);
    const entradasAvulsas = valor(m.entradasAvulsasCentavos);
    const saidasAvulsas = valor(m.saidasAvulsasCentavos);
    const lancamentos = LANCAMENTOS_NAS_BARRAS === 'entradas' ? entradasAvulsas : saidasAvulsas;
    return {
      mes: m.mes, rotulo: rotuloDoMes(m.mes), parcial: !!m.parcial, recebido, entradasAvulsas, saidasAvulsas, lancamentos,
      recebidoTexto: texto(recebido), lancamentosTexto: texto(lancamentos), entradasTexto: texto(entradasAvulsas), saidasTexto: texto(saidasAvulsas),
    };
  });
  const valores = meses.flatMap((m) => [m.recebido, m.lancamentos]).filter((v): v is number => v !== null);
  const falado = (v: number | null) => (v === null ? 'sem dado' : centavosParaTela(v));
  const ultimo = meses[meses.length - 1];
  const notas: string[] = [];
  if (ultimo?.parcial) notas.push(`* ${ultimo.rotulo} ainda em andamento (parcial).`);
  notas.push('"—" = sem dado no mês. Taxas e líquido não aparecem: a API não os informa.');
  if (meus) notas.push('Com "Meus", os lançamentos avulsos ficam de fora: não pertencem a um aluno.');
  return {
    tipo: 'barras', titulo: 'Recebido e lançamentos por mês', desenhar: graficos,
    series: [{ chave: 'recebido', rotulo: 'Recebido (bruto)', cor: 'texto' }, { chave: 'lancamentos', rotulo: nomeLanc, cor: 'neutro' }],
    meses, maximo: valores.length ? Math.max(...valores) : 0, semDados: valores.length === 0, notas,
    descricao: meses.length
      ? `Recebido (bruto) e ${nomeLanc.toLowerCase()} por mês, de ${meses[0].rotulo} a ${ultimo.rotulo}. ${meses.map((m) => `${m.rotulo}: recebido ${falado(m.recebido)}, ${nomeLanc.toLowerCase()} ${falado(m.lancamentos)}`).join('; ')}.${ultimo.parcial ? ' O último mês é parcial.' : ''}`
      : 'Sem meses para mostrar.',
  };
}

function blocoAlunos(o: Entrada): BlocoDoPainel {
  const sit = situacaoDe(o.fontes.painel);
  const base = cabecalho('alunos', o.meus);
  const p = dadosDe(o.fontes.painel);
  if (sit === 'carregando') return { ...fechar(base, {}), carregando: true };
  // Resposta sem as contagens (API antiga ou campo faltando): sem rosca, nunca "NaN" ou "undefined ativos".
  if (!p || !ehNumero(p.alunosAtivos) || !ehNumero(p.alunosInativos) || !ehNumero(p.alunosSemAcesso)) return { ...fechar(base, { falhouGrafico: true }), falhou: true };
  return fechar(base, { grafico: roscaDosAlunos(p, o.graficos) });
}

/**
 * Rosca dos alunos, uma visão só (D9): ativos com acesso, ativos sem acesso e inativos. `alunosSemAcesso` é parte de
 * `alunosAtivos`, então nenhum aluno conta duas vezes; o total é ativos + inativos.
 */
export function roscaDosAlunos(p: Pick<PainelTreinador, 'alunosAtivos' | 'alunosInativos' | 'alunosSemAcesso'>, graficos: boolean): RoscaDoPainel {
  const ativos = p.alunosAtivos;
  const inativos = p.alunosInativos;
  const semAcesso = Math.min(ativos, Math.max(0, p.alunosSemAcesso));
  const total = ativos + inativos;
  const brutas: Pick<FatiaDaRosca, 'chave' | 'rotulo' | 'valor' | 'cor'>[] = [
    { chave: 'comAcesso', rotulo: 'Ativos com acesso', valor: ativos - semAcesso, cor: 'sucesso' },
    { chave: 'semAcesso', rotulo: 'Ativos sem acesso', valor: semAcesso, cor: 'atencao' },
    { chave: 'inativos', rotulo: 'Inativos', valor: inativos, cor: 'neutro' },
  ];
  let acumulado = 0;
  const fatias: FatiaDaRosca[] = brutas.map((f) => {
    const fracao = total > 0 ? f.valor / total : 0;
    const fatia = { ...f, fracao, inicio: acumulado };
    acumulado += fracao;
    return fatia;
  });
  return {
    tipo: 'rosca', titulo: 'Ativos e inativos', total, fatias, desenhar: graficos, vazia: total === 0,
    resumo: `${plural(ativos, 'ativo', 'ativos')}, ${semAcesso} sem acesso ao app · ${plural(inativos, 'inativo', 'inativos')}`,
    descricao: `Alunos: ${fatias.map((f) => `${f.rotulo}, ${f.valor}`).join('; ')}. Total ${total}.`,
  };
}

// ---- Folhas ----

/** Teto das listas do `/painel` (alunos sem registro e pastas a renovar). */
export const TETO_DAS_LISTAS_DO_PAINEL = 20;
/** Teto de `GET /recordes/semana` (séries). */
export const TETO_DOS_RECORDES = 50;

/**
 * Linha de cima da Folha. Passou do que a lista traz: "Mostrando 20 de 34 alunos."; senão "3 alunos.". `mostrados` é quantos
 * itens a lista tem de fato (o teto da API: 20, ou 50 nos recordes); `total` nunca fica abaixo dele.
 */
export function resumoDaFolha(total: number, mostrados: number, unidade: readonly [singular: string, plural: string]): string {
  const n = Math.max(total, mostrados);
  const un = unidade[n === 1 ? 0 : 1];
  return n > mostrados ? `Mostrando ${mostrados} de ${milhares(n)} ${un}.` : `${milhares(n)} ${un}.`;
}

export interface ItemDaFolha {
  chave: string;
  alunoId: string;
  nome: string;
  /** Segunda linha ("Último registro em 12/10", "Ciclo 2 · termina em 05/11", o exercício). */
  descricao: string;
  /** Linhas extras (os recordes batidos). */
  detalhes: string[];
  /** À direita ("9 dias", "em 3 dias"). */
  direita: string | null;
  falado: string;
  /** Ficha do aluno. */
  href: string;
}

export interface FolhaDoPainel {
  id: FolhaDoPainelId;
  titulo: string;
  /** "Só os meus alunos" em Meus. */
  escopo: string | null;
  total: number;
  /** "Mostrando 20 de 34 alunos." ou "3 alunos."; `null` quando a lista está vazia (use `vazio`). */
  resumo: string | null;
  /** Frase da lista vazia. */
  vazio: string | null;
  itens: ItemDaFolha[];
}

const fichaDoAluno = (id: string) => `/treinador/alunos/${id}`;

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86_400_000);
}

function folha(id: FolhaDoPainelId, titulo: string, meus: boolean, total: number, itens: ItemDaFolha[], unidade: readonly [string, string], vazio: string): FolhaDoPainel {
  const n = Math.max(total, itens.length);
  return { id, titulo, escopo: meus ? SO_OS_MEUS : null, total: n, resumo: n > 0 ? resumoDaFolha(n, itens.length, unidade) : null, vazio: n > 0 ? null : vazio, itens };
}

/** Folha "Sem registro há N dias": `alunosSemRegistro` do `/painel` (até 20) e `alunosSemRegistroTotal`. `null` se o total não veio. */
export function folhaSemRegistro(p: Pick<PainelTreinador, 'alunosSemRegistro' | 'alunosSemRegistroTotal'>, o: { dias: number; meus: boolean; hoje: string }): FolhaDoPainel | null {
  if (!ehNumero(p.alunosSemRegistroTotal)) return null;
  const itens = p.alunosSemRegistro.map<ItemDaFolha>((a) => {
    const dias = a.ultimoRegistro ? diasEntre(a.ultimoRegistro, o.hoje) : null;
    return {
      chave: a.id, alunoId: a.id, nome: a.nome, detalhes: [], href: fichaDoAluno(a.id),
      descricao: a.ultimoRegistro ? `Último registro em ${dataCurta(a.ultimoRegistro)}` : 'Nunca registrou',
      direita: dias === null ? null : `${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      falado: `${a.nome}, ${dias === null ? 'nunca registrou' : `sem registro há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}. Abrir a ficha`,
    };
  });
  return folha('semRegistro', `Sem registro há ${o.dias} dias`, o.meus, p.alunosSemRegistroTotal, itens, ['aluno', 'alunos'], `Nenhum aluno sem registro há ${o.dias} dias.`);
}

/** Folha "A renovar em 7 dias": `pastasParaRenovar` do `/painel` (aluno e fim, até 20) e `pastasARenovar`. `null` se o total não veio. */
export function folhaPastasARenovar(p: Pick<PainelTreinador, 'pastasParaRenovar' | 'pastasARenovar'>, o: { meus: boolean; hoje: string }): FolhaDoPainel | null {
  if (!ehNumero(p.pastasARenovar)) return null;
  const itens = p.pastasParaRenovar.map<ItemDaFolha>((x) => {
    const terminou = x.fim < o.hoje;
    const quando = dataRelativa(x.fim, o.hoje);
    return {
      chave: x.pasta.id, alunoId: x.aluno.id, nome: x.aluno.nome, detalhes: [], href: fichaDoAluno(x.aluno.id),
      descricao: `${x.pasta.titulo} · ${terminou ? 'terminou' : 'termina'} em ${dataCurta(x.fim)}`,
      direita: quando,
      falado: `${x.aluno.nome}, pasta ${x.pasta.titulo}, ${terminou ? 'terminou' : 'termina'} em ${dataCurta(x.fim)}, ${quando}. Abrir a ficha`,
    };
  });
  return folha('pastasARenovar', 'A renovar em 7 dias', o.meus, p.pastasARenovar, itens, ['pasta', 'pastas'], 'Nenhuma pasta termina nos próximos 7 dias.');
}

/** Folha "Recordes dos últimos 7 dias": `GET /recordes/semana` (até 50 séries; `total` conta séries). */
export function folhaRecordes(r: Pick<RecordesDaSemana, 'total' | 'series'>, o: { meus: boolean; hoje: string }): FolhaDoPainel {
  const itens = r.series.map<ItemDaFolha>((s, i) => {
    const detalhes = s.recordes.map(textoDoRecorde);
    const quando = dataRelativa(s.data, o.hoje);
    return {
      chave: `${s.alunoId}:${s.data}:${s.exercicioId}:${i}`, alunoId: s.alunoId, nome: s.alunoNome, descricao: s.exercicioNome, detalhes, direita: quando,
      href: fichaDoAluno(s.alunoId), falado: `${s.alunoNome}, ${s.exercicioNome}, ${detalhes.join(' e ')}, ${quando}. Abrir a ficha`,
    };
  });
  return folha('recordes', 'Recordes dos últimos 7 dias', o.meus, r.total, itens, ['série com recorde', 'séries com recorde'], 'Nenhum recorde nos últimos 7 dias.');
}

export { hojeEmBrasilia };
