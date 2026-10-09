import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Texto } from './Texto';
export function CaixaSelecao({rotulo,ajuda,marcado,aoMudar}:{rotulo:string;ajuda?:string;marcado:boolean;aoMudar:(valor:boolean)=>void}) {
  const {cores}=useTema();
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={rotulo} accessibilityState={{checked:marcado}} aria-checked={marcado}
    onPress={()=>aoMudar(!marcado)} style={({pressed})=>[estilos.linha,{backgroundColor:pressed?cores.superficie3:cores.superficie2,borderColor:cores.borda}]}>
    <View style={[estilos.caixa,{backgroundColor:marcado?cores.texto:cores.campo,borderColor:cores.borda}]}>{marcado?<Check size={18} color={cores.fundo}/>:null}</View>
    <View style={estilos.textos}><Texto variante="rotulo">{rotulo}</Texto>{ajuda?<Texto variante="pequeno">{ajuda}</Texto>:null}</View>
  </Pressable>;
}
const estilos=StyleSheet.create({linha:{flexDirection:'row',alignItems:'center',gap:espaco(1.5),padding:espaco(1.5),minHeight:48,borderWidth:1,borderRadius:RAIO},caixa:{width:24,height:24,borderWidth:1,borderRadius:4,alignItems:'center',justifyContent:'center'},textos:{flex:1,gap:4}});
