import { Funnel, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Texto } from '../ui/Texto';

/**
 * Faixa do filtro que veio no endereço (um mini-cartão do Início, um link salvo) e que a tela não tem como escolha própria:
 * diz o que está filtrado e oferece "Limpar filtro", que tira o parâmetro do endereço. É só aviso de lista, não status
 * (sem cor de selo): fundo de item, borda de campo e o ícone do funil.
 */
export function FiltroDoEndereco({ rotulo, aoLimpar }: { rotulo: string; aoLimpar: () => void }) {
  const { cores, bordas } = useTema();
  return (
    <View style={[estilos.faixa, { backgroundColor: cores.superficie2, borderColor: cores.bordaCampo, borderWidth: bordas.item }]}>
      <View style={estilos.texto}>
        <Funnel size={16} color={cores.textoSuave} strokeWidth={2.25} accessibilityElementsHidden importantForAccessibility="no" />
        <Texto style={estilos.quebrar}>
          <Texto variante="suave">Filtro: </Texto>
          <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
        </Texto>
      </View>
      <Botao rotulo="Limpar filtro" rotuloAcessivel={`Limpar filtro: ${rotulo}`} tipo="fantasma" Icone={X} aoTocar={aoLimpar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    columnGap: espaco(2), rowGap: espaco(0.5), borderRadius: RAIO, paddingLeft: espaco(1.5), paddingRight: espaco(0.5),
    paddingVertical: espaco(0.5), alignSelf: 'stretch',
  },
  texto: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexShrink: 1, minHeight: 44 },
  quebrar: { flexShrink: 1 },
});
