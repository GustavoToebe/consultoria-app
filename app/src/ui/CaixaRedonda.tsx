import { Check } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { sobre } from './sobre';

/** 48 px de toque nas caixas de seleção das linhas de lista (`docs/design-e-front.md`, alvo de toque). */
const ALVO = 48;
const DIAMETRO = 26;

/**
 * Caixa de marcar redonda (lista de compras do aluno, A7 de 25/11): círculo vazio com contorno `bordaCampo` ou preenchido
 * em `texto` com o ✓ em `fundo`, a mesma seleção invertida da caixa quadrada da `LinhaDaLista` (neutra, nunca a cor da
 * marca). `role="checkbox"`; na web o Espaço também marca (o react-native-web só aciona o Enter fora de `role="button"`).
 * Quem usa pode mudar a linha de lugar ao marcar (a lista põe o comprado no fim do grupo): o React move o nó e o
 * navegador tira o foco dele, então a caixa devolve o foco a si mesma quando estava com ele. Não é o `BotaoMarcar` das
 * séries, que tem o desenho e a animação do treino.
 */
export function CaixaRedonda({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: () => void }) {
  const { cores } = useTema();
  const ref = useRef<View>(null);
  const devolverFoco = useRef(false);
  const mudar = () => {
    devolverFoco.current = Platform.OS === 'web' && globalThis.document?.activeElement === (ref.current as unknown);
    aoMudar();
  };
  useEffect(() => {
    if (!devolverFoco.current) return;
    devolverFoco.current = false;
    ref.current?.focus();
  }, [marcado]);
  const espaco = Platform.OS === 'web'
    ? { onKeyDown: (e: { key: string; repeat?: boolean; preventDefault: () => void }) => {
      if (e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if (!e.repeat) mudar();
    } }
    : null;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: marcado }}
      aria-checked={marcado}
      ref={ref}
      onPress={mudar}
      {...(espaco as object)}
      style={(estado) => [estilos.alvo, { backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
      <View testID="caixa-redonda" style={[estilos.circulo, { backgroundColor: marcado ? cores.texto : cores.campo, borderColor: marcado ? cores.texto : cores.bordaCampo }]}>
        {marcado ? <Check size={16} color={cores.fundo} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // Alvo redondo: o anel de foco da web (`global.css`) acompanha o círculo.
  alvo: { width: ALVO, height: ALVO, borderRadius: ALVO / 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  circulo: { width: DIAMETRO, height: DIAMETRO, borderRadius: DIAMETRO / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
