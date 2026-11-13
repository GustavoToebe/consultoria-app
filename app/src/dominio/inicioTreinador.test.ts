import {
  contadorDeRetornos, estadoDaFonte, proximoPassoDoInicio, resumoDoInicio, TETO_PLANOS_TERMINANDO, TEXTO_EM_DIA, TEXTO_NAO_CONFERIU_TUDO,
  TEXTO_SEM_ACESSO_AO_RESUMO, tomDoContador, umPorAluno, type FontesDoResumo,
} from './inicioTreinador';

const nada = { paraRevisar: 0, atrasadas: 0, interessadosNovos: 0, planosTerminando: 0, semRegistro: 0, diasSemRegistro: 7 };

describe('proximoPassoDoInicio', () => {
  it('revisar vem primeiro, depois atrasadas, interessados, planos e sem registro', () => {
    expect(proximoPassoDoInicio({ ...nada, paraRevisar: 2, atrasadas: 1 })).toEqual({ texto: '2 atualizações chegaram para revisar.', acao: 'Revisar agora', destino: 'PARA_REVISAR' });
    expect(proximoPassoDoInicio({ ...nada, atrasadas: 1, interessadosNovos: 3 })?.texto).toBe('1 atualização está atrasada.');
    expect(proximoPassoDoInicio({ ...nada, interessadosNovos: 1, planosTerminando: 2 })?.destino).toBe('INTERESSADOS');
    expect(proximoPassoDoInicio({ ...nada, planosTerminando: 1 })?.texto).toBe('1 plano termina nos próximos 7 dias.');
    expect(proximoPassoDoInicio({ ...nada, semRegistro: 3, diasSemRegistro: 14 })?.texto).toBe('3 alunos estão sem registro há 14 dias.');
  });

  it('planos terminando no teto da lista da API (20) dizem "20 ou mais", porque o total não vem', () => {
    expect(TETO_PLANOS_TERMINANDO).toBe(20);
    expect(proximoPassoDoInicio({ ...nada, planosTerminando: 19 })?.texto).toBe('19 planos terminam nos próximos 7 dias.');
    expect(proximoPassoDoInicio({ ...nada, planosTerminando: 20 })?.texto).toBe('20 ou mais planos terminam nos próximos 7 dias.');
    expect(proximoPassoDoInicio({ ...nada, planosTerminando: 20 })?.acao).toBe('Ver planos');
  });
  it('retorno vencido vem depois das atualizações e antes dos interessados novos; o de hoje, depois deles', () => {
    expect(proximoPassoDoInicio({ ...nada, atrasadas: 1, retornosAtrasados: 2 })?.destino).toBe('ATRASADAS');
    expect(proximoPassoDoInicio({ ...nada, retornosAtrasados: 2, interessadosNovos: 1 })).toEqual({ texto: '2 retornos a interessados estão atrasados.', acao: 'Ver retornos', destino: 'RETORNOS' });
    expect(proximoPassoDoInicio({ ...nada, retornosHoje: 1, interessadosNovos: 1 })?.destino).toBe('INTERESSADOS');
    expect(proximoPassoDoInicio({ ...nada, retornosHoje: 1, planosTerminando: 3 })?.texto).toBe('1 retorno a interessado está marcado para hoje.');
    expect(proximoPassoDoInicio({ ...nada, retornosAtrasados: null, retornosHoje: null })).toBeNull();
  });
  it('sem permissão (nulo) ou tudo zerado = nulo', () => {
    expect(proximoPassoDoInicio(nada)).toBeNull();
    expect(proximoPassoDoInicio({ ...nada, paraRevisar: null, atrasadas: null, interessadosNovos: null })).toBeNull();
  });
});

describe('umPorAluno', () => {
  it('o mais recente de cada aluno, até o limite', () => {
    const e = (id: string, data: string) => ({ aluno: { id }, data });
    const saida = umPorAluno([e('a', '2026-10-10'), e('a', '2026-10-12'), e('b', '2026-10-11'), e('c', '2026-10-01')], 2);
    expect(saida).toEqual([e('a', '2026-10-12'), e('b', '2026-10-11')]);
  });
});

describe('tomDoContador', () => {
  it('zerado suave; com algo, atenção ou perigo', () => {
    expect([tomDoContador(0), tomDoContador(2), tomDoContador(1, true)]).toEqual(['suave', 'atencao', 'perigo']);
  });
});

describe('contadorDeRetornos', () => {
  it('soma atrasados e de hoje; vermelho com atrasado, âmbar só com os de hoje, apagado sem nenhum', () => {
    expect(contadorDeRetornos(0, 0)).toEqual({ numero: 0, tom: 'suave', detalhe: null });
    expect(contadorDeRetornos(0, 2)).toEqual({ numero: 2, tom: 'atencao', detalhe: '2 para hoje' });
    expect(contadorDeRetornos(1, 0)).toEqual({ numero: 1, tom: 'perigo', detalhe: '1 atrasado' });
    expect(contadorDeRetornos(3, 1)).toEqual({ numero: 4, tom: 'perigo', detalhe: '3 atrasados · 1 para hoje' });
  });
});

