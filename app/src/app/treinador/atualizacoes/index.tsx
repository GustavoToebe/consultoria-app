import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { contagensAtualizacoes, listarAtualizacoesPagina, responsaveisEquipe, TAMANHO_DA_PAGINA_DE_ATUALIZACOES } from '../../../api/rotas';
import { ErroApi } from '../../../api/cliente';
import type { SituacaoAtualizacao } from '../../../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../../dominio/datasRelativas';
import { paraSetParams } from '../../../dominio/filtrosComuns';
import {
  CHAVES_DO_ENDERECO, chaveDosFiltros, chipsDosFiltros, lerDoEndereco, MAXIMO_DIAS, opcoesDeResponsavel,
  paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro, type ChaveDoFiltro, type FiltrosDeAtualizacoes,
} from '../../../dominio/filtrosDeAtualizacoes';
import { CamposDePeriodo, CelulaDoFiltro } from '../../../treinador/SeletoresDeFiltro';
import { SelecaoMultiplaSuspensa } from '../../../ui/SelecaoMultiplaSuspensa';
import { BarraDeFiltros } from '../../../ui/BarraDeFiltros';
import { ICONE_DO_SELO } from '../../../treinador/iconesDosSelos';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { Abas } from '../../../ui/Abas';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../../../ui/LinhaDaLista';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useAtrasado, useCarregar } from '../../../ui/useCarregar';
import { useSessao } from '../../../sessao/SessaoProvider';

const ABAS:{valor:SituacaoAtualizacao;rotulo:string}[]=[
  {valor:'PARA_REVISAR',rotulo:'Para revisar'},{valor:'ATRASADAS',rotulo:'Atrasadas'},
  {valor:'AVISARAM_ATRASO',rotulo:'Avisaram atraso'},{valor:'PROXIMAS',rotulo:'Próximas 7 dias'},
];
/** Fila vazia sem filtro: diz a situação escolhida (a explicação das abas fica na Ajuda). */
const VAZIO_DA_ABA:Record<SituacaoAtualizacao,string>={
  PARA_REVISAR:'Nenhuma atualização para revisar agora.',ATRASADAS:'Nenhuma atualização atrasada nesta lista.',
  AVISARAM_ATRASO:'Nenhum aviso de atraso nesta lista.',PROXIMAS:'Nenhuma atualização nos próximos 7 dias.',
};
/**
 * Atualizações enviadas pelos alunos: a situação nas abas (`?situacao=`, com a contagem) e, na barra de filtros, a busca
 * pelo nome, os responsáveis (vários) e a data (`docs/planos/filtros-nas-listas.md`, D5 e lote 2). Tudo vai à API (a
 * busca 300 ms depois de digitar); as abas contam com os mesmos filtros (`GET /atualizacoes/contagens`). Responsáveis e
 * data moram no endereço (`?meus=true` ou `?responsavel=<id>,nenhum`, `?de=&ate=`) e seguem, com a busca, para a
 * revisão em fila.
 */
