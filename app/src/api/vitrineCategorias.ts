import { requisicao } from './cliente';

/**
 * Categorias da vitrine (equipe: `VITRINE_LER` para ler, `VITRINE_ALTERAR` para escrever; contrato em
 * `docs/planos/vitrine-categorias.md`). No máximo 30 por consultoria; excluir deixa os itens sem categoria, nunca apaga item.
 */
export interface CategoriaDaVitrine {
  id: string;
  nome: string;
  ordem: number;
  /** Quantos itens (ativos e inativos) estão nela. */
  quantidade: number;
}

const seg = (valor: string) => encodeURIComponent(valor);

/** Na ordem definida pela equipe. */
export const categoriasDaVitrine = () => requisicao<CategoriaDaVitrine[]>('/vitrine/categorias');
/** 201, vai para o fim. 422 `VITRINE_CATEGORIA_INVALIDA` e 409 `VITRINE_CATEGORIA_DUPLICADA` em `nome`; 409 `VITRINE_CATEGORIAS_LIMITE`. */
export const criarCategoriaDaVitrine = (nome: string) =>
  requisicao<CategoriaDaVitrine>('/vitrine/categorias', { metodo: 'POST', corpo: { nome } });
/** Os mesmos erros do criar; 404 se não existe mais. */
export const renomearCategoriaDaVitrine = (id: string, nome: string) =>
  requisicao<CategoriaDaVitrine>(`/vitrine/categorias/${seg(id)}`, { metodo: 'PUT', corpo: { nome } });
/** 204; os itens dela ficam sem categoria. */
export const excluirCategoriaDaVitrine = (id: string) => requisicao<void>(`/vitrine/categorias/${seg(id)}`, { metodo: 'DELETE' });
/** 204; a lista completa, como a dos itens. */
export const ordenarCategoriasDaVitrine = (ids: readonly string[]) =>
  requisicao<void>('/vitrine/categorias/ordem', { metodo: 'PUT', corpo: { ids } });
