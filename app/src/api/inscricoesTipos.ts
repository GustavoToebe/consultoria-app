import type { ConteudoQuestionario, ConviteGerado, Marca, RedeDaConsultoria, RespostasAtualizacao } from './tipos';

/** Espelho dos DTOs de `inscricoes/InscricaoDtos` da API (inscrição por link e CRM de interessados). */
export type SituacaoInscricao = 'NOVA' | 'EM_CONTATO' | 'EM_NEGOCIACAO' | 'ACEITA' | 'RECUSADA' | 'DESISTIU';
/** Etapas abertas do atendimento (as colunas do Kanban); "Em atendimento" é o agrupamento delas. */
export type EtapaAberta = 'NOVA' | 'EM_CONTATO' | 'EM_NEGOCIACAO';
/** Encerramentos sem aluno: pedem motivo. */
export type Encerramento = 'RECUSADA' | 'DESISTIU';
export type PagamentoInscricao = 'NAO_CONTROLADO' | 'AGUARDANDO' | 'CONFIRMADO_MANUAL';
/** Filtro da lista: `ABERTAS` (nova, em contato, em negociação), `TODAS` ou uma situação. */
export type FiltroInscricoes = 'ABERTAS' | 'TODAS' | SituacaoInscricao;

/** Motivo de perda ou desistência (lista fixa). Registros antigos vêm nulos ("Não informado"). */
export type MotivoEncerramento = 'PRECO' | 'SEM_RETORNO' | 'MOMENTO' | 'OUTRO_SERVICO' | 'SERVICO_INCOMPATIVEL' | 'OUTRO';
export type Modalidade = 'ONLINE' | 'PRESENCIAL' | 'HIBRIDO';
export type Periodicidade = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PARCELA_UNICA';
/** Respostas da qualificação do formulário público (todas opcionais). */
export type Interesse = 'TREINO' | 'DIETA' | 'TREINO_E_DIETA' | 'NAO_SEI';
export type ModalidadeDesejada = Modalidade | 'NAO_SEI';
export type PrevisaoInicio = 'AGORA' | 'ESTE_MES' | 'PROXIMO_MES' | 'SO_DE_PASSAGEM' | 'NAO_SEI';
/** "Como conheceu" respondido no formulário. */
export type OrigemInformada = 'INDICACAO' | 'INSTAGRAM' | 'GOOGLE' | 'YOUTUBE' | 'TIKTOK' | 'INFLUENCIADOR' | 'ALUNO_DO_TIME' | 'OUTRA';
/** Origem da equipe (pode corrigir a informada): as mesmas da respondida e campanha (que só vem do link). */
export type Origem = OrigemInformada | 'CAMPANHA';

/**
 * Campos fixos da página "Quero ser aluno" que o treinador pode esconder (D4 de
 * `docs/planos/inscricao-com-perguntas-proprias.md`). Nome, WhatsApp e a ciência do texto nunca se escondem.
 */
export type CampoDaInscricao = 'EMAIL' | 'SEXO' | 'OBJETIVO' | 'INTERESSE' | 'MODALIDADE' | 'PREVISAO_INICIO' | 'ORIGEM';

/** Perguntas do treinador na página pública: só o necessário para responder; `versaoId` volta no envio. */
export interface PerguntasDaInscricao {
  versaoId: string;
  conteudo: ConteudoQuestionario;
}

export interface InscricaoPublica {
  /** A marca e as redes da consultoria (`MarcaComRedes` da API: link https normalizado ou nulo por rede; só nesta página). */
  consultoria: Marca & { redes?: Partial<Record<RedeDaConsultoria, string | null>> | null };
  /** Texto de apresentação e privacidade da consultoria; com texto, a ciência é obrigatória. */
  texto: string | null;
  /** Identifica o texto mostrado; volta no envio para a API conferir que a ciência é do texto atual. */
  textoVersao: string | null;
  aberta: boolean;
  /** Campos fixos visíveis (os que o treinador não escondeu). */
  campos: CampoDaInscricao[];
  /** Perguntas do padrão de inscrição publicado; nulo sem padrão. */
  perguntas: PerguntasDaInscricao | null;
  /** Planos comerciais ativos da consultoria (vazio com o Financeiro desligado ou sem plano: a página fica sem cartões). */
  planos: PlanoDaPagina[];
  /** "Mostrar o preço dos planos" do link; desligada, `valorCentavos` vem nulo em todos. */
  mostrarPrecoDosPlanos: boolean;
}

