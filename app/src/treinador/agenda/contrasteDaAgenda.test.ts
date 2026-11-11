import type { CorDaAgenda } from '../../api/agendaTipos';
import { CONTRASTE_DO_GRAFICO, CONTRASTE_DO_TEXTO } from '../../dominio/agendaLegivel';
import { coresComBordasReforcadas, coresComContraste } from '../../dominio/preferencias';
import { CHAVES_DA_AGENDA, contraste, PALETA_DA_AGENDA, PALETAS, type Cores } from '../../tema/tokens';

/**
 * Contraste dos itens da agenda (grade do PC, faixa de dia inteiro e lista do celular) sobre o fundo neutro, em todos os
 * temas (claro, claro areia, escuro), com e sem contraste alto e bordas reforçadas, em repouso (`superficie2`) e no hover ou
 * aberto (`superficie3`): título e horário (`texto`) ≥ 4,5:1, a faixa de 8 px e os ícones de status ≥ 3:1, e o contorno do
 * item aberto (`bordaCampo`) ≥ 3:1. A cor da agenda fica só na faixa (guia de 11/11): as telas usam `useCoresDoItem`.
 */
const BASES: [string, Cores, boolean][] = Object.entries(PALETAS).map(([codigo, p]) => [codigo, p.cores, p.modo === 'ESCURO']);
const VARIANTES: [string, Cores, boolean][] = BASES.flatMap(([nome, base, escuro]) => [false, true].flatMap((alto) => [false, true].map((reforcadas): [string, Cores, boolean] => [
  `${nome}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
  coresComBordasReforcadas(coresComContraste(base, alto ? 'ALTO' : 'PADRAO', escuro), reforcadas),
  escuro,
])));

describe.each(VARIANTES)('itens da agenda no tema %s', (_nome, cores, escuro) => {
  const paleta = PALETA_DA_AGENDA[escuro ? 'escuro' : 'claro'];
  const bases = [cores.superficie2, cores.superficie3];

  it.each(CHAVES_DA_AGENDA as CorDaAgenda[])('%s: a faixa ≥ 3:1 sobre o fundo neutro', (chave) => {
    for (const base of bases) expect(contraste(paleta[chave], base)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
  });

  it('texto ≥ 4,5:1, ícones de status ≥ 3:1 e o contorno do item aberto ≥ 3:1', () => {
    for (const base of bases) {
      expect(contraste(cores.texto, base)).toBeGreaterThanOrEqual(CONTRASTE_DO_TEXTO);
      for (const tom of [cores.sucesso, cores.atencao, cores.perigo, cores.neutro]) expect(contraste(tom, base)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
    }
    expect(contraste(cores.bordaCampo, cores.superficie3)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
  });
});
