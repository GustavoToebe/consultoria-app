import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Folha } from '../ui/Folha';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * O nome do tipo no título da série ("Série 3 · Back off", A8 da reunião de 30/10): o próprio nome é o toque que abre a
 * explicação do treinador (antes era um selo ao lado do número, e o aluno não ligava o selo ao tipo da série). O ícone
 * diz que dá para tocar; o alvo tem 44 px.
 */
export function TipoDaSerieComExplicacao({ nome, explicacao, numero }: { nome: string; explicacao: string | null; numero: number }) {
  const { cores } = useTema();
  const [aberto, abrir] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Explicação de ${nome}, série ${numero}`}
        onPress={() => abrir(true)}
        style={(estado) => [estilos.toque, { backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
        <Texto style={estilos.nome}>{nome}</Texto>
        <Info size={16} color={cores.textoSuave} />
      </Pressable>
      <Folha visivel={aberto} titulo={nome} aoFechar={() => abrir(false)}>
        {explicacao ? <Texto>{explicacao}</Texto> : <Texto variante="suave">Seu treinador não escreveu uma explicação para este item.</Texto>}
      </Folha>
    </>
  );
}

const estilos = StyleSheet.create({
  toque: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), borderRadius: RAIO, paddingHorizontal: espaco(0.5) },
  nome: { fontFamily: fontes.semi, fontSize: 16 },
});
