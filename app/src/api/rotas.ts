import { requisicao } from './cliente';
import type {
  AlterarContratacaoRequest,
  BaixaManualRequest,
  ContratacaoResponse,
  ContratarRequest,
  FinanceiroDoAluno,
  FiltroDeSituacao,
  LancamentoRequest,
  LancamentoResponse,
  MotivoRequest,
  Painel,
  PaginaCobrancas,
  PaginaInadimplentes,
  PaginaLancamentos,
  CobrancaResponse,
  PlanoRequest,
  PlanoResponse,
} from './financeiroTipos';
import type { PerfilEquipe, PerfilEquipeRequest, PermissaoEquipe, MembroEquipe, ConviteEquipe, ResponsavelEquipe, PaginaAuditoria } from './equipeTipos';
import type {
  AceiteInscricao,
  AlterarInscricaoRequest,
  ConfiguracaoInscricao,
  ConfiguracaoInscricaoRequest,
  FiltroInscricoes,
  InscricaoDetalhe,
  InscricaoPublica,
  InscricaoPublicaRequest,
  PaginaInscricoes,
} from './inscricoesTipos';
import type {
  Atualizacao,
  AtualizacaoDaLista,
  EvolucaoRespostas,
  ConfiguracaoDeFotos,
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
  AlunoRequest,
  CatalogoAlimento,
  CatalogoExercicio,
  PaginaCatalogo,
  ConsumoDoPlano,
  ConsultoriaResponse,
  ConteudoDieta,
  ConteudoMobilidadeApi,
  ConviteGerado,
  ConvitePublico,
  ConviteEquipePublico,
  DiaDeTreino,
  EuResponse,
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
  PlanoResumo,
  PreviaCsv,
  ProgressoPonto,
  Receita,
  RegistroEnvio,
  RegistroMobilidadeEnvio,
  RegistroMobilidadeFeito,
  RegistroPeso,
  ResultadoValidacao,
  SituacaoFiltro,
  SuplementoDaBiblioteca,
  SuplementoDaBibliotecaRequest,
  ErgogenicoDaBiblioteca,
  ErgogenicoDaBibliotecaRequest,
  EnderecoDoCep,
  Tema,
  TipoPlano,
  TipoReceita,
  VersaoDetalhe,
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
/** Marca da consultoria do convite de equipe; o código vai só no corpo. Código inválido, vencido ou aceito = 404 igual. */
export const consultarConviteEquipe = (codigo:string) => requisicao<ConviteEquipePublico>('/publico/convites-equipe/consultar',{metodo:'POST',corpo:{codigo},semRenovar:true});
export const aceitarConviteEquipe = (codigo:string,senha:string) => requisicao<LoginResponse>('/publico/convites-equipe/aceitar',{metodo:'POST',corpo:{codigo,senha},semRenovar:true});
/** "Esqueci a senha": a API responde 202 exista a conta ou não. `turnstileToken` (uso único) só quando a verificação humana está ligada. */
export const pedirRedefinicaoDeSenha = (email:string,turnstileToken?:string) => requisicao<void>('/auth/esqueci-senha',{metodo:'POST',corpo:turnstileToken?{email,turnstileToken}:{email},semRenovar:true});
/** Com o token do link do e-mail; não abre sessão. Com MFA ativo a API pede `codigoMfa` (401 `MFA_NECESSARIO`). */
export const redefinirSenha = (token:string,novaSenha:string,codigoMfa?:string) => requisicao<void>('/auth/redefinir-senha',{metodo:'POST',corpo:{token,novaSenha,codigoMfa},semRenovar:true});
export const responsaveisEquipe = () => requisicao<ResponsavelEquipe[]>('/responsaveis');
export const alterarMeuPerfil = (nome:string,telefone:string|null) => requisicao<EuResponse>('/eu',{metodo:'PUT',corpo:{nome,telefone}});
export const listarAuditoria = (filtro:{de?:string;ate?:string;usuarioId?:string;acao?:string;pagina:number}) => {
  const q=new URLSearchParams();for(const [campo,valor] of Object.entries(filtro)) if(valor!==undefined&&valor!=='') q.set(campo,String(valor));
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
export const listarQuestionarios = (arquivados = false, finalidade: FinalidadeQuestionario = 'ATUALIZACAO') =>
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
export const listarAtualizacoes = (situacao: SituacaoAtualizacao, meus = false) =>
  requisicao<AtualizacaoDaLista[]>(`/atualizacoes?situacao=${situacao}&meus=${meus}`);
export const atualizacoesDoAluno = (id: string) => requisicao<Atualizacao[]>(`/alunos/${seg(id)}/atualizacoes`);
export const atualizacaoDoAluno = (id: string) => requisicao<Atualizacao>(`/alunos/${seg(id)}/atualizacao`);
export const evolucaoRespostasDoAluno = (id: string) =>
  requisicao<EvolucaoRespostas>(`/alunos/${seg(id)}/atualizacoes/evolucao`);

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

/** 404 = sem foto. */
export const baixarFotoDePerfil = () => requisicao<Blob>('/aluno/foto-perfil', { binario: true, limiteMs: 30000 });

/** Equipe (ALUNO_LER); 404 = sem foto. */
export const baixarFotoDePerfilDoAluno = (alunoId: string) =>
  requisicao<Blob>(`/alunos/${seg(alunoId)}/foto-perfil`, { binario: true, limiteMs: 30000 });

export const baixarFotoDoTreinador = (atualizacaoId: string, fotoId: string) =>
  requisicao<Blob>(`/atualizacoes/${seg(atualizacaoId)}/fotos/${seg(fotoId)}`, { binario: true, limiteMs: 60000 });
export const detalheAtualizacao = (id: string) => requisicao<Atualizacao>(`/atualizacoes/${seg(id)}`);
export const responderAtualizacao = (id: string, texto: string, versao: number) =>
  requisicao<Atualizacao>(`/atualizacoes/${seg(id)}/feedback`, { metodo: 'PUT', corpo: { texto, versao } });

/** Uma função por rota da API. As telas não montam URL nem método. */

// ---- Sessão ----

/** `turnstileToken`: token de uso único do widget, só quando a verificação humana está ligada (vale no 1º envio e no do MFA). */
export const entrar = (email: string, senha: string, codigoMfa?: string, turnstileToken?: string) =>
  requisicao<LoginResponse>('/auth/login', {
    metodo: 'POST',
    corpo: { email, senha, ...(codigoMfa ? { codigoMfa } : {}), ...(turnstileToken ? { turnstileToken } : {}) },
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

export const aceitarTermos = (versao: string) =>
  requisicao<TermosVigentes>('/termos/aceite', { metodo: 'POST', corpo: { versao } });

export const trocarSenha = (senhaAtual: string, senhaNova: string) =>
  requisicao<LoginResponse>('/eu/senha', { metodo: 'PUT', corpo: { senhaAtual, senhaNova } });

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
  requisicao<{ mensagem: string }>(`/publico/inscricoes/${seg(codigo)}`, { metodo: 'POST', corpo, semRenovar: true });

// ---- Treinador: interessados (fila de inscrições) ----

export const configuracaoInscricao = () => requisicao<ConfiguracaoInscricao>('/inscricoes/configuracao');

export const alterarConfiguracaoInscricao = (corpo: ConfiguracaoInscricaoRequest) =>
  requisicao<ConfiguracaoInscricao>('/inscricoes/configuracao', { metodo: 'PUT', corpo });

/** Troca o código: o link anterior para de valer na hora. */
export const novoLinkInscricao = (versao: number | null) =>
  requisicao<ConfiguracaoInscricao>('/inscricoes/configuracao/novo-link', { metodo: 'POST', corpo: { versao } });

export const listarInscricoes = (filtro: { situacao: FiltroInscricoes; meus: boolean; pagina: number }) => {
  const q = new URLSearchParams();
  q.set('situacao', filtro.situacao);
  q.set('meus', String(filtro.meus));
  q.set('pagina', String(filtro.pagina));
  return requisicao<PaginaInscricoes>(`/inscricoes?${q.toString()}`);
};

export const inscricao = (id: string) => requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}`);

export const alterarInscricao = (id: string, corpo: AlterarInscricaoRequest) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}`, { metodo: 'PUT', corpo });

export const notaNaInscricao = (id: string, texto: string) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/notas`, { metodo: 'POST', corpo: { texto } });

export const recusarInscricao = (id: string, versao: number) =>
  requisicao<InscricaoDetalhe>(`/inscricoes/${seg(id)}/recusar`, { metodo: 'POST', corpo: { versao } });

/** Cria o aluno; com `convidar`, o convite de acesso vem na resposta (o código só aparece aqui). */
export const aceitarInscricao = (id: string, convidar: boolean, versao: number) =>
  requisicao<AceiteInscricao>(`/inscricoes/${seg(id)}/aceitar`, { metodo: 'POST', corpo: { convidar, versao } });

// ---- Treinador: marca e configuração ----

export const consultoria = () => requisicao<ConsultoriaResponse>('/consultoria');

export const alterarMarca = (dados: {
  nome: string;
  corPrimaria: string;
  fonteTitulo: Fonte;
  temaPadrao: Tema;
  versao: number;
  diasAtualizacaoPadrao: number | null;
}) => requisicao<ConsultoriaResponse>('/consultoria/marca', { metodo: 'PUT', corpo: dados });

/** `arquivo`: FormData já montado (web: File; nativo: {uri, name, type}). */
export const enviarLogo = (arquivo: FormData) =>
  requisicao<Marca>('/consultoria/marca/logo', { metodo: 'PUT', corpoBruto: arquivo });

export const removerLogo = () => requisicao<Marca>('/consultoria/marca/logo', { metodo: 'DELETE' });

// ---- Treinador: início ----

export const painelTreinador = (meus=false, diasSemRegistro=7) => requisicao<PainelTreinador>(`/painel?meus=${meus}&dias=${diasSemRegistro}`);

/** Relatório da consultoria (`PAINEL_VER`): contagens dos últimos 6 meses, sem nomes. */
export const numerosDaConsultoria = () => requisicao<NumerosDaConsultoria>('/numeros');

// ---- Treinador: alunos ----

export const listarAlunos = (filtro: { busca?: string; situacao?: SituacaoFiltro; pagina?: number; meus?:boolean }) => {
  const q = new URLSearchParams();
  if (filtro.busca) q.set('busca', filtro.busca);
  q.set('situacao', filtro.situacao ?? 'ATIVO');
  q.set('pagina', String(filtro.pagina ?? 0));
  q.set('meus', String(filtro.meus ?? false));
  return requisicao<PaginaAlunos>(`/alunos?${q.toString()}`);
};

export const criarAluno = (dados: AlunoRequest) => requisicao<AlunoDetalhe>('/alunos', { metodo: 'POST', corpo: dados });

export const aluno = (id: string) => requisicao<AlunoDetalhe>(`/alunos/${seg(id)}`);

export const alterarAluno = (id: string, dados: AlunoRequest) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}`, { metodo: 'PUT', corpo: dados });

export const alterarSituacaoAluno = (id: string, ativo: boolean) =>
  requisicao<AlunoDetalhe>(`/alunos/${seg(id)}/situacao`, { metodo: 'PATCH', corpo: { ativo } });

/** Ações em lote da lista de alunos: tudo ou nada; `alterados` deixa de fora quem já estava como pedido. */
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

export const execucoesDoAluno = (id: string, de: string, ate: string) =>
  requisicao<DiaDeTreino[]>(`/alunos/${seg(id)}/execucoes?de=${de}&ate=${ate}`);

export const mobilidadeFeitaDoAluno = (id: string, de: string, ate: string) =>
  requisicao<RegistroMobilidadeFeito[]>(`/alunos/${seg(id)}/mobilidade/registros?de=${de}&ate=${ate}`);

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
export const criarExercicio = (dados: ExercicioRequest) =>
  requisicao<Exercicio>('/exercicios', { metodo: 'POST', corpo: dados });
export const alterarExercicio = (id: string, dados: ExercicioRequest) =>
  requisicao<Exercicio>(`/exercicios/${seg(id)}`, { metodo: 'PUT', corpo: dados });
export const inativarExercicio = (id: string) => requisicao<void>(`/exercicios/${seg(id)}`, { metodo: 'DELETE' });

export const listarAlimentos = (texto?: string) => requisicao<Alimento[]>(`/alimentos${busca(texto)}`);
/** Fatores atuais dos alimentos (até 200 ids) para a lista de compras do editor da dieta; id de fora fica sem resposta. */
export const fatoresDosAlimentos = (ids: string[]) =>
  requisicao<FatoresDoAlimento[]>(`/alimentos/fatores?ids=${ids.map(seg).join(',')}`);
export const criarAlimento = (dados: AlimentoRequest) =>
  requisicao<Alimento>('/alimentos', { metodo: 'POST', corpo: dados });
export const alterarAlimento = (id: string, dados: AlimentoRequest) =>
  requisicao<Alimento>(`/alimentos/${seg(id)}`, { metodo: 'PUT', corpo: dados });
export const inativarAlimento = (id: string) => requisicao<void>(`/alimentos/${seg(id)}`, { metodo: 'DELETE' });

const consulta = (filtros: Record<string, string | undefined>) => {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return partes.length ? `?${partes.join('&')}` : '';
};

export const catalogoExercicios = (texto?: string, grupo?: string) =>
  requisicao<PaginaCatalogo<CatalogoExercicio>>(`/catalogo/exercicios${consulta({ busca: texto, grupo })}`);
export const catalogoAlimentos = (texto?: string, grupo?: string) =>
  requisicao<PaginaCatalogo<CatalogoAlimento>>(`/catalogo/alimentos${consulta({ busca: texto, grupo })}`);
export const gruposDoCatalogo = (tipo: TipoBiblioteca) => requisicao<string[]>(`/catalogo/${seg(tipo)}/grupos`);

export type TipoBiblioteca = 'exercicios' | 'alimentos';

export const importarDoCatalogo = (tipo: TipoBiblioteca, ids: string[]) =>
  requisicao<ImportacaoResultado>(`/${seg(tipo)}/importar-catalogo`, { metodo: 'POST', corpo: { ids } });

export const previaCsv = (tipo: TipoBiblioteca, texto: string) =>
  requisicao<PreviaCsv>(`/${seg(tipo)}/importar-csv?confirmar=false`, {
    metodo: 'POST',
    corpoBruto: texto,
    tipoConteudo: 'text/plain;charset=UTF-8',
  });

export const confirmarCsv = (tipo: TipoBiblioteca, texto: string, hash: string) =>
  requisicao<ImportacaoResultado>(`/${seg(tipo)}/importar-csv?confirmar=true&hash=${encodeURIComponent(hash)}`, {
    metodo: 'POST',
    corpoBruto: texto,
    tipoConteudo: 'text/plain;charset=UTF-8',
  });

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

export const publicarPlano = <C>(tipo: TipoPlano, id: string, versao: number, confirmarAvisos: boolean) =>
  requisicao<PlanoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}/publicar`, {
    metodo: 'POST',
    corpo: { versao, confirmarAvisos },
  });

export const replicarPlano = <C>(tipo: TipoPlano, id: string, dados: Omit<NovoPlano, 'receitaId' | 'copiarDoPlanoId'>) =>
  requisicao<PlanoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}/replicar`, { metodo: 'POST', corpo: dados });

