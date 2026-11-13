import { Pressable, StyleSheet, View } from 'react-native';

import type { CodigoDeReacao, PostDoMural } from '../api/comunidadeTipos';
import { REACOES, reagiu, rotuloDaReacao, totalDaReacao } from '../dominio/comunidade';
import { inteiroComMilhar } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * As cinco reações do post (D6). "Você reagiu" não fica só na cor: o botão ganha preenchimento de seleção (`superficie3`), o
 * contorno forte (`bordaCampo`, contra o `divisor` dos outros), a contagem em negrito e "você reagiu" no nome acessível, com
 * `aria-pressed` na web. Sem `aoReagir` (quem não pode reagir) ficam só as reações que já têm contagem, para leitura.
 * `ocupado` trava o post enquanto um pedido está em curso (dois toques não se desencontram).
 */
export function BotoesDeReacao({ post, aoReagir, ocupado }: {
  post: Pick<PostDoMural, 'reacoes' | 'minhasReacoes'>;
  aoReagir?: (codigo: CodigoDeReacao, ligar: boolean) => void;
  ocupado?: boolean;
}) {
  const { cores } = useTema();
  const visiveis = aoReagir ? REACOES : REACOES.filter((r) => totalDaReacao(post, r.codigo) > 0);
  if (!visiveis.length) return null;
  return (
    <View style={estilos.linha} accessibilityRole={aoReagir ? 'toolbar' : undefined} accessibilityLabel="Reações">
      {visiveis.map((r) => {
        const total = totalDaReacao(post, r.codigo);
        const minha = reagiu(post, r.codigo);
        const conteudo = (fundo: string) => (
          <View style={[estilos.botao, { backgroundColor: minha ? cores.superficie3 : fundo, borderColor: minha ? cores.bordaCampo : cores.divisor }]}>
            <Texto aria-hidden style={estilos.emoji}>{r.emoji}</Texto>
            {total > 0 ? (
              <Texto numerico aria-hidden cor={cores.texto} style={{ fontFamily: minha ? fontes.semi : fontes.medio }}>{inteiroComMilhar(total)}</Texto>
            ) : null}
          </View>
        );
        const rotulo = rotuloDaReacao(r.rotulo, total, minha);
        if (!aoReagir) return <View key={r.codigo} accessible accessibilityLabel={rotulo}>{conteudo('transparent')}</View>;
        return (
          <Pressable key={r.codigo}
            accessibilityRole="button"
            accessibilityLabel={rotulo}
            accessibilityState={{ selected: minha, disabled: !!ocupado, busy: !!ocupado }}
            aria-pressed={minha}
            disabled={ocupado}
            onPress={() => aoReagir(r.codigo, !minha)}
            style={estilos.alvo}>
            {(estado) => conteudo(sobre(estado) ? cores.superficie2 : 'transparent')}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75), alignItems: 'center' },
  alvo: { minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, justifyContent: 'center' },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(0.5),
    minHeight: 36, minWidth: ALVO_TOQUE, paddingHorizontal: espaco(1), borderRadius: 18, borderWidth: 1,
  },
  emoji: { fontSize: 16, lineHeight: 20 },
});
