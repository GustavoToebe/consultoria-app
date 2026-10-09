import type { Atualizacao } from '../api/tipos';
import { atualizacaoDaPasta, caminhoAtualizacaoTreinador, faseAtualizacao, formularioSomenteLeitura, limitesNovaDataAtraso, linkCartaoAtualizacao, mostrarCartaoAtualizacao, novaDataAtrasoValida } from './atualizacao';

describe('datas da atualização iguais às do servidor', () => {
  it.each([['2026-10-05','NENHUMA',4,0],['2026-10-06','AVISO',3,0],['2026-10-07','AVISO',2,0],
    ['2026-10-08','ABERTA',1,0],['2026-10-09','ABERTA',0,0],['2026-10-10','ATRASADA',-1,1]])(
    '%s: %s', (hoje,fase,diasParaData,diasDeAtraso) => {
      expect(faseAtualizacao(hoje,'2026-10-09',null)).toEqual({fase,diasParaData,diasDeAtraso});
    });
  it('aviso de atraso adia só o "atrasada"; o formulário abre pela data original', () => {
    expect(faseAtualizacao('2026-10-08','2026-10-09','2026-10-14').fase).toBe('ABERTA');
    expect(faseAtualizacao('2026-10-10','2026-10-09','2026-10-12')).toEqual({fase:'ABERTA',diasParaData:2,diasDeAtraso:0});
    expect(faseAtualizacao('2026-10-12','2026-10-09','2026-10-12').fase).toBe('ABERTA');
    expect(faseAtualizacao('2026-10-13','2026-10-09','2026-10-12')).toEqual({fase:'ATRASADA',diasParaData:-1,diasDeAtraso:1});
    expect(faseAtualizacao('2026-10-10','2026-10-09','2026-10-07').fase).toBe('ATRASADA');
  });
  it('envio preserva o estado', () => {
    expect(faseAtualizacao('2026-10-20','2026-10-09',null,'ENVIADA').fase).toBe('ENVIADA');
    expect(faseAtualizacao('2026-10-20','2026-10-09',null,'REVISADA').fase).toBe('REVISADA');
    expect(faseAtualizacao('2026-10-20',null,null).fase).toBe('NENHUMA');
  });
});

it('próxima atualização sem linha abre a prévia do aluno em vez de um id nulo',()=>{
  expect(caminhoAtualizacaoTreinador({id:null,alunoId:'a1'})).toBe('/treinador/atualizacoes/previa?alunoId=a1');
  expect(caminhoAtualizacaoTreinador({id:'c1',alunoId:'a1'})).toBe('/treinador/atualizacoes/c1');
});

describe('nova data do "vou atrasar" igual à API', () => {
  it('fica entre a data original (ou hoje, se já passou) e quinze dias depois', () => {
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-08')).toBe(false);
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-09')).toBe(true);
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-24')).toBe(true);
    expect(novaDataAtrasoValida('2026-10-08','2026-10-09','2026-10-25')).toBe(false);
    expect(novaDataAtrasoValida('2026-10-12','2026-10-09','2026-10-11')).toBe(false);
    expect(limitesNovaDataAtraso('2026-10-12','2026-10-09')).toEqual({minimo:'2026-10-12',maximo:'2026-10-24'});
  });
  it('com o aviso dado o cartão continua visível', () => {
    const base = {fase:'NENHUMA',atrasoAte:null,feedback:null} as unknown as Atualizacao;
    expect(mostrarCartaoAtualizacao(base)).toBe(false);
    expect(mostrarCartaoAtualizacao({...base,atrasoAte:'2026-10-20'})).toBe(true);
    expect(mostrarCartaoAtualizacao({...base,fase:'ABERTA'})).toBe(true);
    expect(mostrarCartaoAtualizacao({...base,fase:'REVISADA'})).toBe(false);
  });
});

it('atualização aberta pelo histórico que não é a atual fica só leitura', () => {
  expect(formularioSomenteLeitura(undefined,'atual')).toBe(false);
  expect(formularioSomenteLeitura('atual','atual')).toBe(false);
  expect(formularioSomenteLeitura('antiga','atual')).toBe(true);
  expect(formularioSomenteLeitura('antiga',null)).toBe(true);
});

it('antes da véspera o cartão convida a ver o que vai responder, inclusive com atraso avisado', () => {
  const base = {fase:'NENHUMA',atrasoAte:'2026-10-20',feedback:null} as unknown as Atualizacao;
  expect(linkCartaoAtualizacao(base)).toBe('Ver o que vou responder');
  expect(linkCartaoAtualizacao({...base,fase:'AVISO'})).toBe('Ver o que vou responder');
  expect(linkCartaoAtualizacao({...base,fase:'ENVIADA'})).toBe('Ver respostas');
  expect(linkCartaoAtualizacao({...base,fase:'REVISADA',feedback:{texto:'x',em:'',editadoEm:null,naoLido:true,nomeAutor:null}})).toBe('Ler');
});

it('cada pasta mostra a própria atualização: a vigente (mesmo sem linha gravada) ou a do histórico', () => {
  const a = (id: string | null, pastaId: string) => ({id,pastaId}) as unknown as Atualizacao;
  const atual = a(null,'p2');
  const historico = [a('h1','p1'), a('h0','p0')];
  expect(atualizacaoDaPasta('p2',atual,historico)).toBe(atual);
  expect(atualizacaoDaPasta('p1',atual,historico)?.id).toBe('h1');
  expect(atualizacaoDaPasta('p9',atual,historico)).toBeNull();
  expect(atualizacaoDaPasta('p1',null,historico)?.id).toBe('h1');
});
