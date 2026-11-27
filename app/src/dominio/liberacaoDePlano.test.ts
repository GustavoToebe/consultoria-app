import {
  amanhaEmBrasilia,
  avisarAoLiberarAgora,
  corpoDaLiberacao,
  destinoDoErro,
  erroDoCampo,
  escolhaInicial,
  faixaDaLiberacao,
  MENSAGEM_SEM_DATA,
  rotuloAgendado,
  rotuloDoAviso,
  TEXTO_JA_LIBERADO,
  textoDoPublicado,
  validarDataDeLiberacao,
} from './liberacaoDePlano';

const HOJE = '2026-11-26';

describe('faixa da liberação', () => {
  it('vai de amanhã em Brasília até 31/12 de hoje + 5 anos', () => {
    expect(faixaDaLiberacao(HOJE)).toEqual({ minimo: '2026-11-27', maximo: '2031-12-31' });
  });

  it('amanhã vira o mês e o ano', () => {
    expect(amanhaEmBrasilia('2026-11-30')).toBe('2026-12-01');
    expect(amanhaEmBrasilia('2026-12-31')).toBe('2027-01-01');
    expect(amanhaEmBrasilia('2028-02-28')).toBe('2028-02-29');
  });
});

describe('validarDataDeLiberacao', () => {
  it('aceita de amanhã ao último dia da faixa', () => {
    expect(validarDataDeLiberacao('27/11/2026', HOJE)).toEqual({ iso: '2026-11-27', erro: null });
    expect(validarDataDeLiberacao('31/12/2031', HOJE)).toEqual({ iso: '2031-12-31', erro: null });
  });

  it('recusa hoje, o passado e depois da faixa, dizendo a faixa', () => {
    for (const t of ['26/11/2026', '01/01/2020', '01/01/2032']) {
      expect(validarDataDeLiberacao(t, HOJE)).toEqual({ iso: null, erro: 'Escolha um dia a partir de amanhã (27/11/2026) até 31/12/2031.' });
    }
  });

  it('vazio pede a data e data impossível é inválida', () => {
    expect(validarDataDeLiberacao('', HOJE).erro).toBe(MENSAGEM_SEM_DATA);
    expect(validarDataDeLiberacao('31/02/2027', HOJE).erro).toBe('Data inválida.');
    expect(validarDataDeLiberacao('12/1', HOJE).erro).toBe('Data inválida.');
  });

  it('o campo só reclama da data incompleta depois de tentar enviar', () => {
    expect(erroDoCampo('12/1', false, HOJE)).toBeNull();
    expect(erroDoCampo('12/1', true, HOJE)).toBe('Data inválida.');
    expect(erroDoCampo('26/11/2026', false, HOJE)).not.toBeNull();
  });
});

describe('corpoDaLiberacao', () => {
  it('publicar agora com aviso não manda nada além do padrão da API', () => {
    expect(corpoDaLiberacao({ modo: 'agora', dataTexto: '30/11/2026', avisar: true }, HOJE)).toEqual({ corpo: {} });
  });

  it('sem aviso manda avisarAluno falso', () => {
    expect(corpoDaLiberacao({ modo: 'agora', dataTexto: '', avisar: false }, HOJE)).toEqual({ corpo: { avisarAluno: false } });
    expect(corpoDaLiberacao({ modo: 'agendar', dataTexto: '30/11/2026', avisar: false }, HOJE))
      .toEqual({ corpo: { liberarEm: '2026-11-30', avisarAluno: false } });
  });

  it('agendar manda a data e exige uma data válida', () => {
    expect(corpoDaLiberacao({ modo: 'agendar', dataTexto: '30/11/2026', avisar: true }, HOJE)).toEqual({ corpo: { liberarEm: '2026-11-30' } });
    expect(corpoDaLiberacao({ modo: 'agendar', dataTexto: '', avisar: true }, HOJE)).toEqual({ erro: MENSAGEM_SEM_DATA });
  });
});

describe('escolha inicial e aviso', () => {
  it('plano agendado traz a data e o aviso gravados', () => {
    expect(escolhaInicial({ liberarEm: '2026-11-30', avisarNaLiberacao: false }, 'agora')).toEqual({ modo: 'agendar', dataTexto: '30/11/2026', avisar: false });
  });

  it('plano sem agendamento começa no modo pedido, com o aviso ligado', () => {
    expect(escolhaInicial({ liberarEm: null }, 'agendar')).toEqual({ modo: 'agendar', dataTexto: '', avisar: true });
  });

  it('"Liberar agora" repete o aviso do agendamento; ausente avisa', () => {
    expect(avisarAoLiberarAgora({ avisarNaLiberacao: false })).toBe(false);
    expect(avisarAoLiberarAgora({})).toBe(true);
  });

  it('o rótulo do aviso acompanha o modo', () => {
    expect(rotuloDoAviso('agendar')).toBe('Avisar o aluno quando liberar');
    expect(rotuloDoAviso('agora')).toBe('Avisar o aluno');
  });
});

describe('textos', () => {
  it('selo sem o ano corrente e com o ano de outro', () => {
    expect(rotuloAgendado('2026-11-27', HOJE)).toBe('Agendado para 27/11');
    expect(rotuloAgendado('2027-01-04', HOJE)).toBe('Agendado para 04/01/2027');
  });

  it('o aviso de publicado diz quando o aluno vê', () => {
    expect(textoDoPublicado(3, null, HOJE)).toBe('Publicado v3. O aluno já vê esta versão.');
    expect(textoDoPublicado(3, '2026-11-30', HOJE)).toBe('Publicado v3, agendado para 30/11. Até lá, o aluno continua com o que já via.');
  });
});

describe('destinoDoErro', () => {
  it('422 LIBERACAO_INVALIDA vai ao campo com a mensagem da API', () => {
    expect(destinoDoErro({ status: 422, codigo: 'LIBERACAO_INVALIDA', campos: [{ field: 'liberarEm', message: 'Use uma data a partir de amanhã.' }] }))
      .toEqual({ campo: 'Use uma data a partir de amanhã.' });
  });

  it('409 PLANO_NAO_AGENDADO avisa e recarrega', () => {
    expect(destinoDoErro({ status: 409, codigo: 'PLANO_NAO_AGENDADO', campos: [] })).toEqual({ aviso: TEXTO_JA_LIBERADO, recarregar: true });
  });

  it('o resto fica com o texto geral', () => {
    expect(destinoDoErro({ status: 404, codigo: 'NAO_ENCONTRADO', campos: [] })).toBeNull();
  });
});
