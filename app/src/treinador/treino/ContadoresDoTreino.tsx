import { CircleAlert, CircleCheck, Dumbbell, Layers, type LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoTreino, Sessao } from '../../api/tipos';
import { contarPlano, contarSessao, textoDaSessaoAberta, textoDoPlanoInteiro } from '../../dominio/contagemDoTreino';
import { textoDosProblemas, uidsDoPrimeiroProblema } from '../../dominio/problemasDoPlano';
import { validarTreino } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { useRolagem } from '../../ui/RolagemComTopo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/**
 * Contadores do plano no topo do editor: o plano inteiro ("Plano inteiro: 6 sessões · 32 exercícios · 120 séries
 * cadastradas") e, separado, a sessão aberta ("Sessão aberta: 5 exercícios · 18 séries"); antes os números do plano
 * pareciam ser da sessão na tela (reunião de 30/10). Pela mesma validação da publicação, ao vivo, "N problemas para
 * publicar · ir ao primeiro" (abre a sessão e o exercício e rola até ele) ou "Pronto para publicar". Só informa: nada
 * aqui trava salvar ou publicar.
 */
export function ContadoresDoTreino({ conteudo, sessao, aoIrAoPrimeiro }: {
  conteudo: ConteudoTreino;
  /** A sessão aberta no editor; nula sem nenhuma (o contador dela some). */
  sessao?: Sessao | null;
  aoIrAoPrimeiro: (uids: string[]) => void;
}) {
  const { cores } = useTema();
  const { rolarAte } = useRolagem();
  const erros = useMemo(() => validarTreino(conteudo).erros, [conteudo]);
  const irAoPrimeiro = () => {
    const uids = uidsDoPrimeiroProblema(conteudo, erros);
    aoIrAoPrimeiro(uids);
    rolarAte(uids);
  };
  return (
    <View style={estilos.linha}>
      <Contador Icone={Layers} texto={textoDoPlanoInteiro(contarPlano(conteudo))} />
      {sessao ? <Contador Icone={Dumbbell} texto={textoDaSessaoAberta(contarSessao(sessao))} /> : null}
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

/** Um contador: o "de quê" em destaque ("Plano inteiro:") e os números depois. */
function Contador({ Icone, texto }: { Icone: LucideIcon; texto: string }) {
  const { cores } = useTema();
  const corte = texto.indexOf(': ');
  const titulo = corte >= 0 ? texto.slice(0, corte + 1) : '';
  const numeros = corte >= 0 ? texto.slice(corte + 2) : texto;
  return (
    <View style={[estilos.contador, { borderColor: cores.borda, backgroundColor: cores.superficie }]} accessibilityLabel={texto}>
      <Icone size={16} color={cores.textoSuave} />
      <Texto numerico style={estilos.texto}>{titulo ? <Texto numerico style={estilos.forte}>{titulo} </Texto> : null}{numeros}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE - 4, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), borderWidth: 1, borderRadius: RAIO, maxWidth: '100%' },
  // Em 390 px ou com texto grande o contador quebra linha dentro da caixa em vez de sair dela.
  texto: { flexShrink: 1 },
  forte: { fontFamily: fontes.semi },
});
