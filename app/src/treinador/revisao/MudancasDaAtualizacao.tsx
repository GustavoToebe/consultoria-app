import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { atualizacoesDoAluno } from '../../api/rotas';
import type { Atualizacao } from '../../api/tipos';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import {
  atualizacaoAnterior, mudancasDaAtualizacao, TEXTO_NADA_MUDOU, TEXTO_PRIMEIRA_ATUALIZACAO,
} from '../../dominio/mudancasDaAtualizacao';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { textoDoErro } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * "O que mudou desde a última atualização" (bloco D, D5): no topo do Resumo do período, só fatos, "anterior → atual" com a
 * seta suave, sem verde nem vermelho; itens de pergunta que a anterior não tinha aparecem sem seta ("Quer trocar: Batata-doce").
 * Carga e erro próprios: nunca seguram o resto do resumo.
 * shortcut: busca o histórico inteiro do aluno (`GET /alunos/{id}/atualizacoes`, com respostas) para achar a anterior; trocar
 * por uma rota da anterior se o histórico ficar pesado.
 */
export function MudancasDaAtualizacao({ atualizacao: a }: { atualizacao: Atualizacao }) {
  const { cores } = useTema();
  const historico = useCarregar(`historico-atualizacoes:${a.alunoId}`, () => atualizacoesDoAluno(a.alunoId));
  const titulo = <Texto variante="rotulo" nivel={3} cor={cores.texto}>O que mudou</Texto>;
  const caixa = (corpo: ReactNode, data?: string | null) => (
    <View style={[estilos.caixa, { borderColor: cores.borda }]}>
      <View style={estilos.cabeca}>{titulo}{data ? <Texto variante="pequeno">{`desde a atualização de ${dataSemAnoCorrente(data)}`}</Texto> : null}</View>
      {corpo}
    </View>
  );
  if (historico.erro) return caixa(<MensagemErro texto={textoDoErro(historico.erro)} erro={historico.erro} tentarDeNovo={historico.recarregar} />);
  if (!historico.dados) return caixa(<Texto variante="suave">Comparando com a atualização anterior…</Texto>);
  const r = mudancasDaAtualizacao(a, atualizacaoAnterior(historico.dados, a));
  if (r.tipo === 'primeira') return caixa(<Texto variante="suave">{TEXTO_PRIMEIRA_ATUALIZACAO}</Texto>);
  if (r.mudancas.length === 0) return caixa(<Texto variante="suave">{TEXTO_NADA_MUDOU}</Texto>, r.dataAnterior);
  return caixa(
    <View role="list" style={estilos.lista}>
      {r.mudancas.map((m) => (
        <View key={m.chave} role="listitem" style={estilos.linha}>
          <Texto variante="pequeno" style={estilos.rotulo}>{m.rotulo}</Texto>
          {m.anterior === null ? <Texto cor={cores.texto}>{m.atual}</Texto> : (
            <Texto cor={cores.texto} numerico>
              {m.anterior}
              <Texto variante="suave" aria-hidden>{'  →  '}</Texto>
              <Texto style={estilos.soParaLeitor}>{' para '}</Texto>
              {m.atual}
            </Texto>
          )}
        </View>
      ))}
    </View>,
    r.dataAnterior,
  );
}

const estilos = StyleSheet.create({
  caixa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  cabeca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1) },
  lista: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1.5), rowGap: espaco(0.25) },
  rotulo: { minWidth: 140, flexShrink: 1 },
  // Só o leitor de tela ouve "para" no lugar da seta.
  soParaLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
