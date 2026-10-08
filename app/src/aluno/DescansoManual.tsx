import { useState } from 'react';
import { View } from 'react-native';
import { DESCANSOS_PRONTOS, rotuloDescanso, segundosDigitados } from '../dominio/descanso';
import { useAluno } from '../offline/AlunoProvider';
import { useTema } from '../tema/TemaProvider';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';
const COLUNAS = 3;
export function DescansoManual() {
 const [aberto,abrir]=useState(false);
 const [minutos,mudarMinutos]=useState('');
 const [segundos,mudarSegundos]=useState('');
 const { iniciarDescanso }=useAluno();
 const { cores }=useTema();
 const livre=segundosDigitados(minutos,segundos);
 const iniciar=(total:number)=>{iniciarDescanso(total);mudarMinutos('');mudarSegundos('');abrir(false);};
 const soDigitos=(texto:string)=>texto.replace(/\D/g,'').slice(0,2);
 const linhas=Array.from({length:Math.ceil(DESCANSOS_PRONTOS.length/COLUNAS)},(_,i)=>DESCANSOS_PRONTOS.slice(i*COLUNAS,(i+1)*COLUNAS));
 return <><Botao rotulo="Descanso" tipo="secundario" cheio aoTocar={()=>abrir(true)} />
  <Folha visivel={aberto} titulo="Iniciar descanso" aoFechar={()=>abrir(false)}>
   <View style={{gap:16}}>
    <View style={{gap:8}}>
     {linhas.map(linha=><View key={linha[0]} style={{flexDirection:'row',gap:8}}>
      {linha.map(s=><Botao key={s} rotulo={rotuloDescanso(s)} tipo="secundario" style={{flex:1}} aoTocar={()=>iniciar(s)} />)}
     </View>)}
    </View>
    <View style={{gap:8,borderTopWidth:1,borderTopColor:cores.borda,paddingTop:16}}>
     <Texto variante="pequeno">Outro tempo</Texto>
     <View style={{flexDirection:'row',gap:8}}>
      <View style={{flex:1}}><Campo numerico rotulo="Minutos" valor={minutos} aoMudar={t=>mudarMinutos(soDigitos(t))} keyboardType="number-pad" inputMode="numeric" placeholder="0" maxLength={2} /></View>
      <View style={{flex:1}}><Campo numerico rotulo="Segundos" valor={segundos} aoMudar={t=>mudarSegundos(soDigitos(t))} keyboardType="number-pad" inputMode="numeric" placeholder="0" maxLength={2} /></View>
     </View>
     <Botao rotulo={livre?`Iniciar ${rotuloDescanso(livre)}`:'Iniciar'} desabilitado={!livre} cheio aoTocar={()=>livre&&iniciar(livre)} />
    </View>
   </View>
  </Folha>
 </>;
}
