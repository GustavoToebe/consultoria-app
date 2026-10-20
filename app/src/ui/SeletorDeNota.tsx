import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { disposicaoDaEscala } from '../dominio/escalaNota';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';
import { vibrar } from './vibrar';

interface Props {
  rotulo: string;
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  minimo?: number;
  maximo?: number;
  /** Texto curto embaixo das pontas ("Nada", "Muito"). */
  rotuloMinimo?: string;
  rotuloMaximo?: string;
  /** Tocar na nota marcada desmarca (pergunta opcional). */
  limpavel?: boolean;
}

const VAO = espaco(1);

/**
 * Nota por números tocáveis (até 11 valores): cada número é um botão quadrado de 44 a 56 px, em linhas equilibradas, com
 * a seleção invertida do resto do app; os textos das pontas ficam embaixo, alinhados ao primeiro e ao último botão.
 * No lugar do deslizante porque a pessoa vê todas as opções e acerta o número no primeiro toque, sem arrastar, e o
 * leitor de tela lê "7 de 10" como um grupo de opções.
 */
export function SeletorDeNota({ rotulo, valor, aoMudar, minimo = 0, maximo = 10, rotuloMinimo, rotuloMaximo, limpavel }: Props) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const numeros = Array.from({ length: Math.max(0, maximo - minimo + 1) }, (_, i) => minimo + i);
  const { porLinha, lado } = disposicaoDaEscala(numeros.length, largura, VAO);
  const larguraDaGrade = porLinha * lado + (porLinha - 1) * VAO;
  const escolher = (n: number) => {
    vibrar.leve();
    aoMudar(n === valor ? (limpavel ? null : n) : n);
  };
  const pontas = rotuloMinimo?.trim() || rotuloMaximo?.trim();
  return (
    <View style={estilos.campo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <View onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)} style={estilos.medida}>
        <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={[estilos.grade, largura > 0 && { width: larguraDaGrade }]}>
          {numeros.map((n) => {
            const ativo = n === valor;
            const ponta = n === minimo ? rotuloMinimo?.trim() : n === maximo ? rotuloMaximo?.trim() : undefined;
            return (
              <Pressable key={n} onPress={() => escolher(n)}
                accessibilityRole="radio" accessibilityState={{ checked: ativo }} aria-checked={ativo}
                accessibilityLabel={`${n} de ${maximo}${ponta ? `, ${ponta}` : ''}`}
                style={({ pressed }) => [estilos.botao, {
                  width: lado, height: lado,
                  backgroundColor: ativo ? cores.texto : pressed ? cores.superficie3 : cores.superficie2,
                  borderColor: ativo ? cores.texto : cores.borda,
                }]}>
                <Texto numerico style={[estilos.numero, { color: ativo ? cores.fundo : cores.texto }]}>{String(n)}</Texto>
              </Pressable>
            );
          })}
        </View>
        {pontas ? (
          <View style={[estilos.pontas, largura > 0 && { width: larguraDaGrade }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Texto variante="pequeno" style={estilos.pontaInicio}>{rotuloMinimo?.trim() ? `${minimo} = ${rotuloMinimo.trim()}` : ''}</Texto>
            <Texto variante="pequeno" style={estilos.pontaFim}>{rotuloMaximo?.trim() ? `${maximo} = ${rotuloMaximo.trim()}` : ''}</Texto>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(1) },
  medida: { alignSelf: 'stretch', gap: espaco(0.75) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: VAO, maxWidth: '100%' },
  botao: { borderWidth: 1, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  pontas: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco(2), maxWidth: '100%' },
  pontaInicio: { flex: 1 },
  pontaFim: { flex: 1, textAlign: 'right' },
});
