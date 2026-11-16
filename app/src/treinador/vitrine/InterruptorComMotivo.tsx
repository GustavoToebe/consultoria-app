import { Pressable, StyleSheet, View } from 'react-native';

import { Switch } from '../../components/ui/switch';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

/**
 * O `Interruptor` de `ui/Campos`, com estado desabilitado e o motivo escrito abaixo (e no leitor de tela). Local da
 * vitrine porque a peça compartilhada ainda não tem desabilitado (sugestão para o design system).
 */
export function InterruptorComMotivo({ rotulo, valor, aoMudar, ajuda, desabilitado, motivo, testID }: {
  rotulo: string;
  valor: boolean;
  aoMudar: (valor: boolean) => void;
  ajuda?: string;
  desabilitado?: boolean;
  /** Por que está desabilitado; só aparece desabilitado. */
  motivo?: string | null;
  testID?: string;
}) {
  const { cores } = useTema();
  const explicacao = desabilitado && motivo ? motivo : undefined;
  return (
    <View style={estilos.linha}>
      <Pressable accessible={false} tabIndex={-1} disabled={desabilitado} onPress={() => aoMudar(!valor)} style={estilos.textos}>
        <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
        {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
        {explicacao ? <Texto variante="pequeno">{explicacao}</Texto> : null}
      </Pressable>
      <View style={desabilitado ? estilos.apagado : undefined}>
        <Switch checked={valor} onCheckedChange={aoMudar} disabled={desabilitado} accessibilityLabel={rotulo}
          accessibilityHint={explicacao} testID={testID} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE },
  textos: { flex: 1, gap: 2 },
  apagado: { opacity: 0.5 },
});
