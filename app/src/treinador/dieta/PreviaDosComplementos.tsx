import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import { orientacoesNaPrevia, previaVazia } from '../../dominio/complementosDaDieta';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { coresDaEdicao } from '../../ui/selecao';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';

type Orientacao = ConteudoDieta['orientacoes'][number];

const NADA = 'Nada para mostrar ainda';

/**
 * "Como o aluno vê" (27/11): a região nomeada ao lado do editor dos Complementos, na faixa `larga` em diante. Um poço no
 * fundo da página do app (`fundo`), com o cartão da dieta do aluno dentro, para ler como a tela dele e não como mais um
 * campo do editor. Só mostra: nada aqui edita.
 */
function PreviaParaOAluno({ children }: { children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View role="region" aria-label="Como o aluno vê" style={estilos.previa}>
      <Texto variante="rotulo" nivel={3}>Como o aluno vê</Texto>
      <View style={[estilos.poco, { backgroundColor: cores.fundo, borderColor: cores.divisor }]}>{children}</View>
    </View>
  );
}

/**
 * Orientações como na dieta do aluno (`aluno/DietaDoAluno`: cartão "Orientações", título em semi e o texto suave), aberto
 * (no aluno ele nasce recolhido) e com o formato do treinador aplicado (`ui/TextoFormatado`). A que está no editor fica
 * marcada (`aria-current` e o fundo de edição), para achar onde ela cai no meio das outras.
 */
export function PreviaDasOrientacoes({ orientacoes, selecionada }: { orientacoes: Orientacao[]; selecionada: number | null }) {
  const { cores } = useTema();
  const itens = orientacoesNaPrevia(orientacoes);
  return (
    <PreviaParaOAluno>
      {itens.length === 0 ? <Texto variante="suave">{NADA}</Texto> : (
        <Cartao titulo="Orientações" nivel={3}>
          {itens.map(({ orientacao: o, indice }) => {
            const atual = indice === selecionada;
            return (
              <View key={indice} aria-current={atual ? true : undefined}
                style={[estilos.orientacao, atual ? { backgroundColor: coresDaEdicao(cores).fundoDoBloco, borderLeftColor: cores.acao } : null]}>
                {o.titulo.trim() ? <Texto numerico style={estilos.forte}>{o.titulo}</Texto> : null}
                <TextoFormatado texto={o.texto} variante="suave" />
              </View>
            );
          })}
        </Cartao>
      )}
    </PreviaParaOAluno>
  );
}

/** Observações como na dieta do aluno (cartão "Observações", texto normal), com o formato aplicado. */
export function PreviaDasObservacoes({ texto }: { texto: string }) {
  return (
    <PreviaParaOAluno>
      {previaVazia(texto) ? <Texto variante="suave">{NADA}</Texto> : (
        <Cartao titulo="Observações" nivel={3}><TextoFormatado texto={texto} /></Cartao>
      )}
    </PreviaParaOAluno>
  );
}

const estilos = StyleSheet.create({
  previa: { gap: espaco(1), minWidth: 0 },
  poco: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  // A marcada leva o fundo de edição e a barra de ação à esquerda (a moldura inteira fica só na lista, um nível por vez);
  // o recuo e a barra transparente existem em todas, para a marcada não empurrar o texto das outras.
  orientacao: { gap: 2, marginHorizontal: -espaco(1), paddingRight: espaco(1), paddingLeft: espaco(1) - 3, paddingVertical: espaco(0.75), borderRadius: 8, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  forte: { fontFamily: fontes.semi },
});
