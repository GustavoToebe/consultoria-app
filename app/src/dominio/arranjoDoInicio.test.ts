import { colunasDaVitrineDoInicio, inicioLargo, inicioLargoDoAluno, linhasDoInicio, type PecaDoInicio } from './arranjoDoInicio';

/** Os blocos na ordem do leitor de tela, com "semana e nível" aberto. */
const emOrdem = (pecas: readonly PecaDoInicio[]) => pecas.flatMap((p) => (p === 'semanaENivel' ? ['semana', 'nivel'] : [p]));

describe('inicioLargo', () => {
  it('abre na área de 952 (a da PrincipalComApoio das outras telas do aluno): 1280 com o menu aberto já é largo', () => {
    expect(inicioLargo(951)).toBe(false);
    expect(inicioLargo(952)).toBe(true);
    expect(inicioLargo(984)).toBe(true);
  });
});

describe('inicioLargoDoAluno', () => {
  it('topo: Hoje, Dieta e compromissos na principal; pendências e Água no apoio; embaixo semana e nível, o mapa e a vitrine', () => {
    expect(inicioLargoDoAluno({ retorno: true, vitrine: true })).toEqual({
      principal: ['hoje', 'dieta', 'compromissos'], apoio: ['pendencias', 'agua'], linhas: ['semanaENivel', 'mapa', 'vitrine'],
    });
  });

  it('sem o retorno não há linha do mapa; sem itens na vitrine, nem linha dela (nada de linha vazia)', () => {
    expect(inicioLargoDoAluno({ retorno: false, vitrine: false }).linhas).toEqual(['semanaENivel']);
    expect(inicioLargoDoAluno({ retorno: false, vitrine: true }).linhas).toEqual(['semanaENivel', 'vitrine']);
  });

  it('nenhum bloco muda de coluna com o que chega da API (só o retorno e a vitrine decidem as linhas de baixo)', () => {
    for (const retorno of [true, false]) for (const vitrine of [true, false]) {
      const a = inicioLargoDoAluno({ retorno, vitrine });
      expect(a.principal).toEqual(['hoje', 'dieta', 'compromissos']);
      expect(a.apoio).toEqual(['pendencias', 'agua']);
      const ordem = emOrdem([...a.principal, ...a.apoio, ...a.linhas]);
      expect(ordem[0]).toBe('hoje');
      expect(new Set(ordem).size).toBe(ordem.length);
      expect(ordem.includes('mapa')).toBe(retorno);
      if (vitrine) expect(ordem[ordem.length - 1]).toBe('vitrine');
    }
  });
});

describe('colunasDaVitrineDoInicio', () => {
  it('célula mínima de 240 e no máximo uma coluna por item', () => {
    expect(colunasDaVitrineDoInicio(1272, 2, 12)).toBe(2);
    expect(colunasDaVitrineDoInicio(1272, 9, 12)).toBe(5);
    expect(colunasDaVitrineDoInicio(400, 2, 12)).toBe(1);
    expect(colunasDaVitrineDoInicio(0, 2, 12)).toBe(1);
  });
});

describe('linhasDoInicio', () => {
  it('celular: uma coluna com o Hoje primeiro, depois Dieta e Água, pendências e compromissos, semana e nível, o mapa e a vitrine', () => {
    for (const retorno of [true, false]) {
      expect(linhasDoInicio({ retorno, duasColunas: false })).toEqual([[['hoje', 'dieta', 'agua', 'pendencias', 'compromissos', 'semana', 'nivel', 'mapa', 'vitrine']]]);
    }
  });

  it('duas colunas com o retorno: Hoje e Dieta | Água; depois semana e nível lado a lado; o mapa na largura toda', () => {
    expect(linhasDoInicio({ retorno: true, duasColunas: true })).toEqual([
      [['hoje', 'dieta', 'pendencias'], ['agua', 'compromissos', 'vitrine']],
      [['semanaENivel']],
      [['mapa']],
    ]);
  });

  it('duas colunas sem o retorno: sem linha de nível nem de mapa (nada de linha vazia); a semana vai para a pilha da Água', () => {
    expect(linhasDoInicio({ retorno: false, duasColunas: true })).toEqual([[['hoje', 'dieta', 'pendencias'], ['agua', 'compromissos', 'semana', 'vitrine']]]);
  });

  it('em todo arranjo o Hoje vem primeiro, a Dieta antes da Água e cada bloco aparece uma vez', () => {
    for (const retorno of [true, false]) for (const duasColunas of [true, false]) {
      const ordem = emOrdem(linhasDoInicio({ retorno, duasColunas }).flat(2));
      expect(ordem[0]).toBe('hoje');
      expect(ordem.indexOf('dieta')).toBeLessThan(ordem.indexOf('agua'));
      expect(new Set(ordem).size).toBe(ordem.length);
      for (const b of ['hoje', 'dieta', 'agua', 'pendencias', 'compromissos', 'semana', 'vitrine']) expect(ordem).toContain(b);
      if (retorno) expect(ordem).toEqual(expect.arrayContaining(['nivel', 'mapa']));
    }
  });
});
