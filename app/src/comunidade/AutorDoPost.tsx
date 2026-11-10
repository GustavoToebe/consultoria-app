import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PostDoMural } from '../api/comunidadeTipos';
import { dataHoraParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { IniciaisDePerfil } from '../ui/FotoDePerfil';
import { Selo } from '../ui/Selo';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * Cabeçalho do post no mural (aluno e equipe): iniciais, nome e sobrenome e, ao lado, o apelido em texto suave entre
 * aspas (nunca no lugar do nome), "Fixado" e a data. Com `aoAbrirPerfil`, iniciais e nome viram um botão só (alvo de
 * 44 px, foco do `global.css`) que abre o perfil do colega; sem ele, nada é tocável. `acao` fica no fim da linha.
 */
export function AutorDoPost({ post, aoAbrirPerfil, acao }: {
  post: Pick<PostDoMural, 'autorNome' | 'autorApelido' | 'fixado' | 'criadoEm'>;
  aoAbrirPerfil?: () => void;
  acao?: ReactNode;
}) {
  const { cores } = useTema();
  const identidade = (
    <>
      <IniciaisDePerfil nome={post.autorNome} tamanho={36} />
      <View style={estilos.encolher}>
        <View style={estilos.linha}>
          <Texto variante="bloco" nivel={3}>{post.autorNome}</Texto>
          {post.autorApelido ? <Texto variante="suave" accessibilityLabel={`apelido ${post.autorApelido}`}>«{post.autorApelido}»</Texto> : null}
        </View>
        <Texto variante="pequeno" cor={cores.textoSuave} numerico>{dataHoraParaTela(post.criadoEm)}</Texto>
      </View>
    </>
  );
  return (
    <View style={estilos.linha}>
      {aoAbrirPerfil ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil de ${post.autorNome}`} onPress={aoAbrirPerfil}
          style={(estado) => [estilos.linha, estilos.identidade, estilos.tocavel, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
          {identidade}
        </Pressable>
      ) : <View style={[estilos.linha, estilos.identidade]}>{identidade}</View>}
      {post.fixado ? <Selo texto="Fixado" tipo="neutro" /> : null}
      {acao}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  encolher: { flex: 1, minWidth: 0, gap: 2 },
  // Base de 180 px: no celular a `acao` desce para a linha de baixo em vez de espremer o nome.
  identidade: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  // Nunca abaixo do alvo de toque; o fundo do toque usa o mesmo raio dos cartões.
  tocavel: { minHeight: ALVO_TOQUE, borderRadius: RAIO, flexWrap: 'nowrap' },
});
