import { router } from 'expo-router';
import { Utensils } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { DietaDeHoje } from '../../dominio/resumoDoInicio';
import { contornoDoCartao } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { SecaoDoInicio } from '../SecaoDoInicio';

/**
 * "Dieta de hoje" do Início na web larga (27/11): as refeições do dia (a variação de hoje, quando há) com o horário e a kcal
 * da opção A, a próxima com a seleção neutra e o selo "Próxima" (cor é sinal: a próxima refeição não é situação nem ação), o
 * total do dia à direita do título e "Ver dieta". Mesmo desenho do "Hoje": título de seção sobre a página e um cartão neutro.
 * Falha ao carregar nunca vira "não publicada". O celular continua com o `CartaoDietaDoInicio` de uma linha.
 */
export function CartaoDietaDeHoje({ estado, aoTentarDeNovo }: { estado: DietaDeHoje; aoTentarDeNovo: () => void }) {
  const { cores, preferencias } = useTema();
  const moldura = { backgroundColor: cores.superficie, borderColor: contornoDoCartao(cores, preferencias.contraste) };
  const total = estado.tipo === 'ok' && estado.total ? <Texto variante="suave" numerico accessibilityLabel={`Total do dia: ${estado.total}`}>{estado.total}</Texto> : null;
  const ver = <Botao rotulo="Ver dieta →" rotuloAcessivel="Ver dieta" tipo="secundario" aoTocar={() => router.navigate('/aluno/dieta')} />;

  let corpo;
  if (estado.tipo === 'carregando') {
    corpo = <View accessibilityLabel="Carregando a dieta" style={[estilos.cartao, estilos.carregando, moldura]} />;
  } else if (estado.tipo === 'erro') {
    corpo = (
      <View style={[estilos.cartao, estilos.aviso, moldura]}>
        <Utensils size={20} color={cores.textoSuave} aria-hidden />
        <Texto variante="suave" style={estilos.flex}>Não foi possível carregar a dieta.</Texto>
        <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={aoTentarDeNovo} />
      </View>
    );
  } else if (estado.tipo === 'sem-dieta' || estado.tipo === 'sem-refeicoes-hoje') {
    corpo = (
      <View style={[estilos.cartao, moldura]}>
        <View style={estilos.aviso}>
          <Utensils size={20} color={cores.textoSuave} aria-hidden />
          <Texto variante="suave" style={estilos.flex}>
            {estado.tipo === 'sem-dieta' ? 'Seu treinador ainda não publicou um plano alimentar.' : 'Sem dieta marcada para hoje.'}
          </Texto>
        </View>
        {estado.tipo === 'sem-refeicoes-hoje' ? <View style={estilos.rodape}>{ver}</View> : null}
      </View>
    );
  } else {
    corpo = (
      <View style={[estilos.cartao, moldura]}>
        {estado.variacao ? <Texto variante="suave">Hoje: {estado.variacao}</Texto> : null}
        <View role="list" aria-label="Refeições de hoje">
          {estado.refeicoes.map((r, i) => {
            const proxima = r.uid === estado.proxima;
            return (
              <View key={r.uid} role="listitem"
                style={[estilos.refeicao, i > 0 && !proxima && { borderTopWidth: 1, borderTopColor: cores.divisor },
                  proxima && [estilos.proxima, { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo }]]}>
                <Texto numerico variante={r.horario ? undefined : 'suave'} style={estilos.horario}>{r.horario ?? '—'}</Texto>
                <View style={estilos.nomeEProxima}>
                  <Texto style={[estilos.nome, proxima && estilos.nomeDaProxima]} numberOfLines={1}>{r.nome}</Texto>
                  {proxima ? <Selo texto="Próxima" /> : null}
                </View>
                <Texto numerico variante="suave" style={estilos.kcal}>{r.kcal ?? '—'}</Texto>
              </View>
            );
          })}
        </View>
        <View style={estilos.rodape}>{ver}</View>
      </View>
    );
  }
  return <SecaoDoInicio titulo="Dieta de hoje" direita={total}>{corpo}</SecaoDoInicio>;
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1) },
  carregando: { minHeight: 200, opacity: 0.6 },
  aviso: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
  flex: { flex: 1, minWidth: 160 },
  refeicao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: 44, paddingVertical: espaco(0.75), paddingHorizontal: espaco(1) },
  // A próxima: a seleção neutra (superfície 3 + contorno de campo), sem a cor da marca.
  proxima: { borderWidth: 1, borderRadius: RAIO / 2 },
  horario: { width: 48, fontFamily: fontes.semi },
  nomeEProxima: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  nome: { flexShrink: 1 },
  nomeDaProxima: { fontFamily: fontes.semi },
  kcal: { flexShrink: 0, textAlign: 'right' },
  rodape: { flexDirection: 'row', marginTop: espaco(0.5) },
});
