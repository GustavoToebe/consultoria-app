import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import { AREIA, CLARO, ESCURO, contraste, tingido, type Cores } from '../tema/tokens';

/**
 * Pares de cor que as peças comuns de `ui/` usam depois do passo 1 da atualização visual (30/10), conferidos em todos os
 * temas, com contraste alto e com "Bordas reforçadas": texto ≥ 4,5:1 e borda de controle ≥ 3:1 (WCAG 1.4.3 e 1.4.11).
 * O Jest não monta as peças (o lucide é ESM); quem mudar uma cor nelas atualiza o par aqui.
 */
const BASES: [string, Cores, boolean][] = [['claro', CLARO, false], ['claro areia', AREIA, false], ['escuro', ESCURO, true]];
const VARIANTES: [string, Cores][] = BASES.flatMap(([nome, base, escuro]) => [false, true].flatMap((alto) => [false, true].map((reforcadas): [string, Cores] => [
  `${nome}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
  coresComBordasReforcadas(coresComContraste(base, alto ? 'ALTO' : 'PADRAO', escuro), reforcadas),
])));

describe.each(VARIANTES)('peças comuns no tema %s', (_nome, cores) => {
  const superficies = [cores.fundo, cores.superficie, cores.superficie2, cores.superficie3];

  it('Campo: rótulo em `texto` sobre qualquer superfície e borda `bordaCampo` sobre o fundo `campo` e sobre o cartão em volta', () => {
    for (const s of superficies) expect(contraste(cores.texto, s)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.bordaCampo, cores.campo)).toBeGreaterThanOrEqual(3);
    // O contorno separa o campo do cartão onde ele está (fundo da tela, cartão e bloco dentro do cartão), não só do miolo.
    for (const s of [cores.fundo, cores.superficie, cores.superficie2]) expect(contraste(cores.bordaCampo, s)).toBeGreaterThanOrEqual(3);
    expect(contraste(cores.textoSuave, cores.campo)).toBeGreaterThanOrEqual(4.5);
  });

  it('EscolhaEmFolha: o botão é um campo (fundo `campo`, borda `bordaCampo`, rótulo suave e valor em `texto`)', () => {
    expect(contraste(cores.bordaCampo, cores.campo)).toBeGreaterThanOrEqual(3);
    expect(contraste(cores.texto, cores.campo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.textoSuave, cores.campo)).toBeGreaterThanOrEqual(4.5);
    // Pressionado ou hover: `superficie3`.
    expect(contraste(cores.texto, cores.superficie3)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.textoSuave, cores.superficie3)).toBeGreaterThanOrEqual(4.5);
  });

  it('faixas (Tabela, Folha, PainelConfirmacao): título e cabeçalho de coluna sobre `superficie3`', () => {
    expect(contraste(cores.texto, cores.superficie3)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.textoSuave, cores.superficie3)).toBeGreaterThanOrEqual(4.5);
  });

  it('Abas: rótulo da aba inativa (`textoSuave`) sobre o fundo e sobre o cartão', () => {
    expect(contraste(cores.textoSuave, cores.fundo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.textoSuave, cores.superficie)).toBeGreaterThanOrEqual(4.5);
  });

  it('Alerta: texto na cor do tom sobre o fundo opaco `tingido` (não depende de onde a caixa está)', () => {
    for (const tom of [cores.perigo, cores.atencao, cores.sucesso]) {
      expect(contraste(tom, tingido(tom, cores.superficie))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('Cabecalho: selo "Sem conexão" com ícone (neutro sobre `tingido`)', () => {
    expect(contraste(cores.neutro, tingido(cores.neutro, cores.superficie))).toBeGreaterThanOrEqual(4.5);
  });
});
