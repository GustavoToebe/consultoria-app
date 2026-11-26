/* eslint-disable @typescript-eslint/no-require-imports */
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { BarraDaEdicao } from './BarraDaEdicao';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../../tema/tokens').CLARO, bordas: { bloco: 1, item: 1 }, fatorTexto: 1, preferencias: { larguraConteudo: 'AUTOMATICA' } }),
}));
jest.mock('../../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
}));
// O painel vira dois botões (confirmar e cancelar) com o título, só quando visível.
const painelFalso = ({ visivel, titulo, rotuloConfirmar, aoConfirmar, aoCancelar }: { visivel: boolean; titulo: string; rotuloConfirmar: string; aoConfirmar: () => void; aoCancelar: () => void }) => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return visivel ? React.createElement(View, { accessibilityLabel: titulo },
    React.createElement(Pressable, { accessibilityLabel: `confirmar ${rotuloConfirmar}`, onPress: aoConfirmar }),
    React.createElement(Pressable, { accessibilityLabel: 'voltar', onPress: aoCancelar })) : null;
};
jest.mock('../../../ui/PainelConfirmacao', () => ({ PainelConfirmacao: painelFalso }));
jest.mock('../../../ui/GuardaDeSaida', () => ({
  AvisoSairSemSalvar: ({ visivel, aoSair, aoContinuar }: { visivel: boolean; aoSair: () => void; aoContinuar: () => void }) =>
    painelFalso({ visivel, titulo: 'Sair sem salvar?', rotuloConfirmar: 'Sair sem salvar', aoConfirmar: aoSair, aoCancelar: aoContinuar }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function montar(alteracoes: number) {
  const f = { aoRestaurar: jest.fn(), aoCancelar: jest.fn(), aoSalvar: jest.fn() };
  let r!: ReactTestRenderer;
  act(() => { r = create(<BarraDaEdicao alteracoes={alteracoes} {...f} />); });
  return { r, f };
}
const botao = (r: ReactTestRenderer, rotulo: string) => r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];
const tocar = (n: ReactTestInstance | undefined) => { if (!n) throw new Error('não achei'); act(() => n.props.onPress()); };
const status = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.role === 'status')[0].findAllByType(Text).map((t) => t.props.children).join('');

describe('BarraDaEdicao', () => {
  it('o contador diz quantas alterações há, numa região viva', () => {
    expect(status(montar(0).r)).toBe('Nenhuma alteração ainda');
    expect(status(montar(1).r)).toBe('1 alteração');
    expect(status(montar(3).r)).toBe('3 alterações');
  });

  it('Restaurar padrão abre a confirmação e só restaura ao confirmar', () => {
    const { r, f } = montar(2);
    tocar(botao(r, 'Restaurar padrão'));
    expect(f.aoRestaurar).not.toHaveBeenCalled();
    tocar(botao(r, 'voltar'));
    expect(botao(r, 'confirmar Restaurar padrão')).toBeUndefined();
    expect(f.aoRestaurar).not.toHaveBeenCalled();
    tocar(botao(r, 'Restaurar padrão'));
    tocar(botao(r, 'confirmar Restaurar padrão'));
    expect(f.aoRestaurar).toHaveBeenCalledTimes(1);
  });

  it('Cancelar sem alteração sai na hora; com alteração pergunta "Sair sem salvar?"', () => {
    const limpo = montar(0);
    tocar(botao(limpo.r, 'Cancelar'));
    expect(limpo.f.aoCancelar).toHaveBeenCalledTimes(1);
    const sujo = montar(1);
    tocar(botao(sujo.r, 'Cancelar'));
    expect(sujo.f.aoCancelar).not.toHaveBeenCalled();
    tocar(botao(sujo.r, 'confirmar Sair sem salvar'));
    expect(sujo.f.aoCancelar).toHaveBeenCalledTimes(1);
  });

  it('Salvar chama aoSalvar', () => {
    const { r, f } = montar(1);
    tocar(botao(r, 'Salvar'));
    expect(f.aoSalvar).toHaveBeenCalledTimes(1);
  });
});
