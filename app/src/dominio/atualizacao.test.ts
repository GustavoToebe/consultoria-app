import { caminhoAtualizacaoTreinador, faseAtualizacao } from './atualizacao';

describe('datas da atualização iguais às do servidor', () => {
  it.each([['2026-10-05','NENHUMA',4,0],['2026-10-06','AVISO',3,0],['2026-10-07','AVISO',2,0],
    ['2026-10-08','ABERTA',1,0],['2026-10-09','ABERTA',0,0],['2026-10-10','ATRASADA',-1,1]])(
    '%s: %s', (hoje,fase,diasParaData,diasDeAtraso) => {
      expect(faseAtualizacao(hoje,'2026-10-09',null)).toEqual({fase,diasParaData,diasDeAtraso});
    });
  it('aviso de atraso muda o prazo e envio preserva o estado', () => {
    expect(faseAtualizacao('2026-10-10','2026-10-09','2026-10-12').fase).toBe('AVISO');
    expect(faseAtualizacao('2026-10-20','2026-10-09',null,'ENVIADA').fase).toBe('ENVIADA');
    expect(faseAtualizacao('2026-10-20','2026-10-09',null,'REVISADA').fase).toBe('REVISADA');
    expect(faseAtualizacao('2026-10-20',null,null).fase).toBe('NENHUMA');
  });
});

it('próxima atualização sem linha abre a prévia do aluno em vez de um id nulo',()=>{
  expect(caminhoAtualizacaoTreinador({id:null,alunoId:'a1'})).toBe('/treinador/atualizacoes/previa?alunoId=a1');
  expect(caminhoAtualizacaoTreinador({id:'c1',alunoId:'a1'})).toBe('/treinador/atualizacoes/c1');
});
