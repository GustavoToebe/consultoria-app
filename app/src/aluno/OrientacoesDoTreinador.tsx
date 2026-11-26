import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { secoesDasOrientacoes } from '../dominio/secoesDasOrientacoes';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_TEXTO_CORRIDO, RAIO_CONTROLE } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * "Orientações do treinador" na aba Treino (Gustavo, 25/11): nasce recolhido, com o objetivo à vista no resumo da faixa.
 * Aberto, mostra a introdução e as seções do texto ("FS:", "WS:", "Cardio:", `dominio/secoesDasOrientacoes`), cada uma
 * recolhível e fechada. Só objetivo, sem orientações: o cartão não recolhe (não haveria o que abrir).
 */
export function OrientacoesDoTreinador({ objetivo, orientacoes }: { objetivo: string | null; orientacoes: string | null }) {
  if (!objetivo && !orientacoes) return null;
  const resumo = objetivo ? `Objetivo: ${objetivo}` : undefined;
  if (!orientacoes?.trim()) return <Cartao titulo="Orientações do treinador" resumo={resumo}>{null}</Cartao>;
  const { introducao, secoes } = secoesDasOrientacoes(orientacoes);
  return (
    <Cartao titulo="Orientações do treinador" resumo={resumo} recolhivel>
      {introducao ? <Texto variante="suave" style={estilos.corrido}>{introducao}</Texto> : null}
      {secoes.length ? (
        <View style={estilos.secoes}>
          {/* A chave leva o texto: outro plano com o mesmo título nasce fechado. */}
          {secoes.map((s, i) => <SecaoRecolhivel key={`${i}:${s.titulo}:${s.texto}`} titulo={s.titulo} texto={s.texto} primeira={i === 0} />)}
        </View>
      ) : null}
    </Cartao>
  );
}

function SecaoRecolhivel({ titulo, texto, primeira }: { titulo: string; texto: string; primeira: boolean }) {
  const { cores } = useTema();
  const [aberta, setAberta] = useState(false);
  const Seta = aberta ? ChevronUp : ChevronDown;
  return (
    <View style={[estilos.secao, { borderTopColor: cores.divisor, borderTopWidth: primeira ? 0 : 1 }]}>
      <Pressable
        accessibilityRole="button"
        // `aria-expanded` direto, como no `CabecalhoDeGrupo`: só o `accessibilityState` não chega ao DOM na web.
        accessibilityState={{ expanded: aberta }}
        aria-expanded={aberta}
        accessibilityLabel={titulo}
        onPress={() => setAberta((a) => !a)}
        style={(estado) => [estilos.botao, { backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
        <Texto style={estilos.titulo}>{titulo}</Texto>
        <Seta size={18} color={cores.textoSuave} aria-hidden />
      </Pressable>
      {aberta && texto ? <Texto variante="suave" style={[estilos.corrido, estilos.texto]}>{texto}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Texto corrido do treinador em ~72 caracteres por linha (4.10).
  corrido: { maxWidth: LARGURA_TEXTO_CORRIDO },
  secoes: { gap: 0 },
  secao: { paddingVertical: espaco(0.25) },
  botao: {
    minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderRadius: RAIO_CONTROLE,
    paddingHorizontal: espaco(0.5), marginHorizontal: -espaco(0.5),
  },
  titulo: { flex: 1, fontFamily: fontes.semi },
  texto: { paddingBottom: espaco(1) },
});
