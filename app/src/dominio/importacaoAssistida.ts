import { codigoApi, emailValido, ErroApi, mensagemApi } from '@plataforma/web';

import type {
  AlunoGravado,
  ArquivoResumo,
  CoberturaArquivo,
  ConfirmacaoResultado,
  DestinoGrupo,
  DuvidaImportacao,
  EstadoSessao,
  GrupoImportavel,
  LeituraEmAndamento,
  ModoProcessamentoResumo,
  SessaoDetalhe,
  SessaoListaItem,
  TipoDuvida,
} from '../servicos/importacaoAssistida';
import type { TipoSelo } from '../ui/Selo';
import { erroDoTelefone } from './cadastroDoAluno';
import { plural } from './formatos';

/** Textos da tela da importação assistida: os códigos da API nunca aparecem crus. */
const ESTADOS: Record<EstadoSessao, string> = {
  RASCUNHO: 'Rascunho',
  RECEBENDO: 'Recebendo arquivos',
  PROCESSANDO: 'Processando',
  REVISANDO: 'Em revisão',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  ERRO: 'Com erro',
  EXPIRADA: 'Expirada',
};

export const textoDoEstadoDaSessao = (estado: string): string => ESTADOS[estado as EstadoSessao] ?? estado;

const DUVIDAS: Record<TipoDuvida, string> = {
  EXERCICIO_NAO_RECONHECIDO: 'Exercício não reconhecido',
  ALIMENTO_NAO_RECONHECIDO: 'Alimento não reconhecido',
  ALUNO_AMBIGUO: 'Aluno ambíguo',
  UNIDADE_CARGA: 'Unidade da carga',
  CONFLITO_VERSAO: 'Conflito de versão',
};

export const rotuloDaDuvida = (tipo: string): string => DUVIDAS[tipo as TipoDuvida] ?? 'Termo ambíguo';

/** Selo do grupo: âmbar só quando o treinador precisa agir (dúvida aberta); erro em vermelho; ignorado em neutro. */
export function seloDoGrupo(estado: GrupoImportavel['estado']): { texto: string; tipo: TipoSelo } {
  if (estado === 'PRONTO') return { texto: 'Pronto', tipo: 'sucesso' };
  if (estado === 'IMPORTADO') return { texto: 'Importado', tipo: 'sucesso' };
  if (estado === 'IGNORADO') return { texto: 'Ignorado', tipo: 'neutro' };
  if (estado === 'ERRO') return { texto: 'Com erro', tipo: 'perigo' };
  return { texto: 'Com dúvidas', tipo: 'atencao' };
}

/**
 * Aluno que vira linha resumida, sem ações: já gravado ou ignorado no fim. O que deu erro na gravação continua editável
 * (2.3): cartão normal com o motivo no topo.
 */
export const grupoResumido = (g: Pick<GrupoImportavel, 'estado'>): boolean => g.estado === 'IMPORTADO' || g.estado === 'IGNORADO';

/** Título da linha resumida. O esqueleto do importado e do ignorado não tem nome: o texto sai do destino. */
export function tituloDoGrupoResumido(g: Pick<GrupoImportavel, 'estado' | 'destino' | 'nomeDetectado'>): string {
  if (g.estado === 'IGNORADO' || g.destino === 'IGNORAR') return 'Não gravado';
  if (g.destino === 'MODELO_BIBLIOTECA') return 'Salvo como modelo';
  if (g.destino === 'VINCULAR_EXISTENTE') return 'Gravado num aluno já cadastrado';
  return 'Aluno novo criado';
}

/** Por que o grupo não foi gravado, a partir do `erroCodigo` fixo da gravação. O que fazer vem junto quando há o que fazer. */
const ERROS_DO_GRUPO: Record<string, string> = {
  SEM_PERMISSAO: 'Seu perfil não permite gravar parte destes dados.',
  ALUNO_JA_EXISTE: 'Já existe um aluno com este e-mail.',
  ALUNO_NAO_ESCOLHIDO: 'Faltou escolher o aluno já cadastrado.',
  ALUNO_INATIVO: 'O aluno escolhido está inativo. Reative-o na ficha antes de tentar de novo.',
  ALUNO_ANONIMIZADO: 'O aluno escolhido foi anonimizado e não recebe mais dados.',
  NOME_INVALIDO: 'O nome do aluno está vazio ou passa de 120 caracteres.',
  EMAIL_INVALIDO: 'O e-mail lido do arquivo não é válido.',
  TELEFONE_INVALIDO: 'O telefone lido do arquivo não é válido.',
  OBJETIVO_GRANDE_DEMAIS: 'O objetivo passa de 200 caracteres.',
  OBSERVACOES_GRANDES_DEMAIS: 'As observações passam de 4.000 caracteres.',
  SEM_CONTEUDO: 'Não há treino nem dieta para salvar como modelo.',
  DESTINO_INVALIDO: 'O destino escolhido não vale para este aluno.',
  NAO_ENCONTRADO: 'O aluno escolhido não foi encontrado.',
  LIMITE_DO_PLANO: 'O plano da consultoria chegou ao limite de alunos ativos.',
  LIMITE_DO_TREINADOR: 'Você chegou ao limite de alunos definido pelo administrador.',
  ALUNO_CPF_EM_USO: 'O CPF já é de outro aluno.',
  DADOS_INVALIDOS: 'Algum dado lido do arquivo não passou na validação.',
  CONFLITO_DE_DADOS: 'Outro registro mudou ao mesmo tempo. Tente de novo.',
  ERRO_AO_GRAVAR: 'Não foi possível gravar agora. Tente de novo.',
  NOME_DO_ALUNO_PENDENTE: 'Informe o nome do aluno, vincule a um existente ou ignore.',
};

export const motivoDoErroDoGrupo = (codigo: string | null | undefined): string =>
  (codigo ? ERROS_DO_GRUPO[codigo] : undefined) ?? 'Não foi possível gravar este aluno.';

/** Arquivo que não foi lido (`erroCodigo` do arquivo). */
const ERROS_DO_ARQUIVO: Record<string, string> = {
  DOCX_COMPACTADO_DEMAIS: 'O DOCX está compactado demais para ser lido com segurança.',
  DOCX_CORROMPIDO: 'Não foi possível abrir o arquivo DOCX.',
  PLANILHA_CORROMPIDA: 'Não foi possível ler a planilha.',
  PDF_PROTEGIDO_POR_SENHA: 'O PDF está protegido por senha. Envie uma cópia sem senha.',
  PDF_SEM_PAGINAS: 'O PDF não tem páginas.',
  PDF_PAGINAS_DEMAIS: 'O PDF passa do limite máximo de páginas por arquivo.',
  PDF_CORROMPIDO: 'Não foi possível abrir o arquivo PDF.',
  FORMATO_NAO_CONFERE: 'O conteúdo não confere com a extensão do arquivo.',
  FORMATO_NAO_SUPORTADO: 'Formato não aceito.',
};

export const motivoDoErroDoArquivo = (codigo: string): string => ERROS_DO_ARQUIVO[codigo] ?? 'Não foi possível ler este arquivo.';

