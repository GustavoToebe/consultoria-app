import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { Atualizacao, ConteudoQuestionario } from '../api/tipos';
import { resumoDoTreinador } from '../dominio/atualizacaoQuestionario';
import { fraseDeTreinosNoPeriodo } from '../dominio/atualizacao';
import { numeroParaTela } from '../dominio/formatos';
import { textoDaDiferenca } from '../dominio/variacaoDoPeso';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { baixarFotoDoTreinador, pesosDoAluno } from '../api/rotas';
import { tomDaVariacaoDoPeso } from '../dominio/corDaVariacaoDoPeso';
import { linhaDaMeta } from '../dominio/metaDoPesoNaFicha';
import { useSessao } from '../sessao/SessaoProvider';
import { useCarregar } from '../ui/useCarregar';
import { idsDeFotos, lugarDaFoto } from '../dominio/fotosAtualizacao';
import { LinhaDoCicloNaAtualizacao } from './ciclo/CicloNaFicha';
import { Cartao } from '../ui/Cartao';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { Selo, type TipoSelo } from '../ui/Selo';
import { fundoPintado, superficiePintada } from '../ui/superficiePintada';
import { Texto } from '../ui/Texto';

/**
 * Resumo do período: peso e variação (se o questionário pergunta o peso), perguntas em destaque e dados do sistema. A
 * situação (selo com ícone) e o questionário em uso ficam na faixa do cartão, não soltos na tela; cada número é um
 * item do bloco (fundo `superficie2` e borda), como os blocos de número da ficha. A variação leva seta, sinal e a cor
 * da meta efetiva do aluno, que vem da lista de pesos (`GET /alunos/{id}/pesos`); sem ela, fica sem cor.
 */
export function ResumoDaAtualizacao({atualizacao:a,modelo,selo,descricao}: {atualizacao:Atualizacao;modelo:ConteudoQuestionario;selo?:{texto:string;tipo:TipoSelo;Icone?:LucideIcon}|null;descricao?:string}) {
  const {cores,variante}=useTema();
  const {pode}=useSessao();
  const resumo=resumoDoTreinador(modelo,a.respostas,a.resumo);
  // Com uma casa, como o número da tela: "0" nunca ganha seta nem cor.
  const variacao=resumo.peso?.variacao==null?null:Math.round(resumo.peso.variacao*10)/10;
  // A meta é só para a cor: falhou ou sem permissão, a variação fica sem cor e nada de erro na tela.
  const meta=useCarregar(variacao!==null&&pode('ALUNO_SENSIVEL_LER')?`meta-do-peso:${a.alunoId}`:null,
    ()=>pesosDoAluno(a.alunoId).then(l=>l.find(p=>p.metaDoPeso)?.metaDoPeso??null,()=>null)).dados??null;
  const tom=tomDaVariacaoDoPeso(variacao,meta);
  const corDaVariacao=tom==='positivo'?cores.sucesso:tom==='problema'?cores.perigo:undefined;
  // Cartão de indicador pintado (23/11): a caixa da variação com meta ganha a cor da situação (`ui/superficiePintada`).
  const pintar=(cor?:string)=>cor?superficiePintada(cor,cores.superficie2,variante,cores):null;
  const sinal=(valor:number)=>valor>0?`▲ ${textoDaDiferenca(valor)}`:valor<0?`▼ ${textoDaDiferenca(valor)}`:textoDaDiferenca(0);
  const linha=variacao?linhaDaMeta(meta,'equipe'):null;
  const numeros:[string,string,string?,string?][]=[
    ...(resumo.peso?[
      ['Peso (kg)',numeroParaTela(resumo.peso.valor,1)] as [string,string],
      ['Variação',variacao==null?'—':sinal(variacao),corDaVariacao] as [string,string,string?],
    ]:[]),
    ...resumo.destaques.map(d=>[d.rotulo,d.nota?.valor??d.texto,undefined,d.nota?.escala] as [string,string,string?,string?]),
  ];
  // Fotos da atualização (um bloco por pergunta FOTOS, até 6): miniaturas pela rota do treinador, "—" sem nenhuma.
  const perguntasFotos=modelo.secoes.flatMap(s=>s.perguntas).filter(p=>p.tipo==='FOTOS');
  return <Cartao titulo="Resumo do período" descricao={descricao} acoes={selo?<Selo texto={selo.texto} tipo={selo.tipo} Icone={selo.Icone} />:undefined}>
    {numeros.length?<View style={estilos.numeros}>
      {numeros.map(([rotulo,valor,cor,escala],i)=>{const p=pintar(cor);return <View key={`${i}:${rotulo}`} style={[estilos.numero,{backgroundColor:cores.superficie2,borderColor:p?.borda??cores.borda},p?fundoPintado(p):null]}>
        <Texto variante="rotulo" cor={p?.texto}>{rotulo}</Texto><Texto variante="destaque" numerico cor={p?.texto}>{valor}</Texto>{escala?<Texto variante="pequeno">{escala}</Texto>:null}
      </View>;})}
    </View>:null}
    <Texto>{fraseDeTreinosNoPeriodo(resumo.diasComTreino,resumo.mediaDiasPorSemana)}</Texto>
    <LinhaDoCicloNaAtualizacao alunoId={a.alunoId} pastaId={a.pastaId} data={a.dataAtualizacao} />
    {perguntasFotos.map(p=>{
      const fotos=idsDeFotos(a.respostas?.[p.id]);
      const rotulo=perguntasFotos.length>1?(p.rotulo.trim()||'Fotos'):'Fotos';
      // Com lugares, a foto i é o lugar i: o nome vai sobre a miniatura (sem lugar correspondente, o rótulo da pergunta).
      const comLugares=(p.lugares?.length??0)>0;
      return <View key={p.id} style={estilos.fotos}>
        <Texto variante="rotulo">{rotulo}</Texto>
        {fotos.length&&a.id?<View style={estilos.faixa}>{fotos.map((id,i)=>{
          const nome=comLugares?lugarDaFoto(p,i):rotulo;
          const imagem=<ImagemProtegida key={id} chave={`resumo:${id}`} descricao={`Foto: ${nome}`} carregar={()=>baixarFotoDoTreinador(a.id!,id)} />;
          return comLugares?<View key={id} style={estilos.lugar}><Texto variante="pequeno" cor={cores.texto} numberOfLines={2}>{nome}</Texto>{imagem}</View>:imagem;
        })}</View>:<Texto>—</Texto>}
      </View>;
    })}
    {resumo.peso?<Texto variante="pequeno">Peso anterior: {resumo.pesoAnterior==null?'—':`${numeroParaTela(resumo.pesoAnterior,1)} kg`}</Texto>:null}
    {resumo.peso&&linha?<Texto variante="pequeno">{linha}</Texto>:null}
  </Cartao>;
}
const estilos=StyleSheet.create({numeros:{flexDirection:'row',flexWrap:'wrap',gap:espaco(1.5)},numero:{flexGrow:1,flexBasis:130,minWidth:0,gap:espaco(0.5),borderWidth:1,borderRadius:RAIO,padding:espaco(1.5)},fotos:{gap:espaco(1)},faixa:{flexDirection:'row',flexWrap:'wrap',gap:espaco(1)},lugar:{width:96,gap:espaco(0.5)}});
