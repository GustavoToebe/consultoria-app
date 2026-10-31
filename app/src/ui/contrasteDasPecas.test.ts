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

  it('IconeBotao moldura: borda `bordaCampo` ≥ 3:1 contra o cartão e contra a faixa onde fica (o ⋯ e o X da Folha)', () => {
    for (const s of [cores.fundo, cores.superficie, cores.superficie3]) expect(contraste(cores.bordaCampo, s)).toBeGreaterThanOrEqual(3);
  });

  it('Cabecalho: selo "Sem conexão" com ícone (neutro sobre `tingido`)', () => {
    expect(contraste(cores.neutro, tingido(cores.neutro, cores.superficie))).toBeGreaterThanOrEqual(4.5);
  });
});

/** Cor com alfa sobre um fundo opaco (o que o aparelho pinta), para conferir o contraste de um fundo translúcido. */
function sobreposta(cor: string, alfa: number, base: string): string {
  const a = parseInt(cor.slice(1), 16);
  const b = parseInt(base.slice(1), 16);
  const canal = (d: number) => Math.round(((b >> d) & 255) * (1 - alfa) + ((a >> d) & 255) * alfa);
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Telas do aluno revistas na reunião de 30/10 (A8 a A12): série do exercício, dieta, lista de compras e variação do peso.
 * Achado: a lista de compras esmaecia o item comprado (opacidade 0,6), o que deixava o texto a 2,8–4,2:1; agora o item
 * fica com a cor cheia e ganha o selo "Comprado". Os pares abaixo são os que essas telas usam.
 */
describe.each(VARIANTES)('telas do aluno (reunião de 30/10) no tema %s', (_nome, cores) => {
  /** Fundo da série feita: `${sucesso}29` (alfa 0x29) sobre `superficie2` (`CartaoSerie`). */
  const serieFeita = sobreposta(cores.sucesso, 0x29 / 255, cores.superficie2);

  it('série: texto, texto suave e selos sobre a série a fazer (`superficie2`) e sobre a feita (verde translúcido)', () => {
    for (const fundo of [cores.superficie2, serieFeita]) {
      expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
      // "Último registro", "Sugerido: … · origem", "Observação desta série", rótulos "Hoje".
      expect(contraste(cores.textoSuave, fundo)).toBeGreaterThanOrEqual(4.5);
    }
    // "Ainda não registrado" (neutro) só na série a fazer; "Recorde" (sucesso) nas duas.
    expect(contraste(cores.neutro, cores.superficie2)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.sucesso, cores.superficie2)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.sucesso, serieFeita)).toBeGreaterThanOrEqual(4.5);
  });

  it('caixa da Meta e caixa da escolha da dieta: `texto` e `textoSuave` sobre `superficie3`, filete `bordaCampo` ≥ 3:1', () => {
    expect(contraste(cores.texto, cores.superficie3)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.textoSuave, cores.superficie3)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.bordaCampo, cores.superficie3)).toBeGreaterThanOrEqual(3);
    expect(contraste(cores.bordaCampo, cores.superficie)).toBeGreaterThanOrEqual(3);
  });

  it('dieta: linhas rotuladas (Dose, Horário, Observação) e total da refeição sobre o cartão e o item', () => {
    for (const fundo of [cores.superficie, cores.superficie2]) {
      expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.textoSuave, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lista de compras: item comprado com a cor cheia e o selo "Comprado" (sucesso) e de origem (neutro) sobre o item', () => {
    for (const fundo of [cores.superficie2, cores.superficie3]) {
      expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.sucesso, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.neutro, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('variação do peso: seta e número em `texto`, "desde 12/10" e a legenda em `textoSuave`', () => {
    for (const fundo of [cores.superficie, cores.superficie2]) {
      expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.textoSuave, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
