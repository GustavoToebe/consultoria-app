import { requisicao } from './cliente';
import type { PerfilEquipe, PerfilEquipeRequest, PermissaoEquipe, MembroEquipe, ConviteEquipe, ResponsavelEquipe, PaginaAuditoria } from './equipeTipos';
import type {
  Atualizacao,
  AtualizacaoDaLista,
  ConfiguracaoDeFotos,
  ConfiguracaoPublica,
  CriarQuestionarioRequest,
  OpcaoQuestionario,
  ResultadoLote,
  QuestionarioDetalhe,
  QuestionarioResumo,
  SalvarQuestionarioRequest,
  RespostasAtualizacao,
  SituacaoAtualizacao,
  Alimento,
  AlimentoRequest,
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
  RegistroPeso,
  ResultadoValidacao,
  SituacaoFiltro,
  SuplementoDaBiblioteca,
  SuplementoDaBibliotecaRequest,
  ErgogenicoDaBiblioteca,
  ErgogenicoDaBibliotecaRequest,
  Tema,
  TipoPlano,
  TipoReceita,
  VersaoDetalhe,
} from './tipos';

export const perfisEquipe = () => requisicao<PerfilEquipe[]>('/perfis');
export const catalogoPermissoes = () => requisicao<PermissaoEquipe[]>('/permissoes/catalogo');
export const criarPerfilEquipe = (corpo:PerfilEquipeRequest) => requisicao<PerfilEquipe>('/perfis',{metodo:'POST',corpo});
export const alterarPerfilEquipe = (id:string,corpo:PerfilEquipeRequest) => requisicao<PerfilEquipe>(`/perfis/${id}`,{metodo:'PUT',corpo});
export const duplicarPerfilEquipe = (id:string) => requisicao<PerfilEquipe>(`/perfis/${id}/duplicar`,{metodo:'POST'});
export const excluirPerfilEquipe = (id:string) => requisicao<void>(`/perfis/${id}`,{metodo:'DELETE'});
export const membrosEquipe = () => requisicao<MembroEquipe[]>('/usuarios');
export const pessoasAuditoria = () => requisicao<ResponsavelEquipe[]>('/auditoria/pessoas');
export const convidarMembro = (corpo:{nome:string;email:string;perfilId:string}) => requisicao<ConviteEquipe>('/usuarios/convites',{metodo:'POST',corpo});
export const cancelarConviteEquipe = (id:string) => requisicao<void>(`/usuarios/convites/${id}`,{metodo:'DELETE'});
export const alterarMembro = (id:string,corpo:{nome:string;perfilId:string;ativo:boolean}) => requisicao<MembroEquipe>(`/usuarios/${id}`,{metodo:'PUT',corpo});
export const aceitarConviteEquipe = (codigo:string,senha:string) => requisicao<LoginResponse>(`/publico/convites-equipe/${encodeURIComponent(codigo)}`,{metodo:'POST',corpo:{senha},semRenovar:true});
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
export const detalheAtualizacaoAluno = (id: string) => requisicao<Atualizacao>(`/aluno/atualizacoes/${id}`);
/** A API confere o id da versão respondida: se o treinador publicou outra no meio, responde 409. */
export const enviarAtualizacao = (pastaId: string, questionarioVersaoId: string, respostas: RespostasAtualizacao) =>
  requisicao<Atualizacao>('/aluno/atualizacao/enviar', { metodo: 'POST', corpo: { pastaId, questionarioVersaoId, respostas } });
