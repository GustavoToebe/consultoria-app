/* eslint-disable @typescript-eslint/no-require-imports */
import type { UnidadeDeCarga } from '../../dominio/unidadeDeCarga';
import { mensagemDaCargaFixa } from '../../dominio/validacaoDeSerie';
import { ContextoDaUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { CampoDaCargaFixa } from './CamposDaPrescricao';

/** Carga fixa no editor, na unidade do treinador: o campo fala libra, o plano (valor e aoMudar) fala kg. */
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Escolha', () => ({ Escolha: () => null }));
jest.mock('../../ui/EscolhaSuspensa', () => ({ EscolhaSuspensa: () => null }));
jest.mock('../../ui/Botao', () => ({ Botao: () => null }));
jest.mock('../../ui/IconeBotao', () => ({ IconeBotao: () => null }));
jest.mock('./BotaoDeAbrir', () => ({ BotaoDeAbrir: () => null, BotaoDeTexto: () => null }));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');

function montar(unidade: UnidadeDeCarga, valorKg: number | null, aoMudar: (kg: number | null) => void, erro?: string) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(
      <ContextoDaUnidadeDeCarga.Provider value={unidade}>
        <CampoDaCargaFixa valor={valorKg} aoMudar={aoMudar} erro={erro} />
      </ContextoDaUnidadeDeCarga.Provider>,
    );
  });
  const campo = () => raiz.root.find((x) => typeof x.props.onChangeText === 'function');
  const textos = () => raiz.root.findAll((x) => typeof x.props.children === 'string').map((x) => x.props.children as string);
  return { texto: () => campo().props.value as string, digitar: (t: string) => Renderer.act(() => campo().props.onChangeText(t)), textos };
}

describe('CampoDaCargaFixa', () => {
  it('em libra mostra o kg do plano em lb, com a unidade, e digitar grava kg (100 lb = 45,35; 132,3 lb = 60)', () => {
    const aoMudar = jest.fn();
    const c = montar('lb', 60, aoMudar);
    expect(c.texto()).toBe('132,3');
    expect(c.textos()).toContain('Peso da carga fixa (lb)');
    c.digitar('100');
    expect(aoMudar).toHaveBeenLastCalledWith(45.35);
    c.digitar('132,3');
    expect(aoMudar).toHaveBeenLastCalledWith(60);
    c.digitar('');
    expect(aoMudar).toHaveBeenLastCalledWith(null);
  });

  it('em libra a máscara corta na primeira casa; em kg continuam duas e o valor é o mesmo', () => {
    const emLibra = jest.fn();
    montar('lb', null, emLibra).digitar('100,57');
    // 100,5 lb = 45,586 kg, que a grade de 0,05 kg leva a 45,6 (e 45,6 kg volta a 100,5 lb).
    expect(emLibra).toHaveBeenLastCalledWith(45.6);
    const emKg = jest.fn();
    const c = montar('kg', 62.5, emKg);
    expect(c.texto()).toBe('62,5');
    expect(c.textos()).toContain('Peso da carga fixa (kg)');
    c.digitar('62,25');
    expect(emKg).toHaveBeenLastCalledWith(62.25);
  });

  it('a mensagem de limite sai no número da unidade; outra mensagem fica como veio', () => {
    expect(montar('lb', 1001, jest.fn(), mensagemDaCargaFixa()).textos()).toContain(mensagemDaCargaFixa('lb'));
    expect(montar('kg', 1001, jest.fn(), mensagemDaCargaFixa()).textos()).toContain(mensagemDaCargaFixa('kg'));
    expect(montar('lb', 1, jest.fn(), 'Outro erro.').textos()).toContain('Outro erro.');
  });
});

