import { requisicao } from './cliente';
import type { CorpoDaLiberacao } from './liberacaoDePlano';
import type { AniversarianteDoAluno } from './aniversariosTipos';
import type { PedidoDeComparacao } from '../dominio/comparacaoDeFotos';
import type {
  AlterarContratacaoRequest,
  BaixaEmLoteRequest,
  CancelarEmLoteRequest,
  CobrancaAvulsaRequest,
  CobrancaAvulsaResponse,
  CodigoPix,
  FormasDeRecebimento,
  FormasDeRecebimentoRequest,
  CobrancasSelecionadasRequest,
  BaixaManualRequest,
  ContratacaoResponse,
  EncerrarContratacaoRequest,
  ResultadoDoLote,
  ContratarRequest,
  ConferenciasDePagamento,
  FinanceiroDoAluno,
  FiltroDeSituacao,
  TipoDeLancamento,
  LancamentoRequest,
  LancamentoResponse,
  LinkDePagamento,
  MotivoRequest,
  Painel,
  PaginaCobrancas,
  PreviaDoEncerramento,
  ResumoDaSaidaDoAluno,
  PaginaInadimplentes,
  PaginaLancamentos,
  CobrancaResponse,
  PlanoRequest,
  PlanoResponse,
  RecebimentoOnline,
  RecebimentoOnlineRequest,
  Lembretes,
  LembretesDaCobranca,
  LembretesDoAluno,
  LembretesRequest,
  VisaoGeralDoFinanceiro,
} from './financeiroTipos';
import type { PerfilEquipe, PerfilEquipeRequest, PermissaoEquipe, MembroEquipe, ConviteEquipe, ResponsavelEquipe, PaginaAuditoria } from './equipeTipos';
import type {
  AceiteInscricao,
  CampoDaInscricao,
  AcaoDaMensagem,
  AlterarInscricaoRequest,
  ConfiguracaoInscricao,
  ConfiguracaoInscricaoRequest,
  ContagensInscricoes,
  EncerrarRequest,
  EtapaAberta,
  FiltroDaFila,
  IndicadoresInscricoes,
  InscricaoDetalhe,
  InscricaoPublica,
  InscricaoPublicaRequest,
  ModeloDeMensagem,
  ModeloDeMensagemRequest,
  Origem,
  PaginaInscricoes,
  PlanoDeReferencia,
  PropostaRequest,
  RetornoPendente,
  RetornoRequest,
  Semelhantes,
} from './inscricoesTipos';
import type {
  AgendaPessoal, AgendaPessoalRequest, AlunoOcupado, AlvoDoEvento, AvisoDeCompromisso, CancelamentoRequest, Compromisso,
  CompromissoDoAluno, CompromissoRequest, ContagemDaAgenda, CruzamentoDeEvento, CruzamentoRequest, EscopoDaSerie, EventoDetalhe, EventoRequest, FiltroAlunosOcupados,
  FiltroAtualizacoes, FiltroCompromissos, FiltroEventos, FiltroResumo, OcorrenciaDeEvento, ResumoDaAgenda, SituacaoDoAlunoRequest,
} from './agendaTipos';
import type {
  Atualizacao,
  AtualizacaoDaLista, PaginaDeAtualizacoes,
  AtividadeRecente,
  EvolucaoRespostas,
  ConfiguracaoDeFotos,
  FotoDaLinha,
  ConfiguracaoPublica,
  CriarQuestionarioRequest,
  AnamneseDetalhe,
  AnamneseResumo,
  FinalidadeQuestionario,
  OpcaoQuestionario,
  ResultadoLote,
  QuestionarioDetalhe,
  QuestionarioResumo,
  SalvarQuestionarioRequest,
  RespostasAtualizacao,
  SituacaoAtualizacao,
  Alimento,
  AlimentoRequest,
  FatoresDoAlimento,
  AlunoDetalhe,
  EmailDeAcessoAlterado,
  AlunoRequest,
  MeusDadosRequest,
  MeusDadosResponse,
  CatalogoAlimento,
  CatalogoExercicio,
  PaginaCatalogo,
  PaginaDeExercicios,
  ConsumoDoPlano,
  ConsultoriaResponse,
  ConteudoDieta,
  ConteudoMobilidadeApi,
  ConviteGerado,
  ConvitePublico,
  ConviteEquipePublico,
  DiaDeTreino,
  EuResponse,
  TermosPublicos,
  TermosVigentes,
  Exercicio,
  ExercicioRequest,
  Fonte,
  ImportacaoResultado,
  LoginResponse,
  MfaAtivacao,
  MfaPreparacao,
  MfaStatus,
  LoteResponse,
  Marca,
  MinhaConta,
  NumerosDaConsultoria,
  PaginaAlunos,
  PainelAluno,
  PastaDoAluno,
  PlanosDaPasta,
  PainelTreinador,
  CopiaDePlano,
  PlanoDetalhe,
  DadosLesao,
  Lesao,
  PastaResumo,
  PastaVigenteResposta,
  CopiarPastaRequest,
  CopiarPastaResposta,
  PesoSugeridoDaPasta,
  PublicarPastaRequest,
  PublicarPastaResposta,
  PlanoResumo,
  AmostraDaPlanilha,
  AnaliseDaPlanilha,
  ColunasDaImportacao,
  ReconhecimentoDoArquivo,
  DiagnosticoDoArquivo,
  ConfirmacaoDaPlanilha,
  ImportacaoDesfeita,
  PreviaDaPlanilha,
  DetalheDeImportacao,
  PaginaDeImportacao,
  PreviaDeImportacao,
  ProgressoPonto,
  Receita,
  AguaRegistrada,
  RegistroAguaEnvio,
  RegistroEnvio,
  RegistroMobilidadeEnvio,
  RegistroMobilidadeFeito,
  RegistroSessaoConcluidaEnvio,
  RegistroPeso,
  ResultadoValidacao,
  SessoesConcluidasResponse,
  RecordesDaSemana,
  ChaveDaTroca,
  TrocasDeExercicio,
  TrocasPendentes,
  SituacaoFiltro,
  SuplementoDaBiblioteca,
  SuplementoDaBibliotecaRequest,
  ErgogenicoDaBiblioteca,
  ErgogenicoDaBibliotecaRequest,
  EnderecoDoCep,
  DemonstracaoDoAluno,
  Tema,
  TipoPlano,
  TipoReceita,
  VersaoDetalhe,
  PreferenciasDePush,
  RegrasDeAtencaoResposta,
  RegrasDoAlunoResposta,
  SalvarRegraDoAluno,
  SalvarRegrasDeAtencao,
  PrescricaoDaAtualizacao,
} from './tipos';

/**
 * Valor dinâmico num segmento do caminho (ids vindos do endereço da tela): codificado, para um "../" no endereço não
 * virar outra rota da API com o token de quem abriu o link.
 */
const seg = (valor: string | number) => encodeURIComponent(String(valor));

/** Rua, bairro, cidade e UF de um CEP de 8 dígitos (a API consulta o serviço de CEP; 404 `CEP_NAO_ENCONTRADO`, 503 se fora do ar). */
export const buscarCep = (cep: string) => requisicao<EnderecoDoCep>('/enderecos/cep/consultar', { metodo: 'POST', corpo: { cep } });

export const perfisEquipe = () => requisicao<PerfilEquipe[]>('/perfis');
export const catalogoPermissoes = () => requisicao<PermissaoEquipe[]>('/permissoes/catalogo');
export const criarPerfilEquipe = (corpo:PerfilEquipeRequest) => requisicao<PerfilEquipe>('/perfis',{metodo:'POST',corpo});
export const alterarPerfilEquipe = (id:string,corpo:PerfilEquipeRequest) => requisicao<PerfilEquipe>(`/perfis/${seg(id)}`,{metodo:'PUT',corpo});
export const duplicarPerfilEquipe = (id:string) => requisicao<PerfilEquipe>(`/perfis/${seg(id)}/duplicar`,{metodo:'POST'});
export const excluirPerfilEquipe = (id:string) => requisicao<void>(`/perfis/${seg(id)}`,{metodo:'DELETE'});
export const membrosEquipe = () => requisicao<MembroEquipe[]>('/usuarios');
export const pessoasAuditoria = () => requisicao<ResponsavelEquipe[]>('/auditoria/pessoas');
export const convidarMembro = (corpo:{nome:string;email:string;perfilId:string}) => requisicao<ConviteEquipe>('/usuarios/convites',{metodo:'POST',corpo});
export const cancelarConviteEquipe = (id:string) => requisicao<void>(`/usuarios/convites/${seg(id)}`,{metodo:'DELETE'});
export const alterarMembro = (id:string,corpo:{nome:string;perfilId:string;ativo:boolean}) => requisicao<MembroEquipe>(`/usuarios/${seg(id)}`,{metodo:'PUT',corpo});
/** Só o Administrador (204). `limite` vai sempre no corpo: `null` apaga, `{}` daria 422 (D22). */
export const definirLimiteDeAlunos = (id:string,limite:number|null) => requisicao<void>(`/usuarios/${seg(id)}/limite-de-alunos`,{metodo:'PUT',corpo:{limite}});
/** Marca da consultoria do convite de equipe; o código vai só no corpo. Código inválido, vencido ou aceito = 404 igual. */
export const consultarConviteEquipe = (codigo:string) => requisicao<ConviteEquipePublico>('/publico/convites-equipe/consultar',{metodo:'POST',corpo:{codigo},semRenovar:true});
export const aceitarConviteEquipe = (codigo:string,senha:string) => requisicao<LoginResponse>('/publico/convites-equipe/aceitar',{metodo:'POST',corpo:{codigo,senha},semRenovar:true});
/** "Esqueci a senha": a API responde 202 exista a conta ou não. `turnstileToken` (uso único) só quando a verificação humana está ligada. */
export const pedirRedefinicaoDeSenha = (email:string,turnstileToken?:string) => requisicao<void>('/auth/esqueci-senha',{metodo:'POST',corpo:turnstileToken?{email,turnstileToken}:{email},semRenovar:true});
/** Com o token do link do e-mail; não abre sessão. Com MFA ativo a API pede `codigoMfa` (401 `MFA_NECESSARIO`). */
export const redefinirSenha = (token:string,novaSenha:string,codigoMfa?:string) => requisicao<void>('/auth/redefinir-senha',{metodo:'POST',corpo:{token,novaSenha,codigoMfa},semRenovar:true});
export const responsaveisEquipe = () => requisicao<ResponsavelEquipe[]>('/responsaveis');
export const alterarMeuPerfil = (nome:string,telefone:string|null) => requisicao<EuResponse>('/eu',{metodo:'PUT',corpo:{nome,telefone}});
/** Pessoas (`usuarioId`, ids e/ou `sistema`), ações (`acao`, até 100) e ações excluídas (`acaoExceto`, até 50) vão repetidas; o resto, uma vez. */
export const listarAuditoria = (filtro:{de?:string;ate?:string;usuarioId?:readonly string[];acao?:readonly string[];acaoExceto?:readonly string[];pagina:number}) => {
  const q=new URLSearchParams();
  for (const [campo,valor] of Object.entries(filtro)) {
    if (Array.isArray(valor)) valor.forEach((v:string)=>q.append(campo,v));
    else if (valor!==undefined&&valor!=='') q.set(campo,String(valor));
  }
  return requisicao<PaginaAuditoria>(`/auditoria?${q.toString()}`);
};

// ---- Atualizações ----
export const atualizacaoAluno = () => requisicao<Atualizacao>('/aluno/atualizacao');
export const atualizacoesAluno = () => requisicao<Atualizacao[]>('/aluno/atualizacoes');
export const detalheAtualizacaoAluno = (id: string) => requisicao<Atualizacao>(`/aluno/atualizacoes/${seg(id)}`);
/** A API confere o id da versão respondida: se o treinador publicou outra no meio, responde 409. */
export const enviarAtualizacao = (pastaId: string, questionarioVersaoId: string, respostas: RespostasAtualizacao) =>
  requisicao<Atualizacao>('/aluno/atualizacao/enviar', { metodo: 'POST', corpo: { pastaId, questionarioVersaoId, respostas } });
// Questionários de atualização (gestão pelo treinador; a API autoriza pelo banco).
/** `arquivados`: só os ativos (`false`), só os arquivados (`true`) ou os dois juntos (`'todos'`). */
export const listarQuestionarios = (arquivados: boolean | 'todos' = false, finalidade: FinalidadeQuestionario = 'ATUALIZACAO') =>
  requisicao<QuestionarioResumo[]>(`/questionarios?arquivados=${arquivados}&finalidade=${finalidade}`);
export const opcoesDeQuestionario = (finalidade: FinalidadeQuestionario = 'ATUALIZACAO') =>
  requisicao<OpcaoQuestionario[]>(`/questionarios/opcoes?finalidade=${finalidade}`);
/** Imagem de pergunta ou opção: FormData com `arquivo` (PNG ou JPEG; a API regrava sem metadados). */
export const enviarImagemDeQuestionario = (arquivo: FormData) =>
  requisicao<{ id: string }>('/questionarios/imagens', { metodo: 'POST', corpoBruto: arquivo, limiteMs: 60000 });
/** Equipe (quem lê questionários, anamneses ou atualizações). */
export const baixarImagemDeQuestionario = (id: string) =>
  requisicao<Blob>(`/questionarios/imagens/${seg(id)}`, { binario: true, limiteMs: 30000 });
/** Aluno: só as imagens do que ele responde. */
export const baixarImagemDoAluno = (id: string) =>
  requisicao<Blob>(`/aluno/questionarios/imagens/${seg(id)}`, { binario: true, limiteMs: 30000 });
// ---- Anamnese ----
export const anamnesesDoAluno = (alunoId: string) => requisicao<AnamneseResumo[]>(`/alunos/${seg(alunoId)}/anamneses`);
export const atribuirAnamnese = (alunoId: string, questionarioId: string) =>
  requisicao<AnamneseDetalhe>(`/alunos/${seg(alunoId)}/anamneses`, { metodo: 'POST', corpo: { questionarioId } });
export const detalheAnamnese = (id: string) => requisicao<AnamneseDetalhe>(`/anamneses/${seg(id)}`);
export const dispensarAnamnese = (id: string, motivo: string, versao: number) =>
  requisicao<AnamneseDetalhe>(`/anamneses/${seg(id)}/dispensar`, { metodo: 'POST', corpo: { motivo, versao } });
