import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ErroApi } from '../../api/cliente';
import { avisarAtrasoAtualizacao, enviarAtualizacao, marcarFeedbackVisto } from '../../api/rotas';
import type { Atualizacao, RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import { limitesNovaDataAtraso, novaDataAtrasoValida, podeResponderAtualizacao, statusAtualizacao } from '../../dominio/atualizacao';
import { dataDaTela, dataParaTela, hojeIso, somarDias } from '../../dominio/formatos';
import { errosRespostasAtualizacao } from '../../dominio/respostasAtualizacao';
import { useAluno } from '../../offline/AlunoProvider';
import type { RascunhoAtualizacao } from '../../offline/repositorioLocal';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Bloqueado } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { textoDoErro } from '../../ui/erros';
import { useMovimentoReduzido } from '../../ui/useMovimentoReduzido';
import { FeedbackAtualizacao } from './FeedbackAtualizacao';
import { QuestionarioAtualizacao } from './QuestionarioAtualizacao';

const SEM_CONEXAO='Sem conexão: suas respostas ficam salvas no aparelho. Envie quando conectar.';
export function FormularioAtualizacao({atualizacao,somenteLeitura=false,rascunho,abrirAtraso,recarregar}: {
  atualizacao:Atualizacao;somenteLeitura?:boolean;rascunho:RascunhoAtualizacao|null;abrirAtraso:boolean;recarregar:()=>void;
}) {
  const {repositorio,online,atualizarAtualizacao}=useAluno();
  const {avisar}=useAviso();
  const {cores}=useTema();
  const reduzido=useMovimentoReduzido();
  const [atual,setAtual]=useState(atualizacao);
  const [respostas,setRespostas]=useState<RespostasAtualizacao>(atual.enviadaEm ? atual.respostas??{} : rascunho?.respostas??atual.respostas??{});
  const [erros,setErros]=useState<Record<string,string>>({});
  const [ocupado,setOcupado]=useState(false);
  const [enviada,setEnviada]=useState(false);
  const [atraso,setAtraso]=useState(abrirAtraso&&!somenteLeitura);
  const [data,setData]=useState(dataParaTela(atual.atrasoAte??somarDias(atual.dataAtualizacao??hojeIso(),2)));
  const [motivo,setMotivo]=useState(atual.atrasoMotivo??'');
  const [erroData,setErroData]=useState<string|null>(null);
  const scroll=useRef<ScrollView>(null);
  const moldura=useRef<View>(null);
  const campos=useRef(new Map<string,View>());
  const deslocamento=useRef(0);
  const leitura=somenteLeitura||atual.fase==='ENVIADA'||atual.fase==='REVISADA';
  const liberada=podeResponderAtualizacao(atual,hojeIso());
  const dataOriginal=atual.dataAtualizacao??hojeIso();
  const limites=limitesNovaDataAtraso(hojeIso(),dataOriginal);
  useEffect(()=>{
    if (!atual.id || !atual.feedback?.naoLido || !online) return;
    const id=atual.id;
    marcarFeedbackVisto(id).then(async()=>{
      setAtual(a=>({...a,feedback:a.feedback?{...a.feedback,naoLido:false}:null}));
      const salva=await repositorio.lerAtualizacao();
      if(salva?.id===id && salva.feedback) await atualizarAtualizacao({...salva,feedback:{...salva.feedback,naoLido:false}});
    })
      .catch(()=>undefined);
  },[atual.id,atual.feedback?.naoLido,online,repositorio,atualizarAtualizacao]);
  const mudar=(id:string,valor:RespostaAtualizacao)=>{
    const novas={...respostas,[id]:valor};
    setRespostas(novas);
    setErros(atuais=>{const copia={...atuais};delete copia[id];return copia;});
    if(atual.pastaId) void repositorio.salvarRascunhoAtualizacao(atual.pastaId,{modeloVersao:atual.modeloVersao,respostas:novas})
      .catch(()=>avisar('Não foi possível salvar o rascunho no aparelho.','perigo'));
  };
  const mostrarErros=(novos:Record<string,string>)=>{
    setErros(novos);
    const primeiro=Object.keys(novos)[0];
    if(!primeiro)return;
    campos.current.get(primeiro)?.measureInWindow((_x,y)=>moldura.current?.measureInWindow((_sx,sy)=>{
      scroll.current?.scrollTo({y:Math.max(0,deslocamento.current+y-sy-16),animated:!reduzido});
    }));
    // Erro geral da API (ex.: campo `data`, "libera um dia antes") aparece com a mensagem dela.
    avisar(novos.respostas??novos.data??'Confira os campos indicados.');
  };
  const enviar=async()=>{
    if(!atual.modelo || !atual.pastaId)return;
    const encontrados=errosRespostasAtualizacao(atual.modelo,respostas);
    if(Object.keys(encontrados).length){mostrarErros(encontrados);return;}
    if(!online){avisar(SEM_CONEXAO);return;}
    setOcupado(true);
    try {
      const resultado=await enviarAtualizacao(atual.pastaId,atual.modeloVersao,respostas);
      await atualizarAtualizacao(resultado);
      await repositorio.apagarRascunhoAtualizacao(atual.pastaId);
      setAtual(resultado);setEnviada(true);
    } catch(erro) {
      if(erro instanceof ErroApi && erro.campos.length) mostrarErros(Object.fromEntries(erro.campos.map(c=>[c.field,c.message])));
      else if(erro instanceof ErroApi && erro.semConexao) avisar(SEM_CONEXAO);
      else {avisar(textoDoErro(erro),'perigo');if(erro instanceof ErroApi && erro.status===409)recarregar();}
    } finally {setOcupado(false);}
  };
  const salvarAtraso=async()=>{
    if(!atual.pastaId)return;
    const nova=dataDaTela(data);
    if(!nova || !novaDataAtrasoValida(hojeIso(),dataOriginal,nova)){
      setErroData(`Escolha uma data de ${dataParaTela(limites.minimo)} até ${dataParaTela(limites.maximo)}.`);return;
    }
    if(!online){avisar('Conecte-se para avisar o atraso. Seu rascunho continua salvo.');return;}
    setOcupado(true);
    try {
      const resultado=await avisarAtrasoAtualizacao(atual.pastaId,nova,motivo);
      await atualizarAtualizacao(resultado);
      setAtual(resultado);setAtraso(false);avisar('Atraso avisado.');
    }catch(erro){
      const campo=erro instanceof ErroApi ? erro.campos.find(c=>c.field==='novaData') : undefined;
      if(campo)setErroData(campo.message);
      else avisar(textoDoErro(erro),'perigo');
    }finally{setOcupado(false);}
  };
  if(enviada)return <Cartao titulo="Atualização enviada">
    <Selo texto="Enviada" tipo="sucesso" /><Texto>Aguardando o treinador.</Texto>
    <Botao rotulo="Voltar ao início" aoTocar={()=>router.replace('/aluno')} />
  </Cartao>;
  return <>
    <View ref={moldura} style={{flex:1,minHeight:0}}>
    <ScrollView ref={scroll} onScroll={evento=>{deslocamento.current=evento.nativeEvent.contentOffset.y;}}
      scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.conteudo}>
      <FeedbackAtualizacao feedback={atual.feedback} />
      {!leitura&&!liberada&&atual.dataAtualizacao?<Bloqueado titulo={`Disponível a partir de ${dataParaTela(somarDias(atual.dataAtualizacao,-1))}`} texto="O formulário libera um dia antes da data da atualização. Até lá você pode consultar as perguntas." />:null}
      <Selo {...statusAtualizacao(atual)} />
      {somenteLeitura&&!atual.enviadaEm?<Texto>Esta atualização é de um período anterior. Só é possível consultar.</Texto>:null}
      <Cartao titulo="Instruções">
        {atual.modelo?.instrucoes.map((texto,i)=><Texto key={i}>{texto}</Texto>)}
        {!leitura?<Texto variante="pequeno">* Campos obrigatórios. O rascunho fica salvo neste aparelho.</Texto>:null}
      </Cartao>
      <QuestionarioAtualizacao atualizacao={atual} respostas={respostas} aoMudar={!leitura&&liberada&&!ocupado?mudar:undefined} erros={erros} campos={campos} />
      {!leitura&&liberada?<Botao rotulo="Enviar atualização" carregando={ocupado} aoTocar={()=>void enviar()} />:null}
      {!leitura?<Botao rotulo="Vou atrasar" tipo="fantasma" desabilitado={ocupado} aoTocar={()=>setAtraso(true)} />:null}
      {erros.respostas??erros.data?<Texto cor={cores.perigo}>{erros.respostas??erros.data}</Texto>:null}
    </ScrollView>
    </View>
    <Folha titulo="Vou atrasar" visivel={atraso} aoFechar={()=>setAtraso(false)}
      rodape={<Botao rotulo="Avisar treinador" carregando={ocupado} aoTocar={()=>void salvarAtraso()} />}>
      <Texto>Seu treinador receberá o aviso. Escolha uma data de {dataParaTela(limites.minimo)} até {dataParaTela(limites.maximo)}.</Texto>
      <CampoData rotulo="Nova data" valor={data} aoMudar={valor=>{setData(valor);setErroData(null);}} erro={erroData} />
      <Campo rotulo="Motivo (opcional)" valor={motivo} aoMudar={setMotivo} maxLength={300} linhas={3} />
    </Folha>
  </>;
}
const estilos=StyleSheet.create({conteudo:{gap:espaco(3),paddingBottom:espaco(3)}});
