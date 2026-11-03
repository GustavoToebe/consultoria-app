import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, type ChaveDeIdentificacao } from '../tema/tokens';
import { Folha } from '../ui/Folha';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * O nome do tipo no título da série ("Série 3 · Back off", A8 da reunião de 30/10): o próprio nome é o toque que abre a
 * explicação do treinador (antes era um selo ao lado do número, e o aluno não ligava o selo ao tipo da série). O ícone
 * diz que dá para tocar; o alvo tem 44 px. Com a cor de identificação do tipo (Frente G, D9 e D10) o nome vira um selo
 * colorido (texto e borda na cor, fundo tingido opaco, contraste conferido em `tokens.test.ts`); o texto continua (D7).
 */
export function TipoDaSerieComExplicacao({ nome, explicacao, numero, cor }: { nome: string; explicacao: string | null; numero: number; cor?: ChaveDeIdentificacao | null }) {
  const { cores, identificacao } = useTema();
  const [aberto, abrir] = useState(false);
  const tom = cor ? identificacao[cor] : null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Explicação de ${nome}, série ${numero}`}
        onPress={() => abrir(true)}
        style={(estado) => [estilos.toque, { backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
        {tom ? (
          <View style={[estilos.selo, { borderColor: tom.cor, backgroundColor: tom.fundo }]}>
            <Texto style={estilos.nomeNoSelo} cor={tom.cor}>{nome}</Texto>
            <Info size={14} color={tom.cor} />
          </View>
        ) : (
          <>
            <Texto style={estilos.nome}>{nome}</Texto>
            <Info size={16} color={cores.textoSuave} />
          </>
        )}
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
  selo: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: espaco(1.25), minHeight: 28 },
  nomeNoSelo: { fontFamily: fontes.negrito, fontSize: 14, lineHeight: 20 },
});
