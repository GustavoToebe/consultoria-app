import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { abaixoDasColunas, colunaUnica, colunasDaAbaDados, larguraMaximaDasColunas, ordemNumaColuna, tetoDaColunaUnica, type SecaoDosDados } from '../dominio/colunasDaFicha';
import type { BlocoDaFicha } from '../dominio/fichaDoAluno';
import { espaco, LARGURA_EDITOR_DE_CAMPOS, LARGURA_FAIXA_NORMAL } from '../tema/tokens';
import { useFaixaDaTela } from '../ui/Tela';
import { CartaoLesoes, useLesoes } from './CartaoLesoes';

/** Uma coluna da aba: as seções dos Dados que a abrem (postas pelo `DadosDoAluno`) e os blocos que vêm depois; `teto`, a largura máxima dela. */
export interface ColunaDaFicha { secoes: SecaoDosDados[]; blocos: ReactNode[]; proporcao: number; teto?: number }

const VAO = espaco(3);

/**
 * Arranjo da aba Ficha do aluno (Ficha › Dados; regra em `dominio/colunasDaFicha.colunasDaAbaDados`, planos
 * `docs/planos/ficha-dados-colunas-independentes.md` e `tela-larga-revisao-2.md`). A partir da faixa `normal` da `Tela`
 * (`useFaixaDaTela`, 4.10): duas colunas independentes, 3 para 2, cada uma uma pilha com o mesmo vão: Identificação ›
 * Contato e endereço › Plano contratado à esquerda; Configuração do acompanhamento › Objetivo e observações › Acesso ao app
 * › Anamnese à direita; e o Histórico de lesões embaixo das duas, na largura delas (`abaixoDasColunas`). Com a largura medida da aba (`largura`, a do cabeçalho da ficha) para
 * três colunas (2560 e 3440 com o menu aberto), três pilhas: Identificação › Contato › Objetivo; Plano › Lesões;
 * Acompanhamento › Acesso › Anamnese. As seções são do `DadosDoAluno`, que recebe as colunas (`colunas`). Numa coluna (faixa
 * `compacta`): os Dados e, depois, Lesões ativas › Plano › Acesso › Anamnese › Histórico (as recuperadas). Só aparece o que
 * `blocos` traz (`blocosDaAba`); as lesões são buscadas uma vez aqui e repartidas. Em duas colunas com a esquerda vazia (na
 * edição, sem o Plano contratado), uma coluna só, com o Histórico, na largura que a esquerda teria (`colunaUnica`, 24/11).
 */
export function BlocosDaFicha({ alunoId, blocos, largura, editando, bloco }: {
  alunoId: string; blocos: readonly BlocoDaFicha[];
  /** A ficha está editando os Dados: as seções saem das colunas (o formulário fica em cima). */
  editando: boolean;
  /** Largura medida da aba: decide entre duas e três colunas. */
  largura: number;
  /** `colunas` só chega ao `dadosDoAluno`, em duas ou três colunas. */
  bloco: (b: BlocoDaFicha, colunas?: ColunaDaFicha[]) => ReactNode;
}) {
  const faixa = useFaixaDaTela();
  const tem = (b: BlocoDaFicha) => blocos.includes(b);
  const lesoes = useLesoes(tem('lesoes') ? alunoId : null);
  // A faixa da `Tela` ainda `compacta` com a aba já medida larga é medida atrasada (o `onLayout` da `Tela` às vezes vem depois
  // do do cabeçalho): espera, em vez de montar numa coluna e remontar em duas, buscando tudo de novo (o guarda do Início do
  // aluno, `CorpoDoInicio`). Fora da `ultralarga` a área da `Tela` é a aba mais o recuo de `espaco(2)` de cada lado.
  // shortcut: a conta deduz o atraso pelo recuo da `Tela`; trocar por um contexto da `Tela` que diga "ainda não medi" quando o recuo mudar.
  const atrasada = faixa === 'compacta' && largura + 2 * espaco(2) >= LARGURA_FAIXA_NORMAL;
  const arranjo = colunasDaAbaDados(faixa, largura, VAO, blocos);
  const maximo = larguraMaximaDasColunas(arranjo, VAO, faixa);
  // Em três, cada coluna para no editor de campos; numa só (a esquerda vazia), na largura que a esquerda teria nas duas.
  const teto = arranjo?.length === 3 ? LARGURA_EDITOR_DE_CAMPOS : colunaUnica(arranjo, editando) ? tetoDaColunaUnica(Math.min(largura, maximo ?? largura), VAO) : undefined;
  // Sem embrulho em volta do bloco: um que não desenha nada (as lesões fora do `CartaoLesoes`) não ocupa um vão da pilha.
  const colunas = arranjo?.map((c) => ({
    secoes: c.secoes, proporcao: c.proporcao, teto,
    blocos: c.blocos.map((b) => (b === 'lesoes'
      ? <CartaoLesoes key={b} alunoId={alunoId} carga={lesoes} parte="tudo" />
      : <Fragment key={b}>{bloco(b)}</Fragment>)),
  }));
  if (atrasada) return null;
  return (
    // Em duas colunas (normal e larga) a aba ocupa a largura do conteúdo (D1, 25/11); em três, cada coluna para no editor de
    // campos; com a coluna única, ela e o Histórico (o formulário de edição tem a mesma largura da leitura, 25/11).
    <View style={[estilos.aba, { maxWidth: maximo }]}>
      {tem('dadosDoAluno') ? bloco('dadosDoAluno', colunas) : colunas ? <ColunasDaFicha colunas={colunas.map((c) => ({ conteudo: c.blocos, proporcao: c.proporcao, teto: c.teto }))} /> : null}
      {/* Em duas colunas, o Histórico de lesões embaixo delas, na largura das duas somada (24/11), ou na da coluna única; em
          três, na do meio. O embrulho fica sempre (a parte "tudo" sempre desenha), para não remontar ao entrar na edição. */}
      {abaixoDasColunas(arranjo, blocos).map((b) => <View key={b} style={{ maxWidth: teto }}><CartaoLesoes alunoId={alunoId} carga={lesoes} parte="tudo" /></View>)}
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
 * as outras não remontam. Cada uma para no `teto` dela (em três, `LARGURA_EDITOR_DE_CAMPOS`; a coluna única, o da esquerda).
 */
export function ColunasDaFicha({ colunas }: { colunas: { conteudo: ReactNode[]; proporcao: number; teto?: number }[] }) {
  return (
    <View style={estilos.colunas}>
      {colunas.map((c, i) => (c.conteudo.length ? (
        <View key={`coluna-${i}`} style={[estilos.coluna, { flex: c.proporcao, maxWidth: c.teto }]}>{c.conteudo}</View>
      ) : null))}
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: VAO },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  coluna: { minWidth: 0, gap: VAO },
});
