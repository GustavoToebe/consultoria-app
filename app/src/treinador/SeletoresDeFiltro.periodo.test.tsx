import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CamposDePeriodo } from './SeletoresDeFiltro';

/**
 * `CamposDePeriodo` dentro e fora do painel lateral (M1 de `docs/planos/filtros-laterais.md`): no painel cada problema do
 * período conta para segurar o "Aplicar filtros" e, depois dele, vai para o campo dele; fora, os avisos são os de antes.
 * O painel e o campo de data são trocados por dublês que guardam o que recebem.
 */
const painel = { noPainel: false, mostrar: false, quantos: 0 };
jest.mock('../ui/BarraDeFiltros', () => ({
  useProblemaNoPainel: (quantos: number) => { painel.quantos = quantos; return { noPainel: painel.noPainel, mostrar: painel.mostrar }; },
}));
const campos: Record<string, { erro?: string | null; aoMudar: (t: string) => void }> = {};
jest.mock('../ui/Campos', () => ({
  CampoData: (p: { rotulo: string; erro?: string | null; aoMudar: (t: string) => void }) => { campos[p.rotulo] = p; return null; },
}));
const frases: string[] = [];
jest.mock('../ui/Texto', () => ({ Texto: ({ children }: { children?: unknown }) => { frases.push(String(children)); return null; } }));
jest.mock('../ui/Escolha', () => ({ Escolha: () => null }));
jest.mock('../ui/EscolhaEmFolha', () => ({ EscolhaEmFolha: () => null, OPCOES_PARA_BUSCAR: 8 }));

const VAZIO = { de: null, ate: null };

function montar(props: Partial<Parameters<typeof CamposDePeriodo>[0]>) {
  let raiz!: ReactTestRenderer;
  act(() => { raiz = create(<CamposDePeriodo rotulo="Data" valor={VAZIO} aoMudar={() => undefined} {...props} />); });
  return raiz;
}
const digitar = (campo: 'De' | 'Até', texto: string) => act(() => { campos[campo].aoMudar(texto); });

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { Object.assign(painel, { noPainel: false, mostrar: false, quantos: 0 }); frases.length = 0; });

it('no painel, depois do Aplicar: só uma data onde a tela pede as duas marca o campo vazio e conta 1', () => {
  Object.assign(painel, { noPainel: true, mostrar: true });
  montar({ osDois: true, maximoDias: 366, regra: 'PLANEJAMENTO' });
  digitar('De', '01/10/2026');
  expect(painel.quantos).toBe(1);
  expect(campos['Até'].erro).toBe('Preencha a data final ou apague a inicial.');
  expect(campos.De.erro).toBeNull();
  // A frase solta não repete o erro do campo.
  expect(frases).not.toContain('Preencha as duas datas.');
});

it('no painel: data pela metade e fora da faixa contam um cada, no campo delas; período longo marca o Até', () => {
  Object.assign(painel, { noPainel: true, mostrar: true });
  montar({ osDois: true, maximoDias: 366, regra: 'PLANEJAMENTO' });
  digitar('De', '01/10/20');
  digitar('Até', '01/01/1990');
  expect(painel.quantos).toBe(2);
  expect(campos.De.erro).toBe('Complete a data (DD/MM/AAAA) ou apague.');
  expect(campos['Até'].erro).toMatch(/^Data, data final: use uma data entre 01\/01\/2000 e /);
  digitar('De', '01/01/2026');
  digitar('Até', '01/02/2027');
  expect(painel.quantos).toBe(1);
  expect(campos['Até'].erro).toBe('Escolha um período de até 366 dias.');
});

it('intervalo aberto onde a tela o aceita (sem `osDois`) não é problema', () => {
  Object.assign(painel, { noPainel: true, mostrar: true });
  const aoMudar = jest.fn();
  montar({ regra: 'PLANEJAMENTO', aoMudar });
  digitar('De', '01/10/2026');
  expect(painel.quantos).toBe(0);
  expect(campos['Até'].erro).toBeNull();
  expect(aoMudar).toHaveBeenLastCalledWith({ de: '2026-10-01', ate: null });
});

it('fora do painel (e no painel antes do Aplicar) os avisos são os de antes: frase do par, ordem no Até, nada no De', () => {
  const aoMudar = jest.fn();
  montar({ osDois: true, maximoDias: 366, regra: 'PLANEJAMENTO', aoMudar });
  digitar('De', '01/10/2026');
  expect(campos['Até'].erro).toBeNull();
  expect(frases).toContain('Preencha as duas datas.');
  // A data pela metade não apaga o filtro em vigor nem aparece como erro antes da hora.
  digitar('Até', '10/10/20');
  expect(campos['Até'].erro).toBeNull();
  expect(aoMudar).not.toHaveBeenCalled();
  digitar('Até', '01/09/2026');
  expect(campos['Até'].erro).toBe('Fim antes do início.');
  expect(campos.De.erro).toBeNull();
});
