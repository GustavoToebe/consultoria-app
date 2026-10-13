import { useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { posicaoDoValor, valorAposPasso, valorDaPosicao } from '../dominio/escalaNota';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../tema/tokens';
import { Texto } from './Texto';
import { vibrar } from './vibrar';

interface Props {
  rotulo: string;
  /** Nota escolhida; `null` = ainda sem resposta (o botão só aparece no primeiro toque). */
  valor: number | null;
  aoMudar: (valor: number) => void;
  minimo?: number;
  maximo?: number;
}

const BOTAO = 28;
const MARGEM = BOTAO / 2;
const TRILHA = 6;

/**
 * Nota por controle deslizante: toque ou arraste na horizontal em qualquer ponto da faixa (alvo de 44 px de altura); arrastar na vertical rola a tela. O valor
 * aparece grande ao lado do rótulo. Teclado (setas, Home, End) e leitor de tela (aumentar/diminuir) também ajustam.
 * `aoMudar` só dispara quando a nota inteira muda, não a cada pixel arrastado.
 */
export function EscalaDeNota({ rotulo, valor, aoMudar, minimo = 0, maximo = 10 }: Props) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  // Última nota enviada no gesto atual: o arraste pode passar várias vezes pelo mesmo valor antes de a tela repintar.
  const ultimo = useSharedValue(Number.NaN);

  const aplicar = (x: number) => {
    const nota = valorDaPosicao(x, largura, minimo, maximo, MARGEM);
    if (nota === null || nota === ultimo.get()) return;
    ultimo.set(nota);
    vibrar.leve();
    aoMudar(nota);
  };
  // Arraste horizontal escolhe a nota; arraste vertical reprova o gesto e a rolagem da tela segue (o sistema de
  // responder do RN prenderia o dedo na faixa). Filhos têm `pointerEvents="none"`: o alvo é sempre a faixa, e o `x`
  // do gesto é relativo a ela.
  const comecar = () => { ultimo.set(valor ?? Number.NaN); };
  const arrastar = Gesture.Pan().runOnJS(true)
    .activeOffsetX([-8, 8])
    .failOffsetY([-10, 10])
    .onBegin(comecar)
    .onUpdate((evento) => aplicar(evento.x));
  const tocar = Gesture.Tap().runOnJS(true)
    .maxDistance(10)
    .onBegin(comecar)
    .onEnd((evento, sucesso) => { if (sucesso) aplicar(evento.x); });
  const gesto = Gesture.Race(arrastar, tocar);

  const passo = (direcao: 1 | -1) => aoMudar(valorAposPasso(valor, direcao, minimo, maximo));
  const aoAcessibilidade = (evento: AccessibilityActionEvent) => {
    if (evento.nativeEvent.actionName === 'increment') passo(1);
    if (evento.nativeEvent.actionName === 'decrement') passo(-1);
  };
  const aoTeclar = (evento: { key: string; preventDefault?: () => void }) => {
    const tecla = evento.key;
    if (tecla === 'ArrowRight' || tecla === 'ArrowUp') passo(1);
    else if (tecla === 'ArrowLeft' || tecla === 'ArrowDown') passo(-1);
    else if (tecla === 'Home') aoMudar(minimo);
    else if (tecla === 'End') aoMudar(maximo);
    else return;
    evento.preventDefault?.();
  };
  const teclado = { tabIndex: 0 as const, onKeyDown: aoTeclar };

  const pronta = largura > 2 * MARGEM;
  const centro = valor === null ? null : posicaoDoValor(valor, largura, minimo, maximo, MARGEM);
  const pontos = Array.from({ length: maximo - minimo + 1 }, (_, i) => minimo + i);

  return (
    <View style={estilos.campo}>
      <View style={estilos.cabecalho}>
        <Texto variante="rotulo" style={estilos.rotulo}>{rotulo}</Texto>
        <Texto variante="destaque" cor={valor === null ? 'suave' : undefined}>{valor === null ? '—' : String(valor)}</Texto>
      </View>
      <GestureDetector gesture={gesto} touchAction="pan-y">
      <View
        {...teclado}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={rotulo}
        accessibilityHint="Toque ou arraste para escolher a nota"
        accessibilityValue={{ min: minimo, max: maximo, now: valor ?? undefined, text: valor === null ? 'sem nota' : String(valor) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={aoAcessibilidade}
        onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
        style={estilos.area}>
        {pronta ? (
          <>
            <View pointerEvents="none" style={[estilos.trilha, { left: MARGEM, right: MARGEM, backgroundColor: cores.borda }]} />
            {centro !== null ? (
              <View pointerEvents="none" style={[estilos.trilha, { left: MARGEM, width: centro - MARGEM, backgroundColor: cores.texto }]} />
            ) : null}
            {pontos.map((n) => (
              <View key={n} pointerEvents="none"
                style={[estilos.marca, { left: posicaoDoValor(n, largura, minimo, maximo, MARGEM) - 2, backgroundColor: valor !== null && n <= valor ? cores.fundo : cores.bordaCampo }]} />
            ))}
            {centro !== null ? (
              <View pointerEvents="none" style={[estilos.botao, { left: centro - MARGEM, backgroundColor: cores.texto, borderColor: cores.fundo }]} />
            ) : null}
          </>
        ) : null}
      </View>
      </GestureDetector>
      <View style={estilos.pontas}>
        <Texto variante="pequeno" numerico>{minimo}</Texto>
        <Texto variante="pequeno" numerico>{maximo}</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5), alignSelf: 'stretch', maxWidth: 480 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  rotulo: { flex: 1 },
  area: { height: ALVO_TOQUE, justifyContent: 'center' },
  trilha: { position: 'absolute', height: TRILHA, borderRadius: TRILHA / 2 },
  marca: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  botao: { position: 'absolute', width: BOTAO, height: BOTAO, borderRadius: BOTAO / 2, borderWidth: 3 },
  pontas: { flexDirection: 'row', justifyContent: 'space-between' },
});
