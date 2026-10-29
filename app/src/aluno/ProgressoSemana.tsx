import { Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { progressoSemana, semanaCompleta } from '../dominio/progressoSemana';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { AnelProgresso } from '../ui/AnelProgresso';
import { Cartao } from '../ui/Cartao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';

/**
 * Treinos da semana. Os registros do provedor já trazem o que está no servidor (a semana atual é buscada ao abrir e
 * guardada no aparelho), então esta conta e o "Hoje" usam a mesma fonte. Com "Concluir treino" ligado, a semana em que
 * todos os treinos com dia fixo têm registro ganha o "Semana completa" (Engajamento 0.6, P5); sem dia fixo, nada.
 */
export function ProgressoSemana({ hoje }: { hoje: string }) {
  const { pacote, registros, semanaDoAparelho } = useAluno();
  const { retornoHabilitado } = useSessao();
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const treino = pacote?.pacote.treino ?? null;
  const progresso = progressoSemana(treino, hoje, registros);
  if (!progresso) return null;
  const completa = retornoHabilitado && semanaCompleta(progresso);
  const rotulo = `${progresso.feitas} de ${progresso.total} ${progresso.total === 1 ? 'treino' : 'treinos'}`;
  return (
    <Cartao titulo="Sua semana">
      <View style={estilos.linha}>
        <AnelProgresso proporcao={progresso.total ? progresso.feitas / progresso.total : 0} rotulo={`${rotulo} nesta semana`} />
        <View style={estilos.textos}>
          <Texto variante="subtitulo" numerico>{rotulo}</Texto>
          <Texto variante="pequeno">Semana atual · segunda a domingo</Texto>
          {semanaDoAparelho ? <Texto variante="pequeno">Mostrando os registros salvos no aparelho.</Texto> : null}
        </View>
      </View>
      {completa ? (
        <Animated.View entering={reduzido ? undefined : FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
          style={[estilos.completa, { borderColor: cores.sucesso, backgroundColor: `${cores.sucesso}1F` }]}
          accessibilityRole="text" accessibilityLabel="Semana completa: você fez todos os treinos desta semana.">
          <Trophy size={22} color={cores.sucesso} />
          <View style={estilos.textos}>
            <View style={estilos.selo}><Selo texto="Semana completa" tipo="sucesso" /></View>
            <Texto>Você fez todos os treinos desta semana.</Texto>
          </View>
        </Animated.View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  completa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  selo: { flexDirection: 'row' },
});
