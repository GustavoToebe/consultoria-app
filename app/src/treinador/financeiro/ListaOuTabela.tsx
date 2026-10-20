import { useWindowDimensions, View } from 'react-native';

import { LARGURA_MENU_LATERAL, espaco } from '../../tema/tokens';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Tabela, type ColunaDaTabela } from '../../ui/Tabela';
import type { TipoSelo } from '../../ui/Selo';

export interface ItemDoCelular {
  titulo: string;
  detalhe?: string;
  selo?: { texto: string; tipo: TipoSelo };
}

/**
 * Lista do financeiro: tabela no PC (cabeçalho e colunas) e, no celular, uma fila de `ItemDeLista` (o cartão inteiro é
 * o toque). Toda linha abre o registro; os botões ficam na folha que abre.
 */
export function ListaOuTabela<T>({ rotulo, linhas, chave, colunas, item, aoTocar, rotuloDaLinha, larguraMinima = 760 }: {
  rotulo: string;
  linhas: readonly T[];
  chave: (linha: T) => string;
  colunas: ColunaDaTabela<T>[];
  item: (linha: T) => ItemDoCelular;
  aoTocar: (linha: T) => void;
  rotuloDaLinha: (linha: T) => string;
  larguraMinima?: number;
}) {
  const { width } = useWindowDimensions();
  if (width < LARGURA_MENU_LATERAL) {
    return (
      <View accessibilityRole="list" accessibilityLabel={rotulo} style={{ gap: espaco(1) }}>
        {linhas.map((l) => {
          const i = item(l);
          return <ItemDeLista key={chave(l)} titulo={i.titulo} detalhe={i.detalhe} selo={i.selo} aoTocar={() => aoTocar(l)} rotulo={rotuloDaLinha(l)} />;
        })}
      </View>
    );
  }
  return <Tabela rotulo={rotulo} larguraMinima={larguraMinima} linhas={linhas} chave={chave} colunas={colunas}
    aoTocarLinha={aoTocar} rotuloDaLinha={rotuloDaLinha} />;
}