export default function ListaAtualizacoes() {
  const parametros=useLocalSearchParams<{situacao?:string;meus?:string;responsavel?:string;de?:string;ate?:string;busca?:string}>();
  const filtro=ABAS.find(a=>a.valor===parametros.situacao)?.valor??'PARA_REVISAR';
  const filtros=lerDoEndereco(parametros);
  const {usuario}=useSessao();
  // A busca vem do endereço só ao abrir (o "Voltar para a lista" da fila a traz); depois é digitada aqui.
  const [busca,setBusca]=useState(()=>typeof parametros.busca==='string'?parametros.busca.slice(0,100):'');
  const buscaAtrasada=useAtrasado(busca.trim(),300);
  const pedido=pedidoDaApi(filtros,buscaAtrasada,usuario?.id);
  const chave=chaveDosFiltros(filtros,buscaAtrasada);
  // A página volta à primeira quando muda a aba, a busca ou um filtro: ela só vale para a consulta em que foi escolhida.
  const consulta=`${filtro}:${chave}`;
  const [escolhida,setEscolhida]=useState({consulta:'',pagina:0});
  const pagina=escolhida.consulta===consulta?escolhida.pagina:0;
  const irParaPagina=(n:number)=>setEscolhida({consulta,pagina:n});
  const lista=useCarregar(`${consulta}:${pagina}`,()=>listarAtualizacoesPagina(filtro,pagina,pedido.meus,pedido.filtro));
  const {recarregar}=lista;
  // Contagem de cada aba com os mesmos filtros da lista; se falhar, as abas ficam sem número (nunca um número errado).
  const contagem=useCarregar(`contagens-atualizacoes:${chave}`,()=>contagensAtualizacoes(pedido.meus,pedido.filtro));
  const contagens:Partial<Record<SituacaoAtualizacao,number>>=contagem.dados??{};
  const recarregarContagens=contagem.recarregar;
  const listaDeResponsaveis=useCarregar('responsaveis-atualizacoes',()=>responsaveisEquipe());
  const responsaveis=listaDeResponsaveis.dados??[];
  // Sem permissão para ver a equipe (403) o filtro fica só com "Todos" e "Meus", sem aviso; qualquer outra falha avisa.
  const erroDosResponsaveis=listaDeResponsaveis.erro instanceof ErroApi&&listaDeResponsaveis.erro.status===403?null:listaDeResponsaveis.erro;
  const nomeDe=(id:string)=>responsaveis.find(r=>r.id===id)?.nome??null;
  const itens=lista.dados?.itens??[];
  const total=lista.dados?.total??0;
  const paginas=Math.max(1,Math.ceil(total/TAMANHO_DA_PAGINA_DE_ATUALIZACOES));
  // Revisou a última da última página: volta uma página em vez de mostrar uma página vazia.
  if(!lista.carregando&&lista.dados&&pagina>0&&pagina!==paginas-1&&itens.length===0&&total>0) irParaPagina(paginas-1);
  useFocusEffect(useCallback(()=>{recarregar();recarregarContagens();},[recarregar,recarregarContagens]));
  // Trocar um filtro troca o endereço sem empilhar histórico (o voltar sai da tela); a aba fica.
  const aplicar=(novos:FiltrosDeAtualizacoes)=>router.setParams(paraSetParams(CHAVES_DO_ENDERECO,paraEndereco(novos)));
  const chips=chipsDosFiltros(filtros,nomeDe);
  const responsavelDaFila=pedido.filtro.responsavel&&typeof pedido.filtro.responsavel!=='string'?pedido.filtro.responsavel.join(','):undefined;
  const fila={situacao:filtro,meus:pedido.meus,...(responsavelDaFila?{responsavel:responsavelDaFila}:{}),...(pedido.filtro.de&&pedido.filtro.ate?{de:pedido.filtro.de,ate:pedido.filtro.ate}:{}),...(buscaAtrasada?{busca:buscaAtrasada}:{})};
  // A busca que vale é a que já foi à API (a lista na tela é dela).
  const filtrado=chips.length>0||!!buscaAtrasada;
  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Atualizações" subtitulo="Revise os envios e acompanhe os prazos." mostrarMarca="celular" />
    <BarraDeFiltros busca={{valor:busca,aoMudar:setBusca,placeholder:'Nome do aluno'}} valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS}
      chips={chips} aoTirar={(chave)=>aplicar(semOFiltro(filtros,chave as ChaveDoFiltro))} rotuloDoResultado="Ver atualizações"
      seletores={(atuais,mudar)=><>
        <CelulaDoFiltro><SelecaoMultiplaSuspensa rotulo="Responsável" opcoes={opcoesDeResponsavel(responsaveis,usuario?.id)} marcados={new Set(atuais.responsaveis)} aoMudar={(m)=>mudar({...atuais,responsaveis:[...m]})} rotuloDeTodos="Todos" style={{alignSelf:'stretch'}} /></CelulaDoFiltro>
        <CelulaDoFiltro><CamposDePeriodo rotulo="Data da atualização" regra="PLANEJAMENTO" osDois maximoDias={MAXIMO_DIAS} valor={atuais.periodo} aoMudar={(periodo)=>mudar({...atuais,periodo})} /></CelulaDoFiltro>
      </>} />
    {/* A aba (situação) é um passo do histórico; os filtros da barra vão junto. */}
    <Abas abas={ABAS.map(a=>({...a,contagem:contagens[a.valor]}))} ativa={filtro} aoMudar={valor=>{ if(valor!==filtro) router.push({pathname:'/treinador/atualizacoes',params:{situacao:valor,...paraEndereco(filtros)}}); }} />
    {erroDosResponsaveis?<MensagemErro texto={`Não foi possível carregar a lista de responsáveis do filtro. ${textoDoErro(erroDosResponsaveis)}`} erro={erroDosResponsaveis} tentarDeNovo={listaDeResponsaveis.recarregar} />:null}
    {/* Falha não vira lista vazia: sem dados o vazio não aparece, só a mensagem com o tentar de novo. */}
    {lista.erro?<MensagemErro texto={`Não foi possível carregar as atualizações. ${textoDoErro(lista.erro)}`} erro={lista.erro} tentarDeNovo={recarregar} />:null}
    {lista.carregando?<Esqueleto />:null}
    {!lista.carregando && lista.dados && total===0?(filtrado
      ?<Vazio titulo={buscaAtrasada?`Nenhuma atualização para "${buscaAtrasada}"`:'Nenhuma atualização com esses filtros'} texto="Confira o nome, tire algum filtro ou limpe tudo."
        acao={{rotulo:'Limpar filtros',aoTocar:()=>{setBusca('');if(chips.length) aplicar(SEM_FILTROS);}}} />
      :<Vazio texto={VAZIO_DA_ABA[filtro]} />):null}
    {/* A aba já diz a lista: a faixa do cartão leva a contagem, não repete o nome da aba. Mais antiga primeiro (é a
        que espera há mais tempo). Sem título o cartão não tinha faixa e a descrição nem aparecia. */}
    {itens.length?<Cartao titulo={`${total} ${total===1?'atualização':'atualizações'}`} descricao="Da mais antiga para a mais nova.">
      <ListaDeLinhas>{itens.map(a=>{const selo=statusAtualizacaoTreinador(a);const data=dataSemAnoCorrente(a.dataAtualizacao);return <LinhaDaLista key={a.pastaId} titulo={a.nomeAluno??'Aluno'} metadados={`Data: ${data}`} selos={[{texto:selo.curto,tipo:selo.tipo,Icone:ICONE_DO_SELO[selo.tipo]}]} href={caminhoAtualizacaoTreinador(a,fila)} rotulo={`Abrir atualização de ${a.nomeAluno??'aluno'}, ${data}, ${selo.curto}`} />;})}</ListaDeLinhas>
      {total>TAMANHO_DA_PAGINA_DE_ATUALIZACOES?<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:espaco(1),flexWrap:'wrap'}}>
        <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina===0} aoTocar={()=>irParaPagina(pagina-1)} />
        <Texto variante="suave">Página {pagina+1} de {paginas} · {total} atualizações</Texto>
        <Botao rotulo="Próxima" tipo="secundario" desabilitado={pagina+1>=paginas} aoTocar={()=>irParaPagina(pagina+1)} />
      </View>:null}
    </Cartao>:null}
  </Tela>;
}