/** Sem `pastaId`, nasce uma pasta nova no destino (com `titulo`, `inicio` e `fim`); com ele, o período é o da pasta. */
export const copiarPlanoParaAluno = (tipo: TipoPlano, id: string, dados: { alunoId: string; pastaId: string | null; titulo: string; inicio: string | null; fim: string | null }) =>
  requisicao<CopiaDePlano>(`/${seg(prefixo(tipo))}/${seg(id)}/copiar-para-aluno`, { metodo: 'POST', corpo: dados });

export const salvarPlanoComoReceita =(tipo: TipoPlano, id: string, nome: string, descricao: string | null) =>
  requisicao<Receita>(`/${seg(prefixo(tipo))}/${seg(id)}/salvar-como-receita`, { metodo: 'POST', corpo: { nome, descricao } });

// ---- Aluno (sempre o aluno do token) ----

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

export const historicoAluno = (de: string, ate: string) => requisicao<DiaDeTreino[]>(`/aluno/execucoes?de=${de}&ate=${ate}`);

export const progressoAluno = (exercicioId: string) =>
  requisicao<ProgressoPonto[]>(`/aluno/progresso?exercicioId=${encodeURIComponent(exercicioId)}`);

export const pesosAluno = () => requisicao<RegistroPeso[]>('/aluno/pesos');