export const revisarAnamnese = (id: string, versao: number) =>
  requisicao<AnamneseDetalhe>(`/anamneses/${seg(id)}/revisar`, { metodo: 'POST', corpo: { versao } });
/** Alteração do cadastro proposta pela anamnese: aplicar ou descartar (ANAMNESE_ALTERAR + a permissão do campo). */
export const aplicarAlteracaoDaAnamnese = (id: string, alteracaoId: string) =>
  requisicao<AnamneseDetalhe>(`/anamneses/${seg(id)}/alteracoes/${seg(alteracaoId)}/aplicar`, { metodo: 'POST' });
export const descartarAlteracaoDaAnamnese = (id: string, alteracaoId: string) =>
  requisicao<AnamneseDetalhe>(`/anamneses/${seg(id)}/alteracoes/${seg(alteracaoId)}/descartar`, { metodo: 'POST' });
export const baixarFotoDaAnamnese = (anamneseId: string, fotoId: string) =>
  requisicao<Blob>(`/anamneses/${seg(anamneseId)}/fotos/${seg(fotoId)}`, { binario: true, limiteMs: 60000 });
/** A pendente ou a última enviada; 404 = nenhuma. */
export const anamneseDoAlunoLogado = () => requisicao<AnamneseDetalhe>('/aluno/anamnese');
export const enviarAnamnese = (id: string, questionarioVersaoId: string, respostas: RespostasAtualizacao) =>
  requisicao<AnamneseDetalhe>(`/aluno/anamnese/${seg(id)}/enviar`, { metodo: 'POST', corpo: { questionarioVersaoId, respostas } });
export const criarQuestionario = (corpo: CriarQuestionarioRequest) => requisicao<QuestionarioDetalhe>('/questionarios', { metodo: 'POST', corpo });
export const buscarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${seg(id)}`);
export const salvarQuestionario = (id: string, corpo: SalvarQuestionarioRequest) => requisicao<QuestionarioDetalhe>(`/questionarios/${seg(id)}`, { metodo: 'PUT', corpo });
export const publicarQuestionario = (id: string, versao: number, confirmarAvisos: boolean) =>
  requisicao<QuestionarioDetalhe>(`/questionarios/${seg(id)}/publicar`, { metodo: 'POST', corpo: { versao, confirmarAvisos } });
export const duplicarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${seg(id)}/duplicar`, { metodo: 'POST' });
export const definirQuestionarioPadrao = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${seg(id)}/padrao`, { metodo: 'POST' });
export const arquivarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${seg(id)}/arquivar`, { metodo: 'POST' });
export const desarquivarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${seg(id)}/desarquivar`, { metodo: 'POST' });
export const excluirQuestionario = (id: string) => requisicao<void>(`/questionarios/${seg(id)}`, { metodo: 'DELETE' });
/** `null` volta ao padrão (aluno) ou ao questionário do aluno (pasta). */
export const escolherQuestionarioDoAluno = (alunoId: string, questionarioId: string | null) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(alunoId)}/questionario`, { metodo: 'PUT', corpo: { questionarioId } });
export const escolherQuestionarioDaPasta = (pastaId: string, questionarioId: string | null) =>
  requisicao<PastaResumo>(`/pastas/${seg(pastaId)}/questionario`, { metodo: 'PUT', corpo: { questionarioId } });
export const avisarAtrasoAtualizacao = (pastaId: string, novaData: string, motivo?: string) =>
  requisicao<Atualizacao>('/aluno/atualizacao/atraso', { metodo: 'POST', corpo: { pastaId, novaData, motivo } });
export const marcarFeedbackVisto = (id: string) =>
  requisicao<void>(`/aluno/atualizacoes/${seg(id)}/feedback-visto`, { metodo: 'POST' });
/**
 * `responsavel` (um membro da equipe) e `meus` juntos dão 400 `FILTRO_INVALIDO`, então com `responsavel` o `meus` não vai;
 * `de`/`ate` vão só em par (até 366 dias).
 */
/** Filtros comuns da lista e das contagens de atualizações (responsáveis repetidos; a API recusa `meus` com `responsavel`). */
function filtroDeAtualizacoes(meus: boolean, filtro: FiltroAtualizacoes, inicio: Record<string, string> = {}): URLSearchParams {
  const q = new URLSearchParams(inicio);
  const responsaveis = typeof filtro.responsavel === 'string' ? [filtro.responsavel] : [...(filtro.responsavel ?? [])];
  if (responsaveis.length) responsaveis.forEach((r) => q.append('responsavel', r));
  else q.set('meus', String(meus));
  if (filtro.busca?.trim()) q.set('busca', filtro.busca.trim());
  if (filtro.de && filtro.ate) {
    q.set('de', filtro.de);
    q.set('ate', filtro.ate);
  }
  if (filtro.comAtencao) q.set('comAtencao', 'true');
  return q;
}
export const listarAtualizacoes = (situacao: SituacaoAtualizacao, meus = false, filtro: FiltroAtualizacoes = {}) => {
  const q = filtroDeAtualizacoes(meus, filtro, { situacao });
  return requisicao<AtualizacaoDaLista[]>(`/atualizacoes?${q.toString()}`);
};
export const TAMANHO_DA_PAGINA_DE_ATUALIZACOES = 30;
/** Uma página da lista (`GET /atualizacoes/pagina`): na ordem da tela (mais antiga primeiro), com o total da situação e dos filtros. */
export const listarAtualizacoesPagina = (situacao: SituacaoAtualizacao, pagina: number, meus = false, filtro: FiltroAtualizacoes = {}) => {
  const q = filtroDeAtualizacoes(meus, filtro, { situacao, pagina: String(pagina), tamanho: String(TAMANHO_DA_PAGINA_DE_ATUALIZACOES) });
  return requisicao<PaginaDeAtualizacoes>(`/atualizacoes/pagina?${q.toString()}`);
};
/** Quantas há em cada situação (o número das abas) com os mesmos filtros da lista. */
export const contagensAtualizacoes = (meus = false, filtro: FiltroAtualizacoes = {}) =>
  requisicao<Record<SituacaoAtualizacao, number>>(`/atualizacoes/contagens?${filtroDeAtualizacoes(meus, filtro).toString()}`);
export const atualizacoesDoAluno = (id: string) => requisicao<Atualizacao[]>(`/alunos/${seg(id)}/atualizacoes`);
export const atualizacaoDoAluno = (id: string) => requisicao<Atualizacao>(`/alunos/${seg(id)}/atualizacao`);
export const evolucaoRespostasDoAluno = (id: string) =>
  requisicao<EvolucaoRespostas>(`/alunos/${seg(id)}/atualizacoes/evolucao`);
/** Últimos acontecimentos do aluno (Resumo da ficha); o servidor corta o limite em 1 a 20 e confere a permissão de cada tipo. */
export const atividadeRecenteDoAluno = (id: string, limite = 5) =>
  requisicao<AtividadeRecente>(`/alunos/${seg(id)}/atividade-recente?limite=${limite}`);

// ---- Regras de atenção do treinador (só com `regrasAtencaoHabilitada`; desligada, 503; `docs/planos/regras-de-atencao.md`) ----

/** As regras, a versão da lista, o teto e as perguntas que a tela oferece (`ATUALIZACAO_LER`). */
export const obterRegrasDeAtencao = () => requisicao<RegrasDeAtencaoResposta>('/regras-de-atencao');
/** Lote atômico (C1, `REGRA_ATENCAO_ALTERAR`): monte o corpo com `corpoDoLote` de `dominio/regrasDeAtencao`. */
export const salvarRegrasDeAtencao = (corpo: SalvarRegrasDeAtencao) =>
  requisicao<RegrasDeAtencaoResposta>('/regras-de-atencao', { metodo: 'PUT', corpo });
/** Preferência da conta do membro (C7): o aviso no celular quando a atualização de um aluno tem pontos de atenção. */
export const obterPreferenciasDePush = () => requisicao<PreferenciasDePush>('/eu/preferencias-de-push');
export const salvarPreferenciasDePush = (corpo: PreferenciasDePush) =>
  requisicao<PreferenciasDePush>('/eu/preferencias-de-push', { metodo: 'PUT', corpo });
/** Token do aparelho do membro da equipe (C7; o do aluno é `/aluno/push-token`): só no corpo, idempotente. */
export const registrarPushTokenDoTreinador = (token: string, plataforma: 'ANDROID' | 'IOS') =>
  requisicao<void>('/eu/push-token', { metodo: 'PUT', corpo: { token, plataforma } });
/** Apaga o token informado; sem token o servidor apaga todos os do usuário (os outros aparelhos também). */
export const removerPushTokenDoTreinador = (token?: string) =>
  requisicao<void>('/eu/push-token', token ? { metodo: 'DELETE', corpo: { token } } : { metodo: 'DELETE' });
/** Etapa 2 (C8): as regras ligadas e a exceção do aluno em cada uma. */
export const obterRegrasDeAtencaoDoAluno = (alunoId: string) =>
  requisicao<RegrasDoAlunoResposta>(`/alunos/${seg(alunoId)}/regras-de-atencao`);
/** Etapa 2: outro número ou desligada só para este aluno (vale a partir do próximo envio). */
export const salvarRegraDeAtencaoDoAluno = (alunoId: string, regraId: string, corpo: SalvarRegraDoAluno) =>
  requisicao<RegrasDoAlunoResposta>(`/alunos/${seg(alunoId)}/regras-de-atencao/${seg(regraId)}`, { metodo: 'PUT', corpo });
/** Etapa 2: volta à regra geral (apaga a exceção). */
export const voltarRegraDeAtencaoDoAlunoAGeral = (alunoId: string, regraId: string) =>
  requisicao<void>(`/alunos/${seg(alunoId)}/regras-de-atencao/${seg(regraId)}`, { metodo: 'DELETE' });

// ---- Fotos da atualização (bytes só pela API, com token; nada de link direto para o bucket) ----

export const configuracaoDeFotos = () => requisicao<ConfiguracaoDeFotos>('/aluno/fotos/configuracao');

/** `arquivo`: FormData com o campo `arquivo` (JPEG já sem EXIF); `pastaId` vai junto. */
/** Destino da foto pendente: a pasta (atualização) ou a anamnese. */
export type DestinoDaFoto = { pastaId: string } | { anamneseId: string };
export const enviarFoto = (destino: DestinoDaFoto, arquivo: FormData) =>
  requisicao<{ id: string }>(`/aluno/fotos?${'pastaId' in destino ? `pastaId=${encodeURIComponent(destino.pastaId)}` : `anamneseId=${encodeURIComponent(destino.anamneseId)}`}`,
    { metodo: 'POST', corpoBruto: arquivo, limiteMs: 60000 });

export const removerFoto = (id: string) => requisicao<void>(`/aluno/fotos/${seg(id)}`, { metodo: 'DELETE' });

export const baixarFotoDoAluno = (id: string) => requisicao<Blob>(`/aluno/fotos/${seg(id)}`, { binario: true, limiteMs: 60000 });

// ---- Foto de perfil do aluno (opcional; bytes só pela API, com token) ----

/** `arquivo`: FormData com o campo `arquivo` (JPEG já reduzido e sem EXIF). Troca a foto atual, se houver. */
export const trocarFotoDePerfil = (arquivo: FormData) =>
  requisicao<{ atualizadaEm: string }>('/aluno/foto-perfil', { metodo: 'PUT', corpoBruto: arquivo, limiteMs: 60000 });

export const removerFotoDePerfil = () => requisicao<void>('/aluno/foto-perfil', { metodo: 'DELETE' });

export const meusDados = () => requisicao<MeusDadosResponse>('/aluno/meus-dados');
export const salvarMeusDados = (corpo: MeusDadosRequest) =>
  requisicao<MeusDadosResponse>('/aluno/meus-dados', { metodo: 'PUT', corpo });

export const cicloDaAluna = () => requisicao<import('./tipos').CicloDaAluna>('/aluno/ciclo');
export const ativarCiclo = (consentimentoVersao: number, duracaoHabitual: number | null) =>
  requisicao<import('./tipos').CicloDaAluna>('/aluno/ciclo/ativar', { metodo: 'POST', corpo: { consentimentoVersao, duracaoHabitual } });
export const desativarCiclo = () => requisicao<import('./tipos').CicloDaAluna>('/aluno/ciclo/desativar', { metodo: 'POST' });
export const configurarCiclo = (duracaoHabitual: number | null, mostrarFases: boolean) =>
  requisicao<import('./tipos').CicloDaAluna>('/aluno/ciclo/configuracao', { metodo: 'PUT', corpo: { duracaoHabitual, mostrarFases } });
export const gravarRegistroDeCiclo = (id: string, inicio: string, fim: string | null) =>
  requisicao<import('./tipos').RegistroDeCicloApi>('/aluno/ciclo/registros', { metodo: 'POST', corpo: { id, inicio, fim } });
export const alterarRegistroDeCiclo = (id: string, inicio: string, fim: string | null) =>
  requisicao<import('./tipos').RegistroDeCicloApi>(`/aluno/ciclo/registros/${seg(id)}`, { metodo: 'PUT', corpo: { id, inicio, fim } });
export const apagarRegistroDeCiclo = (id: string) => requisicao<void>(`/aluno/ciclo/registros/${seg(id)}`, { metodo: 'DELETE' });
export const apagarCiclo = () => requisicao<void>('/aluno/ciclo', { metodo: 'DELETE' });
export const gravarDiaDeCiclo = (data: string, corpo: { id: string; fluxo: string | null; colica: string | null; sintomas: string[]; observacao: string | null }) =>
  requisicao<import('./tipos').DiaDeCicloApi>(`/aluno/ciclo/dias/${seg(data)}`, { metodo: 'PUT', corpo });
export const apagarDiaDeCiclo = (data: string) => requisicao<void>(`/aluno/ciclo/dias/${seg(data)}`, { metodo: 'DELETE' });
export const cicloDoAluno = (alunoId: string) => requisicao<import('./tipos').CicloDoTreinador>(`/alunos/${seg(alunoId)}/ciclo`);

