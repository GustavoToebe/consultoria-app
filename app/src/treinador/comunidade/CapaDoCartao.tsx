import { Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { baixarCapaDaEquipe } from '../../api/comunidade';
import { ImagemDaCapa } from '../../comunidade/CapaDoVideo';
import { PlayerDeVideo } from '../../comunidade/PlayerDeVideo';
import { idDoYoutube } from '../../dominio/comunidade';
import { linkParaAbrir } from '../../dominio/links';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

const DIAMETRO_DO_PLAY = 48;

/**
 * Capa 16:9 do cartão da grade (D2, 19/11): a nossa capa (bytes pela API com o token) ou, sem capa, o poço `superficie2`
 * com o título; no centro, o play. O quadro inteiro é o botão "Assistir: <título>": no YouTube o player monta no mesmo
 * quadro só depois do toque; outro link abre fora do app ("Abrir vídeo: <título>"). A posição na coleção fica num selo no
 * canto. O "Abrir no YouTube" saiu daqui para o ⋯ do cartão.
 */
export function CapaDoCartao({ videoUrl, titulo, capaId, numero, aoAbrirFora }: {
  videoUrl: string | null;
  titulo: string;
  capaId: string | null;
  numero?: number;
  aoAbrirFora: (url: string) => void;
}) {
  const { cores } = useTema();
  // Guarda QUAL vídeo foi tocado: outro link no mesmo cartão volta à capa, sem player montado sem toque.
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const id = idDoYoutube(videoUrl);
  const externo = id ? null : linkParaAbrir(videoUrl);
  const tocando = id !== null && tocandoId === id;
  return (
    <View style={[estilos.quadro, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      {tocando && id ? <PlayerDeVideo id={id} titulo={titulo} /> : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${id ? 'Assistir' : 'Abrir vídeo'}: ${titulo}`}
          disabled={!id && !externo}
          onPress={() => { if (id) setTocandoId(id); else if (externo) aoAbrirFora(externo); }}
          style={StyleSheet.absoluteFill}>
          {(estado) => (
            <>
              {capaId ? <ImagemDaCapa id={capaId} baixar={baixarCapaDaEquipe} /> : null}
              <View style={[estilos.centro, !capaId && sobre(estado) ? { backgroundColor: cores.sobre } : null]}>
                <View style={[estilos.play, { backgroundColor: sobre(estado) ? cores.superficie2 : cores.superficie, borderColor: cores.bordaCampo }]}>
                  <Play size={20} color={cores.texto} fill={cores.texto} aria-hidden />
                </View>
                {/* Sem capa (C24, também no claro): o título no poço diz que vídeo é. */}
                {!capaId ? <Texto variante="pequeno" numberOfLines={2} aria-hidden style={estilos.tituloSemCapa}>{titulo}</Texto> : null}
              </View>
            </>
          )}
        </Pressable>
      )}
      {numero && !tocando ? (
        <View pointerEvents="none" style={[estilos.selo, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>
          <Texto variante="pequeno" numerico cor={cores.texto} accessibilityLabel={`Posição ${numero}`} style={estilos.numero}>{String(numero)}</Texto>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  quadro: { width: '100%', aspectRatio: 16 / 9, borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  centro: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: espaco(1), padding: espaco(2) },
  play: { width: DIAMETRO_DO_PLAY, height: DIAMETRO_DO_PLAY, borderRadius: DIAMETRO_DO_PLAY / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  tituloSemCapa: { textAlign: 'center' },
  selo: { position: 'absolute', top: espaco(1), left: espaco(1), minWidth: 28, height: 28, paddingHorizontal: espaco(0.75), borderRadius: RAIO_CONTROLE, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: fontes.semi },
});
