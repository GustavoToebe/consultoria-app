import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/TemaProvider';
import { useMovimentoReduzido } from './useMovimentoReduzido';
/** Carregamento de conteúdo: formas sólidas, sem gradiente nem mudança de tamanho. */
export function Esqueleto({ texto = 'Carregando conteúdo', cartoes = 3 }: {texto?:string;cartoes?:number}) {
 const { cores } = useTema();
 const reduzido = useMovimentoReduzido();
 const opacidade = useSharedValue(1);
 useEffect(() => {
  opacidade.set(reduzido ? 1 : withRepeat(withTiming(0.5, {duration:900}), -1, true));
  return () => cancelAnimation(opacidade);
 }, [reduzido, opacidade]);
 const estilo = useAnimatedStyle(() => ({opacity:opacidade.get()}));
 return <Animated.View accessibilityRole="progressbar" accessibilityLabel={texto} style={[{gap:16}, estilo]}>
  {Array.from({length:cartoes}, (_,i) => <View key={i} style={{gap:16,padding:16,borderWidth:1,borderColor:cores.borda,borderRadius:8}}>
   <View style={{height:16,width:'60%',borderRadius:8,backgroundColor:cores.superficie2}} />
   <View style={{height:44,borderRadius:8,backgroundColor:cores.superficie2}} />
   <View style={{height:16,width:'80%',borderRadius:8,backgroundColor:cores.superficie2}} />
  </View>)}
 </Animated.View>;
}
