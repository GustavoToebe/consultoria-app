import { View } from 'react-native';
import { progressoSemana } from '../dominio/progressoSemana';
import { useAluno } from '../offline/AlunoProvider';
import { AnelProgresso } from '../ui/AnelProgresso';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';
/**
 * Treinos da semana. Os registros do provedor já trazem o que está no servidor (a semana atual é buscada ao abrir e
 * guardada no aparelho), então esta conta e o "Hoje" usam a mesma fonte.
 */
export function ProgressoSemana({hoje}:{hoje:string}) {
 const {pacote,registros,semanaDoAparelho}=useAluno();
 const treino=pacote?.pacote.treino??null;
 const progresso=progressoSemana(treino,hoje,registros);
 if (!progresso) return null;
 const rotulo=`${progresso.feitas} de ${progresso.total} ${progresso.total===1?'treino':'treinos'}`;
 return <Cartao titulo="Sua semana"><View style={{flexDirection:'row',alignItems:'center',gap:16}}>
  <AnelProgresso proporcao={progresso.total?progresso.feitas/progresso.total:0} rotulo={`${rotulo} nesta semana`} />
  <View style={{flex:1}}><Texto variante="subtitulo" numerico>{rotulo}</Texto><Texto variante="pequeno">Semana atual · segunda a domingo</Texto>
   {semanaDoAparelho ? <Texto variante="pequeno">Mostrando os registros salvos no aparelho.</Texto> : null}
  </View>
 </View></Cartao>;
}
