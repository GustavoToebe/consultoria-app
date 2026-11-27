import { Check } from 'lucide-react-native';
import { Children, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** Vão entre as colunas (pequeno: o nome embaixo é que separa) e entre as linhas. */
const VAO_COLUNA = espaco(0.5);
const VAO_LINHA = espaco(1.5);
/** Folga do anel de seleção em volta da amostra (2 de anel + 2 de respiro, de cada lado). */
const ANEL = 4;

/** Quantas colunas cabem na largura medida, com no mínimo `minimo` px por célula e no máximo `maximo` colunas. */
export function colunasDaGrade(largura: number, minimo: number, maximo: number): number {
  if (!(largura > 0)) return maximo;
  return Math.max(1, Math.min(maximo, Math.floor((largura + VAO_COLUNA) / (minimo + VAO_COLUNA))));
}

interface Grade {
  rotulo: string;
  /** Rótulo à vista acima da grade; sem ele, o nome fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  /** `group` quando é um subgrupo de um `radiogroup` maior (Escuras e Claras do tema). */
  papel?: 'radiogroup' | 'group';
  /** Largura mínima de cada célula (amostra + nome embaixo). */
  minimo: number;
  maximo: number;
  /** Um `OpcaoDeAmostra` por filho. */
  children: ReactNode;
}

/**
 * Grade de amostras (bolinhas de cor, miniaturas de tema): as colunas saem da largura MEDIDA da grade, até `maximo`, e a
 * última linha fica à esquerda, sem célula esticada. Antes da medida usa `maximo` com células de `minimo` (nada pisca largo).
 */
export function GradeDeAmostras({ rotulo, rotuloVisivel = false, papel = 'radiogroup', minimo, maximo, children }: Grade) {
  const [largura, setLargura] = useState(0);
  const colunas = colunasDaGrade(largura, minimo, maximo);
  const celula = largura > 0 ? (largura - VAO_COLUNA * (colunas - 1)) / colunas : minimo;
  return (
    <View style={estilos.grupo}>
      {rotuloVisivel ? <Texto variante="rotulo" aria-hidden>{rotulo}</Texto> : null}
      <View role={papel} aria-label={rotulo} style={estilos.grade} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
        {Children.toArray(children).map((filho, i) => <View key={i} style={{ width: celula }}>{filho}</View>)}
      </View>
    </View>
  );
}

interface Opcao {
  nome: string;
  selecionada: boolean;
  aoEscolher: () => void;
  /** Desenho da amostra no tamanho dela (a bolinha de 40, a miniatura do tema). */
  children: ReactNode;
  largura: number;
  altura: number;
  /** Raio da amostra: metade da largura na bolinha. */
  raio: number;
  /** Cor do ✓ sobre a amostra (texto legível sobre ela); sem ✓ quando a amostra já mostra a escolha de outro jeito. */
  corDoVisto?: string;
  /** Complemento lido depois do nome ("abre o campo do código"). */
  dica?: string;
  testID?: string;
}

/**
 * Uma opção da grade: a amostra com o nome embaixo, em texto pequeno. Escolhida = anel de 2 px na cor do texto em volta da
 * amostra, ✓ por cima e o nome em semi (seleção neutra, nunca a cor da marca; reconhecível sem a cor). Mouse em cima: o
 * anel em `bordaCampo`. Papel de `radio`, com `aria-checked` (a web não traduz o `accessibilityState`).
 */
export function OpcaoDeAmostra({ nome, selecionada, aoEscolher, children, largura, altura, raio, corDoVisto, dica, testID }: Opcao) {
  const { cores } = useTema();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionada }}
      aria-checked={selecionada}
      accessibilityLabel={dica ? `${nome}. ${dica}` : nome}
      onPress={aoEscolher}
      style={estilos.opcao}>
      {(estado) => (
        <>
          <View
            style={[
              estilos.anel,
              { width: largura + ANEL * 2, height: altura + ANEL * 2, borderRadius: raio + ANEL },
              { borderColor: selecionada ? cores.texto : sobre(estado) ? cores.bordaCampo : 'transparent' },
            ]}>
            <View style={[estilos.amostra, { width: largura, height: altura, borderRadius: raio }]}>
              {children}
              {selecionada && corDoVisto ? (
                <View aria-hidden style={estilos.visto}><Check size={20} color={corDoVisto} strokeWidth={3} /></View>
              ) : null}
            </View>
          </View>
          <Texto
            aria-hidden
            numberOfLines={2}
            style={[estilos.nome, { color: selecionada ? cores.texto : cores.textoSuave, fontFamily: selecionada ? fontes.semi : fontes.normal }]}>
            {nome}
          </Texto>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: VAO_COLUNA, rowGap: VAO_LINHA },
  opcao: { alignItems: 'center', gap: espaco(0.5), minHeight: 44 },
  anel: { borderWidth: 2, padding: ANEL - 2, alignItems: 'center', justifyContent: 'center' },
  amostra: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  visto: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
