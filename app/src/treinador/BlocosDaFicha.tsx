import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colunasDaAbaDados, larguraMaximaDasColunas, ordemNumaColuna, type SecaoDosDados } from '../dominio/colunasDaFicha';
import type { BlocoDaFicha } from '../dominio/fichaDoAluno';
import { espaco, LARGURA_EDITOR_DE_CAMPOS } from '../tema/tokens';
import { useFaixaDaTela } from '../ui/Tela';
import { CartaoLesoes, useLesoes } from './CartaoLesoes';

/** Uma coluna da aba: as seções dos Dados que a abrem (postas pelo `DadosDoAluno`) e os blocos que vêm depois. */
export interface ColunaDaFicha { secoes: SecaoDosDados[]; blocos: ReactNode[]; proporcao: number }

const VAO = espaco(3);

/**
 * Arranjo da aba Ficha do aluno (Ficha › Dados; regra em `dominio/colunasDaFicha.colunasDaAbaDados`, planos
 * `docs/planos/ficha-dados-colunas-independentes.md` e `tela-larga-revisao-2.md`). A partir da faixa `normal` da `Tela`
 * (`useFaixaDaTela`, 4.10): duas colunas independentes, 3 para 2, cada uma uma pilha com o mesmo vão: Identificação ›
 * Contato e endereço › Plano contratado › Histórico de lesões à esquerda; Configuração do acompanhamento › Objetivo e
 * observações › Acesso ao app › Anamnese à direita. Com a largura medida da aba (`largura`, a do cabeçalho da ficha) para
 * três colunas (2560 e 3440 com o menu aberto), três pilhas: Identificação › Contato › Objetivo; Plano › Lesões;
 * Acompanhamento › Acesso › Anamnese. As seções são do `DadosDoAluno`, que recebe as colunas (`colunas`). Numa coluna (faixa
 * `compacta`): os Dados e, depois, Lesões ativas › Plano › Acesso › Anamnese › Histórico (as recuperadas). Só aparece o que
 * `blocos` traz (`blocosDaAba`); as lesões são buscadas uma vez aqui e repartidas.
 */
export function BlocosDaFicha({ alunoId, blocos, largura, bloco }: {
  alunoId: string; blocos: readonly BlocoDaFicha[];
  /** Largura medida da aba: decide entre duas e três colunas. */
  largura: number;
  /** `colunas` só chega ao `dadosDoAluno`, em duas ou três colunas. */
  bloco: (b: BlocoDaFicha, colunas?: ColunaDaFicha[]) => ReactNode;
}) {
  const faixa = useFaixaDaTela();
  const tem = (b: BlocoDaFicha) => blocos.includes(b);
  const lesoes = useLesoes(tem('lesoes') ? alunoId : null);
  const arranjo = colunasDaAbaDados(faixa, largura, VAO, blocos);
  // Sem embrulho em volta do bloco: um que não desenha nada (as lesões fora do `CartaoLesoes`) não ocupa um vão da pilha.
  const colunas = arranjo?.map((c) => ({
    secoes: c.secoes, proporcao: c.proporcao,
    blocos: c.blocos.map((b) => (b === 'lesoes'
      ? <CartaoLesoes key={b} alunoId={alunoId} carga={lesoes} parte="tudo" />
      : <Fragment key={b}>{bloco(b)}</Fragment>)),
  }));
  return (
    // Em duas colunas a aba inteira (título, formulário e colunas) fica no teto do editor de campos, à esquerda (4.10, 24/11);
    // em três, cada coluna.
    <View style={[estilos.aba, { maxWidth: larguraMaximaDasColunas(arranjo, VAO) }]}>
      {tem('dadosDoAluno') ? bloco('dadosDoAluno', colunas) : colunas ? <ColunasDaFicha colunas={colunas.map((c) => ({ conteudo: c.blocos, proporcao: c.proporcao }))} /> : null}
      {!colunas ? ordemNumaColuna(blocos).map((p) => (
        p === 'lesoesAtivas' ? <CartaoLesoes key={p} alunoId={alunoId} carga={lesoes} parte="ativas" />
          : p === 'lesoesRecuperadas' ? <CartaoLesoes key={p} alunoId={alunoId} carga={lesoes} parte="recuperadas" />
            : <Fragment key={p}>{bloco(p)}</Fragment>
      )) : null}
    </View>
  );
}

/**
 * As colunas da aba (3:2 ou 1:1,2:1), alinhadas pelo topo e cada uma com a própria altura: a diferença fica só no fim da mais
 * curta. Coluna sem nada (a das seções, durante a edição) não é desenhada; a chave de cada uma é a posição no arranjo, então
 * as outras não remontam. Em três, nenhuma passa de `LARGURA_EDITOR_DE_CAMPOS`.
 */
export function ColunasDaFicha({ colunas }: { colunas: { conteudo: ReactNode[]; proporcao: number }[] }) {
  const tres = colunas.length === 3;
  return (
    <View style={estilos.colunas}>
      {colunas.map((c, i) => (c.conteudo.length ? (
        <View key={`coluna-${i}`} style={[estilos.coluna, { flex: c.proporcao }, tres && estilos.noTeto]}>{c.conteudo}</View>
      ) : null))}
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: VAO },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  coluna: { minWidth: 0, gap: VAO },
  noTeto: { maxWidth: LARGURA_EDITOR_DE_CAMPOS },
});
