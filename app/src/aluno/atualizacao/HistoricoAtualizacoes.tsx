import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { atualizacoesAluno } from '../../api/rotas';
import { statusAtualizacao } from '../../dominio/atualizacao';
import { colunasDoHistorico } from '../../dominio/colunasDoHistorico';
import { dataParaTela } from '../../dominio/formatos';
import { periodoDesdeOPrimeiro } from '../../dominio/historicoDoAluno';
import { dividirEmColunas } from '../../dominio/listaEmColunas';
import { espaco } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Esqueleto } from '../../ui/Esqueleto';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

const VAO = espaco(3);

/**
 * Atualizações enviadas pelo aluno (só o Histórico usa). Nas faixas larga e ultralarga as linhas se dividem em 2 e 3
 * colunas lidas de cima para baixo (`dominio/colunasDoHistorico` + `dividirEmColunas`, o comportamento da
 * `treinador/ListaEmColunas`): a largura da coluna sai das colunas que cabem, então com poucas atualizações a vaga fica
 * vazia à direita e a linha não estica.
 */
export function HistoricoAtualizacoes() {
  const historico = useCarregar('atualizacoes-aluno',atualizacoesAluno);
  const { recarregar } = historico;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const faixa = useFaixaDaTela();
  const { largura, aoMedir } = useFaixaDeLargura();
  const colunas = colunasDoHistorico(largura, faixa, { vao: VAO });
  const linhas = (historico.dados ?? []).map(a => <LinhaDaLista key={a.id} titulo={`Atualização · ${dataParaTela(a.dataAtualizacao)}`} selos={[statusAtualizacao(a)]} href={`/aluno/atualizacao?id=${a.id}`} />);
  return <Cartao titulo="Atualizações" periodo={historico.dados ? periodoDesdeOPrimeiro(historico.dados.map((a) => a.dataAtualizacao)) : undefined} recolhivel recolhido={false}>
    {historico.erro ? <MensagemErro texto={textoDoErro(historico.erro)} /> : null}
    {historico.carregando ? <Esqueleto texto="Carregando atualizações" cartoes={1} /> : null}
    {historico.dados?.length === 0 ? <Texto variante="suave">Você ainda não enviou atualizações.</Texto> : null}
    {linhas.length ? <View onLayout={aoMedir} style={colunas > 1 ? estilos.colunas : null}>
      {colunas > 1
        ? dividirEmColunas(linhas, colunas).map((grupo, i) => <View key={i} style={{ width: (largura - VAO * (colunas - 1)) / colunas }}><ListaDeLinhas>{grupo}</ListaDeLinhas></View>)
        : <ListaDeLinhas>{linhas}</ListaDeLinhas>}
    </View> : null}
  </Cartao>;
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
});
