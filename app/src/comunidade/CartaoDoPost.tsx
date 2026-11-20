import { Ellipsis, Megaphone, MessageSquare, Pin, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CodigoDeReacao, PostDoMural } from '../api/comunidadeTipos';
import { rotuloDoTipo, textoDasDenuncias, textoDeComentarios } from '../dominio/comunidade';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { IconeBotao } from '../ui/IconeBotao';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { Selo } from '../ui/Selo';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { AutorDoPost } from './AutorDoPost';
import { BlocoDaEnquete } from './BlocoDaEnquete';
import { BotoesDeReacao } from './BotoesDeReacao';
import { CapaDoVideo } from './CapaDoVideo';

/**
 * Um post do mural (aluno e equipe). O tipo vai num selo ao lado da data (só o Aviso se destaca), com "Fixado" junto
 * quando fixado (D5, 19/11); os comentários em frase ("Nenhum comentário", "2 comentários"). "Respondida" na dúvida que a
 * equipe respondeu; o número de denúncias só para a equipe (`post.denuncias`). O vídeo é o texto como título e a
 * `CapaDoVideo` (player só depois do toque, "Abrir no YouTube" sempre); a enquete, a pergunta como título e o
 * `BlocoDaEnquete`. Fotos e capa só pela rota com token. `grupo` (só a equipe) = nome do pod do post, num selo neutro.
 */
export function CartaoDoPost({
  post, baixarFoto, baixarCapa, aoAbrirPerfil, aoReagir, ocupado, aoComentarios, aoAbrirMenu, aoAbrirFora,
  aoVotar, motivoDoVoto, aoMostrarVotos, baixarFotoDoVotante, grupo,
}: {
  post: PostDoMural;
  baixarFoto: (id: string) => Promise<Blob>;
  baixarCapa: (id: string) => Promise<Blob>;
  aoAbrirPerfil?: () => void;
  /** Sem isso, as reações ficam só para leitura (quem não pode reagir). */
  aoReagir?: (codigo: CodigoDeReacao, ligar: boolean) => void;
  /** Um pedido deste post (reação ou voto) em curso: trava os dois até a resposta. */
  ocupado?: boolean;
  aoComentarios: () => void;
  /** Sem isso, o ⋯ não aparece (nenhuma ação para quem vê). */
  aoAbrirMenu?: () => void;
  aoAbrirFora: (url: string) => void;
  /** Sem isso, a enquete mostra só o resultado. */
  aoVotar?: (opcaoIds: string[]) => void;
  /** Por que não dá para votar agora (sem internet); a enquete encerrada já diz o dela. */
  motivoDoVoto?: string;
  aoMostrarVotos: () => void;
  baixarFotoDoVotante: (autorId: string) => Promise<Blob>;
  grupo?: string;
}) {
  const { cores } = useTema();
  const video = post.tipo === 'VIDEO';
  const enquete = post.tipo === 'ENQUETE' ? post.enquete ?? null : null;
  const denuncias = post.denuncias ?? 0;
  return (
    <Cartao>
      <AutorDoPost post={post} aoAbrirPerfil={aoAbrirPerfil} acao={aoAbrirMenu ? (
        <IconeBotao Icone={Ellipsis} rotulo={`Ações da publicação de ${post.autorNome}`} aoTocar={aoAbrirMenu} />
      ) : undefined} selos={<>
        {post.tipo === 'AVISO'
          ? <Selo texto="Aviso" tipo="atencao" Icone={Megaphone} />
          : <Selo texto={rotuloDoTipo(post.tipo)} tipo="neutro" />}
        {post.fixado ? <Selo texto="Fixado" tipo="neutro" Icone={Pin} /> : null}
      </>} />

      {grupo || (post.tipo === 'DUVIDA' && post.respondida) || denuncias > 0 ? (
        <View style={estilos.linha}>
          {grupo ? <Selo texto={`Grupo: ${grupo}`} tipo="neutro" Icone={Users} /> : null}
          {post.tipo === 'DUVIDA' && post.respondida ? <Selo texto="Respondida" tipo="sucesso" /> : null}
          {denuncias > 0 ? <Selo texto={textoDasDenuncias(denuncias)} tipo="perigo" /> : null}
        </View>
      ) : null}

      {video || enquete ? <Texto variante="bloco" nivel={3}>{post.texto}</Texto> : <Texto>{post.texto}</Texto>}
      {video ? (
        <CapaDoVideo videoUrl={post.videoUrl} titulo={post.texto} capaId={post.capaId ?? null} baixarCapa={baixarCapa} aoAbrirFora={aoAbrirFora} />
      ) : null}
      {enquete ? (
        <BlocoDaEnquete postId={post.id} enquete={enquete} aoVotar={aoVotar} motivo={motivoDoVoto} ocupado={ocupado}
          aoMostrarVotos={aoMostrarVotos} baixarFotoDoVotante={baixarFotoDoVotante} />
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
        <BotoesDeReacao post={post} aoReagir={aoReagir} ocupado={ocupado} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver comentários: ${textoDeComentarios(post.totalComentarios)}`}
          onPress={aoComentarios}
          style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.sobre }]}>
          <MessageSquare size={18} color={cores.texto} aria-hidden />
          <Texto variante="suave" cor={cores.texto}>{textoDeComentarios(post.totalComentarios)}</Texto>
        </Pressable>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  rodape: { borderTopWidth: 1, paddingTop: espaco(1), columnGap: espaco(2), rowGap: espaco(0.5) },
  // Hover e pressionado pintam `sobre` (`ui/sobre`); o respiro e o raio dão forma ao fundo.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
});
