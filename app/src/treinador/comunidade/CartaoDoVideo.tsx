import { Ellipsis } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { AulaDaComunidade } from '../../api/comunidadeTipos';
import { textoDeComentarios } from '../../dominio/comunidade';
import { descricaoDoCartao } from '../../dominio/gradeDosVideos';
import { contornoDoCartao } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { AlcaDeArraste, type ArrasteDaLista } from '../../ui/ArrasteDaLista';
import { IconeBotao } from '../../ui/IconeBotao';
import { CaixaDaLinha } from '../../ui/LinhaDaLista';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { CapaDoCartao } from './CapaDoCartao';
import { rotuloDoMenuDoVideo } from './useVideosDaEquipe';

interface Props {
  aula: AulaDaComunidade;
  /** Posição na coleção ("1", "2"…), no selo da capa; ausente em "Sem coleção" (que não tem ordem). */
  numero?: number;
  /**
   * ⋯ do vídeo (Abrir no YouTube para todos; editar, mover e excluir só com `COMUNIDADE_MODERAR`); ausente quando não
   * haveria nada nele (só leitura e sem link que abra fora).
   */
  aoMenu?: () => void;
  aoComentarios: () => void;
  aoAbrirFora: (url: string) => void;
  /** Alça de arrastar dentro da coleção; ausente fora dela, sem permissão ou no modo Selecionar. */
  arraste?: { lista: ArrasteDaLista; indice: number };
  /** Modo Selecionar: a caixa toma o lugar do ⋯. */
  marcar?: { marcado: boolean; aoMudar: () => void };
  /** h3 dentro da seção da coleção (h2); h2 na grade plana, sem seções (coleções em erro). */
  nivel?: 2 | 3;
}

/** O título inteiro na dica do mouse (o react-native-web não repassa `title`; vai direto no elemento, como nos Números). */
const comDica = (titulo: string) => (el: View | null) => {
  if (Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', titulo);
};

/**
 * Cartão do vídeo na grade do treinador (D2, 19/11), de cima para baixo: capa 16:9 com o play e a posição no canto,
 * título em até 2 linhas (inteiro na dica e no nome acessível), descrição de apoio em até 2 linhas (some se repete o
 * título) e a linha de dados: comentários à esquerda e, à direita, a alça de arrastar e o ⋯. Cresce até a altura do
 * vizinho da linha, com a linha de dados embaixo.
 */
export function CartaoDoVideo({ aula, numero, aoMenu, aoComentarios, aoAbrirFora, arraste, marcar, nivel = 3 }: Props) {
  const { cores, bordas, preferencias } = useTema();
  const descricao = descricaoDoCartao(aula.titulo, aula.descricao);
  const comentarios = textoDeComentarios(aula.totalComentarios);
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: contornoDoCartao(cores, preferencias.contraste), borderWidth: bordas.bloco, boxShadow: cores.sombra }]}>
      <CapaDoCartao videoUrl={aula.videoUrl} titulo={aula.titulo} capaId={aula.capaId ?? null} numero={numero} aoAbrirFora={aoAbrirFora} />
      <View style={estilos.corpo}>
        <View ref={comDica(aula.titulo)}>
          <Texto variante="subtitulo" nivel={nivel} numberOfLines={2}>{aula.titulo}</Texto>
        </View>
        {descricao ? <Texto variante="suave" numberOfLines={2}>{descricao}</Texto> : null}
        {!aula.publicada ? <View style={estilos.selo}><Selo texto="Não publicado" tipo="neutro" /></View> : null}
      </View>
      <View style={estilos.dados}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver comentários do vídeo ${aula.titulo}: ${comentarios}`}
          onPress={aoComentarios}
          style={(estado) => [estilos.comentarios, sobre(estado) && { backgroundColor: cores.sobre }]}>
          <Texto variante="suave" cor={cores.texto} numberOfLines={1}>{comentarios}</Texto>
        </Pressable>
        <View style={estilos.acoes}>
          {marcar ? <CaixaDaLinha rotulo={`Selecionar ${aula.titulo}`} marcado={marcar.marcado} aoMudar={marcar.aoMudar} /> : (
            <>
              {arraste ? <AlcaDeArraste arraste={arraste.lista} indice={arraste.indice} /> : null}
              {aoMenu ? <IconeBotao Icone={Ellipsis} rotulo={rotuloDoMenuDoVideo(aula.titulo)} aoTocar={aoMenu} /> : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { flexGrow: 1, borderRadius: RAIO, overflow: 'hidden' },
  corpo: { gap: espaco(0.5), paddingHorizontal: espaco(1.5), paddingTop: espaco(1.5) },
  selo: { flexDirection: 'row', marginTop: espaco(0.5) },
  // `marginTop: auto`: na linha da grade os cartões têm a mesma altura e a linha de dados fica sempre embaixo.
  dados: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), paddingHorizontal: espaco(0.5) },
  comentarios: { flexShrink: 1, minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1), borderRadius: RAIO },
  acoes: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
});