/** 404 = sem foto. */
export const baixarFotoDePerfil = () => requisicao<Blob>('/aluno/foto-perfil', { binario: true, limiteMs: 30000 });

/** Equipe (ALUNO_LER); 404 = sem foto. */
export const baixarFotoDePerfilDoAluno = (alunoId: string) =>
  requisicao<Blob>(`/alunos/${seg(alunoId)}/foto-perfil`, { binario: true, limiteMs: 30000 });

/** Equipe (ALUNO_ALTERAR): troca a foto de perfil do aluno. `arquivo`: FormData com `arquivo` (JPEG já reduzido e sem EXIF). */
export const trocarFotoDePerfilDoAluno = (alunoId: string, arquivo: FormData) =>
  requisicao<{ atualizadaEm: string }>(`/alunos/${seg(alunoId)}/foto-perfil`, { metodo: 'PUT', corpoBruto: arquivo, limiteMs: 60000 });

/** Equipe (ALUNO_ALTERAR): apaga a foto de perfil do aluno (204, mesmo sem foto). */
export const removerFotoDePerfilDoAluno = (alunoId: string) =>
  requisicao<void>(`/alunos/${seg(alunoId)}/foto-perfil`, { metodo: 'DELETE' });

export const baixarFotoDoTreinador = (atualizacaoId: string, fotoId: string) =>
  requisicao<Blob>(`/atualizacoes/${seg(atualizacaoId)}/fotos/${seg(fotoId)}`, { binario: true, limiteMs: 60000 });

export const fotosDoAluno = (id: string) => requisicao<FotoDaLinha[]>(`/alunos/${seg(id)}/fotos`);
export const linhaDoTempoDeFotos = () => requisicao<FotoDaLinha[]>('/aluno/fotos/linha-do-tempo');
/** Link de inscrição com a indicação do próprio aluno (código no fragmento). 404 sem link aberto. Nunca em log. */
export const linkDeIndicacao = () => requisicao<{ link: string }>('/aluno/indicacao');
export const usoDeImagem = () =>requisicao<{ autorizadoEm: string | null }>('/aluno/uso-de-imagem');
export const definirUsoDeImagem = (autorizado: boolean) =>
  requisicao<{ autorizadoEm: string | null }>('/aluno/uso-de-imagem', { metodo: 'PUT', corpo: { autorizado } });
export const gerarComparacao = (alunoId: string, pedido: PedidoDeComparacao) =>
  requisicao<Blob>(`/alunos/${seg(alunoId)}/fotos/comparacao`, { metodo: 'POST', corpo: pedido, binario: true, limiteMs: 60000 });
export const detalheAtualizacao = (id: string) => requisicao<Atualizacao>(`/atualizacoes/${seg(id)}`);
export const responderAtualizacao = (id: string, texto: string, versao: number) =>
  requisicao<Atualizacao>(`/atualizacoes/${seg(id)}/feedback`, { metodo: 'PUT', corpo: { texto, versao } });

/** Uma função por rota da API. As telas não montam URL nem método. */

// ---- Sessão ----

/**
 * `turnstileToken`: token de uso único do widget, só quando a verificação humana está ligada (vale no 1º envio e no do MFA).
 * `novaSenha`: só no passo "Crie sua senha" (a `senha` é a provisória que o treinador passou).
 */
export const entrar = (email: string, senha: string, codigoMfa?: string, turnstileToken?: string, novaSenha?: string) =>
  requisicao<LoginResponse>('/auth/login', {
    metodo: 'POST',
    corpo: {
      email, senha, ...(codigoMfa ? { codigoMfa } : {}), ...(turnstileToken ? { turnstileToken } : {}),
      ...(novaSenha ? { novaSenha } : {}),
    },
    semRenovar: true,
  });

// ---- Verificação em duas etapas (treinador) ----

export const mfaStatus = () => requisicao<MfaStatus>('/eu/mfa');
export const mfaPreparar = (senha: string) =>
  requisicao<MfaPreparacao>('/eu/mfa/preparar', { metodo: 'POST', corpo: { senha } });
export const mfaAtivar = (senha: string, codigo: string) =>
  requisicao<MfaAtivacao>('/eu/mfa/ativar', { metodo: 'POST', corpo: { senha, codigo } });
export const mfaDesativar = (senha: string, codigo: string) =>
  requisicao<LoginResponse>('/eu/mfa/desativar', { metodo: 'POST', corpo: { senha, codigo } });

export const sairDaApi = (refreshToken: string | null) =>
  requisicao<void>('/auth/logout', {
    metodo: 'POST',
    corpo: refreshToken ? { refreshToken } : undefined,
    semRenovar: true,
  });

export const cadastrarTreinador = (dados: { nomeConsultoria: string; nome: string; email: string; senha: string; turnstileToken?: string }) =>
  requisicao<LoginResponse>('/auth/cadastro-treinador', { metodo: 'POST', corpo: dados, semRenovar: true });

export const eu = () => requisicao<EuResponse>('/eu');

export const termos = () => requisicao<TermosVigentes>('/termos');

/** Página pública de Privacidade e de Termos de uso (sem login); o texto é sempre o da API. */
export const termosPublicos = () => requisicao<TermosPublicos>('/publico/termos', { semRenovar: true });

export const aceitarTermos = (versao: string) =>
  requisicao<TermosVigentes>('/termos/aceite', { metodo: 'POST', corpo: { versao } });

export const trocarSenha = (senhaAtual: string, senhaNova: string) =>
  requisicao<LoginResponse>('/eu/senha', { metodo: 'PUT', corpo: { senhaAtual, senhaNova } });

// ---- Push do Expo (aviso de compromisso no celular) ----

/** Registra o token deste aparelho (idempotente). O valor do token nunca vai a log. */
export const registrarPushToken = (token: string, plataforma: 'ANDROID' | 'IOS') =>
  requisicao<void>('/aluno/push-token', { metodo: 'PUT', corpo: { token, plataforma } });
/** Apaga o token informado. Sem token (o aparelho não o devolveu), o servidor apaga todos os do próprio usuário da sessão. */
export const removerPushToken = (token?: string) =>
  requisicao<void>('/aluno/push-token', token ? { metodo: 'DELETE', corpo: { token } } : { metodo: 'DELETE' });

/** "Excluir minha conta" do aluno: 204 e a sessão deixa de valer no servidor (a do aparelho sai pelo `encerrarLocal`). */
export const excluirMinhaConta = (senha: string, confirmacao: string) =>
  requisicao<void>('/aluno/conta/excluir', { metodo: 'POST', corpo: { senha, confirmacao } });

// ---- Configuração pública ----

/** O que o app precisa saber antes do login (verificação humana e a chave pública do widget). `semCache` na busca de conferência. */
export const configuracaoPublica = (semCache = false) =>
  // Conferência forçada: além de `cache: 'no-store'` (o fetch do celular pode ignorar), um parâmetro novo fura o `max-age` da resposta.
  requisicao<ConfiguracaoPublica>(semCache ? `/publico/configuracao?r=${Date.now()}` : '/publico/configuracao', {
    semRenovar: true,
    semCache,
  });

// ---- Convite (público) ----

/** O código vai só no corpo (no caminho ficaria em log de acesso e no histórico). */
export const consultarConvite = (codigo: string) =>
  requisicao<ConvitePublico>('/publico/convites/consultar', { metodo: 'POST', corpo: { codigo }, semRenovar: true });

export const aceitarConvite = (codigo: string, email: string, senha: string) =>
  requisicao<LoginResponse>('/publico/convites/aceitar', {
    metodo: 'POST',
    corpo: { codigo, email, senha },
    semRenovar: true,
  });

// ---- Inscrição pelo link (pública) ----

/** O código é o do link que a consultoria divulga (não é segredo de uso único): vai no caminho, sempre por `seg()`. */
export const inscricaoPublica = (codigo: string) =>
  requisicao<InscricaoPublica>(`/publico/inscricoes/${seg(codigo)}`, { semRenovar: true });

export const enviarInscricao = (codigo: string, corpo: InscricaoPublicaRequest) =>
  requisicao<{ mensagem: string; proximoQuestionarioCodigo?: string | null }>(`/publico/inscricoes/${seg(codigo)}`, { metodo: 'POST', corpo, semRenovar: true });

// ---- Treinador: interessados (fila de inscrições) ----

// Link do formulário de inscrição PADRÃO (os mesmos de `/questionarios/{id}/link*`, que a API resolve pelo padrão; 404 sem
// padrão). Toda escrita leva a `versao` lida (`linkVersao`, começa em 0): outra pessoa ou aba mudou antes = 409 `CONFLITO_EDICAO`.
export const configuracaoInscricao = () => requisicao<ConfiguracaoInscricao>('/inscricoes/configuracao');

export const alterarConfiguracaoInscricao = (corpo: ConfiguracaoInscricaoRequest) =>
  requisicao<ConfiguracaoInscricao>('/inscricoes/configuracao', { metodo: 'PUT', corpo });

/** Campos fixos escondidos da página pública (lista inteira; vazia = todos visíveis). */
export const esconderCamposDaInscricao = (camposOcultos: CampoDaInscricao[], versao: number) =>
  requisicao<ConfiguracaoInscricao>('/inscricoes/configuracao/campos-ocultos', { metodo: 'PUT', corpo: { camposOcultos, versao } });

/** Troca o código: o link anterior para de valer na hora. */
export const novoLinkInscricao = (versao: number) =>
  requisicao<ConfiguracaoInscricao>('/inscricoes/configuracao/novo-link', { metodo: 'POST', corpo: { versao } });

/** Parâmetros comuns da lista, das contagens e do Kanban (busca, responsáveis, origens e os dois períodos). */
function filtroDaFila(filtro: Omit<FiltroDaFila, 'situacao' | 'pagina'>): URLSearchParams {
  const q = new URLSearchParams();
  q.set('meus', String(filtro.meus));
  if (filtro.busca?.trim()) q.set('busca', filtro.busca.trim());
  if (!filtro.meus) filtro.responsavel?.forEach((r) => q.append('responsavel', r));
  filtro.origem?.forEach((o) => q.append('origem', o));
  for (const chave of ['de', 'ate', 'atividadeDe', 'atividadeAte'] as const) {
    const valor = filtro[chave];
    if (valor) q.set(chave, valor);
  }
  return q;
}

export const listarInscricoes = (filtro: FiltroDaFila) => {
  const q = filtroDaFila(filtro);
  q.set('situacao', filtro.situacao);
  q.set('pagina', String(filtro.pagina));
  if (filtro.tamanho) q.set('tamanho', String(filtro.tamanho));
  return requisicao<PaginaInscricoes>(`/inscricoes?${q.toString()}`);
};

/** Quantas há em cada situação com os mesmos filtros da lista (sem a situação) e os retornos pendentes. */
export const contagensInscricoes = (filtro: Omit<FiltroDaFila, 'situacao' | 'pagina'>) =>
  requisicao<ContagensInscricoes>(`/inscricoes/contagens?${filtroDaFila(filtro).toString()}`);

/** Retornos pendentes das inscrições em atendimento, do mais antigo ao mais novo. */
export const retornosPendentes = (meus: boolean) => requisicao<RetornoPendente[]>(`/inscricoes/retornos?meus=${meus}`);

/** Indicadores do período (`AAAA-MM-DD`, Brasília, até 366 dias). */
export const indicadoresInscricoes = (de: string, ate: string) =>
  requisicao<IndicadoresInscricoes>(`/inscricoes/indicadores?de=${seg(de)}&ate=${seg(ate)}`);

/** Planos do Financeiro para a proposta; vazio com o Financeiro desligado. */
export const planosDeReferencia = () => requisicao<PlanoDeReferencia[]>('/inscricoes/planos-de-referencia');

export const modelosDeMensagem = () => requisicao<ModeloDeMensagem[]>('/inscricoes/modelos-de-mensagem');

export const criarModeloDeMensagem = (corpo: ModeloDeMensagemRequest) =>
  requisicao<ModeloDeMensagem>('/inscricoes/modelos-de-mensagem', { metodo: 'POST', corpo });

export const alterarModeloDeMensagem = (id: string, corpo: ModeloDeMensagemRequest) =>
  requisicao<ModeloDeMensagem>(`/inscricoes/modelos-de-mensagem/${seg(id)}`, { metodo: 'PUT', corpo });

export const excluirModeloDeMensagem = (id: string, versao: number) =>
  requisicao<void>(`/inscricoes/modelos-de-mensagem/${seg(id)}?versao=${seg(versao)}`, { metodo: 'DELETE' });

export const inscricao = (id: string) => requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}`);

export const alterarInscricao = (id: string, corpo: AlterarInscricaoRequest) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}`, { metodo: 'PUT', corpo });

export const notaNaInscricao = (id: string, texto: string) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/notas`, { metodo: 'POST', corpo: { texto } });

/** Só entre as etapas abertas (Kanban e "Mover para"). */
export const etapaDaInscricao = (id: string, situacao: EtapaAberta, versao: number) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/etapa`, { metodo: 'PUT', corpo: { situacao, versao } });

/** Recusar ou "desistiu", sempre com motivo. */
export const encerrarInscricao = (id: string, corpo: EncerrarRequest) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/encerrar`, { metodo: 'POST', corpo });

/** Volta ao atendimento um encerramento (novo ciclo; o anterior fica no histórico). */
export const reabrirInscricao = (id: string, motivo: string, versao: number) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/reabrir`, { metodo: 'POST', corpo: { motivo, versao } });

export const propostaDaInscricao = (id: string, corpo: PropostaRequest) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/proposta`, { metodo: 'PUT', corpo });

export const origemDaInscricao = (id: string, origem: Origem | null, versao: number) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/origem`, { metodo: 'PUT', corpo: { origem, versao } });

export const marcarRetorno = (id: string, corpo: RetornoRequest) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/retornos`, { metodo: 'POST', corpo });

export const alterarRetorno = (retornoId: string, corpo: RetornoRequest & { versao: number }) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/retornos/${seg(retornoId)}`, { metodo: 'PUT', corpo });