export const versaoPlano = <C>(tipo: TipoPlano, id: string, numero: number) =>
  requisicao<VersaoDetalhe<C>>(`/${seg(prefixo(tipo))}/${seg(id)}/versoes/${seg(numero)}`);

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

export const listarSuplementos = () => requisicao<SuplementoDaBiblioteca[]>('/suplementos');
export const criarSuplemento = (dados: SuplementoDaBibliotecaRequest) =>
  requisicao<SuplementoDaBiblioteca>('/suplementos', { metodo: 'POST', corpo: dados });
export const alterarSuplemento = (id: string, dados: SuplementoDaBibliotecaRequest) =>
  requisicao<SuplementoDaBiblioteca>(`/suplementos/${seg(id)}`, { metodo: 'PUT', corpo: dados });
export const inativarSuplemento = (id: string) => requisicao<void>(`/suplementos/${seg(id)}`, { metodo: 'DELETE' });

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
export const mudarSituacaoDaContratacao = (id: string, acao: 'pausar' | 'retomar' | 'encerrar', versao: number) =>
  requisicao<ContratacaoResponse>(`/contratacoes/${seg(id)}/${acao}`, { metodo: 'POST', corpo: { versao } });

export const listarCobrancasDoAluno = (alunoId: string) =>
  requisicao<CobrancaResponse[]>(`/alunos/${seg(alunoId)}/cobrancas`);
