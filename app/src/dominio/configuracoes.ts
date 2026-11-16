import { temFuncionalidade } from './funcionalidadesDoPlano';
import { podeAcessarTela } from './permissoes';
import { caminhoDoHref, semAcento } from './telas';

/** Grupos do hub de Configurações, na ordem em que aparecem (`docs/planos/configuracoes-centralizadas.md`, H5). */
export const GRUPOS_DE_CONFIGURACAO = ['Sua conta', 'Consultoria', 'Equipe', 'Alunos e atendimento', 'Financeiro', 'Dados', 'Ajuda'] as const;
export type GrupoDeConfiguracao = (typeof GRUPOS_DE_CONFIGURACAO)[number];

/**
 * Booleanos do `GET /eu` (já na sessão) que ligam ou desligam um cartão. Ausente ou `false` = o cartão some. A frente
 * Contato (passo 3 do plano) acrescenta aqui `emailDominioProprioHabilitado` e `whatsappHabilitado`.
 * `pagamentosHabilitados` não entra: já vive dentro de `podeAcessarTela`.
 */
export type ChaveDeConfiguracao = 'recebimentoOnlineHabilitado';

export interface CartaoDeConfiguracao {
  id: string;
  grupo: GrupoDeConfiguracao;
  titulo: string;
  /** Uma linha, mostrada sob o título. */
  descricao: string;
  /** Rota que já existe; `?aba=`/`?tipo=` só com valor que a tela de destino já lê. */
  href: string;
  /** Sinônimos sem acento, só para a busca. */
  palavras: string[];
  /** Permissão extra além da que `podeAcessarTela` já pede para o destino. */
  permissao?: string;
  /** Funcionalidade do plano de que o cartão depende; desligada, o cartão some. */
  funcionalidade?: string;
  chave?: ChaveDeConfiguracao;
}

/** O que a sessão do treinador já sabe; o hub é só apresentação (a API autoriza cada operação). */
export interface ContextoDeConfiguracoes {
  pode: (codigo: string) => boolean;
  administrador: boolean;
  pagamentosHabilitados: boolean;
  /** Funcionalidades ligadas no plano (`undefined` = todas, como em `temFuncionalidade`). */
  liberadas?: readonly string[];
  chaves: Readonly<Partial<Record<ChaveDeConfiguracao, boolean>>>;
}

