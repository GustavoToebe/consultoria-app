/**
 * Tipos dos contratos da API (espelho dos records Java). Mudou um DTO na API, muda aqui junto.
 */

export type Papel = 'TREINADOR' | 'ALUNO';
export type Fonte = 'PADRAO' | 'METAL' | 'ESPORTIVA' | 'CONDENSADA';
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
  telefone?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  /** Só no cliente nativo; a web recebe cookie HttpOnly. */
  refreshToken?: string;
  usuario: UsuarioResumo;
  marca: Marca;
}

export interface PerfilDaEquipe { id:string; nome:string; acessoTotal:boolean }

export interface EuResponse {
  perfil?: PerfilDaEquipe;
  permissoes?: string[];
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
  /** Faixa de repetições de cada tipo de série (chave = tipo); o editor preenche ao criar a série ou trocar o tipo. */
  repeticoes?: Record<string, FaixaRepeticoes> | null;
}

export interface FaixaRepeticoes {
  min: number;
  max: number;
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
  responsavelId?: string | null;
}

export interface PaginaAlunos {
  itens: AlunoResumo[];
  total: number;
}

export interface AlunoDetalhe {
  id: string;
  nome: string;
  email: string | null;
  objetivo?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  temAcesso: boolean;
  conviteExpiraEm: string | null;
  versao: number;
  diasAtualizacao: number | null;
  responsavelId?: string | null;
  /** Questionário de atualização escolhido para o aluno; nulo = vale o padrão. */
  questionarioId?: string | null;
}

export interface AlunoRequest {
  responsavelId?:string|null;
  nome: string;
  email: string | null;
  objetivo?: string | null;
  observacoes?: string | null;
  versao?: number | null;
  /** Dias do ciclo do aluno (1 a 365): sugere o fim do período ao criar uma pasta. */
  diasAtualizacao?: number | null;
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
  /** Link https do produto (copiado da biblioteca); nulo quando não há. */
  link: string | null;
}

/** Medicação ou ergogênico da dieta do aluno (dado sensível). Dose, horário e prescrição são texto do treinador. */
export interface ItemErgogenico {
  uid: string;
  nome: string;
  principioAtivo: string;
  concentracao: string;
  dose: string;
  horario: string;
  observacao: string;
  prescricao: string;
}

export interface ConteudoDieta {
  objetivo: string | null;
  dataInicio: string | null;
  profissional: string | null;
  refeicoes: Refeicao[];
  orientacoes: { titulo: string; texto: string }[];
  observacoes: string | null;
  suplementacao: Suplemento[];
  /** Nulo para quem não tem ERGOGENICO_LER (a API não envia) e em modelos; lista para quem vê. */
  ergogenicos: ItemErgogenico[] | null;
}

/** Mobilidade como a API entrega (campos de texto opcionais vêm nulos); o editor usa `dominio/mobilidade`. */
export interface ConteudoMobilidadeApi {
  orientacoes: string | null;
  secoes: { uid: string; titulo: string | null; itens: { uid: string; nome: string; prescricao: string | null; videoUrl: string | null }[] }[];
}

export type TipoPlano = 'treino' | 'dieta' | 'mobilidade';

export interface PastaResumo {
  id: string;
  alunoId: string;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  /** Instante em que o treinador finalizou a pasta; nulo = aberta. */
  concluidaEm: string | null;
  /** Questionário escolhido só para o período da pasta; nulo = vale o do aluno. */
  questionarioId?: string | null;
}

