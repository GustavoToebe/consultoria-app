import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { restante } from '../dominio/descanso';
import { useAluno } from '../offline/AlunoProvider';
import { useTema } from '../tema/TemaProvider';
import { AnelProgresso } from '../ui/AnelProgresso';
import { Botao } from '../ui/Botao';
import { Texto } from '../ui/Texto';
/** Fica fora da rolagem, acima do menu: não cobre campos nem botões do exercício. */
export function BarraDescanso() {
 const { descanso, ajustarDescanso, pularDescanso } = useAluno();
 const { cores } = useTema();
 const [agora, atualizar] = useState(() => Date.now());
 useEffect(() => {
  if (!descanso) return;
  const atualizarAgora=()=>atualizar(Date.now());
  const intervalo=setInterval(atualizarAgora,250);
  const app=AppState.addEventListener('change',atualizarAgora);
  return ()=>{clearInterval(intervalo);app.remove();};
 },[descanso]);
 if (!descanso) return null;
 const ms=Math.min(descanso.duracaoMs,restante(descanso,agora)), segundos=Math.ceil(ms/1000);
 const tempo=`${Math.floor(segundos/60)}:${String(segundos%60).padStart(2,'0')}`;
 return <View style={[estilos.barra,{backgroundColor:cores.superficie,borderColor:cores.bordaCampo}]}>
  <View style={estilos.linha}>
   <AnelProgresso tamanho={48} proporcao={descanso.duracaoMs ? ms/descanso.duracaoMs : 0} rotulo="Tempo de descanso restante" duracao={250} />
   <View style={{flex:1}}><Texto variante="pequeno">{ms===0?'Descanso terminado':'Descanso'}</Texto><Texto variante="destaque" accessibilityLabel={`${segundos} segundos restantes`}>{tempo}</Texto></View>
   <Botao rotulo="Pular" tipo="fantasma" aoTocar={pularDescanso} />
  </View>
  <View style={estilos.linha}><Botao rotulo="−15 s" tipo="secundario" aoTocar={()=>ajustarDescanso(-15)} /><Botao rotulo="+15 s" tipo="secundario" aoTocar={()=>ajustarDescanso(15)} /></View>
 </View>;
}
const estilos=StyleSheet.create({barra:{borderTopWidth:1,padding:8,gap:8},linha:{flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'}});
