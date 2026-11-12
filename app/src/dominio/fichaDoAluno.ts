import type { ItemDeAtividade, SituacaoLesao } from '../api/tipos';

/** Abas da ficha do aluno do treinador, na ordem da tela (`?aba=` no endereço). */
export type AbaDaFicha = 'resumo' | 'planos' | 'acompanhamento' | 'evolucao' | 'ficha';

export const ABAS_DA_FICHA: readonly { valor: AbaDaFicha; rotulo: string }[] = [
  { valor: 'resumo', rotulo: 'Resumo' },
  { valor: 'planos', rotulo: 'Planos' },
  { valor: 'acompanhamento', rotulo: 'Acompanhamento' },
  { valor: 'evolucao', rotulo: 'Evolução' },
  { valor: 'ficha', rotulo: 'Ficha do aluno' },
];

/** O que a ficha precisa saber de quem a abre: as mesmas coisas que `treinador/alunos/[id].tsx` consulta bloco a bloco. */
export interface ContextoDaFicha {
  pode: (codigo: string) => boolean;
  pagamentosHabilitados: boolean;
  retornoHabilitado: boolean;
}

/** Blocos de conteúdo que moram nas abas Planos, Acompanhamento, Evolução e Ficha (o Resumo só reúne o que decide a próxima ação). */
export type BlocoDaFicha =
  | 'pastas'
  | 'frequencia' | 'mobilidade' | 'agua' | 'treinosConcluidos' | 'recordesDaSemana' | 'evolucaoDasRespostas'
  | 'peso' | 'avaliacaoFisica' | 'fotos' | 'progresso'
  | 'dadosDoAluno' | 'acessoAoApp' | 'planoContratado' | 'anamnese' | 'lesoes';

/**
 * Cada bloco, a aba onde fica e a condição que a ficha usa hoje para mostrá-lo (a API autoriza de novo). `dadosDoAluno`
 * inclui o ciclo, e `acessoAoApp` (situação, conta e as ações do convite e da senha) tem as condições dos botões dentro do
 * cartão; as pastas aparecem a quem abre a ficha (`ALUNO_LER`, da própria rota). Aba sem nenhum bloco permitido não aparece.
 */
const BLOCOS: readonly { bloco: BlocoDaFicha; aba: AbaDaFicha; visivel: (c: ContextoDaFicha) => boolean }[] = [
  { bloco: 'pastas', aba: 'planos', visivel: () => true },
  // Frequência, mobilidade e água ficam dentro do bloco de registros; a água é dado de dieta (a rota pede as duas).
  { bloco: 'frequencia', aba: 'acompanhamento', visivel: (c) => c.pode('REGISTRO_LER') },
  { bloco: 'mobilidade', aba: 'acompanhamento', visivel: (c) => c.pode('REGISTRO_LER') && c.pode('TREINO_LER') },
  { bloco: 'agua', aba: 'acompanhamento', visivel: (c) => c.pode('REGISTRO_LER') && c.pode('ALUNO_SENSIVEL_LER') },
  { bloco: 'treinosConcluidos', aba: 'acompanhamento', visivel: (c) => c.retornoHabilitado && c.pode('REGISTRO_LER') },
  { bloco: 'recordesDaSemana', aba: 'acompanhamento', visivel: (c) => c.retornoHabilitado && c.pode('REGISTRO_LER') },
  { bloco: 'evolucaoDasRespostas', aba: 'acompanhamento', visivel: (c) => c.pode('ATUALIZACAO_LER') && c.pode('ALUNO_SENSIVEL_LER') },
  // Evolução: o peso (dado que quase sempre existe) antes do progresso de carga (guia de 11/11, pág. 34).
  { bloco: 'peso', aba: 'evolucao', visivel: (c) => c.pode('ALUNO_SENSIVEL_LER') },
  { bloco: 'progresso', aba: 'evolucao', visivel: (c) => c.pode('REGISTRO_LER') },
  { bloco: 'avaliacaoFisica', aba: 'evolucao', visivel: (c) => c.pode('ALUNO_SENSIVEL_LER') },
  { bloco: 'fotos', aba: 'evolucao', visivel: (c) => c.pode('ATUALIZACAO_LER') && c.pode('ALUNO_SENSIVEL_LER') },
  { bloco: 'dadosDoAluno', aba: 'ficha', visivel: () => true },
  { bloco: 'acessoAoApp', aba: 'ficha', visivel: () => true },
  { bloco: 'planoContratado', aba: 'ficha', visivel: (c) => c.pagamentosHabilitados && c.pode('FINANCEIRO_LER') },
  { bloco: 'anamnese', aba: 'ficha', visivel: (c) => c.pode('ANAMNESE_LER') && c.pode('ALUNO_SENSIVEL_LER') },
  { bloco: 'lesoes', aba: 'ficha', visivel: (c) => c.pode('ALUNO_SENSIVEL_LER') },
];

export const blocoVisivel = (bloco: BlocoDaFicha, contexto: ContextoDaFicha): boolean =>
  BLOCOS.some((b) => b.bloco === bloco && b.visivel(contexto));

