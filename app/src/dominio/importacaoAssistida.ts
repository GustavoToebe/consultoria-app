import { codigoApi, ErroApi, mensagemApi } from '@plataforma/web';

import type {
  CoberturaArquivo,
  ConfirmacaoResultado,
  DestinoGrupo,
  DuvidaImportacao,
  EstadoSessao,
  GrupoImportavel,
  LeituraEmAndamento,
  ModoProcessamentoResumo,
  ObjetivoImportacao,
  SessaoDetalhe,
  SessaoListaItem,
  TipoDuvida,
} from '../servicos/importacaoAssistida';
import type { TipoSelo } from '../ui/Selo';
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

/** Grupo que vira linha resumida, sem ações: já gravado, ignorado no fim ou com erro na gravação. */
export const grupoResumido = (g: Pick<GrupoImportavel, 'estado'>): boolean =>
  g.estado === 'IMPORTADO' || g.estado === 'IGNORADO' || g.estado === 'ERRO';

/** Título da linha resumida. O esqueleto do importado e do ignorado não tem nome: o texto sai do destino. */
export function tituloDoGrupoResumido(g: Pick<GrupoImportavel, 'estado' | 'destino' | 'nomeDetectado'>): string {
  if (g.estado === 'ERRO') return g.nomeDetectado || 'Aluno do arquivo';
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
  DESTINO_INVALIDO: 'O destino escolhido não vale para este grupo.',
  NAO_ENCONTRADO: 'O aluno escolhido não foi encontrado.',
  LIMITE_DO_PLANO: 'O plano da consultoria chegou ao limite de alunos ativos.',
  LIMITE_DO_TREINADOR: 'Você chegou ao limite de alunos definido pelo administrador.',
  ALUNO_CPF_EM_USO: 'O CPF já é de outro aluno.',
  DADOS_INVALIDOS: 'Algum dado lido do arquivo não passou na validação.',
  CONFLITO_DE_DADOS: 'Outro registro mudou ao mesmo tempo. Tente de novo.',
  ERRO_AO_GRAVAR: 'Não foi possível gravar agora. Tente de novo.',
};

export const motivoDoErroDoGrupo = (codigo: string | null | undefined): string =>
  (codigo ? ERROS_DO_GRUPO[codigo] : undefined) ?? 'Não foi possível gravar este grupo.';

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
  OBJETIVO_INVALIDO: 'Escolha o que importar entre as opções da tela.',
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
  GRUPO_JA_IMPORTADO: 'Este grupo já foi gravado. A lista foi atualizada.',
  ALUNO_INATIVO: 'Este aluno está inativo. Reative-o na ficha antes de importar.',
  ALUNO_ANONIMIZADO: 'Este aluno foi anonimizado e não recebe mais dados.',
  CONFLITO_EDICAO: 'A importação mudou desde que você abriu. A lista foi atualizada: confira e grave de novo.',
  ALUNO_JA_EXISTE: 'Já existe um aluno com este e-mail. Escolha esse aluno em vez de criar outro.',
  MIGRACAO_INDISPONIVEL: 'A importação assistida está desligada no momento.',
  SELECAO_VAZIA: 'Selecione pelo menos um grupo para gravar.',
  SELECAO_INVALIDA: 'Alguns grupos selecionados mudaram ou já foram gravados. A lista foi atualizada.',
  PREVIA_DESATUALIZADA: 'A prévia mudou desde que você abriu. Confira a lista atualizada e tente gravar de novo.',
  CHAVE_IDEMPOTENCIA_OBRIGATORIA: 'Não foi possível identificar esta tentativa de gravação. Tente de novo.',
  IDEMPOTENCIA_CONFLITANTE: 'Esta tentativa já foi enviada com outra seleção. Confira a lista antes de tentar de novo.',
  SESSAO_CANCELADA: 'Esta importação foi cancelada.',
  SESSAO_EXPIRADA: 'Esta importação expirou. Comece uma nova importação.',
  SESSAO_PROCESSANDO: 'A importação ainda está sendo processada. Aguarde concluir.',
  CONTEUDO_INDISPONIVEL: 'O conteúdo original deste arquivo não está mais disponível.',
};

