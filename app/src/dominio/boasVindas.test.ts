import {
  chaveBoasVindas,
  deveMostrarBoasVindas,
  lembretePodeAbrir,
  passoDasBoasVindas,
  situacaoDasBoasVindas,
} from './boasVindas';

describe('boas-vindas do aluno', () => {
  it('a chave é por usuário', () => {
    expect(chaveBoasVindas('u1')).toBe('treinos:u1:boasVindasVistas');
    expect(chaveBoasVindas('u1')).not.toBe(chaveBoasVindas('u2'));
  });

  it('mostra só quando a leitura terminou e a marca não existe', () => {
    expect(deveMostrarBoasVindas('lendo', 3)).toBe(false);
    expect(deveMostrarBoasVindas({ valor: null }, 3)).toBe(true);
    expect(deveMostrarBoasVindas({ valor: '1' }, 3)).toBe(false);
  });

  it('falha ao ler ou ausência de passos não mostra nada', () => {
    expect(deveMostrarBoasVindas('falhou', 3)).toBe(false);
    expect(deveMostrarBoasVindas({ valor: null }, 0)).toBe(false);
  });

  it('anda pelos passos e o último vira "Começar"', () => {
    expect(passoDasBoasVindas(0, 3)).toEqual({ indice: 0, ultimo: false, rotuloProximo: 'Próximo', progresso: '1 de 3' });
    expect(passoDasBoasVindas(1, 3).ultimo).toBe(false);
    expect(passoDasBoasVindas(2, 3)).toEqual({ indice: 2, ultimo: true, rotuloProximo: 'Começar', progresso: '3 de 3' });
  });

  it('índice fora da faixa é limitado', () => {
    expect(passoDasBoasVindas(9, 3).indice).toBe(2);
    expect(passoDasBoasVindas(-1, 3).indice).toBe(0);
  });

  it('a situação vai de lendo a aberta ou encerrada, sem passar por "encerrada" antes de ler', () => {
    expect(situacaoDasBoasVindas('lendo', false, 3)).toBe('lendo');
    expect(situacaoDasBoasVindas({ valor: null }, false, 3)).toBe('aberta');
    expect(situacaoDasBoasVindas({ valor: null }, true, 3)).toBe('encerrada'); // pulou, fechou ou chegou ao fim
    expect(situacaoDasBoasVindas({ valor: '1' }, false, 3)).toBe('encerrada');
    expect(situacaoDasBoasVindas('falhou', false, 3)).toBe('encerrada');
    expect(situacaoDasBoasVindas({ valor: null }, false, 0)).toBe('encerrada');
  });

  it('o lembrete da atualização espera as boas-vindas: só abre quando elas estão encerradas', () => {
    expect(lembretePodeAbrir('lendo')).toBe(false);
    expect(lembretePodeAbrir('aberta')).toBe(false);
    expect(lembretePodeAbrir('encerrada')).toBe(true);
  });
});
