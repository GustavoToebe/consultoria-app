import { Award, ChevronRight, Medal } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ConquistaDoAluno, PosicaoNoRanking } from '../api/comunidadeTipos';
import { conquistasRecentes } from '../dominio/arranjoDoMural';
import { textoDaPosicao } from '../dominio/comunidade';
import { dataParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/** A posição do próprio aluno (só ele vê; nomes de outros alunos nunca chegam): a mesma linha na aba Conquistas e no mural. */
export function LinhaDaPosicao({ ranking }: { ranking: PosicaoNoRanking }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.item, estilos.linha, { backgroundColor: cores.superficie3, borderColor: cores.borda }]}>
      <Medal size={24} color={cores.texto} aria-hidden />
      <View style={estilos.encolher}>
        {/* Frases, não número solto: sem a fonte numérica (regra de 19/11). */}
        <Texto variante="bloco">{textoDaPosicao(ranking.posicao, ranking.participantes)}</Texto>
        <Texto variante="suave">{ranking.treinosConcluidos} treino(s) concluído(s) · {ranking.pontuacao} pts</Texto>
      </View>
    </View>
  );
}

/** Conquista em cartão (aba Conquistas): ícone, título, descrição, selo e data. */
export function CartaoDaConquista({ conquista }: { conquista: ConquistaDoAluno }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.item, estilos.conquista, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <Award size={24} color={cores.texto} aria-hidden />
      <Texto variante="bloco" nivel={3} style={estilos.centro}>{conquista.titulo}</Texto>
      <Texto variante="suave" style={estilos.centro}>{conquista.descricao}</Texto>
      <View style={estilos.seloCentral}>
        <Selo texto="Conquistada" tipo="neutro" />
      </View>
      <Texto variante="pequeno" cor={cores.textoSuave} numerico style={estilos.centro}>{dataParaTela(conquista.conquistadaEm)}</Texto>
    </View>
  );
}

/** O mural do aluno tem o que mostrar na coluna (posição ou alguma conquista). Sem isto ela nem ocupa lugar. */
export const temNumeros = (ranking: PosicaoNoRanking | undefined, conquistas: readonly ConquistaDoAluno[] | undefined) =>
  !!ranking || !!conquistas?.length;

/**
 * Coluna do mural do aluno (decisão 3 de 24/11): "Sua posição" e as conquistas mais recentes, compactas, com o caminho
 * para a aba Conquistas. Só o que já chegou: carregando, com erro ou vazio, o bloco some (a aba Conquistas mostra esses
 * estados), para a coluna não abrir vão no topo do feed. `compacto` (acima do feed, abaixo de 1280 px de área): um cartão
 * só, com a posição e uma linha das conquistas, para o feed começar na primeira dobra.
 */
export function NumerosDoMural({ ranking, conquistas, compacto, aoVerConquistas }: {
  ranking: PosicaoNoRanking | undefined;
  conquistas: readonly ConquistaDoAluno[] | undefined;
  compacto: boolean;
  aoVerConquistas: () => void;
}) {
  const { cores } = useTema();
  const recentes = conquistasRecentes(conquistas ?? []);
  const total = recentes.itens.length + recentes.aMais;
  if (compacto) {
    return (
      <Cartao titulo="Seus números">
        {ranking ? <LinhaDaPosicao ranking={ranking} /> : null}
        {ranking ? <Texto variante="pequeno">Pelo número de treinos concluídos. Só você vê a sua posição.</Texto> : null}
        {recentes.itens.length ? (
          <View style={estilos.resumoDasConquistas}>
            <Award size={20} color={cores.texto} aria-hidden />
            <Texto style={estilos.frase}>
              {`${total === 1 ? '1 conquista' : `${total} conquistas`} · a mais recente: `}
              <Texto style={estilos.tituloDaConquista}>{recentes.itens[0].titulo}</Texto>
            </Texto>
            <Botao tipo="fantasma" aoTocar={aoVerConquistas} rotulo="Ver conquistas" />
          </View>
        ) : null}
      </Cartao>
    );
  }
  return (
    <>
      {ranking ? (
        <Cartao titulo="Sua posição">
          <LinhaDaPosicao ranking={ranking} />
          <Texto variante="pequeno">Pelo número de treinos concluídos. Só você vê a sua posição.</Texto>
        </Cartao>
      ) : null}
      {recentes.itens.length ? (
        <Cartao titulo="Suas conquistas">
          <View style={estilos.lista}>
            {recentes.itens.map((c) => (
              <View key={c.id} style={estilos.linhaDaConquista}>
                <Award size={20} color={cores.texto} aria-hidden />
                <View style={estilos.encolher}>
                  <Texto style={estilos.tituloDaConquista} numberOfLines={2}>{c.titulo}</Texto>
                  <Texto variante="pequeno" numerico>{dataParaTela(c.conquistadaEm)}</Texto>
                </View>
              </View>
            ))}
          </View>
          <Botao tipo="fantasma" Icone={ChevronRight} aoTocar={aoVerConquistas}
            rotulo={recentes.aMais ? `Ver todas as ${recentes.itens.length + recentes.aMais} conquistas` : 'Ver conquistas'} />
        </Cartao>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  encolher: { flex: 1, minWidth: 0, gap: 2 },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  conquista: { flexGrow: 1, flexBasis: 150, alignItems: 'center', gap: espaco(1) },
  centro: { textAlign: 'center' },
  // O Selo se alinha ao início por conta própria; a linha o centraliza no cartão da conquista.
  seloCentral: { flexDirection: 'row', justifyContent: 'center', alignSelf: 'stretch' },
  lista: { gap: espaco(1.5) },
  resumoDasConquistas: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
  // No celular a frase fica com a linha e o botão desce; no PC cabem os dois.
  frase: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  linhaDaConquista: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  tituloDaConquista: { fontFamily: fontes.medio },
});
