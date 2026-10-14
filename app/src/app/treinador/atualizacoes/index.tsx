import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { listarAtualizacoes, painelTreinador } from '../../../api/rotas';
import type { SituacaoAtualizacao } from '../../../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataParaTela } from '../../../dominio/formatos';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { Abas } from '../../../ui/Abas';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { ItemDeLista } from '../../../ui/ItemDeLista';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';
import { useSessao } from '../../../sessao/SessaoProvider';
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
  // Contagem de cada aba vem do painel (mesmo filtro "Meus alunos"); se falhar, as abas ficam sem número.
  const {pode}=useSessao();
  // `/painel` exige PAINEL_VER: sem ela as abas ficam sem número, sem chamar a API à toa.
  const painel=useCarregar(pode('PAINEL_VER')?`painel-atualizacoes:${meus}`:null,()=>painelTreinador(meus));
  const contagens:Partial<Record<SituacaoAtualizacao,number>>=painel.dados?{PARA_REVISAR:painel.dados.atualizacoesParaRevisar,ATRASADAS:painel.dados.atualizacoesAtrasadas,AVISARAM_ATRASO:painel.dados.atualizacoesAvisaramAtraso,PROXIMAS:painel.dados.atualizacoesProximas}:{};
  const recarregarPainel=painel.recarregar;
  useFocusEffect(useCallback(()=>{recarregar();recarregarPainel();},[recarregar,recarregarPainel]));
  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Atualizações" mostrarMarca="celular" />
    <Texto variante="suave">Atualizações enviadas pelos alunos em cada pasta: revise, acompanhe os atrasos e responda com feedback.{meus?' Mostrando só os seus alunos.':''}</Texto>
    <Abas abas={ABAS.map(a=>({...a,contagem:contagens[a.valor]}))} ativa={filtro} aoMudar={valor=>{ if(valor!==filtro) router.push({pathname:'/treinador/atualizacoes',params:meus?{situacao:valor,meus:'true'}:{situacao:valor}}); }} />
    {lista.erro?<MensagemErro texto={textoDoErro(lista.erro)} tentarDeNovo={recarregar} />:null}
    {lista.carregando?<Esqueleto />:null}
    {!lista.carregando && lista.dados?.length===0?<Vazio titulo="Nenhuma atualização nesta lista" texto="As atualizações aparecem conforme o período da pasta e o envio do aluno." />:null}
    {lista.dados?.length?<Cartao titulo={ABAS.find(a=>a.valor===filtro)?.rotulo} descricao={`${lista.dados.length} ${lista.dados.length===1?'atualização':'atualizações'} nesta lista.`}>
      <Grade gap={espaco(2)}>{lista.dados.map(a=><ItemDeLista key={a.pastaId} titulo={a.nomeAluno??'Aluno'} detalhe={`Atualização · ${dataParaTela(a.dataAtualizacao)}`} selo={statusAtualizacaoTreinador(a)} href={caminhoAtualizacaoTreinador(a,{situacao:filtro,meus})} rotulo={`Abrir atualização de ${a.nomeAluno??'aluno'}, ${dataParaTela(a.dataAtualizacao)}, ${statusAtualizacaoTreinador(a).texto}`} />)}</Grade>
    </Cartao>:null}
  </Tela>;
}
