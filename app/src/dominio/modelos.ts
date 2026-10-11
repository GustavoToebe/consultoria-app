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
