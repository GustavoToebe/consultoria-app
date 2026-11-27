import type { ChaveDeIdentificacao } from '../tema/tokens';

/**
 * Categorias das ações da Auditoria (27/11): cada código do catálogo (`treinador/equipe/acoesAuditoria.ts`) cai em uma, e
 * a categoria dá a bolinha da linha e os atalhos acima da tabela. A cor é de IDENTIFICAÇÃO (diz a área, nunca situação):
 * cinco categorias com as cinco cores da paleta e Acesso neutro (são seis e a paleta tem cinco; o login é o evento mais
 * comum e o de menos interesse). O nome da categoria também aparece em texto no detalhe: a cor nunca é o único sinal.
 * `categoriasDeAuditoria.test.ts` acusa código do catálogo sem categoria (ou em duas) e categoria com código que o
 * catálogo não tem. Funções puras.
 */
export type CategoriaDeAuditoria = 'ACESSO' | 'ALUNOS' | 'PLANOS' | 'FINANCEIRO' | 'EQUIPE' | 'CONFIGURACOES';

export const ROTULO_DA_CATEGORIA: Record<CategoriaDeAuditoria, string> = {
  ACESSO: 'Acesso', ALUNOS: 'Alunos', PLANOS: 'Planos', FINANCEIRO: 'Financeiro', EQUIPE: 'Equipe', CONFIGURACOES: 'Configurações',
};

/** Cor de identificação da categoria; `null` = neutra (`textoSuave`). */
export const COR_DA_CATEGORIA: Record<CategoriaDeAuditoria, ChaveDeIdentificacao | null> = {
  ACESSO: null, ALUNOS: 'CIANO', PLANOS: 'AZUL', FINANCEIRO: 'INDIGO', EQUIPE: 'VIOLETA', CONFIGURACOES: 'MAGENTA',
};

/**
 * Os logins, que o atalho "Sem logins" esconde: só a entrada no app (com sucesso ou barrada pelo limite). Não há evento de
 * logout na API. Senha e verificação em duas etapas ficam visíveis: são mudanças de segurança da conta, não rotina.
 */
export const ACOES_DE_LOGIN: readonly string[] = ['LOGIN_SUCESSO', 'LOGIN_BLOQUEADO'];