/** Mensagens dos erros das rotas da importação assistida. 403 e 429 pelo status; o resto pelo código. */
const ERROS_DA_API: Record<string, string> = {
  FORMATO_NAO_SUPORTADO: 'Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.',
  FORMATO_XLS_ANTIGO: 'Salve como .xlsx no Excel e envie de novo.',
  FORMATO_NAO_CONFERE: 'O conteúdo do arquivo não confere com a extensão. Abra o arquivo e salve de novo no formato certo.',
  ARQUIVO_VAZIO: 'O arquivo está vazio.',
  ARQUIVO_GRANDE_DEMAIS: 'Passa do tamanho máximo de 900 KB. Divida em partes menores.',
  // O 413 do corpo acima de 1 MB (antes de chegar à importação): o mesmo caso, arquivo grande demais.
  CORPO_EXCEDIDO: 'O arquivo passa do tamanho máximo de 900 KB. Divida em partes menores.',
  TEXTO_VAZIO: 'Cole o texto antes de adicionar.',
  TITULO_GRANDE_DEMAIS: 'O título é longo demais. Encurte e tente de novo.',
  DESTINO_INVALIDO: 'Destino inválido. Escolha uma das opções.',
  ALUNO_NAO_ESCOLHIDO: 'Escolha qual aluno já cadastrado recebe estes dados.',
  NOME_GRANDE_DEMAIS: 'O nome passa de 120 caracteres.',
  RESPOSTA_INVALIDA: 'Escreva um nome válido para o termo.',
  APELIDO_INVALIDO: 'Termo inválido para o dicionário.',
  SEM_ARQUIVOS: 'Adicione ao menos um arquivo ou texto antes de ler.',
  LIMITE_DE_SESSOES: 'Há importações demais em aberto. Conclua uma delas ou espere as antigas expirarem.',
  LIMITE_DE_ARQUIVOS: 'Esta importação já tem arquivos demais. Leia estes e comece outra para o resto.',
  LIMITE_DE_VOLUME: 'Esta importação já passou do volume máximo. Leia estes e comece outra para o resto.',
  SESSAO_CONCLUIDA: 'Esta importação já foi concluída. A tela foi atualizada.',
  SESSAO_NAO_PROCESSADA: 'Leia os arquivos antes de gravar.',
  GRUPO_JA_IMPORTADO: 'Este aluno já foi gravado. A lista foi atualizada.',
  ALUNO_INATIVO: 'Este aluno está inativo. Reative-o na ficha antes de importar.',
  ALUNO_ANONIMIZADO: 'Este aluno foi anonimizado e não recebe mais dados.',
  CONFLITO_EDICAO: 'A importação mudou desde que você abriu. A lista foi atualizada: confira e grave de novo.',
  ALUNO_JA_EXISTE: 'Já existe um aluno com este e-mail. Escolha esse aluno em vez de criar outro.',
  MIGRACAO_INDISPONIVEL: 'A importação assistida está desligada no momento.',
  SELECAO_VAZIA: 'Selecione pelo menos um aluno para gravar.',
  SELECAO_INVALIDA: 'Alguns alunos selecionados mudaram ou já foram gravados. A lista foi atualizada.',
  PREVIA_DESATUALIZADA: 'A prévia mudou desde que você abriu. Confira a lista atualizada e tente gravar de novo.',
  CHAVE_IDEMPOTENCIA_OBRIGATORIA: 'Não foi possível identificar esta tentativa de gravação. Tente de novo.',
  IDEMPOTENCIA_CONFLITANTE: 'Esta tentativa já foi enviada com outra seleção. Confira a lista antes de tentar de novo.',
  SESSAO_CANCELADA: 'Esta importação foi cancelada.',
  SESSAO_EXPIRADA: 'Esta importação expirou. Comece uma nova importação.',
  SESSAO_PROCESSANDO: 'A importação ainda está sendo processada. Aguarde concluir.',
  CONTEUDO_INDISPONIVEL: 'O conteúdo original deste arquivo não está mais disponível.',
  NOME_DO_ALUNO_PENDENTE: 'Algum aluno novo ainda está sem nome. Informe o nome, vincule a um aluno já cadastrado ou ignore.',
  GRUPOS_COM_DOIS_PLANOS: 'Os dois têm treino ou os dois têm dieta. Ignore um deles antes de juntar.',
};

/** Erro de uma ação da tela em português. `confirmar` muda o texto do 403 (nada foi gravado). */
export function textoDoErroDaImportacao(erro: unknown, acao?: 'confirmar'): string {
  const status = erro instanceof ErroApi ? erro.status : null;
  if (status === 403) {
    return acao === 'confirmar'
      ? 'Seu perfil não permite gravar parte do que foi lido (peso, objetivo, treino, dieta, pasta ou modelo). Nada foi gravado. Escolha Ignorar nesses alunos ou peça a permissão a quem administra a equipe.'
      : 'Seu perfil não permite esta ação.';
  }
  // shortcut: o cliente da API não expõe o Retry-After, então o texto não diz quantos minutos; trocar quando o ErroApi trouxer o cabeçalho.
  if (status === 429) return 'Muitas ações na importação em pouco tempo. Espere alguns minutos e tente de novo.';
  const codigo = codigoApi(erro);
  if (status === 503 && codigo === 'MIGRACAO_INDISPONIVEL') return ERROS_DA_API.MIGRACAO_INDISPONIVEL;
  return (codigo ? ERROS_DA_API[codigo] : undefined) ?? mensagemApi(erro, 'Algo deu errado. Tente de novo.');
}

/** Erros em que a sessão no servidor mudou: a tela busca a sessão de novo e avisa em âmbar, sem tratar como falha. */
export function recarregarDepoisDoErro(erro: unknown): boolean {
  const codigo = codigoApi(erro);
  return (
    codigo === 'CONFLITO_EDICAO' ||
    codigo === 'PREVIA_DESATUALIZADA' ||
    codigo === 'SELECAO_INVALIDA' ||
    codigo === 'GRUPO_JA_IMPORTADO' ||
    codigo === 'SESSAO_CONCLUIDA'
  );
}

/** Campo do texto colado que recebe o erro do envio; `null` = vai ao alerta. */
export function campoDoErroDoTexto(erro: unknown): 'titulo' | 'conteudo' | null {
  const codigo = codigoApi(erro);
  if (codigo === 'TITULO_GRANDE_DEMAIS') return 'titulo';
  if (codigo === 'TEXTO_VAZIO' || codigo === 'ARQUIVO_GRANDE_DEMAIS') return 'conteudo';
  return null;
}

type Pode = (codigo: string) => boolean;

/** Só contagens, nunca nome nem dose; zero não aparece. Medicação e ergogênicos só com `ERGOGENICO_LER` (a API já os manda vazios sem ela). */
function resumoDaDieta(dieta: { refeicoes?: unknown[]; suplementacao?: unknown[]; ergogenicos?: unknown[] }, pode: Pode): string {
  const partes = [plural(dieta.refeicoes?.length ?? 0, 'refeição', 'refeições')];
  const suplementos = dieta.suplementacao?.length ?? 0;
  if (suplementos > 0) partes.push(plural(suplementos, 'suplemento', 'suplementos'));
  const ergogenicos = pode('ERGOGENICO_LER') ? dieta.ergogenicos?.length ?? 0 : 0;
  if (ergogenicos > 0) partes.push(plural(ergogenicos, 'item de medicação e ergogênicos', 'itens de medicação e ergogênicos'));
  return partes.join(' · ');
}

/**
 * O que o grupo traz, linha a linha. Sem a permissão de ler, a API omite a parte (peso vem vazio, treino e dieta nulos):
 * a tela não sabe se existe e mostra "—", nunca zero.
 */
export function linhasDoGrupo(g: GrupoImportavel, pode: Pode): { rotulo: string; valor: string }[] {
  const pesos = pode('ALUNO_SENSIVEL_LER') && g.pesos?.length ? plural(g.pesos.length, 'pesagem', 'pesagens') : '—';
  const treino = pode('TREINO_LER') && g.treino ? plural(g.treino.sessoes?.length ?? 0, 'divisão', 'divisões') : '—';
  const dieta = pode('DIETA_LER') && g.dieta ? resumoDaDieta(g.dieta, pode) : '—';
  // E-mail e WhatsApp viraram campos editáveis no cartão do aluno (2.2).
  return [
    { rotulo: 'Peso', valor: pesos },
    { rotulo: 'Treino', valor: treino },
    { rotulo: 'Dieta', valor: dieta },
  ];
}

