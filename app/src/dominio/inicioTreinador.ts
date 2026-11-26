/**
 * Regras do Início do treinador (padrão das telas, 19/10): por onde começar e o que mostrar sem repetir.
 * Só leitura do painel; nada é feito sozinho.
 */

export type DestinoDoInicio = 'SEM_ACESSO' | 'PARA_REVISAR' | 'ATRASADAS' | 'RETORNOS' | 'INTERESSADOS' | 'PLANOS_TERMINANDO' | 'SEM_REGISTRO' | 'TROCAS';

export interface PendenciasDoInicio {
  /** Alunos ativos que ainda não entraram no app (`alunosSemAcesso` do painel). Nulo = sem permissão de convidar ou sem o número. */
  semAcesso?: number | null;
  /** Nulo = sem permissão para ver (o item não entra na conta). */
  paraRevisar: number | null;
  atrasadas: number | null;
  interessadosNovos: number | null;
  /** Retornos combinados com interessados (`GET /inscricoes/contagens`): vencidos e marcados para hoje. */
  retornosAtrasados?: number | null;
  retornosHoje?: number | null;
  planosTerminando: number | null;
  semRegistro: number | null;
  diasSemRegistro: number;
  /** Trocas de exercício sem "Visto" nos últimos 7 dias (`GET /trocas-de-exercicio/pendentes`). */
  trocas?: number | null;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * A primeira pendência, na ordem do trabalho do dia: aluno sem acesso (sem convite ele não registra nem atualiza, então
 * convidar vem antes de cobrar o que ele não consegue fazer), atualização para revisar (o aluno espera o feedback), atrasadas,
 * retorno a interessado já vencido (combinado e não cumprido), interessados novos (quem espera contato), retornos
 * marcados para hoje, planos que terminam, alunos sem registro e trocas de exercício para ver. Nada pendente = nulo.
 */
/** Teto da lista `planosTerminando` do `GET /painel` (a API não manda o total): no teto, o texto diz "20 ou mais". */
export const TETO_PLANOS_TERMINANDO = 20;

export function proximoPassoDoInicio(p: PendenciasDoInicio): { texto: string; acao: string; destino: DestinoDoInicio } | null {
  if (p.semAcesso) return { texto: `${plural(p.semAcesso, 'aluno ainda não tem', 'alunos ainda não têm')} acesso.`, acao: p.semAcesso === 1 ? 'Enviar convite' : 'Enviar convites', destino: 'SEM_ACESSO' };
  if (p.paraRevisar) return { texto: `${plural(p.paraRevisar, 'atualização chegou', 'atualizações chegaram')} para revisar.`, acao: 'Revisar agora', destino: 'PARA_REVISAR' };
  if (p.atrasadas) return { texto: `${plural(p.atrasadas, 'atualização está atrasada', 'atualizações estão atrasadas')}.`, acao: 'Ver atrasadas', destino: 'ATRASADAS' };
  if (p.retornosAtrasados) return { texto: `${plural(p.retornosAtrasados, 'retorno a interessado está atrasado', 'retornos a interessados estão atrasados')}.`, acao: 'Ver retornos', destino: 'RETORNOS' };
  if (p.interessadosNovos) return { texto: `${plural(p.interessadosNovos, 'interessado novo espera', 'interessados novos esperam')} contato.`, acao: 'Ver interessados', destino: 'INTERESSADOS' };
  if (p.retornosHoje) return { texto: `${plural(p.retornosHoje, 'retorno a interessado está marcado', 'retornos a interessados estão marcados')} para hoje.`, acao: 'Ver retornos', destino: 'RETORNOS' };
  if (p.planosTerminando) {
    const quantos = p.planosTerminando >= TETO_PLANOS_TERMINANDO ? `${TETO_PLANOS_TERMINANDO} ou mais planos terminam` : plural(p.planosTerminando, 'plano termina', 'planos terminam');
    return { texto: `${quantos} nos próximos 7 dias.`, acao: 'Ver planos', destino: 'PLANOS_TERMINANDO' };
  }
  if (p.semRegistro) return { texto: `${plural(p.semRegistro, 'aluno está', 'alunos estão')} sem registro há ${p.diasSemRegistro} dias.`, acao: 'Ver alunos', destino: 'SEM_REGISTRO' };
  if (p.trocas) return { texto: `${plural(p.trocas, 'troca de exercício', 'trocas de exercício')} para ver nos últimos 7 dias.`, acao: 'Ver trocas', destino: 'TROCAS' };
  return null;
}

// ---- "Tudo em dia" só com base (D9 de `docs/planos/nulo-e-cobertura.md`, 13/11) ----

/**
 * Estado de cada fonte do resumo: `consultada` (respondeu com o número), `semAcesso` (falta permissão ou o servidor devolveu
 * nulo por ela), `falhou` (a consulta falhou ou veio sem o número) e `carregando`. Só `consultada` prova "sem pendência".
 */
export type EstadoDaFonte = 'consultada' | 'semAcesso' | 'falhou' | 'carregando';

/** As fontes que `proximoPassoDoInicio` lê: atualizações, interessados (com os retornos), planos terminando e sem registro. */
export interface FontesDoResumo {
  atualizacoes: EstadoDaFonte;
  interessados: EstadoDaFonte;
  planosTerminando: EstadoDaFonte;
  semRegistro: EstadoDaFonte;
  trocas?: EstadoDaFonte;
}

/** Sem acesso, nada a consultar; carregando, ainda não se sabe; só `pronta` com o número lido vale como consultada. */
export function estadoDaFonte(temAcesso: boolean, situacao: 'carregando' | 'falhou' | 'desligada' | 'pronta', numeroLido: boolean): EstadoDaFonte {
  if (!temAcesso) return 'semAcesso';
  if (situacao === 'carregando') return 'carregando';
  return situacao === 'pronta' && numeroLido ? 'consultada' : 'falhou';
}

export const TEXTO_EM_DIA = 'Tudo em dia por aqui. Nada pede sua atenção agora.';
export const TEXTO_SEM_ACESSO_AO_RESUMO = 'Você não tem acesso aos dados deste resumo.';
export const TEXTO_NAO_CONFERIU_TUDO = 'Não foi possível conferir tudo.';

export type PassoDoInicio = NonNullable<ReturnType<typeof proximoPassoDoInicio>>;

export type ResumoDoInicio =
  /** Há pendência numa fonte consultada; `aviso` diz que o resto não foi conferido (parcial). */
  | { tipo: 'pendencia'; passo: PassoDoInicio; aviso: string | null }
  | { tipo: 'emDia'; texto: string }
  | { tipo: 'semAcesso'; texto: string }
  /** Nenhuma pendência nas fontes que deram certo, mas alguma falhou ou está sem acesso. `tentarDeNovo`: alguma falhou. */
  | { tipo: 'parcial'; texto: string; tentarDeNovo: boolean }
  /** Ainda consultando: não afirma nada. */
  | { tipo: 'carregando' };

/**
 * O resumo do Início em três saídas além da pendência: em dia (todas as fontes consultadas e sem pendência), sem acesso
 * (nenhuma fonte acessível) e parcial ("Não foi possível conferir tudo"). Enquanto alguma fonte carrega e nada pende, não
 * afirma "em dia". `p` traz nulo nas fontes que não foram consultadas (o item não entra na conta).
 */
export function resumoDoInicio(p: PendenciasDoInicio, fontes: FontesDoResumo): ResumoDoInicio {
  const estados = Object.values(fontes);
  const incompleto = estados.some((e) => e === 'semAcesso' || e === 'falhou');
  const passo = proximoPassoDoInicio(p);
  if (passo) return { tipo: 'pendencia', passo, aviso: incompleto ? TEXTO_NAO_CONFERIU_TUDO : null };
  if (estados.some((e) => e === 'carregando')) return { tipo: 'carregando' };
  if (estados.every((e) => e === 'consultada')) return { tipo: 'emDia', texto: TEXTO_EM_DIA };
  if (estados.every((e) => e === 'semAcesso')) return { tipo: 'semAcesso', texto: TEXTO_SEM_ACESSO_AO_RESUMO };
  return { tipo: 'parcial', texto: `${TEXTO_NAO_CONFERIU_TUDO} O que foi consultado não aponta pendência.`, tentarDeNovo: estados.includes('falhou') };
}

/** "Últimos registros": o mais recente de cada aluno (a lista do painel vinha quase toda do mesmo aluno), até `limite`. */
export function umPorAluno<T extends { aluno: { id: string }; data: string }>(itens: readonly T[], limite = 5): T[] {
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const item of [...itens].sort((a, b) => b.data.localeCompare(a.data))) {
    if (vistos.has(item.aluno.id)) continue;
    vistos.add(item.aluno.id);
    saida.push(item);
    if (saida.length === limite) break;
  }
  return saida;
}

/** Tom do contador: com algo, atenção (atrasadas, perigo); zerado, suave. */
export function tomDoContador(numero: number, perigo = false): 'perigo' | 'atencao' | 'suave' {
  if (numero <= 0) return 'suave';
  return perigo ? 'perigo' : 'atencao';
}

/**
 * Contador "Retornos" do Início (retornos combinados com interessados): soma os atrasados e os de hoje. Acende em vermelho
 * com algum atrasado, em âmbar só com os de hoje, apagado sem nenhum; o detalhe diz quantos são de cada.
 */
export function contadorDeRetornos(atrasados: number, hoje: number): { numero: number; tom: 'perigo' | 'atencao' | 'suave'; detalhe: string | null } {
  const numero = Math.max(0, atrasados) + Math.max(0, hoje);
  const partes = [atrasados > 0 ? plural(atrasados, 'atrasado', 'atrasados') : null, hoje > 0 ? `${hoje} para hoje` : null].filter(Boolean);
  return { numero, tom: atrasados > 0 ? 'perigo' : hoje > 0 ? 'atencao' : 'suave', detalhe: partes.length ? partes.join(' · ') : null };
}
