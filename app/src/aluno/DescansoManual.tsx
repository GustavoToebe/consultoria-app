import { useState } from 'react';
import { View } from 'react-native';
import { useAluno } from '../offline/AlunoProvider';
import { Botao } from '../ui/Botao';
import { Folha } from '../ui/Folha';
export function DescansoManual() {
 const [aberto,abrir]=useState(false);
 const { iniciarDescanso }=useAluno();
 return <><Botao rotulo="Descanso" tipo="secundario" aoTocar={()=>abrir(true)} />
  <Folha visivel={aberto} titulo="Iniciar descanso" aoFechar={()=>abrir(false)}><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
   {[60,90,120,180].map(segundos=><Botao key={segundos} rotulo={`${segundos} s`} aoTocar={()=>{iniciarDescanso(segundos);abrir(false);}} />)}
  </View></Folha>
 </>;
}
