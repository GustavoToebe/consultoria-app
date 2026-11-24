import { Award, ChevronRight, Medal } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { ConquistaDoAluno, PosicaoNoRanking } from '../api/comunidadeTipos';
import { alturaDaFaixa, conquistasRecentes, type EstadoDosNumeros, rotuloNaFaixa } from '../dominio/arranjoDoMural';
import { textoDaPosicao } from '../dominio/comunidade';
import { dataParaTela, plural } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Selo } from '../ui/Selo';
import { sobre } from '../ui/sobre';
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
        <Texto variante="suave">{plural(ranking.treinosConcluidos, 'treino concluído', 'treinos concluídos')} · {ranking.pontuacao} pts</Texto>
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

/**
 * Coluna do mural do aluno ao lado do feed (a partir de 1280 px de área), sempre presente, com a mesma regra da faixa
 * (`estadoDosNumeros`): carregando, um cartão com o esqueleto; com números, "Sua posição" (só com treino concluído) e as
 * conquistas mais recentes, com o caminho para a aba Conquistas; sem números, o mesmo texto da faixa e "Ver conquistas".
 */
export function NumerosDoMural({ estado, conquistas, aoVerConquistas }: {
  estado: EstadoDosNumeros<PosicaoNoRanking>;
  conquistas: readonly ConquistaDoAluno[] | undefined;
  aoVerConquistas: () => void;
}) {
  const { cores } = useTema();
  const recentes = conquistasRecentes(conquistas ?? []);
  if (estado.tipo === 'carregando') {
    return (
      <Cartao titulo="Seus números">
        <View testID="coluna-dos-numeros-carregando" accessibilityRole="progressbar" accessibilityLabel="Carregando seus números" style={estilos.lista}>
          <View style={[estilos.esqueleto, { backgroundColor: cores.superficie2 }]} />
          <View style={[estilos.esqueleto, estilos.esqueletoCurto, { backgroundColor: cores.superficie2 }]} />
        </View>
      </Cartao>
    );
  }
  if (estado.tipo === 'sem') {
    return (
      <Cartao titulo="Seus números">
        <Texto>{estado.texto}</Texto>
        <Botao tipo="fantasma" Icone={ChevronRight} aoTocar={aoVerConquistas} rotulo="Ver conquistas" />
      </Cartao>
    );
  }
  return (
    <>
      {estado.posicao ? (
        <Cartao titulo="Sua posição">
          <LinhaDaPosicao ranking={estado.posicao} />
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

/**
 * Faixa no topo do feed (abaixo de 1280 px), sempre presente e sempre o botão para a aba Conquistas: o texto vem de
 * `estadoDosNumeros` e, enquanto carrega, um esqueleto ocupa o lugar dele. A altura (`alturaDaFaixa`) segue a escala do
 * texto (a do sistema, no mesmo teto do `Texto`, vezes o "Tamanho do texto" do app) e é a mesma em todos os estados: o
 * texto quebra em até duas linhas dentro dela e nada abaixo anda. Faixa estreita para a escala: só a seta, sem o rótulo.
 */
export function FaixaDosNumeros({ estado, largura, aoVerConquistas }: { estado: EstadoDosNumeros<unknown>; largura: number; aoVerConquistas: () => void }) {
  const { cores, fatorTexto } = useTema();
  const { fontScale } = useWindowDimensions();
  const escala = fatorTexto * Math.min(fontScale, TETO_FONTE_DO_SISTEMA);
  const carregando = estado.tipo === 'carregando';
  return (
    <Pressable testID="faixa-dos-numeros" accessibilityRole="button" onPress={aoVerConquistas}
      accessibilityLabel={`Seus números: ${carregando ? 'carregando' : estado.texto}. Ver conquistas`}
      accessibilityHint="Abre a aba Conquistas." accessibilityState={{ busy: carregando }}
      style={(e) => [estilos.faixa, { height: alturaDaFaixa(escala), backgroundColor: sobre(e) ? cores.sobre : cores.superficie, borderColor: cores.borda }]}>
      {/* Sem ícone à esquerda: o texto fica com a largura que sobra. */}
      {carregando
        ? <View style={estilos.encolher}><View testID="faixa-dos-numeros-carregando" style={[estilos.esqueleto, { backgroundColor: cores.superficie2 }]} /></View>
        : <Texto testID="faixa-dos-numeros-texto" numberOfLines={2} style={estilos.textoDaFaixa}>{estado.texto}</Texto>}
      {rotuloNaFaixa(largura, escala) ? <Texto style={estilos.acaoDaFaixa}>Ver conquistas</Texto> : null}
      <ChevronRight size={Math.round(18 * escala)} color={cores.texto} aria-hidden />
    </Pressable>
  );
}

/** O mesmo teto do `maxFontSizeMultiplier` do `Texto` para a fonte do sistema. */
const TETO_FONTE_DO_SISTEMA = 1.5;

const estilos = StyleSheet.create({
  faixa: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1),
    borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(2),
  },
  esqueleto: { height: 14, width: '60%', borderRadius: 7 },
  esqueletoCurto: { width: '40%' },
  textoDaFaixa: { flex: 1, minWidth: 0, fontFamily: fontes.medio },
  acaoDaFaixa: { fontFamily: fontes.semi },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  encolher: { flex: 1, minWidth: 0, gap: 2 },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  conquista: { flexGrow: 1, flexBasis: 150, alignItems: 'center', gap: espaco(1) },
  centro: { textAlign: 'center' },
  // O Selo se alinha ao início por conta própria; a linha o centraliza no cartão da conquista.
  seloCentral: { flexDirection: 'row', justifyContent: 'center', alignSelf: 'stretch' },
  lista: { gap: espaco(1.5) },
  linhaDaConquista: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  tituloDaConquista: { fontFamily: fontes.medio },
});
