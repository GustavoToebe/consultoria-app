import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { registrarPushToken } from '../../api/rotas';
import { criarRenovacaoDoPush, deveRegistrarAoAbrir } from '../../dominio/pushDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { obterPushDoAparelho, pushPermitido } from './pushNativo';

/**
 * Com o aviso ligado, registra o token deste aparelho de novo (idempotente) ao abrir a área do aluno e, depois, quando o app
 * volta para a frente (`AppState` `active`), no máximo uma vez a cada 24 h: o token pode mudar, o "Sair" o apaga na API e o
 * servidor apaga o que não é renovado em 30 dias. Nunca pede permissão (sem ela, não registra); erro e falta de internet são
 * ignorados (fica para a próxima vez). Não desenha nada.
 */
export function SincronizarPush({ usuarioId }: { usuarioId: string }) {
  const { pushHabilitado } = useSessao();
  const { preferencias } = useTema();
  const ligada = preferencias.avisoNoCelular;
  useEffect(() => {
    if (!ligada || !pushHabilitado) return;
    let vivo = true;
    const renovacao = criarRenovacaoDoPush(async () => {
      const permitido = await pushPermitido();
      if (!vivo || !deveRegistrarAoAbrir({ preferenciaLigada: ligada, pushHabilitado, os: Platform.OS, permitido })) return;
      const aparelho = await obterPushDoAparelho(false);
      if (vivo && aparelho.estado === 'ok') await registrarPushToken(aparelho.token, aparelho.plataforma);
    });
    renovacao.talvez().catch(() => undefined);
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') renovacao.talvez().catch(() => undefined);
    });
    return () => {
      vivo = false;
      assinatura.remove();
    };
  }, [ligada, pushHabilitado, usuarioId]);
  return null;
}