export const concluirRetorno = (retornoId: string, versao: number) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/retornos/${seg(retornoId)}/concluir`, { metodo: 'POST', corpo: { versao } });

export const inscricoesSemelhantes = (id: string) => requisicao<Semelhantes>(`/inscricoes/${seg(id)}/semelhantes`);

/** A equipe confirma que esta inscrição é da mesma pessoa de outra (anterior). Nada é juntado nem apagado. */
export const relacionarInscricao = (id: string, outraId: string, versao: number) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/relacao`, { metodo: 'PUT', corpo: { outraId, versao } });

export const desfazerRelacaoDaInscricao = (id: string, versao: number) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/relacao?versao=${seg(versao)}`, { metodo: 'DELETE' });

/** Registra que a mensagem foi preparada (copiada ou WhatsApp aberto); nunca "enviada". O texto não vai à API. */
export const mensagemPreparada = (id: string, modeloId: string | null, acao: AcaoDaMensagem) =>
  requisicao<void>(`/inscricoes/${seg(id)}/mensagens`, { metodo: 'POST', corpo: { modeloId, acao } });

/**
 * Cria o aluno; com `convidar`, o convite de acesso vem na resposta (o código só aparece aqui). Com
 * `anamneseQuestionarioId`, a API atribui essa anamnese ao aluno na mesma operação; o campo vai sempre no corpo
 * (`null` = não enviar).
 */
export const aceitarInscricao = (id: string, dados: { convidar: boolean; anamneseQuestionarioId: string | null; versao: number }) =>
  requisicao<AceiteInscricao>(`/inscricoes/${seg(id)}/aceitar`, {
    metodo: 'POST',
    corpo: { convidar: dados.convidar, anamneseQuestionarioId: dados.anamneseQuestionarioId, versao: dados.versao },
  });

// ---- Treinador: agenda presencial (AGENDA_LER / AGENDA_ALTERAR) ----

/** Compromissos que tocam os dias `de`..`ate` (Brasília, até 62 dias). */
export const listarCompromissos = (filtro: FiltroCompromissos) => {
  const q = new URLSearchParams({ de: filtro.de, ate: filtro.ate });
  if (filtro.responsavel) q.set('responsavel', filtro.responsavel);
  for (const s of filtro.situacoes ?? []) q.append('situacao', s);
  return requisicao<Compromisso[]>(`/agenda/compromissos?${q.toString()}`);
};
/** `?escopo=` só quando não é `ESTA` (o padrão da API); compromisso avulso aceita só `ESTA`. */
const comEscopo = (caminho: string, escopo?: EscopoDaSerie) => (escopo && escopo !== 'ESTA' ? `${caminho}?escopo=${escopo}` : caminho);

/** Marca o compromisso (com `repeticao`, a série inteira; responde com a primeira ocorrência). */
export const criarCompromisso = (corpo: CompromissoRequest) =>
  requisicao<Compromisso>('/agenda/compromissos', { metodo: 'POST', corpo });
/** Remarca: `alunoIds` troca a lista inteira; `repeticao` não vale aqui (400). */
export const alterarCompromisso = (id: string, corpo: CompromissoRequest, escopo?: EscopoDaSerie) =>
  requisicao<Compromisso>(comEscopo(`/agenda/compromissos/${seg(id)}`, escopo), { metodo: 'PUT', corpo });
/** Cancela o compromisso inteiro (`cancelado: true`) ou o reabre (`false`). */
export const alterarCancelamentoCompromisso = (id: string, corpo: CancelamentoRequest, escopo?: EscopoDaSerie) =>
  requisicao<Compromisso>(comEscopo(`/agenda/compromissos/${seg(id)}/situacao`, escopo), { metodo: 'POST', corpo });
/** A situação de um aluno no compromisso (realizado e falta só em `ESTA`, depois do início). */
export const alterarSituacaoDoAluno = (id: string, alunoId: string, corpo: SituacaoDoAlunoRequest, escopo?: EscopoDaSerie) =>
  requisicao<Compromisso>(comEscopo(`/agenda/compromissos/${seg(id)}/alunos/${seg(alunoId)}/situacao`, escopo), { metodo: 'POST', corpo });
/** Quais alunos já têm outro compromisso que sobrepõe o horário (só aviso). */
export const listarAlunosOcupados = (filtro: FiltroAlunosOcupados) => {
  const q = new URLSearchParams({ data: filtro.data, hora: filtro.hora, duracaoMinutos: String(filtro.duracaoMinutos) });
  for (const id of filtro.alunoIds) q.append('alunoIds', id);
  if (filtro.ignorar) q.set('ignorar', filtro.ignorar);
  return requisicao<AlunoOcupado[]>(`/agenda/compromissos/alunos-ocupados?${q.toString()}`);
};

// ---- Treinador: calendário (agendas pessoais e eventos sem aluno; AGENDA_LER / AGENDA_ALTERAR) ----

/** As minhas agendas pessoais, em ordem alfabética. */
export const listarAgendasPessoais = () => requisicao<AgendaPessoal[]>('/agenda/agendas');
export const criarAgendaPessoal = (corpo: AgendaPessoalRequest) =>
  requisicao<AgendaPessoal>('/agenda/agendas', { metodo: 'POST', corpo });
/** Renomeia ou recolore: `versao` é a da agenda lida (409 `CONFLITO_EDICAO`). */
export const alterarAgendaPessoal = (id: string, corpo: AgendaPessoalRequest) =>
  requisicao<AgendaPessoal>(`/agenda/agendas/${seg(id)}`, { metodo: 'PUT', corpo });
/** Quantos eventos a agenda tem: o número da confirmação de apagar. */
export const contarEventosDaAgenda = (id: string) => requisicao<ContagemDaAgenda>(`/agenda/agendas/${seg(id)}/contagem`);
/** Apaga a agenda e os eventos dela. */
export const apagarAgendaPessoal = (id: string, versao: number) =>
  requisicao<void>(`/agenda/agendas/${seg(id)}?versao=${versao}`, { metodo: 'DELETE' });

/** Ocorrências já expandidas dos meus eventos que tocam `de`..`ate` (até 62 dias). Sem `agendas`, todas as minhas. */
export const listarEventos = (filtro: FiltroEventos) => {
  const q = new URLSearchParams({ de: filtro.de, ate: filtro.ate });
  for (const id of filtro.agendas ?? []) q.append('agendas', id);
  return requisicao<OcorrenciaDeEvento[]>(`/agenda/eventos?${q.toString()}`);
};
/** O evento (a regra) e a ocorrência `ocorrencia` (`dataOriginal`, AAAA-MM-DD); sem ela, a primeira. */
export const detalheDoEvento = (id: string, ocorrencia?: string | null) =>
  requisicao<EventoDetalhe>(`/agenda/eventos/${seg(id)}${ocorrencia ? `?ocorrencia=${encodeURIComponent(ocorrencia)}` : ''}`);
export const criarEvento = (corpo: EventoRequest) => requisicao<EventoDetalhe>('/agenda/eventos', { metodo: 'POST', corpo });
/** Só leitura (POST por causa do corpo): o evento que está sendo montado cruza outro meu em até um ano? Nunca grava. */
export const cruzamentosDoEvento = (corpo: CruzamentoRequest) =>
  requisicao<CruzamentoDeEvento>('/agenda/eventos/cruzamentos', { metodo: 'POST', corpo });
/** `escopo` e `ocorrencia` só em série; num evento avulso vale só `ESTA` (o padrão da API, que não vai na rota). */
const comAlvo = (caminho: string, alvo: AlvoDoEvento, extra: URLSearchParams = new URLSearchParams()) => {
  if (alvo.escopo && alvo.escopo !== 'ESTA') extra.set('escopo', alvo.escopo);
  if (alvo.ocorrencia) extra.set('ocorrencia', alvo.ocorrencia);
  const texto = extra.toString();
  return texto ? `${caminho}?${texto}` : caminho;
};
export const alterarEvento = (id: string, corpo: EventoRequest, alvo: AlvoDoEvento = {}) =>
  requisicao<EventoDetalhe>(comAlvo(`/agenda/eventos/${seg(id)}`, alvo), { metodo: 'PUT', corpo });
export const excluirEvento = (id: string, versao: number, alvo: AlvoDoEvento = {}) =>
  requisicao<void>(comAlvo(`/agenda/eventos/${seg(id)}`, alvo, new URLSearchParams({ versao: String(versao) })), { metodo: 'DELETE' });

/** Contagem por dia de compromissos e eventos (sem texto), até 366 dias: o Ano. */
export const resumoDaAgenda = (filtro: FiltroResumo) => {
  const q = new URLSearchParams({ de: filtro.de, ate: filtro.ate });
  if (filtro.responsavel) q.set('responsavel', filtro.responsavel);
  for (const s of filtro.situacoes ?? []) q.append('situacao', s);
  for (const id of filtro.agendas ?? []) q.append('agendas', id);
  return requisicao<ResumoDaAgenda>(`/agenda/resumo?${q.toString()}`);
};

// ---- Treinador: marca e configuração ----

export const consultoria = () => requisicao<ConsultoriaResponse>('/consultoria');

export const alterarMarca = (dados: {
  nome: string;
  corPrimaria: string;
  fonteTitulo: Fonte;
  temaPadrao: Tema;
  versao: number;
  diasAtualizacaoPadrao: number | null;
  textosFasesCiclo?: import('./tipos').TextosDasFases | null;
  /** Ausente mantém a gravada. */
  metaDoPeso?: import('./tipos').MetaDoPeso;
  /** Contato: na API, nulo ou ausente mantém o gravado, em branco apaga e preenchido valida e grava (cada campo sozinho). A tela manda os três em todo PUT. */
  whatsapp: string;
  emailRemetenteNome: string;
  emailResponderPara: string;
  /** Redes sociais: nulo ou ausente mantém, em branco apaga, preenchido valida (`@usuario` ou link; 422 `MARCA_INVALIDA` por campo) e grava o link https. */
  redesSociais?: Partial<Record<import('./tipos').RedeDaConsultoria, string>>;
}) => requisicao<ConsultoriaResponse>('/consultoria/marca', { metodo: 'PUT', corpo: dados });

/** `arquivo`: FormData já montado (web: File; nativo: objeto com bytes(), `anexarArquivoDoAparelho`). */
export const enviarLogo = (arquivo: FormData) =>
  requisicao<Marca>('/consultoria/marca/logo', { metodo: 'PUT', corpoBruto: arquivo });

export const removerLogo = () => requisicao<Marca>('/consultoria/marca/logo', { metodo: 'DELETE' });

/** Grava modelo e sobrescritas dos PDFs; `versao` é a da consultoria lida (409 `CONFLITO_EDICAO` se outra pessoa gravou antes). */
export const alterarDocumentosPdf = (dados: {
  modelo: import('../dominio/configuracaoPdf').ModeloPdf;
  opcoes: import('../dominio/configuracaoPdf').OpcoesPdf;
  versao: number;
}) => requisicao<ConsultoriaResponse>('/consultoria/documentos-pdf', { metodo: 'PUT', corpo: dados });

// ---- Treinador: início ----

export const painelTreinador = (meus=false, diasSemRegistro=7) => requisicao<PainelTreinador>(`/painel?meus=${meus}&dias=${diasSemRegistro}`);

/** Relatório da consultoria (`PAINEL_VER`): contagens dos últimos 6 meses, sem nomes. */
export const numerosDaConsultoria = () => requisicao<NumerosDaConsultoria>('/numeros');

// ---- Treinador: alunos ----

/**
 * `filtros`: os filtros avançados já montados por `dominio/filtrosDeAlunos.pedidoDaApi` (situação, meus ou responsável,
 * acesso, atualização, plano, pasta e registro; repetidos quando são várias opções). Sem eles, situação e meus simples.
 */
export const listarAlunos = (filtro: { busca?: string; situacao?: SituacaoFiltro; pagina?: number; tamanho?: number; meus?:boolean; filtros?: readonly [string, string][] }) => {
  const q = new URLSearchParams();
  if (filtro.busca) q.set('busca', filtro.busca);
  if (filtro.filtros) {
    for (const [chave, valor] of filtro.filtros) q.append(chave, valor);
  } else {
    q.set('situacao', filtro.situacao ?? 'ATIVO');
    q.set('meus', String(filtro.meus ?? false));
  }
  q.set('pagina', String(filtro.pagina ?? 0));
  // Sem `tamanho` vale o padrão da API (30).
  if (filtro.tamanho) q.set('tamanho', String(filtro.tamanho));
  return requisicao<PaginaAlunos>(`/alunos?${q.toString()}`);
};

export const criarAluno = (dados: AlunoRequest) => requisicao<AlunoDetalhe>('/alunos', { metodo: 'POST', corpo: dados });

export const aluno = (id: string) => requisicao<AlunoDetalhe>(`/alunos/${seg(id)}`);

export const alterarAluno = (id: string, dados: AlunoRequest) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}`, { metodo: 'PUT', corpo: dados });

export const alterarSituacaoAluno = (id: string, ativo: boolean) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/situacao`, { metodo: 'PATCH', corpo: { ativo } });

/**
 * Ações em lote da lista de alunos: `alterados` deixa de fora quem já estava como pedido. O desativar pula quem tem contrato
 * fechado vigente (vai em `recusados`) e aplica nos outros; erro da requisição = nada mudou.
 */
export const trocarResponsavelEmLote = (alunoIds: string[], responsavelId: string) =>
  requisicao<ResultadoLote>('/alunos/lote/responsavel', { metodo: 'POST', corpo: { alunoIds, responsavelId } });

export const trocarQuestionarioEmLote = (alunoIds: string[], questionarioId: string | null) =>
  requisicao<ResultadoLote>('/alunos/lote/questionario', { metodo: 'POST', corpo: { alunoIds, questionarioId } });

export const desativarEmLote = (alunoIds: string[]) =>
  requisicao<ResultadoLote>('/alunos/lote/desativar', { metodo: 'POST', corpo: { alunoIds } });

/** Tudo o que a consultoria guarda do aluno; o app só grava o arquivo, sem interpretar. */
export const exportarAluno = (id: string) => requisicao<Record<string, unknown>>(`/alunos/${seg(id)}/exportacao`);

export const anonimizarAluno = (id: string, nomeConfirmado: string) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/anonimizar`, { metodo: 'POST', corpo: { nomeConfirmado } });

export const gerarConvite = (id: string) => requisicao<ConviteGerado>(`/alunos/${seg(id)}/convite`, { metodo: 'POST' });