const ROTULO_DA_PERMISSAO: Record<string, string> = {
  ALUNO_SENSIVEL_ALTERAR: 'dados sensíveis (peso, objetivo, observações)',
  TREINO_ALTERAR: 'treino',
  DIETA_ALTERAR: 'dieta',
  PASTA_ALTERAR: 'pasta',
  MODELO_ALTERAR: 'modelos',
};

/**
 * Permissões que faltam para gravar o que a tela vê do grupo num aluno (criar ou vincular), na regra da API: peso,
 * objetivo ou observações pedem `ALUNO_SENSIVEL_ALTERAR`; treino, `TREINO_ALTERAR` e `PASTA_ALTERAR`; dieta,
 * `DIETA_ALTERAR` e `PASTA_ALTERAR`. O que a API omitiu a tela não vê: quem autoriza é a API (403 antes de gravar).
 */
function faltamParaAluno(g: GrupoImportavel, pode: Pode): string[] {
  const precisa = new Set<string>();
  const c = g.cadastro;
  if (g.pesos?.length || c?.objetivo?.trim() || c?.observacoes?.trim()) precisa.add('ALUNO_SENSIVEL_ALTERAR');
  if (g.treino) { precisa.add('TREINO_ALTERAR'); precisa.add('PASTA_ALTERAR'); }
  if (g.dieta) { precisa.add('DIETA_ALTERAR'); precisa.add('PASTA_ALTERAR'); }
  return [...precisa].filter((p) => !pode(p));
}

const motivoDaFalta = (faltam: string[]): string => {
  const nomes = [...new Set(faltam.map((p) => ROTULO_DA_PERMISSAO[p]))];
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0];
  return `Seu perfil não permite gravar ${lista}.`;
};

/** Valor da escolha do destino: candidato (`aluno:<id>`), aluno novo, modelo ou ignorar. */
export type ValorDoDestino = 'NOVO' | 'MODELO_BIBLIOTECA' | 'IGNORAR' | `aluno:${string}`;

/**
 * Opções do destino numa escolha só: os candidatos ("mesmo e-mail" primeiro, como a API ordena), "Criar aluno novo",
 * "Salvar como modelo" e "Ignorar". Sem a permissão do que o grupo traz, a opção fica desabilitada com o motivo.
 */
export function opcoesDoDestino(g: GrupoImportavel, pode: Pode): { valor: ValorDoDestino; rotulo: string; desabilitada?: boolean; motivo?: string }[] {
  const faltam = faltamParaAluno(g, pode);
  const doAluno = faltam.length ? { desabilitada: true, motivo: motivoDaFalta(faltam) } : {};
  const candidatos = g.candidatos ?? [];
  const opcoes: { valor: ValorDoDestino; rotulo: string; desabilitada?: boolean; motivo?: string }[] = candidatos.map((c) => ({
    valor: `aluno:${c.alunoId}` as const,
    rotulo: `${c.nome} · ${c.motivo === 'EMAIL' ? 'mesmo e-mail' : 'mesmo nome'}`,
    ...doAluno,
  }));
  if (g.destino === 'VINCULAR_EXISTENTE' && g.alunoExistenteId && !candidatos.some((c) => c.alunoId === g.alunoExistenteId)) {
    opcoes.push({ valor: `aluno:${g.alunoExistenteId}`, rotulo: 'Aluno já cadastrado', ...doAluno });
  }
  opcoes.push({ valor: 'NOVO', rotulo: 'Criar aluno novo', ...doAluno });
  opcoes.push(pode('MODELO_ALTERAR')
    ? { valor: 'MODELO_BIBLIOTECA', rotulo: 'Salvar como modelo' }
    : { valor: 'MODELO_BIBLIOTECA', rotulo: 'Salvar como modelo', desabilitada: true, motivo: motivoDaFalta(['MODELO_ALTERAR']) });
  opcoes.push({ valor: 'IGNORAR', rotulo: 'Ignorar' });
  return opcoes;
}

/**
 * Grupo com aluno parecido já cadastrado e destino "criar": o treinador precisa dizer se é a mesma pessoa. A API
 * nunca vincula por nome, e criar por padrão sem perguntar duplicaria o aluno. `conferidos` guarda quem já respondeu.
 */
export function precisaEscolherAluno(g: GrupoImportavel, conferidos: ReadonlySet<string>): boolean {
  return !grupoResumido(g) && g.destino === 'CRIAR_ALUNO' && (g.candidatos?.length ?? 0) > 0 && !conferidos.has(g.id);
}

/** Valor marcado na escolha; `null` (nada marcado) enquanto o treinador não disse se o candidato é a mesma pessoa. */
export function valorDoDestino(g: GrupoImportavel, conferidos: ReadonlySet<string>): ValorDoDestino | null {
  if (g.destino === 'VINCULAR_EXISTENTE') return g.alunoExistenteId ? `aluno:${g.alunoExistenteId}` : null;
  if (g.destino === 'MODELO_BIBLIOTECA' || g.destino === 'IGNORAR') return g.destino;
  return precisaEscolherAluno(g, conferidos) ? null : 'NOVO';
}

/** O que mandar no `PUT` do grupo para o valor escolhido. */
export function pedidoDoDestino(valor: ValorDoDestino): { destino: DestinoGrupo; alunoExistenteId?: string } {
  if (valor.startsWith('aluno:')) return { destino: 'VINCULAR_EXISTENTE', alunoExistenteId: valor.slice('aluno:'.length) };
  if (valor === 'NOVO') return { destino: 'CRIAR_ALUNO' };
  return { destino: valor as DestinoGrupo };
}

/**
 * Alunos pendentes que podem ser selecionados para gravação: não resumidos, não marcados como Ignorar e sem erro da
 * gravação (esses voltam por "Tentar de novo os que deram erro").
 */
export const gruposSelecionaveis = (grupos: GrupoImportavel[]): GrupoImportavel[] =>
  grupos.filter((g) => !grupoResumido(g) && g.destino !== 'IGNORAR' && g.estado !== 'ERRO');

/** Nome que não veio do documento nem foi digitado: o substituto ("Aluno 3", o nome do arquivo). */
const nomeSemOrigem = (g: Pick<GrupoImportavel, 'origemDoNome'>): boolean =>
  // shortcut: sem `origemDoNome` (resposta antiga) não trava aqui; a API recusa com NOME_DO_ALUNO_PENDENTE. Tirar quando toda sessão trouxer o campo.
  !!g.origemDoNome && g.origemDoNome !== 'CONTEUDO' && g.origemDoNome !== 'DIGITADO';

/**
 * Aluno novo com o nome substituto: "Gravar" fica travado para ele até digitar o nome, vincular a um aluno já cadastrado
 * ou ignorar (sem a trava nasceria um "Aluno 3" ocupando vaga do plano). Modelo não trava.
 */
export const nomeTravado = (g: Pick<GrupoImportavel, 'estado' | 'destino' | 'origemDoNome'>): boolean =>
  !grupoResumido(g) && g.destino === 'CRIAR_ALUNO' && nomeSemOrigem(g);

export const MOTIVO_DO_NOME_TRAVADO = 'Informe o nome do aluno, vincule a um existente ou ignore.';

/**
 * Aviso do cartão quando o nome não foi lido do documento. Só com o nome do arquivo o texto diz de onde veio (o campo
 * vem com ele); no título padrão do texto colado e sem nada, o campo vem vazio. O que fazer só enquanto trava: depois
 * de vincular ou ignorar fica só o título.
 */