describe('estadoDaFonte', () => {
  it('sem acesso vale mais que tudo; só pronta com o número lido é consultada', () => {
    expect(estadoDaFonte(false, 'pronta', true)).toBe('semAcesso');
    expect(estadoDaFonte(false, 'carregando', false)).toBe('semAcesso');
    expect(estadoDaFonte(true, 'carregando', false)).toBe('carregando');
    expect(estadoDaFonte(true, 'pronta', true)).toBe('consultada');
    expect(estadoDaFonte(true, 'pronta', false)).toBe('falhou');
    expect(estadoDaFonte(true, 'falhou', false)).toBe('falhou');
    expect(estadoDaFonte(true, 'desligada', false)).toBe('falhou');
  });
});

describe('resumoDoInicio (D9: "em dia" só com todas as fontes consultadas)', () => {
  const todas: FontesDoResumo = { atualizacoes: 'consultada', interessados: 'consultada', planosTerminando: 'consultada', semRegistro: 'consultada' };
  const nulas = { paraRevisar: null, atrasadas: null, interessadosNovos: null, planosTerminando: null, semRegistro: null, diasSemRegistro: 7 };

  it('todas consultadas e sem pendência: "Nada pede sua atenção agora"', () => {
    expect(resumoDoInicio(nada, todas)).toEqual({ tipo: 'emDia', texto: TEXTO_EM_DIA });
    expect(TEXTO_EM_DIA).toContain('Nada pede sua atenção agora');
  });

  it('perfil só com PAINEL_VER (nenhuma fonte acessível): "Você não tem acesso aos dados deste resumo", nunca "em dia"', () => {
    const semAcesso: FontesDoResumo = { atualizacoes: 'semAcesso', interessados: 'semAcesso', planosTerminando: 'semAcesso', semRegistro: 'semAcesso' };
    expect(resumoDoInicio(nulas, semAcesso)).toEqual({ tipo: 'semAcesso', texto: 'Você não tem acesso aos dados deste resumo.' });
    expect(TEXTO_SEM_ACESSO_AO_RESUMO).not.toContain('Nada pede');
  });

  it('parcial por falta de acesso: avisa que não foi possível conferir tudo e não afirma "em dia"', () => {
    const r = resumoDoInicio({ ...nulas, paraRevisar: 0, atrasadas: 0 }, { ...todas, interessados: 'semAcesso', planosTerminando: 'semAcesso', semRegistro: 'semAcesso' });
    expect(r).toMatchObject({ tipo: 'parcial', tentarDeNovo: false });
    expect((r as { texto: string }).texto).toContain(TEXTO_NAO_CONFERIU_TUDO);
    expect((r as { texto: string }).texto).not.toContain('Nada pede');
  });

  it('uma fonte falhou: parcial com "Tentar de novo"; só falha e sem acesso, sem nenhuma consultada, também é parcial', () => {
    expect(resumoDoInicio(nada, { ...todas, interessados: 'falhou' })).toMatchObject({ tipo: 'parcial', tentarDeNovo: true });
    expect(resumoDoInicio(nulas, { atualizacoes: 'falhou', interessados: 'semAcesso', planosTerminando: 'semAcesso', semRegistro: 'semAcesso' })).toMatchObject({ tipo: 'parcial', tentarDeNovo: true });
  });

  it('carregando sem pendência: não afirma nada (nem "em dia" nem "sem acesso" nem "parcial")', () => {
    expect(resumoDoInicio(nada, { ...todas, atualizacoes: 'carregando' })).toEqual({ tipo: 'carregando' });
    expect(resumoDoInicio(nulas, { atualizacoes: 'semAcesso', interessados: 'carregando', planosTerminando: 'semAcesso', semRegistro: 'semAcesso' })).toEqual({ tipo: 'carregando' });
  });

  it('pendência numa fonte consultada continua aparecendo; sem aviso se tudo foi conferido, com aviso se foi parcial', () => {
    const completo = resumoDoInicio({ ...nada, paraRevisar: 2 }, todas);
    expect(completo).toMatchObject({ tipo: 'pendencia', aviso: null, passo: { destino: 'PARA_REVISAR' } });
    const parcial = resumoDoInicio({ ...nada, paraRevisar: 2, interessadosNovos: null }, { ...todas, interessados: 'falhou' });
    expect(parcial).toMatchObject({ tipo: 'pendencia', aviso: 'Não foi possível conferir tudo.', passo: { destino: 'PARA_REVISAR' } });
    expect(resumoDoInicio({ ...nulas, semRegistro: 4 }, { ...todas, atualizacoes: 'semAcesso' })).toMatchObject({ tipo: 'pendencia', aviso: TEXTO_NAO_CONFERIU_TUDO });
  });

  it('pendência aparece mesmo com outra fonte ainda carregando', () => {
    expect(resumoDoInicio({ ...nada, atrasadas: 1 }, { ...todas, interessados: 'carregando' })).toMatchObject({ tipo: 'pendencia', aviso: null });
  });
});
