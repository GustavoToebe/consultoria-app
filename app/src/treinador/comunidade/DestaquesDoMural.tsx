import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PostDoMural } from '../../api/comunidadeTipos';
import { textoDosParticipantes } from '../../dominio/comunidade';
import { dataHoraParaTela } from '../../dominio/formatos';
import type { DestaquesDoMural as Destaques } from '../../dominio/muralEmAbas';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

const DICA = 'Mostra a publicação no mural.';

/**
 * "Fixados" e "Enquetes abertas" do mural da equipe (D5, 19/11), compactos: cada item é um botão que leva à publicação
 * (`aoIr`). Na coluna da direita (área larga) ou no topo do feed; bloco vazio some, e sem nenhum o componente não desenha
 * nada. `comFixados` falso (aba Alunos) mostra só as enquetes. O texto inteiro do item é o nome do botão.
 */
export function DestaquesDoMural({ destaques, comFixados, aoIr }: {
  destaques: Destaques;
  comFixados: boolean;
  aoIr: (post: PostDoMural) => void;
}) {
  const fixados = comFixados ? destaques.fixados : [];
  const { enquetes } = destaques;
  if (!fixados.length && !enquetes.length) return null;
  return (
    <>
      {fixados.length ? (
        <Cartao titulo="Fixados">
          <View style={estilos.lista}>
            {fixados.map((p) => (
              <Item key={p.id} aoTocar={() => aoIr(p)}>
                <Texto variante="pequeno" style={estilos.autor} numberOfLines={1}>{p.autorNome}</Texto>
                <Texto numberOfLines={2}>{p.texto}</Texto>
              </Item>
            ))}
            {comFixados && destaques.fixadosAMais ? <Mais texto={destaques.fixadosAMais === 1 ? 'Mais 1 fixado no mural.' : `Mais ${destaques.fixadosAMais} fixados no mural.`} /> : null}
          </View>
        </Cartao>
      ) : null}
      {enquetes.length ? (
        <Cartao titulo="Enquetes abertas">
          <View style={estilos.lista}>
            {enquetes.map((p) => (
              <Item key={p.id} aoTocar={() => aoIr(p)}>
                <Texto numberOfLines={2} style={estilos.pergunta}>{p.texto}</Texto>
                {/* Uma linha cada: juntas, na coluna de 340 px, "3 pessoas votaram" quebrava no meio. */}
                {p.enquete?.encerraEm ? <Texto variante="pequeno">{`Encerra em ${dataHoraParaTela(p.enquete.encerraEm)}`}</Texto> : null}
                <Texto variante="pequeno">{textoDosParticipantes(p.enquete?.participantes ?? 0)}</Texto>
              </Item>
            ))}
            {destaques.enquetesAMais ? <Mais texto={destaques.enquetesAMais === 1 ? 'Mais 1 enquete aberta no mural.' : `Mais ${destaques.enquetesAMais} enquetes abertas no mural.`} /> : null}
          </View>
        </Cartao>
      ) : null}
    </>
  );
}

function Item({ aoTocar, children }: { aoTocar: () => void; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <Pressable accessibilityRole="button" accessibilityHint={DICA} onPress={aoTocar}
      style={(estado) => [estilos.item, sobre(estado) && { backgroundColor: cores.sobre }]}>
      {children}
    </Pressable>
  );
}

const Mais = ({ texto }: { texto: string }) => <Texto variante="pequeno" style={estilos.mais}>{texto}</Texto>;

const estilos = StyleSheet.create({
  lista: { gap: espaco(0.5) },
  // O fundo do hover usa o mesmo raio dos cartões; a margem negativa deixa o texto na borda do título do cartão.
  item: { minHeight: ALVO_TOQUE, justifyContent: 'center', gap: 2, borderRadius: RAIO, paddingVertical: espaco(1), paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
  autor: { fontFamily: fontes.semi },
  pergunta: { fontFamily: fontes.medio },
  mais: { paddingTop: espaco(0.5) },
});
