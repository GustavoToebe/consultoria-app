import { CalendarDays, CircleAlert, CircleCheck, Dumbbell, Layers, type LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoTreino } from '../../api/tipos';
import { textoDosProblemas, uidsDoPrimeiroProblema } from '../../dominio/problemasDoPlano';
import { validarTreino } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { useRolagem } from '../../ui/RolagemComTopo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/**
 * Contadores do plano no topo do editor (protótipo de 30/10): sessões, exercícios e séries e, pela mesma validação da
 * publicação, ao vivo, "N problemas para publicar · ir ao primeiro" (abre a sessão e o exercício e rola até ele) ou
 * "Pronto para publicar". Só informa: nada aqui trava salvar ou publicar.
 */
export function ContadoresDoTreino({ conteudo, aoIrAoPrimeiro }: { conteudo: ConteudoTreino; aoIrAoPrimeiro: (uids: string[]) => void }) {
  const { cores } = useTema();
  const { rolarAte } = useRolagem();
  const erros = useMemo(() => validarTreino(conteudo).erros, [conteudo]);
  const exercicios = conteudo.sessoes.reduce((n, s) => n + s.exercicios.length, 0);
  const series = conteudo.sessoes.reduce((n, s) => n + s.exercicios.reduce((m, e) => m + e.series.length, 0), 0);
  const irAoPrimeiro = () => {
    const uids = uidsDoPrimeiroProblema(conteudo, erros);
    aoIrAoPrimeiro(uids);
    rolarAte(uids);
  };
  return (
    <View style={estilos.linha}>
      <Contador Icone={CalendarDays} numero={conteudo.sessoes.length} texto={conteudo.sessoes.length === 1 ? 'sessão' : 'sessões'} />
      <Contador Icone={Dumbbell} numero={exercicios} texto={exercicios === 1 ? 'exercício' : 'exercícios'} />
      <Contador Icone={Layers} numero={series} texto={series === 1 ? 'série' : 'séries'} />
      {erros.length ? (
        <Pressable accessibilityRole="button" onPress={irAoPrimeiro}
          style={(estado) => [estilos.contador, { borderColor: cores.perigo, backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie }]}>
          <CircleAlert size={16} color={cores.perigo} />
          <Texto cor={cores.perigo} style={estilos.forte}>{`${textoDosProblemas(erros.length)} · ir ao primeiro`}</Texto>
        </Pressable>
      ) : (
        <View style={[estilos.contador, { borderColor: cores.sucesso, backgroundColor: cores.superficie }]}>
          <CircleCheck size={16} color={cores.sucesso} />
          <Texto cor={cores.sucesso} style={estilos.forte}>Pronto para publicar</Texto>
        </View>
      )}
    </View>
  );
}

function Contador({ Icone, numero, texto }: { Icone: LucideIcon; numero: number; texto: string }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.contador, { borderColor: cores.borda, backgroundColor: cores.superficie }]} accessibilityLabel={`${numero} ${texto}`}>
      <Icone size={16} color={cores.textoSuave} />
      <Texto numerico><Texto numerico style={estilos.forte}>{numero}</Texto> {texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE - 4, paddingHorizontal: espaco(1.5), borderWidth: 1, borderRadius: RAIO },
  forte: { fontFamily: fontes.semi },
});
