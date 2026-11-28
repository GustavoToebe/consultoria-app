import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { espaco } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { alturaDaPreviaFixa, arranjoDaMarca, VAO_DA_PREVIA, type ArranjoDaMarca } from './arranjoDaMarca';

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo de `plano/TelaDoEditor`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), zIndex: 1 } : {}) as unknown as ViewStyle;

interface Props {
  /** Largura da coluna do formulário na tela larga (Marca 720, Contato 640). */
  largura: number;
  /** Os cartões do formulário. */
  formulario: ReactNode;
  /** O que vem depois dos cartões e da prévia empilhada: o erro geral e o rodapé de salvar. */
  fim: ReactNode;
  /** O conteúdo da prévia (o `Cartao` é daqui), sabendo onde ela está. */
  previa: (arranjo: ArranjoDaMarca) => ReactNode;
}

/**
 * Formulário com prévia ao vivo das telas da consultoria (Marca e Contato, 28/11). Pela largura MEDIDA da área
 * (`arranjoDaMarca`, ~1600): `larga`, o formulário numa coluna à esquerda e a prévia no resto, num cartão fixo ao rolar
 * com a altura da coluna do formulário (sem passar da janela); `empilhado`, a prévia embaixo dos cartões, antes do
 * salvar. Sem medida, nenhuma prévia (não pisca). O formulário mora sempre no mesmo invólucro: trocar de arranjo não o
 * remonta nem perde o foco.
 */
export function ComPrevia({ largura, formulario, fim, previa }: Props) {
  const { height: alturaDaJanela } = useWindowDimensions();
  // Largura medida num contêiner que é sempre 100% e não muda com o arranjo; altura da coluna do formulário para o cartão fixo.
  const [larguraDaTela, setLarguraDaTela] = useState<number | null>(null);
  const [alturaDoFormulario, setAlturaDoFormulario] = useState<number | null>(null);
  const arranjo = arranjoDaMarca(larguraDaTela);
  const larga = arranjo === 'larga';
  const altura = larga ? alturaDaPreviaFixa(alturaDoFormulario, alturaDaJanela) : undefined;
  const cartao = (a: ArranjoDaMarca) => (
    <Cartao style={a === 'larga' ? estilos.esticado : null}>{previa(a)}</Cartao>
  );
  return (
    <View style={larga ? estilos.lado : estilos.empilhado} onLayout={(e) => setLarguraDaTela(e.nativeEvent.layout.width)}>
      <View testID="coluna-do-formulario" style={larga ? [estilos.colunaDoFormulario, { width: largura }] : estilos.empilhado}
        onLayout={(e) => setAlturaDoFormulario(e.nativeEvent.layout.height)}>
        {formulario}
        {arranjo === 'empilhado' ? cartao(arranjo) : null}
        {fim}
      </View>
      {/* A coluna estica até a altura da linha (o `sticky` precisa de onde andar); o cartão gruda no topo ao rolar. */}
      {larga ? (
        <View style={estilos.colunaDaPrevia}>
          <View testID="coluna-da-previa" style={[GRUDADA, altura !== undefined ? { height: altura } : null]}>{cartao('larga')}</View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // O mesmo vão que o `Tela` dá entre os blocos.
  empilhado: { gap: espaco(2) },
  lado: { flexDirection: 'row', alignItems: 'stretch', gap: VAO_DA_PREVIA },
  colunaDoFormulario: { flexShrink: 0, gap: espaco(2), alignSelf: 'flex-start' },
  colunaDaPrevia: { flex: 1, minWidth: 0 },
  esticado: { flex: 1, minHeight: 0 },
});
