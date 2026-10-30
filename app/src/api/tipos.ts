/**
 * Tipos dos contratos da API (espelho dos records Java). Mudou um DTO na API, muda aqui junto.
 */

export type Papel = 'TREINADOR' | 'ALUNO';
export type Fonte = 'PADRAO' | 'METAL' | 'ESPORTIVA' | 'CONDENSADA';
export type Tema = 'ESCURO' | 'CLARO';

export interface Marca {
  id: string;
  nome: string;
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

/** Verificação em duas etapas do treinador (`/eu/mfa`). */
export interface MfaStatus { ativo: boolean; configurado: boolean; codigosRestantes: number }
/** O segredo e o link aparecem uma vez: QR code, texto para copiar e link `otpauth://` para abrir no mesmo aparelho. */
export interface MfaPreparacao { segredo: string; expiraEm: string; otpauthUri: string }
export interface MfaAtivacao { codigosDeRecuperacao: string[]; sessao: LoginResponse }

export interface PerfilDaEquipe { id:string; nome:string; acessoTotal:boolean }

export interface EuResponse {
  perfil?: PerfilDaEquipe;
  permissoes?: string[];
  /** Funcionalidades ligadas no plano da consultoria (`MOBILIDADE`, `PDF`, `EQUIPE`); ausente = tudo liberado. */
  funcionalidadesDoPlano?: string[];
  /** Módulo de pagamentos do aluno ao treinador ligado para a consultoria; falso ou ausente = o app esconde tudo dele. */
  pagamentosHabilitados?: boolean;
  /** Módulo de pagamentos E a InfinitePay ligados na consultoria; falso ou ausente = o app esconde o recebimento online. */
  recebimentoOnlineHabilitado?: boolean;
  /** Chaves da plataforma: o "Pagar" aparece no iOS / no Android só com a respectiva ligada (a web sempre tem). Ausente = desligada. */
  pagarNoIos?: boolean;
  pagarNoAndroid?: boolean;
  /** Acompanhamento do ciclo menstrual ligado na plataforma; falso ou ausente = o app esconde tudo dele e não o consulta. */
  cicloHabilitado?: boolean;
  /** "Concluir treino" (retorno ao aluno) ligado na plataforma; falso ou ausente = o app esconde tudo e não consulta nem envia. */
  retornoHabilitado?: boolean;
  usuario: UsuarioResumo;
  marca: Marca;
  aluno?: { id: string; nome: string; sexo?: string | null };
  termosPendentes: boolean;
  termosVersao: string;
}

export interface DocumentoDeTermos {
  id: 'TERMO_USO' | 'AVISO_PRIVACIDADE';
  titulo: string;
  texto: string;
}

/** Termo de uso e aviso de privacidade vigentes; `rascunho` = ainda sem revisão do advogado. */
export interface TermosVigentes {
  versao: string;
  rascunho: boolean;
  aceito: boolean;
  documentos: DocumentoDeTermos[];
}

/** `POST /publico/convites-equipe/consultar`: só a marca da consultoria (nada de quem foi convidado). */
export interface ConviteEquipePublico {
  consultoria: Marca;
}

export interface ConvitePublico {
  consultoria: Marca;
  primeiroNomeAluno: string;
}

/** `GET /publico/configuracao`: com `verificacaoHumana` ligada, entrar, cadastro e "esqueci a senha" pedem o `turnstileToken`. */
export interface ConfiguracaoPublica {
  verificacaoHumana: boolean;
  /** Chave pública do widget (vazia com a verificação desligada). */
  siteKey: string;
  /** Cadastro público de treinador aberto (em produção, fechado: consultoria nova entra pela Central). */
  cadastroAberto: boolean;
}

// ---- Marca e configuração ----

/** Papel fixo de um tipo de série: decide a carga e o esforço padrão no editor e quem dá nome ao "% da WS". */
export type PapelDaSerie = 'AQUECIMENTO' | 'PREPARACAO' | 'TRABALHO' | 'POS_TRABALHO' | 'OUTRO';

/** Modalidades com carga e esforço padrão próprios na metodologia; as outras (e sem modalidade) caem no padrão do tipo. */
export type ModalidadeComPadrao = 'LIVRE' | 'MAQUINA';

export interface FaixaRepeticoes {
  min: number;
  max: number;
}

/** Uma série da regra de percentuais: "85" (`max` nulo) ou "85 a 90", sempre em % da série de trabalho. */
export interface FaixaPercentual {
  min: number;
  max: number | null;
}

/** Carga e esforço sugeridos para exercício `LIVRE` ou `MAQUINA` (cada um pode faltar). Espelho de `PadraoPorModalidade`. */
export interface PadraoPorModalidade {
  carga: Carga | null;
  esforco: Esforco | null;
}

/**
 * Tipo de série da metodologia: `codigo` estável (o que `Serie.tipo` grava; `[A-Z0-9_]`, até 30, único; gerado do nome
 * na criação e imutável), nome livre exibido, papel fixo e os padrões que o editor preenche ao criar a série ou trocar
 * o tipo (repetições, carga, esforço, variação por modalidade e, só em preparação, a regra de % por quantidade de
 * séries). A explicação é o que o aluno lê ao tocar no tipo. Espelho de `ConfiguracaoConsultoria.TipoDeSerie`.
 */
export interface TipoDeSerie {
  codigo: string;
  nome: string;
  papel: PapelDaSerie;
  repeticoes: FaixaRepeticoes | null;
  cargaPadrao: Carga | null;
  esforcoPadrao: Esforco | null;
  porModalidade: Partial<Record<ModalidadeComPadrao, PadraoPorModalidade>> | null;
  /** Só `PREPARACAO`: chave = quantas séries ("1" a "10"); valor = a faixa de cada uma. */
  regraPercentuais: Record<string, FaixaPercentual[]> | null;
  explicacao: string | null;
}

/** Nome exibido, explicação e padrão (parcial) de uma técnica do catálogo. Descritiva leva `padrao` nulo. */
export interface TecnicaDaMetodologia {
  tipo: TipoDeTecnica;
  nome: string;
  explicacao: string | null;
  padrao: Tecnica | null;
}

/** Nome exibido e explicação de uma combinação de exercícios do catálogo (as sete de sempre; a metodologia escolhe quais usa). */
export interface CombinacaoDaMetodologia {
  tipo: TecnicaDeGrupo;
  nome: string;
  explicacao: string | null;
}

/** Metodologia da consultoria (receita `METODOLOGIA` e cópia em `ConteudoTreino.metodologia`). */
export interface Configuracao {
  /** 1 a 20 tipos; ao menos um `TRABALHO` (o primeiro dá nome ao "% da WS"). */
  tipos: TipoDeSerie[];
  /** De zero a dezessete técnicas do catálogo, sem repetir o tipo. */
  tecnicas: TecnicaDaMetodologia[];
  /** De zero a sete combinações do catálogo, sem repetir o tipo. */
  combinacoes: CombinacaoDaMetodologia[];
  arredondamentoKg: number;
  instrucoesTreino: string | null;
  rodapePdf: string | null;
}

export interface ConsultoriaResponse {
  marca: Marca;
  versao: number;
  /** Ciclo de atualização padrão (1 a 365 dias): aluno sem valor próprio usa este; nulo = sem padrão. */
  diasAtualizacaoPadrao: number | null;
  /** Textos opcionais das fases do ciclo. Ausente ou campo vazio = a fase aparece só com o nome. */
  textosFasesCiclo?: TextosDasFases | null;
}

export interface TextosDasFases {
  menstrual: string | null;
  folicular: string | null;
  ovulatoria: string | null;
  lutea: string | null;
}

export interface RegistroDeCicloApi {
  id: string;
  inicio: string;
  fim: string | null;
}

export interface DiaDeCicloApi {
  id: string;
  data: string;
  fluxo: string | null;
  colica: string | null;
  sintomas: string[];
  observacao: string | null;
}

export interface CicloDaAluna {
  disponivel: boolean;
  ativo?: boolean | null;
  consentimentoVersaoAtual?: number | null;
  duracaoHabitual?: number | null;
  mostrarFases?: boolean | null;
  registros?: RegistroDeCicloApi[] | null;
  dias?: DiaDeCicloApi[] | null;
  textosDasFases?: TextosDasFases | null;
}

export interface CicloDoTreinador {
  ativo: boolean;
  duracaoHabitual: number | null;
  mostrarFases: boolean | null;
  registros: RegistroDeCicloApi[];
  dias: DiaDeCicloApi[];
}

// ---- Alunos ----

export type SituacaoFiltro = 'ATIVO' | 'INATIVO' | 'TODOS';

/** Resposta das ações em lote: quantos alunos foram escolhidos e em quantos algo mudou de fato. */
export interface ResultadoLote { selecionados: number; alterados: number }

export interface AlunoResumo {
  id: string;
  nome: string;
  ativo: boolean;
  temAcesso: boolean;
  planoAtivo: { id: string; titulo: string } | null;
  ultimoRegistro: string | null;
  responsavelId?: string | null;
  /** Atualização da pasta vigente; nula sem permissão de ler atualizações ou sem pasta com período. */
  atualizacao?: SituacaoDaAtualizacao | null;
}

/** Mesmos campos de {@link AtualizacaoDaLista} que {@link statusAtualizacaoTreinador} usa, sem o nome do aluno. */
export type SituacaoDaAtualizacao = Omit<AtualizacaoDaLista, 'pastaId' | 'alunoId' | 'nomeAluno'>;

export interface PaginaAlunos {
  itens: AlunoResumo[];
  total: number;
}

/** Rua, bairro, cidade e UF de um CEP (`GET /enderecos/cep/{cep}`, `cep/EnderecoDoCep`); rua e bairro podem vir vazios (CEP geral da cidade). */
export interface EnderecoDoCep { logradouro: string; bairro: string; cidade: string; uf: string }

/** Endereço do aluno (`alunos/dto/AlunoDtos.Endereco`): todos os campos são opcionais; CEP e UF vêm formatados. */
export interface EnderecoDoAluno {
  cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string | null; uf: string | null;
}

/**
 * "Meus dados" do aluno (`GET`/`PUT /aluno/meus-dados`, sempre o aluno da sessão). Nome, e-mail do cadastro e e-mail de
 * acesso são só leitura; `versao` vai de volta no `PUT` (409 `CONFLITO_EDICAO` se o treinador salvou antes). Dado
 * pessoal: nunca em log nem em mensagem de erro, e nada fica no aparelho.
 */
export interface MeusDadosResponse {
  nome: string;
  email: string;
  emailDeAcesso?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  endereco?: EnderecoDoAluno | null;
  /** `MASCULINO`, `FEMININO` ou `OUTRO`. Ausente ou nulo = não informado. */
  sexo?: string | null;
  versao: number;
}

/**
 * Corpo do `PUT /aluno/meus-dados`. Telefone, endereço e sexo SUBSTITUEM (telefone em branco e endereço vazio apagam;
 * sexo nulo = não informado). `cpf` nulo = sem efeito (o aluno só preenche se estava vazio).
 */
export interface MeusDadosRequest {
  telefone: string | null;
  cpf: string | null;
  endereco: EnderecoDoAluno | null;
  sexo: string | null;
  versao: number;
}

export interface AlunoDetalhe {
  id: string;
  nome: string;
  email: string | null;
  /** Do usuário do aluno (só depois que ele cria o acesso); visível com `ALUNO_LER`. */
  telefone?: string | null;
  objetivo?: string | null;
  observacoes?: string | null;
  /** Dados sensíveis (`ALUNO_SENSIVEL_LER`): a API omite sem a permissão. */
  cpf?: string | null;
  endereco?: EnderecoDoAluno | null;
  ativo: boolean;
  temAcesso: boolean;
  conviteExpiraEm: string | null;
  versao: number;
  diasAtualizacao: number | null;
  responsavelId?: string | null;
  /** Questionário de atualização escolhido para o aluno; nulo = vale o padrão. */
  questionarioId?: string | null;
  /** Dados pessoais apagados (LGPD): o cadastro não é mais editado nem reativado. */
  anonimizado: boolean;
  /** E-mail de login do aluno (pode ser outro que o do cadastro); nulo sem acesso ou sem `ALUNO_LER`. */
  emailDeAcesso: string | null;
  /** O treinador definiu uma senha provisória e o aluno ainda não entrou para trocá-la. */
  aguardandoPrimeiroAcesso: boolean;
  /** Quando o aluno autorizou o uso das fotos. Ausente ou nulo = não autorizado. Só com `ALUNO_SENSIVEL_LER`. */
  usoDeImagemAutorizadoEm?: string | null;
  /** `MASCULINO`, `FEMININO` ou `OUTRO`. Ausente ou nulo = não informado. Lê com `ALUNO_LER`. */
  sexo?: string | null;
}

/** Foto já enviada na linha do tempo (`GET /alunos/{id}/fotos` e `GET /aluno/fotos/linha-do-tempo`). */
export interface FotoDaLinha {
  fotoId: string;
  origem: 'ATUALIZACAO' | 'ANAMNESE';
  origemId: string;
  data: string;
  perguntaId: string;
  posicao: string;
  ordem: number;
  pesoKg: number | null;
}

export interface AlunoRequest {
  responsavelId?:string|null;
  nome: string;
  email: string | null;
  /** Só vale com acesso (a API recusa com 409 `ALUNO_SEM_ACESSO`). Ausente/`null` não mexe; texto em branco apaga. */
  telefone?: string | null;
  objetivo?: string | null;
  observacoes?: string | null;
  /** CPF e endereço só seguem com `ALUNO_SENSIVEL_ALTERAR`; sem a permissão a API ignora e preserva o que está salvo. */
  cpf?: string | null;
  endereco?: EnderecoDoAluno | null;
  versao?: number | null;
  /** Dias do ciclo do aluno (1 a 365): sugere o fim do período ao criar uma pasta. */
  diasAtualizacao?: number | null;
  /** `null` apaga. Fora do enum a API responde 422 no campo. */
  sexo?: string | null;
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
  /** Fotos do catálogo de onde veio (`<id>/0.jpg`, no máximo duas); vazio = não veio do catálogo. */
  imagens: string[];
  /** Quando a imagem ou GIF próprio foi enviado; nulo = não tem. Os bytes só pela rota autenticada. */
  imagemPropriaEm: string | null;
}

/** O que o aluno pode mostrar de um exercício do plano dele (só entram os que têm alguma imagem). */
export interface DemonstracaoDoAluno {
  exercicioId: string;
  imagens: string[];
  imagemPropriaEm: string | null;
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
  /** Nulo quando a fonte só publicou a caloria. Ausente não vira zero. */
  proteina: number | null;
  carboidrato: number | null;
  gordura: number | null;
  gramasPorUnidade: number | null;
  fonte: string | null;
  origem: string;
  /** Fator de correção (peso bruto ÷ líquido, 1 a 20) que o treinador digitou; nulo = não informado (nunca 1). */
  fatorCorrecao: number | null;
  /** Fator de cocção (peso pronto ÷ cru, 0,1 a 10) que o treinador digitou; nulo = não informado. */
  fatorCoccao: number | null;
  /** Grupo do alimento ("Carnes e derivados"), texto livre até 60; agrupa a lista de compras. Nulo = sem grupo. */
  grupo: string | null;
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
  /** Caminhos das fotos (`<id>/0.jpg` e `1.jpg`), servidas pelo próprio site em `/catalogo/exercicios/`. */
  imagens: string[];
}

export interface CatalogoAlimento {
  id: string;
  nome: string;
  baseQuantidade: number;
  baseUnidade: string;
  kcal: number;
  /** Nulo quando a fonte só publicou a caloria. Ausente não vira zero. */
  proteina: number | null;
  carboidrato: number | null;
  gordura: number | null;
  fonte: string | null;
  grupo: string | null;
  codigoFonte: string | null;
  /** Nutrientes que a fonte marca como traço (`Tr`); o valor vem 0 e a tela mostra "Tr". */
  tracos: string[];
  /** Fator de correção que a fonte do catálogo publicou; nulo = não informado (nunca 1). */
  fatorCorrecao: number | null;
  /** Fator de cocção que a fonte do catálogo publicou; nulo = não informado. */
  fatorCoccao: number | null;
  /** Citação curta dos fatores; nula quando o item não tem fator. */
  fonteFatores: string | null;
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

export interface ErroDeImportacao { linha: number; campo: string; motivo: string }
export interface ItemDeImportacao {
  id: string; destino: string; nomeArquivo: string; criadoEm: string;
  linhas: number; novos: number; atualizados: number; ignorados: number; comErro: number; situacao: string;
}
export interface PaginaDeImportacao { itens: ItemDeImportacao[]; total: number; pagina: number }
export interface PreviaDeImportacao {
  hash: string; linhas: number; novos: number; atualizados: number; ignorados: number; comErro: number;
  erros: ErroDeImportacao[]; errosAlem: number; amostra: { linha: number; campos: Record<string, string> }[];
}
/** Colunas da aba, o total de linhas de dados e até 5 primeiras linhas (texto de cada célula, para a tela). */
export interface ColunasDaImportacao {
  abas: string[]; aba: number; colunas: string[]; linhas: number; amostra: string[][];
  /** Número de cada linha da amostra no arquivo. */ numerosDasLinhas: number[];
  /** O teto da amostra (1.000 linhas, 20.000 células) cortou o arquivo. */ amostraCortada: boolean;
  /** Pares [posição na amostra, coluna] cujo texto veio cortado em 120 caracteres: não se editam na tela. */ celulasCortadas: number[][];
}
export interface DetalheDeImportacao extends ItemDeImportacao {
  configuracao: Record<string, unknown>; erros: ErroDeImportacao[];
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

// ---- Planos ----

export type TipoSessao = 'TREINO' | 'DESCANSO_ATIVO' | 'DESCANSO' | 'ACESSORIOS';

/**
 * Formas de carga. Percentual é sempre da série de trabalho (WS); 1RM não existe. `CARGA_TRABALHO` é a série de trabalho
 * (a referência do dia). `MESMA_CARGA` = a da última série de trabalho feita antes no exercício. `ACIMA_DA_ANTERIOR` =
 * a série imediatamente anterior mais um percentual (top set). `ABAIXO_DA_REFERENCIA` = a carga registrada hoje na
 * série `referenciaUid`, menos um percentual (back off).
 */
export type ModoDeCarga = 'CARGA_TRABALHO' | 'PERCENTUAL_WS' | 'MESMA_CARGA' | 'ACIMA_DA_ANTERIOR' | 'ABAIXO_DA_REFERENCIA' | 'NENHUMA';

/**
 * Carga da série. `percentualMin`/`percentualMax` formam a faixa de `PERCENTUAL_WS` (1 a 200), `ACIMA_DA_ANTERIOR` (1 a
 * 100) e `ABAIXO_DA_REFERENCIA` (redução de 1 a 50); máximo nulo = valor único. `referenciaUid` só vale em
 * `ABAIXO_DA_REFERENCIA`: uma série anterior do mesmo exercício. Nula (a série inteira) = `NENHUMA`.
 */
export interface Carga {
  modo: ModoDeCarga;
  percentualMin?: number | null;
  percentualMax?: number | null;
  referenciaUid?: string | null;
}

/** Esforço da série: `rir` (0 a 5; 0 = até a falha) ou `rpe` (1 a 10, de meio em meio), nunca os dois. */
export interface Esforco {
  rir?: number | null;
  rpe?: number | null;
}

/** Intervalado de uma série de cardio: `voltas` de `trabalhoSeg` de esforço e `descansoSeg` de descanso. */
export interface IntervalosDeCardio {
  trabalhoSeg: number | null;
  descansoSeg: number | null;
  voltas: number | null;
}

/** Prescrição de uma série de cardio (só em exercício `CARDIO`): ao menos duração, distância ou intervalos. */
export interface Cardio {
  duracaoMin?: number | null;
  distanciaKm?: number | null;
  ritmo?: string | null;
  zona?: number | null;
  intervalos?: IntervalosDeCardio | null;
}

/**
 * Uma série. `tipo` é o CÓDIGO do tipo na metodologia (`WORKING`, `BACK_OFF`...), obrigatório fora do cardio; nunca o
 * nome exibido. `repsMin`/`repsMax` juntos ou nenhum; `amrap` (o máximo de repetições, só quando pedido) exclui as
 * repetições. Em série de cardio (exercício `CARDIO`) só `cardio` vale: `tipo`, `repsMin`, `repsMax`, `carga`, `esforco` e
 * `tecnica` ficam nulos. `alvoExtra`: texto curto do treinador (até 120).
 */
export interface Serie {
  uid: string;
  tipo: string | null;
  repsMin: number | null;
  repsMax: number | null;
  amrap?: boolean | null;
  carga: Carga | null;
  esforco: Esforco | null;
  descansoSegundos: number | null;
  /** Como executar (catálogo de técnicas); nulo = série simples. */
  tecnica?: Tecnica | null;
  cardio?: Cardio | null;
  alvoExtra?: string | null;
}

export type TipoDeTecnica =
  | 'REST_PAUSE'
  | 'CLUSTER'
  | 'DROP_SET'
  | 'MYO_REPS'
  | 'PARTIAL_REPS'
  | 'FORCED_REPS'
  | 'NEGATIVA'
  | 'SUPER_SLOW'
  | 'VINTE_E_UM'
  | 'EMOM'
  | 'PIRAMIDE_CRESCENTE'
  | 'PIRAMIDE_DECRESCENTE'
  | 'PIRAMIDE_TRUNCADA'
  | 'DUPLA_PROGRESSAO'
  | 'GVT'
  | 'FST7'
  | 'ESPECIALIZACAO';

/** Região das repetições parciais. */
export type RegiaoDasParciais = 'ALONGADA' | 'ENCURTADA' | 'LIVRE';

/**
 * Técnica da série. A pausa é em `pausaSegundos` ou `pausaRespiracoes` (ao menos uma no rest pause, cluster e
 * myo-reps). Rest pause: `pausas` (1 a 5, padrão 1), sem repetições prescritas nas retomadas. Cluster: `blocos` de
 * repetições ("4+2" = `[4, 2]`); as repetições da série são a soma. Drop-set: `quedas`, `reducaoPercentual` (nulo = sem
 * fixar), `repsPorQueda` (nulo = até a falha) e `pausaSegundos` entre as quedas (0 = sem pausa). Myo-reps:
 * `miniSeries` (2 a 10) de `repsPorMiniSerie` (1 a 50); a ativação é a própria série. Partial reps: `repsParciais` (1 a
 * 30) na `regiao`. Forced reps: `repsAssistidas` (1 a 5; exige parceiro). As onze descritivas (negativa, super-slow,
 * 21s, EMOM, pirâmides, dupla progressão, GVT, FST-7, especialização) não têm campo próprio: o que não vale fica nulo.
 * O aluno registra a série inteira.
 */
export interface Tecnica {
  tipo: TipoDeTecnica;
  pausaSegundos?: number | null;
  pausaRespiracoes?: number | null;
  pausas?: number | null;
  blocos?: number[] | null;
  quedas?: number | null;
  reducaoPercentual?: number | null;
  repsPorQueda?: number | null;
  miniSeries?: number | null;
  repsPorMiniSerie?: number | null;
  repsParciais?: number | null;
  regiao?: RegiaoDasParciais | null;
  repsAssistidas?: number | null;
  /** Só no Cluster: a carga de cada bloco, na ordem dos `blocos` (nulo = todos com a carga da série). */
  cargasDosBlocos?: CargaDaEtapa[] | null;
  /** Só no Rest-pause: meta e carga de cada retomada, uma por pausa (nulo = mesma carga até a falha). */
  retomadas?: Retomada[] | null;
}

/**
 * Carga de uma etapa (docs/series-etapas.md): `DA_SERIE` segue a carga da série; `PERCENTUAL_WS` é um percentual (1 a 200)
 * da referência externa da série, a mesma para todas as etapas e congelada quando o aluno registra a primeira.
 */
export type ModoDaCargaDaEtapa = 'DA_SERIE' | 'PERCENTUAL_WS';
export interface CargaDaEtapa {
  modo: ModoDaCargaDaEtapa;
  percentual?: number | null;
}

/** Meta de uma retomada do Rest-pause: exata (mínimo = máximo), faixa ou AMRAP, e a carga (obrigatória). */
export interface Retomada {
  repsMin?: number | null;
  repsMax?: number | null;
  amrap?: boolean | null;
  carga: CargaDaEtapa | null;
}

/** Técnicas de grupo de exercícios da sessão. */
export type TecnicaDeGrupo = 'SUPERSET' | 'AGONISTA_ANTAGONISTA' | 'TRI_SET' | 'GIANT_SET' | 'CIRCUITO' | 'PRE_EXAUSTAO' | 'POS_EXAUSTAO';

/**
 * Grupo de exercícios feitos em sequência. Os membros (`ExercicioPlano.grupoUid`) ficam um ao lado do outro na sessão.
 * `descansoAposSegundos` é o descanso depois de cada volta do grupo (não vale em pré/pós-exaustão, onde cada série
 * mantém o próprio descanso); `voltas` só conta no circuito.
 */
export interface Grupo {
  uid: string;
  tecnica: TecnicaDeGrupo;
  descansoAposSegundos: number | null;
  voltas: number | null;
}

export interface ExercicioPlano {
  uid: string;
  exercicioId: string | null;
  nome: string;
  /** `CARDIO` troca a prescrição das séries por `Serie.cardio`. */
  modalidade: string | null;
  videoUrl: string | null;
  observacao: string | null;
  progressao: boolean;
  unidade: 'kg' | 'nenhuma';
  series: Serie[];
  /** Cadência em 4 partes (descida-pausa embaixo-subida-pausa em cima), ex.: "3-1-1-0"; nulo = sem cadência. */
  cadencia?: string | null;
  /** Segundos de isometria ("segure N s", no ponto que a observação disser); nulo = sem isometria. */
  isometriaSegundos?: number | null;
  /** Grupo da sessão a que o exercício pertence (`Sessao.grupos`); nulo = feito sozinho. */
  grupoUid?: string | null;
}

export interface Sessao {
  uid: string;
  nome: string;
  diaSemana: number | null;
  tipo: TipoSessao;
  frequenciaSemanal: number | null;
  observacao: string | null;
  /** Texto livre antigo: fica só como observação existente; a prescrição de cardio é a da série do exercício `CARDIO`. */
  cardio: string | null;
  exercicios: ExercicioPlano[];
  grupos: Grupo[];
}

export interface ConteudoTreino {
  metodologia?: { id: string; nome: string; configuracao: Configuracao } | null;
  objetivo: string | null;
  orientacoes: string | null;
  sessoes: Sessao[];
}

/** Fatores e grupo atuais de um alimento da biblioteca (`GET /alimentos/fatores`), para a prévia da lista de compras. */
export interface FatoresDoAlimento {
  alimentoId: string;
  fatorCorrecao: number | null;
  fatorCoccao: number | null;
  grupo: string | null;
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
  /**
   * Fatores do alimento da biblioteca, copiados pelo servidor ao publicar (só na versão publicada; no rascunho o que
   * houver é ignorado e regravado). Usados só na lista de compras do aluno. Nulo = não informado.
   */
  fatorCorrecao?: number | null;
  fatorCoccao?: number | null;
  /** Grupo do alimento, copiado pelo servidor ao publicar, como os fatores; agrupa a lista de compras. Nulo = sem grupo. */
  grupo?: string | null;
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
  /** Alternativas da refeição: o aluno escolhe uma (o total do dia usa só a primeira). */
  opcoes: OpcaoRefeicao[];
  /**
   * Modo de preparo (receita) que o treinador escreveu: texto livre até 2000 caracteres, com as quebras de linha.
   * Só se mostra; nada é calculado (sem rendimento, porção nem conversão). Nulo ou ausente = não aparece (opcional no
   * tipo para as fixtures que não o têm; `normalizarDieta` sempre o preenche).
   */
  modoDePreparo?: string | null;
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
  /** Água por dia que o treinador escreveu (0,1 a 20 L); nulo não aparece. Nada é calculado. */
  aguaLitros: number | null;
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

/** Pasta que o aluno está usando agora (a do treino ativo, senão a da dieta ativa); nula = nenhuma. */
export interface PastaVigenteResposta {
  pasta: PastaResumo | null;
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

/** Cópia de um plano para outro aluno: sempre rascunho, na pasta indicada ou numa pasta nova. */
export interface CopiaDePlano {
  pastaId: string;
  planoId: string;
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
  alunosSemRegistro: { id: string; nome: string; ultimoRegistro: string | null }[];
  ultimasExecucoes: { aluno: { id: string; nome: string }; data: string; sessao: string; series: number }[];
  planosTerminando: { plano: { id: string; titulo: string }; aluno: { id: string; nome: string }; fim: string }[];
}

/**
 * `GET /numeros`: relatório da consultoria, só contagens (sem nomes). Seis meses, do mais antigo ao mais recente; o último
 * é o mês corrente (`parcial`, "até hoje"). `null` = sem dado (a tela mostra "—"); zero só quando a API manda 0.
 */
export interface MesDeNumeros {
  /** `AAAA-MM`. */
  mes: string;
  parcial: boolean;
  alunosAtivos: number | null;
  atualizacoesNoPrazo: number | null;
  atualizacoesAtrasadas: number | null;
}

export interface NumerosDaConsultoria {
  meses: MesDeNumeros[];
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
  /** Etapas registradas; nulo = registro da série inteira (ou antigo, sem detalhe). Com etapas, total e carga são do servidor. */
  etapas?: EtapaRegistrada[] | null;
  referenciaCarga?: number | null;
  referenciaOrigem?: OrigemDaReferencia | null;
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

// ---- Aluno ----

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

/**
 * Configuração do pacote do aluno. `tipoTrabalho` é só o RÓTULO do tipo de trabalho ("WS") para os textos de % da WS: NUNCA
 * comparar com `Serie.tipo` (que é código); a série de trabalho é a de `carga.modo === 'CARGA_TRABALHO'`.
 */
export interface ConfiguracaoAluno {
  arredondamentoKg: number;
  tipoTrabalho: string;
  /** Falta em pacote salvo antes desta versão. */
  instrucoesTreino?: string | null;
}

/** Mais repetições já feitas com uma carga (recordes pessoais). */
export interface RepeticoesNaCarga {
  carga: number;
  repeticoes: number;
}

/** Os melhores valores de um exercício em séries simples (Engajamento 0.2, `dominio/recordesPessoais`). */
export interface MelhoresDoExercicio {
  maiorCarga: number;
  maiorVolume: number;
  /** Uma linha por carga, em ordem crescente. */
  repeticoesPorCarga: RepeticoesNaCarga[];
}

/**
 * Recordes no pacote: os melhores de antes de `ate` (hoje de Brasília quando o pacote foi gerado; exclusivo), por
 * `exercicioId` da biblioteca. Exercício sem série simples antes de `ate` não aparece.
 */
export interface RecordesDoPacote {
  ate: string;
  exercicios: Record<string, MelhoresDoExercicio>;
}

/** Uma série da última vez (coluna "Anterior", Engajamento 0.3): onde ela fica no exercício e o que foi registrado. */
export interface SerieAnterior {
  /** Código do tipo (`WORKING`...). */
  tipo: string;
  /** Ordem dentro do tipo no exercício (1 = a primeira série daquele tipo). */
  ordem: number;
  carga: number | null;
  repeticoes: number | null;
  /** Etapas (Cluster, Rest-pause); nulo = série registrada inteira. */
  etapas: EtapaRegistrada[] | null;
}

/** A última vez de um exercício: a data e as séries feitas, na ordem do plano. */
export interface AnteriorDoExercicio {
  data: string;
  series: SerieAnterior[];
}

/** A última vez de cada exercício da biblioteca antes de `ate` (hoje de Brasília quando o pacote foi gerado). */
export interface AnterioresDoPacote {
  ate: string;
  exercicios: Record<string, AnteriorDoExercicio>;
}

/** Tudo o que o app guarda para o aluno treinar sem internet. `treino` nulo = sem plano publicado. */
export interface PainelAluno {
  /** Recordes pessoais (P10): ausente com "Concluir treino" desligado (`TREINOS_RETORNO_HABILITADO`). */
  recordes?: RecordesDoPacote;
  /** Coluna "Anterior" (Engajamento 0.3): ausente com "Concluir treino" desligado. */
  anteriores?: AnterioresDoPacote;
  /** Ausente nos pacotes anteriores ao check-in. */
  atualizacao?: Atualizacao | null;
  marca: Marca;
  aluno: { nome: string };
  treino: TreinoAtual | null;
  /** Por `exercicioId` da biblioteca: última carga em série de trabalho. */
  ultimasCargas: Record<string, UltimaCarga>;
  /** `instrucoesTreino` falta em pacote salvo antes desta versão. */
  configuracao: ConfiguracaoAluno;
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

/**
 * Etapa de uma série registrada (bloco do Cluster, etapa inicial ou retomada do Rest-pause), pela posição na versão (1 a
 * N). Etapa ausente = ainda não feita; `NAO_REALIZADA` é explícita e sem números; repetições vazias = não informadas.
 */
export type SituacaoDaEtapa = 'FEITA' | 'NAO_REALIZADA';

export interface EtapaRegistrada {
  posicao: number;
  repeticoes: number | null;
  carga: number | null;
  situacao: SituacaoDaEtapa;
}

/** De onde veio a referência da carga congelada ao registrar a primeira etapa. */
export type OrigemDaReferencia = 'WS_ANTERIOR' | 'BASE_DO_DIA';

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
  /** Obrigatória nas séries com etapas (Cluster, Rest-pause), vazia = nada feito; nula nas outras. */
  etapas: EtapaRegistrada[] | null;
  referenciaCarga: number | null;
  referenciaOrigem: OrigemDaReferencia | null;
}

/** Item da mobilidade marcado (ou desmarcado) no aparelho; o `id` nasce no aparelho e torna o reenvio idempotente. */
export interface RegistroMobilidadeEnvio {
  id: string;
  planoVersaoId: string;
  secaoUid: string;
  itemUid: string;
  data: string;
  feito: boolean;
  alteradoNoAparelhoEm: string;
}

/** O que o servidor devolve de um item: só a marca, sem id nem situação. */
export interface RegistroMobilidadeFeito {
  planoVersaoId: string;
  secaoUid: string;
  itemUid: string;
  data: string;
  feito: boolean;
}

/** Treino concluído (ou reaberto) no aparelho; `id` nasce no aparelho e torna o reenvio idempotente. Reabrir é o mesmo registro com `concluida` falso. */
export interface RegistroSessaoConcluidaEnvio {
  id: string;
  planoVersaoId: string;
  sessaoUid: string;
  data: string;
  concluida: boolean;
  /** Nulo quando `concluida` é falso. */
  resultado: 'COMPLETA' | 'PARCIAL' | null;
  /** Segundos (60 a 21600) ou nulo; sempre nulo quando `concluida` é falso. */
  duracaoSegundos: number | null;
  /** Dado do aluno: nunca em log. */
  comentario: string | null;
  alteradoNoAparelhoEm: string;
}

/** O que o servidor devolve de uma conclusão: sem id nem situação. */
export interface SessaoConcluidaDoServidor {
  /** Id do aparelho (é o que o "Visto" usa); ausente na conclusão que ainda só existe no aparelho. */
  id?: string;
  planoVersaoId: string;
  sessaoUid: string;
  /** Nome da sessão na versão executada (o treinador lê); nulo se a versão não existe mais. */
  sessaoNome?: string | null;
  data: string;
  concluida: boolean;
  resultado: 'COMPLETA' | 'PARCIAL' | null;
  duracaoSegundos: number | null;
  comentario: string | null;
  /** Quando o treinador marcou "Visto" (Engajamento 0.5); nulo = não marcou. */
  vistoEm?: string | null;
}

/** Um recorde batido (a mesma forma de `Recorde` de `dominio/recordesPessoais`). */
export interface RecordeBatido {
  tipo: 'MAIOR_CARGA' | 'MAIS_REPETICOES' | 'MAIOR_VOLUME';
  carga: number;
  repeticoes: number;
  valor: number;
}

/** Uma série com recorde nos últimos 7 dias (Engajamento 0.5). */
export interface SerieComRecorde {
  alunoId: string;
  alunoNome: string;
  data: string;
  exercicioId: string;
  exercicioNome: string;
  recordes: RecordeBatido[];
}

/** "Recordes da semana": período (`de` a `ate`), quantas séries bateram recorde e as mais recentes (até 50). */
export interface RecordesDaSemana {
  de: string;
  ate: string;
  total: number;
  series: SerieComRecorde[];
}

/** `totalConcluidos` = treinos concluídos do aluno em todo o histórico (não só na janela de `sessoes`). */
export interface SessoesConcluidasResponse {
  totalConcluidos: number;
  sessoes: SessaoConcluidaDoServidor[];
}

export type SituacaoEnvio = 'ACEITO' | 'IGNORADO_ANTIGO' | 'RECUSADO';

export interface LoteResponse {
  resultados: { id: string; situacao: SituacaoEnvio; motivo: string | null }[];
}

export interface PastaModelo { id: string; nome: string; versao: number }
export type FaseAtualizacao = 'NENHUMA' | 'AVISO' | 'ABERTA' | 'ATRASADA' | 'ENVIADA' | 'REVISADA';
export type SituacaoAtualizacao = 'PARA_REVISAR' | 'ATRASADAS' | 'AVISARAM_ATRASO' | 'PROXIMAS';
/** NOTAS_POR_DIA = dia → nota; GRADE = linha → coluna; ENDERECO = campo do endereço → texto. */
export type RespostaAtualizacao = string | number | boolean | string[] | null | Record<string, number | null> | Record<string, string>;
export type RespostasAtualizacao = Record<string, RespostaAtualizacao>;
/** Mesmos valores de `TipoPergunta` no Java (`questionarios/TipoPergunta`). */
export type TipoPergunta = 'DATA_AUTOMATICA' | 'PESO' | 'NOTA' | 'TEXTO' | 'TEXTO_LONGO' | 'NOTAS_POR_DIA' | 'FOTOS'
  | 'ESCOLHA_UNICA' | 'MULTIPLA_ESCOLHA' | 'NUMERO' | 'SIM_NAO'
  | 'DATA' | 'TELEFONE' | 'EMAIL' | 'GRADE' | 'ENDERECO' | 'ACEITE' | 'INFORMATIVO';
/** Opção de escolha (com imagem opcional) e também linha/coluna da GRADE (sem imagem). */
export interface OpcaoPergunta { id: string; rotulo: string; imagemId?: string; valorNoCadastro?: string }
/**
 * Condição simples: a pergunta (ou seção) só aparece se a resposta da pergunta `perguntaId` (anterior, de escolha) for um
 * dos `valores` (ids de opção; `sim`/`nao` no SIM_NAO). Escondida não é obrigatória e a resposta dela não é enviada.
 */
export interface CondicaoPergunta { perguntaId: string; valores: string[] }
/**
 * Campo do cadastro que uma pergunta da anamnese alimenta (`questionarios/DestinoNoPerfil`): PESO (pergunta PESO →
 * registro de peso), OBJETIVO e CPF (pergunta TEXTO → objetivo ou CPF do aluno), TELEFONE (pergunta TELEFONE → telefone do
 * usuário do aluno) e ENDERECO (pergunta ENDERECO → os 7 campos do endereço). Nome e e-mail nunca.
 */
export type DestinoNoPerfil = 'PESO' | 'OBJETIVO' | 'CPF' | 'TELEFONE' | 'ENDERECO' | 'SEXO';
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
  /** NUMERO: faixa da resposta. NOTA: ponta de baixo (0 ou 1) e de cima (2 a 10); sem elas, 0 a 10. FOTOS: `max` = fotos aceitas (1 a 6; sem ele, 6). */
  min?: number;
  max?: number;
  casas?: number;
  /** NOTA: texto curto embaixo das pontas da escala ("Nada", "Muito"); até 40 cada. */
  rotuloMin?: string;
  rotuloMax?: string;
  /** Imagem (PNG/JPEG da consultoria), vista pela API com token. */
  imagemId?: string;
  /** DATA: só hoje ou antes. */
  somentePassado?: boolean;
  /** GRADE. */
  linhas?: OpcaoPergunta[];
  colunas?: OpcaoPergunta[];
  /** ACEITE (obrigatório) e INFORMATIVO (opcional). */
  texto?: string;
  /** ACEITE: "Li e concordo...". */
  declaracao?: string;
  mostrarSe?: CondicaoPergunta;
  /** Só na anamnese: campo do cadastro que a resposta alimenta. */
  destino?: DestinoNoPerfil;
  /** PESO com destino: id da pergunta DATA ("só hoje ou antes") com a data da pesagem; sem ela, a data do envio. */
  destinoData?: string;
}
/**
 * `descricao`: texto da seção (até 4000), mostrado embaixo do título, com o mesmo formato simples do texto do INFORMATIVO e do
 * ACEITE (`dominio/textoFormatado`: `**negrito**`, `__sublinhado__`, quebras de linha).
 */
export interface SecaoAtualizacao { uid?: string; titulo: string; descricao?: string; perguntas: PerguntaAtualizacao[]; mostrarSe?: CondicaoPergunta }
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
/**
 * `GET /alunos/{id}/atualizacoes/evolucao`: respostas NOTA e NUMERO das últimas `limite` atualizações enviadas ou
 * revisadas, uma série por id de pergunta (rótulo, unidade e casas da versão mais recente). Sem resposta não é ponto.
 */
export interface PontoDeResposta { atualizacaoId: string; data: string; valor: number }
export interface SerieDeResposta {
  perguntaId: string;
  tipo: 'NOTA' | 'NUMERO';
  rotulo: string;
  rotuloCurto: string | null;
  unidade: string | null;
  casas: number | null;
  /** Do mais antigo ao mais novo. */
  pontos: PontoDeResposta[];
}
export interface EvolucaoRespostas { limite: number; atualizacoes: number; series: SerieDeResposta[] }
/** `GET /aluno/fotos/configuracao`: o que o servidor aceita (os limites também valem lá). */
export interface ConfiguracaoDeFotos { habilitado: boolean; maximoPorPergunta: number; bytesMaximo: number; porDia: number }
/** Item das listas do treinador (`GET /atualizacoes`): sem modelo, respostas nem resumo, que só vêm no detalhe. */
export type AtualizacaoDaLista = Pick<Atualizacao, 'id' | 'pastaId' | 'alunoId' | 'nomeAluno' | 'dataAtualizacao' | 'fase' | 'diasParaData' | 'diasDeAtraso' | 'atrasoAte'>;

/** Gestão dos questionários (`questionarios/dto/QuestionarioDtos`). */
export type OrigemQuestionario = 'VAZIO' | 'FABRICA';
/** Check-in de cada período ou anamnese atribuída ao aluno. */
export type FinalidadeQuestionario = 'ATUALIZACAO' | 'ANAMNESE';
export interface UsoQuestionario { alunos: number; pastas: number; envios: number }
export interface QuestionarioResumo {
  id: string; nome: string; descricao: string | null; finalidade: FinalidadeQuestionario; padrao: boolean; arquivado: boolean;
  /** 0 = nunca publicado. */
  versaoPublicada: number; publicadoEm: string | null; alteradoDesdePublicacao: boolean;
  rascunhoAlteradoEm: string | null; uso: UsoQuestionario;
}
export interface QuestionarioDetalhe extends QuestionarioResumo {
  /** Trava otimista do rascunho. */
  versao: number; rascunho: ConteudoQuestionario; versoes: { numero: number; publicadoEm: string }[];
}
export interface OpcaoQuestionario { id: string; nome: string; padrao: boolean }
export interface CriarQuestionarioRequest { nome: string; descricao: string | null; origem: OrigemQuestionario; finalidade: FinalidadeQuestionario }

/** Anamnese atribuída ao aluno (`anamneses/AnamneseDtos`). A versão do questionário é a da atribuição e nunca muda. */
export type SituacaoAnamnese = 'PENDENTE' | 'ENVIADA' | 'REVISADA' | 'DISPENSADA';
export interface AnamneseResumo {
  id: string; situacao: SituacaoAnamnese; questionarioNome: string; questionarioVersaoNumero: number;
  atribuidaEm: string; enviadaEm: string | null; revisadaEm: string | null; dispensadaEm: string | null;
  dispensaMotivo: string | null; versao: number;
  /** Alterações do cadastro propostas pela anamnese e ainda não aplicadas nem descartadas. */
  alteracoesParaRevisar: number;
}
export type SituacaoAlteracaoDoCadastro = 'PENDENTE' | 'APLICADA' | 'DESCARTADA';
/** Valor de uma alteração do cadastro: `{texto}` no objetivo, CPF e telefone, `{pesoKg, data}` no peso, `{endereco}` no endereço. */
export interface ValorDoCadastro { texto?: string; pesoKg?: number; data?: string; endereco?: EnderecoDoAluno }
/**
 * O que a anamnese fez no cadastro (`AnamneseDtos.AlteracaoDoCadastro`): PENDENTE = o cadastro tinha outro valor
 * (`valorAtual`), APLICADA (`automatica` = campo vazio preenchido no envio) ou DESCARTADA. Só para a equipe.
 */
export interface AlteracaoDoCadastro {
  id: string; destino: DestinoNoPerfil; perguntaId: string; valor: ValorDoCadastro; valorAtual: ValorDoCadastro | null;
  situacao: SituacaoAlteracaoDoCadastro; automatica: boolean; criadaEm: string; resolvidaEm: string | null; resolvidaPorNome: string | null;
}
/** Nas rotas do aluno, nome do questionário, nomes da equipe e motivo vêm nulos. */
export interface AnamneseDetalhe {
  id: string; alunoId: string; nomeAluno: string | null; situacao: SituacaoAnamnese; questionarioVersaoId: string;
  questionarioVersaoNumero: number; questionarioNome: string | null; modelo: ConteudoQuestionario;
  respostas: RespostasAtualizacao; atribuidaEm: string; atribuidaPorNome: string | null; enviadaEm: string | null;
  revisadaEm: string | null; revisadaPorNome: string | null; dispensadaEm: string | null; dispensadaPorNome: string | null;
  dispensaMotivo: string | null; versao: number;
  /** Só para a equipe (nulo nas rotas do aluno). */
  alteracoes: AlteracaoDoCadastro[] | null;
}
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

/**
 * Item da biblioteca de medicação e ergogênicos (dado sensível, só com ERGOGENICO_LER): o que está no rótulo.
 * Sem dose, ciclo nem indicação.
 */
export interface ErgogenicoDaBiblioteca {
  id: string;
  /** Texto livre do treinador (até 60), opcional. */
  categoria: string | null;
  nome: string;
  principioAtivo: string | null;
  concentracao: string | null;
  apresentacao: string | null;
  observacao: string | null;
}
export type ErgogenicoDaBibliotecaRequest = Omit<ErgogenicoDaBiblioteca, 'id'>;
