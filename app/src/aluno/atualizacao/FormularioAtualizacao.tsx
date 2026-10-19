import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ErroApi } from '../../api/cliente';
import { avisarAtrasoAtualizacao, enviarAtualizacao, marcarFeedbackVisto } from '../../api/rotas';
import type { Atualizacao, RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import { limitesNovaDataAtraso, novaDataAtrasoValida, podeResponderAtualizacao, statusAtualizacao } from '../../dominio/atualizacao';
import { rascunhoVigente } from '../../dominio/atualizacaoQuestionario';
import { dataDaTela, dataParaTela, hojeIso, somarDias } from '../../dominio/formatos';
import { errosRespostasAtualizacao, respostasParaEnviar } from '../../dominio/respostasAtualizacao';
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
import { ContextoDeFotos } from './fotos/ControleDeFotos';
import { useFotosDoFormulario, type EstadoDasFotos } from './fotos/useFotosDoFormulario';
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
  const [vigente]=useState(()=>rascunhoVigente(rascunho,atualizacao));
  const [respostas,setRespostas]=useState<RespostasAtualizacao>(atual.enviadaEm ? atual.respostas??{} : rascunho ? vigente.respostas : atual.respostas??{});
  // Fotos tiradas e ainda não enviadas (só no celular): ficam na pasta privada do app, aqui só os nomes.
  const [locais,setLocais]=useState<Record<string,string[]>>(()=>atual.enviadaEm ? {} : rascunho?.fotosLocais ?? {});
  const ultimo=useRef<EstadoDasFotos>({respostas,locais});
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
  const rascunhoAdaptado=vigente.adaptado&&!leitura&&!atual.enviadaEm;
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
  const rascunhoRegravado=useRef(false);
  useEffect(()=>{
    // Rascunho de outra versão vira o da versão em uso: a próxima abertura já o encontra assim.
    // Só uma vez por montagem: `atualizacao` chega novo a cada foco e não pode sobrescrever o que o aluno digitou depois.
    if(rascunhoRegravado.current||!rascunhoAdaptado||!atualizacao.pastaId||!atualizacao.questionarioVersaoId)return;
    rascunhoRegravado.current=true;
    void repositorio.salvarRascunhoAtualizacao(atualizacao.pastaId,{questionarioVersaoId:atualizacao.questionarioVersaoId,respostas:vigente.respostas,
      ...(rascunho?.fotosLocais?{fotosLocais:rascunho.fotosLocais}:{})}).catch(()=>undefined);
  },[rascunhoAdaptado,atualizacao,repositorio,vigente.respostas,rascunho?.fotosLocais]);
  const gravarRascunho=(estado:EstadoDasFotos)=>{
    if(atual.pastaId && atual.questionarioVersaoId) void repositorio.salvarRascunhoAtualizacao(atual.pastaId,{
      questionarioVersaoId:atual.questionarioVersaoId,respostas:estado.respostas,...(Object.keys(estado.locais).length?{fotosLocais:estado.locais}:{})})
      .catch(()=>avisar('Não foi possível salvar o rascunho no aparelho.','perigo'));
  };
  // Respostas e fotos mudam juntas (uma foto enviada vira id na resposta): o último estado fica na ref, para um envio
  // de foto que demora não gravar por cima do que o aluno digitou enquanto isso.
  const aplicar=(estado:EstadoDasFotos)=>{
    ultimo.current=estado;
    setRespostas(estado.respostas);setLocais(estado.locais);
    gravarRascunho(estado);
  };
  const fotos=useFotosDoFormulario({usuarioId:repositorio.usuarioId,destino:atual.pastaId?{pastaId:atual.pastaId}:null,online,editavel:!leitura&&liberada&&!ocupado,locais,
    ler:()=>ultimo.current,aplicar});
  const mudar=(id:string,valor:RespostaAtualizacao)=>{
    aplicar({respostas:{...ultimo.current.respostas,[id]:valor},locais:ultimo.current.locais});
    setErros(atuais=>{const copia={...atuais};delete copia[id];return copia;});
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
    if(!atual.modelo || !atual.pastaId || !atual.questionarioVersaoId)return;
    const noAparelho=Object.fromEntries(Object.entries(locais).map(([id,nomes])=>[id,nomes.length]));
    const encontrados=errosRespostasAtualizacao(atual.modelo,respostas,fotos.habilitado===true,noAparelho);
    if(Object.keys(encontrados).length){mostrarErros(encontrados);return;}
    if(!online){avisar(SEM_CONEXAO);return;}
    setOcupado(true);
    try {
      // As fotos do aparelho sobem agora (uma a uma) e viram ids nas respostas; falhou uma, o resto fica salvo para tentar de novo.
      const completas=fotos.habilitado===true ? await fotos.subirLocais() : ultimo.current.respostas;
      // Resposta de pergunta escondida por condição não vai (o servidor também a descartaria).
      const resultado=await enviarAtualizacao(atual.pastaId,atual.questionarioVersaoId,respostasParaEnviar(atual.modelo,completas,fotos.habilitado===true));
      await atualizarAtualizacao(resultado);
      await repositorio.apagarRascunhoAtualizacao(atual.pastaId);
      await fotos.apagarLocais();
      setAtual(resultado);setEnviada(true);
    } catch(erro) {
      if(erro instanceof ErroApi && erro.campos.length) mostrarErros(Object.fromEntries(erro.campos.map(c=>[c.field,c.message])));
      else if(erro instanceof ErroApi && erro.semConexao) avisar(SEM_CONEXAO);
      else {
        // Todo 409 recarrega (questionário trocado, pasta que deixou de ser a atual, atualização já enviada), menos o peso do
        // dia gravado ao mesmo tempo: esse só pede para enviar de novo. Recarregou, o aviso é neutro; o app já se corrigiu.
        const recarrega=erro instanceof ErroApi && erro.status===409 && erro.codigo!=='PESO_JA_REGISTRADO';
        avisar(textoDoErro(erro),recarrega?undefined:'perigo');
        if(recarrega) {
          // Guarda o que está na tela (com a versão antiga) para a remontagem reconciliar com o questionário novo.
          // Já enviada: o rascunho não serve mais.
          if(erro.codigo==='ATUALIZACAO_JA_ENVIADA') {
            await repositorio.apagarRascunhoAtualizacao(atual.pastaId).catch(()=>undefined);
            await fotos.apagarLocais();
          } else {
            const estado=ultimo.current;
            await repositorio.salvarRascunhoAtualizacao(atual.pastaId,{questionarioVersaoId:atual.questionarioVersaoId,respostas:estado.respostas,
              ...(Object.keys(estado.locais).length?{fotosLocais:estado.locais}:{})}).catch(()=>undefined);
          }
          recarregar();
        }
      }
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
      {rascunhoAdaptado&&vigente.mudou?<Cartao><Texto>Seu treinador atualizou o questionário. Confira as respostas.</Texto></Cartao>:null}
      {somenteLeitura&&!atual.enviadaEm?<Texto>Esta atualização é de um período anterior. Só é possível consultar.</Texto>:null}
      <Cartao titulo="Instruções">
        {atual.modelo?.instrucoes.map((texto,i)=><Texto key={i}>{texto}</Texto>)}
        {!leitura?<Texto variante="pequeno">* Campos obrigatórios. O rascunho fica salvo neste aparelho.</Texto>:null}
      </Cartao>
      <ContextoDeFotos.Provider value={fotos.controle}>
        <QuestionarioAtualizacao modelo={atual.modelo} dataAtualizacao={atual.dataAtualizacao} resumo={atual.resumo} respostas={respostas}
          aoMudar={!leitura&&liberada&&!ocupado?mudar:undefined} erros={erros} campos={campos} />
      </ContextoDeFotos.Provider>
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
