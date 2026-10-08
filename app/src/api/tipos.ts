/**
 * Tipos dos contratos da API (espelho dos records Java). Mudou um DTO na API, muda aqui junto.
 */

export type Papel = 'TREINADOR' | 'ALUNO';
export type Fonte = 'PADRAO' | 'METAL';
export type Tema = 'ESCURO' | 'CLARO';

export interface Marca {
  id: string;
  nome: string;
  lema: string | null;
  corPrimaria: string;
  fonteTitulo: Fonte;
  temaPadrao: Tema;
  /** Relativo à API (o app junta com a URL base). */
  logoUrl: string | null;
}

export interface UsuarioResumo {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  /** Só no cliente nativo; a web recebe cookie HttpOnly. */
  refreshToken?: string;
  usuario: UsuarioResumo;
  marca: Marca;
}

export interface EuResponse {
  usuario: UsuarioResumo;
  marca: Marca;
  aluno?: { id: string; nome: string };
}

export interface ConvitePublico {
  consultoria: Marca;
  primeiroNomeAluno: string;
}

export interface CampoComErro {
  field: string;
  message: string;
}

/** Corpo de erro padrão da API (ApiError). */
export interface ApiErrorBody {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  codigo: string | null;
  path: string;
  requestId: string | null;
  fieldErrors: CampoComErro[] | null;
}

// ---- Marca e configuração (seção 7.3) ----

export interface Configuracao {
  tiposSerie: string[];
  tipoTrabalho: string;
  tipoPreparacao: string;
  /** Chave = quantidade de séries de preparação; valor = percentuais de cada uma. */
  regraPreparacao: Record<string, number[]>;
  arredondamentoKg: number;
  instrucoesTreino: string | null;
  rodapePdf: string | null;
}

export interface ConsultoriaResponse {
  marca: Marca;
  configuracao: Configuracao;
  versao: number;
}

// ---- Alunos ----

export type SituacaoFiltro = 'ATIVO' | 'INATIVO' | 'TODOS';

export interface AlunoResumo {
  id: string;
  nome: string;
  ativo: boolean;
  temAcesso: boolean;
  planoAtivo: { id: string; titulo: string } | null;
  ultimoRegistro: string | null;
}

export interface PaginaAlunos {
  itens: AlunoResumo[];
  total: number;
}

export interface AlunoDetalhe {
  id: string;
  nome: string;
  email: string | null;
  objetivo: string | null;
  observacoes: string | null;
  ativo: boolean;
  temAcesso: boolean;
  conviteExpiraEm: string | null;
  versao: number;
}

export interface AlunoRequest {
  nome: string;
  email: string | null;
  objetivo: string | null;
  observacoes: string | null;
  versao?: number | null;
}

export interface ConviteGerado {
  codigo: string;
  link: string;
  expiraEm: string;
}

// ---- Biblioteca ----

export type Modalidade = 'LIVRE' | 'MAQUINA' | 'ELASTICO' | 'PESO_CORPORAL' | 'CARDIO' | 'OUTRO';

export interface Exercicio {
  id: string;
  nome: string;
  grupoMuscular: string | null;
  equipamento: string | null;
  modalidade: Modalidade;
  videoUrl: string | null;
  observacoes: string | null;
  origem: string;
}

export interface ExercicioRequest {
  nome: string;
  grupoMuscular: string | null;
  equipamento: string | null;
  modalidade: Modalidade;
  videoUrl: string | null;
  observacoes: string | null;
}

export type UnidadeAlimento = 'g' | 'ml' | 'un';

export interface Alimento {
  id: string;
  nome: string;
  baseQuantidade: number;
  baseUnidade: UnidadeAlimento;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  gramasPorUnidade: number | null;
  fonte: string | null;
  origem: string;
}

export type AlimentoRequest = Omit<Alimento, 'id' | 'origem'>;

export interface CatalogoExercicio {
  id: string;
  nome: string;
  grupoMuscular: string | null;
  equipamento: string | null;
  modalidade: string;
  instrucoes: string | null;
  fonte: string | null;
}

