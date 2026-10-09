import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Atualizacao, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import { dataParaTela, numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Texto } from '../../ui/Texto';

const NOTAS = Array.from({length:11},(_,valor)=>({valor,rotulo:String(valor)}));
interface Props {
  atualizacao: Atualizacao;
  respostas: RespostasAtualizacao;
  aoMudar?: (id: string, valor: RespostaAtualizacao) => void;
  erros?: Record<string,string>;
  campos?: RefObject<Map<string,View>>;
}

/** O modelo da API define ordem, tipos e rótulos; aluno e treinador leem a mesma versão. */
export function QuestionarioAtualizacao({atualizacao:a,respostas,aoMudar,erros={},campos}:Props) {
  return <>
    {a.modelo?.secoes.map(secao=><Cartao key={secao.titulo} cabecalho={<CabecalhoDeGrupo titulo={secao.titulo} />}>
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
  const ajuda=p.id==='treino_dias' && a.resumo?.mediaDiasPorSemana!=null
    ? `No app: média de ${numeroParaTela(a.resumo.mediaDiasPorSemana,1)} dias com treino por semana neste período`
    : p.ajuda;
  if(p.tipo==='DATA_AUTOMATICA') return <View style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto><Texto numerico>{dataParaTela(a.dataAtualizacao)||'—'}</Texto></View>;
  if(p.tipo==='FOTOS') return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{p.rotulo}</Texto>
    <View style={estilos.fotos}>{['Frente','Costas','Lado','Livre'].map(pose=><Botao key={pose} tipo="secundario" rotulo={pose}
      aoTocar={()=>avisar('Envio de fotos ainda não implementado.')} />)}</View>
  </View>;
  if(!aoMudar) {
    const texto=valor==null || valor==='' ? '—' : typeof valor==='object'
      ? (p.dias??[]).map(d=>`Dia ${d}: ${valor[String(d)]??'—'}`).join('\n')
      : typeof valor==='number' ? `${numeroParaTela(valor,p.tipo==='PESO'?1:0)}${p.tipo==='PESO'?' kg':''}` : valor;
    return <View style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto><Texto>{texto}</Texto>{ajuda?<Texto variante="pequeno">{ajuda}</Texto>:null}</View>;
  }
  if(p.tipo==='PESO') return <CampoNumerico rotulo={rotulo} valor={typeof valor==='number'?valor:null}
    aoMudar={aoMudar} ajuda="Em kg, de 20 a 400, com uma casa decimal." erro={erro} />;
  if(p.tipo==='NOTA') return <View style={estilos.pergunta}>
    <Escolha rotulo={rotulo} opcoes={NOTAS} valor={typeof valor==='number'?valor:null} aoMudar={aoMudar} />
    {erro?<Texto cor={cores.perigo}>{erro}</Texto>:null}
  </View>;
  if(p.tipo==='NOTAS_POR_DIA') {
    const dias=typeof valor==='object' && valor!==null?valor:{};
    return <View style={estilos.pergunta}><Texto variante="rotulo">{rotulo}</Texto>
      {(p.dias??[]).map(d=><Escolha key={d} rotulo={`Dia ${d}`} opcoes={NOTAS} valor={dias[String(d)]??null}
        aoMudar={nota=>aoMudar({...dias,[String(d)]:nota})} />)}
      {erro?<Texto cor={cores.perigo}>{erro}</Texto>:null}
    </View>;
  }
  return <Campo rotulo={rotulo} valor={typeof valor==='string'?valor:''} aoMudar={aoMudar}
    linhas={p.tipo==='TEXTO_LONGO'?4:undefined} maxLength={p.tipo==='TEXTO_LONGO'?2000:500} erro={erro} ajuda={ajuda} />;
}
const estilos=StyleSheet.create({pergunta:{gap:espaco(1)},fotos:{flexDirection:'row',flexWrap:'wrap',gap:espaco(1)}});