// Questionários de atualização (gestão pelo treinador; a API autoriza pelo banco).
export const listarQuestionarios = (arquivados = false) => requisicao<QuestionarioResumo[]>(`/questionarios?arquivados=${arquivados}`);
export const opcoesDeQuestionario = () => requisicao<OpcaoQuestionario[]>('/questionarios/opcoes');
export const criarQuestionario = (corpo: CriarQuestionarioRequest) => requisicao<QuestionarioDetalhe>('/questionarios', { metodo: 'POST', corpo });
export const buscarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${id}`);
export const salvarQuestionario = (id: string, corpo: SalvarQuestionarioRequest) => requisicao<QuestionarioDetalhe>(`/questionarios/${id}`, { metodo: 'PUT', corpo });
export const publicarQuestionario = (id: string, versao: number, confirmarAvisos: boolean) =>
  requisicao<QuestionarioDetalhe>(`/questionarios/${id}/publicar`, { metodo: 'POST', corpo: { versao, confirmarAvisos } });
export const duplicarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${id}/duplicar`, { metodo: 'POST' });
export const definirQuestionarioPadrao = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${id}/padrao`, { metodo: 'POST' });
export const arquivarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${id}/arquivar`, { metodo: 'POST' });
export const desarquivarQuestionario = (id: string) => requisicao<QuestionarioDetalhe>(`/questionarios/${id}/desarquivar`, { metodo: 'POST' });
export const excluirQuestionario = (id: string) => requisicao<void>(`/questionarios/${id}`, { metodo: 'DELETE' });
/** `null` volta ao padrão (aluno) ou ao questionário do aluno (pasta). */
export const escolherQuestionarioDoAluno = (alunoId: string, questionarioId: string | null) =>
  requisicao<AlunoDetalhe>(`/alunos/${alunoId}/questionario`, { metodo: 'PUT', corpo: { questionarioId } });
export const escolherQuestionarioDaPasta = (pastaId: string, questionarioId: string | null) =>
  requisicao<PastaResumo>(`/pastas/${pastaId}/questionario`, { metodo: 'PUT', corpo: { questionarioId } });
export const avisarAtrasoAtualizacao = (pastaId: string, novaData: string, motivo?: string) =>
  requisicao<Atualizacao>('/aluno/atualizacao/atraso', { metodo: 'POST', corpo: { pastaId, novaData, motivo } });
export const marcarFeedbackVisto = (id: string) =>
  requisicao<void>(`/aluno/atualizacoes/${id}/feedback-visto`, { metodo: 'POST' });
export const listarAtualizacoes = (situacao: SituacaoAtualizacao, meus = false) =>
  requisicao<AtualizacaoDaLista[]>(`/atualizacoes?situacao=${situacao}&meus=${meus}`);
export const atualizacoesDoAluno = (id: string) => requisicao<Atualizacao[]>(`/alunos/${id}/atualizacoes`);
export const atualizacaoDoAluno = (id: string) => requisicao<Atualizacao>(`/alunos/${id}/atualizacao`);

// ---- Fotos da atualização (bytes só pela API, com token; nada de link direto para o bucket) ----

export const configuracaoDeFotos = () => requisicao<ConfiguracaoDeFotos>('/aluno/fotos/configuracao');

/** `arquivo`: FormData com o campo `arquivo` (JPEG já sem EXIF); `pastaId` vai junto. */
export const enviarFoto = (pastaId: string, arquivo: FormData) =>
  requisicao<{ id: string }>(`/aluno/fotos?pastaId=${encodeURIComponent(pastaId)}`, { metodo: 'POST', corpoBruto: arquivo, limiteMs: 60000 });

export const removerFoto = (id: string) => requisicao<void>(`/aluno/fotos/${id}`, { metodo: 'DELETE' });

export const baixarFotoDoAluno = (id: string) => requisicao<Blob>(`/aluno/fotos/${id}`, { binario: true, limiteMs: 60000 });

export const baixarFotoDoTreinador = (atualizacaoId: string, fotoId: string) =>
  requisicao<Blob>(`/atualizacoes/${atualizacaoId}/fotos/${fotoId}`, { binario: true, limiteMs: 60000 });
export const detalheAtualizacao = (id: string) => requisicao<Atualizacao>(`/atualizacoes/${id}`);
export const responderAtualizacao = (id: string, texto: string, versao: number) =>
  requisicao<Atualizacao>(`/atualizacoes/${id}/feedback`, { metodo: 'PUT', corpo: { texto, versao } });

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

// ---- Configuração pública ----

/** O que o app precisa saber antes do login (verificação humana e a chave pública do widget). `semCache` na busca de conferência. */
export const configuracaoPublica = (semCache = false) =>
  // Conferência forçada: além de `cache: 'no-store'` (o fetch do celular pode ignorar), um parâmetro novo fura o `max-age` da resposta.
  requisicao<ConfiguracaoPublica>(semCache ? `/publico/configuracao?r=${Date.now()}` : '/publico/configuracao', {
    semRenovar: true,
    semCache,
  });

