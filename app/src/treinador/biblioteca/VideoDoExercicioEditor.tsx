import { Image } from 'expo-image';
import { ExternalLink, Play, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { idDoYoutube, urlNoYoutube } from '../../dominio/comunidade';
import { erroDoVideo, videoValido } from '../../dominio/video';
import { PlayerDeVideo } from '../../comunidade/PlayerDeVideo';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** Miniatura pública do YouTube pelo id (sem token nem cookie nosso). */
export const miniaturaDoYoutube = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/**
 * "Vídeo" na folha do exercício: o campo do link e, com link válido, a prévia 16:9 e "Abrir no YouTube" (fora do app, sem
 * token) e "Remover vídeo" (só limpa o campo; vale ao salvar). A miniatura vem do YouTube; se não carregar (CSP sem o host
 * em `img-src`, sem internet), fica um cartão neutro com o play. Tocar na prévia toca aqui, no player sem cookie
 * (`youtube-nocookie.com`, montado só depois do toque), como na Comunidade. Link inválido: só o erro, sem prévia.
 */
export function VideoDoExercicioEditor({ valor, aoMudar, erroDaApi, nome }: {
  valor: string; aoMudar: (v: string) => void; erroDaApi?: string | null; nome: string;
}) {
  const { avisar } = useAviso();
  const link = valor.trim();
  const valido = !!link && videoValido(link);
  const id = valido ? idDoYoutube(link) : null;
  const externo = id ? urlNoYoutube(id) : valido ? link : null;
  const abrir = () => {
    if (!externo) return;
    void abrirLinkExterno(externo).then((ok) => { if (!ok) avisar('Não foi possível abrir o vídeo.', 'perigo'); });
  };
  return (
    <View style={estilos.bloco}>
      <Campo rotulo="Vídeo" valor={valor} aoMudar={aoMudar} placeholder="Link do YouTube (opcional)" erro={erroDaApi ?? erroDoVideo(valor)}
        autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" keyboardType="url" inputMode="url" maxLength={500} />
      {id ? <PreviaDoVideo key={id} id={id} nome={nome} /> : null}
      {externo ? (
        <LinhaDeAcoes>
          <Botao rotulo="Abrir no YouTube" rotuloAcessivel={nome ? `Abrir no YouTube: ${nome}` : undefined} tipo="secundario" Icone={ExternalLink} aoTocar={abrir} />
          <Botao rotulo="Remover vídeo" tipo="perigoTexto" Icone={Trash2} aoTocar={() => aoMudar('')} />
        </LinhaDeAcoes>
      ) : null}
    </View>
  );
}

/** Quadro 16:9: a miniatura (ou o cartão neutro) com o play; tocar monta o player no mesmo quadro. `key` = id do vídeo. */
function PreviaDoVideo({ id, nome }: { id: string; nome: string }) {
  const { cores } = useTema();
  const [falhou, setFalhou] = useState(false);
  const [tocando, setTocando] = useState(false);
  const titulo = nome.trim() || 'Vídeo do exercício';
  return (
    <View style={[estilos.quadro, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
      {tocando ? <PlayerDeVideo id={id} titulo={titulo} /> : (
        <>
          {falhou ? null : (
            <Image source={{ uri: miniaturaDoYoutube(id) }} accessibilityLabel={`Miniatura do vídeo: ${titulo}`} contentFit="cover"
              cachePolicy="none" onError={() => setFalhou(true)} style={StyleSheet.absoluteFill} />
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={`Assistir aqui: ${titulo}`} onPress={() => setTocando(true)} style={estilos.alvo}>
            {(estado) => (
              <View style={[estilos.pilula, { backgroundColor: sobre(estado) ? cores.superficie2 : cores.superficie, borderColor: cores.bordaCampo }]}>
                <Play size={18} color={cores.texto} fill={cores.texto} aria-hidden />
                <Texto cor={cores.texto} style={estilos.rotulo}>Assistir aqui</Texto>
              </View>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  quadro: { width: '100%', aspectRatio: 16 / 9, borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  alvo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pilula: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: 44, paddingHorizontal: espaco(2), borderWidth: 1, borderRadius: 999 },
  rotulo: { fontFamily: fontes.semi },
});
