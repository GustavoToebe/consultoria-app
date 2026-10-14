import { criarGuarda, SEM_GUARDA } from './guarda';

describe('guarda de saída', () => {
  it('sem alteração pendente roda a ação na hora', () => {
    const pedir = jest.fn();
    const acao = jest.fn();
    criarGuarda(pedir).confirmar(acao);
    expect(acao).toHaveBeenCalledTimes(1);
    expect(pedir).not.toHaveBeenCalled();
  });

  it('com alteração pendente pergunta e não roda a ação', () => {
    const pedir = jest.fn();
    const acao = jest.fn();
    const guarda = criarGuarda(pedir);
    guarda.registrar('editor');
    guarda.confirmar(acao);
    expect(pedir).toHaveBeenCalledWith(acao);
    expect(acao).not.toHaveBeenCalled();
  });

  it('desmarcar a tela volta a deixar sair sem perguntar', () => {
    const pedir = jest.fn();
    const guarda = criarGuarda(pedir);
    const desmarcar = guarda.registrar('editor');
    desmarcar();
    guarda.confirmar(jest.fn());
    expect(pedir).not.toHaveBeenCalled();
    expect(guarda.pendente()).toBe(false);
  });

  it('liberada, a saída passa sem perguntar até soltar (o Sair da conta não pergunta duas vezes)', () => {
    const pedir = jest.fn();
    const guarda = criarGuarda(pedir);
    guarda.registrar('editor');
    const soltar = guarda.liberar();
    expect(guarda.liberado()).toBe(true);
    const durante = jest.fn();
    guarda.confirmar(durante);
    expect(durante).toHaveBeenCalledTimes(1);
    expect(pedir).not.toHaveBeenCalled();
    soltar();
    expect(guarda.liberado()).toBe(false);
    guarda.confirmar(jest.fn());
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('liberações sobrepostas só soltam quando todas soltam; soltar duas vezes não desconta duas', () => {
    const guarda = criarGuarda(jest.fn());
    const a = guarda.liberar();
    const b = guarda.liberar();
    a();
    a();
    expect(guarda.liberado()).toBe(true);
    b();
    expect(guarda.liberado()).toBe(false);
  });

  it('fora do provider tudo passa e liberar não faz nada', () => {
    const acao = jest.fn();
    SEM_GUARDA.confirmar(acao);
    expect(acao).toHaveBeenCalledTimes(1);
    expect(SEM_GUARDA.pendente()).toBe(false);
    expect(() => SEM_GUARDA.liberar()()).not.toThrow();
  });
});
