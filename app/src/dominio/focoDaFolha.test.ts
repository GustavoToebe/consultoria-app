import { deveDevolverFoco, gatilhoRecente, JANELA_DO_GATILHO_MS } from './focoDaFolha';

describe('gatilhoRecente', () => {
  it('vale o clique logo antes de abrir, até o limite', () => {
    expect(gatilhoRecente({ quando: 1000 }, 1000)).toBe(true);
    expect(gatilhoRecente({ quando: 1000 }, 1000 + JANELA_DO_GATILHO_MS)).toBe(true);
  });
  it('não vale clique antigo, do futuro ou ausente', () => {
    expect(gatilhoRecente({ quando: 1000 }, 1001 + JANELA_DO_GATILHO_MS)).toBe(false);
    expect(gatilhoRecente({ quando: 2000 }, 1000)).toBe(false);
    expect(gatilhoRecente(null, 1000)).toBe(false);
  });
});

describe('deveDevolverFoco', () => {
  it('devolve com leitor ligado e gatilho na tela', () => {
    expect(deveDevolverFoco(true, { conectado: true })).toBe(true);
  });
  it('não faz nada sem leitor, sem gatilho ou com o gatilho já desmontado', () => {
    expect(deveDevolverFoco(false, { conectado: true })).toBe(false);
    expect(deveDevolverFoco(true, null)).toBe(false);
    expect(deveDevolverFoco(true, { conectado: false })).toBe(false);
  });
});
