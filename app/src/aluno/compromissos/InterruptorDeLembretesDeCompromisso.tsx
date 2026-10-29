import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { useAviso } from '../../ui/Aviso';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { lembretesDeCompromissoPermitidos, pedirPermissaoDeLembretesDeCompromisso } from './lembretes';

const TEXTO_DO_INTERRUPTOR = '1 dia antes e 2 horas antes, sem mostrar o horário na tela de bloqueio. Os lembretes se acertam quando você abre o app com internet.';

/**
 * "Lembrar dos meus compromissos" (D13) em Aparência e preferências: notificações locais deste aparelho, desligadas por
 * padrão. A permissão do aparelho é pedida aqui, no momento em que a pessoa liga (nunca ao abrir o app); negada, o
 * interruptor fica desligado e o aviso manda para as configurações. Só no celular (na web vale só o aviso dentro do app)
 * e só onde há notificações locais. Quem agenda e cancela é o `CompromissosDoAlunoProvider`, que reage à preferência.
 */
export function InterruptorDeLembretesDeCompromisso() {
  const { preferencias, escolherPreferencia } = useTema();
  const { avisar } = useAviso();
  // undefined = ainda conferindo; null = sem suporte (esconde); false = o aparelho não deixa notificar.
  const [permitido, setPermitido] = useState<boolean | null | undefined>(undefined);
  const ocupado = useRef(false);
  const nativo = Platform.OS !== 'web';
  useEffect(() => {
    if (!nativo) return;
    let vivo = true;
    lembretesDeCompromissoPermitidos().then((p) => vivo && setPermitido(p), () => vivo && setPermitido(null));
    return () => { vivo = false; };
  }, [nativo]);
  if (!nativo || permitido === null) return null;

  const mudar = async (ligar: boolean) => {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      if (!ligar) {
        escolherPreferencia({ lembretesCompromisso: false });
        return;
      }
      const resposta = await pedirPermissaoDeLembretesDeCompromisso();
      if (resposta === 'concedida') {
        setPermitido(true);
        escolherPreferencia({ lembretesCompromisso: true });
      } else if (resposta === 'negada') {
        setPermitido(false);
        avisar('Você pode liberar os lembretes nas configurações do aparelho.');
      } else {
        avisar('Não foi possível ativar o lembrete neste aparelho.', 'perigo');
      }
    } catch {
      avisar('Não foi possível ativar o lembrete neste aparelho.', 'perigo');
    } finally {
      ocupado.current = false;
    }
  };
  const semPermissao = preferencias.lembretesCompromisso && permitido === false;
  return (
    <Cartao titulo="Lembretes">
      <Interruptor
        rotulo="Lembrar dos meus compromissos"
        ajuda={semPermissao ? `${TEXTO_DO_INTERRUPTOR} As notificações estão desligadas nas configurações do aparelho.` : TEXTO_DO_INTERRUPTOR}
        valor={preferencias.lembretesCompromisso}
        aoMudar={(ligar) => void mudar(ligar)}
      />
    </Cartao>
  );
}