export const CODIGOS_DA_CATEGORIA: Record<CategoriaDeAuditoria, readonly string[]> = {
  ACESSO: [
    'LOGIN_SUCESSO', 'LOGIN_BLOQUEADO', 'SENHA_REDEFINIDA', 'SENHA_ALTERADA', 'MFA_PREPARADO', 'MFA_ATIVADO', 'MFA_DESATIVADO', 'TERMOS_ACEITOS',
  ],
  EQUIPE: [
    'USUARIO_CONVIDADO', 'CONVITE_EQUIPE_ACEITO', 'CONVITE_EQUIPE_CANCELADO', 'USUARIO_ALTERADO', 'USUARIO_PERFIL_ALTERADO', 'USUARIO_DESATIVADO',
    'USUARIO_LIMITE_DE_ALUNOS_ALTERADO', 'PERFIL_CRIADO', 'PERFIL_ALTERADO', 'PERFIL_APAGADO', 'PERFIL_DUPLICADO',
  ],
  ALUNOS: [
    'ALUNO_CRIADO', 'ALUNO_ALTERADO', 'ALUNO_SITUACAO', 'ALUNO_COMPROMISSOS_CANCELADOS', 'ALUNO_CONVIDADO', 'ALUNO_RESPONSAVEL_ALTERADO',
    'ALUNO_META_DO_PESO_ALTERADA', 'ALUNO_EXPORTADO', 'ALUNO_ANONIMIZADO', 'ALUNO_ACESSO_DEFINIDO', 'ALUNO_EMAIL_DE_ACESSO_ALTERADO',
    'ALUNO_ACESSO_DESATIVADO', 'ALUNO_ACESSO_REATIVADO', 'ALUNO_FOTO_PERFIL_ALTERADA_PELA_EQUIPE', 'ALUNO_FOTO_PERFIL_REMOVIDA_PELA_EQUIPE',
    'ALUNO_EXCLUIU_CONTA', 'ALUNO_DADOS_ALTERADOS_PELO_ALUNO', 'ALUNO_APELIDO_ALTERADO', 'ALUNO_PERFIL_COMUNIDADE_ALTERADO',
    'COMUNIDADE_APELIDO_REMOVIDO', 'COMUNIDADE_DENUNCIAS_DISPENSADAS', 'USO_DE_IMAGEM_AUTORIZADO', 'USO_DE_IMAGEM_REVOGADO',
    'COMPARACAO_DE_FOTOS_GERADA', 'ALUNO_POD_ALTERADO', 'CICLO_ACOMPANHAMENTO_ATIVADO', 'CICLO_ACOMPANHAMENTO_DESATIVADO',
    'CICLO_REGISTROS_APAGADOS', 'INSCRICAO_ACEITA', 'INSCRICAO_RECUSADA', 'INSCRICAO_ENCERRADA', 'INSCRICAO_REABERTA',
    'INSCRICAO_PROPOSTA_ALTERADA', 'INSCRICAO_RELACIONADA', 'INSCRICAO_RELACAO_DESFEITA', 'INSCRICAO_ORIGEM_ALTERADA',
    'INSCRICAO_ALTERADA', 'INSCRICAO_NOTA_ADICIONADA', 'COMPROMISSO_CRIADO', 'COMPROMISSO_ALTERADO', 'COMPROMISSO_SITUACAO_ALTERADA',
    'ANAMNESE_ATRIBUIDA', 'ANAMNESE_ENVIADA', 'ANAMNESE_REVISADA', 'ANAMNESE_DISPENSADA', 'ANAMNESE_CADASTRO_PREENCHIDO',
    'ANAMNESE_ALTERACAO_APLICADA', 'ANAMNESE_ALTERACAO_DESCARTADA', 'ALUNO_QUESTIONARIO_ALTERADO', 'LESAO_REGISTRADA', 'LESAO_ALTERADA',
    'PESO_REGISTRADO', 'AVALIACAO_FISICA_REGISTRADA', 'AVALIACAO_FISICA_ALTERADA', 'AVALIACAO_FISICA_EXCLUIDA', 'IMPORTACAO_CONCLUIDA',
    'IMPORTACAO_DESFEITA', 'IMPORTACAO_RESPOSTAS_ESQUECIDAS', 'IMPORTACAO_ASSISTIDA_CONCLUIDA', 'ATUALIZACAO_FEEDBACK', 'ALUNO_TAGS_ALTERADAS',
    'AVISOS_PELO_WHATSAPP_DO_ALUNO_ALTERADOS', 'REGRA_ATENCAO_EXCECAO_DEFINIDA', 'REGRA_ATENCAO_EXCECAO_REMOVIDA',
  ],
  PLANOS: [
    'TREINO_PUBLICADO', 'DIETA_PUBLICADA', 'MOBILIDADE_PUBLICADA', 'TREINO_COPIADO', 'DIETA_COPIADA', 'MOBILIDADE_COPIADA', 'PASTA_CRIADA',
    'PASTA_REPLICADA', 'PASTA_COPIADA', 'PLANO_LIBERACAO_ALTERADA', 'PLANO_LIBERADO_AGORA', 'PASTA_FINALIZADA', 'PASTA_QUESTIONARIO_ALTERADO',
    'QUESTIONARIO_CRIADO', 'QUESTIONARIO_PUBLICADO', 'QUESTIONARIO_DUPLICADO', 'QUESTIONARIO_PADRAO_ALTERADO', 'QUESTIONARIO_ARQUIVADO',
    'QUESTIONARIO_DESARQUIVADO', 'QUESTIONARIO_EXCLUIDO', 'EXERCICIO_IMAGEM_ALTERADA', 'EXERCICIO_IMAGEM_REMOVIDA', 'CSV_EXERCICIOS_IMPORTADO',
    'CSV_ALIMENTOS_IMPORTADO',
  ],
  FINANCEIRO: [
    'INSCRICAO_PAGAMENTO_CONFIRMADO', 'INSCRICAO_ACEITA_SEM_COBRANCA', 'PLANO_COMERCIAL_CRIADO', 'PLANO_COMERCIAL_ALTERADO',
    'PLANO_COMERCIAL_ARQUIVADO', 'CONTRATACAO_CRIADA', 'CONTRATACAO_ALTERADA', 'CONTRATACAO_PAUSADA', 'CONTRATACAO_RETOMADA',
    'CONTRATACAO_ENCERRADA', 'COBRANCA_DE_SAIDA_CRIADA', 'COBRANCA_CANCELADA', 'COBRANCA_BAIXA_DESFEITA', 'COBRANCA_ESTORNADA',
    'COBRANCA_CONTESTADA', 'COBRANCA_CONTESTACAO_ENCERRADA', 'PAGAMENTO_MANUAL_REGISTRADO', 'LANCAMENTO_FINANCEIRO_CRIADO',
    'LANCAMENTO_FINANCEIRO_ALTERADO', 'LANCAMENTO_FINANCEIRO_EXCLUIDO', 'FINANCEIRO_EXPORTADO', 'RECEBIMENTO_ONLINE_CONFIGURADO',
    'RECEBIMENTO_ONLINE_REMOVIDO', 'OVERTRAINING_PAY_CONFIGURADO', 'OVERTRAINING_PAY_SINCRONIZADO', 'OVERTRAINING_PAY_TESTE_GERADO',
    'OVERTRAINING_PAY_HOMOLOGADO', 'OVERTRAINING_PAY_REMOVIDO', 'LINK_DE_PAGAMENTO_GERADO', 'PAGAMENTO_ONLINE_CONFIRMADO',
    'PAGAMENTO_ESTORNADO', 'PAGAMENTO_PARA_CONFERIR', 'PAGAMENTO_CONFERIDO', 'LEMBRETES_DE_COBRANCA_CONFIGURADOS',
    'FORMAS_DE_RECEBIMENTO_CONFIGURADAS', 'PIX_APAGADO', 'COBRANCAS_AVULSAS_GERADAS', 'LEMBRETES_DE_COBRANCA_DO_ALUNO_ALTERADOS',
    'COBRANCAS_RENEGOCIADAS', 'ACORDO_DESFEITO', 'KIWIFY_CONFIGURADA', 'KIWIFY_REMOVIDA', 'RESPONSAVEL_FINANCEIRO_DEFINIDO',
    'RESPONSAVEL_FINANCEIRO_REMOVIDO', 'ALUNO_ACESSO_PAUSADO', 'ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE', 'CONTRATO_MODELO_CRIADO',
    'CONTRATO_MODELO_ALTERADO', 'CONTRATO_MODELO_ARQUIVADO', 'CONTRATO_GERADO', 'CONTRATO_ASSINADO', 'CONTRATO_CANCELADO',
    'CONTRATO_PRAZO_PRORROGADO', 'CONTRATO_LINK_GERADO', 'CONTRATO_PRAZO_CONFIGURADO',
  ],
  CONFIGURACOES: [
    'MARCA_ALTERADA', 'CONSULTORIA_META_DO_PESO_ALTERADA', 'LOGO_ALTERADA', 'LOGO_REMOVIDA', 'COMUNIDADE_CONFIGURACAO_ALTERADA', 'POD_CRIADO',
    'POD_ALTERADO', 'INSCRICAO_MODELO_CRIADO', 'INSCRICAO_MODELO_ALTERADO', 'INSCRICAO_MODELO_EXCLUIDO', 'INSCRICAO_CONFIGURACAO_ALTERADA',
    'INSCRICAO_LINK_RENOVADO', 'INSCRICAO_FICHA_RAPIDA_CRIADA', 'AGENDA_PESSOAL_CRIADA', 'AGENDA_PESSOAL_ALTERADA', 'AGENDA_PESSOAL_APAGADA',
    'EVENTO_CRIADO', 'EVENTO_ALTERADO', 'EVENTO_EXCLUIDO', 'VITRINE_ITEM_CRIADO', 'VITRINE_ITEM_ALTERADO', 'VITRINE_ITEM_EXCLUIDO',
    'VITRINE_ITEM_ORDEM_ALTERADA', 'VITRINE_CATEGORIA_CRIADA', 'VITRINE_CATEGORIA_RENOMEADA', 'VITRINE_CATEGORIA_EXCLUIDA',
    'VITRINE_CATEGORIAS_REORDENADAS', 'VITRINE_ITEM_FOTO_ALTERADA', 'VITRINE_ITEM_FOTO_REMOVIDA', 'VITRINE_PAGINA_ALTERADA',
    'VITRINE_LINK_RENOVADO', 'VITRINE_MARKETPLACE_ALTERADO', 'TAG_ALUNO_CRIADA', 'TAG_ALUNO_ALTERADA', 'TAG_ALUNO_APAGADA',
    'WHATSAPP_CONEXAO_CONFIGURADA', 'WHATSAPP_CONEXAO_REMOVIDA', 'WHATSAPP_MODELO_CONFIGURADO', 'WHATSAPP_MODELO_REMOVIDO',
    'REGRA_ATENCAO_CRIADA', 'REGRA_ATENCAO_ALTERADA', 'REGRA_ATENCAO_REMOVIDA', 'PUSH_ATENCAO_ALTERADO',
  ],
};

