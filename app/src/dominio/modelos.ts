import type { PlanoDetalhe, Receita, TipoReceita } from '../api/tipos';

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
 * Destino ao aplicar um modelo (só apresentação; a API recusa com 403 criar pasta sem `PASTA_ALTERAR`): quem não pode
 * criar pasta só escolhe uma existente, e sem nenhuma o aviso substitui o formulário. `pastas` nulo = ainda carregando.
 */
export function destinosParaAplicar(podeCriarPasta: boolean, pastas: readonly { id: string; titulo: string }[] | null) {
  const existentes = (pastas ?? []).map((p) => ({ valor: p.id, rotulo: p.titulo }));
  return {
    opcoes: podeCriarPasta ? [{ valor: '', rotulo: 'Criar nova pasta' }, ...existentes] : existentes,
    semDestino: !podeCriarPasta && pastas !== null && pastas.length === 0,
    /** Destino usado quando nada foi escolhido: nova pasta (vazio) para quem pode criar; a primeira existente para os demais. */
    padrao: podeCriarPasta ? '' : existentes[0]?.valor ?? '',
  };
}

/** Mesmas permissões da rota `POST /pastas/{id}/salvar-como-modelo` (só apresentação; a API decide). */
export const podeSalvarPastaComoModelo = (pode: (codigo: string) => boolean): boolean =>
  ['MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER'].every(pode);

/** O ⋯ da pasta só aparece se tiver ao menos uma ação: salvar como pacote ou excluir a pasta. */
export const temAcaoNoMenuDaPasta = (pode: (codigo: string) => boolean): boolean =>
  pode('PASTA_ALTERAR') || podeSalvarPastaComoModelo(pode);