// ---- Convite (público) ----

export const consultarConvite = (codigo: string) =>
  requisicao<ConvitePublico>(`/publico/convites/${encodeURIComponent(codigo)}`, { semRenovar: true });

export const aceitarConvite = (codigo: string, email: string, senha: string) =>
  requisicao<LoginResponse>(`/publico/convites/${encodeURIComponent(codigo)}/aceitar`, {
    metodo: 'POST',
    corpo: { email, senha },
    semRenovar: true,
  });

// ---- Treinador: marca e configuração ----

export const consultoria = () => requisicao<ConsultoriaResponse>('/consultoria');

export const alterarMarca = (dados: {
  nome: string;
  corPrimaria: string;
  fonteTitulo: Fonte;
  temaPadrao: Tema;
  versao: number;
}) => requisicao<ConsultoriaResponse>('/consultoria/marca', { metodo: 'PUT', corpo: dados });

/** `arquivo`: FormData já montado (web: File; nativo: {uri, name, type}). */
export const enviarLogo = (arquivo: FormData) =>
  requisicao<Marca>('/consultoria/marca/logo', { metodo: 'PUT', corpoBruto: arquivo });

export const removerLogo = () => requisicao<Marca>('/consultoria/marca/logo', { metodo: 'DELETE' });

// ---- Treinador: início ----

export const painelTreinador = (meus=false, diasSemRegistro=7) => requisicao<PainelTreinador>(`/painel?meus=${meus}&dias=${diasSemRegistro}`);

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

export const aluno = (id: string) => requisicao<AlunoDetalhe>(`/alunos/${id}`);

export const alterarAluno = (id: string, dados: AlunoRequest) =>
  requisicao<AlunoDetalhe>(`/alunos/${id}`, { metodo: 'PUT', corpo: dados });

export const alterarSituacaoAluno = (id: string, ativo: boolean) =>
  requisicao<AlunoDetalhe>(`/alunos/${id}/situacao`, { metodo: 'PATCH', corpo: { ativo } });

/** Ações em lote da lista de alunos: tudo ou nada; `alterados` deixa de fora quem já estava como pedido. */
export const trocarResponsavelEmLote = (alunoIds: string[], responsavelId: string) =>
  requisicao<ResultadoLote>('/alunos/lote/responsavel', { metodo: 'POST', corpo: { alunoIds, responsavelId } });

export const trocarQuestionarioEmLote = (alunoIds: string[], questionarioId: string | null) =>
  requisicao<ResultadoLote>('/alunos/lote/questionario', { metodo: 'POST', corpo: { alunoIds, questionarioId } });

export const desativarEmLote = (alunoIds: string[]) =>
  requisicao<ResultadoLote>('/alunos/lote/desativar', { metodo: 'POST', corpo: { alunoIds } });

/** Tudo o que a consultoria guarda do aluno; o app só grava o arquivo, sem interpretar. */
export const exportarAluno = (id: string) => requisicao<Record<string, unknown>>(`/alunos/${id}/exportacao`);

export const anonimizarAluno = (id: string, nomeConfirmado: string) =>
  requisicao<AlunoDetalhe>(`/alunos/${id}/anonimizar`, { metodo: 'POST', corpo: { nomeConfirmado } });

export const gerarConvite = (id: string) => requisicao<ConviteGerado>(`/alunos/${id}/convite`, { metodo: 'POST' });

export const execucoesDoAluno = (id: string, de: string, ate: string) =>
  requisicao<DiaDeTreino[]>(`/alunos/${id}/execucoes?de=${de}&ate=${ate}`);

export const progressoDoAluno = (id: string, exercicioId: string) =>
  requisicao<ProgressoPonto[]>(`/alunos/${id}/progresso?exercicioId=${encodeURIComponent(exercicioId)}`);

export const pesosDoAluno = (id: string) => requisicao<RegistroPeso[]>(`/alunos/${id}/pesos`);

export const registrarPeso = (id: string, dados: { data: string; pesoKg: number; observacao: string | null }) =>
  requisicao<RegistroPeso[]>(`/alunos/${id}/pesos`, { metodo: 'POST', corpo: dados });

export const listarLesoes = (alunoId: string) => requisicao<Lesao[]>(`/alunos/${alunoId}/lesoes`);

