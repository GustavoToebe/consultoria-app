import { ultimoLoginNaLinha } from './acessoAoApp';

// ficha: acesso ao app (24/11)
describe('ultimoLoginNaLinha', () => {
  // 23/11/2026 12:00 em Brasília.
  const agora = new Date('2026-11-23T15:00:00Z');

  test('hoje e ontem com a hora de Brasília; a data completa na dica', () => {
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-23T13:05:00Z' }, agora)).toEqual({ rotulo: 'Último login', texto: 'Hoje, 10:05', exata: '23/11/2026 às 10:05' });
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-22T21:38:00Z' }, agora)).toEqual({ rotulo: 'Último login', texto: 'Ontem, 18:38', exata: '22/11/2026 às 18:38' });
  });

  test('a virada do dia é a de Brasília, não a do UTC', () => {
    // 01:00 UTC de 23/11 ainda é 22h de 22/11 em Brasília.
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-23T01:00:00Z' }, agora).texto).toBe('Ontem, 22:00');
  });

  test('mais longe: data curta e hora; o ano só se for outro', () => {
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-17T15:30:00Z' }, agora).texto).toBe('17/11 12:30');
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2025-12-30T15:30:00Z' }, agora).texto).toBe('30/12/2025 12:30');
  });

  test('ACESSO diz "Último acesso ao app"; login nunca é chamado de acesso', () => {
    expect(ultimoLoginNaLinha({ tipo: 'ACESSO', em: '2026-11-23T13:05:00Z' }, agora).rotulo).toBe('Último acesso ao app');
  });

  test('nunca entrou, instante malformado ou tipo desconhecido: "Último login" sem texto', () => {
    const vazio = { rotulo: 'Último login', texto: null, exata: null };
    expect(ultimoLoginNaLinha(null, agora)).toEqual(vazio);
    expect(ultimoLoginNaLinha(undefined, agora)).toEqual(vazio);
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: 'ontem' }, agora)).toEqual(vazio);
    expect(ultimoLoginNaLinha({ tipo: 'OUTRO' as never, em: '2026-11-23T12:00:00Z' }, agora)).toEqual(vazio);
  });
});
