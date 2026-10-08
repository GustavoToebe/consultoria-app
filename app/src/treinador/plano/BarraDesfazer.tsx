import { Undo2, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';

export interface Desfazer<C> {
  rotulo: string;
  /** Conteúdo antes da mudança (só em memória). */
  conteudo: C;
}

/** Faixa logo abaixo do topo depois de aplicar receita ou remover algo: "Desfazer" volta ao conteúdo anterior. */
export function BarraDesfazer<C>({
  desfazer,
  aoDesfazer,
  aoFechar,
}: {
  desfazer: Desfazer<C>;
  aoDesfazer: () => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[estilos.barra, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Texto style={estilos.texto}>{desfazer.rotulo}</Texto>
      <Botao rotulo="Desfazer" tipo="secundario" Icone={Undo2} aoTocar={aoDesfazer} />
      <IconeBotao Icone={X} rotulo="Fechar aviso" aoTocar={aoFechar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    paddingLeft: espaco(1.5),
    paddingVertical: espaco(0.5),
  },
  texto: { flex: 1 },
});
