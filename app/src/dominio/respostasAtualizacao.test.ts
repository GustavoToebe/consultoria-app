import type { ConteudoQuestionario, RespostasAtualizacao } from '../api/tipos';
import { LIMITES_QUESTIONARIO } from './questionario';
import { errosRespostasAtualizacao } from './respostasAtualizacao';
const modelo:ConteudoQuestionario={instrucoes:[],secoes:[{titulo:'Fictício',perguntas:[
  {id:'peso',tipo:'PESO',rotulo:'Peso',obrigatoria:true},{id:'nota',tipo:'NOTA',rotulo:'Nota',obrigatoria:true},
  {id:'texto',tipo:'TEXTO',rotulo:'Texto',obrigatoria:false},{id:'dias',tipo:'NOTAS_POR_DIA',rotulo:'Dias',obrigatoria:false,dias:[1,2]},
]}]};
it('não transforma campo vazio em zero e aceita nota zero',()=>{
  expect(errosRespostasAtualizacao(modelo,{peso:null,nota:0})).toEqual({peso:'Preencha este campo.'});
  expect(errosRespostasAtualizacao(modelo,{peso:80.5,nota:0,desconhecido:'ignorado'})).toEqual({});
});
const invalidas:RespostasAtualizacao[]=[{peso:0,nota:5},{peso:80.55,nota:5},{peso:80,nota:11},{peso:80,nota:5,texto:'x'.repeat(501)},
  {peso:80,nota:5,dias:{'3':5}}];
it.each(invalidas)('recusa formato ou faixa inválida',respostas=>{
  expect(Object.keys(errosRespostasAtualizacao(modelo,respostas)).length).toBeGreaterThan(0);
});

// Os quatro tipos novos: as regras campo a campo estão nas fixtures de paridade com o Java.
const novos:ConteudoQuestionario={instrucoes:[],secoes:[{titulo:'Fictício',perguntas:[
  {id:'e',tipo:'ESCOLHA_UNICA',rotulo:'E',obrigatoria:true,opcoes:[{id:'a',rotulo:'A'},{id:'b',rotulo:'B'}]},
  {id:'m',tipo:'MULTIPLA_ESCOLHA',rotulo:'M',obrigatoria:false,opcoes:[{id:'a',rotulo:'A'},{id:'b',rotulo:'B'}]},
  {id:'n',tipo:'NUMERO',rotulo:'N',obrigatoria:false,min:0,max:10,casas:1},
  {id:'s',tipo:'SIM_NAO',rotulo:'S',obrigatoria:true},
]}]};
it('aceita os tipos novos e conta "não" e lista vazia corretamente',()=>{
  expect(errosRespostasAtualizacao(novos,{e:'a',m:['a','b'],n:2.5,s:false})).toEqual({});
  expect(errosRespostasAtualizacao(novos,{e:'a',m:[],s:true})).toEqual({});
  expect(errosRespostasAtualizacao(novos,{e:'',s:null})).toEqual({e:'Preencha este campo.',s:'Preencha este campo.'});
});
const novasInvalidas:RespostasAtualizacao[]=[{e:'z',s:true},{e:'a',s:true,m:['a','a']},{e:'a',s:true,m:'a'},{e:'a',s:true,n:11},
  {e:'a',s:true,n:2.25},{e:'a',s:true,n:'2'},{e:'a',s:'sim'}];
it.each(novasInvalidas)('recusa tipo novo fora do contrato',respostas=>{
  expect(Object.keys(errosRespostasAtualizacao(novos,respostas)).length).toBeGreaterThan(0);
});

it('o teto das respostas é de 256 KiB contados em bytes',()=>{
  const moldura='{"texto":""}'.length;
  const no={texto:'a'.repeat(LIMITES_QUESTIONARIO.respostasBytes-moldura)};
  expect(errosRespostasAtualizacao(modelo,{peso:80,nota:5,...no}).respostas).toBeDefined();
  // Sem os outros campos a moldura é menor: aqui conta só o teto, e o texto sozinho passa dele.
  expect(errosRespostasAtualizacao({instrucoes:[],secoes:[]},no).respostas).toBeUndefined();
  expect(errosRespostasAtualizacao({instrucoes:[],secoes:[]},{texto:no.texto+'a'}).respostas).toBeDefined();
  expect(errosRespostasAtualizacao({instrucoes:[],secoes:[]},{texto:'ã'.repeat(LIMITES_QUESTIONARIO.respostasBytes/2)}).respostas).toBeDefined();
});

// Fotos: as regras de formato estão nas fixtures de paridade; aqui, o que é só do app (fotos ainda no aparelho).
const comFotos:ConteudoQuestionario={instrucoes:[],secoes:[{titulo:'Fictício',perguntas:[
  {id:'fotos',tipo:'FOTOS',rotulo:'Fotos',obrigatoria:true},
]}]};
const ID='0b8f6f0e-6a53-4c3b-9d5a-2f1a4f3f9a11';
it('foto no aparelho conta como respondida e entra no limite junto com as enviadas',()=>{
  expect(errosRespostasAtualizacao(comFotos,{},true)).toEqual({fotos:'Preencha este campo.'});
  expect(errosRespostasAtualizacao(comFotos,{},true,{fotos:2})).toEqual({});
  expect(errosRespostasAtualizacao(comFotos,{fotos:[ID]},true,{fotos:5})).toEqual({});
  expect(Object.keys(errosRespostasAtualizacao(comFotos,{fotos:[ID]},true,{fotos:6}))).toEqual(['fotos']);
  expect(Object.keys(errosRespostasAtualizacao(comFotos,{fotos:['x']},true,{fotos:1}))).toEqual(['fotos']);
});
it('com as fotos desligadas a pergunta é ignorada, mesmo obrigatória',()=>{
  expect(errosRespostasAtualizacao(comFotos,{},false)).toEqual({});
  expect(errosRespostasAtualizacao(comFotos,{fotos:['x']},false)).toEqual({});
});
