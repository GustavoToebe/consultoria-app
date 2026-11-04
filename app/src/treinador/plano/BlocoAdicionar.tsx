import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

/**
 * Fim da lista de um editor (protótipo de 30/10): bloco tracejado, para ler como "lugar de mais um", com título, uma linha
 * do que dá para fazer e os botões de acrescentar. "Adicionar próximo exercício" no treino, "Adicionar próxima refeição" na dieta.
 */
export function BlocoAdicionar({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.bloco, { borderColor: cores.bordaCampo }]}>
      <View style={estilos.textos}>
        <Texto variante="bloco" nivel={3}>{titulo}</Texto>
        <Texto variante="suave">{descricao}</Texto>
      </View>
      <LinhaDeAcoes>{children}</LinhaDeAcoes>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  textos: { flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: 2 },
});
