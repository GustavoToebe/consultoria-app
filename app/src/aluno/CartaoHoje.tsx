import { Moon } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { contagem } from '../dominio/contagens';
import { TEXTO_PACOTE_RECUSADO, type EstadoDoHoje } from '../dominio/inicioDoAluno';
import { contornoDoCartao } from '../dominio/preferencias';
import { nomeComDia, rotuloDoTipo } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, marcaAoPassar, RAIO, RAIO_CONTROLE, textoSobre } from '../tema/tokens';
import { Alerta, MensagemErro } from '../ui/Estados';
import { LinkTexto } from '../ui/LinkTexto';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';

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
  /** Treino de hoje começado e não concluído: "1 de 6 séries feitas" no lugar da contagem e a ação vira "Continuar treino" (o mesmo destino). */
  emAndamento?: string | null;
}

/**
 * "Hoje" no início do aluno: o cartão é neutro em todo estado (superfície e `divisor`, Gustavo, 25/11: sem cartão pintado
 * nem faixa); no treino do dia e no plano sem dia fixo a marca fica só no rótulo ("TREINO C", `marcaTexto`) e no botão,
 * o único primário da tela (desenho do `Botao` primário, fundo `marcaPeca`). O cartão não é mais
 * todo um toque: a ação é o botão "Ver meu treino →", que abre a lista do dia (cada exercício se abre e se marca por lá).
 * Falha ao carregar nunca é mostrada como "treino não publicado".
 */
export function CartaoHoje({ estado, aoVerTreino, aoEscolher, erro, proximo, concluido, emAndamento }: Props) {
  const { cores, marcaTexto, marcaPeca, preferencias } = useTema();
  const reduzido = useMovimentoReduzido();
  // O contorno do `Cartao` (`divisor`; `bordaCampo` no contraste alto), para o Hoje não ficar mais apagado que os vizinhos.
  const neutro = { backgroundColor: cores.superficie, borderColor: contornoDoCartao(cores, preferencias.contraste) };

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
  const andamento = treino && !concluido ? emAndamento ?? null : null;
  const rotuloDoBotao = treino ? (concluido ? 'Ver resumo →' : andamento ? 'Continuar treino →' : 'Ver meu treino →') : 'Escolher treino';
  const rotuloAcessivel = treino
    ? `${concluido ? 'Ver resumo do treino' : andamento ? 'Continuar treino' : 'Ver meu treino'}: ${estado.sessao.nome}`
    : 'Escolher treino';
  // Botão na marca com o desenho do `Botao` primário: `marcaPeca` passa 3:1 sobre o cartão e o texto sobre ele, 4,5:1.
  const textoDoBotao = textoSobre(marcaPeca);
  return (
    <View style={[estilos.cartao, neutro]}>
      {treino ? <Texto variante="secao" cor={marcaTexto} style={estilos.rotulo}>{estado.rotulo}</Texto> : null}
      <Texto nivel={3} style={estilos.nome}>{treino ? estado.sessao.nome : 'Qual é o treino de hoje?'}</Texto>
      <Texto variante="suave">
        {treino ? (concluido ? concluido.texto : andamento ?? contagem(estado.sessao.exercicios.length, 'exercício', 'exercícios')) : 'Seu plano não tem dia fixo. Escolha uma divisão.'}
      </Texto>
      <View style={estilos.acao}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rotuloAcessivel}
          onPress={treino ? (concluido ? concluido.aoVerResumo : aoVerTreino) : aoEscolher}
          style={(estado) => [
            estilos.botao,
            !reduzido && Platform.OS === 'web' ? estilos.transicao : null,
            { backgroundColor: sobre(estado) ? marcaAoPassar(marcaPeca) : marcaPeca, borderColor: marcaPeca },
            estado.pressed && !reduzido ? estilos.apertado : null,
          ]}>
          <Texto style={[estilos.botaoTexto, { color: textoDoBotao }]}>{rotuloDoBotao}</Texto>
        </Pressable>
        {treino && !concluido && !andamento ? <Texto variante="pequeno" style={estilos.nota}>Consulte a lista antes de começar.</Texto> : null}
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
  acao: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5), marginTop: espaco(0.75) },
  // Medidas do `Botao` primário (`ui/Botao`): 44 de altura, raio de controle, rótulo semi 15, afundar e 120 ms na web.
  botao: {
    minHeight: ALVO_TOQUE, paddingHorizontal: espaco(2), paddingVertical: espaco(0.75), borderRadius: RAIO_CONTROLE, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  botaoTexto: { fontFamily: fontes.semi, fontSize: 15, textAlign: 'center' },
  apertado: { transform: [{ translateY: 1 }, { scale: 0.98 }] },
  transicao: { transitionProperty: 'background-color, border-color, transform', transitionDuration: '120ms' } as ViewStyle,
  nota: { flexShrink: 1, minWidth: 140 },
});
