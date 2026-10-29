import { ChevronDown, ChevronUp, CookingPot } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { modoDePreparoParaMostrar } from '../dominio/dieta';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * "Modo de preparo" da refeição na dieta do aluno: fechado por padrão (a refeição continua curta) e aberto ao tocar,
 * como o "Como fazer" do exercício. O texto aparece como o treinador escreveu, com as quebras de linha; sem texto, nada
 * aparece. Só leitura: nada é calculado a partir dele.
 */
export function ModoDePreparo({ texto }: { texto: string | null | undefined }) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const mostrar = modoDePreparoParaMostrar(texto);
  if (!mostrar) return null;
  const Seta = aberto ? ChevronUp : ChevronDown;
  return (
    <View style={estilos.bloco}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={aberto ? 'Fechar modo de preparo' : 'Abrir modo de preparo'}
        onPress={() => setAberto((a) => !a)}
        style={(estado) => [estilos.botao, { backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
        <CookingPot size={20} color={cores.texto} />
        <Texto style={estilos.titulo}>Modo de preparo</Texto>
        <Seta size={20} color={cores.texto} />
      </Pressable>
      {aberto ? (
        <View style={[estilos.texto, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
          <Texto numerico>{mostrar}</Texto>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.5) },
  botao: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderRadius: RAIO, paddingHorizontal: espaco(0.5) },
  titulo: { flex: 1, fontFamily: fontes.semi },
  texto: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25) },
});
