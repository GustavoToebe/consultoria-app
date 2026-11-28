import { ChevronRight } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, LARGURA_TEXTO_CORRIDO, RAIO } from '../tema/tokens';
import { AlvoDeRolagem } from '../ui/AlvoDeRolagem';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import type { Artigo, ResultadoDaBusca } from './busca';
import { TextoDaAjuda } from './TextoDaAjuda';
import { idDoTopicoNaPagina } from './useTopicoVisivel';
import type { VideoDaAjuda } from './videos';
import { VideosDaSecao } from './VideosDaSecao';

/** Chave de rolagem do tópico (`useRolagem().rolarAte`). */
export const alvoDoTopico = (topico: string) => `ajuda:topico:${topico}`;
/** Chave de rolagem do topo do artigo. */
export const ALVO_DO_ARTIGO = 'ajuda:artigo';

/**
 * Um assunto da Ajuda como documentação: título (h2), os vídeos do assunto e um bloco por tópico (h3 e o texto em
 * blocos), separados por um fio. O tópico pedido (`destaque`: "Saiba mais" do ⓘ, resultado da busca) ganha o fundo de
 * seleção por um instante; com o movimento reduzido a troca é seca, sem transição.
 */
export function ArtigoDaAjuda({ artigo, videos, destaque }: { artigo: Artigo; videos: readonly VideoDaAjuda[] | undefined; destaque: string | null }) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const transicao = (Platform.OS === 'web' && !reduzido ? { transitionProperty: 'background-color', transitionDuration: '600ms' } : {}) as unknown as ViewStyle;
  const quantos = artigo.topicos.length;
  return (
    <View style={estilos.artigo}>
      <AlvoDeRolagem chave={ALVO_DO_ARTIGO}>
        <View style={estilos.cabeca}>
          <Texto variante="titulo" nivel={2}>{artigo.titulo}</Texto>
          <Texto variante="suave" numerico>{`${quantos} ${quantos === 1 ? 'tópico' : 'tópicos'}`}</Texto>
        </View>
      </AlvoDeRolagem>
      <VideosDaSecao videos={videos} />
      {artigo.topicos.map((t, i) => (
        <AlvoDeRolagem key={t.id} chave={alvoDoTopico(t.id)}>
          <View nativeID={idDoTopicoNaPagina(t.id)}
            style={[estilos.topico, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor }, transicao, destaque === t.id && { backgroundColor: cores.superficie3 }]}>
            <Texto variante="bloco" nivel={3} style={estilos.tituloDoTopico}>{t.titulo}</Texto>
            <TextoDaAjuda texto={t.texto} />
          </View>
        </AlvoDeRolagem>
      ))}
    </View>
  );
}

/** Resultados da busca: assunto › tópico e o trecho com a palavra em negrito sobre a seleção neutra; tocar abre o tópico. */
export function ResultadosDaBusca({ resultados, aoAbrir }: { resultados: readonly ResultadoDaBusca[]; aoAbrir: (r: ResultadoDaBusca) => void }) {
  const { cores } = useTema();
  return (
    <View role="list" aria-label="Resultados da busca" style={estilos.resultados}>
      {resultados.map((r) => (
        <View key={`${r.artigoId}#${r.topicoId}`} role="listitem">
          <Pressable accessibilityRole="link" onPress={() => aoAbrir(r)}
            style={(estado) => [estilos.resultado, { borderColor: cores.divisor, backgroundColor: sobre(estado) ? cores.superficie2 : cores.superficie }]}>
            <View style={estilos.textoDoResultado}>
              <Texto variante="pequeno">{r.artigoTitulo}</Texto>
              <Texto variante="bloco">{r.topicoTitulo}</Texto>
              <Texto variante="suave" style={estilos.trecho}>
                {r.trecho.antes}
                {r.trecho.achado ? <Texto variante="suave" style={[estilos.achado, { color: cores.texto, backgroundColor: cores.superficie3 }]}>{r.trecho.achado}</Texto> : null}
                {r.trecho.depois}
              </Texto>
            </View>
            <ChevronRight size={18} color={cores.textoSuave} aria-hidden />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  artigo: { gap: espaco(3) },
  cabeca: { gap: espaco(0.5) },
  // O fundo do destaque passa um pouco das bordas do texto, como um marca-texto, sem mover o texto.
  topico: { gap: espaco(1.5), paddingTop: espaco(3), paddingBottom: espaco(1), marginHorizontal: -espaco(1.5), paddingHorizontal: espaco(1.5), borderRadius: RAIO },
  tituloDoTopico: { fontSize: 18, lineHeight: 24, maxWidth: LARGURA_TEXTO_CORRIDO },
  resultados: { gap: espaco(1) },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), padding: espaco(2), borderRadius: RAIO, borderWidth: 1 },
  textoDoResultado: { flex: 1, minWidth: 0, gap: 2 },
  trecho: { maxWidth: LARGURA_TEXTO_CORRIDO, marginTop: espaco(0.5) },
  achado: { fontFamily: fontes.semi },
});
