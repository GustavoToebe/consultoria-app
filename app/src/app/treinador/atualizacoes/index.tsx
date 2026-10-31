import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { listarAtualizacoes, painelTreinador, responsaveisEquipe } from '../../../api/rotas';
import type { ResponsavelEquipe } from '../../../api/equipeTipos';
import type { SituacaoAtualizacao } from '../../../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../../dominio/datasRelativas';
import { paraSetParams } from '../../../dominio/filtrosComuns';
import {
  CHAVES_DO_ENDERECO, chaveDosFiltros, chipsDosFiltros, contagensValem, filtrarPorNome, lerDoEndereco, MAXIMO_DIAS, opcoesDeResponsavel,
  paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro, type ChaveDoFiltro, type FiltrosDeAtualizacoes,
} from '../../../dominio/filtrosDeAtualizacoes';
import { CamposDePeriodo, CelulaDoFiltro, UmaOpcao } from '../../../treinador/SeletoresDeFiltro';
import { BarraDeFiltros } from '../../../ui/BarraDeFiltros';
import { ICONE_DO_SELO } from '../../../treinador/iconesDosSelos';
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
/**
 * Atualizações enviadas pelos alunos: a situação nas abas (`?situacao=`, com a contagem) e, na barra de filtros, a busca
 * pelo nome (local: a lista vem inteira), o responsável e a data (`docs/planos/filtros-nas-listas.md`, D5). Os filtros
 * moram no endereço (`?meus=true` ou `?responsavel=<id>`, `?de=&ate=`) e seguem para a revisão em fila.
 */
