import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ALVO_TOQUE, LARGURA_MENU_LATERAL, espaco } from '../../tema/tokens';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Tabela, type ColunaDaTabela } from '../../ui/Tabela';
import type { TipoSelo } from '../../ui/Selo';

export interface ItemDoCelular {
  titulo: string;
  detalhe?: string;
  selo?: { texto: string; tipo: TipoSelo };
  /** Conteúdo abaixo do detalhe (ex.: o tipo do lançamento com ícone); o leitor de tela usa o `rotuloDaLinha`. */
  extra?: ReactNode;
}

/**
 * Lista do financeiro: tabela no PC (cabeçalho e colunas) e, no celular, uma fila de `ItemDeLista` (o cartão inteiro é
 * o toque). Toda linha abre o registro; os botões ficam na folha que abre. `inicio` (a caixa de marcar do lote) fica ao
 * lado do toque da linha, nunca dentro dele.
 */
export function ListaOuTabela<T>({ rotulo, linhas, chave, colunas, item, aoTocar, rotuloDaLinha, larguraMinima = 760, inicio }: {
  rotulo: string;
  linhas: readonly T[];
  chave: (linha: T) => string;
  colunas: ColunaDaTabela<T>[];
  item: (linha: T) => ItemDoCelular;
  aoTocar: (linha: T) => void;
  rotuloDaLinha: (linha: T) => string;
  larguraMinima?: number;
  inicio?: (linha: T) => ReactNode;
}) {
  const { width } = useWindowDimensions();
  if (width < LARGURA_MENU_LATERAL) {
    return (
      <View accessibilityRole="list" accessibilityLabel={rotulo} style={{ gap: espaco(1) }}>
        {linhas.map((l) => {
          const i = item(l);
          const linha = <ItemDeLista key={chave(l)} titulo={i.titulo} detalhe={i.detalhe} selo={i.selo} aoTocar={() => aoTocar(l)} rotulo={rotuloDaLinha(l)}>{i.extra}</ItemDeLista>;
          if (!inicio) return linha;
          return (
            <View key={chave(l)} style={estilos.comInicio}>
              <View style={estilos.inicio}>{inicio(l)}</View>
              <View style={estilos.resto}>{linha}</View>
            </View>
          );
        })}
      </View>
    );
  }
  return <Tabela rotulo={rotulo} larguraMinima={larguraMinima} linhas={linhas} chave={chave} colunas={colunas}
    aoTocarLinha={aoTocar} rotuloDaLinha={rotuloDaLinha} inicio={inicio} />;
}

const estilos = StyleSheet.create({
  comInicio: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  // A caixa de 44 px; sem caixa (cobrança que não entra no lote) o espaço fica, para os cartões não desalinharem.
  inicio: { width: ALVO_TOQUE, flexShrink: 0 },
  resto: { flex: 1, minWidth: 0 },
});