export const registrarLesao = (alunoId: string, dados: DadosLesao) =>
  requisicao<Lesao>(`/alunos/${alunoId}/lesoes`, { metodo: 'POST', corpo: dados });

export const alterarLesao = (alunoId: string, id: string, dados: DadosLesao) =>
  requisicao<Lesao>(`/alunos/${alunoId}/lesoes/${id}`, { metodo: 'PUT', corpo: dados });

export const excluirLesao = (alunoId: string, id: string) =>
  requisicao<void>(`/alunos/${alunoId}/lesoes/${id}`, { metodo: 'DELETE' });

export const excluirPeso = (id: string, pesoId: string) =>
  requisicao<void>(`/alunos/${id}/pesos/${pesoId}`, { metodo: 'DELETE' });

// ---- Treinador: biblioteca ----

const busca = (texto?: string) => (texto ? `?busca=${encodeURIComponent(texto)}` : '');

export const listarExercicios = (texto?: string) => requisicao<Exercicio[]>(`/exercicios${busca(texto)}`);
export const criarExercicio = (dados: ExercicioRequest) =>
  requisicao<Exercicio>('/exercicios', { metodo: 'POST', corpo: dados });
export const alterarExercicio = (id: string, dados: ExercicioRequest) =>
  requisicao<Exercicio>(`/exercicios/${id}`, { metodo: 'PUT', corpo: dados });
export const inativarExercicio = (id: string) => requisicao<void>(`/exercicios/${id}`, { metodo: 'DELETE' });

export const listarAlimentos = (texto?: string) => requisicao<Alimento[]>(`/alimentos${busca(texto)}`);
export const criarAlimento = (dados: AlimentoRequest) =>
  requisicao<Alimento>('/alimentos', { metodo: 'POST', corpo: dados });
export const alterarAlimento = (id: string, dados: AlimentoRequest) =>
  requisicao<Alimento>(`/alimentos/${id}`, { metodo: 'PUT', corpo: dados });
export const inativarAlimento = (id: string) => requisicao<void>(`/alimentos/${id}`, { metodo: 'DELETE' });

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
export const gruposDoCatalogo = (tipo: TipoBiblioteca) => requisicao<string[]>(`/catalogo/${tipo}/grupos`);

export type TipoBiblioteca = 'exercicios' | 'alimentos';

export const importarDoCatalogo = (tipo: TipoBiblioteca, ids: string[]) =>
  requisicao<ImportacaoResultado>(`/${tipo}/importar-catalogo`, { metodo: 'POST', corpo: { ids } });

export const previaCsv = (tipo: TipoBiblioteca, texto: string) =>
  requisicao<PreviaCsv>(`/${tipo}/importar-csv?confirmar=false`, {
    metodo: 'POST',
    corpoBruto: texto,
    tipoConteudo: 'text/plain;charset=UTF-8',
  });

export const confirmarCsv = (tipo: TipoBiblioteca, texto: string, hash: string) =>
  requisicao<ImportacaoResultado>(`/${tipo}/importar-csv?confirmar=true&hash=${encodeURIComponent(hash)}`, {
    metodo: 'POST',
    corpoBruto: texto,
    tipoConteudo: 'text/plain;charset=UTF-8',
  });

// ---- Treinador: receitas ----

type ReceitaRequest = { tipo: TipoReceita; nome: string; descricao: string | null; conteudo: unknown; pastaId?: string | null; versao?: number };

export const listarReceitas = (tipo?: TipoReceita) => requisicao<Receita[]>(`/receitas${tipo ? `?tipo=${tipo}` : ''}`);

export const criarReceita = (dados: ReceitaRequest) => requisicao<Receita>('/receitas', { metodo: 'POST', corpo: dados });

export const alterarReceita = (id: string, dados: ReceitaRequest) =>
  requisicao<Receita>(`/receitas/${id}`, { metodo: 'PUT', corpo: dados });

export const excluirReceita = (id: string) => requisicao<void>(`/receitas/${id}`, { metodo: 'DELETE' });

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

export const listarPastas = (alunoId: string) => requisicao<PastaResumo[]>(`/alunos/${alunoId}/pastas`);
export const pastaVigenteDoAluno = (alunoId: string) => requisicao<PastaVigenteResposta>(`/alunos/${alunoId}/pastas/vigente`);

