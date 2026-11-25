import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { colunasDaAlvenaria, posicoesDaAlvenaria } from '../dominio/alvenaria';
import { useFaixaDeLargura } from './useFaixaDeLargura';

export interface PecaDaAlvenaria {
  chave: string;
  /** Altura estimada (no hub, itens do grupo + 1): decide a coluna antes de qualquer medida. */
  peso: number;
  conteudo: ReactNode;
}

/**
 * Colunas empilhadas (24/11): cada peça vai para a coluna mais baixa (`colunasDaAlvenaria`) e fica logo abaixo da de cima,
 * com `vao` entre elas (`posicoesDaAlvenaria` sobre a altura medida de cada uma). As peças ficam no DOM na ordem dada, só
 * posicionadas por cima (`position: absolute`): o Tab e o leitor de tela seguem a ordem lógica, não a das colunas. Com 1
 * coluna é uma pilha comum; o bloco só aparece depois de medir a própria largura e, nas colunas, a de todas as peças
 * (nenhum quadro de pilha larga nem de peças sobrepostas).
 */
export function Alvenaria({ colunas: regra, vao, pecas }: {
  /** Colunas pela largura medida da própria alvenaria (como a `Grade`). */
  colunas: (largura: number) => number;
  vao: number;
  pecas: readonly PecaDaAlvenaria[];
}) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const [medidas, setMedidas] = useState<Readonly<Record<string, { largura: number; altura: number }>>>({});
  const colunas = largura > 0 ? regra(largura) : 1;
  const emColunas = colunas > 1;
  const coluna = colunasDaAlvenaria(pecas.map((p) => p.peso), colunas);
  // O `- 1` é o da `Grade`: na web o onLayout arredonda a largura e a última coluna passaria meio pixel da borda.
  const celula = (largura - 1 - vao * (colunas - 1)) / colunas;
  // Só vale a altura medida na largura atual da coluna (a da pilha, ou de antes de redimensionar, empilharia errado).
  const alturas = pecas.map((p) => {
    const m = medidas[p.chave];
    return m && Math.abs(m.largura - celula) < 1 ? m.altura : undefined;
  });
  const { topos, altura } = posicoesDaAlvenaria(coluna, alturas.map((a) => a ?? 0), colunas, vao);
  const medir = (chave: string) => (evento: LayoutChangeEvent) => {
    const { width, height } = evento.nativeEvent.layout;
    setMedidas((atual) => (atual[chave]?.largura === width && atual[chave]?.altura === height ? atual : { ...atual, [chave]: { largura: width, altura: height } }));
  };
  return (
    <View onLayout={aoMedir} style={emColunas ? { height: altura, opacity: alturas.every((a) => a !== undefined) ? 1 : 0 } : { gap: vao, opacity: largura > 0 ? 1 : 0 }}>
      {pecas.map((p, i) => (
        <View key={p.chave} onLayout={medir(p.chave)}
          style={emColunas ? { position: 'absolute', width: celula, left: coluna[i] * (celula + vao), top: topos[i] } : undefined}>
          {p.conteudo}
        </View>
      ))}
    </View>
  );
}
