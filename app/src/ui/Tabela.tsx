import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, BORDA_BLOCO, espaco, RAIO } from '../tema/tokens';
import { sobre } from './sobre';
import { Texto } from './Texto';

export interface ColunaDaTabela<T> {
  chave: string;
  /** Título da coluna; vira o rótulo da linha no modo empilhado. */
  titulo: string;
  render: (linha: T) => ReactNode;
  /** Proporção da coluna (padrão 1) ou largura fixa em px. */
  flex?: number;
  largura?: number;
  alinhar?: 'esquerda' | 'centro' | 'direita';
  /** No modo empilhado vira o título do cartão, sem rótulo. */
  principal?: boolean;
  /** Coluna de ação (ícone): no modo empilhado vai para o canto do cartão, sem rótulo. */
  acao?: boolean;
  /** Coluna `acao` que é dado (não botão): mostra o título no cabeçalho da tabela larga; no cartão continua sem rótulo. */
  tituloNaTabela?: boolean;
}

interface Props<T> {
  colunas: ColunaDaTabela<T>[];
  linhas: readonly T[];
  chave: (linha: T) => string;
  /** Abaixo desta largura (da própria tabela) as linhas viram cartões empilhados "rótulo: valor". Padrão 520. */
  larguraMinima?: number;
  /** Conteúdo extra abaixo da linha (observação, detalhe), nos dois modos. */
  detalhe?: (linha: T) => ReactNode;
  /** Nome da tabela para o leitor de tela. */
  rotulo?: string;
  /** A linha inteira abre o registro (toque, Enter): nada de botão "Abrir" por linha. */
  aoTocarLinha?: (linha: T) => void;
  /** Rótulo do toque para o leitor de tela ("Abrir inscrição de Fulana"). */
  rotuloDaLinha?: (linha: T) => string;
  /**
   * Controle no começo de cada linha, fora do toque que abre o registro (a caixa de marcar de uma ação em lote): nunca
   * fica dentro do botão da linha. Ocupa uma coluna de 44 px, vazia no cabeçalho. Sem ele, a tabela é a de sempre.
   */
  inicio?: (linha: T) => ReactNode;
}

/** Largura em que a tabela ainda cabe em colunas; abaixo disso vira cartões. */
export const LARGURA_TABELA = 520;

/**
 * Tabela com cabeçalho quando há largura (a partir de `larguraMinima`, medida na própria tabela) e cartões
 * empilhados no celular, cada um com os pares "rótulo: valor" (nenhuma coluna some, nada rola na horizontal). A
 * coluna `principal` é o título do cartão e a coluna `acao` fica no canto dele.
 */
