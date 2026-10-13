import { StyleSheet, View } from 'react-native';
import type { Atualizacao, ConteudoQuestionario } from '../api/tipos';
import { resumoDoTreinador } from '../dominio/atualizacaoQuestionario';
import { numeroParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';

/** Resumo do período: peso e variação (se o questionário pergunta o peso), perguntas em destaque e dados do sistema. */
export function ResumoDaAtualizacao({atualizacao:a,modelo}: {atualizacao:Atualizacao;modelo:ConteudoQuestionario}) {
  const resumo=resumoDoTreinador(modelo,a.respostas,a.resumo);
  const sinal=(valor:number)=>`${valor>0?'+':''}${numeroParaTela(valor,1)}`;
  const numeros:[string,string][]=[
    ...(resumo.peso?[
      ['Peso (kg)',numeroParaTela(resumo.peso.valor,1)] as [string,string],
      ['Variação (kg)',resumo.peso.variacao==null?'—':sinal(resumo.peso.variacao)] as [string,string],
    ]:[]),
    ...resumo.destaques.map(d=>[d.rotulo,d.texto] as [string,string]),
  ];
  return <Cartao titulo="Resumo do período">
    {numeros.length?<View style={estilos.numeros}>
      {numeros.map(([rotulo,valor],i)=><View key={`${i}:${rotulo}`} style={estilos.numero}>
        <Texto variante="rotulo">{rotulo}</Texto><Texto variante="destaque" numerico>{valor}</Texto>
      </View>)}
    </View>:null}
    <Texto>Média de {numeroParaTela(resumo.mediaDiasPorSemana,1)} dias com treino por semana (registrado no app)</Texto>
    {resumo.peso?<Texto variante="pequeno">Peso anterior: {resumo.pesoAnterior==null?'—':`${numeroParaTela(resumo.pesoAnterior,1)} kg`}</Texto>:null}
  </Cartao>;
}
const estilos=StyleSheet.create({numeros:{flexDirection:'row',flexWrap:'wrap',gap:espaco(3)},numero:{minWidth:130,gap:espaco(1)}});
