import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao } from '../api/tipos';
import { contagem } from '../dominio/contagens';
import { detalheDaDivisao } from '../dominio/inicioDoAluno';
import { nomeComDia, rotuloDoTipo } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Selo } from '../ui/Selo';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * Uma divisão da semana no início: a letra num quadrado neutro, o nome, "Segunda · 5 exercícios" (ou "Sem dia fixo") e a
 * seta. O cartão inteiro abre o dia; a divisão de hoje ganha o selo neutro "Hoje" (a cor da marca fica só no cartão Hoje).
 */
export function LinhaDaDivisao({ sessao, letra, hoje, aoAbrir }: { sessao: Sessao; letra: string; hoje: boolean; /** Sem ele (descanso, sem exercício) a linha só informa. */ aoAbrir?: () => void }) {
  const { cores } = useTema();
  const detalhe = detalheDaDivisao(sessao);
  const conteudo = (
    <>
      <View style={[estilos.letra, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
        <Texto style={estilos.letraTexto}>{letra}</Texto>
      </View>
      <View style={estilos.textos}>
        <Texto numberOfLines={2} style={estilos.nome}>{sessao.nome}</Texto>
        <Texto variante="suave" numerico>{detalhe}</Texto>
      </View>
      {hoje ? <Selo texto="Hoje" tipo="neutro" /> : null}
      {aoAbrir ? <ChevronRight size={20} color={cores.textoSuave} /> : null}
    </>
  );
  const rotulo = `Divisão ${letra}, ${sessao.nome}, ${detalhe}${hoje ? ', hoje' : ''}`;
  if (!aoAbrir) {
    return <View accessible accessibilityLabel={rotulo} style={[estilos.linha, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>{conteudo}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoAbrir}
      style={(estado) => [estilos.linha, { backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie, borderColor: cores.borda }]}>
      {conteudo}
    </Pressable>
  );
}

/** Divisão de um plano que não é o vigente: só os exercícios, sem datas nem registro. */
export function CartaoDivisaoLeitura({ sessao }: { sessao: Sessao }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.leitura, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={estilos.textos}>
        <Texto numerico style={estilos.nome}>{nomeComDia(sessao)}</Texto>
        <Texto numerico variante="suave">
          {[sessao.exercicios.length ? contagem(sessao.exercicios.length, 'exercício', 'exercícios') : rotuloDoTipo(sessao), sessao.cardio].filter(Boolean).join(' · ')}
        </Texto>
      </View>
      {sessao.exercicios.map((e) => (
        <Texto key={e.uid} numerico variante="suave">
          {e.nome} · {e.series.length} {e.series.length === 1 ? 'série' : 'séries'}
        </Texto>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    minHeight: ALVO_TOQUE + espaco(1.5),
    borderWidth: 1,
    borderRadius: RAIO,
    paddingVertical: espaco(1),
    paddingHorizontal: espaco(1.5),
  },
  letra: { width: 40, height: 40, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  letraTexto: { fontFamily: fontes.negrito, fontSize: 16, lineHeight: 22 },
  textos: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  leitura: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
});
