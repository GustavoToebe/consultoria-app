import { Ellipsis, Heart, Megaphone, MessageSquare, Video } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PostDoMural } from '../api/comunidadeTipos';
import { curtidoPorMim, rotuloDoTipo, textoDasDenuncias, totalDeCurtidas } from '../dominio/comunidade';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { IconeBotao } from '../ui/IconeBotao';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Selo } from '../ui/Selo';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { AutorDoPost } from './AutorDoPost';

/**
 * Um post do mural (aluno e equipe). O tipo vai num selo discreto; só o Aviso se destaca. "Respondida" na dúvida que a
 * equipe respondeu; o número de denúncias só para a equipe (`post.denuncias`). O vídeo é o texto como título e "Assistir",
 * que abre fora do app sem token (como os aulões, sem miniatura de fora). Fotos só pela rota com token (`baixarFoto`).
 */
export function CartaoDoPost({ post, baixarFoto, aoAbrirPerfil, aoCurtir, aoComentarios, aoAbrirMenu, aoAssistir }: {
  post: PostDoMural;
  baixarFoto: (id: string) => Promise<Blob>;
  aoAbrirPerfil?: () => void;
  /** Sem isso, a curtida não aparece (a equipe não reage). */
  aoCurtir?: () => void;
  aoComentarios: () => void;
  /** Sem isso, o ⋯ não aparece (nenhuma ação para quem vê). */
  aoAbrirMenu?: () => void;
  aoAssistir: (url: string | null) => void;
}) {
  const { cores } = useTema();
  const curtiu = curtidoPorMim(post);
  const video = post.tipo === 'VIDEO';
  const denuncias = post.denuncias ?? 0;
  return (
    <Cartao>
      <AutorDoPost post={post} aoAbrirPerfil={aoAbrirPerfil} acao={aoAbrirMenu ? (
        <IconeBotao Icone={Ellipsis} rotulo={`Ações da publicação de ${post.autorNome}`} aoTocar={aoAbrirMenu} />
      ) : undefined} />

      <View style={estilos.linha}>
        {post.tipo === 'AVISO'
          ? <Selo texto="Aviso" tipo="atencao" Icone={Megaphone} />
          : <Selo texto={rotuloDoTipo(post.tipo)} tipo="neutro" />}
        {post.tipo === 'DUVIDA' && post.respondida ? <Selo texto="Respondida" tipo="sucesso" /> : null}
        {denuncias > 0 ? <Selo texto={textoDasDenuncias(denuncias)} tipo="perigo" /> : null}
      </View>

      {video ? <Texto variante="bloco" nivel={3}>{post.texto}</Texto> : <Texto>{post.texto}</Texto>}
      {video ? (
        <LinhaDeAcoes>
          <Botao rotulo="Assistir" rotuloAcessivel={`Assistir: ${post.texto}`} tipo="secundario" Icone={Video} aoTocar={() => aoAssistir(post.videoUrl)} />
        </LinhaDeAcoes>
      ) : null}

      {post.fotos.length ? (
        <View style={estilos.fotos}>
          {post.fotos.map((id, i) => (
            <ImagemProtegida key={id} chave={`mural-foto:${id}`} carregar={() => baixarFoto(id)} tamanho={140}
              descricao={`Foto ${i + 1} de ${post.fotos.length} da publicação de ${post.autorNome}`} />
          ))}
        </View>
      ) : null}

      <View style={[estilos.linha, estilos.rodape, { borderTopColor: cores.divisor }]}>
        {aoCurtir ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={curtiu ? 'Desfazer curtida' : 'Curtir'}
            accessibilityState={{ selected: curtiu }}
            onPress={aoCurtir}
            style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
            <Heart size={18} color={cores.texto} fill={curtiu ? cores.texto : 'none'} aria-hidden />
            <Texto variante="suave" cor={cores.texto} numerico>{totalDeCurtidas(post)} curtida(s)</Texto>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver ${post.totalComentarios} comentário(s)`}
          onPress={aoComentarios}
          style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
          <MessageSquare size={18} color={cores.texto} aria-hidden />
          <Texto variante="suave" cor={cores.texto} numerico>{post.totalComentarios} comentário(s)</Texto>
        </Pressable>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  rodape: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(2) },
  // Hover e pressionado pintam `superficie3` (`ui/sobre`); o respiro e o raio dão forma ao fundo.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
});