/** Plano oferecido na página pública: só o necessário para escolher. `valorCentavos` nulo = sem preço na página. */
export interface PlanoDaPagina {
  id: string;
  nome: string;
  periodicidade: Periodicidade;
  valorCentavos: number | null;
}

export interface InscricaoPublicaRequest {
  nome: string;
  whatsapp: string;
  email: string | null;
  /** Campo fixo opcional "Instagram" depois dos de contato: usuário, @usuario ou link do perfil (a API guarda só o usuário; 422 `INSCRICAO_INVALIDA` no campo `instagram` se não for um perfil válido). */
  instagram?: string | null;
  objetivo: string | null;
  sexo?: string | null;
  interesse?: Interesse | null;
  modalidade?: ModalidadeDesejada | null;
  previsaoInicio?: PrevisaoInicio | null;
  origem?: OrigemInformada | null;
  indicadoPor?: string | null;
  /** Parâmetro `?origem=` do link (só `[a-z0-9_-]{1,40}`; outro valor a API ignora). */
  origemLink?: string | null;
  cienciaPrivacidade: boolean;
  /** `textoVersao` da página que a pessoa leu (409 `TEXTO_ALTERADO` se a equipe trocou o texto nesse meio-tempo). */
  textoVersao: string | null;
  turnstileToken?: string;
  /** Código do link de indicação de um aluno (UUID, do fragmento do endereço); a API confere em silêncio e nunca recusa por ele. */
  codigoIndicacao?: string;
  /** `perguntas.versaoId` da página (409 `PERGUNTAS_ALTERADAS` se a consultoria trocou as perguntas); nulo sem perguntas. */
  questionarioVersaoId: string | null;
  respostas: RespostasAtualizacao | null;
  /** Plano escolhido nos cartões (tem de ser um dos `planos` da página: 422 `INSCRICAO_INVALIDA` no campo, senão). Vale mais que o texto de "Outro". */
  planoComercialId?: string | null;
  /** Texto de "Outro" da página completa (até 120; com `planoComercialId` a API o descarta; 422 `INSCRICAO_INVALIDA` no campo acima do limite). */
  planoOutroTexto?: string | null;
}

/** `GET /inscricoes/configuracao` (= `GET /questionarios/{id}/link` do formulário padrão; 404 se não há padrão). */
export interface ConfiguracaoInscricao {
  aberta: boolean;
  /** Nulos até o link ser aberto pela primeira vez. */
  codigo: string | null;
  link: string | null;
  responsavelId: string | null;
  texto: string | null;
  /** Campos fixos escondidos da página. */
  camposOcultos: CampoDaInscricao[];
  /** `linkVersao` do questionário (começa em 0): vai de volta em toda escrita; diferente = 409 `CONFLITO_EDICAO`. */
  versao: number;
  /** Opção do link: o preço dos planos aparece nos cartões da página (padrão desligada; ausente = desligada). */
  mostrarPrecoDosPlanos?: boolean;
}

export interface ConfiguracaoInscricaoRequest {
  aberta: boolean;
  responsavelId: string | null;
  texto: string | null;
  versao: number;
  /** Ausente = a API mantém o gravado. */
  mostrarPrecoDosPlanos?: boolean;
}

/** `GET /inscricoes/links`: todos os links públicos de inscrição (o padrão e os extras, como a Ficha rápida). */
export interface LinkDeInscricao {
  id: string;
  nome: string;
  padrao: boolean;
  aberta: boolean;
  codigo: string | null;
  link: string | null;
  responsavelId: string | null;
  proximoQuestionarioId?: string | null;
  texto: string | null;
  camposOcultos: CampoDaInscricao[];
  versao: number | null;
}

