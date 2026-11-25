import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import type { MembroEquipe, PerfilEquipe } from '../../api/equipeTipos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { textoDoEnvio } from './convitesEPerfis';

/** ~360 px ao lado da tabela, com o vão do Mural (32, o dobro do de dentro dos cartões). */
export const LARGURA_DA_LATERAL = 360;
export const VAO_DA_LATERAL = 32;

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo do `MuralComLateral`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), overflowY: 'auto' } : {}) as unknown as ViewStyle;

/**
 * Coluna ao lado da tabela de Membros, da faixa larga em diante (24/11): "Convites pendentes" (saem da tabela, sem
 * duplicar) e "Equipe por perfil", que filtra a tabela pelo perfil tocado (o chip aparece em "Filtrando:"). Grudada ao
 * rolar na web, como a do Mural. As ações dos convites vêm de quem chama (as mesmas da lista: Renovar e Cancelar).
 */
export function LateralDosMembros({ convites, acoesDoConvite, contagens, perfilFiltrado, aoTocarPerfil }: {
  convites: readonly MembroEquipe[];
  acoesDoConvite: (m: MembroEquipe) => ReactNode;
  contagens: readonly { perfil: PerfilEquipe; total: number }[];
  /** O perfil quando a tabela está filtrada só por ele (o item fica marcado). */
  perfilFiltrado: string | null;
  aoTocarPerfil: (id: string) => void;
}) {
  const janela = useWindowDimensions();
  return (
    <View testID="lateral-dos-membros" role="complementary" aria-label="Convites e perfis da equipe"
      style={[estilos.lateral, GRUDADA, Platform.OS === 'web' && { maxHeight: janela.height - espaco(4) }]}>
      <Cartao titulo="Convites pendentes">
        {convites.length ? (
          <View style={estilos.lista}>
            {convites.map((m) => (
              <View key={m.id} style={estilos.convite}>
                <Texto style={estilos.nome} numberOfLines={1}>{m.nome || m.email}</Texto>
                {m.nome ? <Texto variante="suave" numberOfLines={1}>{m.email}</Texto> : null}
                <Texto variante="pequeno">{`${m.perfilNome} · ${textoDoEnvio(m.conviteExpiraEm)}`}</Texto>
                <View style={estilos.acoes}>{acoesDoConvite(m)}</View>
              </View>
            ))}
          </View>
        ) : <Texto variante="suave">Nenhum convite pendente</Texto>}
      </Cartao>
      <Cartao titulo="Equipe por perfil" descricao="Toque num perfil para filtrar a tabela.">
        <View style={estilos.perfis}>
          {contagens.map(({ perfil, total }) => (
            <ItemDoPerfil key={perfil.id} nome={perfil.nome} total={total} marcado={perfilFiltrado === perfil.id} aoTocar={() => aoTocarPerfil(perfil.id)} />
          ))}
        </View>
      </Cartao>
    </View>
  );
}

function ItemDoPerfil({ nome, total, marcado, aoTocar }: { nome: string; total: number; marcado: boolean; aoTocar: () => void }) {
  const { cores } = useTema();
  const membros = total === 1 ? '1 membro' : `${total} membros`;
  return (
    <Pressable accessibilityRole="button" aria-pressed={marcado}
      accessibilityLabel={`${nome} · ${membros}`} accessibilityHint={marcado ? 'Tira o filtro deste perfil.' : 'Filtra a tabela por este perfil.'}
      onPress={aoTocar}
      style={(estado) => [estilos.item, { borderColor: marcado ? cores.bordaCampo : 'transparent' }, (marcado || sobre(estado)) && { backgroundColor: cores.sobre }]}>
      <Texto style={[estilos.nomeDoPerfil, marcado && estilos.nome]} numberOfLines={1}>{nome}</Texto>
      <Texto numerico cor={cores.texto} style={estilos.total}>{String(total)}</Texto>
      <View style={estilos.marca}>{marcado ? <Check size={16} color={cores.texto} strokeWidth={2.5} /> : null}</View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  lateral: { width: LARGURA_DA_LATERAL, flexShrink: 0, alignSelf: 'flex-start', gap: espaco(3) },
  lista: { gap: espaco(2) },
  convite: { gap: 2 },
  nome: { fontFamily: fontes.medio },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), marginTop: espaco(1) },
  perfis: { gap: espaco(0.5) },
  // Margem negativa: o texto fica na borda do título do cartão e o realce do hover sai um pouco para os lados.
  item: {
    minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderRadius: RAIO,
    paddingHorizontal: espaco(1), marginHorizontal: -espaco(1),
  },
  nomeDoPerfil: { flex: 1, minWidth: 0 },
  total: { fontFamily: fontes.semi },
  marca: { width: 16, alignItems: 'center' },
});
