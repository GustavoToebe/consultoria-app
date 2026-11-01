import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { FeedbackAtualizacao } from '../../../aluno/atualizacao/FeedbackAtualizacao';
import { QuestionarioAtualizacao } from '../../../aluno/atualizacao/QuestionarioAtualizacao';
import { ErroApi } from '../../../api/cliente';
import { atualizacaoDoAluno, baixarFotoDoTreinador, detalheAtualizacao, listarAtualizacoes, responderAtualizacao } from '../../../api/rotas';
import type { Atualizacao } from '../../../api/tipos';
import { caminhoAtualizacaoTreinador, caminhoListaAtualizacoes, filaDosParametros, type FilaDeAtualizacoes, proximaDaFila, statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../../dominio/datasRelativas';
import { dataParaTela } from '../../../dominio/formatos';
import { espaco, LARGURA_EDITOR, LARGURA_LISTA } from '../../../tema/tokens';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { ICONE_DO_SELO } from '../../../treinador/iconesDosSelos';
import { ResumoDaAtualizacao } from '../../../treinador/ResumoDaAtualizacao';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Campo } from '../../../ui/Campo';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { LinkTexto } from '../../../ui/LinkTexto';
import { Selo } from '../../../ui/Selo';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';

/**
 * Detalhe da atualização para o treinador: o nome do aluno no título, o resumo (com a situação e o questionário no
 * cabeçalho dele) e o feedback ao alcance: no PC numa coluna à direita, no celular logo depois do resumo, antes das
 * respostas pergunta a pergunta. "Abrir pasta" e "Próxima ›" ficam juntos, logo abaixo do feedback.
 */
export default function AtualizacaoTreinador() {
  const {pode}=useSessao();
  const {id,alunoId,situacao,meus,responsavel,de,ate}=useLocalSearchParams<{id:string;alunoId?:string;situacao?:string;meus?:string;responsavel?:string;de?:string;ate?:string}>();
  const fila=filaDosParametros(situacao,meus,{responsavel,de,ate});
  const detalhe=useCarregar(id==='previa'?alunoId??null:id??null,()=>
    id==='previa' ? atualizacaoDoAluno(alunoId!) : detalheAtualizacao(id));
  const a=detalhe.dados;
  const {width}=useWindowDimensions();
  const duasColunas=width>=1100;
  const data=a?.dataAtualizacao?dataSemAnoCorrente(a.dataAtualizacao):'';
  const titulo=a?`${a.nomeAluno??'Aluno'} · Atualização${data?` ${data}`:''}`:'Atualização';
  const selo=a?.dataAtualizacao?statusAtualizacaoTreinador(a):null;
  const questionario=a?.questionarioNome?`Questionário: ${a.questionarioNome} · versão ${a.questionarioVersaoNumero}`:undefined;
  const feedback=a?.modelo&&a.enviadaEm?(pode('ATUALIZACAO_RESPONDER')
    ?<EditorFeedback key={`${a.id}:${a.versao}`} atualizacao={a} aoSalvar={detalhe.definir} recarregar={detalhe.recarregar} />
    :<FeedbackAtualizacao feedback={a.feedback}/>):null;
  const navegacao=a?<LinhaDeAcoes alinhar="entre">
    <Botao rotulo="Abrir pasta" tipo="secundario" aoTocar={()=>router.push(`/treinador/alunos/${a.alunoId}?pastaId=${a.pastaId}` as never)} />
    {fila?<ProximaDaFila fila={fila} pastaAtual={a.pastaId} />:null}
  </LinhaDeAcoes>:null;
  const resumo=a?.modelo?<>
    {a.enviadaEm?<ResumoDaAtualizacao atualizacao={a} modelo={a.modelo} selo={selo?{texto:selo.curto,tipo:selo.tipo,Icone:ICONE_DO_SELO[selo.tipo]}:null} descricao={questionario} />
      :<Cartao titulo="Aguardando envio" descricao={questionario} acoes={selo?<Selo texto={selo.curto} tipo={selo.tipo} Icone={ICONE_DO_SELO[selo.tipo]} />:undefined}><Texto>O aluno ainda não enviou suas respostas.</Texto></Cartao>}
    {a.atrasoAte?<Cartao titulo="Atraso avisado">
      <Texto>Nova data: {dataParaTela(a.atrasoAte)}</Texto>
      <Texto>{a.atrasoMotivo??'Sem motivo informado.'}</Texto>
    </Cartao>:null}
  </>:null;
  const respostas=a?.modelo?<QuestionarioAtualizacao modelo={a.modelo} dataAtualizacao={a.dataAtualizacao} resumo={a.resumo} respostas={a.respostas??{}}
    carregarFotoDaEquipe={a.id?(foto)=>baixarFotoDoTreinador(a.id??'',foto):undefined} />:null;
  return <Tela largura={duasColunas?LARGURA_LISTA:LARGURA_EDITOR} bordas={['top']}>
    <Cabecalho titulo={titulo}
      voltar="/treinador/atualizacoes" trilha={[
        {rotulo:'Alunos',href:'/treinador/alunos'},
        {rotulo:a?.nomeAluno??'Aluno',href:a?`/treinador/alunos/${a.alunoId}`:undefined},
        {rotulo:`Atualização ${data}`},
      ]} />
    {detalhe.erro?<MensagemErro texto={textoDoErro(detalhe.erro)} tentarDeNovo={detalhe.recarregar} />:null}
    {detalhe.carregando?<Esqueleto />:null}
    {a?.modelo?(duasColunas?<View style={estilos.colunas}>
      <View style={estilos.principal}>{resumo}{respostas}</View>
      <View style={estilos.lateral}>{feedback}{navegacao}</View>
    </View>:<>{resumo}{feedback}{navegacao}{respostas}</>)
    :a && !detalhe.carregando?<Vazio titulo="Sem atualização" texto="Não há pasta vigente com data de atualização." />:null}
  </Tela>;
}

