import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { listarAtualizacoes } from '../../../api/rotas';
import type { SituacaoAtualizacao } from '../../../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataParaTela } from '../../../dominio/formatos';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, LARGURA_LISTA, RAIO } from '../../../tema/tokens';
import { Abas } from '../../../ui/Abas';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { LinkTexto } from '../../../ui/LinkTexto';
import { Selo } from '../../../ui/Selo';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';
import { Grade } from '../../../ui/Grade';

const ABAS:{valor:SituacaoAtualizacao;rotulo:string}[]=[
  {valor:'PARA_REVISAR',rotulo:'Para revisar'},{valor:'ATRASADAS',rotulo:'Atrasadas'},
  {valor:'AVISARAM_ATRASO',rotulo:'Avisaram atraso'},{valor:'PROXIMAS',rotulo:'Próximas 7 dias'},
];
export default function ListaAtualizacoes() {
  const {situacao,meus:meusParam}=useLocalSearchParams<{situacao?:string;meus?:string}>();
  const meus=meusParam==='true';
  const filtro=ABAS.find(a=>a.valor===situacao)?.valor??'PARA_REVISAR';
  const lista=useCarregar(`${filtro}:${meus}`,()=>listarAtualizacoes(filtro,meus));
  const {recarregar}=lista;
  const {cores}=useTema();
  useFocusEffect(useCallback(()=>{recarregar();},[recarregar]));
  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Atualizações" voltar="/treinador" />
    <Texto variante="suave">Atualizações enviadas pelos alunos em cada pasta: revise, acompanhe os atrasos e responda com feedback.{meus?' Mostrando só os seus alunos.':''}</Texto>
    <Abas abas={ABAS} ativa={filtro} aoMudar={valor=>router.setParams({situacao:valor})} />
    {lista.erro?<MensagemErro texto={textoDoErro(lista.erro)} tentarDeNovo={recarregar} />:null}
    {lista.carregando?<Esqueleto />:null}
    {!lista.carregando && lista.dados?.length===0?<Vazio titulo="Nenhuma atualização nesta lista" texto="As atualizações aparecem conforme o período da pasta e o envio do aluno." />:null}
    {lista.dados?.length?<Cartao titulo={ABAS.find(a=>a.valor===filtro)?.rotulo} descricao={`${lista.dados.length} ${lista.dados.length===1?'atualização':'atualizações'} nesta lista.`}>
      <Grade gap={espaco(2)}>{lista.dados.map(a=><View key={a.pastaId} style={[estilos.linha,{backgroundColor:cores.superficie2,borderColor:cores.borda}]}>
        <LinkTexto texto={a.nomeAluno??'Aluno'} href={caminhoAtualizacaoTreinador(a)} />
        <Texto numerico variante="suave">Atualização · {dataParaTela(a.dataAtualizacao)}</Texto>
        <Selo {...statusAtualizacaoTreinador(a)} />
      </View>)}</Grade>
    </Cartao>:null}
  </Tela>;
}
const estilos=StyleSheet.create({linha:{flexGrow:1,gap:espaco(1),padding:espaco(2),borderWidth:1,borderRadius:RAIO}});
