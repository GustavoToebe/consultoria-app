/** Tipos da vitrine da consultoria (F1 de `docs/planos/vitrine-e-loja.md`). Dinheiro em centavos, datas ISO (dia de Brasília). */

export type TipoDoItem = 'DIGITAL' | 'FISICO';

/** O item como a equipe vê (`GET /vitrine/itens`, `VITRINE_LER`). `precoVigenteCentavos` e `especialAte` são do servidor (D4): o app só formata. */
export interface ItemDaVitrine {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TipoDoItem;
  precoCentavos: number | null;
  precoEspecialCentavos: number | null;
  /** Preço que vale hoje (o especial dentro do prazo, senão o normal); nulo = sem preço. */
  precoVigenteCentavos: number | null;
  /** Último dia do preço especial (inclusive, Brasília); nulo = sem prazo. */
  especialAte: string | null;
  cupom: string | null;
  linkUrl: string | null;
  ativo: boolean;
  /** Aparece na página pública da loja (F2a); só item `DIGITAL` pode (422 `VITRINE_ITEM_INVALIDO` no campo). */
  naPaginaPublica: boolean;
  ordem: number;
  versao: number;
  temFoto: boolean;
  /** Instante da última troca da foto (nulo sem foto): serve de chave para buscar a imagem de novo depois da troca. */
  fotoAtualizadaEm: string | null;
}

/** O item como o aluno vê (`GET /aluno/vitrine`: só itens ativos, sem versão nem ordem de edição). */
export type ItemDaVitrineDoAluno = Pick<
  ItemDaVitrine,
  'id' | 'nome' | 'descricao' | 'tipo' | 'precoCentavos' | 'precoVigenteCentavos' | 'especialAte' | 'cupom' | 'linkUrl' | 'temFoto' | 'fotoAtualizadaEm'
>;

/** Corpo do `POST /vitrine/itens` e do `PUT /vitrine/itens/{id}` (`versao` só na edição). */
export interface DadosDoItem {
  nome: string;
  descricao: string | null;
  tipo: TipoDoItem;
  precoCentavos: number | null;
  precoEspecialCentavos: number | null;
  especialAte: string | null;
  cupom: string | null;
  linkUrl: string | null;
  ativo: boolean;
  /** Mandar SEMPRE: a API trata ausente como `false`. */
  naPaginaPublica: boolean;
  versao?: number;
}

// ---- Página pública da loja (F2a) ----

/** `GET`/`PUT /vitrine/configuracao` e `POST .../novo-link` (equipe). Sem configuração ainda: tudo nulo e `paginaLigada` falso. */
export interface PaginaDaVitrine {
  paginaLigada: boolean;
  /** Código do link `/loja/<codigo>`; nulo até a primeira gravação. */
  codigo: string | null;
  /** Vai de volta em toda escrita (nulo só enquanto não há configuração); diferente = 409 `CONFLITO_EDICAO`. */
  versao: number | null;
}

/** Corpo do `PUT /vitrine/configuracao`. */
export interface DadosDaPagina {
  paginaLigada: boolean;
  versao: number | null;
}

/** A marca como a página pública a recebe (sem `id`). */
export type MarcaDaLoja = Pick<import('./tipos').Marca, 'nome' | 'corPrimaria' | 'fonteTitulo' | 'temaPadrao' | 'logoUrl'>;

/**
 * Item da página pública (`GET /publico/loja/{codigo}`): só itens ativos, DIGITAIS e marcados, na ordem da vitrine; por
 * isso não traz `tipo`. A foto vem em `/publico/loja/{codigo}/itens/{id}/foto` (`caminhoDaFotoDaLoja`).
 */
export type ItemDaLojaPublica = Omit<ItemDaVitrineDoAluno, 'tipo'>;

export interface LojaPublica {
  marca: MarcaDaLoja;
  itens: ItemDaLojaPublica[];
}
