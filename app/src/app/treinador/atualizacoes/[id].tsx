import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FeedbackAtualizacao } from '../../../aluno/atualizacao/FeedbackAtualizacao';
import { QuestionarioAtualizacao } from '../../../aluno/atualizacao/QuestionarioAtualizacao';
import { ErroApi } from '../../../api/cliente';
import { atualizacaoDoAluno, detalheAtualizacao, responderAtualizacao } from '../../../api/rotas';
import type { Atualizacao } from '../../../api/tipos';
import { statusAtualizacaoTreinador } from '../../../dominio/atualizacao';
import { dataParaTela, numeroParaTela } from '../../../dominio/formatos';
import { espaco, LARGURA_EDITOR } from '../../../tema/tokens';
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

export default function AtualizacaoTreinador() {
  const {pode}=useSessao();
  const {id,alunoId}=useLocalSearchParams<{id:string;alunoId?:string}>();
  const detalhe=useCarregar(id==='previa'?alunoId??null:id??null,()=>
    id==='previa' ? atualizacaoDoAluno(alunoId!) : detalheAtualizacao(id));
  const a=detalhe.dados;
  return <Tela largura={LARGURA_EDITOR} bordas={['top']}>
    <Cabecalho titulo={`Atualização${a?.dataAtualizacao?` · ${dataParaTela(a.dataAtualizacao)}`:''}`}
      voltar="/treinador/atualizacoes" trilha={[
        {rotulo:'Alunos',href:'/treinador/alunos'},
        {rotulo:a?.nomeAluno??'Aluno',href:a?`/treinador/alunos/${a.alunoId}`:undefined},
        {rotulo:`Atualização ${dataParaTela(a?.dataAtualizacao??null)}`},
      ]} />
    <Texto variante="suave">Respostas do aluno nesta pasta e o seu feedback.</Texto>
    {detalhe.erro?<MensagemErro texto={textoDoErro(detalhe.erro)} tentarDeNovo={detalhe.recarregar} />:null}
    {detalhe.carregando?<Esqueleto />:null}
    {a?.modelo?<>
      <Selo {...statusAtualizacaoTreinador(a)} />
      {a.enviadaEm?<Resumo atualizacao={a} />:<Cartao titulo="Aguardando envio" descricao="As respostas aparecem aqui quando o aluno enviar."><Texto>O aluno ainda não enviou suas respostas.</Texto></Cartao>}
      {a.atrasoAte?<Cartao titulo="Atraso avisado">
        <Texto>Nova data: {dataParaTela(a.atrasoAte)}</Texto>
        <Texto>{a.atrasoMotivo??'Sem motivo informado.'}</Texto>
      </Cartao>:null}
      <QuestionarioAtualizacao atualizacao={a} respostas={a.respostas??{}} />
      {a.enviadaEm?pode('ATUALIZACAO_RESPONDER')?<EditorFeedback key={`${a.id}:${a.versao}`} atualizacao={a} aoSalvar={detalhe.definir} recarregar={detalhe.recarregar} />:<FeedbackAtualizacao feedback={a.feedback}/>:null}
      <LinkTexto texto="Abrir pasta do aluno" href={`/treinador/alunos/${a.alunoId}?pastaId=${a.pastaId}`} />
    </>:a && !detalhe.carregando?<Vazio titulo="Sem atualização" texto="Não há pasta vigente com data de atualização." />:null}
  </Tela>;
}

function Resumo({atualizacao:a}: {atualizacao:Atualizacao}) {
  const peso=typeof a.respostas?.peso==='number'?a.respostas.peso:null;
  const anterior=a.resumo?.pesoAnterior;
  const variacao=peso!=null && anterior!=null ? peso-anterior : null;
  const numero=(valor:unknown,casas=0)=>typeof valor==='number'?numeroParaTela(valor,casas):'—';
  return <Cartao titulo="Resumo do período">
    <View style={estilos.numeros}>
      {[
        ['Peso (kg)',numero(peso,1)],['Variação (kg)',variacao==null?'—':`${variacao>0?'+':''}${numero(variacao,1)}`],
        ['Sono',numero(a.respostas?.sono)],['Alimentar',numero(a.respostas?.alim_desempenho)],['Treino',numero(a.respostas?.treino_desempenho)],
      ].map(([rotulo,valor])=><View key={rotulo} style={estilos.numero}><Texto variante="rotulo">{rotulo}</Texto><Texto variante="destaque" numerico>{valor}</Texto></View>)}
    </View>
    <Texto>Média de {numero(a.resumo?.mediaDiasPorSemana,1)} dias com treino por semana (registrado no app)</Texto>
    <Texto variante="pequeno">Peso anterior: {anterior==null?'—':`${numero(anterior,1)} kg`}</Texto>
  </Cartao>;
}

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
    <Permitido codigo="ATUALIZACAO_RESPONDER"><Botao rotulo="Enviar feedback" carregando={ocupado} desabilitado={!texto.trim()||conflito} motivo={conflito?'Recarregue antes de enviar.':'Escreva o feedback.'} aoTocar={()=>void salvar()} /></Permitido>
    {a.feedback?<Botao rotulo="Cancelar edição" tipo="fantasma" desabilitado={ocupado} aoTocar={()=>setEditando(false)} />:null}
  </Cartao>;
}
const estilos=StyleSheet.create({numeros:{flexDirection:'row',flexWrap:'wrap',gap:espaco(3)},numero:{minWidth:130,gap:espaco(1)}});
