import { View } from 'react-native';
import type { Totais } from '../dominio/dieta';
import { NumeroAnimado } from './NumeroAnimado';
/** Somente os totais apresentados animam; a conta e os dados continuam exatos. */
export function TotaisAnimados({ totais }: {totais:Totais}) {
 return <View style={{gap:8}}>
  <NumeroAnimado valor={totais.kcal} variante="destaque" sufixo=" kcal" />
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
   <NumeroAnimado valor={totais.proteina} casas={1} sufixo=" g de proteína" />
   <NumeroAnimado valor={totais.carboidrato} casas={1} sufixo=" g de carboidrato" />
   <NumeroAnimado valor={totais.gordura} casas={1} sufixo=" g de gordura" />
  </View>
 </View>;
}
