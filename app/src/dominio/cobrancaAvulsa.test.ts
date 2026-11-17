import { ErroApi, MENSAGEM_SEM_CONEXAO } from '@plataforma/web';

import {
  confirmacaoDaAvulsa, corpoDaAvulsa, errosDaEtapa, MENSAGEM_ALUNO_ANONIMIZADO, MENSAGEM_ALUNO_INATIVO, MENSAGEM_ALUNO_NAO_ENCONTRADO,
  foraDosAtivos, MENSAGEM_CONFERIR_A_LISTA, previaDasParcelas, primeiraEtapaComErro, quantidadeDeCobrancas, textoDaAvulsaGerada, traduzirErroDaAvulsa,
  type EntradaDaAvulsa,
} from './cobrancaAvulsa';

const HOJE = '2026-11-17';
const ids = (n: number) => Array.from({ length: n }, (_, i) => `aluno-${i}`);
const entrada = (extra: Partial<EntradaDaAvulsa> = {}): EntradaDaAvulsa => ({
  alunoIds: ids(2), descricao: 'Camiseta do time', valorTexto: '150,00', primeiroVencimentoTexto: '05/12/2026', parcelasTexto: '1', ...extra,
});
const erros = (extra: Partial<EntradaDaAvulsa>) => {
  const r = corpoDaAvulsa(entrada(extra), HOJE);
  return r.ok ? {} : r.erros;
};
const sem = (t: string) => t.replace(/ /g, ' ');

describe('corpoDaAvulsa', () => {
  it('entrada válida monta o corpo em centavos inteiros, com a descrição sem as pontas', () => {
    expect(corpoDaAvulsa(entrada({ descricao: '  Camiseta  ' }), HOJE)).toEqual({
      ok: true,
      corpo: { alunoIds: ['aluno-0', 'aluno-1'], descricao: 'Camiseta', valorCentavos: 15_000, primeiroVencimento: '2026-12-05', parcelas: 1 },
    });
  });

  it('alunos: de 1 a 100 sem repetir', () => {
    expect(erros({ alunoIds: [] }).alunos).toBe('Escolha ao menos um aluno.');
    expect(corpoDaAvulsa(entrada({ alunoIds: ids(100) }), HOJE).ok).toBe(true);
    expect(erros({ alunoIds: ids(101) }).alunos).toBe('O limite é de 100 alunos por vez. Tire 1 aluno da seleção.');
    expect(erros({ alunoIds: ids(103) }).alunos).toContain('Tire 3 alunos');
    expect(erros({ alunoIds: ['a', 'b', 'a'] }).alunos).toBe('Há aluno repetido na seleção.');
  });

  it('descrição: de 1 a 120 depois do strip', () => {
    expect(erros({ descricao: '   ' }).descricao).toBe('Descreva a cobrança.');
    expect(corpoDaAvulsa(entrada({ descricao: 'x'.repeat(120) }), HOJE).ok).toBe(true);
    expect(corpoDaAvulsa(entrada({ descricao: ` ${'x'.repeat(120)} ` }), HOJE).ok).toBe(true);
    expect(erros({ descricao: 'x'.repeat(121) }).descricao).toBe('A descrição pode ter até 120 caracteres.');
  });

  it('valor: reais com vírgula viram centavos exatos; zero, vazio, lixo e acima do teto são recusados', () => {
    const centavos = (valorTexto: string) => {
      const r = corpoDaAvulsa(entrada({ valorTexto }), HOJE);
      return r.ok ? r.corpo.valorCentavos : null;
    };
    expect(centavos('19,90')).toBe(1_990);
    expect(centavos('0,29')).toBe(29);
    expect(centavos('1.234,56')).toBe(123_456);
    expect(centavos('R$ 150')).toBe(15_000);
    expect(centavos('10.000.000,00')).toBe(1_000_000_000);
    for (const ruim of ['', '0', '0,00', '-5', 'abc', '1,234']) expect(erros({ valorTexto: ruim }).valor).toBe('Informe um valor maior que zero, por exemplo 150,00.');
    expect(erros({ valorTexto: '10.000.000,01' }).valor).toBe('Esse valor passa do máximo permitido (R$ 10.000.000,00).');
  });

  it('primeiro vencimento: vazio, incompleto, impossível e fora da faixa PLANEJAMENTO (2000 até o ano + 5)', () => {
    expect(erros({ primeiroVencimentoTexto: '' }).primeiroVencimento).toBe('Informe o primeiro vencimento.');
    expect(erros({ primeiroVencimentoTexto: '05/12' }).primeiroVencimento).toBe('Informe a data completa, como 05/12/2026.');
    expect(erros({ primeiroVencimentoTexto: '31/02/2026' }).primeiroVencimento).toBe('Data inválida.');
    expect(erros({ primeiroVencimentoTexto: '31/12/1999' }).primeiroVencimento).toBe('Primeiro vencimento: use uma data entre 01/01/2000 e 31/12/2031');
    expect(erros({ primeiroVencimentoTexto: '01/01/2032' }).primeiroVencimento).toContain('use uma data entre');
    expect(corpoDaAvulsa(entrada({ primeiroVencimentoTexto: '31/12/2031' }), HOJE).ok).toBe(true);
    expect(corpoDaAvulsa(entrada({ primeiroVencimentoTexto: '01/01/2000' }), HOJE).ok).toBe(true);
  });

  it('parcelas: inteiro de 1 a 12', () => {
    for (const ruim of ['', '0', '13', '1,5', 'a', '-1', '100']) expect(erros({ parcelasTexto: ruim }).parcelas).toBe('As parcelas vão de 1 a 12.');
    for (const bom of ['1', '12', ' 3 ']) expect(corpoDaAvulsa(entrada({ parcelasTexto: bom }), HOJE).ok).toBe(true);
  });

  it('as mensagens nunca repetem o que foi digitado', () => {
    const r = corpoDaAvulsa(entrada({ descricao: 'x'.repeat(130), valorTexto: '987654321,12', parcelasTexto: '77', primeiroVencimentoTexto: '31/02/1999' }), HOJE);
    expect(r.ok).toBe(false);
    const texto = JSON.stringify(r);
    for (const digitado of ['987654321', '77', '1999', 'xxxxx']) expect(texto).not.toContain(digitado);
  });
});

