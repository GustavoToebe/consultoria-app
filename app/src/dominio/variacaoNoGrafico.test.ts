import type { MetaDoPeso, RegistroPeso } from '../api/tipos';
import { contraste, PALETAS } from '../tema/tokens';
import { corDoTom } from './corDaVariacaoDoPeso';
import { coresComBordasReforcadas, coresComContraste } from './preferencias';
import { linhaDoHistorico, variacaoFalada } from './resumoDoPeso';

/** Variação do peso no balão do gráfico: a mesma regra (e a mesma cor) da coluna Variação da lista. */
const anterior: RegistroPeso = { id: 'p1', data: '2026-03-16', pesoKg: 80, variacao: null, observacao: null };
const linha = (variacao: number, meta?: MetaDoPeso) => {
  const r: RegistroPeso = { id: 'p2', data: '2026-03-23', pesoKg: 80 + variacao, variacao, observacao: null, metaDoPeso: meta };
  return linhaDoHistorico(r, [anterior, r]);
};

it('fala a direção, o "desde" e a meta só quando ela pintou a variação', () => {
  expect(variacaoFalada(linha(1.3, 'REDUZIR'))).toBe('Subiu 1,3 kg desde 16/03, contra a meta');
  expect(variacaoFalada(linha(-0.7, 'REDUZIR'))).toBe('Desceu 0,7 kg desde 16/03, a favor da meta');
  expect(variacaoFalada(linha(1.3, 'AUMENTAR'))).toBe('Subiu 1,3 kg desde 16/03, a favor da meta');
  expect(variacaoFalada(linha(-0.7, 'AUMENTAR'))).toBe('Desceu 0,7 kg desde 16/03, contra a meta');
  expect(variacaoFalada(linha(1.3, 'SEM_META'))).toBe('Subiu 1,3 kg desde 16/03');
  expect(variacaoFalada(linha(1.3))).toBe('Subiu 1,3 kg desde 16/03');
  expect(variacaoFalada(linha(0, 'REDUZIR'))).toBe('Sem alteração desde 16/03');
  expect(variacaoFalada(linhaDoHistorico(anterior, [anterior]))).toBe('Sem registro anterior');
});

it('cor do tom: verde a favor, vermelho contra e a cor do texto no neutro (zero e sem meta)', () => {
  const { cores } = PALETAS.ESCURO;
  expect(corDoTom(linha(-0.7, 'REDUZIR').tom, cores)).toBe(cores.sucesso);
  expect(corDoTom(linha(-0.7, 'AUMENTAR').tom, cores)).toBe(cores.perigo);
  expect(corDoTom(linha(0, 'REDUZIR').tom, cores)).toBe(cores.texto);
  expect(corDoTom(linha(-0.7, 'SEM_META').tom, cores)).toBe(cores.texto);
});

// O balão é `superficie` (painel flutuante): o texto pintado precisa de 4,5:1 nela em toda paleta, também no contraste
// alto e nas bordas reforçadas (o `tokens.test.ts` cobre só as paletas base).
const VARIANTES = Object.entries(PALETAS).flatMap(([nome, p]) => [false, true].flatMap((alto) => [false, true].map((reforcadas) =>
  [`${nome}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
    coresComBordasReforcadas(coresComContraste(p.cores, alto ? 'ALTO' : 'PADRAO', p.modo === 'ESCURO'), reforcadas)] as const)));

it.each(VARIANTES)('%s: verde, vermelho e neutro passam 4,5:1 sobre o balão', (_nome, cores) => {
  for (const cor of [cores.sucesso, cores.perigo, cores.texto]) expect(contraste(cor, cores.superficie)).toBeGreaterThanOrEqual(4.5);
});