/** Treinador define e-mail de login e senha provisória (o aluno troca no primeiro login); com conta, encerra as sessões dele. */
export const definirAcessoDoAluno = (id: string, dados: { email: string; senha: string }) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/acesso`, { metodo: 'PUT', corpo: dados });

/**
 * Troca só o e-mail de login (a senha não muda): 409 `EMAIL_EM_USO`, `ALUNO_SEM_ACESSO`, `ALUNO_INATIVO`; encerra as sessões
 * do aluno e avisa por e-mail se o envio está ligado. `ALUNO_CONVITE`.
 */
export const alterarEmailDeAcessoDoAluno = (id: string, email: string) =>
  requisicao<EmailDeAcessoAlterado>(`/alunos/${seg(id)}/acesso/email`, { metodo: 'PUT', corpo: { email } });

/** Desativa o acesso (o aluno não entra mais, sessões encerradas, nada é apagado; em `ATRASO`, troca para `MANUAL`). `ALUNO_CONVITE`. */
export const desativarAcessoDoAluno = (id: string, motivo: 'MANUAL' = 'MANUAL') =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/acesso/desativar`, { metodo: 'POST', corpo: { motivo } });

/** Tira a desativação de qualquer motivo (`ALUNO_CONVITE`); 409 `ALUNO_INATIVO` com o aluno inativo. */
export const reativarAcessoDoAluno = (id: string) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/acesso/reativar`, { metodo: 'POST' });

/** Pausa por atraso, motivo `ATRASO` (`FINANCEIRO_ALTERAR`); 409 `SEM_COBRANCA_VENCIDA`, `ALUNO_INATIVO` e `ACESSO_JA_DESATIVADO` (MANUAL); já pausado = 200. */
export const pausarAcessoDoAluno = (id: string) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/pausar-acesso`, { metodo: 'POST' });

/** Tira só a pausa por atraso (`FINANCEIRO_ALTERAR`); MANUAL = 409 `ACESSO_JA_DESATIVADO` (sai por `reativarAcessoDoAluno`). */
export const reativarAcessoPausadoDoAluno = (id: string) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/reativar-acesso`, { metodo: 'POST' });

export const execucoesDoAluno = (id: string, de: string, ate: string) =>
  requisicao<DiaDeTreino[]>(`/alunos/${seg(id)}/execucoes?de=${de}&ate=${ate}`);

export const mobilidadeFeitaDoAluno = (id: string, de: string, ate: string) =>
  requisicao<RegistroMobilidadeFeito[]>(`/alunos/${seg(id)}/mobilidade/registros?de=${de}&ate=${ate}`);

/** Água que o aluno marcou (dado de dieta: `REGISTRO_LER` + `ALUNO_SENSIVEL_LER`). */
export const aguaDoAlunoParaTreinador = (id: string, de: string, ate: string) =>
  requisicao<AguaRegistrada[]>(`/alunos/${seg(id)}/agua?de=${de}&ate=${ate}`);

export const sessoesConcluidasDoAlunoParaTreinador = (id: string, de: string, ate: string) =>
  requisicao<SessoesConcluidasResponse>(`/alunos/${seg(id)}/sessoes-concluidas?de=${de}&ate=${ate}`);

/** "Visto" do treinador num treino concluído (Engajamento 0.5, `REGISTRO_REAGIR`); idempotente. */
export const marcarTreinoVisto = (alunoId: string, sessaoConcluidaId: string) =>
  requisicao<{ vistoEm: string }>(`/alunos/${seg(alunoId)}/sessoes-concluidas/${seg(sessaoConcluidaId)}/visto`, { metodo: 'PUT', corpo: {} });

export const desmarcarTreinoVisto = (alunoId: string, sessaoConcluidaId: string) =>
  requisicao<void>(`/alunos/${seg(alunoId)}/sessoes-concluidas/${seg(sessaoConcluidaId)}/visto`, { metodo: 'DELETE' });

/** "Recordes da semana" no Início (`meus` = só os alunos do usuário) e na ficha. */
export const recordesDaSemana = (meus: boolean) => requisicao<RecordesDaSemana>(`/recordes/semana${meus ? '?meus=true' : ''}`);

export const recordesDaSemanaDoAluno = (id: string) => requisicao<RecordesDaSemana>(`/alunos/${seg(id)}/recordes/semana`);

/** Trocas "só hoje" do aluno nos últimos 7 dias, com o `vistoEm` (`REGISTRO_LER`). */
export const trocasDeExercicioDoAluno = (id: string) => requisicao<TrocasDeExercicio>(`/alunos/${seg(id)}/trocas-de-exercicio`);

/** Aniversariantes dos próximos `dias` (0, 3, 7 ou 15), só nome, dia e mês (`ALUNO_LER`; `meus` = só os alunos do usuário). */
export const aniversariantesDosAlunos = (dias: number, meus: boolean) =>
  requisicao<AniversarianteDoAluno[]>(`/alunos/aniversariantes?dias=${dias}${meus ? '&meus=true' : ''}`);

/** Pendência do Início: trocas dos últimos 7 dias sem "Visto" (`meus` = só os alunos do usuário). */
export const trocasPendentes = (meus: boolean) => requisicao<TrocasPendentes>(`/trocas-de-exercicio/pendentes${meus ? '?meus=true' : ''}`);

/** "Visto" numa troca (`REGISTRO_REAGIR`); a chave vai no corpo, também no `DELETE`. Idempotentes. */
export const marcarTrocaVista = (alunoId: string, chave: ChaveDaTroca) =>
  requisicao<{ vistoEm: string }>(`/alunos/${seg(alunoId)}/trocas-de-exercicio/visto`, { metodo: 'PUT', corpo: chave });

export const desmarcarTrocaVista = (alunoId: string, chave: ChaveDaTroca) =>
  requisicao<void>(`/alunos/${seg(alunoId)}/trocas-de-exercicio/visto`, { metodo: 'DELETE', corpo: chave });

export const progressoDoAluno = (id: string, exercicioId: string) =>
  requisicao<ProgressoPonto[]>(`/alunos/${seg(id)}/progresso?exercicioId=${encodeURIComponent(exercicioId)}`);

export const pesosDoAluno = (id: string) => requisicao<RegistroPeso[]>(`/alunos/${seg(id)}/pesos`);

export const registrarPeso = (id: string, dados: { data: string; pesoKg: number; observacao: string | null }) =>
  requisicao<RegistroPeso[]>(`/alunos/${seg(id)}/pesos`, { metodo: 'POST', corpo: dados });

export const listarLesoes = (alunoId: string) => requisicao<Lesao[]>(`/alunos/${seg(alunoId)}/lesoes`);

export const registrarLesao = (alunoId: string, dados: DadosLesao) =>
  requisicao<Lesao>(`/alunos/${seg(alunoId)}/lesoes`, { metodo: 'POST', corpo: dados });

export const alterarLesao = (alunoId: string, id: string, dados: DadosLesao) =>
  requisicao<Lesao>(`/alunos/${seg(alunoId)}/lesoes/${seg(id)}`, { metodo: 'PUT', corpo: dados });

export const excluirLesao = (alunoId: string, id: string) =>
  requisicao<void>(`/alunos/${seg(alunoId)}/lesoes/${seg(id)}`, { metodo: 'DELETE' });

export const excluirPeso = (id: string, pesoId: string) =>
  requisicao<void>(`/alunos/${seg(id)}/pesos/${seg(pesoId)}`, { metodo: 'DELETE' });

// ---- Treinador: biblioteca ----

const busca = (texto?: string) => (texto ? `?busca=${encodeURIComponent(texto)}` : '');

export const listarExercicios = (texto?: string) => requisicao<Exercicio[]>(`/exercicios${busca(texto)}`);
export const TAMANHO_DA_PAGINA_DE_EXERCICIOS = 30;
/**
 * Uma página da aba Exercícios: busca sem acento, grupos (OU), modalidades (OU), vídeo e imagem (`true` só com, `false`
 * só sem, ausente = todos) no servidor; `grupos` e `modalidades` do retorno não aplicam filtro nenhum.
 */
export const listarExerciciosPagina = (filtro: {
  texto?: string; grupos?: readonly string[]; modalidades?: readonly string[]; video?: boolean; imagem?: boolean; pagina: number;
}) => {
  const q = new URLSearchParams({ pagina: String(filtro.pagina), tamanho: String(TAMANHO_DA_PAGINA_DE_EXERCICIOS) });
  if (filtro.texto) q.append('busca', filtro.texto);
  for (const g of filtro.grupos ?? []) q.append('grupo', g);
  for (const m of filtro.modalidades ?? []) q.append('modalidade', m);
  if (filtro.video !== undefined) q.append('video', String(filtro.video));
  if (filtro.imagem !== undefined) q.append('imagem', String(filtro.imagem));
  return requisicao<PaginaDeExercicios>(`/exercicios/pagina?${q.toString()}`);
};
export const criarExercicio = (dados: ExercicioRequest) =>
  requisicao<Exercicio>('/exercicios', { metodo: 'POST', corpo: dados });
export const alterarExercicio = (id: string, dados: ExercicioRequest) =>
  requisicao<Exercicio>(`/exercicios/${seg(id)}`, { metodo: 'PUT', corpo: dados });
export const inativarExercicio = (id: string) => requisicao<void>(`/exercicios/${seg(id)}`, { metodo: 'DELETE' });

// ---- Imagem ou GIF do exercício (bytes só pela API, com token; as fotos do catálogo vêm do próprio site) ----

/** `arquivo`: FormData com o campo `arquivo`. GIF vai como está (a API tira os metadados e confere pelos bytes). */
export const enviarImagemDoExercicio = (id: string, arquivo: FormData) =>
  requisicao<Exercicio>(`/exercicios/${seg(id)}/imagem`, { metodo: 'PUT', corpoBruto: arquivo, limiteMs: 60000 });
export const removerImagemDoExercicio = (id: string) =>
  requisicao<Exercicio>(`/exercicios/${seg(id)}/imagem`, { metodo: 'DELETE' });
/** Equipe (BIBLIOTECA_LER); 404 = sem imagem própria. */
export const baixarImagemDoExercicio = (id: string) =>
  requisicao<Blob>(`/exercicios/${seg(id)}/imagem`, { binario: true, limiteMs: 30000 });
/** Aluno: o que há para mostrar dos exercícios dos planos dele. */
export const demonstracoesDoAluno = () => requisicao<DemonstracaoDoAluno[]>('/aluno/exercicios/demonstracoes');
/** Aluno: 404 se o exercício não está num plano publicado dele ou não tem imagem própria. */
export const baixarImagemDoExercicioDoAluno = (id: string) =>
  requisicao<Blob>(`/aluno/exercicios/${seg(id)}/imagem`, { binario: true, limiteMs: 30000 });

export const listarAlimentos = (texto?: string, tipo?: 'ALIMENTO' | 'SUPLEMENTO') => {
  const q = new URLSearchParams();
  if (texto) q.set('busca', texto);
  if (tipo) q.set('tipo', tipo);
  const s = q.toString();
  return requisicao<Alimento[]>(`/alimentos${s ? `?${s}` : ''}`);
};
/** Fatores atuais dos alimentos (até 200 ids) para a lista de compras do editor da dieta; id de fora fica sem resposta. */
export const fatoresDosAlimentos = (ids: string[]) =>
  requisicao<FatoresDoAlimento[]>(`/alimentos/fatores?ids=${ids.map(seg).join(',')}`);
export const criarAlimento = (dados: AlimentoRequest) =>
  requisicao<Alimento>('/alimentos', { metodo: 'POST', corpo: dados });
export const alterarAlimento = (id: string, dados: AlimentoRequest) =>
  requisicao<Alimento>(`/alimentos/${seg(id)}`, { metodo: 'PUT', corpo: dados });
export const inativarAlimento = (id: string) => requisicao<void>(`/alimentos/${seg(id)}`, { metodo: 'DELETE' });

/**
 * Filtros do catálogo, todos na API (a lista vem cortada no limite). `grupo`, `modalidade` e `unidade` repetidos, um por valor (vale
 * "ou"; a vírgula do nome "Verduras, hortaliças e derivados" vai codificada); `imagem` e `naBiblioteca` ausentes = todos.
 */
export interface FiltroDoCatalogo {
  texto?: string; grupos?: readonly string[]; modalidades?: readonly string[]; unidades?: readonly string[]; imagem?: boolean; naBiblioteca?: boolean;
}
const consultaDoCatalogo = ({ texto, grupos = [], modalidades = [], unidades = [], imagem, naBiblioteca }: FiltroDoCatalogo) => {
  const q = new URLSearchParams();
  if (texto) q.append('busca', texto);
  for (const g of grupos) q.append('grupo', g);
  for (const m of modalidades) q.append('modalidade', m);
  for (const u of unidades) q.append('unidade', u);
  if (imagem !== undefined) q.append('imagem', String(imagem));
  if (naBiblioteca !== undefined) q.append('naBiblioteca', String(naBiblioteca));
  const montada = q.toString();
  return montada ? `?${montada}` : '';
};

export const catalogoExercicios = (filtro: Omit<FiltroDoCatalogo, 'unidades'>) =>
  requisicao<PaginaCatalogo<CatalogoExercicio>>(`/catalogo/exercicios${consultaDoCatalogo(filtro)}`);
export const catalogoAlimentos = (filtro: Omit<FiltroDoCatalogo, 'modalidades' | 'imagem'>) =>
  requisicao<PaginaCatalogo<CatalogoAlimento>>(`/catalogo/alimentos${consultaDoCatalogo(filtro)}`);
export const gruposDoCatalogo = (tipo: TipoBiblioteca) => requisicao<string[]>(`/catalogo/${seg(tipo)}/grupos`);

export type TipoBiblioteca = 'exercicios' | 'alimentos';

export const importarDoCatalogo = (tipo: TipoBiblioteca, ids: string[]) =>
  requisicao<ImportacaoResultado>(`/${seg(tipo)}/importar-catalogo`, { metodo: 'POST', corpo: { ids } });

/** `destino` e `situacao` vão repetidos (`?destino=alunos&destino=pesos`); `arquivo`, `de` e `ate`, um de cada. */
export const listarImportacoes = (filtro: { destino?: readonly string[]; situacao?: readonly string[]; arquivo?: 'xlsx' | 'csv'; de?: string; ate?: string; pagina: number }) => {
  const q = new URLSearchParams();
  for (const campo of ['destino', 'situacao'] as const) for (const v of filtro[campo] ?? []) q.append(campo, v);
  for (const campo of ['arquivo', 'de', 'ate'] as const) {
    const valor = filtro[campo];
    if (valor) q.set(campo, valor);
  }
  q.set('pagina', String(filtro.pagina));
  return requisicao<PaginaDeImportacao>(`/importacoes?${q}`);
};
export const detalheDaImportacao = (id: string) => requisicao<DetalheDeImportacao>(`/importacoes/${seg(id)}`);
export const csvDeErrosDaImportacao = (id: string) => requisicao<string>(`/importacoes/${seg(id)}/erros.csv`, { aceita: 'text/csv' });
/** Sem `linhaDoCabecalho` a API detecta a linha e a devolve na resposta. */
/** Envio de planilha e confirmação passam dos 15 s padrão em rede lenta ou arquivo grande (revisão de 28/11, 0.5). */
const ENVIO_DE_ARQUIVO_MS = 60_000;
const CONFIRMACAO_MS = 120_000;
export const colunasDaImportacao = (destino: string, arquivo: FormData, aba: number, linhaDoCabecalho?: number) =>
  requisicao<ColunasDaImportacao>(`/importacoes/${seg(destino)}/colunas?aba=${aba}${linhaDoCabecalho === undefined ? '' : `&linhaDoCabecalho=${linhaDoCabecalho}`}`,
    { metodo: 'POST', corpoBruto: arquivo, limiteMs: ENVIO_DE_ARQUIVO_MS });
/** Entrada única da importação manual: diz se o arquivo é a planilha completa, uma aba (com o destino) ou nada conhecido. */
export const reconhecerArquivo = (arquivo: FormData) =>
  requisicao<ReconhecimentoDoArquivo>('/importacoes/reconhecer', { metodo: 'POST', corpoBruto: arquivo, limiteMs: ENVIO_DE_ARQUIVO_MS });
export const previaDaImportacao = (destino: string, arquivo: FormData) =>
  requisicao<PreviaDeImportacao>(`/importacoes/${seg(destino)}/previa`, { metodo: 'POST', corpoBruto: arquivo, limiteMs: ENVIO_DE_ARQUIVO_MS });
export const confirmarImportacao = (destino: string, arquivo: FormData, hash: string) =>
  requisicao<DetalheDeImportacao>(`/importacoes/${seg(destino)}?hash=${encodeURIComponent(hash)}`, { metodo: 'POST', corpoBruto: arquivo, limiteMs: CONFIRMACAO_MS });
/** Planilha completa: a análise e a prévia só leem; a confirmação grava em rascunho; o desfazer apaga o intocado. */
export const analisarPlanilhaCompleta = (arquivo: FormData) =>
  requisicao<AnaliseDaPlanilha>('/importacoes/planilha-completa/analisar', { metodo: 'POST', corpoBruto: arquivo, limiteMs: ENVIO_DE_ARQUIVO_MS });
export const previaDaPlanilhaCompleta = (arquivo: FormData) =>
  requisicao<PreviaDaPlanilha>('/importacoes/planilha-completa/previa', { metodo: 'POST', corpoBruto: arquivo, limiteMs: ENVIO_DE_ARQUIVO_MS });
/**
 * Os alunos desmarcados na amostra vão no corpo (parte `chavesIgnoradas` do FormData, montada por quem chama): a chave pode ser
 * `nome:<nome>` e a query vai para o log de acesso do proxy. Ficam fora do `hash`: marcar não invalida a prévia.
 */
export const confirmarPlanilhaCompleta = (arquivo: FormData, hash: string) =>
  requisicao<ConfirmacaoDaPlanilha>(`/importacoes/planilha-completa/confirmar?hash=${encodeURIComponent(hash)}`,
    { metodo: 'POST', corpoBruto: arquivo, limiteMs: CONFIRMACAO_MS });
/** Migração assistida, fase 1: diz o que dá para importar do arquivo. Não grava nada (503 `MIGRACAO_INDISPONIVEL` com a chave desligada). */
export const diagnosticarArquivo = (arquivo: FormData) =>
  requisicao<DiagnosticoDoArquivo>('/importacoes/diagnostico', { metodo: 'POST', corpoBruto: arquivo, limiteMs: ENVIO_DE_ARQUIVO_MS });
/** Migração assistida, fase 2: a amostra revisável (5 alunos a partir de `inicio`); só lê, e o `hash` serve à confirmação (503 `MIGRACAO_INDISPONIVEL` com a chave desligada). */
export const amostraDaPlanilhaCompleta = (arquivo: FormData, inicio = 0) =>
  requisicao<AmostraDaPlanilha>(`/importacoes/planilha-completa/amostra?inicio=${inicio}`, { metodo: 'POST', corpoBruto: arquivo, limiteMs: ENVIO_DE_ARQUIVO_MS });
export const desfazerImportacao = (id: string) =>
  requisicao<ImportacaoDesfeita>(`/importacoes/${seg(id)}/desfazer`, { metodo: 'POST' });
/** Esquece as respostas guardadas das importações anteriores da planilha completa (a próxima análise vem sem marcas). */
export const esquecerRespostasDaPlanilha = () =>
  requisicao<{ apagadas: number }>('/importacoes/planilha-completa/respostas-salvas', { metodo: 'DELETE' });

// ---- Treinador: receitas ----

type ReceitaRequest = { tipo: TipoReceita; nome: string; descricao: string | null; conteudo: unknown; pastaId?: string | null; versao?: number };

export const listarReceitas = (tipo?: TipoReceita) => requisicao<Receita[]>(`/receitas${tipo ? `?tipo=${tipo}` : ''}`);

export const criarReceita = (dados: ReceitaRequest) => requisicao<Receita>('/receitas', { metodo: 'POST', corpo: dados });

export const alterarReceita = (id: string, dados: ReceitaRequest) =>
  requisicao<Receita>(`/receitas/${seg(id)}`, { metodo: 'PUT', corpo: dados });

export const excluirReceita = (id: string) => requisicao<void>(`/receitas/${seg(id)}`, { metodo: 'DELETE' });

// ---- Treinador: planos de treino, dieta e mobilidade (mesmas rotas, trocando o prefixo) ----

const PREFIXOS: Record<TipoPlano, string> = { treino: 'planos-treino', dieta: 'planos-dieta', mobilidade: 'planos-mobilidade' };
const prefixo = (tipo: TipoPlano) => PREFIXOS[tipo];

export interface DadosPasta {
  titulo: string;
  inicio: string | null;
  fim: string | null;
}

export interface NovoPlano {
  titulo: string;
  inicio: string | null;
  fim: string | null;
  receitaId?: string;
  copiarDoPlanoId?: string;
  /** Cria dentro da pasta: o período dela vale (inicio/fim daqui são ignorados). */
  pastaId?: string;
}

export const listarPastas = (alunoId: string) => requisicao<PastaResumo[]>(`/alunos/${seg(alunoId)}/pastas`);
export const pastaVigenteDoAluno = (alunoId: string) => requisicao<PastaVigenteResposta>(`/alunos/${seg(alunoId)}/pastas/vigente`);

export const criarPasta = (alunoId: string, dados: DadosPasta) =>
  requisicao<PastaResumo>(`/alunos/${seg(alunoId)}/pastas`, { metodo: 'POST', corpo: dados });

export const atualizarPasta = (id: string, dados: DadosPasta) =>
  requisicao<PastaResumo>(`/pastas/${seg(id)}`, { metodo: 'PUT', corpo: dados });

export const replicarPasta = (id: string, dados: DadosPasta) =>
  requisicao<PastaResumo>(`/pastas/${seg(id)}/replicar`, { metodo: 'POST', corpo: dados });

export const finalizarPasta = (id: string, dados: import('./tipos').FinalizarPastaRequest) =>
  requisicao<PastaResumo>(`/pastas/${seg(id)}/finalizar`, { metodo: 'POST', corpo: dados });

/**
 * Publica o rascunho de treino, dieta e mobilidade da pasta de uma vez. 422 `PLANO_INVALIDO`/`CONFIRMAR_AVISOS` traz a lista
 * por plano em `fieldErrors` (`treino.<caminho>`); 409 `CONFLITO_EDICAO` (versão que a tela leu não é mais a do plano, ou
 * chamada simultânea perdida) e 409 `PLANOS_PENDENTES_DUPLICADOS` (dois pendentes do mesmo tipo). Em todos, nada é publicado.
 */
export const publicarPasta = (id: string, dados: PublicarPastaRequest) =>
  requisicao<PublicarPastaResposta>(`/pastas/${seg(id)}/publicar`, { metodo: 'POST', corpo: dados });

/** Copia a pasta para outro aluno: pasta nova no destino, tudo em rascunho, sem ergogênicos e sem o questionário escolhido. */
export const copiarPastaParaAluno = (id: string, dados: CopiarPastaRequest) =>
  requisicao<CopiarPastaResposta>(`/pastas/${seg(id)}/copiar-para-aluno`, { metodo: 'POST', corpo: dados });

/** Peso da atualização enviada da pasta (`ALUNO_SENSIVEL_LER` + `ATUALIZACAO_LER`); sem peso, ambos `null`. */
export const pesoSugeridoDaPasta = (id: string) => requisicao<PesoSugeridoDaPasta>(`/pastas/${seg(id)}/peso-sugerido`);

export const reabrirPasta = (id: string) => requisicao<PastaResumo>(`/pastas/${seg(id)}/reabrir`, { metodo: 'POST' });

export const listarPlanos = (tipo: TipoPlano, alunoId: string) =>
  requisicao<PlanoResumo[]>(`/alunos/${seg(alunoId)}/${seg(prefixo(tipo))}`);

export const criarPlano = <C>(tipo: TipoPlano, alunoId: string, dados: NovoPlano) =>
  requisicao<PlanoDetalhe<C>>(`/alunos/${seg(alunoId)}/${seg(prefixo(tipo))}`, { metodo: 'POST', corpo: dados });

export const plano = <C>(tipo: TipoPlano, id: string) => requisicao<PlanoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}`);

