import { deslocamentoAcimaDoRodape, FOLGA_ACIMA_DO_RODAPE } from './focoAcimaDoRodape';

describe('deslocamentoAcimaDoRodape (foco não encoberto pelo rodapé grudado)', () => {
  // Janela de 720 com o rodapé grudado de 640 a 720 e a rolagem começando em 0.
  const RODAPE = 640;

  it('não rola o que já está inteiro acima do rodapé, com a folga', () => {
    expect(deslocamentoAcimaDoRodape({ topo: 500, base: 544 }, RODAPE, 0)).toBe(0);
    expect(deslocamentoAcimaDoRodape({ topo: 588, base: RODAPE - FOLGA_ACIMA_DO_RODAPE }, RODAPE, 0)).toBe(0);
  });

  it('o campo atrás do rodapé sobe até a base dele mais a folga de 8 px', () => {
    // Base em 700 (60 px sob o topo do rodapé): rola 68.
    expect(deslocamentoAcimaDoRodape({ topo: 656, base: 700 }, RODAPE, 0)).toBe(68);
    // Encostado no rodapé (sem a folga): rola só a folga.
    expect(deslocamentoAcimaDoRodape({ topo: 596, base: RODAPE }, RODAPE, 0, 8)).toBe(8);
  });

  it('campo mais alto que o vão fica com o topo à mostra, nunca rola além dele', () => {
    // Área de texto de 700 px começando em 100: rolar 668 esconderia o topo; para no topo da rolagem + folga.
    expect(deslocamentoAcimaDoRodape({ topo: 100, base: 800 }, RODAPE, 0)).toBe(100 - FOLGA_ACIMA_DO_RODAPE);
    // Topo já colado no topo da rolagem: não rola (o negativo vira 0).
    expect(deslocamentoAcimaDoRodape({ topo: 2, base: 900 }, RODAPE, 0)).toBe(0);
  });

  it('respeita o topo da rolagem fora do 0 da janela (cabeçalho do app acima)', () => {
    expect(deslocamentoAcimaDoRodape({ topo: 150, base: 900 }, RODAPE, 120)).toBe(150 - FOLGA_ACIMA_DO_RODAPE - 120);
  });
});
