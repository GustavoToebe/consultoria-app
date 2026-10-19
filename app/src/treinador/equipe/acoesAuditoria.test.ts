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
