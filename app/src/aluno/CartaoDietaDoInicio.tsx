import { router } from 'expo-router';
import { Droplet, Utensils } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { DietaNoInicio } from '../dominio/inicioDoAluno';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { propsDeLink } from '../ui/propsDeLink';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/** Abaixo disto o ícone da dieta sai do cartão: sem ele o texto cabe em duas linhas ao lado da água. */
const LARGURA_COM_ICONE = 380;

/**
 * Dieta compacta no início do aluno (pedido do Saraiva, R15): "Dieta · N refeições no seu plano · Ver dieta →" e, à
 * direita, separada por um traço vertical, a água do dia. O cartão inteiro abre a Dieta. Os números são os que o
 * treinador escreveu: sem água a coluna some, sem dieta publicada a linha diz isso, e falha ao carregar nunca vira "não
 * publicada" (oferece "Tentar de novo"). A água usa a cor do texto: não existe cor de informação nos tokens.
 */
export function CartaoDietaDoInicio({ estado, aoTentarDeNovo }: { estado: DietaNoInicio; aoTentarDeNovo: () => void }) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const moldura = { backgroundColor: cores.superficie, borderColor: cores.borda };

  if (estado.tipo === 'carregando') {
    return <View accessibilityLabel="Carregando a dieta" style={[estilos.cartao, estilos.carregando, moldura]} />;
  }
  if (estado.tipo === 'erro') {
    return (
      <View style={[estilos.cartao, estilos.aviso, moldura]}>
        <Utensils size={20} color={cores.textoSuave} accessible={false} />
        <Texto variante="suave" style={estilos.textos}>Não foi possível carregar a dieta.</Texto>
        <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={aoTentarDeNovo} />
      </View>
    );
  }
  if (estado.tipo === 'sem-dieta') {
    return (
      <View style={[estilos.cartao, estilos.aviso, moldura]}>
        <Utensils size={20} color={cores.textoSuave} accessible={false} />
        <Texto variante="suave" style={estilos.textos}>Seu treinador ainda não publicou um plano alimentar.</Texto>
      </View>
    );
  }
  const { refeicoes, agua } = estado;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Dieta, ${refeicoes}${agua ? `, água do dia ${agua}` : ''}. Ver dieta.`}
      {...propsDeLink('/aluno/dieta', () => router.navigate('/aluno/dieta'))}
      style={(e) => [estilos.cartao, estilos.linha, { backgroundColor: sobre(e) ? cores.superficie3 : cores.superficie, borderColor: cores.borda }]}>
      {width >= LARGURA_COM_ICONE ? (
        <View style={[estilos.icone, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
          <Utensils size={20} color={cores.texto} accessible={false} />
        </View>
      ) : null}
      <View style={estilos.textos}>
        <View style={estilos.titulo}>
          <Texto style={estilos.nome}>Dieta</Texto>
          <Texto style={estilos.ver}>Ver dieta →</Texto>
        </View>
        <Texto variante="suave" numerico>{refeicoes}</Texto>
      </View>
      {agua ? (
        <>
          <View style={[estilos.traco, { backgroundColor: cores.borda }]} />
          <View style={estilos.agua}>
            <View style={estilos.rotuloAgua}>
              <Droplet size={14} color={cores.texto} accessible={false} />
              <Texto variante="pequeno">Água do dia</Texto>
            </View>
            <Texto numerico style={estilos.litros}>{agua}</Texto>
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(1.25), paddingHorizontal: espaco(1.5), minHeight: ALVO_TOQUE + espaco(2) },
  carregando: { opacity: 0.6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  aviso: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
  icone: { width: 40, height: 40, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  titulo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: espaco(1) },
  nome: { fontFamily: fontes.negrito, fontSize: 16, lineHeight: 22 },
  ver: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18, textDecorationLine: 'underline' },
  traco: { alignSelf: 'stretch', width: 1 },
  agua: { alignItems: 'flex-start', gap: 2 },
  rotuloAgua: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  litros: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 24 },
});
