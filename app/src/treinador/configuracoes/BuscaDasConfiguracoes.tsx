import { X } from 'lucide-react-native';
import type { RefObject } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { textoDoResultado } from './comum';

/**
 * "Pesquisar configuração": o mesmo campo na coluna da esquerda (PC) e na lista do celular. Esc e o X limpam; a busca não vai
 * para o endereço (é só um filtro da lista). O número de resultados é anunciado sem tirar o foco do campo.
 */
export function BuscaDasConfiguracoes({ valor, aoMudar, achados, campo }: {
  valor: string;
  aoMudar: (texto: string) => void;
  achados: number;
  campo: RefObject<TextInput | null>;
}) {
  const buscando = valor.trim().length > 0;
  const limpar = () => {
    aoMudar('');
    campo.current?.focus();
  };
  return (
    <View style={estilos.busca}>
      <Campo ref={campo} rotulo="Pesquisar configuração" valor={valor} aoMudar={aoMudar} placeholder="Ex.: senha, logo, lembrete…"
        inputMode="search" autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" enterKeyHint="search"
        onKeyPress={(e) => { if (e.nativeEvent.key === 'Escape' && valor) limpar(); }}
        acao={valor ? <IconeBotao Icone={X} rotulo="Limpar busca" compacto aoTocar={limpar} /> : undefined} />
      <View accessibilityLiveRegion="polite" aria-live="polite">
        {buscando ? <Texto variante="pequeno" numerico>{textoDoResultado(achados)}</Texto> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  busca: { gap: espaco(0.5) },
});
