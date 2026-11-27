/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { SecaoRecolhivel } from './SecaoRecolhivel';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO, fatorTexto: 1 }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const botoes = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
const titulo = (r: ReactTestRenderer) => botoes(r).find((b) => b.props.accessibilityLabel === 'Observação e modo de preparo')!;
const info = (r: ReactTestRenderer) => botoes(r).find((b) => b.props.accessibilityLabel === 'Sobre: Observação e modo de preparo');
const regiao = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.role === 'region' && typeof n.type === 'string');
const temTexto = (r: ReactTestRenderer, texto: string) => r.root.findAllByType(Text).some((t) => t.props.children === texto);
const tocar = (b: ReactTestInstance) => act(() => b.props.onPress());

function montar(props: Partial<Parameters<typeof SecaoRecolhivel>[0]> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<SecaoRecolhivel titulo="Observação e modo de preparo" resumo="Nenhuma" {...props}><Text>Conteúdo</Text></SecaoRecolhivel>);
  });
  return r;
}

describe('SecaoRecolhivel', () => {
  it('fechada por padrão: o resumo ao lado do título, sem o conteúdo, e o botão diz fechado', () => {
    const r = montar();
    expect(titulo(r).props['aria-expanded']).toBe(false);
    expect(titulo(r).props.accessibilityState).toEqual({ expanded: false });
    expect(temTexto(r, 'Nenhuma')).toBe(true);
    expect(temTexto(r, 'Conteúdo')).toBe(false);
    expect(regiao(r)).toHaveLength(0);
  });

  it('abre e fecha pelo título quantas vezes quiser; aberta, o conteúdo é uma região e o resumo sai', () => {
    const r = montar();
    tocar(titulo(r));
    expect(titulo(r).props['aria-expanded']).toBe(true);
    expect(temTexto(r, 'Conteúdo')).toBe(true);
    expect(temTexto(r, 'Nenhuma')).toBe(false);
    expect(regiao(r)).toHaveLength(1);
    tocar(titulo(r));
    expect(temTexto(r, 'Conteúdo')).toBe(false);
    tocar(titulo(r));
    expect(temTexto(r, 'Conteúdo')).toBe(true);
  });

  it('na web a região é nomeada pelo título e o botão aponta para ela (aria-controls só aberta)', () => {
    const antes = Platform.OS;
    Platform.OS = 'web';
    try {
      const r = montar({ abertaInicial: true });
      const [painel] = regiao(r);
      expect(painel.props['aria-labelledby']).toBe(titulo(r).props.nativeID);
      expect(titulo(r).props['aria-controls']).toBe(painel.props.nativeID);
      tocar(titulo(r));
      expect(titulo(r).props['aria-controls']).toBeUndefined();
    } finally {
      Platform.OS = antes;
    }
  });

  it('controlada: pede a mudança e segue o `aberta` de quem usa', () => {
    const aoMudar = jest.fn();
    const r = montar({ aberta: false, aoMudar });
    tocar(titulo(r));
    expect(aoMudar).toHaveBeenCalledWith(true);
    expect(temTexto(r, 'Conteúdo')).toBe(false);
    act(() => r.update(<SecaoRecolhivel titulo="Observação e modo de preparo" aberta aoMudar={aoMudar}><Text>Conteúdo</Text></SecaoRecolhivel>));
    expect(temTexto(r, 'Conteúdo')).toBe(true);
  });

  it('o ⓘ abre e fecha a explicação logo abaixo do título; sem `ajuda`, não há ⓘ', () => {
    expect(info(montar())).toBeUndefined();
    const r = montar({ ajuda: 'O aluno vê como você escrever.' });
    expect(info(r)!.props['aria-expanded']).toBe(false);
    expect(temTexto(r, 'O aluno vê como você escrever.')).toBe(false);
    tocar(info(r)!);
    expect(info(r)!.props['aria-expanded']).toBe(true);
    expect(temTexto(r, 'O aluno vê como você escrever.')).toBe(true);
    // O ⓘ não abre a seção.
    expect(temTexto(r, 'Conteúdo')).toBe(false);
  });

  it('o título é um cabeçalho do nível pedido (3 por padrão)', () => {
    const nivel = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.role === 'heading' && typeof n.type === 'string')[0].props['aria-level'];
    expect(nivel(montar())).toBe(3);
    expect(nivel(montar({ nivel: 4 }))).toBe(4);
  });
});
