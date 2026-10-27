import type { DiaDeTreino, TreinoAtual } from '../api/tipos';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { novaSessao, novoExercicio, novaSerie, normalizarTreino } from './editorTreino';
import { periodoDaSemana, progressoSemana } from './progressoSemana';
let mockUid=0;
jest.mock('./uid',()=>({novoUid:()=>String(++mockUid)}));
const segunda={...novaSessao(1),uid:'seg',exercicios:[{...novoExercicio(),series:[{...novaSerie(null),uid:'s'}]}]};
const sexta={...novaSessao(5),uid:'sex',exercicios:segunda.exercicios};
const plano:TreinoAtual={planoId:'p',versaoId:'v',numero:1,titulo:'Teste',inicio:null,fim:null,publicadoEm:'',conteudo:{...normalizarTreino(null),sessoes:[segunda,sexta,{...novaSessao(2),tipo:'DESCANSO'},{...novaSessao(3),tipo:'ACESSORIOS'}]}};
const registro:RegistroLocal={id:'r',planoVersaoId:'v',sessaoUid:'seg',exercicioUid:'e',serieUid:'s',exercicioId:null,trabalho:true,data:'2026-10-05',carga:null,repeticoes:null,concluida:true,observacao:null,etapas:null,referenciaCarga:null,referenciaOrigem:null,alteradoEm:'',situacao:'LOCAL',motivo:null};
it('segunda a domingo: conta só treinos e a série da data correta',()=>{
 expect(periodoDaSemana('2026-10-11')).toEqual({inicio:'2026-10-05',fim:'2026-10-11'});
 expect(progressoSemana(plano,'2026-10-08',[registro,{...registro,id:'2',data:'2026-09-28'},{...registro,id:'3',planoVersaoId:'antiga'}])).toEqual({feitas:1,total:2});
});
it('respeita o período do plano, versões, futuro e ausência de plano',()=>{
 expect(progressoSemana({...plano,inicio:'2026-10-06'},'2026-10-08',[registro])).toEqual({feitas:0,total:1});
 expect(progressoSemana({...plano,fim:'2026-10-06'},'2026-10-08',[registro])).toEqual({feitas:1,total:1});
 expect(progressoSemana(plano,'2026-10-08',[{...registro,sessaoUid:'sex',data:'2026-10-09'}])).toEqual({feitas:0,total:2});
 expect(progressoSemana(null,'2026-10-08',[])).toBeNull();
});
it('junta histórico e locais, e desmarcar no aparelho prevalece',()=>{
 const historico:DiaDeTreino[]=[{data:'2026-10-05',sessoes:[{sessaoUid:'seg',sessao:'Segunda',planoVersaoId:'v',exercicios:[{exercicioUid:'e',exercicioId:null,nome:'Teste',series:[{id:'r',serieUid:'s',tipo:'WS',trabalho:true,carga:null,unidade:null,repeticoes:null,concluida:true,observacao:null}]}]}]}];
 expect(progressoSemana(plano,'2026-10-08',[],historico)).toEqual({feitas:1,total:2});
 expect(progressoSemana(plano,'2026-10-08',[{...registro,concluida:false}],historico)).toEqual({feitas:0,total:2});
 expect(progressoSemana(plano,'2026-10-08',[registro,registro],historico)).toEqual({feitas:1,total:2});
});
