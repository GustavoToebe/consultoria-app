import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { chaveDoAvisoDaChave, mostrarAvisoDaChave, TEXTO_DO_AVISO_DA_CHAVE, type IntegracaoComChave } from '../../dominio/campoDeChave';
import { useSessao } from '../../sessao/SessaoProvider';
import { Botao } from '../../ui/Botao';
import { Alerta } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';

/**
 * "Já conferi" da chave gravada (plano B do defeito de 28/11), guardado neste aparelho por usuário, como os favoritos. Só um
 * booleano: nada da chave. `conferido` é nulo enquanto lê (o aviso não pisca para quem já conferiu); a leitura que falhar vale
 * como "não conferido".
 */
export function useChaveConferida(integracao: IntegracaoComChave): { conferido: boolean | null; conferir: () => void } {
  const usuarioId = useSessao().usuario?.id ?? null;
  const [lido, setLido] = useState<{ usuarioId: string; conferido: boolean } | null>(null);
  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    AsyncStorage.getItem(chaveDoAvisoDaChave(usuarioId, integracao)).then(
      (v) => { if (ativo) setLido((atual) => (atual?.usuarioId === usuarioId && atual.conferido ? atual : { usuarioId, conferido: v === 'sim' })); },
      () => { if (ativo) setLido((atual) => (atual?.usuarioId === usuarioId ? atual : { usuarioId, conferido: false })); },
    );
    return () => { ativo = false; };
  }, [usuarioId, integracao]);
  const conferir = () => {
    if (!usuarioId) return;
    setLido({ usuarioId, conferido: true });
    AsyncStorage.setItem(chaveDoAvisoDaChave(usuarioId, integracao), 'sim').catch(() => undefined);
  };
  return { conferido: lido && lido.usuarioId === usuarioId ? lido.conferido : null, conferir };
}

/** O aviso âmbar com "Já conferi", embaixo da linha da forma, enquanto houver chave gravada e a pessoa não tiver conferido. */
export function AvisoDaChaveGravada({ integracao, podeAlterar, chaveGravada, conferido, aoConferir }: {
  integracao: IntegracaoComChave;
  podeAlterar: boolean;
  chaveGravada: boolean;
  conferido: boolean | null;
  aoConferir: () => void;
}) {
  if (!mostrarAvisoDaChave(podeAlterar, chaveGravada, conferido)) return null;
  return (
    <Alerta tom="atencao" texto={TEXTO_DO_AVISO_DA_CHAVE[integracao]}>
      <LinhaDeAcoes>
        <Botao rotulo="Já conferi" rotuloAcessivel={`Já conferi a chave da ${integracao === 'infinitepay' ? 'InfinitePay' : 'Kiwify'}`} tipo="secundario" aoTocar={aoConferir} />
      </LinhaDeAcoes>
    </Alerta>
  );
}