export default function ListaAtualizacoes() {
  const parametros=useLocalSearchParams<{situacao?:string;meus?:string;responsavel?:string;de?:string;ate?:string}>();
  const filtro=ABAS.find(a=>a.valor===parametros.situacao)?.valor??'PARA_REVISAR';
  const filtros=lerDoEndereco(parametros);
  const pedido=pedidoDaApi(filtros);
  const meus=pedido.meus;
  const [busca,setBusca]=useState('');
  const lista=useCarregar(`${filtro}:${chaveDosFiltros(filtros)}`,()=>listarAtualizacoes(filtro,pedido.meus,pedido.filtro));
  const {recarregar}=lista;
  // Contagem de cada aba vem do painel (mesmo filtro "Meus alunos"); se falhar, as abas ficam sem número. Com uma pessoa
  // ou uma data o painel não bate com a lista: as abas ficam sem número.
  const {pode,usuario}=useSessao();
  // `/painel` exige PAINEL_VER: sem ela as abas ficam sem número, sem chamar a API à toa.
  const painel=useCarregar(pode('PAINEL_VER')&&contagensValem(filtros)?`painel-atualizacoes:${meus}`:null,()=>painelTreinador(meus));
  const contagens:Partial<Record<SituacaoAtualizacao,number>>=painel.dados&&contagensValem(filtros)?{PARA_REVISAR:painel.dados.atualizacoesParaRevisar,ATRASADAS:painel.dados.atualizacoesAtrasadas,AVISARAM_ATRASO:painel.dados.atualizacoesAvisaramAtraso,PROXIMAS:painel.dados.atualizacoesProximas}:{};
  const recarregarPainel=painel.recarregar;
  const responsaveis=useCarregar('responsaveis-atualizacoes',()=>responsaveisEquipe().catch(():ResponsavelEquipe[]=>[])).dados??[];
  const nomeDe=(id:string)=>responsaveis.find(r=>r.id===id)?.nome??null;
  const itens=filtrarPorNome(lista.dados??[],busca).sort((x,y)=>(x.dataAtualizacao??'').localeCompare(y.dataAtualizacao??''));
  useFocusEffect(useCallback(()=>{recarregar();recarregarPainel();},[recarregar,recarregarPainel]));
  // Trocar um filtro troca o endereço sem empilhar histórico (o voltar sai da tela); a aba fica.
  const aplicar=(novos:FiltrosDeAtualizacoes)=>router.setParams(paraSetParams(CHAVES_DO_ENDERECO,paraEndereco(novos)));
  const chips=chipsDosFiltros(filtros,nomeDe);
  const fila={situacao:filtro,meus,...(pedido.filtro.responsavel?{responsavel:pedido.filtro.responsavel}:{}),...(pedido.filtro.de&&pedido.filtro.ate?{de:pedido.filtro.de,ate:pedido.filtro.ate}:{})};
  const filtrado=chips.length>0||!!busca.trim();
  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Atualizações" mostrarMarca="celular" />
    <Texto variante="suave">Atualizações enviadas pelos alunos em cada pasta: revise, acompanhe os atrasos e responda com feedback.</Texto>
    <BarraDeFiltros busca={{valor:busca,aoMudar:setBusca,placeholder:'Nome do aluno'}} valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS}
      chips={chips} aoTirar={(chave)=>aplicar(semOFiltro(filtros,chave as ChaveDoFiltro))} rotuloDoResultado="Ver atualizações"
      seletores={(atuais,mudar)=><>
        <CelulaDoFiltro><UmaOpcao rotulo="Responsável" valor={atuais.responsavel} opcoes={opcoesDeResponsavel(responsaveis,usuario?.id)} aoMudar={(responsavel)=>mudar({...atuais,responsavel})} /></CelulaDoFiltro>
        <CelulaDoFiltro><CamposDePeriodo rotulo="Data da atualização" osDois maximoDias={MAXIMO_DIAS} valor={atuais.periodo} aoMudar={(periodo)=>mudar({...atuais,periodo})} /></CelulaDoFiltro>
      </>} />
    {/* A aba (situação) é um passo do histórico; os filtros da barra vão junto. */}
    <Abas abas={ABAS.map(a=>({...a,contagem:contagens[a.valor]}))} ativa={filtro} aoMudar={valor=>{ if(valor!==filtro) router.push({pathname:'/treinador/atualizacoes',params:{situacao:valor,...paraEndereco(filtros)}}); }} />
    {lista.erro?<MensagemErro texto={textoDoErro(lista.erro)} tentarDeNovo={recarregar} />:null}
    {lista.carregando?<Esqueleto />:null}
    {!lista.carregando && lista.dados && itens.length===0?<Vazio titulo={filtrado?'Nenhuma atualização com esses filtros':'Nenhuma atualização nesta lista'} texto={filtrado?'Tire algum filtro ou limpe a busca.':'As atualizações aparecem conforme o período da pasta e o envio do aluno.'}
      acao={chips.length?{rotulo:'Limpar filtros',aoTocar:()=>aplicar(SEM_FILTROS)}:undefined} />:null}
    {/* A aba já diz a lista: a faixa do cartão leva a contagem, não repete o nome da aba. Mais antiga primeiro (é a
        que espera há mais tempo). Sem título o cartão não tinha faixa e a descrição nem aparecia. */}
    {itens.length?<Cartao titulo={`${itens.length} ${itens.length===1?'atualização':'atualizações'}`} descricao="Da mais antiga para a mais nova.">
      <ListaDeLinhas>{itens.map(a=>{const selo=statusAtualizacaoTreinador(a);const data=dataSemAnoCorrente(a.dataAtualizacao);return <LinhaDaLista key={a.pastaId} titulo={a.nomeAluno??'Aluno'} metadados={`Data: ${data}`} selos={[{texto:selo.curto,tipo:selo.tipo,Icone:ICONE_DO_SELO[selo.tipo]}]} href={caminhoAtualizacaoTreinador(a,fila)} rotulo={`Abrir atualização de ${a.nomeAluno??'aluno'}, ${data}, ${selo.curto}`} />;})}</ListaDeLinhas>
    </Cartao>:null}
  </Tela>;
}
