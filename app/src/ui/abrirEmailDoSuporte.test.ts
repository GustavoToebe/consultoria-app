import { Linking, Platform } from 'react-native';

import { mailtoDoSuporte } from '../dominio/emailDeEntrada';
import { CONTATO_DO_SUPORTE } from '../dominio/produto';
import { abrirEmailDoSuporte } from './abrirEmailDoSuporte';

// Lido da constante: o recuo de 30/11 (`CONTATO_DO_SUPORTE = null`) não quebra o teste, só muda o caminho.
const MAILTO = mailtoDoSuporte(CONTATO_DO_SUPORTE);

describe('abrirEmailDoSuporte (nativo)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('abre só o mailto fixo do suporte (sem contato, não abre nada)', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    abrir.mockClear();
    await expect(abrirEmailDoSuporte()).resolves.toBe(MAILTO !== null);
    if (MAILTO) expect(abrir).toHaveBeenCalledWith(MAILTO);
    else expect(abrir).not.toHaveBeenCalled();
  });

  it('sem app de e-mail no aparelho devolve false (a tela mostra o aviso com o endereço)', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sem app'));
    await expect(abrirEmailDoSuporte()).resolves.toBe(false);
  });
});

describe('abrirEmailDoSuporte (web)', () => {
  const original = Platform.OS;
  beforeAll(() => { Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true }); });
  afterAll(() => { Object.defineProperty(Platform, 'OS', { value: original, configurable: true }); });

  it('clica num link mailto em vez de abrir aba', async () => {
    const clique = jest.fn();
    const link = { href: '', rel: '', click: clique };
    const criar = jest.fn(() => link);
    (globalThis as { document?: unknown }).document = { createElement: criar };
    const abrir = jest.spyOn(Linking, 'openURL');
    abrir.mockClear();
    await expect(abrirEmailDoSuporte()).resolves.toBe(MAILTO !== null);
    expect(clique).toHaveBeenCalledTimes(MAILTO ? 1 : 0);
    if (MAILTO) expect(link.href).toBe(MAILTO);
    expect(abrir).not.toHaveBeenCalled();
    delete (globalThis as { document?: unknown }).document;
  });
});
