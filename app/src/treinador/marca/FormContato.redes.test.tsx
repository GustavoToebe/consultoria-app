/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { ConsultoriaResponse } from '../../api/tipos';
import { alterarMarca } from '../../api/rotas';
import { FormContato } from './FormContato';

/**
 * Redes sociais do Contato (26/11; desde 27/11 em `FormContato`, fora da Marca): a peça no modo edição com só as redes salvas,
 * o erro 422 na rede certa, remover uma rede salva conta como alteração (aparece o "Salvar contato") e o PUT leva as oito
 * chaves, com a removida em branco, e o resto da consultoria como está gravado. A peça (`ui/RedesSociais`, testada à parte)
 * e o resto da tela viram nós mínimos; só dados fictícios.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../api/cliente', () => ({ ErroApi: require('@plataforma/web').ErroApi }));
jest.mock('../../api/rotas', () => ({ alterarMarca: jest.fn() }));
jest.mock('../../ui/GuardaDeSaida', () => ({ useGuardaDeSaida: () => undefined }));
jest.mock('../../sessao/SessaoProvider', () => ({ useSessao: () => ({ atualizarMarca: jest.fn(), cicloHabilitado: false }) }));
jest.mock('../../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../../tema/tokens').ESCURO, variante: 'escuro' }) }));
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: jest.fn() }) }));
const h = (...a: unknown[]) => (require('react').createElement as (...x: unknown[]) => unknown)(...a);
jest.mock('../../ui/Cartao', () => ({ Cartao: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../../ui/Texto', () => ({ Texto: ({ children }: { children?: ReactNode }) => h(require('react-native').Text, null, children) }));
jest.mock('../../ui/Estados', () => ({ MensagemErro: () => null }));
// A prévia só aparece depois de medir a largura (nunca neste teste) e o ⓘ do WhatsApp é peça à parte.
jest.mock('./PreviaDoContato', () => ({ PreviaDoContato: () => null }));
jest.mock('../../ui/DicaDeTexto', () => ({ DicaDeTexto: () => null }));
jest.mock('../../ui/Campo', () => ({
  MensagemDeErro: () => null,
  Campo: ({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (t: string) => void }) =>
    h(require('react-native').TextInput, { accessibilityLabel: rotulo, value: valor, onChangeText: aoMudar }),
}));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) => h(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
}));
// A peça vira: um botão "Remover <rede>" por rede adicionada (tira a chave, como a peça) e o erro de cada rede como texto.
jest.mock('../../ui/RedesSociais', () => ({
  RedesSociais: ({ modo, redesPermitidas, valores, aoMudar, erros }: {
    modo: string; redesPermitidas: string[]; valores: Record<string, string>; aoMudar: (v: Record<string, string>) => void; erros?: Record<string, string>;
  }) => h(require('react-native').View, { testID: 'redes', accessibilityHint: `${modo}|${redesPermitidas.join(',')}` },
    redesPermitidas.filter((r) => valores[r] !== undefined).map((r) => h(require('react-native').View, { key: r },
      h(require('react-native').Pressable, { accessibilityLabel: `Remover ${r}`, onPress: () => { const { [r]: _tirada, ...resto } = valores; aoMudar(resto); } }),
      h(require('react-native').TextInput, { accessibilityLabel: `Campo ${r}`, value: valores[r], onChangeText: (t: string) => aoMudar({ ...valores, [r]: t }) }),
      erros?.[r] ? h(require('react-native').Text, null, `erro ${r}: ${erros[r]}`) : null))),
}));

const { ErroApi } = require('@plataforma/web') as typeof import('@plataforma/web');
const salvarApi = alterarMarca as jest.Mock;

const CONSULTORIA = {
  marca: { id: 'c1', nome: 'Consultoria Fictícia', corPrimaria: '#1F6FEB', fonteTitulo: 'PADRAO', temaPadrao: 'ESCURO', logoUrl: null },
  versao: 3,
  metaDoPeso: 'REDUZIR',
  redesSociais: { instagram: 'https://www.instagram.com/ficticia', tiktok: null, youtube: null, x: null, site: 'https://ficticia.test' },
} as unknown as ConsultoriaResponse;

const elemento = (c: ConsultoriaResponse, aoSalvar = jest.fn()) => <FormContato consultoria={c} aoSalvar={aoSalvar} aoConflito={jest.fn()} />;
function montar(aoSalvar?: jest.Mock): ReactTestRenderer {
  let raiz!: ReactTestRenderer;
  act(() => { raiz = create(elemento(CONSULTORIA, aoSalvar)); });
  return raiz;
}
const toque = (raiz: ReactTestRenderer, nome: string) => raiz.root.findAll((n) => n.props.accessibilityLabel === nome && typeof n.props.onPress === 'function');
const textos = (raiz: ReactTestRenderer) => raiz.root.findAllByType(require('react-native').Text).map((t) => String(t.props.children));

beforeEach(() => salvarApi.mockReset());

it('a peça abre em edição com as oito redes permitidas e só as salvas adicionadas; nada por salvar', () => {
  const raiz = montar();
  expect(raiz.root.findByProps({ testID: 'redes' }).props.accessibilityHint).toBe('edicao|instagram,tiktok,youtube,facebook,linkedin,telegram,x,site');
  expect(toque(raiz, 'Remover instagram')).toHaveLength(1);
  expect(toque(raiz, 'Remover site')).toHaveLength(1);
  expect(toque(raiz, 'Remover tiktok')).toHaveLength(0);
  expect(toque(raiz, 'Salvar contato')).toHaveLength(0);
});

it('remover uma rede salva é alteração: aparece o Salvar e o PUT manda as oito chaves, a removida em branco', async () => {
  const devolvida = { ...CONSULTORIA, redesSociais: { instagram: 'https://www.instagram.com/ficticia', site: null } } as unknown as ConsultoriaResponse;
  salvarApi.mockResolvedValueOnce(devolvida);
  const aoSalvar = jest.fn();
  const raiz = montar(aoSalvar);
  act(() => { (toque(raiz, 'Remover site')[0]!.props.onPress as () => void)(); });
  expect(toque(raiz, 'Salvar contato')).toHaveLength(1);
  await act(async () => { (toque(raiz, 'Salvar contato')[0]!.props.onPress as () => void)(); });
  expect(salvarApi.mock.calls[0]![0].redesSociais).toEqual({
    instagram: 'https://www.instagram.com/ficticia', tiktok: '', youtube: '', facebook: '', linkedin: '', telegram: '', x: '', site: '',
  });
  // O resto do PUT vai como está gravado: salvar o contato não mexe na marca nem no acompanhamento.
  expect(salvarApi.mock.calls[0]![0]).toMatchObject({ nome: 'Consultoria Fictícia', corPrimaria: '#1F6FEB', fonteTitulo: 'PADRAO', temaPadrao: 'ESCURO', versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' });
  // Salvo: a tela pai recebe a consultoria nova; com ela, a peça mostra o que a API devolveu e o botão some.
  expect(aoSalvar).toHaveBeenCalledWith(devolvida);
  act(() => { raiz.update(elemento(devolvida, aoSalvar)); });
  expect(toque(raiz, 'Remover site')).toHaveLength(0);
  expect(toque(raiz, 'Salvar contato')).toHaveLength(0);
});

it('editar para o mesmo valor (só espaços sobrando) não é alteração; mudar ou esvaziar, é', () => {
  const raiz = montar();
  const digitar = (t: string) => act(() => { (raiz.root.findByProps({ accessibilityLabel: 'Campo site' }).props.onChangeText as (t: string) => void)(t); });
  digitar('https://ficticia.test  ');
  expect(toque(raiz, 'Salvar contato')).toHaveLength(0);
  digitar('');
  expect(toque(raiz, 'Salvar contato')).toHaveLength(1);
  digitar('https://ficticia.test');
  expect(toque(raiz, 'Salvar contato')).toHaveLength(0);
});

it('o 422 de uma rede (redesSociais.<rede>) cai na linha dela e nas outras não', async () => {
  salvarApi.mockRejectedValueOnce(new ErroApi(422, 'MARCA_INVALIDA', 'Marca inválida.', [{ field: 'redesSociais.site', message: 'Use o link do site.' }]));
  const raiz = montar();
  act(() => { (raiz.root.findByProps({ accessibilityLabel: 'Campo site' }).props.onChangeText as (t: string) => void)('x y'); });
  await act(async () => { (toque(raiz, 'Salvar contato')[0]!.props.onPress as () => void)(); });
  expect(textos(raiz)).toContain('erro site: Use o link do site.');
  expect(textos(raiz).filter((t) => t.startsWith('erro instagram'))).toHaveLength(0);
});

it('Cancelar volta ao que está salvo: o contato e as redes, e o rodapé some', () => {
  const raiz = montar();
  act(() => { (raiz.root.findByProps({ accessibilityLabel: 'Nome que aparece nos e-mails' }).props.onChangeText as (t: string) => void)('Equipe Nova'); });
  act(() => { (toque(raiz, 'Remover site')[0]!.props.onPress as () => void)(); });
  expect(toque(raiz, 'Cancelar')).toHaveLength(1);
  act(() => { (toque(raiz, 'Cancelar')[0]!.props.onPress as () => void)(); });
  expect(raiz.root.findByProps({ accessibilityLabel: 'Nome que aparece nos e-mails' }).props.value).toBe('');
  expect(toque(raiz, 'Remover site')).toHaveLength(1);
  expect(toque(raiz, 'Salvar contato')).toHaveLength(0);
  expect(salvarApi).not.toHaveBeenCalled();
});