export function avisoDoNome(g: Pick<GrupoImportavel, 'estado' | 'destino' | 'origemDoNome'>): { titulo: string; texto: string | null } | null {
  if (!nomeSemOrigem(g)) return null;
  const titulo = 'Nome não encontrado no documento';
  const doArquivo = g.origemDoNome === 'NOME_DO_ARQUIVO';
  if (!nomeTravado(g)) return { titulo, texto: doArquivo ? 'O app usou o nome do arquivo.' : null };
  return doArquivo
    ? { titulo, texto: 'O app usou o nome do arquivo. Confirme, corrija, vincule a um aluno já cadastrado ou ignore.' }
    : { titulo, texto: 'Digite o nome, vincule a um aluno já cadastrado ou ignore.' };
}

/** Nome que o cartão mostra no campo: o substituto sem fonte ("Aluno 3") não vira nome enquanto trava; o do arquivo, sim. */
export const nomeNoCampo = (g: Pick<GrupoImportavel, 'estado' | 'destino' | 'origemDoNome' | 'nomeDetectado' | 'cadastro'>): string =>
  nomeTravado(g) && g.origemDoNome !== 'NOME_DO_ARQUIVO' ? '' : g.cadastro?.nome ?? g.nomeDetectado ?? '';

/** Junto do "Gravar": quantos alunos novos estão travados sem nome (nulo = nenhum). */
export function textoDosTravados(grupos: readonly GrupoImportavel[]): string | null {
  const n = grupos.filter(nomeTravado).length;
  return n ? `${plural(n, 'aluno novo sem nome não entra', 'alunos novos sem nome não entram')} na gravação até receber o nome, ser vinculado ou ignorado.` : null;
}

/**
 * "Juntar as N partes": por grupo que recebe o botão (a primeira parte), as outras partes. Partes = alunos ainda por
 * gravar de um mesmo arquivo (e só dele), com um único arquivo desse nome na sessão e nenhum com o nome lido do documento,
 * quando ao menos um está travado sem nome (a mesma regra da API). O app nunca junta sozinho: só oferece.
 */
export function partesParaJuntar(
  s: Pick<SessaoDetalhe, 'arquivos' | 'grupos'>,
): Map<string, string[]> {
  const porArquivo = new Map<string, GrupoImportavel[]>();
  for (const g of s.grupos) {
    const destinoDeAluno = g.destino === 'CRIAR_ALUNO' || g.destino === 'VINCULAR_EXISTENTE';
    if (grupoResumido(g) || !destinoDeAluno || g.arquivosOrigem.length !== 1 || g.origemDoNome === 'CONTEUDO') continue;
    const nome = g.arquivosOrigem[0];
    porArquivo.set(nome, [...(porArquivo.get(nome) ?? []), g]);
  }
  const partes = new Map<string, string[]>();
  for (const [nome, grupos] of porArquivo) {
    const umArquivo = s.arquivos.filter((a) => a.nomeOriginal === nome).length === 1;
    if (umArquivo && grupos.length > 1 && grupos.some(nomeTravado)) partes.set(grupos[0].id, grupos.slice(1).map((g) => g.id));
  }
  return partes;
}

/** Grupos que "Gravar rascunhos" manda: os pendentes que não são ignorados nem estão com erro. Nunca vazio na API (vazio = todos). */
export const idsParaGravar = (grupos: GrupoImportavel[]): string[] =>
  gruposSelecionaveis(grupos).map((g) => g.id);

/** IDs dos grupos prontos (sem dúvidas nem escolha pendente e com permissão) para o atalho "Selecionar prontos". */
export function idsSelecionaveisProntos(
  grupos: GrupoImportavel[],
  pode: Pode,
  conferidos: ReadonlySet<string> = new Set()
): string[] {
  return gruposSelecionaveis(grupos)
    .filter((g) => {
      // Termo aberto deixa o aluno `COM_DUVIDAS`, mas ele grava (o termo entra com o nome do documento, 2.4).
      if (g.estado !== 'PRONTO' && g.estado !== 'COM_DUVIDAS') return false;
      if (precisaEscolherAluno(g, conferidos)) return false;
      if (nomeTravado(g)) return false;
      if (g.destino === 'VINCULAR_EXISTENTE' && !g.alunoExistenteId) return false;
      const faltam = g.destino === 'MODELO_BIBLIOTECA' ? (pode('MODELO_ALTERAR') ? [] : ['MODELO_ALTERAR']) : faltamParaAluno(g, pode);
      return faltam.length === 0;
    })
    .map((g) => g.id);
}

/** Grupos que "Tentar de novo" manda: só os que ficaram com erro na gravação. */
export const idsComErro = (grupos: GrupoImportavel[]): string[] => grupos.filter((g) => g.estado === 'ERRO').map((g) => g.id);

/** Por que "Gravar selecionados" está desabilitado; `null` = pode gravar. */
export function motivoParaNaoConfirmar(
  grupos: GrupoImportavel[],
  pode: Pode,
  conferidos: ReadonlySet<string> = new Set(),
  selecionados?: ReadonlySet<string>,
  hashPrevia?: string | null
): string | null {
  const selecionaveis = gruposSelecionaveis(grupos);
  const vao = selecionados ? selecionaveis.filter((g) => selecionados.has(g.id)) : selecionaveis;
  if (vao.length === 0) {
    return selecionados ? 'Selecione pelo menos um aluno para gravar.' : 'Escolha o destino de pelo menos um aluno.';
  }
  if (selecionados && !hashPrevia) {
    return 'A prévia da sessão ainda não está pronta para gravar. Atualize a sessão.';
  }
  const semNome = vao.filter(nomeTravado);
  if (semNome.length) {
    return semNome.length === 1
      ? `${semNome[0].nomeDetectado} está sem nome. ${MOTIVO_DO_NOME_TRAVADO}`
      : `${plural(semNome.length, 'aluno está', 'alunos estão')} sem nome. ${MOTIVO_DO_NOME_TRAVADO}`;
  }
  const semEscolha = vao.find((g) => precisaEscolherAluno(g, conferidos));
  if (semEscolha) return `Diga se ${semEscolha.nomeDetectado} é um aluno já cadastrado ou um aluno novo.`;
  const semAluno = vao.find((g) => g.destino === 'VINCULAR_EXISTENTE' && !g.alunoExistenteId);
  if (semAluno) return `Escolha o aluno já cadastrado de ${semAluno.nomeDetectado}.`;
  for (const g of vao) {
    const faltam = g.destino === 'MODELO_BIBLIOTECA' ? (pode('MODELO_ALTERAR') ? [] : ['MODELO_ALTERAR']) : faltamParaAluno(g, pode);
    if (faltam.length) return `${motivoDaFalta(faltam)} Escolha outro destino para ${g.nomeDetectado}.`;
  }
  return null;
}

/** Sessões que ainda podem ser retomadas: abertas e com algum arquivo (a vazia não tem o que retomar, 2.1). */
export const sessaoRetomavel = (s: Pick<SessaoListaItem, 'estado' | 'totalArquivos'>): boolean =>
  s.totalArquivos > 0 && sessaoPodeCancelar(s.estado);

/** Sessões que ainda aceitam cancelamento explícito. */
export const sessaoPodeCancelar = (estado: EstadoSessao): boolean =>
  estado === 'RASCUNHO' || estado === 'RECEBENDO' || estado === 'PROCESSANDO' || estado === 'REVISANDO' || estado === 'ERRO';

