/** Destinos da tela de importação e a sugestão de coluna, sem acento e sem caixa. */

export type DestinoDaImportacao = 'alunos' | 'pesos' | 'exercicios' | 'alimentos' | 'suplementos' | 'outros';

export interface CampoDaImportacao {
  id: string;
  rotulo: string;
  obrigatorio: boolean;
  sensivel?: boolean;
  sinonimos: string[];
  /** Grupo do campo na lista do mapeamento ("Endereço > CEP"); sem grupo, só o rótulo. */
  grupo?: string;
}

export interface Destino {
  id: DestinoDaImportacao;
  rotulo: string;
  permissao: string;
  chaves: { valor: string; rotulo: string }[];
  existentes: { valor: string; rotulo: string }[];
  campos: CampoDaImportacao[];
}

const IGNORAR = { valor: 'IGNORAR', rotulo: 'Ignorar' };
const COMPLETAR = { valor: 'COMPLETAR', rotulo: 'Completar' };
const ATUALIZAR = { valor: 'ATUALIZAR', rotulo: 'Atualizar' };
const SUBSTITUIR = { valor: 'SUBSTITUIR', rotulo: 'Substituir' };
const REGRAS = [IGNORAR, COMPLETAR, ATUALIZAR];

const campo = (id: string, rotulo: string, obrigatorio: boolean, sinonimos: string[], sensivel = false): CampoDaImportacao =>
  ({ id, rotulo, obrigatorio, sensivel, sinonimos });
const noGrupo = (grupo: string, campos: CampoDaImportacao[]) => campos.map((c) => ({ ...c, grupo }));

