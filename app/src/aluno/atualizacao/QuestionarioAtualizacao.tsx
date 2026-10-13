import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Atualizacao, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao, TipoPergunta } from '../../api/tipos';
import {
  ajudaDoNumero, alternarMarcado, escolhaParaSimNao, simNaoParaEscolha, textoDaResposta, type SimNao,
} from '../../dominio/atualizacaoQuestionario';
import { dataParaTela, numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscalaDeNota } from '../../ui/EscalaDeNota';
import { Texto } from '../../ui/Texto';

interface Props {
  atualizacao: Atualizacao;
  respostas: RespostasAtualizacao;
  aoMudar?: (id: string, valor: RespostaAtualizacao) => void;
  erros?: Record<string,string>;
  campos?: RefObject<Map<string,View>>;
}

const TIPOS_CONHECIDOS: readonly TipoPergunta[] = ['DATA_AUTOMATICA','PESO','NOTA','TEXTO','TEXTO_LONGO','NOTAS_POR_DIA','FOTOS',
  'ESCOLHA_UNICA','MULTIPLA_ESCOLHA','NUMERO','SIM_NAO'];
const SIM_NAO=[{valor:'sim' as SimNao,rotulo:'Sim'},{valor:'nao' as SimNao,rotulo:'Não'}];

