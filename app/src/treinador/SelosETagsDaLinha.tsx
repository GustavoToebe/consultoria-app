import { Platform, StyleSheet, View } from 'react-native';

import type { TagDeAluno } from '../api/tipos';
import { dicaDoMaisTags, rotuloDoMaisTags, type SeloDeExcecao } from '../dominio/selosDaLinhaDeAluno';
import { resumoDasTagsNaLinha } from '../dominio/tagsDeAluno';
import { espaco } from '../tema/tokens';
import { Selo } from '../ui/Selo';
import { ChipDeTag } from './tags/ChipDeTag';

/**
 * Embaixo do nome do aluno: o selo de situação e as tags na MESMA linha, lado a lado (o selo primeiro); se não couberem,
 * quebram para a linha seguinte, nunca um por linha. No máximo duas tags e "+N" (`resumoDasTagsNaLinha`): o "+N" mostra as
 * outras num tooltip (`title`, só na web, como a `LinhaDeDado`) e tem o nome acessível "Mais N tags: A, B"; no celular, sem
 * hover, o que falta fica no nome acessível da linha. Os chips são decorativos (o link da linha já os nomeia).
 */
export function SelosETagsDaLinha({ selos, tags }: { selos: readonly SeloDeExcecao[]; tags: readonly TagDeAluno[] }) {
  if (!selos.length && !tags.length) return null;
  const { visiveis, texto } = resumoDasTagsNaLinha(tags);
  const dica = dicaDoMaisTags(tags);
  // O react-native-web não repassa `title`: vai direto no elemento.
  const comDica = (el: View | null) => {
    if (dica && Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', dica);
  };
  return (
    <View style={estilos.linha}>
      {selos.map((s) => <Selo key={s.texto} texto={s.texto} tipo={s.tipo} />)}
      {visiveis.map((t) => <View key={t.id} aria-hidden><ChipDeTag tag={t} larguraMaxima={140} /></View>)}
      {texto ? (
        <View ref={comDica} accessible accessibilityRole="text" accessibilityLabel={rotuloDoMaisTags(tags) ?? texto}>
          <Selo texto={texto} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
});
