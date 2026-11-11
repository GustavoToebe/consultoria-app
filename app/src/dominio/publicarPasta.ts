import type { PlanoPuladoNaCopia, PlanoResumo, PublicarPastaResposta, TipoPlano } from '../api/tipos';
import { dataParaTela } from './formatos';
import { PERMISSOES_DO_PLANO } from './permissoes';

/**
 * Regras puras da Folha da pasta para "Publicar tudo" (C21), "Copiar pasta para outro aluno" (D7) e o peso sugerido
 * ao finalizar (D8). Sem React e sem HTTP; a API continua sendo quem autoriza e valida.
 */

export const TIPOS_DA_PASTA: readonly TipoPlano[] = ['treino', 'dieta', 'mobilidade'];

const NOME: Record<TipoPlano, string> = { treino: 'Treino', dieta: 'Dieta', mobilidade: 'Mobilidade' };
const COM_ARTIGO: Record<TipoPlano, string> = { treino: 'o treino', dieta: 'a dieta', mobilidade: 'a mobilidade' };

/** Planos da pasta por tipo; `null` = a pessoa não lê esse tipo (ou a lista não chegou): não se sabe o que há nele. */
export type PlanosDaPasta = Record<TipoPlano, readonly PlanoResumo[] | null>;

/**
 * Plano que "Publicar tudo" publicaria: nunca publicado, ou com o rascunho alterado depois da última publicação. É o
 * mesmo critério da API (`Alvo.pendente`).
 */
export function planoPendente(p: Pick<PlanoResumo, 'versaoPublicada' | 'rascunhoAlteradoDepoisDePublicar'>): boolean {
  return p.versaoPublicada === 0 || p.rascunhoAlteradoDepoisDePublicar;
}

/**
 * Separa os planos do aluno pela pasta. A mobilidade fica de fora quando a funcionalidade está fora do plano da
 * consultoria (a API a pula ao publicar e ao copiar, então ela não pede permissão nenhuma).
 */
export function planosDaPasta(
  pastaId: string,
  porTipo: Partial<Record<TipoPlano, readonly PlanoResumo[] | null | undefined>>,
  comMobilidade: boolean,
): PlanosDaPasta {
  const daPasta = (lista: readonly PlanoResumo[] | null | undefined) => (lista ? lista.filter((p) => p.pastaId === pastaId) : null);
  return {
    treino: daPasta(porTipo.treino),
    dieta: daPasta(porTipo.dieta),
    mobilidade: comMobilidade ? daPasta(porTipo.mobilidade) : [],
  };
}