/** Por que a leitura caiu para as regras fixas (`motivoFallback`), em uma frase sem infraestrutura. Desconhecido: o texto geral. */
// O mesmo aviso fixo que a API põe nos grupos do arquivo (já pede a conferência: não ganha o "Confira…" de novo).
const TEMPO_ESGOTADO = 'O tempo de leitura com IA acabou: parte do documento foi lida pelas regras fixas. Confira com atenção.';
const MOTIVOS_DO_FALLBACK: Record<string, string> = {
  RESPOSTA_CORTADA: 'O documento era grande demais para a IA e foi lido sem IA.',
  TEMPO_ESGOTADO,
  CHAVE_AUSENTE: 'A leitura com IA não está disponível agora, então foi lido sem IA.',
  ERRO_PROVEDOR: 'A IA não respondeu, nem na segunda tentativa, então foi lido sem IA.',
};
const FALLBACK_GERAL = 'A IA não pôde ler e foi lido sem IA.';
const LIDO_EM_PARTE = 'Lido pela IA; uma parte caiu nas regras';
const porQueSemIa = (motivo?: string | null) => (motivo ? MOTIVOS_DO_FALLBACK[motivo] : undefined) ?? FALLBACK_GERAL;

/** Como um arquivo foi lido (1.6), numa frase curta; antes de ler (sem `modo`), nulo. */
export function textoDoModoDoArquivo(a: Pick<ArquivoResumo, 'modo' | 'motivoFallback' | 'enviadoComoArquivo'>): { texto: string; atencao: boolean } | null {
  // Documento grande dividido (1.3): a IA leu e só uma parte caiu nas regras fixas.
  if (a.modo === 'IA' && a.motivoFallback) return { texto: LIDO_EM_PARTE, atencao: true };
  // 4.2: a IA leu o PDF ou a imagem inteiros (PDF sem texto ou print); informativo, sem falar de servidor ou provedor.
  if (a.modo === 'IA') return { texto: a.enviadoComoArquivo ? 'Lido pela imagem do documento' : 'Lido com IA', atencao: false };
  if (a.modo !== 'REGRAS') return null;
  // Envio desligado é escolha da plataforma, não falha: sem âmbar.
  if (!a.motivoFallback || a.motivoFallback === 'ENVIO_DESLIGADO') return { texto: 'Lido sem IA, por regras fixas', atencao: false };
  return { texto: porQueSemIa(a.motivoFallback), atencao: true };
}

export const LEITURA_NA_FILA = 'Na fila: aguardando outra leitura terminar';

/**
 * "Lendo 2 de 5 arquivos" enquanto o servidor processa; na fila da consultoria, `LEITURA_NA_FILA` (sem contagem: nada
 * começou); sem a contagem (sessão antiga ou ainda sem arquivo lido), `null`.
 */
export function textoDaLeitura(leitura?: LeituraEmAndamento | null): string | null {
  if (leitura?.aguardando) return LEITURA_NA_FILA;
  if (!leitura || leitura.total <= 0) return null;
  const lidos = Math.min(Math.max(leitura.lidos, 0), leitura.total);
  return `Lendo ${lidos} de ${plural(leitura.total, 'arquivo', 'arquivos')}`;
}

/**
 * Dúvidas de exercício ou alimento que o "Aceitar todas as sugestões" resolve: ainda abertas e com uma única sugestão,
 * ligada a um item da biblioteca (mesma regra do servidor, que confere de novo). Várias sugestões ou só da IA ficam
 * para a pessoa escolher.
 */
export const duvidasComSugestaoUnica = (duvidas: readonly DuvidaImportacao[]): DuvidaImportacao[] =>
  duvidas.filter(
    (d) =>
      !d.resolvida &&
      (d.tipo.startsWith('EXERCICIO') || d.tipo.startsWith('ALIMENTO')) &&
      d.sugestoes.length === 1 &&
      !!d.sugestoes[0].referenciaId
  );

/**
 * Como o lote foi lido (`modoEfetivo` e `fallbackParaRegras`), em uma frase, sem falar de servidor, chave ou provedor (2.8).
 * Nunca afirma um modo que não corresponde ao que foi executado.
 */
export function resumoDoModoProcessamento(modo?: ModoProcessamentoResumo | null): {
  titulo: string;
  descricao: string;
  alertaFallback: string | null;
} {
  if (!modo) return { titulo: 'Leitura dos arquivos', descricao: 'Os arquivos são lidos e separados por aluno.', alertaFallback: null };
  if (modo.fallbackParaRegras && modo.modoEfetivo === 'IA') {
    return {
      titulo: LIDO_EM_PARTE,
      descricao: `${LIDO_EM_PARTE}.`,
      alertaFallback: modo.motivoFallback === 'TEMPO_ESGOTADO'
        ? TEMPO_ESGOTADO
        : 'Uma parte do documento foi lida sem IA, por regras fixas. Confira os termos e os alunos com atenção.',
    };
  }
  if (modo.fallbackParaRegras) {
    return {
      titulo: 'Lido sem IA',
      descricao: 'Lido sem IA, por regras fixas.',
      alertaFallback: modo.motivoFallback === 'TEMPO_ESGOTADO'
        ? TEMPO_ESGOTADO
        : `${porQueSemIa(modo.motivoFallback)} Confira os termos e os alunos com atenção.`,
    };
  }
  if (modo.modoEfetivo === 'IA') return { titulo: 'Lido com IA', descricao: 'Lido com IA. Confira tudo antes de gravar.', alertaFallback: null };
  return { titulo: 'Lido sem IA', descricao: 'Lido sem IA, por regras fixas. Confira os termos antes de gravar.', alertaFallback: null };
}

/** Lido sem IA (regras fixas, com ou sem contingência): o treino pode ter vindo desmontado. Sem modo informado, não há o que dizer. */
export const lidoSemIa = (modo?: ModoProcessamentoResumo | null): boolean => !!modo && (modo.fallbackParaRegras || modo.modoEfetivo === 'REGRAS');

export const DICA_DE_TREINO_DESMONTADO =
  'Se o treino veio desmontado, copie o texto do PDF e cole em "Colar treino (Docs / PDF)", no editor do modelo de treino.';

/**
 * Diagnóstico legível da cobertura de leitura de um arquivo (páginas lidas vs. sem texto / truncamento). Lido pela imagem
 * do documento (4.2), a cobertura do texto extraído não diz mais nada (a IA leu o arquivo inteiro): nulo.
 */
export function resumoDaCoberturaDoArquivo(cobertura?: CoberturaArquivo | null, enviadoComoArquivo = false): {
  texto: string;
  tom: 'sucesso' | 'atencao' | 'perigo' | 'neutro';
} | null {
  if (!cobertura || enviadoComoArquivo) return null;
  if (cobertura.status === 'SEM_TEXTO') {
    return {
      texto: cobertura.paginasTotal ? `Nenhuma página legível (0 de ${cobertura.paginasTotal})` : 'Sem texto legível no arquivo',
      tom: 'perigo',
    };
  }
  if (cobertura.paginasTotal != null && cobertura.paginasLidas != null) {
    const partes = [`${cobertura.paginasLidas} de ${cobertura.paginasTotal} ${cobertura.paginasTotal === 1 ? 'página lida' : 'páginas lidas'}`];
    if ((cobertura.paginasSemTexto ?? 0) > 0) partes.push(`${cobertura.paginasSemTexto} sem texto`);
    if (cobertura.truncado) partes.push('conteúdo truncado');
    return {
      texto: partes.join(' · '),
      tom: cobertura.status === 'COMPLETA' && !cobertura.truncado ? 'sucesso' : 'atencao',
    };
  }
  if (cobertura.blocos != null) {
    const texto = `${plural(cobertura.blocos, 'bloco lido', 'blocos lidos')}${cobertura.truncado ? ' · conteúdo truncado' : ''}`;
    return {
      texto,
      tom: cobertura.status === 'COMPLETA' && !cobertura.truncado ? 'sucesso' : 'atencao',
    };
  }
  return null;
}

