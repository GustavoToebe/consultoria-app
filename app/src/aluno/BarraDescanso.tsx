import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { restante } from '../dominio/descanso';
import { useAluno } from '../offline/AlunoProvider';
import { TOKENS_STNDRD_ESCURO } from '../tema/tokens';
import { useTema } from '../tema/TemaProvider';
import { AnelProgresso } from '../ui/AnelProgresso';
import { Botao } from '../ui/Botao';
import { Texto } from '../ui/Texto';
/** Fica fora da rolagem, acima do menu: não cobre campos nem botões do exercício. */
export function BarraDescanso() {
 const { descanso, ajustarDescanso, pularDescanso } = useAluno();
 const { stndrd: stndrdTema } = useTema();
 const stndrd = stndrdTema ?? TOKENS_STNDRD_ESCURO;
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
 // Liquid Glass (STNDRD): superfície translúcida + blur na web e fallback translúcido no nativo.
 const estiloGlass = [
  estilos.barra,
  { backgroundColor: stndrd.glass.bg, borderColor: stndrd.glass.border },
  Platform.OS === 'web' ? ({ backdropFilter: `blur(${stndrd.glass.blur}px)` } as object) : null,
 ];
 return <View style={estiloGlass}>
  <View style={estilos.linha}>
   <AnelProgresso tamanho={40} proporcao={descanso.duracaoMs ? ms/descanso.duracaoMs : 0} rotulo="Tempo de descanso restante" duracao={250} />
   <View style={estilos.tempo}><Texto variante="pequeno" numberOfLines={2}>{ms===0?'Terminou':descanso.rotulo??'Descanso'}</Texto><Texto variante="destaque" numerico accessibilityLabel={`${segundos} segundos restantes`}>{tempo}</Texto></View>
   <Botao rotulo="−15" rotuloAcessivel="Diminuir 15 segundos" tipo="secundario" aoTocar={()=>ajustarDescanso(-15)} />
   <Botao rotulo="+15" rotuloAcessivel="Aumentar 15 segundos" tipo="secundario" aoTocar={()=>ajustarDescanso(15)} />
   <Botao rotulo="Pular" rotuloAcessivel="Pular o descanso" tipo="fantasma" aoTocar={pularDescanso} />
  </View>
 </View>;
}
const estilos=StyleSheet.create({barra:{borderTopWidth:1,paddingHorizontal:8,paddingVertical:6},linha:{flexDirection:'row',gap:6,alignItems:'center'},tempo:{flex:1,minWidth:0}});
