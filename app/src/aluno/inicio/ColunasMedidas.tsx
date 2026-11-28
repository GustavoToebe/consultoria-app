import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { colunasMedidas, numeroDeColunasMedidas, toposMedidos, type RegraDaPeca } from '../../dominio/colunasMedidas';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

export interface PecaMedida extends RegraDaPeca {
  chave: string;
  conteudo: ReactNode;
}

/**
 * Colunas empilhadas do Início e da Dieta do aluno no computador (27/11): a coluna de cada peça sai da altura MEDIDA de
 * todas (`dominio/colunasMedidas`), para as colunas terminarem juntas, sem esticar cartão com vazio por dentro. As peças
 * ficam no DOM na ordem dada, só posicionadas por cima (`position: absolute`), então o Tab e o leitor de tela seguem a
 * ordem lógica; mudar de coluna não remonta a peça (a chave não muda). Invisível até medir a própria largura e todas as
 * peças na largura da célula. Com 1 coluna, uma pilha comum.
 *
 * `congelar` (a Dieta): a distribuição é escolhida uma vez por largura e conjunto de peças; abrir Orientações ou trocar a
 * opção da refeição só empurra as de baixo, sem trocar cartão de coluna na mão do aluno. Sem ele (o Início), refaz a cada
 * medida: pendências, nível e mapa chegam da API depois.
 * `colunasMinimas` (o Início): com as peças medidas, usa menos colunas quando as de `colunas` não fecham em `limite` px
 * (`numeroDeColunasMedidas`; poucos blocos). A escolha vale para a largura e o conjunto de peças com altura: medir de novo
 * na largura nova não a desfaz (sem pingue-pongue entre três e duas).
 * Variante da `ui/Alvenaria` (sugestão para o design system: juntar as duas numa peça); a Conta do aluno também usa esta.
 */
export function ColunasMedidas({ colunas: regra, colunasMinimas, limite = 80, vao, vaoEntreColunas = vao, congelar = false, idDasPecas, pecas }: {
  colunas: (largura: number) => number;
  colunasMinimas?: number;
  limite?: number;
  vao: number;
  vaoEntreColunas?: number;
  congelar?: boolean;
  /** Prefixo do testID de cada peça (`<prefixo>-<chave>`), para o e2e medir as colunas. */
  idDasPecas?: string;
  pecas: readonly PecaMedida[];
}) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const [medidas, setMedidas] = useState<Readonly<Record<string, { largura: number; altura: number }>>>({});
  const [fixa, setFixa] = useState<{ assinatura: string; coluna: number[] } | null>(null);
  const [escolha, setEscolha] = useState<{ assinatura: string; colunas: number } | null>(null);
  const maxima = Math.max(1, Math.min(largura > 0 ? regra(largura) : 1, pecas.length));
  const comAltura = pecas.filter((p) => (medidas[p.chave]?.altura ?? 1) > 0).map((p) => p.chave).join(',');
  const assinaturaDaEscolha = `${Math.round(largura)}|${comAltura}`;
  const colunas = colunasMinimas !== undefined && escolha?.assinatura === assinaturaDaEscolha ? escolha.colunas : maxima;
  const emColunas = colunas > 1;
  // O `- 1` é o da `Grade`: na web o onLayout arredonda a largura e a última coluna passaria meio pixel da borda.
  const celula = (largura - 1 - vaoEntreColunas * (colunas - 1)) / colunas;
  // Só vale a altura medida na largura atual da célula (a de antes de redimensionar distribuiria errado).
  const alturas = pecas.map((p) => {
    const m = medidas[p.chave];
    return m && Math.abs(m.largura - celula) < 1 ? m.altura : undefined;
  });
  const completas = alturas.every((a) => a !== undefined);
  const lidas = alturas.map((a) => a ?? 0);
  const assinatura = `${colunas}|${Math.round(celula)}|${pecas.filter((_, i) => lidas[i] > 0).map((p) => p.chave).join(',')}`;
  const calculada = emColunas && completas ? colunasMedidas(lidas, colunas, vao, pecas) : pecas.map((p, i) => Math.min(colunas - 1, p.coluna ?? i % colunas));
  // Ajuste de estado na renderização (não efeito): escolhe o número de colunas uma vez por largura e conjunto de peças.
  if (colunasMinimas !== undefined && completas && escolha?.assinatura !== assinaturaDaEscolha) {
    setEscolha({ assinatura: assinaturaDaEscolha, colunas: emColunas ? numeroDeColunasMedidas(lidas, maxima, colunasMinimas, vao, pecas, limite) : colunas });
  }
  // Idem: guarda a primeira distribuição completa desta largura e destas peças.
  if (congelar && emColunas && completas && fixa?.assinatura !== assinatura) setFixa({ assinatura, coluna: calculada });
  const coluna = congelar && fixa?.assinatura === assinatura ? fixa.coluna : calculada;
  const { topos, altura } = toposMedidos(coluna, lidas, colunas, vao);
  const medir = (chave: string) => (evento: LayoutChangeEvent) => {
    const { width, height } = evento.nativeEvent.layout;
    setMedidas((atual) => (atual[chave]?.largura === width && atual[chave]?.altura === height ? atual : { ...atual, [chave]: { largura: width, altura: height } }));
  };
  return (
    <View onLayout={aoMedir} style={emColunas ? { height: altura, opacity: completas ? 1 : 0 } : { gap: vao, opacity: largura > 0 ? 1 : 0 }}>
      {pecas.map((p, i) => (
        <View key={p.chave} onLayout={medir(p.chave)} testID={idDasPecas ? `${idDasPecas}-${p.chave}` : undefined}
          style={emColunas ? { position: 'absolute', width: celula, left: coluna[i] * (celula + vaoEntreColunas), top: topos[i] } : undefined}>
          {p.conteudo}
        </View>
      ))}
    </View>
  );
}
