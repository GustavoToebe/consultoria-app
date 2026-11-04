import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registrarPushToken } from '../../api/rotas';
import { deveRegistrarAoAbrir } from '../../dominio/pushDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { obterPushDoAparelho, pushPermitido } from './pushNativo';

/**
 * Ao abrir a área do aluno com o aviso ligado, registra o token deste aparelho de novo (idempotente): o token pode mudar e
 * o "Sair" o apaga na API. Nunca pede permissão; erro e falta de internet são ignorados (fica para a próxima abertura).
 * Não desenha nada.
 */
export function SincronizarPush({ usuarioId }: { usuarioId: string }) {
  const { pushHabilitado } = useSessao();
  const { preferencias } = useTema();
  const ligada = preferencias.avisoNoCelular;
  useEffect(() => {
    if (!ligada || !pushHabilitado) return;
    let vivo = true;
    (async () => {
      const permitido = await pushPermitido();
      if (!vivo || !deveRegistrarAoAbrir({ preferenciaLigada: ligada, pushHabilitado, os: Platform.OS, permitido })) return;
      const aparelho = await obterPushDoAparelho(false);
      if (vivo && aparelho.estado === 'ok') await registrarPushToken(aparelho.token, aparelho.plataforma);
    })().catch(() => undefined);
    return () => { vivo = false; };
  }, [ligada, pushHabilitado, usuarioId]);
  return null;
}
