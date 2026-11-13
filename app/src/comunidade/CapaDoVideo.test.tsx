/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CapaDoVideo } from './CapaDoVideo';

/** A capa com o dado de verdade e as peças de UI trocadas por nós simples (só o que o contrato do vídeo precisa). */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-image', () => ({ Image: (props: { source: { uri: string } }) => require('react').createElement('Imagem', { uri: props.source.uri }) }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO }) }));
jest.mock('../ui/Texto', () => ({ Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('../ui/ImagemProtegida', () => ({ enderecoDaImagem: async () => 'blob:capa' }));
jest.mock('../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotuloAcessivel, aoTocar }: { rotuloAcessivel?: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel, onPress: aoTocar }),
}));
jest.mock('./PlayerDeVideo', () => ({ PlayerDeVideo: ({ id }: { id: string }) => require('react').createElement('Player', { id }) }));

const YOUTUBE = 'https://youtu.be/abcDEF12345';
const OUTRO_SITE = 'https://video.exemplo.invalid/aula';

const botao = (r: ReactTestRenderer, rotulo: string) =>
  r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];
const tem = (r: ReactTestRenderer, tipo: string) => r.root.findAll((n) => String(n.type) === tipo).length > 0;

async function montar(videoUrl: string | null, capaId: string | null, aoAbrirFora = jest.fn()) {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<CapaDoVideo videoUrl={videoUrl} titulo="Técnica" capaId={capaId} baixarCapa={jest.fn().mockResolvedValue({})} aoAbrirFora={aoAbrirFora} />);
  });
  return { r, aoAbrirFora };
}

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

it('link que não é do YouTube: mostra a nossa capa e "Abrir vídeo" abre fora do app, sem player', async () => {
  const { r, aoAbrirFora } = await montar(OUTRO_SITE, 'capa-1');
  expect(tem(r, 'Imagem')).toBe(true);
  expect(tem(r, 'Player')).toBe(false);
  expect(botao(r, 'Assistir aqui: Técnica')).toBeUndefined();
  expect(botao(r, 'Abrir no YouTube: Técnica')).toBeUndefined();
  await act(async () => { botao(r, 'Abrir vídeo: Técnica').props.onPress(); });
  expect(aoAbrirFora).toHaveBeenCalledWith(OUTRO_SITE);
  expect(tem(r, 'Player')).toBe(false);
});

it('link que não é do YouTube e sem capa: o quadro neutro continua com "Abrir vídeo" (um só botão com esse nome)', async () => {
  const { r } = await montar(OUTRO_SITE, null);
  expect(tem(r, 'Imagem')).toBe(false);
  expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Abrir vídeo: Técnica' && typeof n.props.onPress === 'function')).toHaveLength(1);
});

it('YouTube: capa e "Assistir aqui"; o player só monta depois do toque e "Abrir no YouTube" vai pelo id', async () => {
  const { r, aoAbrirFora } = await montar(YOUTUBE, 'capa-1');
  expect(tem(r, 'Imagem')).toBe(true);
  expect(tem(r, 'Player')).toBe(false);
  await act(async () => { botao(r, 'Assistir aqui: Técnica').props.onPress(); });
  expect(tem(r, 'Player')).toBe(true);
  expect(r.root.findAll((n) => String(n.type) === 'Player')[0].props.id).toBe('abcDEF12345');
  await act(async () => { botao(r, 'Abrir no YouTube: Técnica').props.onPress(); });
  expect(aoAbrirFora).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abcDEF12345');
});

it('outro link do YouTube no mesmo componente volta à capa: o player não monta sem um novo toque', async () => {
  const { r } = await montar(YOUTUBE, 'capa-1');
  await act(async () => { botao(r, 'Assistir aqui: Técnica').props.onPress(); });
  expect(tem(r, 'Player')).toBe(true);
  await act(async () => {
    r.update(<CapaDoVideo videoUrl="https://youtu.be/zzzZZZ99999" titulo="Técnica" capaId="capa-1" baixarCapa={jest.fn().mockResolvedValue({})} aoAbrirFora={jest.fn()} />);
  });
  expect(tem(r, 'Player')).toBe(false);
});

it('capa que chega depois de a tela sair: o blob é revogado', async () => {
  const revogar = jest.fn();
  URL.revokeObjectURL = revogar;
  let liberar!: (b: Blob) => void;
  const baixar = jest.fn(() => new Promise<Blob>((resolve) => { liberar = resolve; }));
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<CapaDoVideo videoUrl={YOUTUBE} titulo="Técnica" capaId="capa-1" baixarCapa={baixar} aoAbrirFora={jest.fn()} />);
  });
  act(() => r.unmount());
  await act(async () => { liberar({} as Blob); });
  expect(revogar).toHaveBeenCalledWith('blob:capa');
});

it('sem link ou com link inseguro: não desenha nada', async () => {
  expect((await montar(null, 'capa-1')).r.toJSON()).toBeNull();
  expect((await montar('http://inseguro.exemplo.invalid/v', 'capa-1')).r.toJSON()).toBeNull();
});
