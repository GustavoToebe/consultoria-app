import { concluirEmDestaque, rotuloDoConcluir, todasMarcadas } from './destaqueDaConclusao';

describe('"Revisar e concluir treino" (B5 da reunião de 30/10)', () => {
  it('todas marcadas só com séries previstas e todas feitas', () => {
    expect(todasMarcadas(6, 6)).toBe(true);
    expect(todasMarcadas(6, 5)).toBe(false);
    expect(todasMarcadas(0, 0)).toBe(false);
  });

  it('o texto do botão muda só com tudo marcado', () => {
    expect(rotuloDoConcluir(6, 6)).toBe('Revisar e concluir treino');
    expect(rotuloDoConcluir(6, 3)).toBe('Concluir treino');
    expect(rotuloDoConcluir(0, 0)).toBe('Concluir treino');
  });

  const base = { retornoHabilitado: true, total: 4, feitas: 4, podeConcluir: true, concluida: false };

  it('em destaque com a chave ligada, tudo marcado, data que aceita conclusão e ainda não concluído', () => {
    expect(concluirEmDestaque(base)).toBe(true);
  });

  it('com a chave desligada nada muda', () => {
    expect(concluirEmDestaque({ ...base, retornoHabilitado: false })).toBe(false);
  });

  it('não fica em destaque com série faltando, em data que não aceita conclusão ou já concluído', () => {
    expect(concluirEmDestaque({ ...base, feitas: 3 })).toBe(false);
    expect(concluirEmDestaque({ ...base, podeConcluir: false })).toBe(false);
    expect(concluirEmDestaque({ ...base, concluida: true })).toBe(false);
  });
});