/**
 * Só aviso: aluno com o mesmo e-mail (`alunoId` só para quem vê alunos), outras inscrições em atendimento e anteriores
 * (encerradas ou aceitas) com o mesmo e-mail ou WhatsApp. Nada é juntado sozinho.
 */
export interface DuplicidadeInscricao {
  alunoExistente: boolean;
  alunoId: string | null;
  outrasInscricoesAbertas: number;
  outrasInscricoesAnteriores: number;
}

/** Retorno marcado (próxima ação): data em Brasília (`AAAA-MM-DD`). */
export interface RetornoInscricao {
  id: string;
  descricao: string;
  data: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  concluidoEm: string | null;
  concluidoPorNome: string | null;
  criadoEm: string;
  versao: number;
}

/** Próximo retorno pendente, para a linha e o cartão do Kanban. */
export interface ProximoRetorno {
  id: string;
  data: string;
  descricao: string;
  /** Data antes de hoje (Brasília). */
  atrasado: boolean;
}

/** Retorno pendente de uma inscrição em atendimento (lista "Retornos" da tela). */
export interface RetornoPendente extends RetornoInscricao {
  inscricaoId: string;
  inscricaoNome: string;
  situacao: SituacaoInscricao;
  atrasado: boolean;
}

export interface InscricaoResumo {
  id: string;
  nome: string;
  objetivo: string | null;
  whatsapp: string;
  email: string | null;
  situacao: SituacaoInscricao;
  pagamento: PagamentoInscricao;
  aceitaSemCobranca?: boolean;
  responsavelId: string | null;
  responsavelNome: string | null;
  alunoId: string | null;
  criadaEm: string;
  ultimaAtividadeEm: string;
  ciclo: number;
  origem: Origem | null;
  propostaPlanoNome: string | null;
  proximoRetorno: ProximoRetorno | null;
  indicadoPor?: string | null;
  versao: number;
  duplicidade: DuplicidadeInscricao;
  /** Plano comercial que a pessoa escolheu na página; o nome vem resolvido (nulo se não escolheu ou o plano foi apagado). */
  planoComercialId: string | null;
  planoComercialNome: string | null;
  /** Texto de "Outro" que a pessoa escreveu na página completa (V116); nulo sem ele. */
  planoOutroTexto?: string | null;
}

export interface PaginaInscricoes {
  itens: InscricaoResumo[];
  total: number;
}

/** Filtros da lista e do Kanban (os mesmos nos dois). */
export interface FiltroDaFila {
  situacao: FiltroInscricoes;
  meus: boolean;
  /** Nome, e-mail ou WhatsApp (4 dígitos ou mais). */
  busca?: string;
  /** Ids de membros e/ou `nenhum` (sem responsável). Nunca junto de `meus` (a API recusa). */
  responsavel?: readonly string[];
  /** Origens e/ou `NAO_INFORMADA`. */
  origem?: readonly (Origem | 'NAO_INFORMADA')[];
  /** Entrada (`AAAA-MM-DD`, Brasília, cada ponta opcional). */
  de?: string;
  ate?: string;
  /** Última atividade (`AAAA-MM-DD`, Brasília, cada ponta opcional). */
  atividadeDe?: string;
  atividadeAte?: string;
  pagina: number;
  tamanho?: number;
}

/** Contagens no escopo dos filtros (sem a situação): cada etapa, as abertas e os retornos pendentes. */
export interface ContagensInscricoes {
  porSituacao: Record<SituacaoInscricao, number>;
  abertas: number;
  todas: number;
  retornosAtrasados: number;
  retornosHoje: number;
}

export interface NotaInscricao {
  id: string;
  texto: string;
  autorId: string | null;
  autorNome: string | null;
  criadaEm: string;
}

export type TipoEventoInscricao =
  | 'CRIADA'
  | 'ETAPA'
  | 'RESPONSAVEL'
  | 'PAGAMENTO'
  | 'ENCERRADA'
  | 'REABERTA'
  | 'ACEITA'
  | 'PROPOSTA'
  | 'MENSAGEM_PREPARADA'
  | 'RETORNO_MARCADO'
  | 'RETORNO_ALTERADO'
  | 'RETORNO_CONCLUIDO'
  | 'RELACIONADA'
  | 'RELACAO_DESFEITA'
  | 'ORIGEM';

