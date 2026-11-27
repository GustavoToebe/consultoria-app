import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao } from '../../api/tipos';
import { detalheDaDivisao } from '../../dominio/inicioDoAluno';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { coresDaSelecao } from '../../ui/selecao';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import type { LinhaDaSemana } from './arranjoDoTreino';

/**
 * Uma divisão na lista da semana do computador (pedido de 27/11: lista à esquerda, o treino da escolhida à direita).
 * `treino`: linha de 64 a 72 px com a letra, o nome, "Segunda · 5 exercícios" e a seta; tocar ESCOLHE a divisão (o treino
 * aparece ao lado), não navega. `hoje`: o mesmo, no poço (`superficie2`) com a barrinha da marca à esquerda e o selo "Hoje".
 * A escolhida tem a seleção neutra (`coresDaSelecao`: `sobre` + contorno `bordaCampo`, seta forte): a marca nunca diz
 * "escolhido". `descanso` (sem exercício): 48 a 56 px, tudo suave numa linha, sem seta e sem toque. O nome acessível é o da
 * `LinhaDaDivisao` do celular ("Divisão A, nome, detalhe[, hoje]").
 */
export function DivisaoDaSemana({ tipo, sessao, letra, selecionada = false, aoEscolher }: {
  tipo: LinhaDaSemana;
  sessao: Sessao;
  letra: string;
  selecionada?: boolean;
  /** Sem ele (sem exercício) a linha só informa. */
  aoEscolher?: () => void;
}) {
  const { cores, marcaPeca, bordas } = useTema();
  const detalhe = detalheDaDivisao(sessao);
  const hoje = tipo === 'hoje';
  const nome = `Divisão ${letra}, ${sessao.nome}, ${detalhe}${hoje ? ', hoje' : ''}`;

  if (tipo === 'descanso') {
    return (
      <View accessible accessibilityLabel={nome} style={[estilos.linha, estilos.descanso, { borderColor: cores.divisor }]}>
        <View style={[estilos.letra, estilos.letraDoDescanso, { borderColor: cores.divisor }]}>
          <Texto cor="suave" style={estilos.letraTexto}>{letra}</Texto>
        </View>
        <Texto cor="suave" numberOfLines={1} style={estilos.nomeDoDescanso}>{sessao.nome}</Texto>
        <Texto variante="suave" numerico numberOfLines={1}>{detalhe}</Texto>
      </View>
    );
  }

  const selecao = coresDaSelecao(cores, selecionada);
  const conteudo = (
    <>
      {/* Hoje: a barrinha da marca, como no cartão Hoje do Início (decorativa: o selo e o nome acessível dizem "hoje"). */}
      {hoje ? <View aria-hidden style={[estilos.barrinha, { backgroundColor: marcaPeca }]} /> : null}
      <View style={[estilos.letra, { backgroundColor: hoje || selecionada ? cores.superficie : cores.superficie2, borderColor: cores.divisor }]}>
        <Texto style={estilos.letraTexto}>{letra}</Texto>
      </View>
      <View style={estilos.textos}>
        <Texto numberOfLines={2} style={estilos.nome}>{sessao.nome}</Texto>
        <Texto variante="suave" numerico>{detalhe}</Texto>
      </View>
      {hoje ? <Selo texto="Hoje" tipo="neutro" /> : null}
      {aoEscolher ? <ChevronRight size={20} color={selecionada ? cores.texto : cores.textoSuave} aria-hidden /> : null}
    </>
  );
  const fundo = selecionada ? selecao.fundo : hoje ? cores.superficie2 : cores.superficie;
  // Contorno forte só na escolhida (o mesmo peso da preferência "bordas reforçadas" que os outros contêineres seguem).
  const contorno = selecionada ? { borderColor: selecao.borda, borderWidth: bordas.bloco } : { borderColor: cores.divisor };
  const estilo = [estilos.linha, estilos.treino, contorno];
  if (!aoEscolher) return <View accessible accessibilityLabel={nome} style={[estilo, { backgroundColor: fundo }]}>{conteudo}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nome}
      accessibilityState={{ selected: selecionada }}
      aria-current={selecionada ? 'true' : undefined}
      onPress={aoEscolher}
      style={(estado) => [estilo, { backgroundColor: !selecionada && sobre(estado) ? cores.sobre : fundo }]}>
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  // 40 da letra + 2 × 12 = 64; com o nome em duas linhas, até ~72.
  treino: { gap: espaco(1.5), minHeight: 64, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2) },
  barrinha: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  // 32 da letra + 2 × 8 = 48, sem fundo: o dia sem exercício recua.
  descanso: { gap: espaco(1.5), minHeight: 48, paddingVertical: espaco(1), paddingHorizontal: espaco(2), backgroundColor: 'transparent' },
  letra: { width: 40, height: 40, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  letraDoDescanso: { width: 32, height: 32 },
  letraTexto: { fontFamily: fontes.negrito, fontSize: 16, lineHeight: 22 },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  nomeDoDescanso: { flex: 1, minWidth: 0, fontFamily: fontes.medio },
});
