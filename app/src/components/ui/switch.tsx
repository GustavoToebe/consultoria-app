import * as Primitivo from '@rn-primitives/switch';
import { View } from 'react-native';
import { useTema } from '../../tema/TemaProvider';
/** Adaptado do RNR: alvo de 44 px, trilho flat e sem transições que ignorem movimento reduzido. */
export function Switch(props: React.ComponentProps<typeof Primitivo.Root>) {
 const { cores, marca } = useTema();
 return <Primitivo.Root {...props} className="min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-ring">
  <View style={{ width: 40, height: 24, borderRadius: 8, padding: 3, backgroundColor: props.checked ? marca : cores.borda }}>
   <Primitivo.Thumb style={{width:18,height:18,borderRadius:6,backgroundColor:'#FFFFFF',transform:[{translateX:props.checked?16:0}]}} />
  </View>
 </Primitivo.Root>;
}
