import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { registrarPushToken, removerPushToken } from '../../api/rotas';
import {
  AJUDA_DO_AVISO_NO_CELULAR, AJUDA_SEM_PERMISSAO_DO_PUSH, AVISO_PUSH_FALHOU, AVISO_PUSH_NAO_DESLIGOU, AVISO_PUSH_NEGADO,
  oferecerAvisoNoCelular, ROTULO_DO_AVISO_NO_CELULAR,
} from '../../dominio/pushDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { useAviso } from '../../ui/Aviso';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { obterPushDoAparelho, pushPermitido } from './pushNativo';

/**
 * "Avisar no celular quando um compromisso mudar" em Aparência e preferências: push do Expo, desligado por padrão. Só no
 * celular e só com a chave da plataforma ligada (`pushHabilitado` do `/eu`). A permissão do aparelho é pedida aqui, no
 * momento em que a pessoa liga (nunca ao abrir o app). Ligar registra o token deste aparelho na API; desligar o apaga.
 * Falha da API deixa o interruptor como estava e avisa.
 */
export function InterruptorDeAvisoNoCelular() {
  const { pushHabilitado } = useSessao();
  const { preferencias, escolherPreferencia } = useTema();
  const { avisar } = useAviso();
  // undefined = ainda conferindo; null = sem suporte (esconde); false = o aparelho não deixa notificar.
  const [permitido, setPermitido] = useState<boolean | null | undefined>(undefined);
  const ocupado = useRef(false);
  const oferecer = oferecerAvisoNoCelular(Platform.OS, pushHabilitado);
  useEffect(() => {
    if (!oferecer) return;
    let vivo = true;
    pushPermitido().then((p) => vivo && setPermitido(p), () => vivo && setPermitido(null));
    return () => { vivo = false; };
  }, [oferecer]);
  if (!oferecer || permitido === null) return null;

  const mudar = async (ligar: boolean) => {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      const aparelho = await obterPushDoAparelho(ligar);
      if (ligar) {
        if (aparelho.estado === 'negada') {
          setPermitido(false);
          avisar(AVISO_PUSH_NEGADO);
          return;
        }
        if (aparelho.estado !== 'ok') {
          avisar(AVISO_PUSH_FALHOU, 'perigo');
          return;
        }
        setPermitido(true);
        await registrarPushToken(aparelho.token, aparelho.plataforma);
        escolherPreferencia({ avisoNoCelular: true });
        return;
      }
      // Desligar: sem token (permissão tirada, por exemplo) não há o que apagar aqui; o servidor limpa o órfão no envio.
      if (aparelho.estado === 'ok') await removerPushToken(aparelho.token);
      escolherPreferencia({ avisoNoCelular: false });
    } catch {
      avisar(ligar ? AVISO_PUSH_FALHOU : AVISO_PUSH_NAO_DESLIGOU, 'perigo');
    } finally {
      ocupado.current = false;
    }
  };
  const semPermissao = preferencias.avisoNoCelular && permitido === false;
  return (
    <Cartao titulo="Avisos no celular">
      <Interruptor
        rotulo={ROTULO_DO_AVISO_NO_CELULAR}
        ajuda={semPermissao ? `${AJUDA_DO_AVISO_NO_CELULAR} ${AJUDA_SEM_PERMISSAO_DO_PUSH}` : AJUDA_DO_AVISO_NO_CELULAR}
        valor={preferencias.avisoNoCelular}
        aoMudar={(ligar) => void mudar(ligar)}
      />
    </Cartao>
  );
}
