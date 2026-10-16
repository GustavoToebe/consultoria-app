import { esquecerConfiguracaoDeFotos } from '../aluno/atualizacao/fotos/configuracaoSalva';
import { apagarTodasAsFotosLocais } from '../aluno/atualizacao/fotos/fotosLocais';
import { cancelarLembretesAtualizacao } from '../aluno/atualizacao/lembretes';
import type { MotivoDoEncerramento } from '../dominio/encerrarSessaoLocal';
import { novoUid } from '../dominio/uid';
import { abrirRepositorio } from './abrirRepositorio';
import { registrarFilaRetida } from './filasRetidas';
import type { RepositorioLocal } from './repositorioLocal';

/**
 * Limpa do aparelho o que é do aluno quando a sessão acaba. Em `sair` não sobra nada. Em `recusada` (o servidor
 * derrubou a sessão) saem lembretes, fotos locais, configuração de fotos, plano, dieta, mobilidade e rascunhos, e fica só
 * a fila de registros ainda não enviados, para o mesmo aluno enviar ao entrar de novo (`DIAS_FILA_RETIDA`).
 * `repositorio` é o já aberto pelo `AlunoProvider`; sem ele (abertura do app com a sessão já recusada) abre o do usuário.
 */
export async function limparDadosDoAluno(
  usuarioId: string,
  motivo: MotivoDoEncerramento,
  repositorio?: RepositorioLocal,
): Promise<void> {
  await cancelarLembretesAtualizacao(usuarioId).catch(() => undefined);
  await apagarTodasAsFotosLocais(usuarioId).catch(() => undefined);
  await esquecerConfiguracaoDeFotos(usuarioId);
  const alvo = repositorio ?? abrirRepositorio(usuarioId, novoUid);
  try {
    if (motivo === 'recusada') {
      // Primeiro anota na lista do aparelho: se o app morrer no meio, a varredura ainda acha a fila para vencer.
      await registrarFilaRetida(usuarioId);
      await alvo.reterSoAFila();
    } else {
      await alvo.apagarTudo();
    }
  } finally {
    if (!repositorio) await alvo.fechar().catch(() => undefined);
  }
}