export interface CatalogoAlimento {
  id: string;
  nome: string;
  baseQuantidade: number;
  baseUnidade: string;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fonte: string | null;
  grupo: string | null;
  codigoFonte: string | null;
  /** Nutrientes que a fonte marca como traço (`Tr`); o valor vem 0 e a tela mostra "Tr". */
  tracos: string[];
}

/** `total` é quantos itens casaram com a busca; `itens` vem limitado. */
export interface PaginaCatalogo<T> {
  itens: T[];
  total: number;
}

export interface ImportacaoResultado {
  importados: number;
  ignorados: number;
}

export interface PreviaCsv {
  validas: ({ linha: number; nome: string } & Record<string, unknown>)[];
  erros: { linha: number; motivo: string }[];
  hash: string;
}

// ---- Receitas ----

export type TipoReceita = 'SERIES' | 'PLANO_TREINO' | 'PLANO_DIETA' | 'METODOLOGIA' | 'SESSAO_TREINO' | 'REFEICAO' | 'PASTA_PLANO' | 'MOBILIDADE';

export interface Receita {
  id: string;
  tipo: TipoReceita;
  nome: string;
  descricao: string | null;
  conteudo: unknown;
  ordem: number;
  pastaId: string | null;
  versao: number;
}

// ---- Planos (seção 7) ----

export type TipoSessao = 'TREINO' | 'DESCANSO_ATIVO' | 'DESCANSO' | 'ACESSORIOS';
export type ModoIntensidade = 'CARGA_TRABALHO' | 'PERCENTUAL_WS' | 'RIR' | 'RPE' | 'LIVRE' | 'NENHUMA';

export interface Intensidade {
  modo: ModoIntensidade;
  percentual?: number | null;
  rir?: number | null;
  rpe?: number | null;
  texto?: string | null;
}

export interface Serie {
  uid: string;
  tipo: string;
  repsMin: number | null;
  repsMax: number | null;
  alvoTexto: string | null;
  intensidade: Intensidade | null;
  descansoSegundos: number | null;
}

export interface ExercicioPlano {
  uid: string;
  exercicioId: string | null;
  nome: string;
  modalidade: string | null;
  videoUrl: string | null;
  observacao: string | null;
  progressao: boolean;
  unidade: 'kg' | 'nenhuma';
  series: Serie[];
}

export interface Sessao {
  uid: string;
  nome: string;
  diaSemana: number | null;
  tipo: TipoSessao;
  frequenciaSemanal: number | null;
  observacao: string | null;
  cardio: string | null;
  exercicios: ExercicioPlano[];
}

export interface ConteudoTreino {
  metodologia?: { id: string; nome: string; configuracao: Configuracao } | null;
  objetivo: string | null;
  orientacoes: string | null;
  sessoes: Sessao[];
}

export interface ItemDieta {
  uid: string;
  alimentoId: string | null;
  nome: string;
  quantidade: number | null;
  unidade: UnidadeAlimento;
  kcal: number | null;
  proteina: number | null;
  carboidrato: number | null;
  gordura: number | null;
  manual: boolean;
}

export interface OpcaoRefeicao {
  uid: string;
  rotulo: string;
  itens: ItemDieta[];
}

export interface Refeicao {
  uid: string;
  nome: string;
  horario: string | null;
  observacao: string | null;
  opcoes: OpcaoRefeicao[];
}

export interface Suplemento {
  uid: string;
  nome: string;
  dose: string;
  horario: string;
  observacao: string;
}

export interface ConteudoDieta {
  objetivo: string | null;
  dataInicio: string | null;
  profissional: string | null;
  refeicoes: Refeicao[];
  orientacoes: { titulo: string; texto: string }[];
  observacoes: string | null;
  suplementacao: Suplemento[];
}

export type TipoPlano = 'treino' | 'dieta';

export interface PastaResumo {
  id: string;
  alunoId: string;
  titulo: string;
  inicio: string | null;
  fim: string | null;
}

