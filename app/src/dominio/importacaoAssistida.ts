import { codigoApi, ErroApi, mensagemApi } from '@plataforma/web';

import type {
  ConfirmacaoResultado,
  DestinoGrupo,
  EstadoSessao,
  GrupoImportavel,
  TipoDuvida,
} from '../servicos/importacaoAssistida';
import type { TipoSelo } from '../ui/Selo';

/** Textos da tela da importação assistida: os códigos da API nunca aparecem crus. */
const ESTADOS: Record<EstadoSessao, string> = {
  RECEBENDO: 'Recebendo arquivos',
  PROCESSANDO: 'Processando',
  REVISANDO: 'Em revisão',
  CONCLUIDA: 'Concluída',
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
  FORMATO_NAO_CONFERE: 'O conteúdo não confere com a extensão do arquivo.',
  FORMATO_NAO_SUPORTADO: 'Formato não aceito.',
};

export const motivoDoErroDoArquivo = (codigo: string): string => ERROS_DO_ARQUIVO[codigo] ?? 'Não foi possível ler este arquivo.';

/** Mensagens dos erros das rotas da importação assistida. 403 e 429 pelo status; o resto pelo código. */
const ERROS_DA_API: Record<string, string> = {
  OBJETIVO_INVALIDO: 'Escolha o que importar entre as opções da tela.',
  FORMATO_NAO_SUPORTADO: 'Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.',
  FORMATO_NAO_CONFERE: 'O conteúdo do arquivo não confere com a extensão. Abra o arquivo e salve de novo no formato certo.',
  ARQUIVO_VAZIO: 'O arquivo está vazio.',
  ARQUIVO_GRANDE_DEMAIS: 'Passa do tamanho máximo. Divida em partes menores.',
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
  return codigo === 'CONFLITO_EDICAO' || codigo === 'GRUPO_JA_IMPORTADO' || codigo === 'SESSAO_CONCLUIDA';
}

/** Campo do texto colado que recebe o erro do envio; `null` = vai ao alerta. */
export function campoDoErroDoTexto(erro: unknown): 'titulo' | 'conteudo' | null {
  const codigo = codigoApi(erro);
  if (codigo === 'TITULO_GRANDE_DEMAIS') return 'titulo';
  if (codigo === 'TEXTO_VAZIO' || codigo === 'ARQUIVO_GRANDE_DEMAIS') return 'conteudo';
  return null;
}

type Pode = (codigo: string) => boolean;

/**
 * O que o grupo traz, linha a linha. Sem a permissão de ler, a API omite a parte (peso vem vazio, treino e dieta nulos):
 * a tela não sabe se existe e mostra "—", nunca zero.
 */
export function linhasDoGrupo(g: GrupoImportavel, pode: Pode): { rotulo: string; valor: string }[] {
  const pesos = pode('ALUNO_SENSIVEL_LER') && g.pesos?.length ? `${g.pesos.length} pesagem(ns)` : '—';
  const treino = pode('TREINO_LER') && g.treino ? `${g.treino.sessoes?.length ?? 0} divisão(ões)` : '—';
  const dieta = pode('DIETA_LER') && g.dieta ? `${g.dieta.refeicoes?.length ?? 0} refeição(ões)` : '—';
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

/** Grupos que "Gravar rascunhos" manda: os pendentes que não são ignorados nem estão com erro. Nunca vazio na API (vazio = todos). */
export const idsParaGravar = (grupos: GrupoImportavel[]): string[] =>
  grupos.filter((g) => !grupoResumido(g) && g.destino !== 'IGNORAR').map((g) => g.id);

/** Grupos que "Tentar de novo" manda: só os que ficaram com erro na gravação. */
export const idsComErro = (grupos: GrupoImportavel[]): string[] => grupos.filter((g) => g.estado === 'ERRO').map((g) => g.id);

/** Por que "Gravar rascunhos" está desabilitado; `null` = pode gravar. */
export function motivoParaNaoConfirmar(grupos: GrupoImportavel[], pode: Pode, conferidos: ReadonlySet<string> = new Set()): string | null {
  const vao = grupos.filter((g) => !grupoResumido(g) && g.destino !== 'IGNORAR');
  if (vao.length === 0) return 'Escolha o destino de pelo menos um grupo.';
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

/** Resumo do resultado da gravação: título, alerta pela situação e só as contagens que aconteceram. */
export function resumoDoResultado(r: ConfirmacaoResultado): {
  titulo: string;
  descricao: string | null;
  alerta: { tom: 'atencao' | 'perigo'; texto: string } | null;
  linhas: string[];
} {
  const linhas = [`${r.gruposImportados} grupo(s) gravado(s)`];
  const se = (n: number, texto: string) => { if (n > 0) linhas.push(`${n} ${texto}`); };
  se(r.alunosCriados, 'aluno(s) novo(s)');
  se(r.alunosVinculados, 'aluno(s) já cadastrado(s) receberam os dados');
  se(r.treinosCriados, 'rascunho(s) de treino');
  se(r.dietasCriadas, 'rascunho(s) de dieta');
  se(r.modelosCriados, 'modelo(s) salvo(s)');
  se(r.pesosGravados, 'peso(s) gravado(s)');
  se(r.pesosIgnorados, 'peso(s) não gravado(s): sem data legível, fora da faixa ou já registrado nessa data');
  const descricao = r.gruposImportados > 0 ? 'Treino e dieta entraram como rascunho. Nada foi publicado para os alunos.' : null;
  if (r.situacao === 'FALHOU') {
    return {
      titulo: 'Nada foi gravado', descricao, linhas,
      alerta: { tom: 'perigo', texto: `${r.gruposComErro} grupo(s) ficaram com erro. O motivo aparece em cada um, na lista acima.` },
    };
  }
  if (r.situacao === 'CONCLUIDA_COM_ERROS') {
    return {
      titulo: 'Importação gravada em parte', descricao, linhas,
      alerta: { tom: 'atencao', texto: `${r.gruposComErro} grupo(s) não foram gravados. O motivo aparece em cada um, na lista acima.` },
    };
  }
  return { titulo: 'Importação concluída', descricao, linhas, alerta: null };
}
