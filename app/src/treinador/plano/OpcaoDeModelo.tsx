import { Pressable, StyleSheet } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { Texto } from '../../ui/Texto';

/** Linha de ação da folha "Modelos prontos" (treino e dieta): título, o que faz e um toque para escolher. */
export function OpcaoDeModelo({ titulo, descricao, desabilitado, aoEscolher }: { titulo: string; descricao: string; desabilitado?: boolean; aoEscolher: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      // O rótulo cobre os filhos: sem a dica, o leitor de tela não leria o que a opção faz.
      accessibilityHint={descricao}
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      onPress={aoEscolher}
      style={({ pressed }) => [
        estilos.opcao,
        { backgroundColor: desabilitado ? coresDoDesabilitado(cores).fundo : pressed ? cores.superficie3 : cores.superficie2, borderColor: cores.borda },
      ]}>
      <Texto variante="bloco" cor={desabilitado ? cores.textoSuave : undefined}>{titulo}</Texto>
      <Texto variante="suave">{descricao}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  opcao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 4, minHeight: 56 },
});