/** "o treino", "o treino e a dieta", "o treino, a dieta e a mobilidade". */
function juntar(tipos: readonly TipoPlano[]): string {
  const nomes = tipos.map((t) => COM_ARTIGO[t]);
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Motivo do "Publicar tudo" desabilitado: falta a permissão de publicar de um tipo **que tem alteração** (tipo sem
 * alteração não pede permissão). `null` = liberado. Tipo que a pessoa não lê fica desconhecido e não trava: o servidor
 * decide (403).
 */
export function motivoParaNaoPublicar(planos: PlanosDaPasta, pode: (codigo: string) => boolean): string | null {
  const faltam = TIPOS_DA_PASTA.filter((t) => (planos[t] ?? []).some(planoPendente) && !pode(PERMISSOES_DO_PLANO[t].publicar));
  return faltam.length ? `Falta permissão para publicar ${juntar(faltam)}.` : null;
}

/**
 * Estado do "Publicar tudo" diante das listas de planos. Duas travas, sem enviar nada à API:
 * - alguma lista está sendo buscada de novo (`atualizando`: depois de publicar, de um 409 ou de um "Tentar de novo"; os
 *   dados antigos ainda estão na tela, e um clique agora mandaria versões velhas e daria "Os planos mudaram" outra vez):
 *   "Atualizando os planos…";
 * - a lista de um tipo falhou ao carregar (`falhou`): o tipo fica desconhecido e fora de `versoes`, e publicar assim bateria
 *   num 409 que a tela explicaria errado. O motivo diz qual tipo e a tela oferece "Tentar de novo" só para essas listas.
 * Sem trava vale o motivo de permissão ({@link motivoParaNaoPublicar}). `falhou` considera só as listas buscadas (as que a
 * pessoa lê); a mobilidade fora do plano da consultoria não conta, porque a API a pula. `planos` `null` (nada chegou) não
 * trava aqui: quem chama já trata a primeira carga.
 */
export interface SituacaoDoPublicar {
  podePublicar: boolean;
  /** `null` = liberado. */
  motivo: string | null;
  /** Tipos cuja lista falhou, na ordem treino, dieta, mobilidade (vazio enquanto atualiza). */
  tiposComFalha: TipoPlano[];
}

export const MOTIVO_ATUALIZANDO_OS_PLANOS = 'Atualizando os planos…';

export function situacaoDoPublicar(
  planos: PlanosDaPasta | null,
  falhou: Partial<Record<TipoPlano, boolean>>,
  comMobilidade: boolean,
  pode: (codigo: string) => boolean,
  atualizando = false,
): SituacaoDoPublicar {
  if (atualizando) return { podePublicar: false, motivo: MOTIVO_ATUALIZANDO_OS_PLANOS, tiposComFalha: [] };
  const tiposComFalha = TIPOS_DA_PASTA.filter((t) => falhou[t] === true && (t !== 'mobilidade' || comMobilidade));
  if (tiposComFalha.length) {
    return { podePublicar: false, motivo: `Não foi possível carregar ${juntar(tiposComFalha)}. Tente de novo.`, tiposComFalha };
  }
  const motivo = planos ? motivoParaNaoPublicar(planos, pode) : null;
  return { podePublicar: motivo === null, motivo, tiposComFalha: [] };
}

/**
 * Motivo da cópia para outro aluno desabilitada: falta o `*_ALTERAR` de um tipo presente na pasta (a API exige o de
 * cada tipo presente, publicado ou não). `null` = liberado; tipo desconhecido não trava.
 */
export function motivoParaNaoCopiar(planos: PlanosDaPasta, pode: (codigo: string) => boolean): string | null {
  const faltam = TIPOS_DA_PASTA.filter((t) => (planos[t] ?? []).length > 0 && !pode(PERMISSOES_DO_PLANO[t].alterar));
  return faltam.length ? `Falta permissão para alterar ${juntar(faltam)}.` : null;
}

/**
 * `versoes` do "Publicar tudo": `{planoId: versao}` de cada plano pendente que a tela leu (a `versao` do rascunho, o lock
 * do `PlanoResumo`). A API recusa com 409 `CONFLITO_EDICAO` o pendente com outra versão ou ausente, então a publicação só
 * cobre o que a pessoa viu. Tipo desconhecido (`null`: não lido ou lista que não chegou) não entra, e `planos` `null` dá
 * `{}`. Montar na hora do clique, com a lista do momento (também no "Publicar mesmo assim"). O botão fica travado
 * enquanto uma lista falha ou é buscada de novo ({@link situacaoDoPublicar}), então a lista do clique é sempre a que a tela terminou de ler.
 * Quem publica usa {@link versoesDasListas}: `planosDaPasta` zera a mobilidade quando o `/eu` guardado diz que ela está
 * fora do plano, e um `/eu` velho (até cerca de 5 min) tiraria a versão do pedido e a API responderia 409 sem nada ter mudado.
 */
export function versoesDosPendentes(planos: PlanosDaPasta | null): Record<string, number> {
  const versoes: Record<string, number> = {};
  if (!planos) return versoes;
  for (const tipo of TIPOS_DA_PASTA) {
    for (const p of planos[tipo] ?? []) if (planoPendente(p)) versoes[p.id] = p.versao;
  }
  return versoes;
}

/**
 * Versões dos pendentes a partir das listas que a tela já carregou, sem olhar a funcionalidade guardada no `/eu`.
 * A mobilidade entra quando a lista chegou, mesmo com a flag desatualizada. Lista ausente (`null`) continua de fora.
 * A API ignora versão de plano que ela mesma pula (funcionalidade realmente desligada) e recusa o pendente ausente.
 */
export function versoesDasListas(
  pastaId: string,
  porTipo: Partial<Record<TipoPlano, readonly PlanoResumo[] | null | undefined>>,
): Record<string, number> {
  return versoesDosPendentes(planosDaPasta(pastaId, porTipo, true));
}

/** 409 `CONFLITO_EDICAO` do "Publicar tudo": os planos mudaram desde que a tela os leu. A tela recarrega e avisa. */
export const TEXTO_DO_CONFLITO_DA_PUBLICACAO =
  'Os planos mudaram enquanto você olhava. Nada foi publicado; confira e publique de novo.';

const ARTIGOS_DO_TIPO: Record<TipoPlano, { um: string; nome: string }> = {
  treino: { um: 'um', nome: 'treino' },
  dieta: { um: 'uma', nome: 'dieta' },
  mobilidade: { um: 'uma', nome: 'mobilidade' },
};

/** "A", "A e B", "A, B e C". */
function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * 409 `PLANOS_PENDENTES_DUPLICADOS`: o tipo vem em `fieldErrors[].field` (`treino`, `dieta`, `mobilidade`) e a mensagem é o
 * id do plano. Uma frase por tipo, na ordem treino, dieta, mobilidade, sem repetir, com o título de cada plano repetido
 * quando a lista da tela o conhece (sem ele, só o tipo). A saída é ARQUIVAR o que não deve ir ao aluno (na tela, "Excluir
 * plano" do ⋯): publicar um deles pelo editor e depois o "Publicar tudo" publicaria o outro e `desativarOutros` tiraria o
 * primeiro do ar sem ninguém perceber. Campo fora disso é ignorado e, sem nenhum tipo reconhecido, devolve `null` (quem
 * chama mostra a mensagem da API). Nada é publicado e a tela não tenta de novo.
 */
export function textoDosPendentesDuplicados(
  campos: readonly { field: string; message?: string }[],
  planos: PlanosDaPasta | null = null,
): string | null {
  const frases = TIPOS_DA_PASTA.filter((t) => campos.some((c) => c.field === t)).map((t) => {
    const { um, nome } = ARTIGOS_DO_TIPO[t];
    const titulos = campos
      .filter((c) => c.field === t)
      .map((c) => (planos?.[t] ?? []).find((p) => p.id === c.message)?.titulo)
      .filter((titulo): titulo is string => !!titulo)
      .map((titulo) => `“${titulo}”`);
    return `Há mais de ${um} ${nome} pendente nesta pasta${titulos.length ? ` (${listaComE(titulos)})` : ''}.`;
  });
  return frases.length ? `${frases.join(' ')} Nada foi publicado. ${ORIENTACAO_DOS_DUPLICADOS}` : null;
}

/** Fecha o texto do 409 de pendentes duplicados: o que fazer. */
export const ORIENTACAO_DOS_DUPLICADOS = 'Arquive o que não deve ir ao aluno (⋯ › Excluir plano) e publique de novo.';

const ROTULO_GERAL_DO_PUBLICAR = 'Publicar alterações da pasta';

/**
 * Rótulo do "Publicar" da pasta pelo alcance (guia premium, pág. 8): um tipo só com alteração e todas as listas
 * conhecidas = "Publicar dieta"; senão (dois tipos, nenhum, ou um tipo desconhecido que pode ter alteração) =
 * "Publicar alterações da pasta". O nome acessível começa pelo rótulo visível (WCAG 2.5.3) e diz a pasta.
 */
export function rotuloDoPublicarDaPasta(planos: PlanosDaPasta | null, tituloDaPasta: string): { rotulo: string; rotuloAcessivel: string } {
  const pendentes = planos ? TIPOS_DA_PASTA.filter((t) => (planos[t] ?? []).some(planoPendente)) : [];
  const todosConhecidos = !!planos && TIPOS_DA_PASTA.every((t) => planos[t] !== null);
  if (todosConhecidos && pendentes.length === 1) {
    const rotulo = `Publicar ${ARTIGOS_DO_TIPO[pendentes[0]].nome}`;
    return { rotulo, rotuloAcessivel: `${rotulo} da pasta ${tituloDaPasta}` };
  }
  return { rotulo: ROTULO_GERAL_DO_PUBLICAR, rotuloAcessivel: `${ROTULO_GERAL_DO_PUBLICAR} ${tituloDaPasta}` };
}

const PUBLICADO: Record<TipoPlano, string> = { treino: 'Treino publicado', dieta: 'Dieta publicada', mobilidade: 'Mobilidade publicada' };

/**
 * Aviso depois do 200 (só depois da confirmação da API): "Dieta publicada.", "Treino e dieta publicados. 1 plano sem
 * alteração." ou, sem nada publicado, que não havia o que publicar.
 */
export function resumoDaPublicacao(r: Pick<PublicarPastaResposta, 'publicados' | 'pulados'>): string {
  const tipos = TIPOS_DA_PASTA.filter((t) => r.publicados.some((p) => p.tipo === t));
  if (tipos.length === 0) return 'Nada para publicar: os planos já estão publicados e sem alteração.';
  const lista = listaComE(tipos.map((t) => ARTIGOS_DO_TIPO[t].nome));
  const publicados = tipos.length === 1
    ? PUBLICADO[tipos[0]]
    : `${lista.charAt(0).toUpperCase()}${lista.slice(1)} ${tipos.includes('treino') ? 'publicados' : 'publicadas'}`;
  const m = r.pulados.length;
  return m > 0 ? `${publicados}. ${m === 1 ? '1 plano' : `${m} planos`} sem alteração.` : `${publicados}.`;
}

export interface ProblemaDoPlano {
  mensagem: string;
}

export interface ProblemasPorPlano {
  /** Chave estável para a lista. */
  chave: string;
  tipo: TipoPlano | null;
  /** Plano do grupo, quando dá para saber qual (a tela oferece abri-lo). */
  planoId: string | null;
  /** "Treino: Plano 17"; sem o plano à mão, "Treino"; prefixo desconhecido, "Outros". */
  titulo: string;
  problemas: ProblemaDoPlano[];
}

const PREFIXO = /^(treino|dieta|mobilidade)(?:\.(.*))?$/s;

/**
 * Agrupa os `fieldErrors` do 422 do "Publicar tudo" por plano. O campo é `treino` ou `treino.<caminho>`; a API só valida
 * um plano pendente por tipo (dois são o 409 `PLANOS_PENDENTES_DUPLICADOS`), então o nome vem do único pendente do tipo;
 * sem ele (tipo não lido), só o tipo. Campo fora desse formato vai para "Outros" (nunca some). Só a mensagem vai para a tela: sem o conteúdo do plano, o caminho cru não diz nada ao treinador.
 * Ordem: a dos planos na resposta (a API valida treino, dieta e mobilidade, nessa ordem).
 */
export function agruparProblemasPorPlano(
  campos: readonly { field: string; message: string }[],
  planos: PlanosDaPasta,
): ProblemasPorPlano[] {
  const grupos = new Map<string, ProblemasPorPlano>();
  for (const c of campos) {
    const m = PREFIXO.exec(c.field);
    const tipo = (m?.[1] as TipoPlano | undefined) ?? null;
    let chave = 'outros';
    let titulo = 'Outros';
    let idDoPlano: string | null = null;
    if (tipo) {
      const daPasta = planos[tipo] ?? [];
      const plano = soUm(daPasta.filter(planoPendente));
      chave = tipo;
      titulo = plano ? `${NOME[tipo]}: ${plano.titulo}` : NOME[tipo];
      idDoPlano = plano?.id ?? null;
    }
    const grupo = grupos.get(chave) ?? { chave, tipo, planoId: idDoPlano, titulo, problemas: [] };
    grupo.problemas.push({ mensagem: c.message });
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

function soUm<T>(lista: readonly T[]): T | undefined {
  return lista.length === 1 ? lista[0] : undefined;
}

/** "1 problema", "3 avisos" (para o título de cada grupo e o leitor de tela). */
export function contagemDeProblemas(n: number, avisos: boolean): string {
  if (avisos) return n === 1 ? '1 aviso' : `${n} avisos`;
  return n === 1 ? '1 problema' : `${n} problemas`;
}

/** Erro da API reduzido ao que as regras precisam (o `ErroApi` do cliente serve). */
export interface ErroResumido {
  status: number;
  codigo: string | null;
  mensagem: string;
}

/** Texto do erro do "Publicar tudo" que não é a lista por plano (403, 404 e o resto). */
export function textoDoErroDaPublicacao(e: ErroResumido): string {
  if (e.status === 403) return 'Você não tem permissão para publicar todos os planos com alteração desta pasta. Nada foi publicado.';
  if (e.status === 404) return 'Esta pasta não foi encontrada. Ela pode ter sido excluída; feche e abra a ficha de novo.';
  return e.mensagem;
}

/** Texto do erro da cópia da pasta para outro aluno. */
export function textoDoErroDaCopia(e: ErroResumido): string {
  if (e.status === 409 && e.codigo === 'ALUNO_ANONIMIZADO') return 'Este aluno foi anonimizado e não pode receber a cópia. Escolha outro aluno.';
  if (e.status === 404) return 'Não encontramos a pasta ou o aluno escolhido. Atualize a lista de alunos e tente de novo.';
  if (e.status === 403) return 'Você não tem permissão para copiar todos os planos desta pasta.';
  // 400: a API já explica (mesmo aluno, fim antes do início).
  return e.mensagem;
}

/** Aviso fixo da Folha da cópia (D5): o que vai e o que não vai. */
export const AVISO_DA_COPIA_DA_PASTA =
  'Copia a versão publicada de cada plano (o rascunho, se ainda não foi publicado). Os planos chegam como rascunho, sem os ergogênicos da dieta e sem o questionário escolhido; nada é publicado para o aluno.';

/**
 * Aviso depois de copiar a pasta. Com a mobilidade em `pulados` (funcionalidade fora do plano da consultoria), diz que
 * ela não foi copiada.
 */
export function mensagemPastaCopiada(nomeDoAluno: string | null | undefined, pulados: readonly Pick<PlanoPuladoNaCopia, 'tipo'>[] = []): string {
  const nome = nomeDoAluno?.trim();
  const base = `Pasta copiada para ${nome || 'o aluno'}, com os planos em rascunho.`;
  return pulados.some((p) => p.tipo === 'mobilidade') ? `${base} A mobilidade não foi copiada porque está fora do plano da consultoria.` : base;
}

/**
 * Peso sugerido ao finalizar (D8): só com as permissões de ler o dado sensível e a atualização (a rota exige as duas)
 * e a de gravar o peso (sem ela o campo nem aparece, e não há por que ler o dado).
 */
export function podeSugerirPeso(pode: (codigo: string) => boolean): boolean {
  return pode('ALUNO_SENSIVEL_LER') && pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_ALTERAR');
}

/** "Peso preenchido com o da atualização de 20/10/2026; confira antes de salvar." */
export function notaDoPesoSugerido(dataIso: string | null): string {
  const data = dataIso ? dataParaTela(dataIso.slice(0, 10)) : '';
  return data
    ? `Peso preenchido com o da atualização de ${data}; confira antes de salvar.`
    : 'Peso preenchido com o da atualização; confira antes de salvar.';
}
