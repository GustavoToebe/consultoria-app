import { Moon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { contagem } from '../dominio/contagens';
import { TEXTO_PACOTE_RECUSADO, type EstadoDoHoje } from '../dominio/inicioDoAluno';
import { nomeComDia, rotuloDoTipo } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Alerta, MensagemErro } from '../ui/Estados';
import { LinkTexto } from '../ui/LinkTexto';
import { Texto } from '../ui/Texto';

interface Props {
  estado: EstadoDoHoje;
  /** "Ver meu treino →": só abre a lista do dia, nada inicia nem conclui. */
  aoVerTreino: () => void;
  /** "Escolher treino" (plano sem dia fixo): leva às divisões da semana. */
  aoEscolher: () => void;
  /** Falha ao carregar o plano: texto da API e "Tentar de novo". */
  erro?: { texto: string; aoTentarDeNovo: () => void; causa?: unknown };
  /** Dia de descanso: "Quarta · Treino B" (`dominio/inicioDoAluno.proximoTreino`); nulo = a linha some. */
  proximo?: string | null;
  /** Treino de hoje já concluído (N3): o cartão diz isso, com o resultado, e a ação vira "Ver resumo". `texto` vem de `textoDoHojeConcluido`. */
  concluido?: { texto: string; aoVerResumo: () => void } | null;
}

/**
 * "Hoje" no início do aluno: o único cartão na cor da marca e o único botão primário da tela. Treino do dia e plano sem
 * dia fixo usam a marca; descanso, treino preparado e sessão sem exercício são cartões neutros. O cartão não é mais
 * todo um toque: a ação é o botão "Ver meu treino →", que abre a lista do dia (cada exercício se abre e se marca por lá).
 * Falha ao carregar nunca é mostrada como "treino não publicado".
 */
export function CartaoHoje({ estado, aoVerTreino, aoEscolher, erro, proximo, concluido }: Props) {
  const { cores, marca, sobreMarca } = useTema();
  const neutro = { backgroundColor: cores.superficie, borderColor: cores.divisor };

  if (estado.tipo === 'recusado') {
    return <View testID="pacote-recusado"><Alerta tom="atencao" texto={TEXTO_PACOTE_RECUSADO} /></View>;
  }
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
          <Moon size={20} color={cores.textoSuave} aria-hidden />
          <Texto variante="bloco" nivel={3}>Hoje é dia de descanso.</Texto>
        </View>
        {cardio ? <Texto variante="suave">{estado.sessao ? `${rotuloDoTipo(estado.sessao)} · ${cardio}` : cardio}</Texto> : null}
        {proximo ? <Texto numerico>Próximo treino: {proximo}</Texto> : null}
        {/* Quem treina fora do dia previsto acha a saída aqui; secundário, porque descansar é o plano de hoje. */}
        <View style={estilos.linhaDoLink}><LinkTexto href="/aluno/treino" texto="Treinar mesmo assim" /></View>
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
        {treino ? (concluido ? concluido.texto : contagem(estado.sessao.exercicios.length, 'exercício', 'exercícios')) : 'Seu plano não tem dia fixo. Escolha uma divisão.'}
      </Texto>
      <View style={estilos.acao}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={treino ? (concluido ? `Ver resumo do treino: ${estado.sessao.nome}` : `Ver meu treino: ${estado.sessao.nome}`) : 'Escolher treino'}
          onPress={treino ? (concluido ? concluido.aoVerResumo : aoVerTreino) : aoEscolher}
          style={({ pressed }) => [estilos.botao, { backgroundColor: sobreMarca, opacity: pressed ? 0.85 : 1 }]}>
          <Texto style={[estilos.botaoTexto, { color: marca }]}>{treino ? (concluido ? 'Ver resumo →' : 'Ver meu treino →') : 'Escolher treino'}</Texto>
        </Pressable>
        {treino && !concluido ? <Texto variante="pequeno" cor={sobreMarca} style={estilos.nota}>Consulte a lista antes de começar.</Texto> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.75) },
  carregando: { minHeight: 140, opacity: 0.6 },
  linhaDescanso: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  // O link fica do tamanho do texto (a linha inteira não é toque).
  linhaDoLink: { flexDirection: 'row' },
  rotulo: { fontFamily: fontes.negrito, letterSpacing: 1 },
  nome: { fontFamily: fontes.negrito, fontSize: 24, lineHeight: 30 },
  detalhe: { opacity: 0.92 },
  acao: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5), marginTop: espaco(0.75) },
  botao: { minHeight: ALVO_TOQUE, paddingHorizontal: espaco(2.5), borderRadius: RAIO, justifyContent: 'center', alignItems: 'center' },
  botaoTexto: { fontFamily: fontes.negrito, fontSize: 16, lineHeight: 22 },
  nota: { flexShrink: 1, minWidth: 140, opacity: 0.92 },
});
