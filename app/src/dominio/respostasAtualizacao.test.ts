import type { ModeloAtualizacao, RespostasAtualizacao } from '../api/tipos';
import { errosRespostasAtualizacao } from './respostasAtualizacao';
const modelo:ModeloAtualizacao={versao:1,instrucoes:[],secoes:[{titulo:'Fictício',perguntas:[
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
