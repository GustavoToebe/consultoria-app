import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { CalendarDays, CirclePlay } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao } from '../api/tipos';
import { dataCurta } from '../dominio/formatos';
import { nomeComDia, rotuloDoTipo, totalDeSeries } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Texto } from '../ui/Texto';

/**
 * Destaque do topo: a sessão de hoje na cor da marca (é a ação principal da tela: tocar abre o treino). O rótulo é
 * "HOJE" mais o tipo da sessão (não é sempre treino: pode ser descanso ou cardio). Sem sessão ou sem exercício para
 * registrar, um cartão neutro.
 */
export function CartaoHoje({ sessao, hoje, feitas, aoAbrir }: { sessao: Sessao | null; hoje: string; feitas: number; aoAbrir: () => void }) {
  const { cores, marca, sobreMarca } = useTema();
  const reduzido = useMovimentoReduzido();
  const escala = useSharedValue(1);
  const movimento = useAnimatedStyle(() => ({transform:[{scale:escala.get()}]}));
  const temExercicios = !!sessao && sessao.exercicios.length > 0;
  if (!sessao || !temExercicios) {
    return (
      <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <View style={estilos.topo}>
          <CalendarDays size={20} color={cores.textoSuave} />
          <Texto variante="secao" style={estilos.rotulo}>Hoje{sessao ? ` · ${rotuloDoTipo(sessao)}` : ''}</Texto>
          <Texto variante="secao">{dataCurta(hoje)}</Texto>
        </View>
        {sessao ? (
          <>
            <Texto style={estilos.nome}>{nomeComDia(sessao)}</Texto>
            <Texto variante="suave">{sessao.cardio ? `${rotuloDoTipo(sessao)} · ${sessao.cardio}` : 'Nada para registrar hoje.'}</Texto>
          </>
        ) : (
          <Texto variante="suave">Nenhuma sessão marcada para hoje. Escolha um dia nas divisões abaixo.</Texto>
        )}
      </View>
    );
  }
  const total = totalDeSeries(sessao);
  const conteudo = (
    <>
      <View style={estilos.topo}>
        <CirclePlay size={20} color={sobreMarca} />
        <Texto variante="secao" cor={sobreMarca} style={estilos.rotulo}>
          Hoje · {rotuloDoTipo(sessao)}
        </Texto>
        <Texto variante="secao" cor={sobreMarca}>
          {dataCurta(hoje)}
        </Texto>
      </View>
      <Texto style={[estilos.nome, { color: sobreMarca }]}>
        {nomeComDia(sessao)}
      </Texto>
      <Texto cor={sobreMarca} style={estilos.detalhe}>
        {`${sessao.exercicios.length} ${sessao.exercicios.length === 1 ? 'exercício programado' : 'exercícios programados'}`}
        {sessao.cardio ? ` · ${sessao.cardio}` : ''}
      </Texto>
      {total ? (
        <View style={estilos.progresso}>
          <BarraProgresso feitas={feitas} total={total} cor={sobreMarca} trilho={`${sobreMarca}33`} />
          <Texto variante="pequeno" cor={sobreMarca} style={estilos.detalhe}>
            {feitas ? `${feitas} de ${total} séries feitas · toque para continuar` : `${total} séries · toque para começar`}
          </Texto>
        </View>
      ) : null}
    </>
  );
  return (
    <Animated.View style={movimento}><Pressable
      onPressIn={() => escala.set(reduzido ? 1 : withTiming(0.98,{duration:100}))}
      onPressOut={() => escala.set(reduzido ? 1 : withTiming(1,{duration:150}))}
      accessibilityRole="button"
      accessibilityLabel={`${feitas ? 'Continuar' : 'Começar'} o treino de hoje: ${sessao.nome}`}
      onPress={aoAbrir}
      style={[estilos.cartao, { backgroundColor: marca, borderColor: marca }]}>
      {conteudo}
    </Pressable></Animated.View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2.5), gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  rotulo: { flex: 1, fontFamily: fontes.negrito, letterSpacing: 1 },
  nome: { fontFamily: fontes.negrito, fontSize: 24, lineHeight: 30 },
  detalhe: { opacity: 0.9 },
  progresso: { gap: espaco(0.75), marginTop: espaco(0.5) },
});
