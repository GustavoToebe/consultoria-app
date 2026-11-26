/* eslint-disable @typescript-eslint/no-require-imports */
import { Fragment } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { LinhaDeDado, ListaDeDados } from './ListaDeDados';

const mockBotoes: Record<string, unknown>[] = [];
jest.mock('./Botao', () => {
  const { Pressable: P } = require('react-native') as typeof import('react-native');
  return {
    Botao: (props: Record<string, unknown>) => {
      mockBotoes.push(props);
      return <P testID={`botao-${String(props.rotulo)}`} accessibilityRole="button" accessibilityLabel={String(props.rotuloAcessivel ?? props.rotulo)} />;
    },
  };
});
jest.mock('./Texto', () => {
  const { Text: T } = require('react-native') as typeof import('react-native');
  return { Texto: ({ variante: _v, numerico: _n, ...resto }: Record<string, unknown>) => <T {...resto} /> };
});
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO, fatorTexto: 1 }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { Botao } = require('./Botao') as typeof import('./Botao');
const MOTIVO = 'Só entra num grupo quem já tem acesso ao app.';

function montar(linha: React.ReactElement) {
  let r!: ReactTestRenderer;
  mockBotoes.length = 0;
  act(() => { r = create(<ListaDeDados>{linha}</ListaDeDados>); });
  return r;
}
const ajuda = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.testID === 'ajuda-da-linha' && typeof n.type === 'string');
const ancestrais = (n: ReactTestInstance) => { const lista: ReactTestInstance[] = []; for (let p = n.parent; p; p = p.parent) lista.push(p); return lista; };

describe('LinhaDeDado: motivo da ação desabilitada', () => {
  it('sobe para a linha de ajuda abaixo da linha, fora da coluna da ação, e sai do botão', () => {
    const r = montar(
      <LinhaDeDado rotulo="Grupo da comunidade" valor="Sem grupo"
        acoes={<Botao rotulo="Mudar grupo" tamanho="pequeno" desabilitado motivo={MOTIVO} aoTocar={() => undefined} />} />,
    );
    const [texto] = ajuda(r);
    expect(texto.props.children).toBe(MOTIVO);
    expect(mockBotoes.every((b) => b.motivo === undefined)).toBe(true);
    // Não é descendente da coluna que guarda o botão: a ajuda é irmã da linha, na largura toda do item.
    const botao = r.root.findByProps({ testID: 'botao-Mudar grupo' });
    const colunaDaAcao = ancestrais(botao).find((a) => String(a.type) === 'View')!;
    expect(ancestrais(texto)).not.toContain(colunaDaAcao);
    // Nome acessível do botão leva o motivo (no celular não há `aria-describedby`; o Botao já não escreve o texto).
    expect(botao.props.accessibilityLabel).toBe(`Mudar grupo. ${MOTIVO}`);
  });

  it('acha o botão dentro de um fragmento e junta os motivos de mais de um', () => {
    const r = montar(
      <LinhaDeDado rotulo="Linha" valor="x"
        acoes={<Fragment><Botao rotulo="A" desabilitado motivo="Por causa A." aoTocar={() => undefined} /><Botao rotulo="B" desabilitado motivo="Por causa B." aoTocar={() => undefined} /></Fragment>} />,
    );
    const texto = ajuda(r)[0];
    expect(JSON.stringify(texto.props.children)).toContain('Por causa A.');
    expect(JSON.stringify(texto.props.children)).toContain('Por causa B.');
  });

  it('botão habilitado, carregando ou sem motivo não gera ajuda e segue como veio', () => {
    const r = montar(
      <LinhaDeDado rotulo="Linha" valor="x"
        acoes={<Fragment><Botao rotulo="A" motivo="Não vale." aoTocar={() => undefined} /><Botao rotulo="B" desabilitado aoTocar={() => undefined} /><Botao rotulo="C" desabilitado carregando motivo="Não vale." aoTocar={() => undefined} /></Fragment>} />,
    );
    expect(ajuda(r)).toHaveLength(0);
    expect(mockBotoes.find((b) => b.rotulo === 'A')?.motivo).toBe('Não vale.');
  });

  it('sem ações, nada de ajuda', () => {
    expect(ajuda(montar(<LinhaDeDado rotulo="Nome" valor="Ana" />))).toHaveLength(0);
  });
});

describe('ListaDeDados: arranjo opcional (leitura das respostas)', () => {
  const medir = (r: ReactTestRenderer, width: number) => {
    const raiz = r.root.find((n) => typeof n.props.onLayout === 'function');
    act(() => { raiz.props.onLayout({ nativeEvent: { layout: { width, height: 100, x: 0, y: 0 } } }); });
  };
  const estiloPlano = (n: ReactTestInstance) => Object.assign({}, ...[n.props.style].flat(3).filter(Boolean));
  const item = (r: ReactTestRenderer) => r.root.find((n) => n.props.role === 'listitem' && typeof n.type !== 'string');
  const termo = (r: ReactTestRenderer) => r.root.find((n) => n.props.role === 'term');

  it('sem arranjo: respiro e coluna do rótulo de sempre (200 px ao lado, a partir de 416)', () => {
    let r!: ReactTestRenderer;
    act(() => { r = create(<ListaDeDados><LinhaDeDado rotulo="Nome" valor="Ana" /></ListaDeDados>); });
    medir(r, 1000);
    expect(estiloPlano(item(r)).paddingVertical).toBe(8);
    expect(estiloPlano(termo(r)).width).toBe(200);
  });

  it('com arranjo: empilha abaixo do limite; acima, rótulo em fração da largura até o teto e respiro próprio', () => {
    let r!: ReactTestRenderer;
    const arranjo = { empilharAbaixoDe: 720, rotulo: { fracao: 0.4, maximo: 320 }, respiro: 12 };
    act(() => { r = create(<ListaDeDados arranjo={arranjo}><LinhaDeDado rotulo="Pergunta" valor="Resposta" /></ListaDeDados>); });
    medir(r, 600);
    expect(estiloPlano(item(r)).paddingVertical).toBe(12);
    expect(estiloPlano(termo(r)).width).toBeUndefined();
    medir(r, 1000);
    expect(estiloPlano(termo(r)).width).toBe(320);
  });
});
