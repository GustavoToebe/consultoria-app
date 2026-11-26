import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { FeedbackAtualizacao } from '../../../aluno/atualizacao/FeedbackAtualizacao';
import { QuestionarioAtualizacao } from '../../../aluno/atualizacao/QuestionarioAtualizacao';
import { ErroApi } from '../../../api/cliente';
import { atualizacaoDoAluno, baixarFotoDoTreinador, detalheAtualizacao, listarAtualizacoes, responderAtualizacao } from '../../../api/rotas';
import type { Atualizacao } from '../../../api/tipos';
import { arranjoPrincipalComApoio, TOPO_DO_APOIO } from '../../../dominio/arranjoPrincipalComApoio';
import { caminhoAtualizacaoTreinador, caminhoListaAtualizacoes, filaDosParametros, filtroDaFila, type FilaDeAtualizacoes, proximaDaFila, statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../../dominio/datasRelativas';
import { dataParaTela } from '../../../dominio/formatos';
import { abaDaRevisao, apoioDaRevisao, tetoDaRevisao, type AbaDaRevisao } from '../../../dominio/revisaoDaAtualizacao';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { ICONE_DO_SELO } from '../../../treinador/iconesDosSelos';
import { ResumoDaAtualizacao } from '../../../treinador/ResumoDaAtualizacao';
import { blocosDaEvolucaoDaRevisao, EvolucaoDaRevisao } from '../../../treinador/revisao/EvolucaoDaRevisao';
import { MudancasDaAtualizacao } from '../../../treinador/revisao/MudancasDaAtualizacao';
import { PrescritoDaAtualizacao } from '../../../treinador/revisao/PrescritoDaAtualizacao';
import { Abas } from '../../../ui/Abas';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Campo } from '../../../ui/Campo';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { LinkTexto } from '../../../ui/LinkTexto';
import { PrincipalComApoio } from '../../../ui/PrincipalComApoio';
import { Selo } from '../../../ui/Selo';
import { Tela, useFaixaDaTela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';
import { useFaixaDeLargura } from '../../../ui/useFaixaDeLargura';

type Params = { id: string; alunoId?: string; situacao?: string; meus?: string; responsavel?: string; de?: string; ate?: string; busca?: string; aba?: string };

/**
 * Revisão da atualização pelo treinador (bloco D de `docs/planos/atualizacao-pasta-e-questionarios.md`, 2.2 de
 * `orientacoes-de-design-26-11.md`). Com espaço (`PrincipalComApoio`, 952 de área), a principal tem as abas Respostas (o
 * Resumo do período com "O que mudou" no topo e as respostas em ordem) e Evolução (os cartões da ficha); o apoio, fixo ao rolar,
 * tem o Feedback e a navegação da fila em cima e "O que está prescrito" embaixo, com rolagem própria. Sem espaço, empilha:
 * Resumo, Feedback, Prescrito e Respostas. O texto do feedback mora aqui, fora das duas composições: cruzar o limite (girar o
 * tablet, redimensionar a janela) não perde o que foi digitado.
 */
export default function AtualizacaoTreinador() {
  return <Tela largura={LARGURA_LISTA} bordas={['top']}><RevisaoDaAtualizacao /></Tela>;
}

function RevisaoDaAtualizacao() {
  const {pode}=useSessao();
  const {id,alunoId,situacao,meus,responsavel,de,ate,busca,aba:abaDaUrl}=useLocalSearchParams<Params>();
  const fila=filaDosParametros(situacao,meus,{responsavel,de,ate,busca});
  const detalhe=useCarregar(id==='previa'?alunoId??null:id??null,()=>
    id==='previa' ? atualizacaoDoAluno(alunoId!) : detalheAtualizacao(id));
  const a=detalhe.dados;
  const faixa=useFaixaDaTela();
  const {largura,aoMedir}=useFaixaDeLargura();
  const data=a?.dataAtualizacao?dataSemAnoCorrente(a.dataAtualizacao):'';
  const titulo=a?`${a.nomeAluno??'Aluno'} · Atualização${data?` ${data}`:''}`:'Atualização';
  return <View onLayout={aoMedir} style={[estilos.composicao,{maxWidth:tetoDaRevisao(faixa)}]}>
    <Cabecalho titulo={titulo}
      descricao="O que o aluno enviou ao fim do período: leia as respostas e as fotos, compare com o que está prescrito, responda com feedback e siga para a próxima da fila."
      voltar="/treinador/atualizacoes" trilha={[
        {rotulo:'Alunos',href:'/treinador/alunos'},
        {rotulo:a?.nomeAluno??'Aluno',href:a?`/treinador/alunos/${a.alunoId}`:undefined},
        {rotulo:`Atualização ${data}`},
      ]} />
    {detalhe.erro?<MensagemErro texto={textoDoErro(detalhe.erro)} erro={detalhe.erro} tentarDeNovo={detalhe.recarregar} />:null}
    {detalhe.carregando&&!a?<Esqueleto />:null}
    {a?.modelo&&largura>0
      ?<Corpo atualizacao={a} definir={detalhe.definir} recarregar={detalhe.recarregar} fila={fila} largura={largura} faixa={faixa}
        aba={abaDaRevisao(abaDaUrl,blocosDaEvolucaoDaRevisao(pode).length>0)} />
      :a&&!a.modelo&&!detalhe.carregando?<Vazio titulo="Sem atualização" texto="Não há pasta vigente com data de atualização." />:null}
  </View>;
}

interface RascunhoDoFeedback { chave: string; editando: boolean; texto: string }
const rascunhoInicial = (a: Atualizacao): RascunhoDoFeedback => ({ chave: `${a.id}:${a.versao}`, editando: !a.feedback, texto: a.feedback?.texto ?? '' });

function Corpo({atualizacao:a,definir,recarregar,fila,largura,faixa,aba}: {
  atualizacao:Atualizacao;definir:(a:Atualizacao)=>void;recarregar:()=>void;fila:FilaDeAtualizacoes|null;largura:number;
  faixa:ReturnType<typeof useFaixaDaTela>;aba:{ativa:AbaDaRevisao;abas:AbaDaRevisao[]};
}) {
  const {pode}=useSessao();
  const janela=useWindowDimensions();
  // Rascunho do feedback acima das composições; volta ao gravado quando a atualização (ou a versão dela) muda.
  const [guardado,setRascunho]=useState<RascunhoDoFeedback>(()=>rascunhoInicial(a));
  const rascunho=guardado.chave===`${a.id}:${a.versao}`?guardado:rascunhoInicial(a);
  const larguraDoApoio=apoioDaRevisao(faixa);
  const lado=arranjoPrincipalComApoio(largura,true,larguraDoApoio)==='lado';
  const selo=a.dataAtualizacao?statusAtualizacaoTreinador(a):null;
  const questionario=a.questionarioNome?`Questionário: ${a.questionarioNome} · versão ${a.questionarioVersaoNumero}`:undefined;
  const modelo=a.modelo!;

  const feedback=a.enviadaEm?(pode('ATUALIZACAO_RESPONDER')
    ?<EditorFeedback atualizacao={a} rascunho={rascunho} aoMudar={setRascunho} aoSalvar={definir} recarregar={recarregar} />
    :a.feedback?<FeedbackAtualizacao feedback={a.feedback}/>
      // Sem a permissão e sem feedback a coluna ficava vazia: diz o que falta e por quê.
      :<Cartao titulo="Feedback para o aluno"><Texto variante="suave">Ainda sem feedback. Seu perfil não tem permissão para responder atualizações.</Texto></Cartao>):null;
  const navegacao=<LinhaDeAcoes alinhar="entre">
    <Botao rotulo="Abrir pasta" tipo="secundario" aoTocar={()=>router.push(`/treinador/alunos/${a.alunoId}?pastaId=${a.pastaId}` as never)} />
    {fila?<ProximaDaFila fila={fila} pastaAtual={a.pastaId} />:null}
  </LinhaDeAcoes>;
  const resumo=<>
    {a.enviadaEm?<ResumoDaAtualizacao atualizacao={a} modelo={modelo} selo={selo?{texto:selo.curto,tipo:selo.tipo,Icone:ICONE_DO_SELO[selo.tipo]}:null} descricao={questionario}
      antes={<MudancasDaAtualizacao atualizacao={a} />} />
      :<Cartao titulo="Aguardando envio" descricao={questionario} acoes={selo?<Selo texto={selo.curto} tipo={selo.tipo} Icone={ICONE_DO_SELO[selo.tipo]} />:undefined}><Texto>O aluno ainda não enviou suas respostas.</Texto></Cartao>}
    {a.atrasoAte?<Cartao titulo="Atraso avisado">
      <Texto>Nova data: {dataParaTela(a.atrasoAte)}</Texto>
      <Texto>{a.atrasoMotivo??'Sem motivo informado.'}</Texto>
    </Cartao>:null}
  </>;
  const respostas=<QuestionarioAtualizacao modelo={modelo} dataAtualizacao={a.dataAtualizacao} resumo={a.resumo} respostas={a.respostas??{}}
    carregarFotoDaEquipe={a.id?(foto)=>baixarFotoDoTreinador(a.id??'',foto):undefined} />;
  const prescrito=<PrescritoDaAtualizacao alunoId={a.alunoId} pastaId={a.pastaId} />;
  const abas=aba.abas.length>1?<Abas abas={aba.abas.map(valor=>({valor,rotulo:valor==='evolucao'?'Evolução':'Respostas'}))} ativa={aba.ativa}
    aoMudar={(valor)=>router.setParams({aba:valor==='respostas'?undefined:valor})} />:null;
  const evolucao=<EvolucaoDaRevisao alunoId={a.alunoId} />;

  if(!lado){
    // Celular e área estreita: o que decide a resposta primeiro (resumo, feedback), depois o prescrito e as respostas.
    return <View style={estilos.pilha}>
      {abas}
      {aba.ativa==='evolucao'?evolucao:resumo}
      {feedback}{navegacao}
      {prescrito}
      {aba.ativa==='respostas'?respostas:null}
    </View>;
  }
  const web=Platform.OS==='web';
  const alturaDoApoio=janela.height-TOPO_DO_APOIO-espaco(2);
  const escrevendo=!!a.enviadaEm&&pode('ATUALIZACAO_RESPONDER')&&rascunho.editando;
  return <PrincipalComApoio rotuloDoApoio="Feedback e o que está prescrito" idDoApoio="apoio-da-revisao" larguraDoApoio={larguraDoApoio}
    principal={<>{abas}{aba.ativa==='evolucao'?evolucao:<>{resumo}{respostas}</>}</>}
    apoio={<>
      {/* O feedback fica no topo do apoio. Lido (texto longo do treinador), rola por dentro, sem empurrar o prescrito para fora;
          escrevendo, fica inteiro, para o "Enviar feedback" nunca ficar escondido. */}
      <View style={[estilos.feedback,web&&!escrevendo?rolagem({maxHeight:Math.round(alturaDoApoio*0.45)}):null]}>{feedback}</View>
      <View style={estilos.feedback}>{navegacao}</View>
      {/* O prescrito rola por dentro do apoio (o apoio tem a altura da janela): o feedback não sai da vista. */}
      <View style={[estilos.prescrito,web?rolagem({}):null]} role="region" focusable={web} aria-label="O que está prescrito">{prescrito}</View>
    </>} />;
}

/** `overflowY` existe no react-native-web (CSS), mas não no tipo do React Native. */
const rolagem=(extra:ViewStyle)=>({overflowY:'auto',overscrollBehavior:'contain',...extra}) as unknown as ViewStyle;

const estilos=StyleSheet.create({
  composicao:{width:'100%',alignSelf:'center',gap:espaco(3)},
  pilha:{gap:espaco(3)},
  feedback:{flexShrink:0,gap:espaco(3)},
  // `flexShrink` e `minHeight`: sem eles o react-native-web não encolhe a caixa e o apoio inteiro rolaria junto. O mínimo de
  // 240 garante algumas linhas do prescrito em janela baixa; abaixo disso o apoio inteiro rola (ele tem a altura da janela).
  prescrito:{flexShrink:1,minHeight:240},
});

function EditorFeedback({atualizacao:a,rascunho,aoMudar,aoSalvar,recarregar}: {
  atualizacao:Atualizacao;rascunho:RascunhoDoFeedback;aoMudar:(r:RascunhoDoFeedback)=>void;aoSalvar:(a:Atualizacao)=>void;recarregar:()=>void;
}) {
  const {editando,texto}=rascunho;
  const mudar=(parte:Partial<RascunhoDoFeedback>)=>aoMudar({...rascunho,...parte});
  const [ocupado,setOcupado]=useState(false);
  const [conflito,setConflito]=useState(false);
  const {avisar}=useAviso();
  const salvar=async()=>{
    if(!texto.trim()){avisar('Escreva o feedback antes de enviar.','perigo');return;}
    if(!a.id||a.versao==null){avisar('Não foi possível enviar: a atualização não veio completa. Recarregue a tela e tente de novo.','perigo');return;}
    setOcupado(true);
    try {
      const resultado=await responderAtualizacao(a.id,texto,a.versao);
      aoSalvar(resultado);avisar('Feedback enviado.','sucesso');
    }catch(erro){
      if(erro instanceof ErroApi && erro.status===409)setConflito(true);
      else avisar(textoDoErro(erro),'perigo');
    }finally{setOcupado(false);}
  };
  if(!editando)return <>
    <FeedbackAtualizacao feedback={a.feedback} />
    <Permitido codigo="ATUALIZACAO_RESPONDER"><Botao rotulo="Editar feedback" tipo="secundario" aoTocar={()=>mudar({editando:true})} /></Permitido>
  </>;
  return <Cartao titulo="Feedback para o aluno" descricao="O aluno vê o texto na tela de atualização.">
    <Campo rotulo="Seu feedback para o aluno" valor={texto} aoMudar={(t)=>mudar({texto:t})} linhas={7} maxLength={4000} editable={!ocupado}
      ajuda={`${texto.length}/4.000 caracteres`} />
    {conflito?<MensagemErro texto="Outra pessoa alterou; recarregue." tentarDeNovo={recarregar} />:null}
    {/* Enviar e cancelar lado a lado (quebram linha no celular), em vez de um embaixo do outro. */}
    <LinhaDeAcoes>
      <Permitido codigo="ATUALIZACAO_RESPONDER"><Botao rotulo="Enviar feedback" carregando={ocupado} desabilitado={!texto.trim()||conflito} motivo={conflito?'Recarregue antes de enviar.':'Escreva o feedback.'} aoTocar={()=>void salvar()} /></Permitido>
      {a.feedback?<Botao rotulo="Cancelar edição" tipo="fantasma" desabilitado={ocupado} aoTocar={()=>aoMudar(rascunhoInicial(a))} />:null}
    </LinhaDeAcoes>
  </Cartao>;
}

/**
 * "Próxima ›" da revisão em fila: busca a lista de onde o treinador veio e abre a primeira que não é esta, trocando a
 * tela (replace) para o voltar não acumular uma por atualização revisada.
 */
function ProximaDaFila({fila,pastaAtual}:{fila:FilaDeAtualizacoes;pastaAtual:string|null}) {
  const [buscando,setBuscando]=useState(false);
  const [acabou,setAcabou]=useState(false);
  const {avisar}=useAviso();
  const proxima=async()=>{
    setBuscando(true);
    try {
      const item=proximaDaFila(await listarAtualizacoes(fila.situacao,fila.meus,filtroDaFila(fila)),pastaAtual);
      if(item)router.replace(caminhoAtualizacaoTreinador(item,fila) as never);
      else setAcabou(true);
    }catch(erro){avisar(textoDoErro(erro),'perigo');}
    finally{setBuscando(false);}
  };
  if(acabou)return <Cartao titulo="Nada mais para revisar"><Texto>Você chegou ao fim desta lista.</Texto><LinkTexto texto="Voltar para a lista" href={caminhoListaAtualizacoes(fila.situacao,fila.meus,fila)} /></Cartao>;
  return <Botao rotulo="Próxima ›" rotuloAcessivel="Abrir a próxima atualização da lista" tipo="secundario" carregando={buscando} aoTocar={()=>void proxima()} />;
}