export function Tabela<T>({ colunas, linhas, chave, larguraMinima = LARGURA_TABELA, detalhe, rotulo, aoTocarLinha, rotuloDaLinha, inicio }: Props<T>) {
  const { cores, bordas } = useTema();
  const [largura, setLargura] = useState<number | null>(null);
  const empilhada = largura !== null && largura < larguraMinima;
  const estiloColuna = (c: ColunaDaTabela<T>) => [
    c.largura !== undefined ? { width: c.largura } : { flex: c.flex ?? 1, minWidth: 0 },
    c.alinhar === 'centro' ? estilos.centro : c.alinhar === 'direita' ? estilos.direita : null,
  ];
  const principal = colunas.find((c) => c.principal);
  const acao = colunas.find((c) => c.acao);
  const pares = colunas.filter((c) => !c.principal && !c.acao);
  return (
    <View
      accessibilityRole={empilhada ? 'list' : undefined}
      role={empilhada ? undefined : 'table'}
      accessibilityLabel={rotulo}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      style={empilhada ? estilos.cartoes : [estilos.tabela, { borderWidth: bordas.bloco, borderColor: cores.divisor }]}>
      {largura === null ? null : empilhada ? (
        linhas.map((l) => (
          <ComInicio key={chave(l)} inicio={inicio?.(l)} estilo={estilos.cartaoComInicio}>
            <Toque linha={l} aoTocar={aoTocarLinha} rotulo={rotuloDaLinha}
              style={(ativo) => [estilos.cartao, inicio ? estilos.resto : null, { backgroundColor: ativo ? cores.superficie3 : cores.superficie2, borderColor: cores.divisor }]}>
              {principal || acao ? (
                <View style={estilos.topoCartao}>
                  {principal ? <View style={estilos.principal}>{principal.render(l)}</View> : null}
                  {acao ? acao.render(l) : null}
                </View>
              ) : null}
              {pares.map((c) => (
                <View key={c.chave} style={estilos.par}>
                  <Texto variante="pequeno" style={estilos.rotuloPar}>{c.titulo}</Texto>
                  <View style={estilos.valorPar}>{c.render(l)}</View>
                </View>
              ))}
              {detalhe ? detalhe(l) : null}
            </Toque>
          </ComInicio>
        ))
      ) : (
        <>
          <View role="row" style={[estilos.linha, estilos.cabecalho, inicio ? estilos.semRecuo : null, { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo }]}>
            {inicio ? <View role="columnheader" style={estilos.inicio} /> : null}
            {colunas.map((c) => (
              <View key={c.chave} role="columnheader" style={estiloColuna(c)}>
                {c.acao && !c.tituloNaTabela ? null : (
                  <Texto variante="secao" style={c.alinhar === 'centro' ? estilos.textoCentro : c.alinhar === 'direita' ? estilos.textoDireita : null}>
                    {c.titulo}
                  </Texto>
                )}
              </View>
            ))}
          </View>
          {linhas.map((l, i) => {
            const divisoria = i < linhas.length - 1 && { borderColor: cores.divisor, borderBottomWidth: 1 };
            return (
              <ComInicio key={chave(l)} inicio={inicio?.(l)} estilo={[estilos.linhaComInicio, divisoria]} papel="row">
                <Toque linha={l} aoTocar={aoTocarLinha} rotulo={rotuloDaLinha} papel={inicio ? undefined : 'row'}
                  style={(ativo) => [estilos.corpoLinha, inicio ? estilos.resto : null, ativo ? { backgroundColor: cores.superficie3 } : null, !inicio && divisoria]}>
                  <View style={[estilos.linha, inicio ? estilos.semRecuo : null]}>
                    {colunas.map((c) => (
                      <View key={c.chave} role="cell" style={estiloColuna(c)}>{c.render(l)}</View>
                    ))}
                  </View>
                  {detalhe ? <View style={estilos.detalhe}>{detalhe(l)}</View> : null}
                </Toque>
              </ComInicio>
            );
          })}
        </>
      )}
    </View>
  );
}

/** Sem `inicio`, só os filhos (a tabela de sempre); com ele, o controle numa coluna fixa ao lado do toque da linha. */
function ComInicio({ inicio, estilo, papel, children }: { inicio: ReactNode | undefined; estilo: StyleProp<ViewStyle>; papel?: 'row'; children: ReactNode }) {
  if (inicio === undefined) return <>{children}</>;
  return (
    <View role={papel} style={estilo}>
      <View role={papel ? 'cell' : undefined} style={estilos.inicio}>{inicio}</View>
      {children}
    </View>
  );
}

/** Linha (ou cartão) da tabela: com `aoTocar` vira o toque inteiro, com realce no hover; sem, é só uma View. */
function Toque<T>({ linha, aoTocar, rotulo, papel, style, children }: {
  linha: T; aoTocar?: (l: T) => void; rotulo?: (l: T) => string; papel?: 'row';
  style: (ativo: boolean) => StyleProp<ViewStyle>; children: ReactNode;
}) {
  if (!aoTocar) return <View role={papel} style={style(false)}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo?.(linha)} onPress={() => aoTocar(linha)}
      style={(estado) => style(sobre(estado))}>
      {children}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tabela: { borderWidth: BORDA_BLOCO, borderRadius: RAIO, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), minHeight: 48 },
  cabecalho: { borderBottomWidth: 1, minHeight: 40 },
  corpoLinha: { paddingVertical: espaco(0.25) },
  detalhe: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1) },
  centro: { alignItems: 'center' },
  direita: { alignItems: 'flex-end' },
  textoCentro: { textAlign: 'center' },
  textoDireita: { textAlign: 'right' },
  cartoes: { gap: espaco(1) },
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  topoCartao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  principal: { flex: 1 },
  par: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  rotuloPar: { width: 96, paddingTop: 2 },
  // Coluna do `inicio`: a caixa de 44 px mais o recuo da tabela à esquerda.
  inicio: { width: ALVO_TOQUE + espaco(1.5), paddingLeft: espaco(1), alignItems: 'flex-start', justifyContent: 'center', flexShrink: 0 },
  linhaComInicio: { flexDirection: 'row', alignItems: 'stretch', gap: espaco(1) },
  cartaoComInicio: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.5) },
  resto: { flex: 1, minWidth: 0 },
  semRecuo: { paddingLeft: 0 },
  valorPar: { flex: 1, alignItems: 'flex-start' },
});
