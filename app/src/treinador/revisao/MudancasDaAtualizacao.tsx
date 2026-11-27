import { StyleSheet, View } from 'react-native';

import { atualizacoesDoAluno } from '../../api/rotas';
import type { Atualizacao } from '../../api/tipos';
import { pontosDeAtencaoVisiveis } from '../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import {
  atualizacaoAnterior, mudancasDaAtualizacao, TEXTO_NADA_MUDOU, TEXTO_PRIMEIRA_ATUALIZACAO,
} from '../../dominio/mudancasDaAtualizacao';
import { outrasMudancas, pontosDeAtencao } from '../../dominio/pontosDeAtencao';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { textoDoErro } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { AnteriorParaAtual, PontosDeAtencao, RECUO_DOS_PONTOS, useRotuloDaLinha } from './PontosDeAtencao';

/** Todas as mudanças já estão nos pontos de atenção acima: "nada mudou" contradiria o "7 → 4" de cima. */
const TEXTO_NADA_MAIS_MUDOU = 'Nenhuma outra resposta comparável mudou.';

/**
 * "O que mudou desde a última atualização" (bloco D, D5): no topo do Resumo do período, só fatos, "anterior → atual" com a
 * seta suave, sem verde nem vermelho. Carga e erro próprios: nunca seguram o resto do resumo. Com as regras de atenção, os
 * pontos de atenção (`PontosDeAtencao`) abrem a caixa: vêm do detalhe e aparecem já, sem esperar o histórico (que só lhes
 * acrescenta o "anterior → atual"); as linhas que eles mostram saem da lista de baixo (`outrasMudancas`).
 * shortcut: busca o histórico inteiro do aluno (`GET /alunos/{id}/atualizacoes`, com respostas) para achar a anterior; trocar
 * por uma rota da anterior se o histórico ficar pesado.
 */
export function MudancasDaAtualizacao({ atualizacao: a }: { atualizacao: Atualizacao }) {
  const { cores } = useTema();
  const { pode, regrasAtencaoHabilitada } = useSessao();
  const rotulo = useRotuloDaLinha();
  const historico = useCarregar(`historico-atualizacoes:${a.alunoId}`, () => atualizacoesDoAluno(a.alunoId));
  const r = historico.dados ? mudancasDaAtualizacao(a, atualizacaoAnterior(historico.dados, a)) : null;
  const pontos = pontosDeAtencaoVisiveis(regrasAtencaoHabilitada, pode) ? pontosDeAtencao(a, r) : [];
  const corpo = () => {
    if (historico.erro) return <MensagemErro texto={textoDoErro(historico.erro)} erro={historico.erro} tentarDeNovo={historico.recarregar} />;
    if (!r) return <Texto variante="suave">Comparando com a atualização anterior…</Texto>;
    if (r.tipo === 'primeira') return <Texto variante="suave">{TEXTO_PRIMEIRA_ATUALIZACAO}</Texto>;
    const outras = outrasMudancas(r.mudancas, pontos);
    if (outras.length === 0) return <Texto variante="suave">{r.mudancas.length ? TEXTO_NADA_MAIS_MUDOU : TEXTO_NADA_MUDOU}</Texto>;
    return (
      <View role="list" aria-label="O que mudou" style={estilos.lista}>
        {outras.map((m) => (
          <View key={m.chave} role="listitem" style={estilos.linha}>
            <Texto variante="pequeno" style={rotulo}>{m.rotulo}</Texto>
            <AnteriorParaAtual mudanca={m} />
          </View>
        ))}
      </View>
    );
  };
  const data = r?.tipo === 'comparada' ? r.dataAnterior : null;
  return (
    <View style={[estilos.caixa, { borderColor: cores.borda }]}>
      <PontosDeAtencao pontos={pontos} />
      {/* Com os pontos acima: o fio separa os dois grupos sem depender da cor (no escuro o degradê some no fim) e o texto
          começa na mesma borda do texto dos pontos (que recuam a barrinha). */}
      <View style={[estilos.secao, pontos.length ? { paddingLeft: RECUO_DOS_PONTOS, borderTopWidth: 1, borderTopColor: cores.divisor } : null]}>
        <View style={estilos.cabeca}>
          <Texto variante="rotulo" nivel={3} cor={cores.texto}>O que mudou</Texto>
          {data ? <Texto variante="pequeno">{`desde a atualização de ${dataSemAnoCorrente(data)}`}</Texto> : null}
        </View>
        {corpo()}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // `overflow` recorta o fundo pintado dos pontos de atenção no canto da caixa.
  caixa: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  secao: { padding: espaco(1.5), gap: espaco(1) },
  cabeca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1) },
  lista: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1.5), rowGap: espaco(0.25) },
});
