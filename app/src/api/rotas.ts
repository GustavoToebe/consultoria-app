import { requisicao } from './cliente';
import type { PerfilEquipe, PerfilEquipeRequest, PermissaoEquipe, MembroEquipe, ConviteEquipe, ResponsavelEquipe, PaginaAuditoria } from './equipeTipos';
import type {
  Atualizacao,
  RespostasAtualizacao,
  SituacaoAtualizacao,
  Alimento,
  AlimentoRequest,
  AlunoDetalhe,
  AlunoRequest,
  CatalogoAlimento,
  CatalogoExercicio,
  PaginaCatalogo,
  Configuracao,
  ConsultoriaResponse,
  ConteudoDieta,
  ConviteGerado,
  ConvitePublico,
  DiaDeTreino,
  EuResponse,
  Exercicio,
  ExercicioRequest,
  Fonte,
  ImportacaoResultado,
  LoginResponse,
  LoteResponse,
  Marca,
  PaginaAlunos,
  PainelAluno,
  PastaDoAluno,
  PlanosDaPasta,
  PainelTreinador,
  PlanoDetalhe,
  DadosLesao,
  Lesao,
  PastaResumo,
  PlanoResumo,
  PreviaCsv,
  ProgressoPonto,
  Receita,
  RegistroEnvio,
  RegistroPeso,
  ResultadoValidacao,
  SituacaoFiltro,
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
export const alterarMembro = (id:string,corpo:{nome:string;perfilId:string;ativo:boolean}) => requisicao<MembroEquipe>(`/usuarios/${id}`,{metodo:'PUT',corpo});
export const aceitarConviteEquipe = (codigo:string,senha:string) => requisicao<LoginResponse>(`/publico/convites-equipe/${encodeURIComponent(codigo)}`,{metodo:'POST',corpo:{senha},semRenovar:true});
export const responsaveisEquipe = () => requisicao<ResponsavelEquipe[]>('/responsaveis');
export const alterarResponsavel = (id:string,usuarioId:string) => requisicao<AlunoDetalhe>(`/alunos/${id}/responsavel`,{metodo:'PUT',corpo:{usuarioId}});
export const alterarMeuPerfil = (nome:string,telefone:string|null) => requisicao<EuResponse>('/eu',{metodo:'PUT',corpo:{nome,telefone}});
export const listarAuditoria = (filtro:{de?:string;ate?:string;usuarioId?:string;acao?:string;pagina:number}) => {
  const q=new URLSearchParams();for(const [campo,valor] of Object.entries(filtro)) if(valor!==undefined&&valor!=='') q.set(campo,String(valor));
  return requisicao<PaginaAuditoria>(`/auditoria?${q.toString()}`);
};

// ---- Atualizações ----
export const atualizacaoAluno = () => requisicao<Atualizacao>('/aluno/atualizacao');
export const atualizacoesAluno = () => requisicao<Atualizacao[]>('/aluno/atualizacoes');
export const detalheAtualizacaoAluno = (id: string) => requisicao<Atualizacao>(`/aluno/atualizacoes/${id}`);
export const enviarAtualizacao = (pastaId: string, modeloVersao: number, respostas: RespostasAtualizacao) =>
  requisicao<Atualizacao>('/aluno/atualizacao/enviar', { metodo: 'POST', corpo: { pastaId, modeloVersao, respostas } });
export const avisarAtrasoAtualizacao = (pastaId: string, novaData: string, motivo?: string) =>
  requisicao<Atualizacao>('/aluno/atualizacao/atraso', { metodo: 'POST', corpo: { pastaId, novaData, motivo } });
export const marcarFeedbackVisto = (id: string) =>
  requisicao<void>(`/aluno/atualizacoes/${id}/feedback-visto`, { metodo: 'POST' });
export const listarAtualizacoes = (situacao: SituacaoAtualizacao) => requisicao<Atualizacao[]>(`/atualizacoes?situacao=${situacao}`);
export const atualizacoesDoAluno = (id: string) => requisicao<Atualizacao[]>(`/alunos/${id}/atualizacoes`);
export const atualizacaoDoAluno = (id: string) => requisicao<Atualizacao>(`/alunos/${id}/atualizacao`);
export const detalheAtualizacao = (id: string) => requisicao<Atualizacao>(`/atualizacoes/${id}`);
export const responderAtualizacao = (id: string, texto: string, versao: number) =>
  requisicao<Atualizacao>(`/atualizacoes/${id}/feedback`, { metodo: 'PUT', corpo: { texto, versao } });

/** Uma função por rota da API. As telas não montam URL nem método. */

// ---- Sessão ----

export const entrar = (email: string, senha: string) =>
  requisicao<LoginResponse>('/auth/login', { metodo: 'POST', corpo: { email, senha }, semRenovar: true });

export const sairDaApi = (refreshToken: string | null) =>
  requisicao<void>('/auth/logout', {
    metodo: 'POST',
    corpo: refreshToken ? { refreshToken } : undefined,
    semRenovar: true,
  });

export const cadastrarTreinador = (dados: { nomeConsultoria: string; nome: string; email: string; senha: string }) =>
  requisicao<LoginResponse>('/auth/cadastro-treinador', { metodo: 'POST', corpo: dados, semRenovar: true });

export const eu = () => requisicao<EuResponse>('/eu');

export const trocarSenha = (senhaAtual: string, senhaNova: string) =>
  requisicao<LoginResponse>('/eu/senha', { metodo: 'PUT', corpo: { senhaAtual, senhaNova } });

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
  lema: string | null;
  corPrimaria: string;
  fonteTitulo: Fonte;
  temaPadrao: Tema;
  versao: number;
}) => requisicao<ConsultoriaResponse>('/consultoria/marca', { metodo: 'PUT', corpo: dados });

/** `arquivo`: FormData já montado (web: File; nativo: {uri, name, type}). */
export const enviarLogo = (arquivo: FormData) =>
  requisicao<Marca>('/consultoria/marca/logo', { metodo: 'PUT', corpoBruto: arquivo });

export const removerLogo = () => requisicao<Marca>('/consultoria/marca/logo', { metodo: 'DELETE' });

export const alterarConfiguracao = (configuracao: Configuracao) =>
  requisicao<ConsultoriaResponse>('/consultoria/configuracao', { metodo: 'PUT', corpo: configuracao });

// ---- Treinador: início ----

export const painelTreinador = (meus=false) => requisicao<PainelTreinador>(`/painel?meus=${meus}`);

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

export const salvarPlanoComoReceita = (tipo: TipoPlano, id: string, nome: string, descricao: string | null) =>
  requisicao<Receita>(`/${prefixo(tipo)}/${id}/salvar-como-receita`, { metodo: 'POST', corpo: { nome, descricao } });

// ---- Aluno (sempre o aluno do token) ----

export const painelAluno = () => requisicao<PainelAluno>('/aluno/painel');

export const pastasDoAluno = () => requisicao<PastaDoAluno[]>('/aluno/pastas');

export const planosDaPastaAluno = (id: string) => requisicao<PlanosDaPasta>(`/aluno/pastas/${id}`);

export const dietaAluno = () => requisicao<{ dieta: VersaoDetalhe<ConteudoDieta> | null }>('/aluno/dieta');

export const enviarRegistros = (registros: RegistroEnvio[]) =>
  requisicao<LoteResponse>('/aluno/execucoes/lote', { metodo: 'POST', corpo: { registros } });

export const historicoAluno = (de: string, ate: string) => requisicao<DiaDeTreino[]>(`/aluno/execucoes?de=${de}&ate=${ate}`);

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