export const salvarRascunho = <C>(
  tipo: TipoPlano,
  id: string,
  dados: { titulo: string; inicio: string | null; fim: string | null; conteudo: C; versao: number },
) => requisicao<PlanoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}/rascunho`, { metodo: 'PUT', corpo: dados });

export const validarPlano = (tipo: TipoPlano, id: string) =>
  requisicao<ResultadoValidacao>(`/${seg(prefixo(tipo))}/${seg(id)}/validar`, { metodo: 'POST' });

/** `liberacao` (bloco E): `{}` = libera na hora e avisa o aluno (o padrão da API); ver `api/liberacaoDePlano.ts`. */
export const publicarPlano = <C>(tipo: TipoPlano, id: string, versao: number, confirmarAvisos: boolean, liberacao: CorpoDaLiberacao = {}) =>
  requisicao<PlanoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}/publicar`, {
    metodo: 'POST',
    corpo: { versao, confirmarAvisos, ...liberacao },
  });

export const replicarPlano = <C>(tipo: TipoPlano, id: string, dados: Omit<NovoPlano, 'receitaId' | 'copiarDoPlanoId'>) =>
  requisicao<PlanoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}/replicar`, { metodo: 'POST', corpo: dados });

/** Sem `pastaId`, nasce uma pasta nova no destino (com `titulo`, `inicio` e `fim`); com ele, o período é o da pasta. */
export const copiarPlanoParaAluno = (tipo: TipoPlano, id: string, dados: { alunoId: string; pastaId: string | null; titulo: string; inicio: string | null; fim: string | null }) =>
  requisicao<CopiaDePlano>(`/${seg(prefixo(tipo))}/${seg(id)}/copiar-para-aluno`, { metodo: 'POST', corpo: dados });

export const salvarPlanoComoReceita =(tipo: TipoPlano, id: string, nome: string, descricao: string | null) =>
  requisicao<Receita>(`/${seg(prefixo(tipo))}/${seg(id)}/salvar-como-receita`, { metodo: 'POST', corpo: { nome, descricao } });

// ---- Aluno (sempre o aluno do token) ----

/** Próximos compromissos presenciais do aluno (só leitura; sem observação). */
export const compromissosDoAluno = () => requisicao<CompromissoDoAluno[]>('/aluno/compromissos');

/** Avisos de compromisso não vistos do aluno (até 20, mais novos primeiro). */
export const avisosDeCompromisso = () => requisicao<AvisoDeCompromisso[]>('/aluno/avisos-de-compromisso');
/** Marca o aviso como visto (idempotente; 204). */
export const marcarAvisoDeCompromissoVisto = (id: string) =>
  requisicao<void>(`/aluno/avisos-de-compromisso/${seg(id)}/visto`, { metodo: 'POST' });

export const painelAluno = () => requisicao<PainelAluno>('/aluno/painel');

export const pastasDoAluno = () => requisicao<PastaDoAluno[]>('/aluno/pastas');

export const planosDaPastaAluno = (id: string) => requisicao<PlanosDaPasta>(`/aluno/pastas/${seg(id)}`);

export const mobilidadeAluno = () => requisicao<{ mobilidade: VersaoDetalhe<ConteudoMobilidadeApi> }>('/aluno/mobilidade');

export const dietaAluno = () => requisicao<{ dieta: VersaoDetalhe<ConteudoDieta> | null }>('/aluno/dieta');

export const enviarRegistros = (registros: RegistroEnvio[]) =>
  requisicao<LoteResponse>('/aluno/execucoes/lote', { metodo: 'POST', corpo: { registros } });

export const enviarRegistrosMobilidade = (registros: RegistroMobilidadeEnvio[]) =>
  requisicao<LoteResponse>('/aluno/mobilidade/registros', { metodo: 'POST', corpo: { registros } });

export const registrosMobilidadeDoAluno = (de: string, ate: string) =>
  requisicao<RegistroMobilidadeFeito[]>(`/aluno/mobilidade/registros?de=${de}&ate=${ate}`);

export const enviarAgua = (registros: RegistroAguaEnvio[]) =>
  requisicao<LoteResponse>('/aluno/agua', { metodo: 'POST', corpo: { registros } });

export const aguaDoAluno = (de: string, ate: string) => requisicao<AguaRegistrada[]>(`/aluno/agua?de=${de}&ate=${ate}`);

export const enviarSessoesConcluidas = (registros: RegistroSessaoConcluidaEnvio[]) =>
  requisicao<LoteResponse>('/aluno/sessoes-concluidas', { metodo: 'POST', corpo: { registros } });

export const sessoesConcluidasDoAluno = (de: string, ate: string) =>
  requisicao<SessoesConcluidasResponse>(`/aluno/sessoes-concluidas?de=${de}&ate=${ate}`);

export const historicoAluno = (de: string, ate: string) => requisicao<DiaDeTreino[]>(`/aluno/execucoes?de=${de}&ate=${ate}`);

export const progressoAluno = (exercicioId: string) =>
  requisicao<ProgressoPonto[]>(`/aluno/progresso?exercicioId=${encodeURIComponent(exercicioId)}`);

export const pesosAluno = () => requisicao<RegistroPeso[]>('/aluno/pesos');

export const versaoPlano = <C>(tipo: TipoPlano, id: string, numero: number) =>
  requisicao<VersaoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}/versoes/${seg(numero)}`);

