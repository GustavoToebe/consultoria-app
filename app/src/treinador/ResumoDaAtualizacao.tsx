import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { Atualizacao, ConteudoQuestionario } from '../api/tipos';
import { resumoDoTreinador } from '../dominio/atualizacaoQuestionario';
import { numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { baixarFotoDoTreinador } from '../api/rotas';
import { idsDeFotos } from '../dominio/fotosAtualizacao';
import { LinhaDoCicloNaAtualizacao } from './ciclo/CicloNaFicha';
import { Cartao } from '../ui/Cartao';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { Selo, type TipoSelo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/**
 * Resumo do período: peso e variação (se o questionário pergunta o peso), perguntas em destaque e dados do sistema. A
 * situação (selo com ícone) e o questionário em uso ficam na faixa do cartão, não soltos na tela; cada número é um
 * item do bloco (fundo `superficie2` e borda), como os blocos de número da ficha.
 */
export function ResumoDaAtualizacao({atualizacao:a,modelo,selo,descricao}: {atualizacao:Atualizacao;modelo:ConteudoQuestionario;selo?:{texto:string;tipo:TipoSelo;Icone?:LucideIcon}|null;descricao?:string}) {
  const {cores}=useTema();
  const resumo=resumoDoTreinador(modelo,a.respostas,a.resumo);
  const sinal=(valor:number)=>`${valor>0?'+':''}${numeroParaTela(valor,1)}`;
  const numeros:[string,string][]=[
    ...(resumo.peso?[
      ['Peso (kg)',numeroParaTela(resumo.peso.valor,1)] as [string,string],
      ['Variação (kg)',resumo.peso.variacao==null?'—':sinal(resumo.peso.variacao)] as [string,string],
    ]:[]),
    ...resumo.destaques.map(d=>[d.rotulo,d.texto] as [string,string]),
  ];
  // Fotos da atualização (um bloco por pergunta FOTOS, até 6): miniaturas pela rota do treinador, "—" sem nenhuma.
  const perguntasFotos=modelo.secoes.flatMap(s=>s.perguntas).filter(p=>p.tipo==='FOTOS');
  return <Cartao titulo="Resumo do período" descricao={descricao} acoes={selo?<Selo texto={selo.texto} tipo={selo.tipo} Icone={selo.Icone} />:undefined}>
    {numeros.length?<View style={estilos.numeros}>
      {numeros.map(([rotulo,valor],i)=><View key={`${i}:${rotulo}`} style={[estilos.numero,{backgroundColor:cores.superficie2,borderColor:cores.borda}]}>
        <Texto variante="rotulo">{rotulo}</Texto><Texto variante="destaque" numerico>{valor}</Texto>
      </View>)}
    </View>:null}
    <Texto>Média de {numeroParaTela(resumo.mediaDiasPorSemana,1)} dias com treino por semana (registrado no app)</Texto>
    <LinhaDoCicloNaAtualizacao alunoId={a.alunoId} pastaId={a.pastaId} data={a.dataAtualizacao} />
    {perguntasFotos.map(p=>{
      const fotos=idsDeFotos(a.respostas?.[p.id]);
      const rotulo=perguntasFotos.length>1?(p.rotulo.trim()||'Fotos'):'Fotos';
      return <View key={p.id} style={estilos.fotos}>
        <Texto variante="rotulo">{rotulo}</Texto>
        {fotos.length&&a.id?<View style={estilos.faixa}>{fotos.map(id=><ImagemProtegida key={id} chave={`resumo:${id}`} descricao={`Foto: ${rotulo}`}
          carregar={()=>baixarFotoDoTreinador(a.id!,id)} />)}</View>:<Texto>—</Texto>}
      </View>;
    })}
    {resumo.peso?<Texto variante="pequeno">Peso anterior: {resumo.pesoAnterior==null?'—':`${numeroParaTela(resumo.pesoAnterior,1)} kg`}</Texto>:null}
  </Cartao>;
}
const estilos=StyleSheet.create({numeros:{flexDirection:'row',flexWrap:'wrap',gap:espaco(1.5)},numero:{flexGrow:1,flexBasis:130,minWidth:0,gap:espaco(0.5),borderWidth:1,borderRadius:RAIO,padding:espaco(1.5)},fotos:{gap:espaco(1)},faixa:{flexDirection:'row',flexWrap:'wrap',gap:espaco(1)}});
