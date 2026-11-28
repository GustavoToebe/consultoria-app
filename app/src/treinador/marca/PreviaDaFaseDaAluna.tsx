import { StyleSheet, View } from 'react-native';

import { ROTULO_DA_FASE, type FaseDoCiclo } from '../../dominio/cicloMenstrual';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';

/** Largura de um celular: a prévia mostra o cartão como a aluna o vê, não esticado na coluna. */
const LARGURA_DA_PREVIA = 400;

/**
 * "Como a aluna vê" (Padrões do acompanhamento, 28/11): o topo do cartão da fase do app da aluna (`app/aluno/ciclo.tsx`,
 * `Conteudo`), com as mesmas peças (`Cartao`, linha `destaque` e o texto por `TextoFormatado`, aparado), sobre um fundo de
 * tela. Sem dado de aluna: no lugar do "Dia N do ciclo" fica só o nome da fase, e a previsão e os botões não entram.
 * shortcut: o cartão da aluna mora dentro da rota; quando virar peça própria, esta prévia passa a usá-la por props.
 * Só olha: fora do leitor de tela (o texto já está no campo) e sem nada para tocar.
 */
export function PreviaDaFaseDaAluna({ fase, texto }: { fase: FaseDoCiclo; texto: string | null }) {
  const { cores } = useTema();
  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo">Como a aluna vê</Texto>
      <View testID="previa-da-fase" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[estilos.tela, { backgroundColor: cores.fundo, borderColor: cores.divisor }]}>
        <Cartao>
          <Texto variante="destaque">{`Fase ${ROTULO_DA_FASE[fase].toLowerCase()}`}</Texto>
          {texto ? <TextoFormatado texto={texto} /> : <Texto variante="suave">Sem texto nesta fase: a aluna não vê orientação aqui.</Texto>}
        </Cartao>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1), maxWidth: LARGURA_DA_PREVIA, width: '100%' },
  tela: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
});