/** A versão da pasta da atualização que o aluno via no envio (revisão do treinador). */
export const prescricaoDaAtualizacao = <C>(id: string, tipo: 'treino' | 'dieta') =>
  requisicao<PrescricaoDaAtualizacao<C>>(`/atualizacoes/${seg(id)}/prescricao/${tipo}`);

export const receita = (id: string) => requisicao<Receita>(`/receitas/${seg(id)}`);
export const salvarConteudoReceita = (id: string, dados: { nome: string; conteudo: unknown; versao: number }) =>
  requisicao<Receita>(`/receitas/${seg(id)}/conteudo`, { metodo: 'PUT', corpo: dados });
export const duplicarReceita = (id: string) => requisicao<Receita>(`/receitas/${seg(id)}/duplicar`, { metodo: 'POST' });
export const listarPastasModelos = () => requisicao<import('./tipos').PastaModelo[]>('/pastas-modelos');
export const criarPastaModelo = (nome: string) => requisicao<import('./tipos').PastaModelo>('/pastas-modelos', { metodo: 'POST', corpo: { nome } });
export const alterarPastaModelo = (id: string, nome: string, versao: number) => requisicao<import('./tipos').PastaModelo>(`/pastas-modelos/${seg(id)}`, { metodo: 'PUT', corpo: { nome, versao } });
export const excluirPastaModelo = (id: string) => requisicao<void>(`/pastas-modelos/${seg(id)}`, { metodo: 'DELETE' });
export const aplicarModelo = (id: string, dados: { alunoId: string; pastaId: string | null; titulo: string; inicio: string | null; fim: string | null }) =>
  requisicao<{ pastaId: string; planoId: string | null; tipo: string }>(`/receitas/${seg(id)}/aplicar`, { metodo: 'POST', corpo: dados });
export const salvarPastaComoModelo = (id: string, nome: string, descricao: string | null) => requisicao<Receita>(`/pastas/${seg(id)}/salvar-como-modelo`, { metodo: 'POST', corpo: { nome, descricao } });
export const excluirPasta = (id: string) => requisicao<void>(`/pastas/${seg(id)}`, { metodo: 'DELETE' });
export const excluirPlano = (tipo: TipoPlano, id: string) => requisicao<void>(`/${seg(prefixo(tipo))}/${seg(id)}`, { metodo: 'DELETE' });

export const minhaConta = () => requisicao<MinhaConta>('/minha-conta');
export const consumoDoPlano = () => requisicao<ConsumoDoPlano>('/minha-conta/consumo');
/** Link do checkout (Mercado Pago) de uma cobrança aberta; o app abre fora dele, sem token. */
export const linkDePagamento = (cobrancaId: string) =>
  requisicao<{ url: string }>(`/minha-conta/cobrancas/${seg(cobrancaId)}/pagar`, { metodo: 'POST' });

/** A lista de suplementos é a de alimentos com tipo SUPLEMENTO; a tela continua falando em categoria. */
export function suplementoDaResposta(a: Alimento): SuplementoDaBiblioteca {
  return {
    id: a.id, nome: a.nome, marca: a.marca ?? null, categoria: a.grupo ?? null, porcao: a.porcao ?? null,
    porcoesPorEmbalagem: a.porcoesPorEmbalagem ?? null, sabores: a.sabores ?? [], link: a.link ?? null, cupom: a.cupom ?? null,
  };
}

function pedidoDeSuplemento(dados: SuplementoDaBibliotecaRequest): AlimentoRequest {
  return {
    nome: dados.nome, tipo: 'SUPLEMENTO', marca: dados.marca, grupo: dados.categoria, porcao: dados.porcao,
    porcoesPorEmbalagem: dados.porcoesPorEmbalagem, sabores: dados.sabores, link: dados.link, cupom: dados.cupom,
    baseQuantidade: null, baseUnidade: null, kcal: null, proteina: null, carboidrato: null, gordura: null,
    gramasPorUnidade: null, fonte: null, fatorCorrecao: null, fatorCoccao: null, fibra: null, // suplemento fica sem fibra (V089)
  };
}

export const listarSuplementos = () => listarAlimentos(undefined, 'SUPLEMENTO').then((lista) => lista.map(suplementoDaResposta));
export const criarSuplemento = (dados: SuplementoDaBibliotecaRequest) =>
  criarAlimento(pedidoDeSuplemento(dados)).then(suplementoDaResposta);
export const alterarSuplemento = (id: string, dados: SuplementoDaBibliotecaRequest) =>
  alterarAlimento(id, pedidoDeSuplemento(dados)).then(suplementoDaResposta);
export const inativarSuplemento = (id: string) => inativarAlimento(id);

export const listarErgogenicos = () => requisicao<ErgogenicoDaBiblioteca[]>('/ergogenicos');
export const criarErgogenico = (dados: ErgogenicoDaBibliotecaRequest) =>
  requisicao<ErgogenicoDaBiblioteca>('/ergogenicos', { metodo: 'POST', corpo: dados });
export const alterarErgogenico = (id: string, dados: ErgogenicoDaBibliotecaRequest) =>
  requisicao<ErgogenicoDaBiblioteca>(`/ergogenicos/${seg(id)}`, { metodo: 'PUT', corpo: dados });
export const inativarErgogenico = (id: string) => requisicao<void>(`/ergogenicos/${seg(id)}`, { metodo: 'DELETE' });

// ---- Financeiro: pagamentos do aluno ao treinador (só com `pagamentosHabilitados`) ----
// O app nunca envia valor de cobrança: ele sai do plano ou da contratação, no servidor.