describe('etapas do passo a passo', () => {
  const tudoErrado = entrada({ alunoIds: [], descricao: '', valorTexto: '', primeiroVencimentoTexto: '', parcelasTexto: '' });
  it('cada etapa só mostra os erros dos próprios campos', () => {
    expect(Object.keys(errosDaEtapa(1, tudoErrado, HOJE))).toEqual(['alunos']);
    expect(Object.keys(errosDaEtapa(2, tudoErrado, HOJE))).toEqual(['descricao', 'valor']);
    expect(Object.keys(errosDaEtapa(3, tudoErrado, HOJE))).toEqual(['primeiroVencimento', 'parcelas']);
    for (const e of [1, 2, 3] as const) expect(errosDaEtapa(e, entrada(), HOJE)).toEqual({});
  });
  it('a primeira etapa com erro', () => {
    expect(primeiraEtapaComErro({})).toBeNull();
    expect(primeiraEtapaComErro({ parcelas: 'x', valor: 'y' })).toBe(2);
    expect(primeiraEtapaComErro({ alunos: 'x', parcelas: 'y' })).toBe(1);
  });
});

describe('prévia das parcelas', () => {
  it('uma parcela: a descrição não leva "Parcela"', () => {
    expect(previaDasParcelas('2026-12-05', 1, ' Camiseta ')).toEqual([{ numero: 1, de: 1, vencimento: '2026-12-05', descricao: 'Camiseta' }]);
  });
  it('mais de uma: "Parcela k/n" e vencimento = primeiro + (k-1) meses', () => {
    expect(previaDasParcelas('2026-12-05', 3, 'Camiseta')).toEqual([
      { numero: 1, de: 3, vencimento: '2026-12-05', descricao: 'Camiseta (Parcela 1/3)' },
      { numero: 2, de: 3, vencimento: '2027-01-05', descricao: 'Camiseta (Parcela 2/3)' },
      { numero: 3, de: 3, vencimento: '2027-02-05', descricao: 'Camiseta (Parcela 3/3)' },
    ]);
  });
  it('dia 31: preso ao último dia do mês, sempre contado do primeiro (nunca encadeado) e em ano bissexto', () => {
    expect(previaDasParcelas('2026-01-31', 4, 'x').map((p) => p.vencimento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(previaDasParcelas('2028-01-31', 2, 'x').map((p) => p.vencimento)).toEqual(['2028-01-31', '2028-02-29']);
    expect(previaDasParcelas('2026-11-30', 3, 'x').map((p) => p.vencimento)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
  });
  it('12 parcelas atravessam o ano', () => {
    const p = previaDasParcelas('2026-11-15', 12, 'x');
    expect(p).toHaveLength(12);
    expect(p[11]).toMatchObject({ vencimento: '2027-10-15', descricao: 'x (Parcela 12/12)' });
  });
});

describe('confirmação', () => {
  const corpo = (alunos: number, parcelas: number, valorCentavos = 15_000) =>
    ({ alunoIds: ids(alunos), descricao: 'x', valorCentavos, primeiroVencimento: '2026-12-05', parcelas });
  it('N = alunos × parcelas, com o total em reais (valor × N) e o primeiro vencimento', () => {
    expect(quantidadeDeCobrancas(corpo(2, 3))).toBe(6);
    const c = confirmacaoDaAvulsa(corpo(2, 3));
    expect(c.titulo).toBe('Gerar 6 cobranças?');
    expect(sem(c.detalhe)).toBe('2 alunos × 3 parcelas de R$ 150,00: total de R$ 900,00. O primeiro vencimento é 05/12/2026.');
  });
  it('singular', () => {
    const c = confirmacaoDaAvulsa(corpo(1, 1, 9_990));
    expect(c.titulo).toBe('Gerar 1 cobrança?');
    expect(sem(c.detalhe)).toBe('1 aluno × R$ 99,90: total de R$ 99,90. O primeiro vencimento é 05/12/2026.');
  });
  it('o teto (100 alunos × 12 parcelas × R$ 10 milhões) segue em inteiros exatos', () => {
    const c = confirmacaoDaAvulsa(corpo(100, 12, 1_000_000_000));
    expect(c.titulo).toBe('Gerar 1.200 cobranças?'.replace('1.200', '1200'));
    expect(sem(c.detalhe)).toContain('R$ 12.000.000.000,00');
  });
  it('texto do sucesso', () => {
    expect(textoDaAvulsaGerada({ alunos: 2, cobrancas: 6 })).toBe('6 cobranças geradas para 2 alunos.');
    expect(textoDaAvulsaGerada({ alunos: 1, cobrancas: 1 })).toBe('1 cobrança gerada para 1 aluno.');
  });
});

describe('foraDosAtivos', () => {
  it('os escolhidos que a lista de ativos não traz, na ordem da seleção', () => {
    expect(foraDosAtivos(['a', 'b', 'c'], new Set(['a', 'c', 'x']))).toEqual(['b']);
    expect(foraDosAtivos(['a'], new Set(['a']))).toEqual([]);
  });
});

describe('traduzirErroDaAvulsa', () => {
  it('422 por campo: alunoIds e alunoIds[i] viram "alunos", com a etapa e a mensagem da API', () => {
    const e = new ErroApi(422, 'COBRANCA_AVULSA_INVALIDA', 'Dados inválidos.', [
      { field: 'alunoIds[1]', message: 'Aluno repetido.' },
      { field: 'valorCentavos', message: 'Informe um valor maior que zero.' },
      { field: 'parcelas', message: 'As parcelas vão de 1 a 12.' },
    ]);
    expect(traduzirErroDaAvulsa(e)).toEqual({
      mensagem: 'Confira os campos destacados.', etapa: 1, recarregarAlunos: false, incerto: false,
      campos: { alunos: 'Aluno repetido.', valor: 'Informe um valor maior que zero.', parcelas: 'As parcelas vão de 1 a 12.' },
    });
  });
  it('422 só com campo da etapa 3 leva a ela; campo desconhecido vai ao texto geral; sem campo usa a mensagem da API', () => {
    expect(traduzirErroDaAvulsa(new ErroApi(422, 'COBRANCA_AVULSA_INVALIDA', 'x', [{ field: 'primeiroVencimento', message: 'Data fora da faixa.' }]))).toMatchObject({ etapa: 3, campos: { primeiroVencimento: 'Data fora da faixa.' } });
    expect(traduzirErroDaAvulsa(new ErroApi(422, 'COBRANCA_AVULSA_INVALIDA', 'x', [{ field: 'outra', message: 'Algo no corpo.' }]))).toMatchObject({ mensagem: 'Algo no corpo.', etapa: null });
    expect(traduzirErroDaAvulsa(new ErroApi(422, 'COBRANCA_AVULSA_INVALIDA', 'Corpo inválido.')).mensagem).toBe('Corpo inválido.');
  });
  it('404, aluno inativo e anonimizado: tudo ou nada, e a lista de alunos recarrega', () => {
    expect(traduzirErroDaAvulsa(new ErroApi(404, 'NAO_ENCONTRADO', 'x'))).toMatchObject({ mensagem: MENSAGEM_ALUNO_NAO_ENCONTRADO, recarregarAlunos: true });
    expect(traduzirErroDaAvulsa(new ErroApi(409, 'ALUNO_INATIVO', 'x'))).toMatchObject({ mensagem: MENSAGEM_ALUNO_INATIVO, recarregarAlunos: true });
    expect(traduzirErroDaAvulsa(new ErroApi(409, 'ALUNO_ANONIMIZADO', 'x'))).toMatchObject({ mensagem: MENSAGEM_ALUNO_ANONIMIZADO, recarregarAlunos: true });
    for (const m of [MENSAGEM_ALUNO_NAO_ENCONTRADO, MENSAGEM_ALUNO_INATIVO, MENSAGEM_ALUNO_ANONIMIZADO]) expect(m).toContain('Nenhuma cobrança foi gerada');
  });
  it('403 e 503 FINANCEIRO_INDISPONIVEL mostram o texto da API', () => {
    expect(traduzirErroDaAvulsa(new ErroApi(403, 'PERMISSAO_NEGADA', 'Você não pode gerar cobranças.')).mensagem).toBe('Você não pode gerar cobranças.');
    expect(traduzirErroDaAvulsa(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'O financeiro está desligado.')).mensagem).toBe('O financeiro está desligado.');
    // Não gravaram nada: podem ser repetidos (não são incertos).
    expect(traduzirErroDaAvulsa(new ErroApi(403, 'PERMISSAO_NEGADA', 'x')).incerto).toBe(false);
    expect(traduzirErroDaAvulsa(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'x')).incerto).toBe(false);
    expect(traduzirErroDaAvulsa(new ErroApi(409, 'ALUNO_INATIVO', 'x')).incerto).toBe(false);
  });
  it('sem conexão e erro desconhecido mandam conferir a lista antes de repetir, sem repassar texto técnico', () => {
    expect(traduzirErroDaAvulsa(new ErroApi(0, null, MENSAGEM_SEM_CONEXAO)).mensagem).toContain(MENSAGEM_CONFERIR_A_LISTA);
    expect(traduzirErroDaAvulsa(new ErroApi(0, null, MENSAGEM_SEM_CONEXAO)).mensagem).toContain('Sem conexão');
    expect(traduzirErroDaAvulsa(new ErroApi(0, null, MENSAGEM_SEM_CONEXAO)).mensagem).not.toMatch(/tente de novo/i);
    expect(traduzirErroDaAvulsa(new ErroApi(500, null, 'detalhe interno')).mensagem).toBe(MENSAGEM_CONFERIR_A_LISTA);
    expect(traduzirErroDaAvulsa(new Error('boom')).mensagem).toBe(MENSAGEM_CONFERIR_A_LISTA);
    // Pode ter gravado: incerto, a tela só oferece conferir a lista.
    for (const e of [new ErroApi(0, null, MENSAGEM_SEM_CONEXAO), new ErroApi(500, null, 'x'), new Error('boom')]) expect(traduzirErroDaAvulsa(e).incerto).toBe(true);
    expect(MENSAGEM_CONFERIR_A_LISTA).toContain('em dobro');
  });
  it('503 de outro código não vaza o texto técnico', () => {
    expect(traduzirErroDaAvulsa(new ErroApi(503, 'OUTRO', 'detalhe interno')).mensagem).toBe(MENSAGEM_CONFERIR_A_LISTA);
  });
});
