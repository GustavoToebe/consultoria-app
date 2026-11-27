import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { posicoesDaAlvenaria } from '../../dominio/alvenaria';
import { colunasEquilibradas } from '../../dominio/colunasDaConta';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

export interface PecaDaColuna {
  chave: string;
  conteudo: ReactNode;
}

/**
 * Variante da `ui/Alvenaria` para a Conta do aluno (27/11): as mesmas colunas empilhadas (peças no DOM na ordem dada, só
 * posicionadas por cima, então o Tab e o leitor de tela seguem a ordem lógica), mas a coluna de cada peça sai da altura
 * MEDIDA de todas (`colunasEquilibradas`), para as colunas terminarem juntas; a alvenaria comum escolhe por um peso estimado
 * e deixava um buraco quando "App" (a seção mais alta) chegava no fim. Fica invisível até medir a própria largura e, nas
 * colunas, todas as peças na largura da célula (nenhum quadro de pilha larga nem de peças sobrepostas). Com 1 coluna é uma
 * pilha comum (o celular).
 */
export function ColunasEquilibradas({ colunas: regra, vao, pecas }: {
  colunas: (largura: number) => number;
  vao: number;
  pecas: readonly PecaDaColuna[];
}) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const [medidas, setMedidas] = useState<Readonly<Record<string, { largura: number; altura: number }>>>({});
  const colunas = largura > 0 ? regra(largura) : 1;
  const emColunas = colunas > 1;
  // O `- 1` é o da `Grade`: na web o onLayout arredonda a largura e a última coluna passaria meio pixel da borda.
  const celula = (largura - 1 - vao * (colunas - 1)) / colunas;
  // Só vale a altura medida na largura atual da célula (a da pilha, ou de antes de redimensionar, distribuiria errado).
  const alturas = pecas.map((p) => {
    const m = medidas[p.chave];
    return m && Math.abs(m.largura - celula) < 1 ? m.altura : undefined;
  });
  const medidasCompletas = alturas.every((a) => a !== undefined);
  const lidas = alturas.map((a) => a ?? 0);
  const coluna = emColunas && medidasCompletas ? colunasEquilibradas(lidas, colunas, vao) : pecas.map((_, i) => i % colunas);
  const { topos, altura } = posicoesDaAlvenaria(coluna, lidas, colunas, vao);
  const medir = (chave: string) => (evento: LayoutChangeEvent) => {
    const { width, height } = evento.nativeEvent.layout;
    setMedidas((atual) => (atual[chave]?.largura === width && atual[chave]?.altura === height ? atual : { ...atual, [chave]: { largura: width, altura: height } }));
  };
  return (
    <View onLayout={aoMedir} style={emColunas ? { height: altura, opacity: medidasCompletas ? 1 : 0 } : { gap: vao, opacity: largura > 0 ? 1 : 0 }}>
      {pecas.map((p, i) => (
        <View key={p.chave} onLayout={medir(p.chave)}
          style={emColunas ? { position: 'absolute', width: celula, left: coluna[i] * (celula + vao), top: topos[i] } : undefined}>
          {p.conteudo}
        </View>
      ))}
    </View>
  );
}