const estilos=StyleSheet.create({
  colunas:{flexDirection:'row',alignItems:'flex-start',gap:espaco(3)},
  principal:{flex:3,minWidth:0,gap:espaco(3)},
  lateral:{flex:2,minWidth:0,gap:espaco(3)},
});

function EditorFeedback({atualizacao:a,aoSalvar,recarregar}: {
  atualizacao:Atualizacao;aoSalvar:(a:Atualizacao)=>void;recarregar:()=>void;
}) {
  const [editando,setEditando]=useState(!a.feedback);
  const [texto,setTexto]=useState(a.feedback?.texto??'');
  const [ocupado,setOcupado]=useState(false);
  const [conflito,setConflito]=useState(false);
  const {avisar}=useAviso();
  const salvar=async()=>{
    if(!a.id || a.versao==null || !texto.trim())return;
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
    <Permitido codigo="ATUALIZACAO_RESPONDER"><Botao rotulo="Editar feedback" tipo="secundario" aoTocar={()=>setEditando(true)} /></Permitido>
  </>;
  return <Cartao titulo="Feedback para o aluno" descricao="O aluno vê o texto na tela de atualização.">
    <Campo rotulo="Seu feedback para o aluno" valor={texto} aoMudar={setTexto} linhas={7} maxLength={4000} editable={!ocupado}
      ajuda={`${texto.length}/4.000 caracteres`} />
    {conflito?<MensagemErro texto="Outra pessoa alterou; recarregue." tentarDeNovo={recarregar} />:null}
    {/* Enviar e cancelar lado a lado (quebram linha no celular), em vez de um embaixo do outro. */}
    <LinhaDeAcoes>
      <Permitido codigo="ATUALIZACAO_RESPONDER"><Botao rotulo="Enviar feedback" carregando={ocupado} desabilitado={!texto.trim()||conflito} motivo={conflito?'Recarregue antes de enviar.':'Escreva o feedback.'} aoTocar={()=>void salvar()} /></Permitido>
      {a.feedback?<Botao rotulo="Cancelar edição" tipo="fantasma" desabilitado={ocupado} aoTocar={()=>setEditando(false)} />:null}
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
      const item=proximaDaFila(await listarAtualizacoes(fila.situacao,fila.meus,{responsavel:fila.responsavel,de:fila.de,ate:fila.ate}),pastaAtual);
      if(item)router.replace(caminhoAtualizacaoTreinador(item,fila) as never);
      else setAcabou(true);
    }catch(erro){avisar(textoDoErro(erro),'perigo');}
    finally{setBuscando(false);}
  };
  if(acabou)return <Cartao titulo="Nada mais para revisar"><Texto>Você chegou ao fim desta lista.</Texto><LinkTexto texto="Voltar para a lista" href={caminhoListaAtualizacoes(fila.situacao,fila.meus,fila)} /></Cartao>;
  return <Botao rotulo="Próxima ›" rotuloAcessivel="Abrir a próxima atualização da lista" tipo="secundario" carregando={buscando} aoTocar={()=>void proxima()} />;
}