export interface PlanoResumo {
  id: string;
  alunoId: string;
  /** Pasta do plano; `null` em plano criado antes das pastas. */
  pastaId: string | null;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
  /** 0 = nunca publicado. */
  versaoPublicada: number;
  publicadoEm: string | null;
  rascunhoAlteradoDepoisDePublicar: boolean;
  /** Lock otimista do rascunho. */
  versao: number;
}

export interface VersaoResumo {
  id: string;
  numero: number;
  publicadoEm: string;
}

export interface PlanoDetalhe<C> {
  plano: PlanoResumo;
  rascunho: C;
  versoes: VersaoResumo[];
}

export interface Problema {
  caminho: string;
  mensagem: string;
}

export interface ResultadoValidacao {
  erros: Problema[];
  avisos: Problema[];
}

// ---- Início e acompanhamento ----

export interface PainelTreinador {
  alunosAtivos: number;
  alunosSemRegistro7Dias: { id: string; nome: string; ultimoRegistro: string | null }[];
  ultimasExecucoes: { aluno: { id: string; nome: string }; data: string; sessao: string; series: number }[];
  planosTerminando: { plano: { id: string; titulo: string }; aluno: { id: string; nome: string }; fim: string }[];
}

export interface SerieFeita {
  id: string;
  serieUid: string;
  tipo: string;
  trabalho: boolean;
  carga: number | null;
  unidade: string | null;
  repeticoes: number | null;
  concluida: boolean;
  observacao: string | null;
}

export interface DiaDeTreino {
  data: string;
  sessoes: {
    sessaoUid: string;
    sessao: string;
    planoVersaoId: string;
    exercicios: { exercicioUid: string; exercicioId: string | null; nome: string; series: SerieFeita[] }[];
  }[];
}

export interface ProgressoPonto {
  data: string;
  maiorCargaTrabalho: number | null;
  repeticoes: number | null;
}

export type SituacaoLesao = 'ATIVA' | 'EM_RECUPERACAO' | 'RECUPERADA';

/** Lesão do histórico do aluno (dado sensível: só na tela, nunca em log). */
export interface Lesao {
  id: string;
  regiao: string;
  descricao: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  situacao: SituacaoLesao;
  observacao: string | null;
}

export type DadosLesao = Omit<Lesao, 'id'>;

export interface RegistroPeso {
  id: string;
  data: string;
  pesoKg: number;
  variacao: number | null;
  observacao: string | null;
}

// ---- Aluno (seção 9.4) ----

export interface TreinoAtual {
  planoId: string;
  versaoId: string;
  numero: number;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  publicadoEm: string;
  conteudo: ConteudoTreino;
}

export interface UltimaCarga {
  carga: number | null;
  repeticoes: number | null;
  data: string;
}

/** Tudo o que o app guarda para o aluno treinar sem internet. `treino` nulo = sem plano publicado. */
export interface PainelAluno {
  marca: Marca;
  aluno: { nome: string };
  treino: TreinoAtual | null;
  /** Por `exercicioId` da biblioteca: última carga em série de trabalho. */
  ultimasCargas: Record<string, UltimaCarga>;
  /** `instrucoesTreino` falta em pacote salvo antes desta versão. */
  configuracao: { arredondamentoKg: number; tipoTrabalho: string; instrucoesTreino?: string | null };
  geradoEm: string;
}

export interface VersaoDetalhe<C> {
  id: string;
  planoId: string;
  numero: number;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  publicadoEm: string;
  conteudo: C;
}

export interface RegistroEnvio {
  id: string;
  planoVersaoId: string;
  sessaoUid: string;
  exercicioUid: string;
  serieUid: string;
  data: string;
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
  observacao: string | null;
  alteradoNoAparelhoEm: string;
}

export type SituacaoEnvio = 'ACEITO' | 'IGNORADO_ANTIGO' | 'RECUSADO';

export interface LoteResponse {
  resultados: { id: string; situacao: SituacaoEnvio; motivo: string | null }[];
}

export interface PastaModelo { id: string; nome: string; versao: number }
export interface ConteudoPastaModelo { planos: { titulo: string; treino: ConteudoTreino | null; dieta: ConteudoDieta | null }[] }
