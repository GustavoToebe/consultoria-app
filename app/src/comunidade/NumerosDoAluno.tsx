import { Award, ChevronRight, Medal } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConquistaDoAluno, PosicaoNoRanking } from '../api/comunidadeTipos';
import { conquistasRecentes, type EstadoDaFaixa } from '../dominio/arranjoDoMural';
import { textoDaPosicao } from '../dominio/comunidade';
import { dataParaTela, plural } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
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
 * Coluna do mural do aluno (decisão 3 de 24/11): "Sua posição" e as conquistas mais recentes, compactas, com o caminho
 * para a aba Conquistas. Só o que já chegou: carregando, com erro ou vazio, o bloco some (a aba Conquistas mostra esses
 * estados), para a coluna não abrir vão ao lado do feed. Acima do feed (abaixo de 1280 px de área) vai a `FaixaDosNumeros`.
 */
export function NumerosDoMural({ ranking, conquistas, aoVerConquistas }: {
  ranking: PosicaoNoRanking | undefined;
  conquistas: readonly ConquistaDoAluno[] | undefined;
  aoVerConquistas: () => void;
}) {
  const { cores } = useTema();
  const recentes = conquistasRecentes(conquistas ?? []);
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

/**
 * Faixa de uma linha no topo do feed (abaixo de 1280 px), sempre presente e sempre o botão para a aba Conquistas: o texto
 * vem de `faixaDosNumeros` ("2º de 12 · 4 conquistas", o convite neutro ou o aviso de indisponível) e, enquanto carrega, um
 * esqueleto ocupa o lugar dele. A altura é fixa (`ALTURA_DA_FAIXA`) em todos os estados: nada abaixo anda.
 */
export function FaixaDosNumeros({ estado, aoVerConquistas }: { estado: EstadoDaFaixa; aoVerConquistas: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable testID="faixa-dos-numeros" accessibilityRole="button" onPress={aoVerConquistas}
      accessibilityLabel={`Seus números: ${estado.carregando ? 'carregando' : estado.texto}. Ver conquistas`}
      accessibilityHint="Abre a aba Conquistas." accessibilityState={{ busy: estado.carregando }}
      style={(e) => [estilos.faixa, { backgroundColor: sobre(e) ? cores.sobre : cores.superficie, borderColor: cores.borda }]}>
      {/* Sem ícone à esquerda: em 390 px os números e a ação cabem numa linha; as frases sem número quebram em duas, dentro
          da mesma altura. */}
      {estado.carregando
        ? <View style={estilos.encolher}><View testID="faixa-dos-numeros-carregando" style={[estilos.esqueleto, { backgroundColor: cores.superficie2 }]} /></View>
        : <Texto numberOfLines={2} style={estilos.textoDaFaixa}>{estado.texto}</Texto>}
      <Texto style={estilos.acaoDaFaixa}>Ver conquistas</Texto>
      <ChevronRight size={18} color={cores.texto} aria-hidden />
    </Pressable>
  );
}

/** Altura fixa da faixa (com ou sem texto): o alvo de toque de 44 mais o respiro da borda. */
const ALTURA_DA_FAIXA = ALVO_TOQUE + espaco(1.5);

const estilos = StyleSheet.create({
  faixa: {
    height: ALTURA_DA_FAIXA, flexDirection: 'row', alignItems: 'center', gap: espaco(1),
    borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(2),
  },
  esqueleto: { height: 14, width: '60%', borderRadius: 7 },
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
