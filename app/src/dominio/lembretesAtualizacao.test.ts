import type { Atualizacao } from '../api/tipos';
import { lembretesDaAtualizacao } from './lembretesAtualizacao';
const base={dataAtualizacao:'2026-10-10',atrasoAte:null,fase:'ABERTA'} as Atualizacao;
it('agenda os três dias às 9h sem conteúdo sensível',()=>{
  const lembretes=lembretesDaAtualizacao(base,new Date(2026,9,1));
  expect(lembretes.map(l=>[l.data.getDate(),l.data.getHours()])).toEqual([[7,9],[10,9],[11,9]]);
  expect(lembretes.every(l=>!l.texto.includes('80.5'))).toBe(true);
});
it('usa o novo prazo, descarta horários passados e cancela depois do envio',()=>{
  const adiados=lembretesDaAtualizacao({...base,atrasoAte:'2026-10-15'},new Date(2026,9,12,10));
  expect(adiados.map(l=>l.data.getDate())).toEqual([15,16]);
  expect(lembretesDaAtualizacao({...base,fase:'ENVIADA'})).toEqual([]);
  expect(lembretesDaAtualizacao({...base,fase:'REVISADA'})).toEqual([]);
  expect(lembretesDaAtualizacao(null)).toEqual([]);
});
