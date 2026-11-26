import { Check } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { OPCOES_DO_OBJETIVO } from '../../dominio/importacaoAssistida';
import type { ObjetivoImportacao } from '../../servicos/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

type Focavel = { focus: () => void };

/**
 * "O que importar" em três cartões de escolha (26/11), lado a lado e empilhados abaixo de 720 px de largura. É o desenho
 * do `OpcaoCartao` (seleção neutra: fundo `sobre`, contorno `bordaCampo` de 2 px e ✓), feito aqui porque o `OpcaoCartao`
 * não deixa a tela controlar o foco: o grupo segue o `radiogroup` da APG, com um só cartão no Tab (o marcado) e as setas
 * movendo o foco e a escolha juntos, dando a volta no fim.
 */
export function EscolhaDoQueImportar({ valor, aoMudar }: { valor: ObjetivoImportacao; aoMudar: (v: ObjetivoImportacao) => void }) {
  const { cores } = useTema();
  const refs = useRef<(Focavel | null)[]>([]);
  // Lado a lado só quando os três cabem com 220 px cada; senão empilhados (dois em cima e um esticado embaixo não).
  const [largura, setLargura] = useState(0);
  const emLinha = largura >= 3 * LARGURA_MINIMA + 2 * espaco(1);
  const atual = Math.max(0, OPCOES_DO_OBJETIVO.findIndex((o) => o.valor === valor));

  const mover = (passo: number) => {
    const n = OPCOES_DO_OBJETIVO.length;
    const proximo = (atual + passo + n) % n;
    aoMudar(OPCOES_DO_OBJETIVO[proximo].valor);
    refs.current[proximo]?.focus();
  };
  const aoTeclar = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') mover(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') mover(-1);
    else return;
    e.preventDefault();
  };
  // O `onKeyDown` fica no grupo (o evento sobe do cartão focado): o `Pressable` da web usa o dele para Enter e Espaço.
  const teclado = Platform.OS === 'web' ? { onKeyDown: aoTeclar } : {};

  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto} nativeID="rotulo-o-que-importar">O que importar</Texto>
      <View role="radiogroup" aria-labelledby="rotulo-o-que-importar" accessibilityLabel="O que importar" style={[estilos.grade, emLinha && estilos.emLinha]}
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)} {...teclado}>
        {OPCOES_DO_OBJETIVO.map((o, i) => {
          const marcada = i === atual;
          return (
            <Pressable
              key={o.valor}
              ref={(no) => { refs.current[i] = no as Focavel | null; }}
              accessibilityRole="radio"
              accessibilityState={{ checked: marcada }}
              aria-checked={marcada}
              accessibilityLabel={`${o.titulo}. ${o.descricao}`}
              // Roving tabindex: só o marcado entra no Tab.
              tabIndex={marcada ? 0 : -1}
              onPress={() => aoMudar(o.valor)}
              style={(estado) => [
                estilos.cartao, emLinha && estilos.cartaoEmLinha,
                {
                  backgroundColor: marcada ? cores.sobre : sobre(estado) ? cores.superficie2 : cores.superficie,
                  borderColor: marcada ? cores.bordaCampo : cores.divisor,
                  // A borda cresce 1 px para dentro: o conteúdo não pula ao escolher.
                  borderWidth: marcada ? 2 : 1,
                  padding: espaco(1.5) - (marcada ? 1 : 0),
                },
              ]}>
              <View style={estilos.textos}>
                <Texto variante="bloco">{o.titulo}</Texto>
                <Texto variante="suave">{o.descricao}</Texto>
              </View>
              <View style={estilos.marca}>{marcada ? <Check size={20} color={cores.texto} strokeWidth={3} aria-hidden /> : null}</View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const LARGURA_MINIMA = 220;

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  grade: { gap: espaco(1) },
  emLinha: { flexDirection: 'row' },
  cartao: { minHeight: ALVO_TOQUE + espaco(1), flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderRadius: RAIO },
  cartaoEmLinha: { flex: 1, minWidth: 0 },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  marca: { width: 20, height: 20 },
});
