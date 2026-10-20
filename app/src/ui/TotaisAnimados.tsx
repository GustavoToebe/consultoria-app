import { View } from 'react-native';
import type { Totais } from '../dominio/dieta';
import { NumeroAnimado } from './NumeroAnimado';
import { Texto } from './Texto';
/**
 * Somente os totais apresentados animam; a conta e os dados continuam exatos. O macro sem valor sai "Proteína —",
 * sem unidade (padrão das telas de 19/10: "— g" parecia um número).
 */
export function TotaisAnimados({ totais }: {totais:Totais}) {
 return <View style={{gap:8}}>
  <NumeroAnimado valor={totais.kcal} variante="destaque" sufixo=" kcal" />
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
   {totais.proteina === null ? <Texto>Proteína —</Texto> : <NumeroAnimado valor={totais.proteina} casas={1} sufixo=" g de proteína" />}
   {totais.carboidrato === null ? <Texto>Carboidrato —</Texto> : <NumeroAnimado valor={totais.carboidrato} casas={1} sufixo=" g de carboidrato" />}
   {totais.gordura === null ? <Texto>Gordura —</Texto> : <NumeroAnimado valor={totais.gordura} casas={1} sufixo=" g de gordura" />}
  </View>
 </View>;
}
