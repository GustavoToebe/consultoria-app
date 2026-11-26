import { Pressable, StyleSheet, View } from 'react-native';

import type { Refeicao } from '../../api/tipos';
import { kcalPorRefeicao } from '../../dominio/dieta';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { kcalNaTela } from '../../ui/ValoresDaDieta';
import { tituloDaRefeicao } from './CartaoRefeicao';

/**
 * "Por refeição" do Total do dia (25/11): uma linha por refeição, na ordem do dia, com o nome, as kcal da opção A e uma
 * barra do quanto ela pesa no dia, em neutro forte (`texto`, como as barras da água; não é situação, não se pinta). Tocar
 * escolhe a refeição no editor (`aoEscolher`). Sem total do dia (item sem kcal) a barra fica vazia; com uma refeição só a
 * seção não aparece (uma barra cheia não diz nada).
 */
export function PorRefeicao({ refeicoes, aoEscolher }: { refeicoes: Refeicao[]; aoEscolher: (uid: string) => void }) {
  const { cores } = useTema();
  if (refeicoes.length < 2) return null;
  const linhas = kcalPorRefeicao(refeicoes);
  return (
    <View style={estilos.secao}>
      <Texto variante="rotulo" nivel={3}>Por refeição</Texto>
      <View role="list" style={estilos.lista}>
        {refeicoes.map((r, i) => {
          const { kcal, fracao } = linhas[i];
          const nome = tituloDaRefeicao(r, i);
          const kcalTexto = kcal === null ? kcalNaTela(kcal) : `${kcalNaTela(kcal)} kcal`;
          const parte = fracao === null ? '' : `, ${Math.round(fracao * 100)}% do dia`;
          return (
            <View key={r.uid} role="listitem">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ir para ${nome}: ${kcal === null ? 'sem kcal' : kcalTexto}${parte}`}
                onPress={() => aoEscolher(r.uid)}
                style={(s) => [estilos.linha, { backgroundColor: sobre(s) ? cores.sobre : 'transparent' }]}>
                <View style={estilos.topo}>
                  <Texto variante="suave" cor={cores.texto} numberOfLines={1} style={estilos.nome}>{nome}</Texto>
                  <Texto variante="numero">{kcalTexto}</Texto>
                </View>
                <View aria-hidden style={[estilos.trilho, { backgroundColor: cores.superficie3 }]}>
                  {fracao ? <View style={[estilos.cheio, { width: `${Math.min(fracao, 1) * 100}%`, backgroundColor: cores.texto }]} /> : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Teto quando o cartão ocupa a faixa toda (celular, uma ou duas colunas): a barra não estica pela tela.
  secao: { gap: espaco(0.5), maxWidth: 560 },
  lista: { gap: 2 },
  // A linha toda é o alvo (44 px); a margem negativa alinha o texto com o resto do cartão e deixa o hover respirar.
  linha: { minHeight: ALVO_TOQUE, justifyContent: 'center', gap: espaco(0.5), borderRadius: 8, paddingVertical: espaco(0.75), paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(1) },
  nome: { flex: 1, minWidth: 0 },
  trilho: { height: 6, borderRadius: 3, overflow: 'hidden' },
  cheio: { height: '100%', borderRadius: 3 },
});