/** Catálogo na ordem de exibição dentro de cada grupo. Só destinos que existem hoje (os da frente Contato entram no passo 3). */
export const CARTOES_DE_CONFIGURACAO: readonly CartaoDeConfiguracao[] = [
  { id: 'meus-dados', grupo: 'Sua conta', titulo: 'Meus dados', descricao: 'Seu nome, e-mail e telefone.', href: '/treinador/meus-dados', palavras: ['nome', 'email', 'telefone', 'perfil', 'trocar senha'] },
  { id: 'seguranca', grupo: 'Sua conta', titulo: 'Segurança', descricao: 'Senha e verificação em duas etapas.', href: '/treinador/seguranca', palavras: ['senha', 'duas etapas', '2fa', 'mfa', 'autenticador', 'codigos de recuperacao'] },
  { id: 'ajustes', grupo: 'Sua conta', titulo: 'Aparência e preferências', descricao: 'Tema, tamanho do texto e outras preferências deste aparelho.', href: '/treinador/ajustes', palavras: ['ajustes', 'tema', 'escuro', 'claro', 'contraste', 'fonte', 'animacoes', 'vibracao', 'unidade de carga', 'libras'] },
  { id: 'minha-conta', grupo: 'Sua conta', titulo: 'Assinatura e faturas', descricao: 'Plano da consultoria, consumo e faturas.', href: '/treinador/minha-conta', palavras: ['minha conta', 'plano', 'assinatura', 'faturas', 'boleto', 'contrato', 'consumo', 'limites'] },
  // MARCA_ALTERAR além da guarda da tela (administrador): decisão do Gustavo em 16/11 (H10), o administrador tem as duas.
  { id: 'marca', grupo: 'Consultoria', titulo: 'Marca', descricao: 'Nome, logo e cores que o aluno vê, e o acompanhamento.', href: '/treinador/marca', palavras: ['logo', 'cores', 'tema', 'identidade', 'visual', 'nome', 'acompanhamento', 'dias de atualizacao', 'fases do ciclo'], permissao: 'MARCA_ALTERAR' },
  { id: 'equipe-membros', grupo: 'Equipe', titulo: 'Membros e convites', descricao: 'Quem trabalha com você e os convites pendentes.', href: '/treinador/equipe?aba=membros', palavras: ['equipe', 'usuarios', 'convidar', 'novo membro', 'desativar'] },
  { id: 'equipe-perfis', grupo: 'Equipe', titulo: 'Perfis e permissões', descricao: 'O que cada perfil pode ver e fazer no app.', href: '/treinador/equipe?aba=perfis', palavras: ['equipe', 'permissoes', 'acesso', 'administrador', 'nutricionista', 'assistente'] },
  { id: 'auditoria', grupo: 'Equipe', titulo: 'Auditoria', descricao: 'Histórico das ações feitas na consultoria.', href: '/treinador/auditoria', palavras: ['historico', 'registro de acoes', 'log', 'eventos'] },
  { id: 'questionarios', grupo: 'Alunos e atendimento', titulo: 'Questionários de atualização', descricao: 'Perguntas que o aluno responde a cada atualização.', href: '/treinador/planejamento?aba=atualizacao', palavras: ['check-in', 'checkin', 'atualizacao', 'formulario', 'questionario padrao'], permissao: 'QUESTIONARIO_LER' },
  { id: 'anamneses', grupo: 'Alunos e atendimento', titulo: 'Anamneses', descricao: 'Perguntas do questionário inicial do aluno.', href: '/treinador/planejamento?aba=anamnese', palavras: ['anamnese', 'questionario inicial', 'avaliacao inicial', 'formulario inicial'], permissao: 'QUESTIONARIO_LER' },
  { id: 'perguntas-inscricao', grupo: 'Alunos e atendimento', titulo: 'Perguntas da inscrição', descricao: 'Perguntas da página pública "Quero ser aluno".', href: '/treinador/planejamento?aba=inscricao', palavras: ['quero ser aluno', 'inscricao', 'formulario de inscricao', 'campos ocultos', 'interessados'], permissao: 'QUESTIONARIO_LER' },
  { id: 'interessados', grupo: 'Alunos e atendimento', titulo: 'Link de inscrição e respostas prontas', descricao: 'O link que você divulga e as mensagens prontas para os interessados.', href: '/treinador/interessados', palavras: ['inscricao', 'link de inscricao', 'respostas prontas', 'mensagens', 'whatsapp', 'captacao', 'crm'] },
  { id: 'metodologias', grupo: 'Alunos e atendimento', titulo: 'Metodologias', descricao: 'Regras de séries e preparação usadas nos treinos.', href: '/treinador/planejamento?tipo=metodologia', palavras: ['metodologia', 'series', 'preparacao', 'receitas', 'treino'], permissao: 'MODELO_LER' },
  { id: 'financeiro-planos', grupo: 'Financeiro', titulo: 'Planos comerciais', descricao: 'Os planos que você cobra dos alunos.', href: '/treinador/financeiro?aba=planos', palavras: ['pagamentos', 'mensalidade', 'valores', 'cobranca', 'planos'] },
  { id: 'financeiro-lembretes', grupo: 'Financeiro', titulo: 'Lembretes de cobrança', descricao: 'Quando avisar o aluno por e-mail sobre uma cobrança.', href: '/treinador/financeiro?aba=lembretes', palavras: ['lembrete', 'avisos', 'email', 'vencimento', 'atraso', 'inadimplencia'] },
  { id: 'financeiro-recebimento', grupo: 'Financeiro', titulo: 'Recebimento online', descricao: 'Receber pelo link de pagamento da InfinitePay.', href: '/treinador/financeiro?aba=recebimento', palavras: ['infinitepay', 'pix', 'cartao', 'link de pagamento', 'parcelamento', 'juros'], chave: 'recebimentoOnlineHabilitado' },
  { id: 'importacao', grupo: 'Dados', titulo: 'Importação', descricao: 'Trazer alunos, pesos, alimentos e exercícios de planilhas.', href: '/treinador/importacao', palavras: ['planilha', 'xlsx', 'csv', 'importar', 'alunos', 'pesos', 'alimentos', 'exercicios'] },
  { id: 'planilha-completa', grupo: 'Dados', titulo: 'Importar planilha completa', descricao: 'Migrar alunos com treinos e dietas de outra plataforma.', href: '/treinador/importacao/planilha-completa', palavras: ['planilha completa', 'migrar', 'migracao', 'outra plataforma', 'treinos', 'dietas'] },
  { id: 'ajuda', grupo: 'Ajuda', titulo: 'Ajuda', descricao: 'Guias e respostas sobre o uso do app.', href: '/treinador/ajuda', palavras: ['guia', 'tutorial', 'suporte', 'duvidas', 'como fazer'] },
  { id: 'termos', grupo: 'Ajuda', titulo: 'Termos e privacidade', descricao: 'Termo de uso e aviso de privacidade.', href: '/treinador/termos', palavras: ['termo de uso', 'aviso de privacidade', 'lgpd', 'dados pessoais', 'politica'] },
];