const CATEGORIA_DO_CODIGO: ReadonlyMap<string, CategoriaDeAuditoria> = new Map(
  (Object.entries(CODIGOS_DA_CATEGORIA) as [CategoriaDeAuditoria, readonly string[]][]).flatMap(([c, codigos]) => codigos.map((k) => [k, c] as const)),
);

/** A categoria da ação; código fora do catálogo (a API à frente do app) = `null`, que a tela mostra neutro. */
export function categoriaDaAcao(codigo: string): CategoriaDeAuditoria | null {
  return CATEGORIA_DO_CODIGO.get(codigo) ?? null;
}

/**
 * Atalhos acima da tabela: "Tudo" não restringe, "Sem logins" é todo o catálogo menos `ACOES_DE_LOGIN` (na API vai como
 * `acaoExceto`, ver `filtrosDeAuditoria.pedidoComAtalho`; a lista daqui só serve à interseção com o filtro "Ação") e os
 * outros, os códigos da categoria. No endereço vão como `?atalho=sem-logins|alunos|planos|financeiro|equipe` (sem a chave = Tudo).
 */
export type AtalhoDeAuditoria = 'TUDO' | 'SEM_LOGINS' | 'ALUNOS' | 'PLANOS' | 'FINANCEIRO' | 'EQUIPE';

