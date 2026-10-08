import type { PlanoDetalhe, Receita } from '../api/tipos';

/** Adapta modelos ao mesmo editor de conteúdo, sem datas ou publicação. */
export function detalheDoModelo(r: Receita): PlanoDetalhe<unknown> {
  return { plano: { id: r.id, alunoId: '', pastaId: null, titulo: r.nome, inicio: null, fim: null,
    ativo: false, versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: r.versao },
    rascunho: r.conteudo, versoes: [] };
}
