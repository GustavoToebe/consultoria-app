import { Image } from 'expo-image';
import { ExternalLink, Play, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { idDoYoutube, urlNoYoutube } from '../../dominio/comunidade';
import { erroDoVideo, videoValido } from '../../dominio/video';
import { PlayerDeVideo } from '../../comunidade/PlayerDeVideo';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { AREA_DA_MIDIA_MINIMA } from './areaDaMidia';

/** Miniatura pública do YouTube pelo id (sem token nem cookie nosso). */
export const miniaturaDoYoutube = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const DICA_DO_VIDEO = 'Cole o link do vídeo (youtube.com ou youtu.be)';

/**
 * "Vídeo" na folha do exercício, ao lado de "Imagem ou GIF" e com a área da mesma altura (`altura`, calculada pela folha).
 * Vazio: área tracejada com o play, o campo "Link do YouTube" dentro e a dica; link inválido = o erro no campo. Com link do
 * YouTube reconhecido e o campo sem foco: a prévia ocupa a área (miniatura do YouTube ou, se não carregar, um cartão neutro com o play; tocar
 * toca aqui, no player sem cookie `youtube-nocookie.com`, montado só depois do toque) e, embaixo, "Abrir no YouTube" (fora
 * do app, sem token) e "Remover vídeo" (só limpa; vale ao salvar), na mesma linha dos botões da imagem. Link https do
 * YouTube sem id de vídeo (um canal): fica o campo, com as duas ações embaixo.
 */
export function VideoDoExercicioEditor({ valor, aoMudar, erroDaApi, nome, altura }: {
  valor: string; aoMudar: (v: string) => void; erroDaApi?: string | null; nome: string;
  /** Altura da área, igual à da imagem; sem medida ainda, a mínima. */
  altura?: number;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const campo = useRef<TextInput>(null);
  const link = valor.trim();
  const valido = !!link && videoValido(link);
  const id = valido ? idDoYoutube(link) : null;
  const externo = id ? urlNoYoutube(id) : valido ? link : null;
  // Enquanto o campo tem o foco a prévia espera: colar o link e seguir digitando ("?t=30") não pode tirar o campo de baixo
  // do cursor. Ao sair do campo (Tab vai ao "Abrir no YouTube", que já está embaixo) a prévia entra no lugar dele.
  const [digitando, setDigitando] = useState(false);
  const comPrevia = !!id && !digitando;
  const abrir = () => {
    if (!externo) return;
    void abrirLinkExterno(externo).then((ok) => { if (!ok) avisar('Não foi possível abrir o vídeo.', 'perigo'); });
  };
  const remover = () => {
    aoMudar('');
    // O botão some com a prévia: o foco vai ao campo que volta, em vez de cair no começo da página.
    if (Platform.OS === 'web') requestAnimationFrame(() => campo.current?.focus());
  };
  const tamanho = { minHeight: altura ?? AREA_DA_MIDIA_MINIMA };
  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo" cor={cores.texto}>Vídeo</Texto>
      {comPrevia && id ? (
        <PreviaDoVideo key={id} id={id} nome={nome} altura={altura} />
      ) : (
        <View style={[estilos.area, tamanho, { borderColor: cores.bordaCampo, backgroundColor: cores.superficie2 }]}>
          <View aria-hidden style={[estilos.play, { borderColor: cores.bordaCampo, backgroundColor: cores.superficie }]}>
            <Play size={16} color={cores.textoSuave} fill={cores.textoSuave} />
          </View>
          <View style={estilos.campo}>
            <Campo ref={campo} rotulo="Link do YouTube" valor={valor} aoMudar={aoMudar} erro={erroDaApi ?? erroDoVideo(valor)} ajuda={DICA_DO_VIDEO}
              placeholder="https://youtu.be/…" autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off"
              keyboardType="url" inputMode="url" maxLength={500} onFocus={() => setDigitando(true)} onBlur={() => setDigitando(false)} />
          </View>
        </View>
      )}
      {externo ? (
        <LinhaDeAcoes>
          <Botao rotulo="Abrir no YouTube" rotuloAcessivel={nome ? `Abrir no YouTube: ${nome}` : undefined} tipo="secundario" Icone={ExternalLink} aoTocar={abrir} />
          <Botao rotulo="Remover vídeo" tipo="perigo" Icone={Trash2} aoTocar={remover} />
        </LinhaDeAcoes>
      ) : null}
      {/* Com a prévia o campo sai: um erro da API sobre o link aparece aqui, embaixo das ações. */}
      {comPrevia && erroDaApi ? <MensagemDeErro erro={erroDaApi} /> : null}
    </View>
  );
}

/** A miniatura (ou o cartão neutro) com o play na altura da área; tocar monta o player no mesmo quadro. `key` = id do vídeo. */
function PreviaDoVideo({ id, nome, altura }: { id: string; nome: string; altura?: number }) {
  const { cores } = useTema();
  const [falhou, setFalhou] = useState(false);
  const [tocando, setTocando] = useState(false);
  const titulo = nome.trim() || 'Vídeo do exercício';
  return (
    <View style={[estilos.quadro, altura ? { height: altura } : estilos.dezesseisPorNove, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
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
  // Mesmo traço da área vazia da imagem (2 px tracejado, cantos do cartão); o conteúdo fica no meio.
  area: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: espaco(1),
    padding: espaco(1.5), borderWidth: 2, borderStyle: 'dashed', borderRadius: RAIO,
  },
  play: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  campo: { alignSelf: 'stretch' },
  quadro: { width: '100%', borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  dezesseisPorNove: { aspectRatio: 16 / 9 },
  alvo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pilula: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: 44, paddingHorizontal: espaco(2), borderWidth: 1, borderRadius: 999 },
  rotulo: { fontFamily: fontes.semi },
});