export const criarPasta = (alunoId: string, dados: DadosPasta) =>
  requisicao<PastaResumo>(`/alunos/${alunoId}/pastas`, { metodo: 'POST', corpo: dados });

export const atualizarPasta = (id: string, dados: DadosPasta) =>
  requisicao<PastaResumo>(`/pastas/${id}`, { metodo: 'PUT', corpo: dados });

export const replicarPasta = (id: string, dados: DadosPasta) =>
  requisicao<PastaResumo>(`/pastas/${id}/replicar`, { metodo: 'POST', corpo: dados });

export const finalizarPasta = (id: string, dados: import('./tipos').FinalizarPastaRequest) =>
  requisicao<PastaResumo>(`/pastas/${id}/finalizar`, { metodo: 'POST', corpo: dados });

export const reabrirPasta = (id: string) => requisicao<PastaResumo>(`/pastas/${id}/reabrir`, { metodo: 'POST' });

export const listarPlanos = (tipo: TipoPlano, alunoId: string) =>
  requisicao<PlanoResumo[]>(`/alunos/${alunoId}/${prefixo(tipo)}`);

export const criarPlano = <C>(tipo: TipoPlano, alunoId: string, dados: NovoPlano) =>
  requisicao<PlanoDetalhe<C>>(`/alunos/${alunoId}/${prefixo(tipo)}`, { metodo: 'POST', corpo: dados });

export const plano = <C>(tipo: TipoPlano, id: string) => requisicao<PlanoDetalhe<C>>(`/${prefixo(tipo)}/${id}`);

export const salvarRascunho = <C>(
  tipo: TipoPlano,
  id: string,
  dados: { titulo: string; inicio: string | null; fim: string | null; conteudo: C; versao: number },
) => requisicao<PlanoDetalhe<C>>(`/${prefixo(tipo)}/${id}/rascunho`, { metodo: 'PUT', corpo: dados });

export const validarPlano = (tipo: TipoPlano, id: string) =>
  requisicao<ResultadoValidacao>(`/${prefixo(tipo)}/${id}/validar`, { metodo: 'POST' });

export const publicarPlano = <C>(tipo: TipoPlano, id: string, versao: number, confirmarAvisos: boolean) =>
  requisicao<PlanoDetalhe<C>>(`/${prefixo(tipo)}/${id}/publicar`, {
    metodo: 'POST',
    corpo: { versao, confirmarAvisos },
  });

export const replicarPlano = <C>(tipo: TipoPlano, id: string, dados: Omit<NovoPlano, 'receitaId' | 'copiarDoPlanoId'>) =>
  requisicao<PlanoDetalhe<C>>(`/${prefixo(tipo)}/${id}/replicar`, { metodo: 'POST', corpo: dados });

/** Sem `pastaId`, nasce uma pasta nova no destino (com `titulo`, `inicio` e `fim`); com ele, o período é o da pasta. */
export const copiarPlanoParaAluno = (tipo: TipoPlano, id: string, dados: { alunoId: string; pastaId: string | null; titulo: string; inicio: string | null; fim: string | null }) =>
  requisicao<CopiaDePlano>(`/${prefixo(tipo)}/${id}/copiar-para-aluno`, { metodo: 'POST', corpo: dados });

export const salvarPlanoComoReceita =(tipo: TipoPlano, id: string, nome: string, descricao: string | null) =>
  requisicao<Receita>(`/${prefixo(tipo)}/${id}/salvar-como-receita`, { metodo: 'POST', corpo: { nome, descricao } });

// ---- Aluno (sempre o aluno do token) ----

export const painelAluno = () => requisicao<PainelAluno>('/aluno/painel');

export const pastasDoAluno = () => requisicao<PastaDoAluno[]>('/aluno/pastas');

export const planosDaPastaAluno = (id: string) => requisicao<PlanosDaPasta>(`/aluno/pastas/${id}`);

export const mobilidadeAluno = () => requisicao<{ mobilidade: VersaoDetalhe<ConteudoMobilidadeApi> }>('/aluno/mobilidade');

export const dietaAluno = () => requisicao<{ dieta: VersaoDetalhe<ConteudoDieta> | null }>('/aluno/dieta');

