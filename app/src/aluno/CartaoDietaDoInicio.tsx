import { router } from 'expo-router';
import { Utensils } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DietaNoInicio } from '../dominio/inicioDoAluno';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { propsDeLink } from '../ui/propsDeLink';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * Dieta compacta no início do aluno (pedido do Saraiva, R15): "Dieta · N refeições no seu plano · Ver dieta →", numa
 * linha só (25/11: a água saiu daqui e fica só no cartão "Água de hoje"). O cartão inteiro abre a Dieta. Os números são
 * os que o treinador escreveu: sem dieta publicada a linha diz isso, e falha ao carregar nunca vira "não publicada"
 * (oferece "Tentar de novo").
 */
export function CartaoDietaDoInicio({ estado, aoTentarDeNovo }: { estado: DietaNoInicio; aoTentarDeNovo: () => void }) {
  const { cores } = useTema();
  const moldura = { backgroundColor: cores.superficie, borderColor: cores.divisor };

  if (estado.tipo === 'carregando') {
    return <View accessibilityLabel="Carregando a dieta" style={[estilos.cartao, estilos.carregando, moldura]} />;
  }
  if (estado.tipo === 'erro') {
    return (
      <View style={[estilos.cartao, estilos.aviso, moldura]}>
        <Utensils size={20} color={cores.textoSuave} aria-hidden />
        <Texto variante="suave" style={estilos.textos}>Não foi possível carregar a dieta.</Texto>
        <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={aoTentarDeNovo} />
      </View>
    );
  }
  if (estado.tipo === 'sem-dieta') {
    return (
      <View style={[estilos.cartao, estilos.aviso, moldura]}>
        <Utensils size={20} color={cores.textoSuave} aria-hidden />
        <Texto variante="suave" style={estilos.textos}>Seu treinador ainda não publicou um plano alimentar.</Texto>
      </View>
    );
  }
  const { refeicoes } = estado;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Dieta, ${refeicoes}. Ver dieta.`}
      {...propsDeLink('/aluno/dieta', () => router.navigate('/aluno/dieta'))}
      style={(e) => [estilos.cartao, estilos.linha, { backgroundColor: sobre(e) ? cores.sobre : cores.superficie, borderColor: cores.divisor }]}>
      <View style={[estilos.icone, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
        <Utensils size={20} color={cores.texto} aria-hidden />
      </View>
      <View style={estilos.textos}>
        <View style={estilos.titulo}>
          <Texto style={estilos.nome}>Dieta</Texto>
          <Texto style={estilos.ver}>Ver dieta →</Texto>
        </View>
        <Texto variante="suave" numerico>{refeicoes}</Texto>
      </View>
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
});