/** Peso e observação são opcionais e vão para o registro de peso do aluno (a observação só com o peso). */
export interface FinalizarPastaRequest {
  data: string | null;
  pesoKg: number | null;
  observacao: string | null;
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
  atualizacoesParaRevisar: number;
  atualizacoesAtrasadas: number;
  atualizacoesAvisaramAtraso: number;
  atualizacoesProximas: number;
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
    exercicios: { exercicioUid: string; exercicioId: string | null; nome: string; grupoMuscular?: string | null; series: SerieFeita[] }[];
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

/** Pasta do aluno com plano publicado. `concluidaEm` nulo = ativa; `atual` = a do plano vigente (o do pacote offline). */
export interface PastaDoAluno {
  id: string;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  concluidaEm: string | null;
  atual: boolean;
  temTreino: boolean;
  temDieta: boolean;
  /** Ausente em servidor anterior à mobilidade. */
  temMobilidade?: boolean;
}

/** Treino, dieta e mobilidade publicados de uma pasta; cada um é nulo se a pasta não tem aquele tipo publicado. */
export interface PlanosDaPasta {
  pastaId: string;
  treino: TreinoAtual | null;
  dieta: VersaoDetalhe<ConteudoDieta> | null;
  /** Ausente em servidor anterior à mobilidade. */
  mobilidade?: VersaoDetalhe<ConteudoMobilidadeApi> | null;
}

/** Tudo o que o app guarda para o aluno treinar sem internet. `treino` nulo = sem plano publicado. */
export interface PainelAluno {
  /** Ausente nos pacotes anteriores ao check-in. */
  atualizacao?: Atualizacao | null;
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
export type FaseAtualizacao = 'NENHUMA' | 'AVISO' | 'ABERTA' | 'ATRASADA' | 'ENVIADA' | 'REVISADA';
export type SituacaoAtualizacao = 'PARA_REVISAR' | 'ATRASADAS' | 'AVISARAM_ATRASO' | 'PROXIMAS';
export type RespostaAtualizacao = string | number | boolean | string[] | null | Record<string, number | null>;
export type RespostasAtualizacao = Record<string, RespostaAtualizacao>;
/** Mesmos valores de `TipoPergunta` no Java (`questionarios/TipoPergunta`). */
export type TipoPergunta = 'DATA_AUTOMATICA' | 'PESO' | 'NOTA' | 'TEXTO' | 'TEXTO_LONGO' | 'NOTAS_POR_DIA' | 'FOTOS'
  | 'ESCOLHA_UNICA' | 'MULTIPLA_ESCOLHA' | 'NUMERO' | 'SIM_NAO';
export interface OpcaoPergunta { id: string; rotulo: string }
export interface PerguntaAtualizacao {
  id: string;
  tipo: TipoPergunta;
  rotulo: string;
  obrigatoria: boolean;
  ajuda?: string;
  /** Vai para o resumo do treinador (até 4; só NOTA, NUMERO, SIM_NAO e ESCOLHA_UNICA). */
  destaque?: boolean;
  rotuloCurto?: string;
  ajudaAutomatica?: 'MEDIA_DIAS_TREINO';
  dias?: number[];
  opcoes?: OpcaoPergunta[];
  unidade?: string;
  min?: number;
  max?: number;
  casas?: number;
}
export interface SecaoAtualizacao { uid?: string; titulo: string; perguntas: PerguntaAtualizacao[] }
/** Conteúdo (formato 2) de um questionário: o rascunho e cada versão publicada. */
export interface ConteudoQuestionario { formato?: number; instrucoes: string[]; secoes: SecaoAtualizacao[] }
export interface Atualizacao {
  id: string | null;
  pastaId: string | null;
  alunoId: string;
  nomeAluno: string | null;
  dataAtualizacao: string | null;
  fase: FaseAtualizacao;
  diasParaData: number;
  diasDeAtraso: number;
  atrasoAte: string | null;
  atrasoMotivo: string | null;
  /** Número da versão do questionário em uso (0 sem pasta). */
  questionarioVersaoNumero: number;
  /** Versão do questionário em uso (a fixada no envio, ou a que vale hoje enquanto aberta); nula sem pasta. */
  questionarioVersaoId: string | null;
  questionarioNome: string | null;
  modelo: ConteudoQuestionario | null;
  respostas: RespostasAtualizacao | null;
  enviadaEm: string | null;
  feedback: { texto: string; em: string; editadoEm: string | null; naoLido: boolean; nomeAutor?: string | null } | null;
  versao: number | null;
  resumo: { diasComTreino: number; mediaDiasPorSemana: number | null; pesoAnterior: number | null } | null;
}
/** Item das listas do treinador (`GET /atualizacoes`): sem modelo, respostas nem resumo, que só vêm no detalhe. */
export type AtualizacaoDaLista = Pick<Atualizacao, 'id' | 'pastaId' | 'alunoId' | 'nomeAluno' | 'dataAtualizacao' | 'fase' | 'diasParaData' | 'diasDeAtraso' | 'atrasoAte'>;

/** Gestão dos questionários (`questionarios/dto/QuestionarioDtos`). */
export type OrigemQuestionario = 'VAZIO' | 'FABRICA';
export interface UsoQuestionario { alunos: number; pastas: number; envios: number }
export interface QuestionarioResumo {
  id: string; nome: string; descricao: string | null; padrao: boolean; arquivado: boolean;
  /** 0 = nunca publicado. */
  versaoPublicada: number; publicadoEm: string | null; alteradoDesdePublicacao: boolean;
  rascunhoAlteradoEm: string | null; uso: UsoQuestionario;
}
export interface QuestionarioDetalhe extends QuestionarioResumo {
  /** Trava otimista do rascunho. */
  versao: number; rascunho: ConteudoQuestionario; versoes: { numero: number; publicadoEm: string }[];
}
export interface OpcaoQuestionario { id: string; nome: string; padrao: boolean }
export interface CriarQuestionarioRequest { nome: string; descricao: string | null; origem: OrigemQuestionario }
export interface SalvarQuestionarioRequest { nome: string; descricao: string | null; conteudo: ConteudoQuestionario; versao: number }
export interface ConteudoPastaModelo { planos: { titulo: string; treino: ConteudoTreino | null; dieta: ConteudoDieta | null; mobilidade?: ConteudoMobilidadeApi | null }[] }

export type PeriodicidadeDaConta = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
export type SituacaoComercial = 'TRIAL' | 'ATIVA' | 'INADIMPLENTE' | 'BLOQUEADA' | 'CANCELADA';
export type SituacaoDaCobranca = 'ABERTA' | 'PAGA' | 'CANCELADA' | 'ISENTA';
export interface ContatoDaConta { nome: string | null; email: string | null; telefone: string | null; principal: boolean }
export interface EnderecoDaConta {
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null;
}
export interface CobrancaDaConta {
  id: string; competenciaInicio: string; competenciaFim: string; vencimento: string; valor: number;
  situacao: SituacaoDaCobranca; vencida: boolean; pagoEm: string | null;
}
/** `GET /minha-conta`. `previa` = dados de demonstração das tabelas locais (a Central ainda não está ligada). */
export interface MinhaConta {
  cliente: { nome: string | null; documento: string | null; endereco: EnderecoDaConta | null; contatos: ContatoDaConta[] };
  contratacao: {
    planoNome: string | null; periodicidade: PeriodicidadeDaConta | null; valor: number | null; diaVencimento: number | null;
    inicio: string | null; vigenteAte: string | null; situacaoComercial: SituacaoComercial | null;
    nomeInstancia: string | null; adicionais: { nome: string; quantidade: number }[];
  };
  cobrancas: CobrancaDaConta[];
  previa: boolean;
}
export type EstadoDoConsumo = 'SEM_LIMITE_CONFIGURADO' | 'DISPONIVEL' | 'ATENCAO' | 'ATINGIDO' | 'EXCEDIDO';
export interface ItemDoConsumo {
  codigo: string; nome: string; usado: number; limite: number | null; disponivel: number | null; unidade: string;
  estado: EstadoDoConsumo;
}
/** `GET /minha-conta/consumo`. */
export interface ConsumoDoPlano {
  planoNome: string | null; versaoDireitos: number | null; direitosConfirmadosEm: string | null; consultadoEm: string;
  itens: ItemDoConsumo[];
}

/** Suplemento da biblioteca: só nome, marca, categoria, porção, sabores e link. Sem valor nutricional nem dose. */
export interface SuplementoDaBiblioteca {
  id: string;
  nome: string;
  marca: string | null;
  categoria: string | null;
  porcao: string | null;
  porcoesPorEmbalagem: string | null;
  sabores: string[];
  link: string | null;
}
export type SuplementoDaBibliotecaRequest = Omit<SuplementoDaBiblioteca, 'id'>;

export type CategoriaErgogenico = 'INJETAVEL' | 'ORAL' | 'PEPTIDEO' | 'MEDICAMENTO' | 'OUTRO';

/**
 * Item da biblioteca de medicação e ergogênicos (dado sensível, só com ERGOGENICO_LER): o que está no rótulo.
 * Sem dose, ciclo nem indicação.
 */
export interface ErgogenicoDaBiblioteca {
  id: string;
  categoria: CategoriaErgogenico;
  nome: string;
  principioAtivo: string | null;
  concentracao: string | null;
  apresentacao: string | null;
  observacao: string | null;
}
export type ErgogenicoDaBibliotecaRequest = Omit<ErgogenicoDaBiblioteca, 'id'>;
