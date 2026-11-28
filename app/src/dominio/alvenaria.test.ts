import { colunasDaAlvenaria, posicoesDaAlvenaria } from './alvenaria';

// Pesos do acesso total no hub (itens + 1): Sua conta 5, Consultoria 5, Equipe 4, Alunos e atendimento 8, Financeiro 4,
// Dados 3, Ajuda 3.
const HUB = [5, 5, 4, 8, 4, 3, 3];

describe('colunasDaAlvenaria', () => {
  it('cada item vai para a coluna mais baixa no momento; no empate, a da esquerda', () => {
    expect(colunasDaAlvenaria(HUB, 2)).toEqual([0, 1, 0, 1, 0, 0, 1]); // 16 e 16
    expect(colunasDaAlvenaria(HUB, 3)).toEqual([0, 1, 2, 2, 0, 1, 1]); // 9, 11 e 12
    expect(colunasDaAlvenaria(HUB, 4)).toEqual([0, 1, 2, 3, 2, 0, 1]); // 8, 8, 8 e 8
  });

  // Aparência e preferências do treinador na web (`ui/PreferenciasDoApp`, 28/11): Tema e cores 14, Leitura 9, Layout 3,
  // Treino e dados 5 (4 sem a unidade da carga), Navegador 2 e o cartão Avisos no celular por último, com qualquer peso.
  it('Aparência: Avisos no celular cai embaixo de Navegador em 2 colunas e de Leitura em 3', () => {
    for (const avisos of [2, 3, 4]) for (const treino of [5, 4]) {
      const pesos = [14, 9, 3, treino, 2, avisos];
      expect(colunasDaAlvenaria(pesos, 2)).toEqual([0, 1, 1, 1, 0, 0]);
      expect(colunasDaAlvenaria(pesos, 3)).toEqual([0, 1, 2, 2, 2, 1]);
    }
  });

  it('uma coluna (ou zero) leva tudo para a primeira; sem itens, nada', () => {
    expect(colunasDaAlvenaria(HUB, 1)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(colunasDaAlvenaria([3, 2], 0)).toEqual([0, 0]);
    expect(colunasDaAlvenaria([], 3)).toEqual([]);
  });
});

describe('posicoesDaAlvenaria', () => {
  it('empilha cada coluna com o vão entre um item e o de baixo e mede a coluna mais alta', () => {
    expect(posicoesDaAlvenaria([0, 1, 0, 1], [100, 50, 30, 200], 2, 24)).toEqual({ topos: [0, 0, 124, 74], altura: 274 });
  });

  it('o primeiro de cada coluna fica no topo mesmo com altura ainda não medida (0); coluna vazia não conta', () => {
    expect(posicoesDaAlvenaria([0, 0, 1], [0, 40, 10], 3, 24)).toEqual({ topos: [0, 24, 0], altura: 64 });
    expect(posicoesDaAlvenaria([], [], 2, 24)).toEqual({ topos: [], altura: 0 });
  });
});
