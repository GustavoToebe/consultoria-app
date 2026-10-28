import {
  coresDoCartao,
  cortar,
  diasTreinadosNoMes,
  fraseDoNumero,
  nomeDoArquivoDoCartao,
  ordinal,
  semanasDoCartao,
  subtituloDoCartao,
  textoDosDias,
  tituloDoCartao,
  tituloDoMes,
} from './cartaoDoTreino';

describe('tela "Bom trabalho!" e cartão (Engajamento 0.4)', () => {
  it('número do treino: hoje é a posição; outra data, o total; sem total, nada', () => {
    expect(ordinal(12)).toBe('12º');
    expect(fraseDoNumero(12, '2026-10-19', '2026-10-19')).toBe('Este é o seu 12º treino.');
    expect(fraseDoNumero(12, '2026-10-17', '2026-10-19')).toBe('Você já concluiu 12 treinos.');
    expect(fraseDoNumero(1, '2026-10-17', '2026-10-19')).toBe('Você já concluiu 1 treino.');
    expect(fraseDoNumero(null, '2026-10-19', '2026-10-19')).toBeNull();
    expect(fraseDoNumero(0, '2026-10-19', '2026-10-19')).toBeNull();
    expect(tituloDoCartao(12, '2026-10-19', '2026-10-19')).toBe('12º treino');
    expect(tituloDoCartao(12, '2026-10-18', '2026-10-19')).toBe('12 treinos concluídos');
    expect(tituloDoCartao(null, '2026-10-19', '2026-10-19')).toBe('Treino concluído');
  });

  it('dias treinados do mês: conclusão ou série feita, só daquele mês', () => {
    const dias = diasTreinadosNoMes(
      '2026-10-19',
      [{ data: '2026-10-01', concluida: true }, { data: '2026-10-02', concluida: false }, { data: '2026-09-30', concluida: true }],
      [{ data: '2026-10-19', concluida: true }, { data: '2026-10-19', concluida: true }, { data: '2026-10-05', concluida: false }],
    );
    expect([...dias].sort()).toEqual(['2026-10-01', '2026-10-19']);
    expect(textoDosDias(2, '2026-10-19')).toBe('2 dias treinados em outubro');
    expect(textoDosDias(1, '2026-03-01')).toBe('1 dia treinado em março');
  });

  it('calendário: semanas de domingo a sábado, sem linha só de outro mês', () => {
    const outubro = semanasDoCartao('2026-10-19');
    expect(outubro).toHaveLength(5);
    expect(outubro[0]![4]).toMatchObject({ iso: '2026-10-01', doMes: true });
    expect(outubro.every((s) => s.length === 7 && s.some((d) => d.doMes))).toBe(true);
    // Fevereiro de 2026 começa num domingo e cabe em 4 semanas.
    expect(semanasDoCartao('2026-02-10')).toHaveLength(4);
    expect(tituloDoMes('2026-10-19')).toBe('Outubro de 2026');
  });

  it('textos curtos e cores fixas', () => {
    expect(cortar('  Treino   A  ', 30)).toBe('Treino A');
    expect(cortar('Peito, ombro e tríceps com muita coisa', 20)).toBe('Peito, ombro e tríc…');
    expect(subtituloDoCartao('Treino A', '2026-10-19')).toBe('Treino A · 19/10');
    expect(nomeDoArquivoDoCartao('2026-10-19')).toBe('treino-2026-10-19.png');
    const vermelho = coresDoCartao('#C62828');
    expect(vermelho.marca).toBe('#C62828');
    expect(vermelho.sobreMarca).toBe('#FFFFFF');
    // Marca escura que some no fundo do cartão: o dia treinado vira branco com número preto.
    const escura = coresDoCartao('#121212');
    expect(escura.marcado).toBe('#FFFFFF');
    expect(escura.sobreMarcado).toBe('#000000');
    expect(coresDoCartao('vermelho').marca).toBe('#333333');
  });
});
