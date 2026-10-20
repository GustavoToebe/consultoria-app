import { Moon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { contagem } from '../dominio/contagens';
import type { EstadoDoHoje } from '../dominio/inicioDoAluno';
import { nomeComDia, rotuloDoTipo } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { MensagemErro } from '../ui/Estados';
import { Texto } from '../ui/Texto';

interface Props {
  estado: EstadoDoHoje;
  /** "Ver meu treino →": só abre a lista do dia, nada inicia nem conclui. */
  aoVerTreino: () => void;
  /** "Escolher treino" (plano sem dia fixo): leva às divisões da semana. */
  aoEscolher: () => void;
  /** Falha ao carregar o plano: texto da API e "Tentar de novo". */
  erro?: { texto: string; aoTentarDeNovo: () => void; causa?: unknown };
}

/**
 * "Hoje" no início do aluno: o único cartão na cor da marca e o único botão primário da tela. Treino do dia e plano sem
 * dia fixo usam a marca; descanso, treino preparado e sessão sem exercício são cartões neutros. O cartão não é mais
 * todo um toque: a ação é o botão "Ver meu treino →", que abre a lista do dia (cada exercício se abre e se marca por lá).
 * Falha ao carregar nunca é mostrada como "treino não publicado".
 */
export function CartaoHoje({ estado, aoVerTreino, aoEscolher, erro }: Props) {
  const { cores, marca, sobreMarca } = useTema();
  const neutro = { backgroundColor: cores.superficie, borderColor: cores.borda };

  if (estado.tipo === 'erro') {
    return <MensagemErro texto={erro?.texto ?? 'Não foi possível carregar o seu treino.'} tentarDeNovo={erro?.aoTentarDeNovo} erro={erro?.causa} />;
  }
  if (estado.tipo === 'carregando') {
    return <View accessibilityLabel="Carregando seu treino" style={[estilos.cartao, estilos.carregando, neutro]} />;
  }
  if (estado.tipo === 'preparando') {
    return (
      <View style={[estilos.cartao, neutro]}>
        <Texto variante="bloco" nivel={3}>Seu treino está sendo preparado</Texto>
        <Texto variante="suave">Seu treinador ainda não publicou o treino. Quando ele publicar, ele aparece aqui.</Texto>
      </View>
    );
  }
  if (estado.tipo === 'descanso') {
    const cardio = estado.sessao?.cardio;
    return (
      <View style={[estilos.cartao, neutro]}>
        <View style={estilos.linhaDescanso}>
          <Moon size={20} color={cores.textoSuave} accessible={false} />
          <Texto variante="bloco" nivel={3}>Hoje é dia de descanso.</Texto>
        </View>
        {cardio ? <Texto variante="suave">{estado.sessao ? `${rotuloDoTipo(estado.sessao)} · ${cardio}` : cardio}</Texto> : null}
      </View>
    );
  }
  if (estado.tipo === 'sem-exercicios') {
    return (
      <View style={[estilos.cartao, neutro]}>
        <Texto variante="bloco" nivel={3}>{nomeComDia(estado.sessao)}</Texto>
        <Texto variante="suave">Nada para registrar hoje.</Texto>
      </View>
    );
  }

  const treino = estado.tipo === 'treino';
  return (
    <View style={[estilos.cartao, { backgroundColor: marca, borderColor: marca }]}>
      {treino ? <Texto variante="secao" cor={sobreMarca} style={estilos.rotulo}>{estado.rotulo}</Texto> : null}
      <Texto nivel={3} style={[estilos.nome, { color: sobreMarca }]}>{treino ? estado.sessao.nome : 'Qual é o treino de hoje?'}</Texto>
      <Texto cor={sobreMarca} style={estilos.detalhe}>
        {treino ? contagem(estado.sessao.exercicios.length, 'exercício', 'exercícios') : 'Seu plano não tem dia fixo. Escolha uma divisão.'}
      </Texto>
      <View style={estilos.acao}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={treino ? `Ver meu treino: ${estado.sessao.nome}` : 'Escolher treino'}
          onPress={treino ? aoVerTreino : aoEscolher}
          style={({ pressed }) => [estilos.botao, { backgroundColor: sobreMarca, opacity: pressed ? 0.85 : 1 }]}>
          <Texto style={[estilos.botaoTexto, { color: marca }]}>{treino ? 'Ver meu treino →' : 'Escolher treino'}</Texto>
        </Pressable>
        {treino ? <Texto variante="pequeno" cor={sobreMarca} style={estilos.nota}>Consulte a lista antes de começar.</Texto> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.75) },
  carregando: { minHeight: 140, opacity: 0.6 },
  linhaDescanso: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  rotulo: { fontFamily: fontes.negrito, letterSpacing: 1 },
  nome: { fontFamily: fontes.negrito, fontSize: 24, lineHeight: 30 },
  detalhe: { opacity: 0.92 },
  acao: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5), marginTop: espaco(0.75) },
  botao: { minHeight: ALVO_TOQUE, paddingHorizontal: espaco(2.5), borderRadius: RAIO, justifyContent: 'center', alignItems: 'center' },
  botaoTexto: { fontFamily: fontes.negrito, fontSize: 16, lineHeight: 22 },
  nota: { flexShrink: 1, minWidth: 140, opacity: 0.92 },
});
