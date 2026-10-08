import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/TemaProvider';
import { useMovimentoReduzido } from './useMovimentoReduzido';
const Circulo = Animated.createAnimatedComponent(Circle);
export function AnelProgresso({ proporcao, rotulo, tamanho = 64, duracao = 400 }: {proporcao:number;rotulo:string;tamanho?:number;duracao?:number}) {
 const {cores} = useTema();
 const reduzido = useMovimentoReduzido();
 const progresso = useSharedValue(0);
 const alvo = Math.max(0, Math.min(1, proporcao));
 useEffect(() => { progresso.set(reduzido ? alvo : withTiming(alvo,{duration:duracao})); },[alvo,duracao,reduzido,progresso]);
 const raio=(tamanho-8)/2, perimetro=2*Math.PI*raio;
 const props=useAnimatedProps(()=>({strokeDashoffset:perimetro*(1-progresso.get())}));
 return <View accessible accessibilityLabel={rotulo} accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round(alvo*100)}}>
  <Svg width={tamanho} height={tamanho} aria-hidden>
   <Circle cx={tamanho/2} cy={tamanho/2} r={raio} stroke={cores.superficie2} strokeWidth={6} fill="none" />
   <Circulo animatedProps={props} cx={tamanho/2} cy={tamanho/2} r={raio} stroke={cores.sucesso} strokeWidth={6} fill="none" strokeDasharray={[perimetro,perimetro]} strokeLinecap="round" rotation={-90} origin={`${tamanho/2}, ${tamanho/2}`} />
  </Svg>
 </View>;
}