export const enviarRegistros = (registros: RegistroEnvio[]) =>
  requisicao<LoteResponse>('/aluno/execucoes/lote', { metodo: 'POST', corpo: { registros } });

export const historicoAluno = (de: string, ate: string) => requisicao<DiaDeTreino[]>(`/aluno/execucoes?de=${de}&ate=${ate}`);

export const progressoAluno = (exercicioId: string) =>
  requisicao<ProgressoPonto[]>(`/aluno/progresso?exercicioId=${encodeURIComponent(exercicioId)}`);

export const pesosAluno = () => requisicao<RegistroPeso[]>('/aluno/pesos');

export const versaoPlano = <C>(tipo: TipoPlano, id: string, numero: number) =>
  requisicao<VersaoDetalhe<C>>(`/${prefixo(tipo)}/${id}/versoes/${numero}`);

export const receita = (id: string) => requisicao<Receita>(`/receitas/${id}`);
export const salvarConteudoReceita = (id: string, dados: { nome: string; conteudo: unknown; versao: number }) =>
  requisicao<Receita>(`/receitas/${id}/conteudo`, { metodo: 'PUT', corpo: dados });
export const duplicarReceita = (id: string) => requisicao<Receita>(`/receitas/${id}/duplicar`, { metodo: 'POST' });
export const listarPastasModelos = () => requisicao<import('./tipos').PastaModelo[]>('/pastas-modelos');
export const criarPastaModelo = (nome: string) => requisicao<import('./tipos').PastaModelo>('/pastas-modelos', { metodo: 'POST', corpo: { nome } });
export const alterarPastaModelo = (id: string, nome: string, versao: number) => requisicao<import('./tipos').PastaModelo>(`/pastas-modelos/${id}`, { metodo: 'PUT', corpo: { nome, versao } });
export const excluirPastaModelo = (id: string) => requisicao<void>(`/pastas-modelos/${id}`, { metodo: 'DELETE' });
export const aplicarModelo = (id: string, dados: { alunoId: string; pastaId: string | null; titulo: string; inicio: string | null; fim: string | null }) =>
  requisicao<{ pastaId: string; planoId: string | null; tipo: string }>(`/receitas/${id}/aplicar`, { metodo: 'POST', corpo: dados });
export const salvarPastaComoModelo = (id: string, nome: string, descricao: string | null) => requisicao<Receita>(`/pastas/${id}/salvar-como-modelo`, { metodo: 'POST', corpo: { nome, descricao } });
export const excluirPasta = (id: string) => requisicao<void>(`/pastas/${id}`, { metodo: 'DELETE' });
export const excluirPlano = (tipo: TipoPlano, id: string) => requisicao<void>(`/${prefixo(tipo)}/${id}`, { metodo: 'DELETE' });

export const minhaConta = () => requisicao<MinhaConta>('/minha-conta');
export const consumoDoPlano = () => requisicao<ConsumoDoPlano>('/minha-conta/consumo');

export const listarSuplementos = () => requisicao<SuplementoDaBiblioteca[]>('/suplementos');
export const criarSuplemento = (dados: SuplementoDaBibliotecaRequest) =>
  requisicao<SuplementoDaBiblioteca>('/suplementos', { metodo: 'POST', corpo: dados });
export const alterarSuplemento = (id: string, dados: SuplementoDaBibliotecaRequest) =>
  requisicao<SuplementoDaBiblioteca>(`/suplementos/${id}`, { metodo: 'PUT', corpo: dados });
export const inativarSuplemento = (id: string) => requisicao<void>(`/suplementos/${id}`, { metodo: 'DELETE' });

export const listarErgogenicos = () => requisicao<ErgogenicoDaBiblioteca[]>('/ergogenicos');
export const criarErgogenico = (dados: ErgogenicoDaBibliotecaRequest) =>
  requisicao<ErgogenicoDaBiblioteca>('/ergogenicos', { metodo: 'POST', corpo: dados });
export const alterarErgogenico = (id: string, dados: ErgogenicoDaBibliotecaRequest) =>
  requisicao<ErgogenicoDaBiblioteca>(`/ergogenicos/${id}`, { metodo: 'PUT', corpo: dados });
export const inativarErgogenico = (id: string) => requisicao<void>(`/ergogenicos/${id}`, { metodo: 'DELETE' });
