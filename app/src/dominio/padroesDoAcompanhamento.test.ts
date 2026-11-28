import { exemploDoPrazo, faseDaPrevia, prazoValido } from './padroesDoAcompanhamento';
import { periodoInicial } from './periodo';

const SEM_TEXTO = { menstrual: null, folicular: null, ovulatoria: null, lutea: null };

describe('prazo da atualização', () => {
  it('vale vazio ou inteiro de 1 a 365', () => {
    expect(prazoValido(null)).toBe(true);
    expect(prazoValido(1)).toBe(true);
    expect(prazoValido(365)).toBe(true);
    expect(prazoValido(0)).toBe(false);
    expect(prazoValido(366)).toBe(false);
    expect(prazoValido(1.5)).toBe(false);
  });

  it('exemplo começa hoje e termina em início + dias − 1, o mesmo fim do "Nova pasta"', () => {
    expect(exemploDoPrazo('2026-11-28', 14)).toBe('Uma pasta criada hoje vai de 28/11 a 11/12.');
    expect(periodoInicial('2026-11-28', 14).fim).toBe('11/12/2026');
    expect(exemploDoPrazo('2026-11-28', 1)).toBe('Uma pasta criada hoje vai de 28/11 a 28/11.');
  });

  it('o ano aparece só na data de outro ano', () => {
    expect(exemploDoPrazo('2026-12-20', 30)).toBe('Uma pasta criada hoje vai de 20/12 a 18/01/2027.');
  });

  it('sem prazo explica; fora da faixa não tem exemplo', () => {
    expect(exemploDoPrazo('2026-11-28', null)).toBe('Sem padrão: você define o período em cada pasta.');
    expect(exemploDoPrazo('2026-11-28', 400)).toBeNull();
    expect(exemploDoPrazo('2026-11-28', 0)).toBeNull();
  });
});

describe('fase da prévia', () => {
  it('a do campo com o cursor, mesmo sem texto', () => {
    expect(faseDaPrevia('lutea', { ...SEM_TEXTO, folicular: 'Texto fictício.' })).toBe('lutea');
  });

  it('sem foco, a primeira com texto; sem nenhum, a Menstrual', () => {
    expect(faseDaPrevia(null, { ...SEM_TEXTO, ovulatoria: 'Texto fictício.', lutea: 'Outro.' })).toBe('ovulatoria');
    expect(faseDaPrevia(null, SEM_TEXTO)).toBe('menstrual');
  });
});