function consultaFinanceiro(filtro: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [campo, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== null && valor !== '') q.set(campo, String(valor));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

export const listarPlanosComerciais = (arquivados = false) =>
  requisicao<PlanoResponse[]>(`/financeiro/planos${consultaFinanceiro({ arquivados })}`);
export const criarPlanoComercial = (corpo: PlanoRequest) =>
  requisicao<PlanoResponse>('/financeiro/planos', { metodo: 'POST', corpo });
export const alterarPlanoComercial = (id: string, corpo: PlanoRequest) =>
  requisicao<PlanoResponse>(`/financeiro/planos/${seg(id)}`, { metodo: 'PUT', corpo });
export const arquivarPlanoComercial = (id: string, versao: number) =>
  requisicao<PlanoResponse>(`/financeiro/planos/${seg(id)}/arquivar`, { metodo: 'POST', corpo: { versao } });

export const listarContratacoesDoAluno = (alunoId: string) =>
  requisicao<ContratacaoResponse[]>(`/alunos/${seg(alunoId)}/contratacoes`);
export const contratarPlano = (alunoId: string, corpo: ContratarRequest) =>
  requisicao<ContratacaoResponse>(`/alunos/${seg(alunoId)}/contratacoes`, { metodo: 'POST', corpo });
export const alterarContratacao = (id: string, corpo: AlterarContratacaoRequest) =>
  requisicao<ContratacaoResponse>(`/contratacoes/${seg(id)}`, { metodo: 'PUT', corpo });
export const mudarSituacaoDaContratacao = (id: string, acao: 'pausar' | 'retomar', versao: number) =>
  requisicao<ContratacaoResponse>(`/contratacoes/${seg(id)}/${acao}`, { metodo: 'POST', corpo: { versao } });
/** O que encerrar faria agora (só leitura; contratação já encerrada = 409 `CONTRATACAO_ENCERRADA`). */
export const previaDoEncerramento = (id: string) =>
  requisicao<PreviaDoEncerramento>(`/contratacoes/${seg(id)}/previa-de-encerramento`);
/** Encerrar, com cobrança de saída opcional (`saida`); sem `saida` encerra como sempre, mantendo as abertas. */
export const encerrarContratacao = (id: string, corpo: EncerrarContratacaoRequest) =>
  requisicao<ContratacaoResponse>(`/contratacoes/${seg(id)}/encerrar`, { metodo: 'POST', corpo });
/** O que inativar o aluno faz com o financeiro (painel de inativar; `FINANCEIRO_LER`, 503 com o financeiro desligado). */
export const resumoDaSaidaDoAluno = (alunoId: string) =>
  requisicao<ResumoDaSaidaDoAluno>(`/alunos/${seg(alunoId)}/resumo-da-saida`);

export const listarCobrancasDoAluno = (alunoId: string) =>
  requisicao<CobrancaResponse[]>(`/alunos/${seg(alunoId)}/cobrancas`);
/**
 * Cobranças filtradas: `situacoes` repetidas (vazio = todas; "Em aberto" inclui as vencidas), vencimento `de`/`ate`,
 * `busca` no nome do aluno, `alunoId`, `planoId` e `forma` da baixa.
 */
export const listarCobrancas = (filtro: {
  situacoes?: readonly FiltroDeSituacao[]; de?: string; ate?: string; meus?: boolean; pagina?: number; busca?: string;
  alunoId?: string; planoId?: string; forma?: 'MANUAL' | 'ONLINE';
  /** Emissão (dia em que a cobrança foi gerada) e pagamento (data da baixa), dias de Brasília. */
  emissaoDe?: string; emissaoAte?: string; pagoDe?: string; pagoAte?: string;
}) => {
  const q = new URLSearchParams();
  (filtro.situacoes ?? []).filter((s) => s !== 'TODAS').forEach((s) => q.append('situacao', s));
  const resto = { de: filtro.de, ate: filtro.ate, busca: filtro.busca?.trim(), alunoId: filtro.alunoId, planoId: filtro.planoId,
    forma: filtro.forma, emissaoDe: filtro.emissaoDe, emissaoAte: filtro.emissaoAte, pagoDe: filtro.pagoDe, pagoAte: filtro.pagoAte,
    meus: filtro.meus ? 'true' : undefined, pagina: String(filtro.pagina ?? 0) };
  for (const [campo, valor] of Object.entries(resto)) if (valor) q.set(campo, valor);
  return requisicao<PaginaCobrancas>(`/financeiro/cobrancas?${q.toString()}`);
};
export const registrarPagamentoManual = (id: string, corpo: BaixaManualRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/baixa-manual`, { metodo: 'POST', corpo });
/** Registrar pagamentos em lote: um resultado por item, na ordem do pedido; o que falha não desfaz o resto. */
export const registrarPagamentosEmLote = (corpo: BaixaEmLoteRequest) =>
  requisicao<ResultadoDoLote>('/cobrancas/baixa-em-lote', { metodo: 'POST', corpo });
/** Cancelar em lote (1 a 100, com a `versao` de cada): um resultado por item, na ordem do pedido. Não tem volta. */
export const cancelarCobrancasEmLote = (corpo: CancelarEmLoteRequest) =>
  requisicao<ResultadoDoLote>('/cobrancas/cancelar-em-lote', { metodo: 'POST', corpo });
/** Gerar o link de pagamento de várias (1 a 100): `url` em cada item `ok`. */
export const gerarLinksEmLote = (corpo: CobrancasSelecionadasRequest) =>
  requisicao<ResultadoDoLote>('/cobrancas/link-em-lote', { metodo: 'POST', corpo });
/** CSV como texto das cobranças escolhidas (1 a 100), com as colunas da exportação por período. */
export const exportarCobrancasSelecionadas = (corpo: CobrancasSelecionadasRequest) =>
  requisicao<string>('/financeiro/exportacao/selecionadas', { metodo: 'POST', corpo, aceita: 'text/csv' });
/** Cobrança avulsa para 1 a 100 alunos, tudo ou nada; `valorCentavos` é o de cada parcela de cada aluno (exceção D5). */
export const criarCobrancasAvulsas = (corpo: CobrancaAvulsaRequest) =>
  requisicao<CobrancaAvulsaResponse>('/financeiro/cobrancas-avulsas', { metodo: 'POST', corpo });
export const desfazerBaixaDaCobranca = (id: string, corpo: MotivoRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/desfazer-baixa`, { metodo: 'POST', corpo });
export const cancelarCobranca = (id: string, corpo: MotivoRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/cancelar`, { metodo: 'POST', corpo });
export const estornarCobranca = (id: string, corpo: MotivoRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/estornar`, { metodo: 'POST', corpo });
export const contestarCobranca = (id: string, corpo: MotivoRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/contestar`, { metodo: 'POST', corpo });
/** A contestação terminou a favor do treinador: a cobrança volta a ficar paga. */
export const manterCobrancaPaga = (id: string, corpo: MotivoRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/manter-paga`, { metodo: 'POST', corpo });

export const painelFinanceiro = (filtro: { de: string; ate: string; meus: boolean }) =>
  requisicao<Painel>(`/financeiro/painel${consultaFinanceiro({ de: filtro.de, ate: filtro.ate, meus: filtro.meus ? true : undefined })}`);
/** Renovações próximas e projeção anual: da consultoria inteira ou, com `meus`, só dos alunos do responsável (a rota não filtra por período). */
export const visaoGeralDoFinanceiro = ({ meus }: { meus: boolean }) =>
  requisicao<VisaoGeralDoFinanceiro>(`/financeiro/visao-geral${consultaFinanceiro({ meus: meus ? true : undefined })}`);
export const listarInadimplentes = (filtro: { meus: boolean; pagina?: number }) =>
  requisicao<PaginaInadimplentes>(`/financeiro/inadimplentes${consultaFinanceiro({ meus: filtro.meus ? true : undefined, pagina: filtro.pagina ?? 0 })}`);
/** CSV como texto (cobranças e lançamentos do período). 422 se passar de 5.000 linhas. */
export const exportarFinanceiro = (de: string, ate: string) =>
  requisicao<string>(`/financeiro/exportacao${consultaFinanceiro({ de, ate })}`, { aceita: 'text/csv' });

/** Lançamentos filtrados: período, `tipo`, `categoria` repetida (texto livre, cada uma num parâmetro) e `busca` na descrição. */
export const listarLancamentos = (filtro: { de?: string; ate?: string; pagina?: number; tipo?: TipoDeLancamento; categorias?: readonly string[]; busca?: string } = {}) => {
  const q = new URLSearchParams();
  const resto = { de: filtro.de, ate: filtro.ate, tipo: filtro.tipo, busca: filtro.busca?.trim() };
  for (const [campo, valor] of Object.entries(resto)) if (valor) q.set(campo, valor);
  (filtro.categorias ?? []).forEach((c) => q.append('categoria', c));
  q.set('pagina', String(filtro.pagina ?? 0));
  return requisicao<PaginaLancamentos>(`/financeiro/lancamentos?${q.toString()}`);
};
/** Categorias já usadas nos lançamentos (para o filtro). */
export const categoriasDeLancamentos = () => requisicao<string[]>('/financeiro/lancamentos/categorias');
export const criarLancamento = (corpo: LancamentoRequest) =>
  requisicao<LancamentoResponse>('/financeiro/lancamentos', { metodo: 'POST', corpo });
export const alterarLancamento = (id: string, corpo: LancamentoRequest) =>
  requisicao<LancamentoResponse>(`/financeiro/lancamentos/${seg(id)}`, { metodo: 'PUT', corpo });
/** A versão vai na query, não no corpo. */
export const excluirLancamento = (id: string, versao: number) =>
  requisicao<void>(`/financeiro/lancamentos/${seg(id)}${consultaFinanceiro({ versao })}`, { metodo: 'DELETE' });

/** O que o aluno vê do próprio plano e das cobranças. `plano` nulo = nada contratado. */
export const financeiroDoAluno = () => requisicao<FinanceiroDoAluno>('/aluno/financeiro');

// ---- Recebimento online (InfinitePay): só com `recebimentoOnlineHabilitado`; desligado no servidor, as rotas dão 503 ----

/** A API Key nunca volta: só `apiKeyConfigurada`. `versao` nula = nada configurado. */
export const buscarRecebimentoOnline = () => requisicao<RecebimentoOnline>('/financeiro/recebimento-online');
export const salvarRecebimentoOnline = (corpo: RecebimentoOnlineRequest) =>
  requisicao<RecebimentoOnline>('/financeiro/recebimento-online', { metodo: 'PUT', corpo });
/** A versão vai na query, não no corpo. */
export const removerRecebimentoOnline = (versao?: number | null) =>
  requisicao<void>(`/financeiro/recebimento-online${consultaFinanceiro({ versao })}`, { metodo: 'DELETE' });

// ---- Formas de recebimento (InfinitePay, link próprio, Pix, Manual): atrás do financeiro, não da InfinitePay ----

/** A chave Pix nunca volta inteira (`chaveMascarada`). `versao` nula = a consultoria nunca gravou (vale o padrão). Ler pede também `ALUNO_LER`. */
export const buscarFormasDeRecebimento = () => requisicao<FormasDeRecebimento>('/financeiro/formas-de-recebimento');
/** `pixConfig.chave` só quando o treinador digitou uma nova; `pix: false` vai sem `pixConfig` (o servidor mantém a gravada). */
export const salvarFormasDeRecebimento = (corpo: FormasDeRecebimentoRequest) =>
  requisicao<FormasDeRecebimento>('/financeiro/formas-de-recebimento', { metodo: 'PUT', corpo });

// ---- Lembretes de cobrança por e-mail (atrás do financeiro: desligado, 503) ----

/** Sem configuração gravada vem desligada com os padrões e `versao` nula. */
export const buscarLembretes = () => requisicao<Lembretes>('/financeiro/lembretes');
export const salvarLembretes = (corpo: LembretesRequest) =>
  requisicao<Lembretes>('/financeiro/lembretes', { metodo: 'PUT', corpo });
/** Os lembretes de uma cobrança e a mensagem pronta do WhatsApp (só em aberto). */
export const lembretesDaCobranca = (id: string) => requisicao<LembretesDaCobranca>(`/cobrancas/${seg(id)}/lembretes`);

/**
 * O aluno liga ou desliga, só para si, os lembretes de pagamento por e-mail (sempre o da sessão; atrás do financeiro:
 * desligado, 503 `FINANCEIRO_INDISPONIVEL`). Nada fica no aparelho.
 */
export const lembretesDoAluno = () => requisicao<LembretesDoAluno>('/aluno/lembretes-de-cobranca');
export const definirLembretesDoAluno = (receber: boolean) =>
  requisicao<LembretesDoAluno>('/aluno/lembretes-de-cobranca', { metodo: 'PUT', corpo: { receber } });

/** Link de pagamento de uma cobrança em aberto, para o treinador copiar e mandar ao aluno. */
export const linkDaCobranca = (id: string) =>
  requisicao<LinkDePagamento>(`/cobrancas/${seg(id)}/link`, { metodo: 'POST' });
/** Link de pagamento de uma cobrança do próprio aluno (o "Pagar"; no celular só com a chave da plataforma ligada). */
export const linkDePagamentoDoAluno = (id: string) =>
  requisicao<LinkDePagamento>(`/aluno/financeiro/cobrancas/${seg(id)}/link`, { metodo: 'POST' });
/**
 * O Pix copia e cola de uma cobrança em aberto do próprio aluno, montado pelo servidor (`no-store`). O código leva a chave Pix
 * do treinador: só vai à área de transferência, nunca a log, cache ou armazenamento do aparelho. 409 `PIX_INDISPONIVEL`.
 */
export const codigoPixDoAluno = (id: string) =>
  requisicao<CodigoPix>(`/aluno/financeiro/cobrancas/${seg(id)}/pix`, { metodo: 'POST' });
/**
 * A volta do navegador depois do pagamento (a InfinitePay manda o aluno a `/aluno/conta` com os NSU na query): avisa a API,
 * que consulta a InfinitePay e dá a baixa se for o caso. 204; cobrança de outro aluno = 404. Nada fica no aparelho.
 */
export const retornoDoPagamento = (corpo: import('./financeiroTipos').RetornoDoPagamento) =>
  requisicao<void>('/aluno/financeiro/retorno-pagamento', { metodo: 'POST', corpo });

/** Pagamentos que o provedor avisou e não deram baixa sozinhos. */
export const listarConferencias = () => requisicao<ConferenciasDePagamento>('/financeiro/conferencias');
export const marcarConferido = (id: string) =>
  requisicao<void>(`/financeiro/conferencias/${seg(id)}/conferido`, { metodo: 'POST' });

/** Avaliação física (circunferências): a equipe lê com ALUNO_SENSIVEL_LER e grava com ela e ALUNO_SENSIVEL_ALTERAR. */
export const avaliacoesFisicasDoAluno = (alunoId: string) =>
  requisicao<import('./avaliacaoFisicaTipos').AvaliacaoFisica[]>(`/alunos/${seg(alunoId)}/avaliacoes-fisicas`);
export const registrarAvaliacaoFisica = (alunoId: string, corpo: import('./avaliacaoFisicaTipos').DadosAvaliacaoFisica) =>
  requisicao<import('./avaliacaoFisicaTipos').AvaliacaoFisica>(`/alunos/${seg(alunoId)}/avaliacoes-fisicas`, { metodo: 'POST', corpo });
export const alterarAvaliacaoFisica = (id: string, corpo: import('./avaliacaoFisicaTipos').DadosAvaliacaoFisica) =>
  requisicao<import('./avaliacaoFisicaTipos').AvaliacaoFisica>(`/avaliacoes-fisicas/${seg(id)}`, { metodo: 'PUT', corpo });
/** Com a versão que está na tela: outra aba que editou antes faz o excluir voltar 409. */
export const excluirAvaliacaoFisica = (id: string, versao: number) =>
  requisicao<void>(`/avaliacoes-fisicas/${seg(id)}?versao=${seg(versao)}`, { metodo: 'DELETE' });
/** As do próprio aluno, só leitura. */
export const minhasAvaliacoesFisicas = () =>
  requisicao<import('./avaliacaoFisicaTipos').AvaliacaoFisica[]>('/aluno/avaliacoes-fisicas');

// ---- Vitrine da consultoria (só com `vitrineHabilitada`; `VITRINE_LER`/`VITRINE_ALTERAR`; plano `docs/planos/vitrine-e-loja.md`) ----
/** Todos os itens (ativos e inativos), na ordem da vitrine; no máximo 30. */
export const itensDaVitrine = () => requisicao<import('./vitrineTipos').ItemDaVitrine[]>('/vitrine/itens');
/** 422 `VITRINE_ITEM_INVALIDO` com `fieldErrors`; 409 `VITRINE_LIMITE` no teto de 30. */
export const criarItemDaVitrine = (corpo: import('./vitrineTipos').DadosDoItem) =>
  requisicao<import('./vitrineTipos').ItemDaVitrine>('/vitrine/itens', { metodo: 'POST', corpo });
/** O corpo leva `versao`; 409 `CONFLITO_EDICAO` se outra aba editou antes. */
export const alterarItemDaVitrine = (id: string, corpo: import('./vitrineTipos').DadosDoItem) =>
  requisicao<import('./vitrineTipos').ItemDaVitrine>(`/vitrine/itens/${seg(id)}`, { metodo: 'PUT', corpo });
export const excluirItemDaVitrine = (id: string, versao: number) =>
  requisicao<void>(`/vitrine/itens/${seg(id)}?versao=${seg(versao)}`, { metodo: 'DELETE' });
/** Subir/Descer: manda todos os ids na nova ordem. */
export const ordenarItensDaVitrine = (ids: readonly string[]) =>
  requisicao<void>('/vitrine/itens/ordem', { metodo: 'PUT', corpo: { ids } });
/** `arquivo`: FormData com `arquivo` (JPEG já reduzido a 1600 px e sem EXIF, até 300 KB). Troca a foto atual. */
export const trocarFotoDoItem = (id: string, arquivo: FormData) =>
  requisicao<import('./vitrineTipos').ItemDaVitrine>(`/vitrine/itens/${seg(id)}/foto`, { metodo: 'PUT', corpoBruto: arquivo, limiteMs: 60000 });
export const removerFotoDoItem = (id: string) => requisicao<void>(`/vitrine/itens/${seg(id)}/foto`, { metodo: 'DELETE' });
/** Equipe (`VITRINE_LER`); 404 = sem foto. */
export const baixarFotoDoItem = (id: string) => requisicao<Blob>(`/vitrine/itens/${seg(id)}/foto`, { binario: true, limiteMs: 30000 });
/** Do aluno: só itens ativos da própria consultoria. */
export const vitrineDoAluno = () => requisicao<import('./vitrineTipos').ItemDaVitrineDoAluno[]>('/aluno/vitrine');
/** Do aluno: 404 = sem foto ou item que ele não vê. */
export const baixarFotoDoItemDoAluno = (id: string) =>
  requisicao<Blob>(`/aluno/vitrine/itens/${seg(id)}/foto`, { binario: true, limiteMs: 30000 });

// ---- Página pública da loja (F2a; configuração com `VITRINE_LER`/`VITRINE_ALTERAR`; leitura pública sem login) ----
/** Configuração da página (`paginaLigada`, `codigo`, `versao`); sem configuração ainda, tudo nulo e desligada. */
export const paginaDaVitrine = () => requisicao<import('./vitrineTipos').PaginaDaVitrine>('/vitrine/configuracao');
/** Grava o estado inteiro: o corpo exige `paginaLigada` e `noMarketplace` (ausente = falso na API). 409 `CONFLITO_EDICAO` (recarregar); 422 `VITRINE_PAGINA_INVALIDA` no campo `paginaLigada`. */
export const gravarPaginaDaVitrine = (corpo: import('./vitrineTipos').DadosDaPagina) =>
  requisicao<import('./vitrineTipos').PaginaDaVitrine>('/vitrine/configuracao', { metodo: 'PUT', corpo });
/** Código novo: o link antigo passa a dar 404. 409 `CONFLITO_EDICAO`. */
export const novoLinkDaVitrine = (versao: number) =>
  requisicao<import('./vitrineTipos').PaginaDaVitrine>('/vitrine/configuracao/novo-link', { metodo: 'POST', corpo: { versao } });
/** Pública (molde de `inscricaoPublica`): o código vem de `codigoDaLoja`. 404 igual para inexistente, desligada e malformado; 429 com `Retry-After`. */
export const lojaPublica = (codigo: string) =>
  requisicao<import('./vitrineTipos').LojaPublica>(`/publico/loja/${seg(codigo)}`, { semRenovar: true });
/**
 * Caminho (não a imagem) da foto pública do item, para `urlDaApi` num `<Image>`: sem token. `versao` = `fotoAtualizadaEm`,
 * chave para buscar de novo depois da troca (a API ignora o parâmetro).
 */
export const caminhoDaFotoDaLoja = (codigo: string, itemId: string, versao?: string | null) =>
  `/publico/loja/${seg(codigo)}/itens/${seg(itemId)}/foto${versao ? `?v=${seg(versao)}` : ''}`;
/**
 * Lista pública de consultorias (F3), sem login: `pagina` base 0, `tamanho` até 100 (o servidor corta). 503 `MARKETPLACE_INDISPONIVEL`
 * (chave desligada) e 404 viram "Página não encontrada."; 429 com `Retry-After`. A foto do item é a da loja (`caminhoDaFotoDaLoja`).
 */
export const lojasPublicas = (pagina: number, tamanho: number) =>
  requisicao<import('./vitrineTipos').MarketplaceResposta>(`/publico/lojas?pagina=${seg(pagina)}&tamanho=${seg(tamanho)}`, { semRenovar: true });