/** O modelo da API define ordem, tipos e rótulos; aluno e treinador leem a mesma versão. */
export function QuestionarioAtualizacao({atualizacao:a,respostas,aoMudar,erros={},campos}:Props) {
  return <>
    {a.modelo?.secoes.map(secao=><Cartao key={secao.uid??secao.titulo} cabecalho={<CabecalhoDeGrupo titulo={secao.titulo} />}>
      {secao.perguntas.map(p=><View key={p.id} collapsable={false}
        ref={view=>{if(view)campos?.current.set(p.id,view);else campos?.current.delete(p.id);}}>
        <Pergunta pergunta={p} valor={respostas[p.id]??null} atualizacao={a} erro={erros[p.id]}
          aoMudar={aoMudar ? valor=>aoMudar(p.id,valor) : undefined} />
      </View>)}
    </Cartao>)}
  </>;
}
function Pergunta({pergunta:p,valor,atualizacao:a,erro,aoMudar}: {
  pergunta:PerguntaAtualizacao;valor:RespostaAtualizacao;atualizacao:Atualizacao;erro?:string;
  aoMudar?: (valor:RespostaAtualizacao)=>void;
}) {
  const {avisar}=useAviso();
  const {cores}=useTema();
  const rotulo=`${p.rotulo}${p.obrigatoria ? ' *' : ''}`;
  const ajuda=p.ajudaAutomatica==='MEDIA_DIAS_TREINO' && a.resumo?.mediaDiasPorSemana!=null
    ? `No app: média de ${numeroParaTela(a.resumo.mediaDiasPorSemana,1)} dias com treino por semana neste período`
    : p.ajuda;
  const mensagemErro=erro?<Texto cor={cores.perigo}>{erro}</Texto>:null;
  if(p.tipo==='DATA_AUTOMATICA') return <View style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto><Texto numerico>{dataParaTela(a.dataAtualizacao)||'—'}</Texto></View>;
  if(p.tipo==='FOTOS') return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{p.rotulo}</Texto>
    <View style={estilos.fotos}>{['Frente','Costas','Lado','Livre'].map(pose=><Botao key={pose} tipo="secundario" rotulo={pose}
      aoTocar={()=>avisar('Envio de fotos ainda não implementado.')} />)}</View>
  </View>;
  if(!TIPOS_CONHECIDOS.includes(p.tipo)) return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{p.rotulo}</Texto><Texto variante="pequeno">{aoMudar?'Atualize o app para responder esta pergunta.':'Atualize o app para ver esta resposta.'}</Texto>
  </View>;
  if(!aoMudar) return <View style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto>
    <Texto>{textoDaResposta(p,valor)}</Texto>{ajuda?<Texto variante="pequeno">{ajuda}</Texto>:null}</View>;
  if(p.tipo==='PESO') return <CampoNumerico rotulo={rotulo} valor={typeof valor==='number'?valor:null}
    aoMudar={aoMudar} ajuda="Em kg, de 20 a 400, com uma casa decimal." erro={erro} />;
  if(p.tipo==='NUMERO') return <CampoNumerico rotulo={rotulo} valor={typeof valor==='number'?valor:null} aoMudar={aoMudar}
    sufixo={p.unidade} inteiro={(p.casas??0)===0} ajuda={[ajudaDoNumero(p),ajuda].filter(Boolean).join(' ')} erro={erro} />;
  if(p.tipo==='NOTA') return <View style={estilos.pergunta}>
    <EscalaDeNota rotulo={rotulo} valor={typeof valor==='number'?valor:null} aoMudar={aoMudar} />
    {mensagemErro}
  </View>;
  if(p.tipo==='SIM_NAO') return <View style={estilos.pergunta}>
    <Escolha rotulo={rotulo} opcoes={SIM_NAO} valor={simNaoParaEscolha(valor)} limpavel={!p.obrigatoria}
      aoMudar={escolha=>aoMudar(escolhaParaSimNao(escolha))} />
    {ajuda?<Texto variante="pequeno">{ajuda}</Texto>:null}{mensagemErro}
  </View>;
  if(p.tipo==='ESCOLHA_UNICA') {
    const opcoes=(p.opcoes??[]).map(o=>({valor:o.id,rotulo:o.rotulo}));
    const escolhida=typeof valor==='string'?valor:null;
    return <View style={estilos.pergunta}>
      {opcoes.length>OPCOES_PARA_BUSCAR ? <>
        <EscolhaEmFolha rotulo={rotulo} valor={escolhida} opcoes={opcoes} aoMudar={aoMudar} rotuloDoValor="Escolher" />
        {!p.obrigatoria&&escolhida?<Botao tipo="fantasma" rotulo="Limpar" rotuloAcessivel={`Limpar ${p.rotulo}`} aoTocar={()=>aoMudar(null)} />:null}
      </> : <Escolha rotulo={rotulo} opcoes={opcoes} valor={escolhida} limpavel={!p.obrigatoria} aoMudar={aoMudar} />}
      {ajuda?<Texto variante="pequeno">{ajuda}</Texto>:null}{mensagemErro}
    </View>;
  }
  if(p.tipo==='MULTIPLA_ESCOLHA') {
    const opcoes=p.opcoes??[];
    const marcadas=Array.isArray(valor)?valor:[];
    return <View style={estilos.pergunta}>
      <Texto variante="rotulo">{rotulo}</Texto>
      {opcoes.map(o=><CaixaSelecao key={o.id} rotulo={o.rotulo} marcado={marcadas.includes(o.id)}
        aoMudar={()=>aoMudar(alternarMarcado(marcadas,opcoes,o.id))} />)}
      {ajuda?<Texto variante="pequeno">{ajuda}</Texto>:null}{mensagemErro}
    </View>;
  }
  if(p.tipo==='NOTAS_POR_DIA') {
    const dias=typeof valor==='object' && valor!==null && !Array.isArray(valor)?valor:{};
    return <View style={estilos.pergunta}><Texto variante="rotulo">{rotulo}</Texto>
      {(p.dias??[]).map(d=><EscalaDeNota key={d} rotulo={`Dia ${d}`} valor={dias[String(d)]??null}
        aoMudar={nota=>aoMudar({...dias,[String(d)]:nota})} />)}
      {mensagemErro}
    </View>;
  }
  return <Campo rotulo={rotulo} valor={typeof valor==='string'?valor:''} aoMudar={aoMudar}
    linhas={p.tipo==='TEXTO_LONGO'?4:undefined} maxLength={p.tipo==='TEXTO_LONGO'?2000:500} erro={erro} ajuda={ajuda} />;
}
const estilos=StyleSheet.create({pergunta:{gap:espaco(1)},fotos:{flexDirection:'row',flexWrap:'wrap',gap:espaco(1)}});
