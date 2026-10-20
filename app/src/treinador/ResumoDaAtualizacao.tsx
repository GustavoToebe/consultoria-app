import { StyleSheet, View } from 'react-native';
import type { Atualizacao, ConteudoQuestionario } from '../api/tipos';
import { resumoDoTreinador } from '../dominio/atualizacaoQuestionario';
import { numeroParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { baixarFotoDoTreinador } from '../api/rotas';
import { idsDeFotos } from '../dominio/fotosAtualizacao';
import { Cartao } from '../ui/Cartao';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { Selo, type TipoSelo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/**
 * Resumo do período: peso e variação (se o questionário pergunta o peso), perguntas em destaque e dados do sistema. A
 * situação (selo) e o questionário em uso ficam no cabeçalho do cartão, não soltos na tela.
 */
export function ResumoDaAtualizacao({atualizacao:a,modelo,selo,descricao}: {atualizacao:Atualizacao;modelo:ConteudoQuestionario;selo?:{texto:string;tipo:TipoSelo}|null;descricao?:string}) {
  const resumo=resumoDoTreinador(modelo,a.respostas,a.resumo);
  const sinal=(valor:number)=>`${valor>0?'+':''}${numeroParaTela(valor,1)}`;
  const numeros:[string,string][]=[
    ...(resumo.peso?[
      ['Peso (kg)',numeroParaTela(resumo.peso.valor,1)] as [string,string],
      ['Variação (kg)',resumo.peso.variacao==null?'—':sinal(resumo.peso.variacao)] as [string,string],
    ]:[]),
    ...resumo.destaques.map(d=>[d.rotulo,d.texto] as [string,string]),
  ];
  // Fotos da atualização (se o questionário tem a pergunta): miniaturas pela rota do treinador, "—" sem nenhuma.
  const perguntaFotos=modelo.secoes.flatMap(s=>s.perguntas).find(p=>p.tipo==='FOTOS');
  const fotos=perguntaFotos?idsDeFotos(a.respostas?.[perguntaFotos.id]):[];
  return <Cartao titulo="Resumo do período" descricao={descricao} acoes={selo?<Selo texto={selo.texto} tipo={selo.tipo} />:undefined}>
    {numeros.length?<View style={estilos.numeros}>
      {numeros.map(([rotulo,valor],i)=><View key={`${i}:${rotulo}`} style={estilos.numero}>
        <Texto variante="rotulo">{rotulo}</Texto><Texto variante="destaque" numerico>{valor}</Texto>
      </View>)}
    </View>:null}
    <Texto>Média de {numeroParaTela(resumo.mediaDiasPorSemana,1)} dias com treino por semana (registrado no app)</Texto>
    {perguntaFotos?<View style={estilos.fotos}>
      <Texto variante="rotulo">Fotos</Texto>
      {fotos.length&&a.id?<View style={estilos.faixa}>{fotos.map(id=><ImagemProtegida key={id} chave={`resumo:${id}`} descricao="Foto da atualização"
        carregar={()=>baixarFotoDoTreinador(a.id!,id)} />)}</View>:<Texto>—</Texto>}
    </View>:null}
    {resumo.peso?<Texto variante="pequeno">Peso anterior: {resumo.pesoAnterior==null?'—':`${numeroParaTela(resumo.pesoAnterior,1)} kg`}</Texto>:null}
  </Cartao>;
}
const estilos=StyleSheet.create({numeros:{flexDirection:'row',flexWrap:'wrap',gap:espaco(3)},numero:{minWidth:130,gap:espaco(1)},fotos:{gap:espaco(1)},faixa:{flexDirection:'row',flexWrap:'wrap',gap:espaco(1)}});