/** Gera chave única para idempotência de uma tentativa de confirmação. */
export function gerarChaveIdempotencia(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Resumo do resultado da gravação: título, alerta pela situação e só as contagens que aconteceram. */
export function resumoDoResultado(r: ConfirmacaoResultado): {
  titulo: string;
  descricao: string | null;
  alerta: { tom: 'atencao' | 'perigo'; texto: string } | null;
  linhas: string[];
} {
  const linhas: string[] = [];
  const se = (n: number, um: string, varios: string) => { if (n > 0) linhas.push(plural(n, um, varios)); };
  se(r.alunosCriados, 'aluno novo', 'alunos novos');
  se(r.alunosVinculados, 'aluno já cadastrado recebeu os dados', 'alunos já cadastrados receberam os dados');
  se(r.treinosCriados, 'rascunho de treino', 'rascunhos de treino');
  se(r.dietasCriadas, 'rascunho de dieta', 'rascunhos de dieta');
  se(r.modelosCriados, 'modelo salvo', 'modelos salvos');
  se(r.pesosGravados, 'peso gravado', 'pesos gravados');
  se(r.pesosIgnorados, 'peso não gravado: sem data legível, fora da faixa ou já registrado nessa data', 'pesos não gravados: sem data legível, fora da faixa ou já registrados nessa data');
  const descricao = r.gruposImportados > 0 ? 'Treino e dieta entraram como rascunho. Nada foi publicado para os alunos.' : null;
  if (r.situacao === 'FALHOU') {
    return {
      titulo: 'Nada foi gravado', descricao, linhas,
      alerta: { tom: 'perigo', texto: `${plural(r.gruposComErro, 'aluno ficou', 'alunos ficaram')} com erro. O motivo aparece em cada um, na lista acima.` },
    };
  }
  if (r.situacao === 'CONCLUIDA_COM_ERROS') {
    return {
      titulo: 'Importação gravada em parte', descricao, linhas,
      alerta: { tom: 'atencao', texto: `${plural(r.gruposComErro, 'aluno não foi gravado', 'alunos não foram gravados')}. O motivo aparece em cada um, na lista acima.` },
    };
  }
  return { titulo: 'Importação concluída', descricao, linhas, alerta: null };
}

/**
 * Dúvidas que a tela mostra: a API já descarta termo em branco ou só pontuação; se algum escapar, a linha não aparece
 * (sem letra nem número não há o que corrigir). A contagem de pendentes usa a mesma lista.
 */
export const duvidasVisiveis = (duvidas: readonly DuvidaImportacao[] | null | undefined): DuvidaImportacao[] =>
  (duvidas ?? []).filter((d) => /[\p{L}\p{N}]/u.test(d.termoOriginal ?? ''));

/** Trecho do arquivo onde o termo apareceu; em branco é "—" (ausência de dado), nunca aspas vazias. */
export const trechoDaDuvida = (d: Pick<DuvidaImportacao, 'trechoOriginal'>): string => d.trechoOriginal?.trim() || '—';

const ANTES_DE_LER: readonly EstadoSessao[] = ['RASCUNHO', 'RECEBENDO', 'PROCESSANDO'];

/**
 * Resumo da coluna lateral: arquivos, o que foi encontrado e os termos pendentes. Antes de ler, só os arquivos enviados
 * (o resto é "—"); treino e dieta sem a permissão de ler são "—" (a API os omite), nunca zero.
 */
export function resumoDaSessao(s: Pick<SessaoDetalhe, 'estado' | 'arquivos' | 'grupos' | 'duvidas'>, pode: Pode): {
  linhas: { rotulo: string; valor: string }[];
  termosPendentes: number | null;
} {
  const lida = !ANTES_DE_LER.includes(s.estado);
  const total = s.arquivos.length;
  const semErro = s.arquivos.filter((a) => !a.erroCodigo).length;
  const contar = (permitido: boolean, n: number) => (lida && permitido ? String(n) : '—');
  return {
    linhas: [
      lida ? { rotulo: 'Arquivos lidos', valor: `${semErro} de ${total}` } : { rotulo: 'Arquivos enviados', valor: String(total) },
      { rotulo: 'Alunos encontrados', valor: contar(true, s.grupos.length) },
      { rotulo: 'Treinos encontrados', valor: contar(pode('TREINO_LER'), s.grupos.filter((g) => g.treino).length) },
      { rotulo: 'Dietas encontradas', valor: contar(pode('DIETA_LER'), s.grupos.filter((g) => g.dieta).length) },
    ],
    termosPendentes: lida ? duvidasVisiveis(s.duvidas).filter((d) => !d.resolvida).length : null,
  };
}

/** Limites reais da API (`ImportacaoAssistidaService`: 20 arquivos, 900 KB por arquivo, 8 MB por importação). */
export const FORMATOS_E_LIMITES = 'PDF, DOCX, XLSX ou CSV · até 20 arquivos, 900 KB cada e 8 MB no total';
/** Com a leitura por imagem ligada (4.2) JPG e PNG entram, no mesmo limite. */
export const FORMATOS_E_LIMITES_COM_IMAGEM = 'PDF, DOCX, XLSX, CSV, JPG ou PNG · até 20 arquivos, 900 KB cada e 8 MB no total';

/**
 * Aviso do envio só com a leitura por imagem ligada (`importacaoPorImagemHabilitada` do `GET /eu`, 4.2): os formatos a
 * mais (no mesmo 900 KB: o envio confere o tamanho antes do formato) e o que vai inteiro ao provedor. Não troca a versão
 * dos termos (fica para a revisão jurídica).
 */
export const AVISO_DA_LEITURA_POR_IMAGEM =
  'JPG e PNG também são aceitos, até 900 KB cada. Um PDF com alguma página sem texto (escaneada) e os prints (JPG/PNG) são enviados inteiros ao provedor de IA para leitura. PDFs de evolução podem conter foto de corpo, que é dado sensível: não envie fotos de corpo.';

/** As cinco etapas da importação, com a linha curta que aparece antes de começar. */
export const ETAPAS_DA_IMPORTACAO = [
  { titulo: 'Enviar arquivos ou texto', linha: 'PDF, DOCX, planilhas ou texto colado.' },
  { titulo: 'Ler e separar por aluno', linha: 'O servidor lê e agrupa por aluno.' },
  { titulo: 'Conferir termos e dúvidas', linha: 'Exercícios e alimentos não reconhecidos.' },
  { titulo: 'Escolher o que gravar', linha: 'O destino de cada aluno e o que entra.' },
  { titulo: 'Confirmar', linha: 'Treino e dieta entram como rascunho.' },
] as const;

export type NumeroDaEtapa = 1 | 2 | 3 | 4 | 5;

/**
 * Etapa atual pela máquina de estados da sessão: sem sessão ou sem arquivo, 1; recebendo, lendo ou com erro de leitura,
 * 2 (também lida sem aluno encontrado: nada foi separado); em revisão com termo pendente, 3; sem termo, 4 até a seleção
 * valer e 5 com ela (ou sem grupo pendente: só tentar de novo o que deu erro). `prontoParaGravar` vem da tela.
 */
export function etapaDaImportacao(
  s: Pick<SessaoDetalhe, 'estado' | 'arquivos' | 'grupos' | 'duvidas'> | null,
  prontoParaGravar: boolean,
): NumeroDaEtapa {
  if (!s || s.arquivos.length === 0) return 1;
  if (s.estado === 'CONCLUIDA') return 5;
  if (s.estado !== 'REVISANDO' || s.grupos.length === 0) return 2;
  if (duvidasVisiveis(s.duvidas).some((d) => !d.resolvida)) return 3;
  return prontoParaGravar ? 5 : 4;
}

export type ContagemDaEtapa = { rotulo: string; valor: string; atencao?: boolean };

/**
 * Contagens embaixo de cada etapa, só com o que a sessão já tem (as de `resumoDaSessao`); antes de ler é "—", nunca zero.
 * `selecao` = grupos marcados e grupos que podem ser marcados.
 */
export function contagensDasEtapas(
  s: Pick<SessaoDetalhe, 'estado' | 'arquivos' | 'grupos' | 'duvidas'>,
  pode: Pode,
  selecao: { marcados: number; possiveis: number },
): ContagemDaEtapa[][] {
  const { linhas, termosPendentes } = resumoDaSessao(s, pode);
  const lida = termosPendentes !== null;
  const [arquivos, ...separados] = linhas;
  return [
    [{ rotulo: 'Arquivos enviados', valor: String(s.arquivos.length) }],
    [lida ? arquivos : { rotulo: 'Arquivos lidos', valor: '—' }, ...separados],
    [{ rotulo: 'Termos pendentes', valor: termosPendentes === null ? '—' : termosPendentes ? String(termosPendentes) : 'Nenhum', atencao: !!termosPendentes }],
    [{ rotulo: 'Selecionados', valor: lida ? `${selecao.marcados} de ${selecao.possiveis}` : '—' }],
    [{ rotulo: 'Já gravados', valor: lida ? String(s.grupos.filter((g) => g.estado === 'IMPORTADO').length) : '—' }],
  ];
}

/** Selo da importação em aberto: âmbar quando o treinador precisa agir (ler, revisar), vermelho no erro, neutro enquanto lê. */
export function seloDaSessao(estado: EstadoSessao): { texto: string; tipo: TipoSelo } {
  const texto = textoDoEstadoDaSessao(estado);
  if (estado === 'ERRO') return { texto, tipo: 'perigo' };
  if (estado === 'REVISANDO' || estado === 'RECEBENDO') return { texto, tipo: 'atencao' };
  return { texto, tipo: 'neutro' };
}

/** "2 arquivos · 16 alunos · 26 dúvidas" só depois de ler; antes, grupos e dúvidas ainda não existem (não são zero). */
export function contagensDaSessaoEmAberto(s: Pick<SessaoListaItem, 'estado' | 'totalArquivos' | 'totalGrupos' | 'duvidasAbertas'>): string {
  const arquivos = plural(s.totalArquivos, 'arquivo', 'arquivos');
  if (s.estado !== 'REVISANDO') return arquivos;
  return `${arquivos} · ${plural(s.totalGrupos, 'aluno', 'alunos')} · ${plural(s.duvidasAbertas, 'dúvida', 'dúvidas')}`;
}

const DIA_MS = 86_400_000;
const dataDeBrasilia = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);

