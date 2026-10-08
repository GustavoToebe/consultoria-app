import { CalendarDays, CirclePlay } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao } from '../api/tipos';
import { dataCurta } from '../dominio/formatos';
import { nomeComDia, rotuloDoTipo, totalDeSeries } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Texto } from '../ui/Texto';

/**
 * Destaque do topo: a sessão de hoje na cor da marca (é a ação principal da tela: tocar abre o treino). Sem sessão
 * hoje, um cartão neutro.
 */
export function CartaoHoje({ sessao, hoje, feitas, aoAbrir }: { sessao: Sessao | null; hoje: string; feitas: number; aoAbrir: () => void }) {
  const { cores, marca, sobreMarca } = useTema();
  if (!sessao) {
    return (
      <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <View style={estilos.topo}>
          <CalendarDays size={20} color={cores.textoSuave} />
          <Texto variante="secao" style={estilos.rotulo}>Treino de hoje</Texto>
          <Texto variante="secao">{dataCurta(hoje)}</Texto>
        </View>
        <Texto variante="suave">Nenhuma sessão marcada para hoje. Escolha um dia nas divisões abaixo.</Texto>
      </View>
    );
  }
  const total = totalDeSeries(sessao);
  const temExercicios = sessao.exercicios.length > 0;
  const conteudo = (
    <>
      <View style={estilos.topo}>
        <CirclePlay size={20} color={sobreMarca} />
        <Texto variante="secao" cor={sobreMarca} style={estilos.rotulo}>
          Treino de hoje
        </Texto>
        <Texto variante="secao" cor={sobreMarca}>
          {dataCurta(hoje)}
        </Texto>
      </View>
      <Texto style={[estilos.nome, { color: sobreMarca }]}>
        {nomeComDia(sessao)}
      </Texto>
      <Texto cor={sobreMarca} style={estilos.detalhe}>
        {temExercicios ? `${sessao.exercicios.length} exercícios programados` : rotuloDoTipo(sessao)}
        {sessao.cardio ? ` · ${sessao.cardio}` : ''}
      </Texto>
      {total ? (
        <View style={estilos.progresso}>
          <BarraProgresso feitas={feitas} total={total} cor={sobreMarca} trilho={`${sobreMarca}33`} />
          <Texto variante="pequeno" cor={sobreMarca} style={estilos.detalhe}>
            {feitas ? `${feitas} de ${total} séries feitas · toque para continuar` : `${total} séries · toque para começar`}
          </Texto>
        </View>
      ) : null}
    </>
  );
  if (!temExercicios) {
    return <View style={[estilos.cartao, { backgroundColor: marca, borderColor: marca }]}>{conteudo}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${feitas ? 'Continuar' : 'Começar'} o treino de hoje: ${sessao.nome}`}
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.cartao, { backgroundColor: marca, borderColor: marca, opacity: pressed ? 0.85 : 1 }]}>
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2.5), gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  rotulo: { flex: 1, fontFamily: fontes.negrito, letterSpacing: 1 },
  nome: { fontFamily: fontes.negrito, fontSize: 24, lineHeight: 30 },
  detalhe: { opacity: 0.9 },
  progresso: { gap: espaco(0.75), marginTop: espaco(0.5) },
});
