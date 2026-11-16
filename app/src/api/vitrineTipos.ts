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
  versao?: number;
}
