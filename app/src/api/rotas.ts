import { requisicao } from './cliente';
import type {
  Alimento,
  AlimentoRequest,
  AlunoDetalhe,
  AlunoRequest,
  CatalogoAlimento,
  CatalogoExercicio,
  Configuracao,
  ConsultoriaResponse,
  ConviteGerado,
  ConvitePublico,
  DiaDeTreino,
  EuResponse,
  Exercicio,
  ExercicioRequest,
  Fonte,
  ImportacaoResultado,
  LoginResponse,
  Marca,
  PaginaAlunos,
  PainelTreinador,
  PlanoDetalhe,
  PlanoResumo,
  PreviaCsv,
  ProgressoPonto,
  Receita,
  RegistroPeso,
  ResultadoValidacao,
  SituacaoFiltro,
  Tema,
  TipoPlano,
  TipoReceita,
} from './tipos';

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

export const painelTreinador = () => requisicao<PainelTreinador>('/painel');

// ---- Treinador: alunos ----

export const listarAlunos = (filtro: { busca?: string; situacao?: SituacaoFiltro; pagina?: number }) => {
  const q = new URLSearchParams();
  if (filtro.busca) q.set('busca', filtro.busca);
  q.set('situacao', filtro.situacao ?? 'ATIVO');
  q.set('pagina', String(filtro.pagina ?? 0));
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

export const catalogoExercicios = (texto?: string) =>
  requisicao<CatalogoExercicio[]>(`/catalogo/exercicios${busca(texto)}`);
export const catalogoAlimentos = (texto?: string) =>
  requisicao<CatalogoAlimento[]>(`/catalogo/alimentos${busca(texto)}`);

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

type ReceitaRequest = { tipo: TipoReceita; nome: string; descricao: string | null; conteudo: unknown };

export const listarReceitas = (tipo?: TipoReceita) => requisicao<Receita[]>(`/receitas${tipo ? `?tipo=${tipo}` : ''}`);

export const criarReceita = (dados: ReceitaRequest) => requisicao<Receita>('/receitas', { metodo: 'POST', corpo: dados });

export const alterarReceita = (id: string, dados: ReceitaRequest) =>
  requisicao<Receita>(`/receitas/${id}`, { metodo: 'PUT', corpo: dados });

export const excluirReceita = (id: string) => requisicao<void>(`/receitas/${id}`, { metodo: 'DELETE' });

// ---- Treinador: planos de treino e de dieta (mesmas rotas, trocando o prefixo) ----

const prefixo = (tipo: TipoPlano) => (tipo === 'treino' ? 'planos-treino' : 'planos-dieta');

export interface NovoPlano {
  titulo: string;
  inicio: string | null;
  fim: string | null;
  receitaId?: string;
  copiarDoPlanoId?: string;
}

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
