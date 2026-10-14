import { ACOES_AUDITORIA } from './acoesAuditoria';

test('aceite dos termos, exportação, anonimização e mobilidade têm rótulo no filtro da auditoria', () => {
  for (const acao of ['TERMOS_ACEITOS', 'ALUNO_EXPORTADO', 'ALUNO_ANONIMIZADO', 'MOBILIDADE_PUBLICADA']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});

test('ações de convite de equipe têm rótulo no filtro da auditoria', () => {
  for (const acao of ['USUARIO_CONVIDADO', 'CONVITE_EQUIPE_ACEITO', 'CONVITE_EQUIPE_CANCELADO']) expect(ACOES_AUDITORIA[acao]).toBeTruthy();
});
