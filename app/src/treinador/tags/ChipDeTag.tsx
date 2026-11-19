import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { TagDeAluno } from '../../api/tipos';
import { resumoDasTagsNaLinha } from '../../dominio/tagsDeAluno';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

/**
 * A tag como pílula de identificação (`docs/design-e-front.md` 4.5, família "Identificação"; o mesmo desenho do `Selo
 * categoria`): texto na cor da tag sobre o fundo tingido dela (`useTema().identificacao`, ≥ 4,5:1 em `tokens.test.ts`). O
 * nome está sempre escrito: a cor só diz qual é, nunca sozinha. Nome comprido corta numa linha (o nome inteiro vai no
 * nome acessível de quem usa). Com `aoRemover`, o X "Remover tag <nome>" tem alvo de 44 px (o desenho fica na pílula).
 */
export function ChipDeTag({ tag, aoRemover, desabilitado, larguraMaxima = 180 }: {
  tag: TagDeAluno; aoRemover?: () => void; desabilitado?: boolean; larguraMaxima?: number;
}) {
  const { identificacao } = useTema();
  const { cor, fundo } = identificacao[tag.cor] ?? identificacao.AZUL;
  return (
    <View style={[estilos.pilula, aoRemover ? estilos.removivel : null, { backgroundColor: fundo, maxWidth: larguraMaxima }]}>
      <Texto numberOfLines={1} style={[aoRemover ? estilos.textoMaior : estilos.texto, { color: cor }]}>{tag.nome}</Texto>
      {aoRemover ? (
        <View style={estilos.remover}>
          <IconeBotao Icone={X} compacto cor={cor} rotulo={`Remover tag ${tag.nome}`} desabilitado={desabilitado} aoTocar={aoRemover} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * As tags na linha da lista de alunos: no máximo duas e "+N" (`resumoDasTagsNaLinha`). Decorativo para o leitor de tela:
 * o link da linha já diz "Tags: A, B e mais 2".
 */
export function TagsNaLinha({ tags }: { tags: readonly TagDeAluno[] }) {
  if (!tags.length) return null;
  const { visiveis, texto } = resumoDasTagsNaLinha(tags);
  return (
    <View style={estilos.linha} aria-hidden>
      {visiveis.map((t) => <ChipDeTag key={t.id} tag={t} larguraMaxima={140} />)}
      {texto ? <Selo texto={texto} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pilula: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 22, borderRadius: 999, paddingHorizontal: espaco(1), paddingVertical: 1 },
  // Removível: 32 px de desenho; o X (alvo de 44) sobra 6 px para cima e para baixo, sem mexer na altura da pílula.
  removivel: { minHeight: 32, paddingLeft: espaco(1.5), paddingRight: 0 },
  remover: { marginVertical: -6, marginLeft: -espaco(0.5) },
  texto: { fontFamily: fontes.medio, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  textoMaior: { fontFamily: fontes.medio, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
});
