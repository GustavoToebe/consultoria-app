import { Image } from 'expo-image';
import { ExternalLink, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { idDoYoutube, urlNoYoutube } from '../dominio/comunidade';
import { linkParaAbrir } from '../dominio/links';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { enderecoDaImagem } from '../ui/ImagemProtegida';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { PlayerDeVideo } from './PlayerDeVideo';

/**
 * Vídeo de um post ou aulão (D7 e D8). Antes do toque, só a nossa capa (bytes pela API com o token, nunca imagem de fora) e
 * "Assistir aqui"; o player do YouTube só monta depois do toque, no mesmo quadro 16:9. Sem id do YouTube não há player: o
 * mesmo quadro (com a capa, se houver) tem "Abrir vídeo" como alvo, que abre fora do app. No YouTube, "Abrir no YouTube"
 * fica sempre abaixo, montado pelo id (fora do app, sem token).
 */
export function CapaDoVideo({ videoUrl, titulo, capaId, baixarCapa, aoAbrirFora }: {
  videoUrl: string | null;
  /** O que o vídeo é (texto do post ou título do aulão): nome do player e dos botões. */
  titulo: string;
  capaId: string | null;
  baixarCapa: (id: string) => Promise<Blob>;
  aoAbrirFora: (url: string) => void;
}) {
  const { cores } = useTema();
  // Guarda QUAL vídeo foi tocado: outro link no mesmo componente volta à capa, sem player montado sem toque.
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const id = idDoYoutube(videoUrl);
  const tocando = id !== null && tocandoId === id;
  const externo = id ? urlNoYoutube(id) : linkParaAbrir(videoUrl);
  if (!id && !externo) return null;
  return (
    <View style={estilos.bloco}>
      <View style={[estilos.quadro, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
        {id && tocando ? <PlayerDeVideo id={id} titulo={titulo} /> : (
          <>
            {capaId ? <ImagemDaCapa id={capaId} baixar={baixarCapa} /> : null}
            {/* Link que não é do YouTube: a capa também aparece, mas o alvo abre fora do app (sem player). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${id ? 'Assistir aqui' : 'Abrir vídeo'}: ${titulo}`}
              onPress={() => { if (id) setTocandoId(id); else if (externo) aoAbrirFora(externo); }}
              style={estilos.alvo}>
              {(estado) => (
                <View style={[estilos.pilula, {
                  backgroundColor: sobre(estado) ? cores.superficie2 : cores.superficie, borderColor: cores.bordaCampo,
                }]}>
                  {id
                    ? <Play size={18} color={cores.texto} fill={cores.texto} aria-hidden />
                    : <ExternalLink size={18} color={cores.texto} aria-hidden />}
                  <Texto cor={cores.texto} style={{ fontFamily: fontes.semi }}>{id ? 'Assistir aqui' : 'Abrir vídeo'}</Texto>
                </View>
              )}
            </Pressable>
          </>
        )}
      </View>
      {id && externo ? (
        <LinhaDeAcoes>
          <Botao rotulo="Abrir no YouTube" rotuloAcessivel={`Abrir no YouTube: ${titulo}`}
            tipo="secundario" Icone={ExternalLink} aoTocar={() => aoAbrirFora(externo)} />
        </LinhaDeAcoes>
      ) : null}
    </View>
  );
}

/** A capa é decorativa (o botão diz o que é); se não carregar, fica o quadro neutro, sem erro na tela. */
function ImagemDaCapa({ id, baixar }: { id: string; baixar: (id: string) => Promise<Blob> }) {
  const [endereco, setEndereco] = useState<string | null>(null);
  const baixarAtual = useRef(baixar);
  useEffect(() => {
    baixarAtual.current = baixar;
  });
  // O blob é revogado também quando a capa troca ou o componente sai antes de a resposta chegar (não passa pelo useCarregar).
  useEffect(() => {
    let vivo = true;
    let criado: string | null = null;
    const soltar = (url: string) => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
    baixarAtual.current(id).then(enderecoDaImagem).then((url) => {
      if (!vivo) { soltar(url); return; }
      criado = url;
      setEndereco(url);
    }).catch(() => undefined);
    return () => {
      vivo = false;
      if (criado) soltar(criado);
      setEndereco(null);
    };
  }, [id]);
  if (!endereco) return null;
  return <Image source={{ uri: endereco }} cachePolicy="none" contentFit="cover" style={StyleSheet.absoluteFill} aria-hidden accessible={false} />;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  quadro: { width: '100%', aspectRatio: 16 / 9, borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  alvo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pilula: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(2),
    borderRadius: ALVO_TOQUE / 2, borderWidth: 1,
  },
});
