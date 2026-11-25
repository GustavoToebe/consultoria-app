import { EyeOff } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useTema } from '../../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO_CONTROLE } from '../../../tema/tokens';
import { AlcaDeArraste, type ArrasteDoItem } from '../../../ui/ArrasteDaLista';
import { IconeBotao } from '../../../ui/IconeBotao';
import { Texto } from '../../../ui/Texto';
import { MenuDoBloco } from './MenuDoBloco';
import { SegmentoDeTamanho } from './SegmentoDeTamanho';
import { elementoDaWeb, idDaEdicao, type BlocoDoPainelId, type ItemDaEdicao, type OpcaoDoBloco, type TamanhoDoBloco } from './tipos';

/** Dica do navegador (`title`) no mouse em cima de um ícone: reforço do nome acessível, que é quem diz o que o botão faz. */
function useDica(texto: string) {
  const caixa = useRef<View>(null);
  useEffect(() => { elementoDaWeb(caixa.current)?.setAttribute('title', texto); }, [texto]);
  return caixa;
}

/**
 * A barra de controles de um bloco no modo de edição, no topo dele (fundo neutro do poço): a alça ⠿ e o nome à esquerda;
 * à direita o P · M · G (só onde muda algo), o Ocultar e o ⋯ (Subir, Descer e as opções do bloco). A alça é só do
 * ponteiro (como em todo arrastar do app, `ui/ArrasteDaLista`): o ⋯ faz o mesmo pelo teclado e pelo leitor de tela.
 * Estreita, os controles descem para uma segunda linha, à direita.
 */
export function BarraDoBloco({ item, arraste, tamanhos, alturaMinima, aoMedir, aoMudarTamanho, aoOcultar, aoMover, aoMudarOpcao }: {
  item: ItemDaEdicao;
  /** A maior altura natural das barras da linha: os blocos lado a lado começam o conteúdo na mesma altura. */
  alturaMinima?: number;
  /** Informa a altura natural desta barra (a caixa de dentro, que não recebe a mínima: a medida não se realimenta). */
  aoMedir?: (altura: number) => void;
  arraste: ArrasteDoItem<BlocoDoPainelId>;
  tamanhos: readonly TamanhoDoBloco[];
  aoMudarTamanho: (tamanho: TamanhoDoBloco) => void;
  aoOcultar: () => void;
  aoMover: (delta: -1 | 1) => void;
  aoMudarOpcao: (chave: OpcaoDoBloco['chave'], valor: number) => void;
}) {
  const { cores } = useTema();
  const dicaDoOcultar = useDica('Ocultar');
  return (
    <View nativeID={idDaEdicao(item.id, 'bloco')} style={[estilos.barra, { backgroundColor: cores.superficie2 }, alturaMinima ? { minHeight: alturaMinima + 2 * VERTICAL } : null]}>
      <View style={estilos.dentro} onLayout={aoMedir ? (e: LayoutChangeEvent) => aoMedir(Math.ceil(e.nativeEvent.layout.height)) : undefined}>
      <View style={estilos.nome}>
        <AlcaDeArraste arraste={arraste} indice={item.id} />
        <Texto variante="bloco" nivel={2} numberOfLines={1} style={estilos.titulo}>{item.titulo}</Texto>
      </View>
      <View style={estilos.controles}>
        <SegmentoDeTamanho id={item.id} titulo={item.titulo} valor={item.tamanho} tamanhos={tamanhos} aoMudar={aoMudarTamanho} />
        <View ref={dicaDoOcultar}>
          <IconeBotao Icone={EyeOff} rotulo={`Ocultar ${item.titulo}`} aoTocar={aoOcultar} />
        </View>
        <MenuDoBloco item={item} aoMover={aoMover} aoMudarOpcao={aoMudarOpcao} />
      </View>
      </View>
    </View>
  );
}

const VERTICAL = 2;

const estilos = StyleSheet.create({
  // Conteúdo no alto: numa linha cuja barra vizinha quebrou em duas, o nome fica no topo, alinhado aos outros.
  barra: { justifyContent: 'flex-start', paddingHorizontal: espaco(0.5), paddingVertical: VERTICAL, borderRadius: RAIO_CONTROLE + 2, minHeight: ALVO_TOQUE + 2 * VERTICAL },
  dentro: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2 },
  // O nome reserva 120 px antes de dividir a linha com os controles (como o título da faixa do bloco).
  nome: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0, minHeight: ALVO_TOQUE },
  titulo: { flexShrink: 1, paddingLeft: espaco(0.5) },
  controles: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
});
