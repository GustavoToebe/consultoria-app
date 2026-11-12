import { PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { linkParaAbrir } from '../dominio/links';
import { espaco } from '../tema/tokens';
import { abrirLinkExterno } from '../ui/abrirLinkExterno';
import { Botao } from '../ui/Botao';
import { Alerta } from '../ui/Estados';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import type { VideoDaAjuda } from './videos';

/**
 * Vídeos de uma seção da Ajuda: um botão por vídeo, que abre fora do app (sem token). Sem vídeo com link https, não
 * aparece nada (recurso que não existe não aparece; nada de "em breve").
 */
export function VideosDaSecao({ videos }: { videos: readonly VideoDaAjuda[] | undefined }) {
  const [falhou, setFalhou] = useState(false);
  const validos = (videos ?? []).filter((v) => linkParaAbrir(v.url));
  if (!validos.length) return null;
  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo">{`${validos.length === 1 ? 'Vídeo' : 'Vídeos'} (abre fora do app)`}</Texto>
      <LinhaDeAcoes>
        {validos.map((v) => (
          <Botao key={v.url} tipo="secundario" Icone={PlayCircle}
            rotulo={v.duracao ? `${v.titulo} · ${v.duracao}` : v.titulo}
            rotuloAcessivel={`Assistir: ${v.titulo}${v.duracao ? `, ${v.duracao}` : ''}. Abre fora do app.`}
            aoTocar={() => void abrirLinkExterno(v.url).then((ok) => setFalhou(!ok))} />
        ))}
      </LinhaDeAcoes>
      {falhou ? <Alerta tom="perigo" texto="Não foi possível abrir o vídeo. Tente de novo." /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
});