/**
 * Evento do histórico: quem, quando e o que mudou. `de`/`para` são códigos (situação, pagamento, origem); `motivo` só no
 * encerramento; `detalhe` é texto curto da equipe (motivo da reabertura, detalhe do encerramento) ou um resumo fixo da
 * API (proposta, retorno, nome do modelo de mensagem). Nunca o texto da mensagem.
 */
export interface EventoInscricao {
  id: string;
  tipo: TipoEventoInscricao;
  ciclo: number;
  de: string | null;
  para: string | null;
  motivo: MotivoEncerramento | null;
  detalhe: string | null;
  autorNome: string | null;
  criadoEm: string;
}

/** Proposta negociada: cópia dos termos (mudar o plano no Financeiro não muda a proposta). Valores em centavos. */
export interface PropostaInscricao {
  planoId: string | null;
  planoNome: string | null;
  modalidade: Modalidade | null;
  periodicidade: Periodicidade | null;
  valorReferenciaCentavos: number | null;
  valorCentavos: number | null;
  condicoes: string | null;
  atualizadaEm: string | null;
  atualizadaPorNome: string | null;
}

export interface PropostaRequest {
  /** Plano do Financeiro (só com ele ligado): a API copia nome, periodicidade e valor de referência dele. */
  planoId: string | null;
  planoNome: string | null;
  modalidade: Modalidade | null;
  periodicidade: Periodicidade | null;
  valorReferenciaCentavos: number | null;
  valorCentavos: number | null;
  condicoes: string | null;
  versao: number;
}

/** Plano do Financeiro oferecido como referência na proposta (lista vazia com o Financeiro desligado). */
export interface PlanoDeReferencia {
  id: string;
  nome: string;
  valorCentavos: number;
  periodicidade: Periodicidade;
}

export interface InscricaoDetalhe {
  id: string;
  nome: string;
  whatsapp: string;
  email: string | null;
/** Só o usuário (sem @), já normalizado pela API; entra nas redes do aluno ao aceitar a inscrição. `null` = não informou. */
  instagram: string | null;
  objetivo: string | null;
  observacao: string | null;
  sexo?: string | null;
  interesse: Interesse | null;
  indicadoPor?: string | null;
  /** Nome do aluno que indicou (com `ALUNO_LER`), "Um aluno" sem ela; nulo sem indicação. */
  indicadoPorAluno?: string | null;
  modalidadeDesejada: ModalidadeDesejada | null;
  previsaoInicio: PrevisaoInicio | null;
  origemInformada: OrigemInformada | null;
  origemLink: string | null;
  origem: Origem | null;
  cienciaEm: string | null;
  cienciaTexto: string | null;
  situacao: SituacaoInscricao;
  ciclo: number;
  motivoEncerramento: MotivoEncerramento | null;
  motivoDetalhe: string | null;
  encerradaEm: string | null;
  encerradaPorNome: string | null;
  pagamento: PagamentoInscricao;
  pagamentoConfirmadoPorNome: string | null;
  pagamentoConfirmadoEm: string | null;
  aceitaSemCobranca?: boolean;
  responsavelId: string | null;
  responsavelNome: string | null;
  alunoId: string | null;
  aceitaEm: string | null;
  /** Inscrição anterior que a equipe confirmou ser da mesma pessoa. */
  relacionadaA: { id: string; nome: string; situacao: SituacaoInscricao; criadaEm: string } | null;
  proposta: PropostaInscricao;
  /** Plano comercial que a pessoa escolheu na página (pré-seleciona o "Plano do Financeiro" da proposta). */
  planoComercialId: string | null;
  planoComercialNome: string | null;
  /** Texto de "Outro" que a pessoa escreveu na página completa (V116); nulo sem ele. */
  planoOutroTexto?: string | null;
  criadaEm: string;
  atualizadaEm: string;
  ultimaAtividadeEm: string;
  versao: number;
  duplicidade: DuplicidadeInscricao;
  notas: NotaInscricao[];
  retornos: RetornoInscricao[];
  eventos: EventoInscricao[];
  /**
   * Respostas às perguntas do treinador, com a versão respondida (`modelo`). Nulo sem respostas ou, na inscrição aceita,
   * para quem não lê dado sensível do aluno.
   */
  respostas: RespostasDaInscricao | null;
}