/** Prazo da importação pelas datas de Brasília: "expira hoje", "expira em 1 dia", "expira em N dias"; vencida ou sem data, nulo. */
export function prazoDaSessao(expiraEm: string | null | undefined, agora: Date = new Date()): string | null {
  const fim = expiraEm ? Date.parse(expiraEm) : NaN;
  if (Number.isNaN(fim) || fim <= agora.getTime()) return null;
  const dias = Math.round((Date.parse(dataDeBrasilia(fim)) - Date.parse(dataDeBrasilia(agora.getTime()))) / DIA_MS);
  if (dias <= 0) return 'expira hoje';
  return `expira em ${plural(dias, 'dia', 'dias')}`;
}

/** Para onde vai o foco ao entrar na tela (T-206): o título ou a primeira ação pendente à vista. */
export type FocoAoEntrar =
  | { tipo: 'titulo' }
  | { tipo: 'ler' }
  | { tipo: 'termo'; duvidaId: string }
  | { tipo: 'aluno'; grupoId: string };

/**
 * Sem sessão aberta (a lista "Importações em aberto" é escolha, não pendência), o título. Com a sessão aberta pelo
 * endereço, a primeira ação que espera o treinador, na ordem da página: "Ler os arquivos" antes de ler, o primeiro termo
 * a conferir, o primeiro aluno parecido sem resposta. Nada pendente (lendo, só gravar), o título.
 */
export function focoAoEntrar(s: (Pick<SessaoDetalhe, 'estado' | 'duvidas' | 'grupos'> & { arquivos?: SessaoDetalhe['arquivos'] }) | null): FocoAoEntrar {
  if (!s) return { tipo: 'titulo' };
  if (sessaoPodeLer(s.estado, s.arquivos)) return { tipo: 'ler' };
  const termo = duvidasVisiveis(s.duvidas).find((d) => !d.resolvida);
  if (termo) return { tipo: 'termo', duvidaId: termo.id };
  const grupo = (s.grupos ?? []).find((g) => precisaEscolherAluno(g, new Set()));
  return grupo ? { tipo: 'aluno', grupoId: grupo.id } : { tipo: 'titulo' };
}

/**
 * "Ler os arquivos" vale antes de ler, depois de uma leitura que não terminou (0.3: `ERRO`, os arquivos continuam lá) e
 * na revisão com arquivo acrescentado e ainda não lido (2.1: a API deixa a sessão em `REVISANDO` e lê só os pendentes).
 */
export const sessaoPodeLer = (estado: EstadoSessao, arquivos?: readonly Pick<ArquivoResumo, 'estado'>[]): boolean =>
  estado === 'RASCUNHO' || estado === 'RECEBENDO' || estado === 'ERRO' || (estado === 'REVISANDO' && !!arquivos?.some((a) => a.estado === 'RECEBIDO'));

export const rotuloDoLer = (estado: EstadoSessao): string => (estado === 'ERRO' ? 'Tentar ler de novo' : 'Ler os arquivos');

export const AVISO_LEITURA_NAO_TERMINOU = 'A leitura não terminou. Seus arquivos continuam aqui.';

/** Dá para acrescentar arquivo ou texto (2.1): sessão aberta que não está lendo (a API recusa só a encerrada e a que lê). */
export const sessaoAceitaArquivos = (estado: EstadoSessao): boolean => sessaoPodeCancelar(estado) && estado !== 'PROCESSANDO';

/** Os limites de `FORMATOS_E_LIMITES`, os mesmos de `ImportacaoAssistidaService` (20 arquivos, 900 KB cada, 8 MB no total). */
export const ARQUIVOS_POR_SESSAO = 20;
export const BYTES_POR_ARQUIVO = 900 * 1024;
export const BYTES_POR_SESSAO = 8 * 1024 * 1024;
const EXTENSOES_ACEITAS = ['pdf', 'docx', 'xlsx', 'csv'];
const EXTENSOES_DE_IMAGEM = ['jpg', 'jpeg', 'png'];
const FORMATO_NAO_SUPORTADO_COM_IMAGEM = 'Formato não aceito. Envie PDF, DOCX, XLSX, CSV, JPG ou PNG.';

/** Arquivo que a pessoa escolheu, antes de subir. `tamanho` em bytes, quando o aparelho informa (sem ele, a API confere). */
export interface ArquivoParaEnviar {
  nome: string;
  tamanho?: number | null;
}

/**
 * Confere no app, antes de subir, o que a API recusaria (2.1): extensão, 900 KB por arquivo, 20 arquivos e 8 MB por
 * importação, contando o que a sessão já tem. Devolve o motivo de cada arquivo (nulo = pode ir), na mesma ordem.
 * `comImagem` (4.2, `importacaoPorImagemHabilitada`): JPG e PNG também passam, com o mesmo limite de 900 KB.
 */
