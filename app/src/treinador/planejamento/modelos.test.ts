import type { TipoReceita } from '../../api/tipos';
import { ABA_ATUALIZACAO, abaDoPlanejamento, CATEGORIAS, GRUPOS_DE_MODELOS, slugDaAba, usoDoModelo } from './modelos';

describe('organização da tela Planejamento', () => {
  it('cada tipo aparece uma vez, no grupo certo e na ordem pedida', () => {
    expect(GRUPOS_DE_MODELOS.map((g) => [g.rotulo, g.tipos])).toEqual([
      ['Treino', ['PLANO_TREINO', 'SESSAO_TREINO', 'SERIES', 'METODOLOGIA']],
      ['Dieta', ['PLANO_DIETA', 'REFEICAO']],
      ['Pacotes', ['PASTA_PLANO']],
      ['Mobilidade', ['MOBILIDADE']],
    ]);
    expect(CATEGORIAS).toHaveLength(8);
  });
  it('rótulos novos', () => {
    const rotulo = (t: TipoReceita) => CATEGORIAS.find((c) => c.valor === t)?.rotulo;
    expect(rotulo('SERIES')).toBe('Receitas de séries');
    expect(rotulo('SESSAO_TREINO')).toBe('Dias de treino');
    expect(rotulo('PASTA_PLANO')).toBe('Pacotes (treino, dieta e mobilidade)');
    expect(rotulo('REFEICAO')).toBe('Refeições');
  });
  it('semanas, dietas, pacotes e mobilidade são aplicados ao aluno; peças dizem onde usar, sem inventar uso', () => {
    expect(CATEGORIAS.filter((c) => usoDoModelo(c.valor).aplicavel).map((c) => c.valor)).toEqual(['PLANO_TREINO', 'PLANO_DIETA', 'PASTA_PLANO', 'MOBILIDADE']);
    expect(usoDoModelo('SERIES').linha).toMatch(/^Use dentro do editor/);
    expect(usoDoModelo('REFEICAO').linha).toMatch(/^Use dentro do editor de dieta/);
    expect(usoDoModelo('MOBILIDADE').linha).toBeNull();
    expect(usoDoModelo('PLANO_TREINO').linha).toBeNull();
  });
});

describe('aba do Planejamento pelo endereço', () => {
  it('o valor de ?aba= é o rótulo sem acento nem maiúscula', () => {
    expect([...GRUPOS_DE_MODELOS.map((g) => g.rotulo), ABA_ATUALIZACAO].map(slugDaAba)).toEqual(['treino', 'dieta', 'pacotes', 'mobilidade', 'atualizacao']);
  });

  it('abre a aba pedida e, sem pedido ou com pedido inválido, a primeira que o perfil vê', () => {
    expect(abaDoPlanejamento('dieta', true, true)).toBe('Dieta');
    expect(abaDoPlanejamento('atualizacao', true, true)).toBe(ABA_ATUALIZACAO);
    expect(abaDoPlanejamento(undefined, true, true)).toBe('Treino');
    expect(abaDoPlanejamento('qualquer', true, true)).toBe('Treino');
    expect(abaDoPlanejamento(['mobilidade', 'dieta'], true, false)).toBe('Mobilidade');
  });

  it('não abre aba que o perfil não vê', () => {
    expect(abaDoPlanejamento('dieta', false, true)).toBe(ABA_ATUALIZACAO);
    expect(abaDoPlanejamento(undefined, false, true)).toBe(ABA_ATUALIZACAO);
    expect(abaDoPlanejamento('atualizacao', true, false)).toBe('Treino');
  });
});