export const DESTINOS: readonly Destino[] = [
  {
    id: 'alunos', rotulo: 'Alunos', permissao: 'ALUNO_ALTERAR',
    chaves: [{ valor: 'email', rotulo: 'E-mail' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      ...noGrupo('Cadastro', [
        campo('nome', 'Nome', true, ['nome do aluno', 'aluno']),
        campo('email', 'E-mail', false, ['email', 'e mail']),
        campo('telefone', 'Telefone', false, ['telefone 1 (com ddd)', 'telefone 1', 'celular', 'fone']),
        campo('cpf', 'CPF', false, ['documento'], true),
      ]),
      ...noGrupo('Acompanhamento', [
        campo('objetivo', 'Objetivo', false, [], true),
        campo('observacoes', 'Observações', false, ['observacao', 'obs'], true),
      ]),
      ...noGrupo('Endereço', [
        campo('cep', 'CEP', false, [], true),
        campo('logradouro', 'Logradouro', false, ['rua', 'endereco'], true),
        campo('numero', 'Número', false, ['numero'], true),
        campo('complemento', 'Complemento', false, [], true),
        campo('bairro', 'Bairro', false, [], true),
        campo('cidade', 'Cidade', false, [], true),
        campo('uf', 'UF', false, ['estado'], true),
      ]),
      ...noGrupo('Acompanhamento', [
        campo('responsavel', 'Responsável', false, ['responsavel', 'e-mail do responsavel']),
        campo('dias', 'Dias', false, ['dias de atualizacao', 'ciclo']),
        campo('situacao', 'Situação', false, ['status', 'ativo']),
      ]),
    ],
  },
  {
    id: 'pesos', rotulo: 'Pesos', permissao: 'ALUNO_SENSIVEL_ALTERAR',
    chaves: [{ valor: 'email', rotulo: 'E-mail' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'nome', rotulo: 'Nome' }],
    existentes: [IGNORAR, SUBSTITUIR],
    campos: [
      campo('aluno', 'Aluno', true, ['nome do aluno', 'e-mail', 'email', 'cpf']),
      campo('data', 'Data', true, ['data da pesagem']),
      campo('peso', 'Peso', true, ['peso (kg)', 'peso kg']),
      campo('observacao', 'Observação', false, ['observacoes', 'obs']),
    ],
  },
  {
    id: 'exercicios', rotulo: 'Exercícios', permissao: 'BIBLIOTECA_ALTERAR',
    chaves: [{ valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true, ['exercicio']),
      campo('grupo', 'Grupo', false, ['grupo muscular']),
      campo('equipamento', 'Equipamento', false, []),
      campo('modalidade', 'Modalidade', false, []),
      campo('video', 'Vídeo', false, ['link do video', 'url']),
      campo('observacoes', 'Observações', false, ['observacao']),
    ],
  },
  {
    id: 'alimentos', rotulo: 'Alimentos', permissao: 'BIBLIOTECA_ALTERAR',
    chaves: [{ valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true, ['alimento']),
      campo('quantidade', 'Quantidade', true, ['quantidade base', 'base']),
      campo('unidade', 'Unidade', true, []),
      campo('kcal', 'Kcal', true, ['calorias', 'energia']),
      campo('proteina', 'Proteína', true, ['proteinas', 'ptn']),
      campo('carboidrato', 'Carboidrato', true, ['carboidratos', 'cho']),
      campo('gordura', 'Gordura', true, ['gorduras', 'lipidio']),
      campo('gramas', 'Gramas', false, ['gramas por unidade']),
      campo('fonte', 'Fonte', false, []),
      campo('fc', 'FC', false, ['fator de correcao', 'fator correcao']),
      campo('fcc', 'FCc', false, ['fator de coccao', 'fator coccao']),
      campo('grupo', 'Grupo', false, ['grupo do alimento', 'categoria']),
    ],
  },
  {
    id: 'suplementos', rotulo: 'Suplementos', permissao: 'BIBLIOTECA_ALTERAR',
    chaves: [{ valor: 'nome_marca', rotulo: 'Nome e marca' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true, ['suplemento']),
      campo('marca', 'Marca', true, []),
      campo('categoria', 'Categoria', false, []),
      campo('porcao', 'Porção', false, ['porcao']),
      campo('porcoes', 'Porções', false, ['porcoes por embalagem']),
      campo('sabores', 'Sabores', false, ['sabor']),
      campo('link', 'Link', false, ['url']),
    ],
  },
  {
    id: 'outros', rotulo: 'Outros', permissao: 'ERGOGENICO_ALTERAR',
    chaves: [{ valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true, ['item']),
      campo('categoria', 'Categoria', false, []),
      campo('principio', 'Princípio', false, ['principio ativo']),
      campo('concentracao', 'Concentração', false, ['concentracao']),
      campo('apresentacao', 'Apresentação', false, ['apresentacao']),
      campo('observacao', 'Observação', false, ['observacoes']),
    ],
  },
];

export function destinosPermitidos(pode: (codigo: string) => boolean): Destino[] {
  return DESTINOS.filter((d) => pode(d.permissao));
}

export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Coluna cujo cabeçalho casa com o campo, o rótulo ou um sinônimo. Cada coluna entra no máximo uma vez. */
export function sugerirMapeamento(colunas: readonly string[], campos: readonly CampoDaImportacao[]): Record<string, number | null> {
  const usados = new Set<number>();
  const mapa: Record<string, number | null> = {};
  for (const campoAtual of campos) {
    const alvos = new Set([campoAtual.id, campoAtual.rotulo, ...campoAtual.sinonimos].map(semAcento));
    const indice = colunas.findIndex((coluna, i) => !usados.has(i) && alvos.has(semAcento(coluna)));
    if (indice >= 0) {
      mapa[campoAtual.id] = indice;
      usados.add(indice);
    } else {
      mapa[campoAtual.id] = null;
    }
  }
  return mapa;
}

/** Campo obrigatório do destino, mais a chave quando ela é uma coluna (e-mail ou CPF do aluno). */
export function faltandoColuna(destino: Destino, chave: string, mapa: Record<string, number | null>): string[] {
  const ids = new Set(destino.campos.filter((c) => c.obrigatorio).map((c) => c.id));
  if (destino.id === 'alunos' && chave !== 'nome') ids.add(chave);
  return [...ids].filter((id) => mapa[id] === null || mapa[id] === undefined).map((id) => destino.campos.find((c) => c.id === id)?.rotulo ?? id);
}