export function motivosAntesDeEnviar(
  lista: readonly ArquivoParaEnviar[],
  naSessao: { quantos: number; bytes: number },
  comImagem = false,
): (string | null)[] {
  const aceitas = comImagem ? [...EXTENSOES_ACEITAS, ...EXTENSOES_DE_IMAGEM] : EXTENSOES_ACEITAS;
  let quantos = naSessao.quantos;
  let bytes = naSessao.bytes;
  return lista.map((a) => {
    const partes = a.nome.toLowerCase().split('.');
    const extensao = partes.length > 1 ? partes[partes.length - 1] : '';
    if (extensao === 'xls') return ERROS_DA_API.FORMATO_XLS_ANTIGO;
    if (!aceitas.includes(extensao)) return comImagem ? FORMATO_NAO_SUPORTADO_COM_IMAGEM : ERROS_DA_API.FORMATO_NAO_SUPORTADO;
    if (a.tamanho === 0) return ERROS_DA_API.ARQUIVO_VAZIO;
    const tamanho = a.tamanho ?? 0;
    if (tamanho > BYTES_POR_ARQUIVO) return ERROS_DA_API.ARQUIVO_GRANDE_DEMAIS;
    if (quantos >= ARQUIVOS_POR_SESSAO) return ERROS_DA_API.LIMITE_DE_ARQUIVOS;
    if (bytes + tamanho > BYTES_POR_SESSAO) return ERROS_DA_API.LIMITE_DE_VOLUME;
    quantos += 1;
    bytes += tamanho;
    return null;
  });
}

/** Resultado do envio de um arquivo, para a lista "Enviado" ou "Recusado: motivo" (2.1). */
export interface ResultadoDoEnvio {
  nome: string;
  motivo: string | null;
}

export const textoDoEnvio = (r: ResultadoDoEnvio): string => (r.motivo ? `Recusado: ${r.motivo}` : 'Enviado');

/** Campos do cadastro que dá para corrigir antes de gravar (2.2). */
export interface CadastroEditavel {
  nome: string;
  email: string;
  telefone: string;
}

export const cadastroDoGrupo = (g: Pick<GrupoImportavel, 'nomeDetectado' | 'cadastro'>): CadastroEditavel => ({
  nome: g.cadastro?.nome ?? g.nomeDetectado ?? '',
  email: g.cadastro?.email ?? '',
  telefone: g.cadastro?.telefone ?? '',
});

/** Erros por campo; vazio = pode salvar. E-mail e WhatsApp são opcionais; o nome, não. */
export function errosDoCadastro(c: CadastroEditavel): Partial<Record<keyof CadastroEditavel, string>> {
  const erros: Partial<Record<keyof CadastroEditavel, string>> = {};
  const nome = c.nome.trim();
  if (!nome) erros.nome = 'Informe o nome do aluno.';
  else if (nome.length > 120) erros.nome = 'O nome passa de 120 caracteres.';
  if (c.email.trim() && !emailValido(c.email.trim())) erros.email = 'Informe um e-mail válido, como nome@exemplo.com.';
  const telefone = erroDoTelefone(c.telefone);
  if (telefone) erros.telefone = telefone;
  return erros;
}

/** Só o que mudou vai no `PUT` (e-mail ou WhatsApp em branco apaga o lido). Nada mudou = nulo. */
export function mudancasDoCadastro(antes: CadastroEditavel, agora: CadastroEditavel): Partial<CadastroEditavel> | null {
  const mudou: Partial<CadastroEditavel> = {};
  for (const campo of ['nome', 'email', 'telefone'] as const) {
    if (agora[campo].trim() !== antes[campo].trim()) mudou[campo] = agora[campo].trim();
  }
  return Object.keys(mudou).length ? mudou : null;
}

/** A sugestão que vira botão na linha do termo ("Usar Supino reto", 2.4): a ligada à biblioteca de maior nota. */
export function melhorSugestao(d: Pick<DuvidaImportacao, 'sugestoes'>): DuvidaImportacao['sugestoes'][number] | null {
  const ordenadas = [...(d.sugestoes ?? [])].sort(
    (a, b) => Number(!!b.referenciaId) - Number(!!a.referenciaId) || (b.nota ?? 0) - (a.nota ?? 0),
  );
  return ordenadas[0] ?? null;
}

export const AVISO_TERMO_NAO_CONFERIDO = 'Termo não conferido entra com o nome do documento, sem vínculo com a biblioteca.';

/**
 * Frase ao lado de "Gravar selecionados" (2.7): o que a gravação vai fazer, pelo destino de cada aluno marcado.
 * Ex.: "Vai criar 2 alunos novos e gravar em 1 aluno já cadastrado." Nada marcado = nulo.
 */
export function resumoDaGravacao(grupos: readonly GrupoImportavel[], marcados: ReadonlySet<string>): string | null {
  const vao = grupos.filter((g) => marcados.has(g.id));
  const contar = (d: DestinoGrupo) => vao.filter((g) => g.destino === d).length;
  const partes: string[] = [];
  const novos = contar('CRIAR_ALUNO');
  const vinculados = contar('VINCULAR_EXISTENTE');
  const modelos = contar('MODELO_BIBLIOTECA');
  if (novos) partes.push(`criar ${plural(novos, 'aluno novo', 'alunos novos')}`);
  if (vinculados) partes.push(`gravar em ${plural(vinculados, 'aluno já cadastrado', 'alunos já cadastrados')}`);
  if (modelos) partes.push(`salvar ${plural(modelos, 'modelo', 'modelos')}`);
  if (!partes.length) return null;
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : partes[0];
  return `Vai ${lista}.`;
}

/** Falhas seguidas do acompanhamento da leitura até avisar (2.6). */
export const FALHAS_ATE_AVISAR = 5;
const RODADA_DA_LEITURA_MS = 12 * 60_000;
/**
 * Quanto esperar a leitura antes de avisar (2.6): uma rodada por 3 arquivos, cada uma no teto de um arquivo.
 * shortcut: espelha à mão `ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos` (3 em paralelo, ~11 min por arquivo
 * mais folga); trocar quando a sessão trouxer o prazo da leitura.
 */
export const tetoDaEsperaMs = (arquivos: number): number => Math.max(1, Math.ceil(arquivos / 3)) * RODADA_DA_LEITURA_MS;

export const PODE_SAIR_DURANTE_A_LEITURA = 'Pode sair desta tela: a leitura continua.';
export const AVISO_DA_ESPERA_LONGA =
  'A leitura está demorando mais que o normal ou não conseguimos acompanhá-la. Continue esperando ou cancele a importação.';

/** Atalhos depois de gravar (2.5): a ficha sempre; o rascunho do treino e o da dieta quando foram criados. */
export function atalhosDoAlunoGravado(a: AlunoGravado): { rotulo: string; href: string }[] {
  const atalhos = [{ rotulo: 'Abrir ficha', href: `/treinador/alunos/${a.alunoId}` }];
  if (a.treinoId) {
    atalhos.push({ rotulo: 'Abrir rascunho do treino', href: `/treinador/treinos/${a.treinoId}` });
  }
  if (a.dietaId) {
    atalhos.push({ rotulo: 'Abrir rascunho da dieta', href: `/treinador/dietas/${a.dietaId}` });
  }
  return atalhos;
}

/** Tipo do termo do dicionário da consultoria, em português. */
export const rotuloDoTipoDoApelido = (tipo: string): string =>
  tipo.startsWith('EXERCICIO') ? 'Exercício' : tipo.startsWith('ALIMENTO') ? 'Alimento' : 'Outro';
