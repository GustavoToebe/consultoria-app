import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BlocoDaFicha } from '../dominio/fichaDoAluno';
import { espaco } from '../tema/tokens';
import { useFaixaDeLargura } from '../ui/useFaixaDeLargura';
import { CartaoLesoes, useLesoes } from './CartaoLesoes';

/**
 * Arranjo da aba Ficha do aluno (Ficha › Dados, 23/11; plano `docs/planos/ficha-do-aluno-dados.md`). Os Dados do aluno
 * ficam em cima, na largura toda. A partir da faixa `normal` (medida pela área de conteúdo, `useFaixaDeLargura`): duas
 * colunas, "Plano contratado" à esquerda (2fr) e "Acesso ao app" e "Anamnese" empilhados à direita (1fr); sem o plano
 * (sem permissão ou Financeiro desligado) os dois dividem a linha. "Histórico de lesões" na largura toda, logo abaixo,
 * com as ativas primeiro. Numa coluna (faixa `compacta`, o celular e o PC estreito): Lesões ativas (se houver) › Plano ›
 * Acesso › Anamnese › Histórico (as recuperadas). Só aparece o que `blocos` traz (a regra de cada bloco é a de
 * `blocosDaAba`); as lesões são buscadas uma vez aqui e repartidas.
 */
export function BlocosDaFicha({ alunoId, blocos, bloco }: { alunoId: string; blocos: readonly BlocoDaFicha[]; bloco: (b: BlocoDaFicha) => ReactNode }) {
  const { largura, faixa, aoMedir } = useFaixaDeLargura();
  const tem = (b: BlocoDaFicha) => blocos.includes(b);
  const lesoes = useLesoes(tem('lesoes') ? alunoId : null);
  const colunas = faixa !== 'compacta';
  // Antes da primeira medida não se sabe o arranjo: montar numa coluna e remontar em duas buscaria tudo duas vezes.
  const medido = largura > 0;
  const lateral = (['acessoAoApp', 'anamnese'] as const).filter(tem);
  return (
    <View onLayout={aoMedir} style={estilos.aba}>
      {tem('dadosDoAluno') ? bloco('dadosDoAluno') : null}
      {!medido ? null : (
        <>
          {!colunas && tem('lesoes') ? <CartaoLesoes alunoId={alunoId} carga={lesoes} parte="ativas" /> : null}
          {colunas ? (
            <View style={estilos.linha}>
              {tem('planoContratado') ? <View style={estilos.principal}>{bloco('planoContratado')}</View> : null}
              {tem('planoContratado') ? (
                <View style={estilos.lateral}>{lateral.map((b) => <View key={b}>{bloco(b)}</View>)}</View>
              ) : lateral.map((b) => <View key={b} style={estilos.metade}>{bloco(b)}</View>)}
            </View>
          ) : (
            (['planoContratado', ...lateral] as const).filter(tem).map((b) => <View key={b}>{bloco(b)}</View>)
          )}
          {tem('lesoes') ? <CartaoLesoes alunoId={alunoId} carga={lesoes} parte={colunas ? 'tudo' : 'recuperadas'} /> : null}
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: espaco(3) },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  principal: { flex: 2, minWidth: 0 },
  lateral: { flex: 1, minWidth: 0, gap: espaco(3) },
  metade: { flex: 1, minWidth: 0 },
});
