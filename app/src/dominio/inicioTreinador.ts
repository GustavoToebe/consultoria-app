/**
 * Regras do Início do treinador (padrão das telas, 19/10): por onde começar e o que mostrar sem repetir.
 * Só leitura do painel; nada é feito sozinho.
 */

export type DestinoDoInicio = 'PARA_REVISAR' | 'ATRASADAS' | 'RETORNOS' | 'INTERESSADOS' | 'PLANOS_TERMINANDO' | 'SEM_REGISTRO';

export interface PendenciasDoInicio {
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
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * A primeira pendência, na ordem do trabalho do dia: atualização para revisar (o aluno espera o feedback), atrasadas,
 * retorno a interessado já vencido (combinado e não cumprido), interessados novos (quem espera contato), retornos
 * marcados para hoje, planos que terminam e alunos sem registro. Nada pendente = nulo.
 */
/** Teto da lista `planosTerminando` do `GET /painel` (a API não manda o total): no teto, o texto diz "20 ou mais". */
export const TETO_PLANOS_TERMINANDO = 20;

export function proximoPassoDoInicio(p: PendenciasDoInicio): { texto: string; acao: string; destino: DestinoDoInicio } | null {
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
  return null;
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