/**
 * Cartões que o perfil pode ver, na ordem do catálogo. A mesma regra do menu e da guarda (`podeAcessarTela` do destino) e,
 * além dela, a permissão extra, a funcionalidade do plano e a chave da plataforma do cartão.
 */
export function cartoesVisiveis(contexto: ContextoDeConfiguracoes, cartoes: readonly CartaoDeConfiguracao[] = CARTOES_DE_CONFIGURACAO): CartaoDeConfiguracao[] {
  return cartoes.filter(
    (c) =>
      podeAcessarTela(caminhoDoHref(c.href), contexto.pode, contexto.pagamentosHabilitados, contexto.administrador) &&
      (c.permissao === undefined || contexto.pode(c.permissao)) &&
      (c.funcionalidade === undefined || temFuncionalidade(contexto.liberadas, c.funcionalidade)) &&
      (c.chave === undefined || contexto.chaves[c.chave] === true),
  );
}

/**
 * Busca sem acento nem maiúscula no título, na descrição e nos sinônimos; cada palavra digitada precisa aparecer. Texto
 * vazio devolve todos. Não reordena: os grupos e os cartões ficam onde estão.
 */
export function buscarCartoes(texto: string, cartoes: readonly CartaoDeConfiguracao[]): CartaoDeConfiguracao[] {
  const consulta = semAcento(texto);
  if (!consulta) return [...cartoes];
  const palavras = consulta.split(/\s+/);
  return cartoes.filter((c) => {
    const todo = [c.titulo, c.descricao, ...c.palavras].map(semAcento).join(' ');
    return palavras.every((p) => todo.includes(p));
  });
}

/** Agrupa na ordem de `GRUPOS_DE_CONFIGURACAO`, mantendo a ordem dos cartões; grupo sem cartão não aparece. */
export function gruposDeCartoes(cartoes: readonly CartaoDeConfiguracao[]): { grupo: GrupoDeConfiguracao; cartoes: CartaoDeConfiguracao[] }[] {
  return GRUPOS_DE_CONFIGURACAO.map((grupo) => ({ grupo, cartoes: cartoes.filter((c) => c.grupo === grupo) })).filter((g) => g.cartoes.length > 0);
}
