import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Texto } from './Texto';
/**
 * `desabilitado` apaga a caixa e não deixa mudar; o `ajuda` é onde cabe o motivo ("Disponível em outro plano"). O texto
 * da opção usa o corpo, como as escolhas únicas: no `rotulo` (pequeno e cinza) parecia opção desativada.
 */
export function CaixaSelecao({rotulo,ajuda,marcado,aoMudar,desabilitado}:{rotulo:string;ajuda?:string;marcado:boolean;aoMudar:(valor:boolean)=>void;desabilitado?:boolean}) {
  const {cores}=useTema();
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={rotulo} accessibilityState={{checked:marcado,disabled:!!desabilitado}} aria-checked={marcado} aria-disabled={!!desabilitado} accessibilityHint={desabilitado?ajuda:undefined}
    disabled={desabilitado} onPress={()=>aoMudar(!marcado)} style={({pressed})=>[estilos.linha,{backgroundColor:pressed&&!desabilitado?cores.superficie3:cores.superficie2,borderColor:cores.borda,opacity:desabilitado?0.5:1}]}>
    <View style={[estilos.caixa,{backgroundColor:marcado?cores.texto:cores.campo,borderColor:cores.borda}]}>{marcado?<Check size={18} color={cores.fundo}/>:null}</View>
    <View style={estilos.textos}><Texto>{rotulo}</Texto>{ajuda?<Texto variante="pequeno">{ajuda}</Texto>:null}</View>
  </Pressable>;
}
const estilos=StyleSheet.create({linha:{flexDirection:'row',alignItems:'center',gap:espaco(1.5),padding:espaco(1.5),minHeight:48,borderWidth:1,borderRadius:RAIO},caixa:{width:24,height:24,borderWidth:1,borderRadius:4,alignItems:'center',justifyContent:'center'},textos:{flex:1,gap:4}});
