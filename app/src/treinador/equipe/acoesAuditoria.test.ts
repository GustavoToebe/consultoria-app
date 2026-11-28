import { ACOES_AUDITORIA } from './acoesAuditoria';

test('aceite dos termos, exportação, anonimização e mobilidade têm rótulo no filtro da auditoria', () => {
  for (const acao of ['TERMOS_ACEITOS', 'ALUNO_EXPORTADO', 'ALUNO_ANONIMIZADO', 'ALUNO_EXCLUIU_CONTA', 'MOBILIDADE_PUBLICADA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações de convite de equipe têm rótulo no filtro da auditoria', () => {
  for (const acao of ['USUARIO_CONVIDADO', 'CONVITE_EQUIPE_ACEITO', 'CONVITE_EQUIPE_CANCELADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('o limite de alunos do membro tem rótulo no filtro da auditoria', () => {
  expect(ACOES_AUDITORIA.USUARIO_LIMITE_DE_ALUNOS_ALTERADO).toBeTruthy();
});

test('publicar e copiar plano para outro aluno têm rótulo no filtro da auditoria, por tipo', () => {
  for (const acao of ['TREINO_PUBLICADO', 'DIETA_PUBLICADA', 'TREINO_COPIADO', 'DIETA_COPIADA', 'MOBILIDADE_COPIADA', 'PASTA_COPIADA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações da inscrição por link têm rótulo no filtro da auditoria', () => {
  for (const acao of ['INSCRICAO_ACEITA', 'INSCRICAO_RECUSADA', 'INSCRICAO_ALTERADA', 'INSCRICAO_PAGAMENTO_CONFIRMADO', 'INSCRICAO_NOTA_ADICIONADA', 'INSCRICAO_CONFIGURACAO_ALTERADA', 'INSCRICAO_LINK_RENOVADO', 'INSCRICAO_ENCERRADA', 'INSCRICAO_REABERTA', 'INSCRICAO_PROPOSTA_ALTERADA', 'INSCRICAO_RELACIONADA', 'INSCRICAO_RELACAO_DESFEITA', 'INSCRICAO_ORIGEM_ALTERADA', 'INSCRICAO_MODELO_CRIADO', 'INSCRICAO_MODELO_ALTERADO', 'INSCRICAO_MODELO_EXCLUIDO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações do financeiro têm rótulo no filtro da auditoria', () => {
  for (const acao of ['PLANO_COMERCIAL_CRIADO', 'PLANO_COMERCIAL_ALTERADO', 'PLANO_COMERCIAL_ARQUIVADO', 'CONTRATACAO_CRIADA', 'CONTRATACAO_ALTERADA', 'CONTRATACAO_PAUSADA', 'CONTRATACAO_RETOMADA', 'CONTRATACAO_ENCERRADA', 'COBRANCA_DE_SAIDA_CRIADA', 'COBRANCA_CANCELADA', 'COBRANCA_BAIXA_DESFEITA', 'COBRANCA_ESTORNADA', 'COBRANCA_CONTESTADA', 'COBRANCA_CONTESTACAO_ENCERRADA', 'PAGAMENTO_MANUAL_REGISTRADO', 'LANCAMENTO_FINANCEIRO_CRIADO', 'LANCAMENTO_FINANCEIRO_ALTERADO', 'LANCAMENTO_FINANCEIRO_EXCLUIDO', 'FINANCEIRO_EXPORTADO', 'FORMAS_DE_RECEBIMENTO_CONFIGURADAS', 'PIX_APAGADO', 'COBRANCAS_AVULSAS_GERADAS', 'RESPONSAVEL_FINANCEIRO_DEFINIDO', 'RESPONSAVEL_FINANCEIRO_REMOVIDO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações do recebimento online (InfinitePay) têm rótulo no filtro da auditoria', () => {
  for (const acao of ['RECEBIMENTO_ONLINE_CONFIGURADO', 'RECEBIMENTO_ONLINE_REMOVIDO', 'LINK_DE_PAGAMENTO_GERADO', 'PAGAMENTO_ONLINE_CONFIRMADO', 'PAGAMENTO_ESTORNADO', 'PAGAMENTO_PARA_CONFERIR', 'PAGAMENTO_CONFERIDO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações do Overtraining Pay têm rótulo no filtro da auditoria', () => {
  for (const acao of ['OVERTRAINING_PAY_CONFIGURADO', 'OVERTRAINING_PAY_SINCRONIZADO', 'OVERTRAINING_PAY_TESTE_GERADO', 'OVERTRAINING_PAY_HOMOLOGADO', 'OVERTRAINING_PAY_REMOVIDO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações da avaliação física têm rótulo no filtro da auditoria', () => {
  for (const acao of ['AVALIACAO_FISICA_REGISTRADA', 'AVALIACAO_FISICA_ALTERADA', 'AVALIACAO_FISICA_EXCLUIDA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações das agendas pessoais e dos eventos têm rótulo no filtro da auditoria', () => {
  for (const acao of ['AGENDA_PESSOAL_CRIADA', 'AGENDA_PESSOAL_ALTERADA', 'AGENDA_PESSOAL_APAGADA', 'EVENTO_CRIADO', 'EVENTO_ALTERADO', 'EVENTO_EXCLUIDO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('importar e desfazer a importação têm rótulo no filtro da auditoria', () => {
  for (const acao of ['IMPORTACAO_CONCLUIDA', 'IMPORTACAO_DESFEITA', 'IMPORTACAO_RESPOSTAS_ESQUECIDAS', 'IMPORTACAO_ASSISTIDA_CONCLUIDA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('o apelido da Comunidade (do aluno e da moderação) tem rótulo no filtro da auditoria', () => {
  for (const acao of ['ALUNO_APELIDO_ALTERADO', 'COMUNIDADE_APELIDO_REMOVIDO', 'ALUNO_PERFIL_COMUNIDADE_ALTERADO', 'COMUNIDADE_CONFIGURACAO_ALTERADA', 'COMUNIDADE_DENUNCIAS_DISPENSADAS']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações dos pods da Comunidade têm rótulo no filtro da auditoria', () => {
  for (const acao of ['POD_CRIADO', 'POD_ALTERADO', 'ALUNO_POD_ALTERADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações da vitrine têm rótulo no filtro da auditoria', () => {
  for (const acao of ['VITRINE_ITEM_CRIADO', 'VITRINE_ITEM_ALTERADO', 'VITRINE_ITEM_EXCLUIDO', 'VITRINE_ITEM_ORDEM_ALTERADA', 'VITRINE_ITEM_FOTO_ALTERADA', 'VITRINE_ITEM_FOTO_REMOVIDA', 'VITRINE_CATEGORIA_CRIADA', 'VITRINE_CATEGORIA_RENOMEADA', 'VITRINE_CATEGORIA_EXCLUIDA', 'VITRINE_CATEGORIAS_REORDENADAS', 'VITRINE_PAGINA_ALTERADA', 'VITRINE_LINK_RENOVADO', 'VITRINE_MARKETPLACE_ALTERADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
  expect(ACOES_AUDITORIA.VITRINE_MARKETPLACE_ALTERADO).not.toMatch(/marketplace/i);
});

test('ações das tags de aluno têm rótulo no filtro da auditoria', () => {
  for (const acao of ['COBRANCAS_RENEGOCIADAS', 'ACORDO_DESFEITO', 'KIWIFY_CONFIGURADA', 'KIWIFY_REMOVIDA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
  for (const acao of ['TAG_ALUNO_CRIADA', 'TAG_ALUNO_ALTERADA', 'TAG_ALUNO_APAGADA', 'ALUNO_TAGS_ALTERADAS']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações de pausa de acesso (Fase 2) e ficha rápida/cortesia (Fase 3) têm rótulo no filtro da auditoria', () => {
  for (const acao of [
    'ALUNO_ACESSO_PAUSADO',
    'ALUNO_ACESSO_REATIVADO',
    'ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE',
    'INSCRICAO_FICHA_RAPIDA_CRIADA',
    'INSCRICAO_ACEITA_SEM_COBRANCA',
  ]) {
    expect(ACOES_AUDITORIA[acao]).toBeTruthy();
  }
});

test('ações do acesso do aluno ao app têm rótulo no filtro da auditoria', () => {
  for (const acao of ['ALUNO_EMAIL_DE_ACESSO_ALTERADO', 'ALUNO_ACESSO_DESATIVADO', 'ALUNO_ACESSO_REATIVADO', 'ALUNOS_CONVITES_GERADOS']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('a verificação em duas etapas tem rótulo no filtro da auditoria (a API grava as três)', () => {
  for (const acao of ['MFA_PREPARADO', 'MFA_ATIVADO', 'MFA_DESATIVADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações do contrato digital têm rótulo no filtro da auditoria', () => {
  for (const acao of ['CONTRATO_MODELO_CRIADO', 'CONTRATO_MODELO_ALTERADO', 'CONTRATO_MODELO_ARQUIVADO', 'CONTRATO_GERADO', 'CONTRATO_LINK_GERADO', 'CONTRATO_ASSINADO', 'CONTRATO_CANCELADO', 'CONTRATO_PRAZO_PRORROGADO', 'CONTRATO_PRAZO_CONFIGURADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações das regras de atenção têm rótulo no filtro da auditoria', () => {
  for (const acao of ['REGRA_ATENCAO_CRIADA', 'REGRA_ATENCAO_ALTERADA', 'REGRA_ATENCAO_REMOVIDA', 'REGRA_ATENCAO_EXCECAO_DEFINIDA', 'REGRA_ATENCAO_EXCECAO_REMOVIDA', 'PUSH_ATENCAO_ALTERADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('unir grupos musculares da biblioteca tem rótulo no filtro da auditoria', () => {
  expect(ACOES_AUDITORIA.GRUPOS_MUSCULARES_UNIDOS).toBeTruthy();
});
