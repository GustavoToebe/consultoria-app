import { ACOES_AUDITORIA } from './acoesAuditoria';

test('aceite dos termos, exportação, anonimização e mobilidade têm rótulo no filtro da auditoria', () => {
  for (const acao of ['TERMOS_ACEITOS', 'ALUNO_EXPORTADO', 'ALUNO_ANONIMIZADO', 'ALUNO_EXCLUIU_CONTA', 'MOBILIDADE_PUBLICADA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações de convite de equipe têm rótulo no filtro da auditoria', () => {
  for (const acao of ['USUARIO_CONVIDADO', 'CONVITE_EQUIPE_ACEITO', 'CONVITE_EQUIPE_CANCELADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('publicar e copiar plano para outro aluno têm rótulo no filtro da auditoria, por tipo', () => {
  for (const acao of ['TREINO_PUBLICADO', 'DIETA_PUBLICADA', 'TREINO_COPIADO', 'DIETA_COPIADA', 'MOBILIDADE_COPIADA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações da inscrição por link têm rótulo no filtro da auditoria', () => {
  for (const acao of ['INSCRICAO_ACEITA', 'INSCRICAO_RECUSADA', 'INSCRICAO_ALTERADA', 'INSCRICAO_PAGAMENTO_CONFIRMADO', 'INSCRICAO_NOTA_ADICIONADA', 'INSCRICAO_CONFIGURACAO_ALTERADA', 'INSCRICAO_LINK_RENOVADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações do financeiro têm rótulo no filtro da auditoria', () => {
  for (const acao of ['PLANO_COMERCIAL_CRIADO', 'PLANO_COMERCIAL_ALTERADO', 'PLANO_COMERCIAL_ARQUIVADO', 'CONTRATACAO_CRIADA', 'CONTRATACAO_ALTERADA', 'CONTRATACAO_PAUSADA', 'CONTRATACAO_RETOMADA', 'CONTRATACAO_ENCERRADA', 'COBRANCA_CANCELADA', 'COBRANCA_BAIXA_DESFEITA', 'PAGAMENTO_MANUAL_REGISTRADO', 'LANCAMENTO_FINANCEIRO_CRIADO', 'LANCAMENTO_FINANCEIRO_ALTERADO', 'LANCAMENTO_FINANCEIRO_EXCLUIDO', 'FINANCEIRO_EXPORTADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações do recebimento online (InfinitePay) têm rótulo no filtro da auditoria', () => {
  for (const acao of ['RECEBIMENTO_ONLINE_CONFIGURADO', 'RECEBIMENTO_ONLINE_REMOVIDO', 'LINK_DE_PAGAMENTO_GERADO', 'PAGAMENTO_ONLINE_CONFIRMADO', 'PAGAMENTO_ESTORNADO', 'PAGAMENTO_PARA_CONFERIR', 'PAGAMENTO_CONFERIDO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});