/** Os blocos permitidos de uma aba, na ordem em que a tela os mostra. */
export const blocosDaAba = (aba: AbaDaFicha, contexto: ContextoDaFicha): BlocoDaFicha[] =>
  BLOCOS.filter((b) => b.aba === aba && b.visivel(contexto)).map((b) => b.bloco);

/** As abas que a pessoa pode abrir: Resumo sempre; as outras só se algum bloco delas é permitido (a Ficha tem sempre os dados do aluno). */
export const abasVisiveis = (contexto: ContextoDaFicha): AbaDaFicha[] =>
  ABAS_DA_FICHA.filter((a) => a.valor === 'resumo' || blocosDaAba(a.valor, contexto).length > 0).map((a) => a.valor);

/**
 * Aba pedida pelo endereço (`?aba=`). Valor desconhecido (ou de lista, ou ausente) abre o Resumo; com `permitidas`, uma aba que o
 * perfil não vê também.
 */
export function abaDaUrl(valor: string | string[] | undefined, permitidas?: readonly AbaDaFicha[]): AbaDaFicha {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  const aba = ABAS_DA_FICHA.find((a) => a.valor === bruto)?.valor;
  return aba && (!permitidas || permitidas.includes(aba)) ? aba : 'resumo';
}

const preenchido = (valor: string | string[] | undefined): boolean => {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return typeof bruto === 'string' && bruto.trim() !== '';
};

/** `?pastaId=` ("Voltar à pasta", "Abrir pasta" da atualização, atividade recente) abre a aba Planos; sem ele, nada a dizer (`null`). */
export const abaParaPasta = (pastaId: string | string[] | undefined): AbaDaFicha | null => (preenchido(pastaId) ? 'planos' : null);

/** `?editar=1` (editar o cadastro) abre a aba Ficha do aluno; qualquer outro valor, nada a dizer (`null`). */
export const abaParaEditar = (editar: string | string[] | undefined): AbaDaFicha | null =>
  (Array.isArray(editar) ? editar[0] : editar) === '1' ? 'ficha' : null;

const TEXTO_DO_EVENTO: Record<string, string> = {
  ATUALIZACAO_ENVIADA: 'Atualização enviada',
  TREINO_CONCLUIDO: 'Treino concluído',
  PLANO_PUBLICADO: 'Plano publicado',
  PESO_REGISTRADO: 'Peso registrado',
};

/** O título fixo que a API manda (sem valor de peso, resposta nem nome de exercício); sem ele, um texto genérico do tipo. */
export const textoDoEvento = (item: Pick<ItemDeAtividade, 'tipo' | 'titulo'>): string =>
  item.titulo.trim() || TEXTO_DO_EVENTO[item.tipo] || 'Atividade registrada';

/** Onde abrir o detalhe do evento: outra tela pelo endereço, ou a Folha de uma pasta da própria ficha (aba Planos, `?pastaId=`). */
export type DestinoDoEvento = { tipo: 'rota'; href: string } | { tipo: 'pasta'; pastaId: string };

/** `null` quando não há tela de detalhe (treino concluído, peso, plano fora de pasta) ou o destino é desconhecido. */
export function destinoDoEvento(item: Pick<ItemDeAtividade, 'destino'>): DestinoDoEvento | null {
  const destino = item.destino;
  if (!destino || !destino.id) return null;
  if (destino.tipo === 'ATUALIZACAO') return { tipo: 'rota', href: `/treinador/atualizacoes/${encodeURIComponent(destino.id)}` };
  if (destino.tipo === 'PASTA') return { tipo: 'pasta', pastaId: destino.id };
  return null;
}

/** O registro de peso de data mais recente (a lista da API não promete ordem); `null` sem nenhum. */
export const ultimoPeso = <T extends { data: string }>(pesos: readonly T[]): T | null =>
  pesos.reduce<T | null>((ultimo, p) => (!ultimo || p.data > ultimo.data ? p : ultimo), null);

/**
 * Aviso discreto do Resumo, só com a contagem (nunca região, descrição nem observação da lesão): `null` sem `ALUNO_SENSIVEL_LER`,
 * sem lesões ou sem nenhuma ativa. Com a situação em todas, conta as que ainda não estão recuperadas (ativa e em recuperação) e
 * diz "ativas"; se alguma vier sem situação não dá para presumir que continua ativa e diz "registradas".
 */
export function avisoDeLesoes(lesoes: readonly { situacao?: SituacaoLesao | null }[], podeVerSensivel: boolean): string | null {
  if (!podeVerSensivel || lesoes.length === 0) return null;
  if (lesoes.every((l) => !!l.situacao)) {
    const ativas = lesoes.filter((l) => l.situacao !== 'RECUPERADA').length;
    return ativas === 0 ? null : `${ativas} ${ativas === 1 ? 'lesão ativa' : 'lesões ativas'}`;
  }
  return `${lesoes.length} ${lesoes.length === 1 ? 'lesão registrada' : 'lesões registradas'}`;
}