export const listarCobrancas = (filtro: { situacao?: FiltroDeSituacao; de?: string; ate?: string; meus?: boolean; pagina?: number }) =>
  requisicao<PaginaCobrancas>(
    `/financeiro/cobrancas${consultaFinanceiro({
      situacao: filtro.situacao === 'TODAS' ? undefined : filtro.situacao,
      de: filtro.de,
      ate: filtro.ate,
      meus: filtro.meus ? true : undefined,
      pagina: filtro.pagina ?? 0,
    })}`,
  );
export const registrarPagamentoManual = (id: string, corpo: BaixaManualRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/baixa-manual`, { metodo: 'POST', corpo });
export const desfazerBaixaDaCobranca = (id: string, corpo: MotivoRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/desfazer-baixa`, { metodo: 'POST', corpo });
export const cancelarCobranca = (id: string, corpo: MotivoRequest) =>
  requisicao<CobrancaResponse>(`/cobrancas/${seg(id)}/cancelar`, { metodo: 'POST', corpo });

export const painelFinanceiro = (filtro: { de: string; ate: string; meus: boolean }) =>
  requisicao<Painel>(`/financeiro/painel${consultaFinanceiro({ de: filtro.de, ate: filtro.ate, meus: filtro.meus ? true : undefined })}`);