export interface RespostasDaInscricao {
  questionarioVersaoId: string;
  questionarioVersaoNumero: number;
  modelo: ConteudoQuestionario;
  respostas: RespostasAtualizacao;
}

export interface AlterarInscricaoRequest {
  /** Só uma etapa aberta (ou a situação atual, se encerrada ou aceita). */
  situacao: SituacaoInscricao;
  pagamento: PagamentoInscricao;
  responsavelId: string | null;
  versao: number;
}

export interface EncerrarRequest {
  situacao: Encerramento;
  motivo: MotivoEncerramento;
  detalhe: string | null;
  versao: number;
}

export interface RetornoRequest {
  descricao: string;
  data: string;
  responsavelId: string | null;
}

/** Inscrição com o mesmo e-mail ou WhatsApp (outra pessoa pode compartilhar o contato: é só possível). */
export interface InscricaoSemelhante {
  id: string;
  nome: string;
  situacao: SituacaoInscricao;
  criadaEm: string;
  coincide: ('EMAIL' | 'WHATSAPP')[];
  /** Esta inscrição já está relacionada a ela (confirmado pela equipe). */
  relacionada: boolean;
}

export interface Semelhantes {
  inscricoes: InscricaoSemelhante[];
  /** Aluno com o mesmo e-mail (id só para quem vê alunos). */
  aluno: { id: string | null; nome: string | null } | null;
}

export interface ModeloDeMensagem {
  id: string;
  nome: string;
  texto: string;
  ordem: number;
  versao: number;
}

export interface ModeloDeMensagemRequest {
  nome: string;
  texto: string;
  ordem: number;
  versao: number | null;
}

/** O app só prepara a mensagem: copiar ou abrir o WhatsApp não quer dizer que foi enviada. */
export type AcaoDaMensagem = 'COPIADA' | 'WHATSAPP_ABERTO';

/** Indicadores do período (Brasília). `null` = sem dado, nunca zero inventado. */
export interface IndicadoresInscricoes {
  de: string;
  ate: string;
  /** Inscrições criadas no período (as recusadas e desistentes antigas saem pela retenção de 180 dias). */
  entradas: number;
  /** Pessoas diferentes entre as entradas (pelo WhatsApp). */
  pessoas: number;
  aceites: number;
  recusadas: number;
  desistencias: number;
  reaberturas: number;
  /** Inscrições em atendimento com pagamento aguardando confirmação. */
  aguardandoPagamento?: number;
  /** Inscrições no período com pagamento confirmado manualmente. */
  pagaram?: number;
  /** Inscrições aceitas sem cobrança (cortesia) no período. */
  cortesias?: number;
  /** Das entradas do período, quantas já viraram aluno. */
  aceitesDasEntradas: number;
  /** aceitesDasEntradas ÷ entradas, de 0 a 1; nulo sem entradas. */
  conversao: number | null;
  /** Dias da entrada ao aceite, dos aceites do período; nulos sem aceite. */
  diasAteAceite: { mediana: number | null; media: number | null };
  porMotivo: { motivo: MotivoEncerramento | null; quantidade: number }[];
  porOrigem: { origem: Origem | null; entradas: number; aceites: number }[];
}

export interface AceiteInscricao {
  id: string;
  alunoId: string;
  convite: ConviteGerado | null;
  /** Anamnese enviada junto com o aceite; `null` quando nenhuma foi enviada. */
  anamneseId: string | null;
  aceitaSemCobranca?: boolean;
  /** Plano comercial que a pessoa escolheu na página (nome resolvido na hora; nulo se não escolheu). */
  planoComercialId?: string | null;
  planoComercialNome?: string | null;
}
