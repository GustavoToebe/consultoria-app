import { View } from 'react-native';
import { historicoAluno } from '../api/rotas';
import { periodoDaSemana, progressoSemana } from '../dominio/progressoSemana';
import { useAluno } from '../offline/AlunoProvider';
import { AnelProgresso } from '../ui/AnelProgresso';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
export function ProgressoSemana({hoje}:{hoje:string}) {
 const {pacote,registros,online,repositorio}=useAluno();
 const treino=pacote?.pacote.treino??null;
 const periodo=periodoDaSemana(hoje);
 const historico=useCarregar(`${treino?.versaoId}|${periodo.inicio}|${online}`,async () => {
  if (!treino) return [];
  try {
   if (!online) throw new Error('Sem conexão');
   const dias = await historicoAluno(periodo.inicio,periodo.fim);
   await repositorio.salvarHistoricoSemana({versaoId:treino.versaoId,inicio:periodo.inicio,dias});
   return dias;
  } catch {
   const salvo = await repositorio.lerHistoricoSemana();
   return salvo?.versaoId === treino.versaoId && salvo.inicio === periodo.inicio ? salvo.dias : [];
  }
 });
 const progresso=progressoSemana(treino,hoje,registros,historico.dados??[]);
 if (!progresso) return null;
 const rotulo=`${progresso.feitas} de ${progresso.total} treinos`;
 return <Cartao titulo="Sua semana"><View style={{flexDirection:'row',alignItems:'center',gap:16}}>
  <AnelProgresso proporcao={progresso.total?progresso.feitas/progresso.total:0} rotulo={`${rotulo} nesta semana`} />
  <View style={{flex:1}}><Texto variante="subtitulo" numerico>{rotulo}</Texto><Texto variante="pequeno">Semana atual · segunda a domingo</Texto>
   {!online || historico.erro ? <Texto variante="pequeno">Mostrando os registros salvos no aparelho.</Texto> : null}
  </View>
 </View></Cartao>;
}