/** Erro de uma ação da tela em português. `confirmar` muda o texto do 403 (nada foi gravado). */
export function textoDoErroDaImportacao(erro: unknown, acao?: 'confirmar'): string {
  const status = erro instanceof ErroApi ? erro.status : null;
  if (status === 403) {
    return acao === 'confirmar'
      ? 'Seu perfil não permite gravar parte do que foi lido (peso, objetivo, treino, dieta, pasta ou modelo). Nada foi gravado. Escolha Ignorar nesses grupos ou peça a permissão a quem administra a equipe.'
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
  return [
    { rotulo: 'E-mail', valor: g.cadastro?.email || '—' },
    { rotulo: 'WhatsApp', valor: g.cadastro?.telefone || '—' },
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

/** Grupos pendentes que podem ser selecionados para gravação (não resumidos e não marcados como Ignorar). */
export const gruposSelecionaveis = (grupos: GrupoImportavel[]): GrupoImportavel[] =>
  grupos.filter((g) => !grupoResumido(g) && g.destino !== 'IGNORAR');

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
      if (g.estado !== 'PRONTO') return false;
      if (precisaEscolherAluno(g, conferidos)) return false;
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
    return selecionados ? 'Selecione pelo menos um grupo para gravar.' : 'Escolha o destino de pelo menos um grupo.';
  }
  if (selecionados && !hashPrevia) {
    return 'A prévia da sessão ainda não está pronta para gravar. Atualize a sessão.';
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

/** Sessões que ainda podem ser retomadas pelo treinador na tela inicial. */
export const sessaoRetomavel = (s: Pick<SessaoListaItem, 'estado'>): boolean =>
  s.estado === 'RASCUNHO' || s.estado === 'RECEBENDO' || s.estado === 'PROCESSANDO' || s.estado === 'REVISANDO' || s.estado === 'ERRO';

/** Sessões que ainda aceitam cancelamento explícito. */
export const sessaoPodeCancelar = (estado: EstadoSessao): boolean =>
  estado === 'RASCUNHO' || estado === 'RECEBENDO' || estado === 'PROCESSANDO' || estado === 'REVISANDO' || estado === 'ERRO';

/** Por que a leitura caiu para as regras fixas (`motivoFallback` do servidor). Motivo desconhecido não quebra: cai no texto geral. */
const MOTIVOS_DO_FALLBACK: Record<string, string> = {
  CHAVE_AUSENTE: 'A leitura por IA não está configurada neste servidor (falta a chave do serviço), então foram usadas regras fixas.',
  ERRO_PROVEDOR:
    'O serviço de IA não respondeu (tempo esgotado ou instabilidade) mesmo depois de uma nova tentativa, então foram usadas regras fixas.',
};

/** "Lendo 2 de 5 arquivos" enquanto o servidor processa; sem a contagem (sessão antiga ou ainda sem arquivo lido), `null`. */
export function textoDaLeitura(leitura?: LeituraEmAndamento | null): string | null {
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
 * Resumo honesto de como o lote foi processado (`modoEfetivo` e `fallbackParaRegras`).
 * Nunca exibe texto fixo afirmando um modo que não corresponde ao que o servidor executou.
 */
export function resumoDoModoProcessamento(modo?: ModoProcessamentoResumo | null): {
  titulo: string;
  descricao: string;
  alertaFallback: string | null;
} {
  if (!modo) {
    return {
      titulo: 'Leitura no servidor',
      descricao: 'Os arquivos enviados são lidos no servidor para separar alunos e planos.',
      alertaFallback: null,
    };
  }
  if (modo.fallbackParaRegras && modo.motivoFallback === 'RESPOSTA_CORTADA') {
    return {
      titulo: 'Leitura por regras fixas (contingência)',
      descricao: 'O plano era grande demais para a IA ler de uma vez; o servidor o leu por regras fixas, sem IA.',
      alertaFallback: 'O plano era grande demais para a IA ler de uma vez e foi lido sem IA. Confira os termos e grupos com atenção.',
    };
  }
  if (modo.fallbackParaRegras) {
    const porque = modo.motivoFallback ? MOTIVOS_DO_FALLBACK[modo.motivoFallback] : undefined;
    return {
      titulo: 'Leitura por regras fixas (contingência)',
      descricao: 'A leitura por IA não pôde ser concluída neste lote; o servidor usou regras fixas para separar os dados.',
      alertaFallback: `${porque ?? 'A leitura por IA não ficou disponível neste lote e o servidor usou regras fixas.'} Confira os termos e grupos com atenção.`,
    };
  }
  if (modo.modoEfetivo === 'IA') {
    return {
      titulo: 'Leitura assistida por IA',
      descricao: 'Os arquivos foram interpretados com apoio de IA. Confira tudo antes de gravar.',
      alertaFallback: null,
    };
  }
  return {
    titulo: 'Leitura por regras fixas',
    descricao:
      modo.motivoFallback === 'ENVIO_DESLIGADO'
        ? 'O envio dos arquivos a um serviço de IA está desligado neste servidor: a leitura é feita só por regras fixas, sem IA, e os termos ficam para você conferir.'
        : 'O servidor leu os arquivos por regras fixas, separou os alunos e listou os termos para você conferir.',
    alertaFallback: null,
  };
}

/** Lido sem IA (regras fixas, com ou sem contingência): o treino pode ter vindo desmontado. Sem modo informado, não há o que dizer. */
export const lidoSemIa = (modo?: ModoProcessamentoResumo | null): boolean => !!modo && (modo.fallbackParaRegras || modo.modoEfetivo === 'REGRAS');

export const DICA_DE_TREINO_DESMONTADO =
  'Se o treino veio desmontado, copie o texto do PDF e cole em "Colar treino (Docs / PDF)", no editor do modelo de treino.';

/** Diagnóstico legível da cobertura de leitura de um arquivo (páginas lidas vs. sem texto / truncamento). */
export function resumoDaCoberturaDoArquivo(cobertura?: CoberturaArquivo | null): {
  texto: string;
  tom: 'sucesso' | 'atencao' | 'perigo' | 'neutro';
} | null {
  if (!cobertura) return null;
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
  const linhas = [plural(r.gruposImportados, 'grupo gravado', 'grupos gravados')];
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
      alerta: { tom: 'perigo', texto: `${plural(r.gruposComErro, 'grupo ficou', 'grupos ficaram')} com erro. O motivo aparece em cada um, na lista acima.` },
    };
  }
  if (r.situacao === 'CONCLUIDA_COM_ERROS') {
    return {
      titulo: 'Importação gravada em parte', descricao, linhas,
      alerta: { tom: 'atencao', texto: `${plural(r.gruposComErro, 'grupo não foi gravado', 'grupos não foram gravados')}. O motivo aparece em cada um, na lista acima.` },
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

/** O que importar (26/11: três cartões de escolha, título e uma linha). */
export const OPCOES_DO_OBJETIVO: readonly { valor: ObjetivoImportacao; titulo: string; descricao: string }[] = [
  { valor: 'CADASTROS_E_PLANOS_ATUAIS', titulo: 'Cadastros e planos atuais', descricao: 'Treino e dieta de hoje. Recomendado.' },
  { valor: 'SOMENTE_CADASTROS', titulo: 'Só cadastros e contatos', descricao: 'Nomes, contatos e dados básicos.' },
  { valor: 'INCLUIR_HISTORICO', titulo: 'Tudo, com histórico', descricao: 'Inclui cargas e pesos antigos.' },
];

/** Limites reais da API (`ImportacaoAssistidaService`: 20 arquivos, 900 KB por arquivo, 8 MB por importação). */
export const FORMATOS_E_LIMITES = 'PDF, DOCX, XLSX ou CSV · até 20 arquivos, 900 KB cada e 8 MB no total';

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

/** "2 arquivos · 16 grupos · 26 dúvidas" só depois de ler; antes, grupos e dúvidas ainda não existem (não são zero). */
export function contagensDaSessaoEmAberto(s: Pick<SessaoListaItem, 'estado' | 'totalArquivos' | 'totalGrupos' | 'duvidasAbertas'>): string {
  const arquivos = plural(s.totalArquivos, 'arquivo', 'arquivos');
  if (s.estado !== 'REVISANDO') return arquivos;
  return `${arquivos} · ${plural(s.totalGrupos, 'grupo', 'grupos')} · ${plural(s.duvidasAbertas, 'dúvida', 'dúvidas')}`;
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
export function focoAoEntrar(s: Pick<SessaoDetalhe, 'estado' | 'duvidas' | 'grupos'> | null): FocoAoEntrar {
  if (!s) return { tipo: 'titulo' };
  if (s.estado === 'RASCUNHO' || s.estado === 'RECEBENDO') return { tipo: 'ler' };
  const termo = duvidasVisiveis(s.duvidas).find((d) => !d.resolvida);
  if (termo) return { tipo: 'termo', duvidaId: termo.id };
  const grupo = (s.grupos ?? []).find((g) => precisaEscolherAluno(g, new Set()));
  return grupo ? { tipo: 'aluno', grupoId: grupo.id } : { tipo: 'titulo' };
}
