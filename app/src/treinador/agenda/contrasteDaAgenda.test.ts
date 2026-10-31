import type { CorDaAgenda } from '../../api/agendaTipos';
import { CONTRASTE_DO_GRAFICO, CONTRASTE_DO_TEXTO, fundoDoItemDaAgenda, misturarCores } from '../../dominio/agendaLegivel';
import { coresComBordasReforcadas, coresComContraste } from '../../dominio/preferencias';
import { AREIA, CHAVES_DA_AGENDA, CLARO, contraste, ESCURO, PALETA_DA_AGENDA, type Cores } from '../../tema/tokens';

/**
 * Contraste dos itens da agenda (grade do PC, faixa de dia inteiro) com o fundo tingido pela cor da agenda, em todos os
 * temas (claro, claro areia, escuro), com e sem contraste alto e bordas reforçadas, em repouso (`superficie2`) e no hover
 * (`superficie3`): título e horário (`texto`) ≥ 4,5:1, a faixa de 8 px e os ícones de status ≥ 3:1. Vale para as 8 cores
 * da paleta das agendas e para cores extremas (se um dia a cor vier de fora da paleta, o texto continua legível). As
 * telas montam o fundo com os mesmos argumentos de `useFundoDoItem` (em `itemDaAgenda.tsx`): quem mudar lá, muda aqui.
 */
const BASES: [string, Cores, boolean][] = [['claro', CLARO, false], ['claro areia', AREIA, false], ['escuro', ESCURO, true]];
const VARIANTES: [string, Cores, boolean][] = BASES.flatMap(([nome, base, escuro]) => [false, true].flatMap((alto) => [false, true].map((reforcadas): [string, Cores, boolean] => [
  `${nome}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
  coresComBordasReforcadas(coresComContraste(base, alto ? 'ALTO' : 'PADRAO', escuro), reforcadas),
  escuro,
])));

/** Muito claro, muito escuro e saturados: fora da paleta, só para provar que o cálculo não presume a cor. */
const EXTREMAS = ['#FFFFFF', '#000000', '#FFFF00', '#FF0000', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#808080'];

/** Os mesmos argumentos da tela (`useFundoDoItem`): texto do tema e os quatro tons de status como gráficos. */
const fundo = (cor: string, base: string, cores: Cores) =>
  fundoDoItemDaAgenda({ cor, base, textos: [cores.texto], graficos: [cores.sucesso, cores.atencao, cores.perigo, cores.neutro] });

describe.each(VARIANTES)('itens da agenda no tema %s', (_nome, cores, escuro) => {
  const paleta = PALETA_DA_AGENDA[escuro ? 'escuro' : 'claro'];
  const bases = [cores.superficie2, cores.superficie3];

  it.each(CHAVES_DA_AGENDA as CorDaAgenda[])('%s: texto ≥ 4,5:1, faixa e status ≥ 3:1, e o fundo é de fato tingido', (chave) => {
    const cor = paleta[chave];
    for (const base of bases) {
      const f = fundo(cor, base, cores);
      expect(contraste(cores.texto, f)).toBeGreaterThanOrEqual(CONTRASTE_DO_TEXTO);
      expect(contraste(cor, f)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
      for (const tom of [cores.sucesso, cores.atencao, cores.perigo, cores.neutro]) expect(contraste(tom, f)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
      // A cor ocupa o item: pelo menos 6% da cor no fundo (a reunião de 30/10 pediu a cor mais presente).
      expect(f).not.toBe(base);
      const minimo = misturarCores(base, cor, 0.06);
      expect(Math.abs(contraste(base, f) - 1)).toBeGreaterThanOrEqual(Math.abs(contraste(base, minimo) - 1) - 0.001);
    }
  });

  it.each(EXTREMAS)('cor extrema %s: o texto continua ≥ 4,5:1 e a faixa não piora abaixo de 3:1 quando já passava', (cor) => {
    for (const base of bases) {
      const f = fundo(cor, base, cores);
      expect(contraste(cores.texto, f)).toBeGreaterThanOrEqual(CONTRASTE_DO_TEXTO);
      if (contraste(cor, base) >= CONTRASTE_DO_GRAFICO) expect(contraste(cor, f)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
    }
  });

  it('cancelado: sem tinta, a faixa continua ≥ 3:1 sobre o fundo do tema', () => {
    for (const chave of CHAVES_DA_AGENDA) for (const base of bases) expect(contraste(paleta[chave], base)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
  });
});
