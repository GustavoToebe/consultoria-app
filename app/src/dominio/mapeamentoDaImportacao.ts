/** Destinos da tela de importação e o mapeamento sugerido pela API (`sugestoes` de `/colunas`). */
import type { SugestaoDeColuna } from '../api/tipos';

export type DestinoDaImportacao = 'alunos' | 'pesos' | 'exercicios' | 'alimentos' | 'suplementos' | 'outros';

export interface CampoDaImportacao {
  id: string;
  rotulo: string;
  obrigatorio: boolean;
  sensivel?: boolean;
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

const campo = (id: string, rotulo: string, obrigatorio: boolean, sensivel = false): CampoDaImportacao =>
  ({ id, rotulo, obrigatorio, sensivel });
const noGrupo = (grupo: string, campos: CampoDaImportacao[]) => campos.map((c) => ({ ...c, grupo }));

export const DESTINOS: readonly Destino[] = [
  {
    id: 'alunos', rotulo: 'Alunos', permissao: 'ALUNO_ALTERAR',
    chaves: [{ valor: 'email', rotulo: 'E-mail' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      ...noGrupo('Cadastro', [
        campo('nome', 'Nome', true),
        campo('email', 'E-mail', false),
        campo('telefone', 'Telefone', false),
        campo('cpf', 'CPF', false, true),
        campo('nascimento', 'Data de nascimento', false),
        campo('sexo', 'Sexo', false),
      ]),
      ...noGrupo('Acompanhamento', [
        campo('objetivo', 'Objetivo', false, true),
        campo('observacoes', 'Observações', false, true),
      ]),
      ...noGrupo('Endereço', [
        campo('cep', 'CEP', false, true),
        campo('logradouro', 'Logradouro', false, true),
        campo('numero', 'Número', false, true),
        campo('complemento', 'Complemento', false, true),
        campo('bairro', 'Bairro', false, true),
        campo('cidade', 'Cidade', false, true),
        campo('uf', 'UF', false, true),
      ]),
      ...noGrupo('Acompanhamento', [
        campo('responsavel', 'Responsável', false),
        campo('dias', 'Dias', false),
        campo('situacao', 'Situação', false),
      ]),
    ],
  },
  {
    id: 'pesos', rotulo: 'Pesos', permissao: 'ALUNO_SENSIVEL_ALTERAR',
    chaves: [{ valor: 'email', rotulo: 'E-mail' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'nome', rotulo: 'Nome' }],
    existentes: [IGNORAR, SUBSTITUIR],
    campos: [
      campo('aluno', 'Aluno', true),
      campo('data', 'Data', true),
      campo('peso', 'Peso', true),
      campo('observacao', 'Observação', false),
    ],
  },
  {
    id: 'exercicios', rotulo: 'Exercícios', permissao: 'BIBLIOTECA_ALTERAR',
    chaves: [{ valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true),
      campo('grupo', 'Grupo', false),
      campo('equipamento', 'Equipamento', false),
      campo('modalidade', 'Modalidade', false),
      campo('video', 'Vídeo', false),
      campo('observacoes', 'Observações', false),
    ],
  },
  {
    id: 'alimentos', rotulo: 'Alimentos', permissao: 'BIBLIOTECA_ALTERAR',
    chaves: [{ valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true),
      campo('quantidade', 'Quantidade', true),
      campo('unidade', 'Unidade', true),
      campo('kcal', 'Kcal', true),
      campo('proteina', 'Proteína', true),
      campo('carboidrato', 'Carboidrato', true),
      campo('gordura', 'Gordura', true),
      campo('fibra', 'Fibra', false),
      campo('gramas', 'Gramas', false),
      campo('fonte', 'Fonte', false),
      campo('fc', 'FC', false),
      campo('fcc', 'FCc', false),
      campo('grupo', 'Grupo', false),
    ],
  },
  {
    id: 'suplementos', rotulo: 'Suplementos', permissao: 'BIBLIOTECA_ALTERAR',
    chaves: [{ valor: 'nome_marca', rotulo: 'Nome e marca' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true),
      campo('marca', 'Marca', true),
      campo('categoria', 'Categoria', false),
      campo('porcao', 'Porção', false),
      campo('porcoes', 'Porções', false),
      campo('sabores', 'Sabores', false),
      campo('link', 'Link', false),
      campo('cupom', 'Cupom', false),
    ],
  },
  {
    id: 'outros', rotulo: 'Outros', permissao: 'ERGOGENICO_ALTERAR',
    chaves: [{ valor: 'nome', rotulo: 'Nome' }],
    existentes: REGRAS,
    campos: [
      campo('nome', 'Nome', true),
      campo('categoria', 'Categoria', false),
      campo('principio', 'Princípio', false),
      campo('concentracao', 'Concentração', false),
      campo('apresentacao', 'Apresentação', false),
      campo('observacao', 'Observação', false),
    ],
  },
];

export function destinosPermitidos(pode: (codigo: string) => boolean): Destino[] {
  return DESTINOS.filter((d) => pode(d.permissao));
}

/**
 * Mapa campo → coluna a partir das sugestões da API: todo campo começa em "Não importar"; fica de fora o campo que o
 * destino não tem, o sensível sem a permissão e a segunda sugestão para a mesma coluna. `PARECIDA` vai para `paraConferir`.
 */
export function mapaDasSugestoes(sugestoes: readonly SugestaoDeColuna[], destino: Destino, podeSensivel: boolean): {
  mapa: Record<string, number | null>; paraConferir: Set<string>;
} {
  const mapa: Record<string, number | null> = Object.fromEntries(destino.campos.map((c) => [c.id, null]));
  const paraConferir = new Set<string>();
  const usadas = new Set<number>();
  for (const s of sugestoes) {
    const campoAtual = destino.campos.find((c) => c.id === s.campo);
    if (!campoAtual || (campoAtual.sensivel && !podeSensivel) || mapa[s.campo] !== null || usadas.has(s.coluna)) continue;
    mapa[s.campo] = s.coluna;
    usadas.add(s.coluna);
    if (s.confianca === 'PARECIDA') paraConferir.add(s.campo);
  }
  return { mapa, paraConferir };
}

/** Campo obrigatório do destino, mais a chave quando ela é uma coluna (e-mail ou CPF do aluno). */
export function faltandoColuna(destino: Destino, chave: string, mapa: Record<string, number | null>): string[] {
  const ids = new Set(destino.campos.filter((c) => c.obrigatorio).map((c) => c.id));
  if (destino.id === 'alunos' && chave !== 'nome') ids.add(chave);
  return [...ids].filter((id) => mapa[id] === null || mapa[id] === undefined).map((id) => destino.campos.find((c) => c.id === id)?.rotulo ?? id);
}
