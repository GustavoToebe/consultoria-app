import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { blocosDaColuna, emDuasColunas, larguraMaximaDasColunas, ordemNumaColuna, PROPORCAO_DAS_COLUNAS } from '../dominio/colunasDaFicha';
import type { BlocoDaFicha } from '../dominio/fichaDoAluno';
import { espaco } from '../tema/tokens';
import { useFaixaDaTela } from '../ui/Tela';
import { useFaixaDeLargura } from '../ui/useFaixaDeLargura';
import { CartaoLesoes, useLesoes } from './CartaoLesoes';

/** Os blocos da aba que seguem as seções dos Dados do aluno em cada coluna. */
export interface BlocosAoLado { esquerda: ReactNode; direita: ReactNode }

/**
 * Arranjo da aba Ficha do aluno (Ficha › Dados; regra em `dominio/colunasDaFicha`, plano
 * `docs/planos/ficha-dados-colunas-independentes.md`). A partir da faixa `normal` da `Tela` (`useFaixaDaTela`, 4.10): duas
 * colunas independentes, 3 para 2, cada uma uma pilha com o mesmo vão: Identificação › Contato e endereço › Plano contratado
 * › Histórico de lesões à esquerda; Configuração do acompanhamento › Objetivo e observações › Acesso ao app › Anamnese à
 * direita. As seções são do `DadosDoAluno`, que recebe os blocos de cada coluna (`colunas`). Numa coluna (faixa `compacta`):
 * os Dados e, depois, Lesões ativas › Plano › Acesso › Anamnese › Histórico (as recuperadas). Só aparece o que `blocos` traz
 * (`blocosDaAba`); as lesões são buscadas uma vez aqui e repartidas.
 */
export function BlocosDaFicha({ alunoId, blocos, bloco }: {
  alunoId: string; blocos: readonly BlocoDaFicha[];
  /** `colunas` só chega ao `dadosDoAluno`, em duas colunas. */
  bloco: (b: BlocoDaFicha, colunas?: BlocosAoLado) => ReactNode;
}) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const faixa = useFaixaDaTela();
  const tem = (b: BlocoDaFicha) => blocos.includes(b);
  const lesoes = useLesoes(tem('lesoes') ? alunoId : null);
  // Antes da primeira medida não se sabe o arranjo: montar numa coluna e remontar em duas buscaria tudo duas vezes.
  const medido = largura > 0;
  // Sem embrulho em volta do bloco: um que não desenha nada (as lesões fora do `CartaoLesoes`) não ocupa um vão da pilha.
  const pilha = (lado: 'esquerda' | 'direita') => blocosDaColuna(lado, blocos).map((b) => (b === 'lesoes'
    ? <CartaoLesoes key={b} alunoId={alunoId} carga={lesoes} parte="tudo" />
    : <Fragment key={b}>{bloco(b)}</Fragment>));
  const colunas = medido && emDuasColunas(faixa) ? { esquerda: pilha('esquerda'), direita: pilha('direita') } : undefined;
  return (
    // Na `ultralarga` a aba inteira (título, formulário e colunas) fica no teto, alinhada à esquerda (4.10).
    <View onLayout={aoMedir} style={[estilos.aba, { maxWidth: larguraMaximaDasColunas(faixa) }]}>
      {tem('dadosDoAluno') ? bloco('dadosDoAluno', colunas) : colunas ? <ColunasDaFicha {...colunas} /> : null}
      {medido && !colunas ? ordemNumaColuna(blocos).map((p) => (
        p === 'lesoesAtivas' ? <CartaoLesoes key={p} alunoId={alunoId} carga={lesoes} parte="ativas" />
          : p === 'lesoesRecuperadas' ? <CartaoLesoes key={p} alunoId={alunoId} carga={lesoes} parte="recuperadas" />
            : <Fragment key={p}>{bloco(p)}</Fragment>
      )) : null}
    </View>
  );
}

/**
 * As duas colunas da aba (3 para 2), alinhadas pelo topo e cada uma com a própria altura: a diferença fica só no fim da mais
 * curta.
 */
export function ColunasDaFicha({ esquerda, direita }: BlocosAoLado) {
  return (
    <View style={estilos.colunas}>
      <View style={estilos.esquerda}>{esquerda}</View>
      <View style={estilos.direita}>{direita}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: espaco(3) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  esquerda: { flex: PROPORCAO_DAS_COLUNAS.esquerda, minWidth: 0, gap: espaco(3) },
  direita: { flex: PROPORCAO_DAS_COLUNAS.direita, minWidth: 0, gap: espaco(3) },
});