export const listarInadimplentes = (filtro: { meus: boolean; pagina?: number }) =>
  requisicao<PaginaInadimplentes>(`/financeiro/inadimplentes${consultaFinanceiro({ meus: filtro.meus ? true : undefined, pagina: filtro.pagina ?? 0 })}`);
/** CSV como texto (cobranças e lançamentos do período). 422 se passar de 5.000 linhas. */
export const exportarFinanceiro = (de: string, ate: string) =>
  requisicao<string>(`/financeiro/exportacao${consultaFinanceiro({ de, ate })}`, { aceita: 'text/csv' });

export const listarLancamentos = (filtro: { de?: string; ate?: string; pagina?: number } = {}) =>
  requisicao<PaginaLancamentos>(`/financeiro/lancamentos${consultaFinanceiro({ de: filtro.de, ate: filtro.ate, pagina: filtro.pagina ?? 0 })}`);
export const criarLancamento = (corpo: LancamentoRequest) =>
  requisicao<LancamentoResponse>('/financeiro/lancamentos', { metodo: 'POST', corpo });
export const alterarLancamento = (id: string, corpo: LancamentoRequest) =>
  requisicao<LancamentoResponse>(`/financeiro/lancamentos/${seg(id)}`, { metodo: 'PUT', corpo });
/** A versão vai na query, não no corpo. */
export const excluirLancamento = (id: string, versao: number) =>
  requisicao<void>(`/financeiro/lancamentos/${seg(id)}${consultaFinanceiro({ versao })}`, { metodo: 'DELETE' });

/** O que o aluno vê do próprio plano e das cobranças. `plano` nulo = nada contratado. */
export const financeiroDoAluno = () => requisicao<FinanceiroDoAluno>('/aluno/financeiro');
