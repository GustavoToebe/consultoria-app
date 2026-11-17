import { apagarIndicacao, CHAVE_DA_INDICACAO, guardarIndicacao, indicacaoGuardada, lerIndicacaoDoFragmento } from './indicacaoNoLink';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

function guardaFalsa(inicial: Record<string, string> = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k: string) => dados[k] ?? null,
    setItem: (k: string, v: string) => { dados[k] = v; },
    removeItem: (k: string) => { delete dados[k]; },
  };
}

describe('código de indicação no fragmento do link', () => {
  it('lê o UUID do #indicacao=', () => {
    expect(lerIndicacaoDoFragmento(`#indicacao=${UUID}`)).toBe(UUID);
    expect(lerIndicacaoDoFragmento(`indicacao=${UUID}`)).toBe(UUID);
  });

  it('com outros parâmetros no fragmento, acha o dele', () => {
    expect(lerIndicacaoDoFragmento(`#x=1&indicacao=${UUID}&y=2`)).toBe(UUID);
  });

  it('UUID maiúsculo é aceito e normalizado em minúsculas', () => {
    expect(lerIndicacaoDoFragmento(`#indicacao=${UUID.toUpperCase()}`)).toBe(UUID);
  });

  it('fragmento inválido, vazio ou ausente devolve nulo, sem lançar', () => {
    for (const hash of ['', '#', '#indicacao=', '#indicacao=abc', `#indicacao=${UUID}x`, `#outro=${UUID}`, '#%E0%A4%A', null, undefined]) {
      expect(lerIndicacaoDoFragmento(hash)).toBeNull();
    }
  });
});

describe('guarda da indicação na guia', () => {
  it('guarda, lê e apaga', () => {
    const guarda = guardaFalsa();
    guardarIndicacao(guarda, UUID);
    expect(guarda.dados[CHAVE_DA_INDICACAO]).toBe(UUID);
    expect(indicacaoGuardada(guarda)).toBe(UUID);
    apagarIndicacao(guarda);
    expect(indicacaoGuardada(guarda)).toBeNull();
  });

  it('valor guardado que não é UUID é apagado na leitura', () => {
    const guarda = guardaFalsa({ [CHAVE_DA_INDICACAO]: 'lixo' });
    expect(indicacaoGuardada(guarda)).toBeNull();
    expect(CHAVE_DA_INDICACAO in guarda.dados).toBe(false);
  });

  it('armazenamento que lança nunca derruba a página', () => {
    const quebrada = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => { throw new Error('bloqueado'); },
    };
    expect(() => guardarIndicacao(quebrada, UUID)).not.toThrow();
    expect(indicacaoGuardada(quebrada)).toBeNull();
    expect(() => apagarIndicacao(quebrada)).not.toThrow();
  });

  it('sem armazenamento (nativo) tudo é nulo', () => {
    expect(indicacaoGuardada(null)).toBeNull();
    expect(() => guardarIndicacao(null, UUID)).not.toThrow();
    expect(() => apagarIndicacao(null)).not.toThrow();
  });
});
