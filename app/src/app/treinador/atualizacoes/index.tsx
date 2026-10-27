import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { listarAtualizacoes, painelTreinador } from '../../../api/rotas';
import type { SituacaoAtualizacao } from '../../../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../../dominio/datasRelativas';
import { EscolhaResponsabilidade } from '../../../treinador/EscolhaResponsabilidade';
import { LARGURA_LISTA } from '../../../tema/tokens';
import { Abas } from '../../../ui/Abas';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../../../ui/LinhaDaLista';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';
import { useSessao } from '../../../sessao/SessaoProvider';

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
  // Contagem de cada aba vem do painel (mesmo filtro "Meus alunos"); se falhar, as abas ficam sem número.
  const {pode}=useSessao();
  // `/painel` exige PAINEL_VER: sem ela as abas ficam sem número, sem chamar a API à toa.
  const painel=useCarregar(pode('PAINEL_VER')?`painel-atualizacoes:${meus}`:null,()=>painelTreinador(meus));
  const contagens:Partial<Record<SituacaoAtualizacao,number>>=painel.dados?{PARA_REVISAR:painel.dados.atualizacoesParaRevisar,ATRASADAS:painel.dados.atualizacoesAtrasadas,AVISARAM_ATRASO:painel.dados.atualizacoesAvisaramAtraso,PROXIMAS:painel.dados.atualizacoesProximas}:{};
  const recarregarPainel=painel.recarregar;
  const itens=[...(lista.dados??[])].sort((x,y)=>(x.dataAtualizacao??'').localeCompare(y.dataAtualizacao??''));
  useFocusEffect(useCallback(()=>{recarregar();recarregarPainel();},[recarregar,recarregarPainel]));
  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Atualizações" mostrarMarca="celular" />
    <Texto variante="suave">Atualizações enviadas pelos alunos em cada pasta: revise, acompanhe os atrasos e responda com feedback.</Texto>
    {/* "Todos / Meus" mora no endereço, como a aba: o voltar desfaz e a revisão em fila segue o mesmo recorte. */}
    <EscolhaResponsabilidade valor={meus?'meus':'todos'} aoMudar={v=>router.replace({pathname:'/treinador/atualizacoes',params:v==='meus'?{situacao:filtro,meus:'true'}:{situacao:filtro}})} />
    <Abas abas={ABAS.map(a=>({...a,contagem:contagens[a.valor]}))} ativa={filtro} aoMudar={valor=>{ if(valor!==filtro) router.push({pathname:'/treinador/atualizacoes',params:meus?{situacao:valor,meus:'true'}:{situacao:valor}}); }} />
    {lista.erro?<MensagemErro texto={textoDoErro(lista.erro)} tentarDeNovo={recarregar} />:null}
    {lista.carregando?<Esqueleto />:null}
    {!lista.carregando && lista.dados?.length===0?<Vazio titulo="Nenhuma atualização nesta lista" texto="As atualizações aparecem conforme o período da pasta e o envio do aluno." />:null}
    {/* A aba já diz a lista: o cartão não repete o título. Mais antiga primeiro (é a que espera há mais tempo). */}
    {itens.length?<Cartao descricao={`${itens.length} ${itens.length===1?'atualização':'atualizações'}, da mais antiga para a mais nova.`}>
      <ListaDeLinhas>{itens.map(a=>{const selo=statusAtualizacaoTreinador(a);const data=dataSemAnoCorrente(a.dataAtualizacao);return <LinhaDaLista key={a.pastaId} titulo={a.nomeAluno??'Aluno'} metadados={`Data: ${data}`} selos={[{texto:selo.curto,tipo:selo.tipo}]} href={caminhoAtualizacaoTreinador(a,{situacao:filtro,meus})} rotulo={`Abrir atualização de ${a.nomeAluno??'aluno'}, ${data}, ${selo.curto}`} />;})}</ListaDeLinhas>
    </Cartao>:null}
  </Tela>;
}
