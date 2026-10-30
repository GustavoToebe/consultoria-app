import type { PlanoDetalhe, Receita, TipoReceita } from '../api/tipos';
import { periodoCurto } from './datasRelativas';
import { hojeIso, SEM_DADO } from './formatos';

/** Mesmo limite da API (`ReceitaRequest` e `SalvarComoReceitaRequest`). A coluna do banco comporta 400: texto antigo maior continua legível, mas só salva reduzido. */
export const LIMITE_DESCRICAO_DO_MODELO = 300;

/** Descrição do modelo na lista e no "Aplicar ao aluno"; sem texto, "—". Não vai para o plano criado. */
export const descricaoDoModelo = (r: Pick<Receita, 'descricao'>): string => r.descricao?.trim() || SEM_DADO;

/** Adapta modelos ao mesmo editor de conteúdo, sem datas ou publicação. */
export function detalheDoModelo(r: Receita): PlanoDetalhe<unknown> {
  return { plano: { id: r.id, alunoId: '', pastaId: null, titulo: r.nome, inicio: null, fim: null,
    ativo: false, versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: r.versao },
    rascunho: r.conteudo, versoes: [] };
}

/**
 * Só apresentação (a API recusa com 403): aplicar um modelo cria treino, dieta ou mobilidade, então o botão pede a
 * permissão de alterar o que o modelo cria. O pacote aparece com qualquer uma das duas; a API confere o que ele traz.
 */
export function podeAplicarModelo(tipo: TipoReceita, pode: (codigo: string) => boolean): boolean {
  if (!pode('MODELO_APLICAR') || !pode('ALUNO_LER')) return false;
  switch (tipo) {
    case 'PLANO_TREINO': case 'SESSAO_TREINO': case 'MOBILIDADE': return pode('TREINO_ALTERAR');
    case 'PLANO_DIETA': case 'REFEICAO': return pode('DIETA_ALTERAR');
    case 'PASTA_PLANO': return pode('TREINO_ALTERAR') || pode('DIETA_ALTERAR');
    default: return false;
  }
}

export const SEM_PASTA_PARA_APLICAR = 'Peça a quem pode criar pastas para criar uma para este aluno.';

/**
 * Destino ao aplicar um modelo ou copiar um plano (só apresentação; a API recusa com 403 criar pasta sem
 * `PASTA_ALTERAR`): pastas abertas primeiro, depois "Criar nova pasta" (só para quem pode) e as concluídas por último,
 * cada uma com o período. Na reunião de 29/10 o destino padrão "nova pasta" criou uma segunda pasta sem o treinador
 * perceber: agora, se o aluno já tem pasta, ninguém escolhe por ele (`padrao` nulo); só sem pasta nenhuma a nova vem
 * marcada, e quem não pode criar pasta com uma única pasta fica nela. Sem pasta e sem poder criar, o aviso substitui o
 * formulário. `pastas` nulo = ainda carregando.
 */
export function destinosParaAplicar(
  podeCriarPasta: boolean,
  pastas: readonly { id: string; titulo: string; inicio?: string | null; fim?: string | null; concluidaEm?: string | null }[] | null,
  hoje: string = hojeIso(),
) {
  const lista = pastas ?? [];
  const rotulo = (p: (typeof lista)[number]) =>
    `${p.titulo} · ${periodoCurto(p.inicio ?? null, p.fim ?? null, hoje)}${p.concluidaEm ? ' (concluída)' : ''}`;
  const abertas = lista.filter((p) => !p.concluidaEm).map((p) => ({ valor: p.id, rotulo: rotulo(p) }));
  const concluidas = lista.filter((p) => !!p.concluidaEm).map((p) => ({ valor: p.id, rotulo: rotulo(p) }));
  const opcoes = [...abertas, ...(podeCriarPasta ? [{ valor: '', rotulo: 'Criar nova pasta' }] : []), ...concluidas];
  const padrao: string | null =
    pastas === null ? null : lista.length === 0 ? (podeCriarPasta ? '' : null) : !podeCriarPasta && lista.length === 1 ? lista[0].id : null;
  return {
    opcoes,
    semDestino: !podeCriarPasta && pastas !== null && lista.length === 0,
    /** Destino já marcado ao abrir; nulo = o treinador precisa escolher. */
    padrao,
  };
}

/** Mesmas permissões da rota `POST /pastas/{id}/salvar-como-modelo` (só apresentação; a API decide). */
export const podeSalvarPastaComoModelo = (pode: (codigo: string) => boolean): boolean =>
  ['MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER'].every(pode);

/** O ⋯ da pasta só aparece se tiver ao menos uma ação: salvar como pacote ou excluir a pasta. */
export const temAcaoNoMenuDaPasta = (pode: (codigo: string) => boolean): boolean =>
  pode('PASTA_ALTERAR') || podeSalvarPastaComoModelo(pode);

/**
 * Frase acima do botão de aplicar ou copiar: onde a cópia entra e que o aluno só a vê depois de publicada (a aplicação
 * cria rascunho; reunião de 29/10). Nulo enquanto o destino não foi escolhido.
 */
export function resumoDoDestino(escolhido: boolean, destino: string, opcoes: readonly { valor: string; rotulo: string }[], titulo: string): string | null {
  if (!escolhido) return null;
  const aviso = 'O aluno só vê depois que você publicar.';
  if (!destino) return `Cria a pasta nova “${titulo.trim() || 'sem título'}” com a cópia em rascunho. ${aviso}`;
  const pasta = opcoes.find((o) => o.valor === destino)?.rotulo.split(' · ')[0] ?? 'escolhida';
  return `A cópia entra em rascunho na pasta “${pasta}”. ${aviso}`;
}