export const OPCOES_DE_ATALHO: readonly { valor: AtalhoDeAuditoria; rotulo: string }[] = [
  { valor: 'TUDO', rotulo: 'Tudo' }, { valor: 'SEM_LOGINS', rotulo: 'Sem logins' }, { valor: 'ALUNOS', rotulo: 'Alunos' },
  { valor: 'PLANOS', rotulo: 'Planos' }, { valor: 'FINANCEIRO', rotulo: 'Financeiro' }, { valor: 'EQUIPE', rotulo: 'Equipe' },
];

const NO_ENDERECO: Record<Exclude<AtalhoDeAuditoria, 'TUDO'>, string> = {
  SEM_LOGINS: 'sem-logins', ALUNOS: 'alunos', PLANOS: 'planos', FINANCEIRO: 'financeiro', EQUIPE: 'equipe',
};

export function atalhoDoEndereco(valor: string | string[] | undefined): AtalhoDeAuditoria {
  const v = (Array.isArray(valor) ? valor[0] : valor)?.trim().toLowerCase();
  const achado = (Object.entries(NO_ENDERECO) as [AtalhoDeAuditoria, string][]).find(([, texto]) => texto === v);
  return achado ? achado[0] : 'TUDO';
}

/** O valor do `?atalho=` (`undefined` em Tudo, que tira a chave do endereço). */
export function atalhoParaEndereco(atalho: AtalhoDeAuditoria): string | undefined {
  return atalho === 'TUDO' ? undefined : NO_ENDERECO[atalho];
}

/** Os códigos do atalho dentro do catálogo; `null` = sem restrição (Tudo). */
export function acoesDoAtalho(atalho: AtalhoDeAuditoria, catalogo: Readonly<Record<string, string>>): string[] | null {
  if (atalho === 'TUDO') return null;
  const codigos = Object.keys(catalogo);
  if (atalho === 'SEM_LOGINS') return codigos.filter((c) => !ACOES_DE_LOGIN.includes(c));
  return codigos.filter((c) => categoriaDaAcao(c) === atalho);
}

/**
 * Atalho × filtro "Ação" do painel: valem os dois ao mesmo tempo (interseção; pessoa e período continuam valendo à parte).
 * - nenhum dos dois: `{ acoes: [] }` (a API traz todas);
 * - só um: a lista dele;
 * - os dois: os códigos marcados no painel que estão no atalho, na ordem do painel;
 * - interseção vazia (Ação "Login realizado" com "Sem logins"): `'NENHUMA'`. Lista vazia na API quer dizer TODAS, então a
 *   tela não chama a API e mostra o vazio que explica o conflito.
 */
export function acoesCombinadas(doPainel: readonly string[], atalho: AtalhoDeAuditoria, catalogo: Readonly<Record<string, string>>): { acoes: string[] } | 'NENHUMA' {
  const doAtalho = acoesDoAtalho(atalho, catalogo);
  if (!doAtalho) return { acoes: [...doPainel] };
  if (!doPainel.length) return { acoes: doAtalho };
  const noAtalho = new Set(doAtalho);
  const comuns = doPainel.filter((c) => noAtalho.has(c));
  return comuns.length ? { acoes: comuns } : 'NENHUMA';
}
