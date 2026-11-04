import { createElement, type ReactNode } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ATRASO_DO_FOCO_MS, JANELA_DO_GATILHO_MS } from '../dominio/focoDaFolha';
import { lembrarGatilho, useDevolverFocoNoNativo } from './focoDaFolha';
import { useFolhaNoHistorico } from './historicoDasFolhas';

/** Painel de mentira: só o gancho, montado quando a Folha abre e desmontado quando fecha. */
function Painel({ filho }: { filho?: ReactNode }) {
  useDevolverFocoNoNativo();
  return filho ?? null;
}

/** Folha que abre (entra na lista das abertas do celular) e também devolve o foco ao sair. */
function FolhaDeVerdade() {
  useFolhaNoHistorico(() => undefined, { nome: 'p', elemento: null });
  useDevolverFocoNoNativo();
  return null;
}

const gatilho = (conectado = true) => ({ isConnected: conectado });
// O clique do leitor de tela não traz `pointerType`.
const clicar = (alvo: object | null) => lembrarGatilho({ target: alvo, nativeEvent: {} });
const passar = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

const inicio = Date.now();
let relogio = 0;
let leitor: jest.SpyInstance;
let enviar: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  // O gatilho guardado é estado do módulo: cada teste começa com o clique do teste anterior já velho.
  // (o relógio falso recomeça do relógio real a cada teste, por isso o avanço acumula).
  relogio += 10 * JANELA_DO_GATILHO_MS;
  jest.setSystemTime(inicio + relogio);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  leitor = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  enviar = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReset().mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function abrirEFechar(raiz: { current?: ReactTestRenderer }) {
  await act(async () => { raiz.current = create(createElement(Painel)); });
  await act(async () => { raiz.current?.unmount(); });
  await passar(ATRASO_DO_FOCO_MS);
}

describe.each(['ios', 'android'] as const)('foco da Folha no %s', (so) => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', so); });

  it('com leitor de tela devolve o foco ao controle que abriu, só depois do atraso', async () => {
    const botao = gatilho();
    clicar(botao);
    const raiz: { current?: ReactTestRenderer } = {};
    await act(async () => { raiz.current = create(createElement(Painel)); });
    await act(async () => { raiz.current?.unmount(); });
    await passar(ATRASO_DO_FOCO_MS - 1);
    expect(enviar).not.toHaveBeenCalled();
    await passar(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith(botao, 'focus');
  });

  it('sem leitor de tela não faz nada', async () => {
    leitor.mockResolvedValue(false);
    clicar(gatilho());
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
  });

  it('não quebra sem gatilho (Folha aberta sem clique, ou clique antigo)', async () => {
    clicar(null);
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
    const agora = Date.now();
    clicar(gatilho());
    jest.setSystemTime(agora + JANELA_DO_GATILHO_MS + 1);
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
  });

  it('não faz nada se o gatilho já saiu da tela, e engole falha do leitor ou do envio', async () => {
    clicar(gatilho(false));
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
    leitor.mockRejectedValue(new Error('sem módulo'));
    clicar(gatilho());
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
    leitor.mockResolvedValue(true);
    enviar.mockImplementation(() => { throw new Error('nó sumiu'); });
    clicar(gatilho());
    await abrirEFechar({});
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('ignora o toque comum (com pointerType): o alvo seria o filho mais fundo', async () => {
    lembrarGatilho({ target: gatilho(), nativeEvent: { pointerType: 'touch' } });
    clicar(null);
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
  });

  it('desiste se outra Folha abriu enquanto esperava (a guarda "Sair sem salvar?" na Folha de baixo)', async () => {
    clicar(gatilho());
    const raiz: { current?: ReactTestRenderer } = {};
    await act(async () => { raiz.current = create(createElement(FolhaDeVerdade)); });
    // Fecha e, no mesmo instante, abre outra.
    await act(async () => { raiz.current?.update(createElement(Painel, { filho: createElement(FolhaDeVerdade) })); });
    await passar(ATRASO_DO_FOCO_MS);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('a próxima Folha aberta sem clique não herda o gatilho da anterior', async () => {
    clicar(gatilho());
    await abrirEFechar({});
    enviar.mockClear();
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
  });

  it('Folha dentro de Folha: a de cima devolve ao botão dentro da de baixo, a de baixo ao da tela', async () => {
    const daTela = gatilho();
    const daFolhaMae = gatilho();
    clicar(daTela);
    const raiz: { current?: ReactTestRenderer } = {};
    await act(async () => { raiz.current = create(createElement(Painel)); });
    clicar(daFolhaMae);
    // A filha monta dentro da mãe; fechar só a filha (re-render sem o filho).
    await act(async () => { raiz.current?.update(createElement(Painel, { filho: createElement(Painel) })); });
    await act(async () => { raiz.current?.update(createElement(Painel)); });
    await passar(ATRASO_DO_FOCO_MS);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenLastCalledWith(daFolhaMae, 'focus');
    await act(async () => { raiz.current?.unmount(); });
    await passar(ATRASO_DO_FOCO_MS);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar).toHaveBeenLastCalledWith(daTela, 'focus');
  });
});

describe('web', () => {
  it('não faz nada (o retorno do foco da web é outro)', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    clicar(gatilho());
    await abrirEFechar({});
    expect(enviar).not.toHaveBeenCalled();
  });
});
