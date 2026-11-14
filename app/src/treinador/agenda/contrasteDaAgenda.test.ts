import type { CorDaAgenda } from '../../api/agendaTipos';
import { CONTRASTE_DO_GRAFICO, CONTRASTE_DO_TEXTO } from '../../dominio/agendaLegivel';
import { coresComBordasReforcadas, coresComContraste } from '../../dominio/preferencias';
import { PALETAS as CORES_DA_MARCA } from '../../dominio/paletas';
import { CHAVES_DA_AGENDA, contraste, marcaParaTexto, PALETA_DA_AGENDA, PALETAS, type Cores, type VarianteDoTema } from '../../tema/tokens';

/**
 * Contraste dos itens da agenda (grade do PC, faixa de dia inteiro e lista do celular) sobre o fundo neutro, em todos os
 * temas (claro, claro areia, escuro), com e sem contraste alto e bordas reforçadas, em repouso (`superficie2`) e no hover ou
 * aberto (`superficie3`): título e horário (`texto`) ≥ 4,5:1, a faixa de 8 px e os ícones de status ≥ 3:1, e o contorno do
 * item aberto (`bordaCampo`) ≥ 3:1. A cor da agenda fica só na faixa (guia de 11/11): as telas usam `useCoresDoItem`.
 */
const BASES: [string, Cores, boolean, VarianteDoTema][] = Object.entries(PALETAS).map(([codigo, p]) => [codigo, p.cores, p.modo === 'ESCURO', p.variante]);
const VARIANTES: [string, Cores, VarianteDoTema][] = BASES.flatMap(([nome, base, escuro, variante]) => [false, true].flatMap((alto) => [false, true].map((reforcadas): [string, Cores, VarianteDoTema] => [
  `${nome}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
  coresComBordasReforcadas(coresComContraste(base, alto ? 'ALTO' : 'PADRAO', escuro), reforcadas),
  variante,
])));

describe.each(VARIANTES)('itens da agenda no tema %s', (_nome, cores, variante) => {
  const paleta = PALETA_DA_AGENDA[variante];
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

// O traço de hoje (`TracoDeHoje`) é um sinal de forma de 2 px: ≥ 3:1 sobre tudo em que o número do dia aparece (faixa da
// grade, célula do mês e do ano, mini calendário, painel do `ui/Calendario` em `superficie2` e o dia escolhido em
// `superficie3`), com as 12 cores da marca.
describe.each(VARIANTES)('traço de hoje no tema %s', (_nome, cores) => {
  it.each(CORES_DA_MARCA.map((p) => [p.nome, p.cor]))('%s: ≥ 3:1 sobre as superfícies do calendário', (_marca, marca) => {
    const traco = marcaParaTexto(marca, cores.superficie3);
    for (const base of [cores.fundo, cores.painel, cores.superficie, cores.superficie2, cores.superficie3]) {
      expect(contraste(traco, base)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
    }
  });
});
