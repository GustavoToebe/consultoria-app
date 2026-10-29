import { ErroApi } from '@plataforma/web';

import {
  alunoDoConflito,
  anamneseInicialDoAceite,
  opcoesDeAnamneseDoAceite,
  corpoDaInscricao,
  paginaQueSobra,
  errosDaInscricao,
  INSCRICAO_VAZIA,
  linkDoWhatsApp,
  mascaraWhatsapp,
  podeAceitar,
  podeRecusar,
  resumoDoObjetivo,
  seloDaSituacao,
  seloDoPagamento,
  situacoesDoAndamento,
  textoDaDuplicidade,
} from './inscricoes';

describe('selos da inscrição', () => {
  it('cor com significado: em atendimento âmbar, aceita verde, encerrada cinza', () => {
    expect(seloDaSituacao('NOVA')).toEqual({ texto: 'Nova', tipo: 'atencao' });
    expect(seloDaSituacao('EM_CONTATO').tipo).toBe('atencao');
    expect(seloDaSituacao('EM_NEGOCIACAO').tipo).toBe('atencao');
    expect(seloDaSituacao('ACEITA')).toEqual({ texto: 'Aceita', tipo: 'sucesso' });
    expect(seloDaSituacao('RECUSADA').tipo).toBe('neutro');
    expect(seloDaSituacao('DESISTIU').tipo).toBe('neutro');
  });

  it('pagamento só manual: confirmado é verde, aguardando âmbar, não controlado cinza', () => {
    expect(seloDoPagamento('CONFIRMADO_MANUAL')).toEqual({ texto: 'Confirmado (manual)', tipo: 'sucesso' });
    expect(seloDoPagamento('AGUARDANDO').tipo).toBe('atencao');
    expect(seloDoPagamento('NAO_CONTROLADO').tipo).toBe('neutro');
  });
});

describe('andamento', () => {
  it('aceitar e recusar ficam fora da escolha; aceita não muda; recusada pode voltar', () => {
    expect(situacoesDoAndamento('NOVA').map((o) => o.valor)).toEqual(['NOVA', 'EM_CONTATO', 'EM_NEGOCIACAO', 'DESISTIU']);
    expect(situacoesDoAndamento('ACEITA').map((o) => o.valor)).toEqual(['ACEITA']);
    expect(situacoesDoAndamento('RECUSADA').map((o) => o.valor)).toContain('RECUSADA');
  });

  it('aceitar só antes do aceite; recusar só enquanto não aceita nem recusada', () => {
    expect(podeAceitar('NOVA')).toBe(true);
    expect(podeAceitar('RECUSADA')).toBe(true);
    expect(podeAceitar('ACEITA')).toBe(false);
    expect(podeRecusar('EM_CONTATO')).toBe(true);
    expect(podeRecusar('RECUSADA')).toBe(false);
    expect(podeRecusar('ACEITA')).toBe(false);
  });
});

describe('WhatsApp', () => {
  it('link wa.me com 55 e só dígitos, sem texto pré-preenchido', () => {
    expect(linkDoWhatsApp('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
    expect(linkDoWhatsApp('+55 (11) 98765-4321')).toBe('https://wa.me/5511987654321');
    expect(linkDoWhatsApp('(45) 3222-1111')).toBe('https://wa.me/554532221111');
  });

  it('sem DDD ou inválido não vira link', () => {
    expect(linkDoWhatsApp('98765-4321')).toBeNull();
    expect(linkDoWhatsApp('')).toBeNull();
    expect(linkDoWhatsApp(null)).toBeNull();
    expect(linkDoWhatsApp('(01) 98765-4321')).toBeNull();
  });

  it('máscara enquanto digita', () => {
    expect(mascaraWhatsapp('11987654321')).toBe('(11) 98765-4321');
    expect(mascaraWhatsapp('119')).toBe('(11) 9');
  });
});

describe('textos da fila', () => {
  it('objetivo resumido; ausente é traço', () => {
    expect(resumoDoObjetivo(null)).toBe('—');
    expect(resumoDoObjetivo('   ')).toBe('—');
    expect(resumoDoObjetivo('Ganhar força')).toBe('Ganhar força');
    const longo = resumoDoObjetivo('a'.repeat(200), 20);
    expect(longo).toHaveLength(20);
    expect(longo.endsWith('…')).toBe(true);
  });

  it('duplicidade é só aviso, com o motivo', () => {
    expect(textoDaDuplicidade(null)).toBeNull();
    expect(textoDaDuplicidade({ alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0 })).toBeNull();
    expect(textoDaDuplicidade({ alunoExistente: true, alunoId: 'x', outrasInscricoesAbertas: 0 })).toBe('Já existe um aluno com este e-mail.');
    expect(textoDaDuplicidade({ alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 2 })).toContain('outras 2 inscrições');
    expect(textoDaDuplicidade({ alunoExistente: true, alunoId: null, outrasInscricoesAbertas: 1 })).toContain('outra inscrição');
  });
});

describe('formulário público', () => {
  const ok = { ...INSCRICAO_VAZIA, nome: 'Pessoa Fictícia', whatsapp: '(11) 98765-4321' };

  it('nome e WhatsApp obrigatórios; e-mail opcional mas válido', () => {
    expect(errosDaInscricao(INSCRICAO_VAZIA, false, false)).toEqual({
      nome: 'Informe seu nome.',
      whatsapp: 'Informe o WhatsApp com DDD.',
    });
    expect(errosDaInscricao(ok, false, false)).toEqual({});
    expect(errosDaInscricao({ ...ok, whatsapp: '98765-4321' }, false, false).whatsapp).toContain('DDD');
    expect(errosDaInscricao({ ...ok, email: 'sem-arroba' }, false, false).email).toBe('E-mail inválido.');
    expect(errosDaInscricao({ ...ok, email: 'pessoa@exemplo.com' }, false, false)).toEqual({});
  });

  it('limites iguais aos da API e ciência quando a consultoria tem texto', () => {
    expect(errosDaInscricao({ ...ok, nome: 'a'.repeat(121) }, false, false).nome).toBeDefined();
    expect(errosDaInscricao({ ...ok, objetivo: 'a'.repeat(501) }, false, false).objetivo).toBeDefined();
    expect(errosDaInscricao({ ...ok, observacao: 'a'.repeat(1001) }, false, false).observacao).toBeDefined();
    expect(errosDaInscricao(ok, true, false).cienciaPrivacidade).toBeDefined();
    expect(errosDaInscricao(ok, true, true)).toEqual({});
  });

  it('corpo sem espaços nas pontas, vazio vira nulo e o token só quando há', () => {
    expect(corpoDaInscricao({ ...ok, email: '  ', objetivo: ' Força ' }, true, null)).toEqual({
      nome: 'Pessoa Fictícia',
      whatsapp: '(11) 98765-4321',
      email: null,
      objetivo: 'Força',
      observacao: null,
      cienciaPrivacidade: true,
      textoVersao: null,
    });
    expect(corpoDaInscricao(ok, false, 'tok').turnstileToken).toBe('tok');
    expect(corpoDaInscricao(ok, true, null, 'abc123').textoVersao).toBe('abc123');
  });
});

describe('anamnese no aceite', () => {
  const geral = { id: 'q-geral', nome: 'Anamnese geral', padrao: true };
  const esportiva = { id: 'q-esportiva', nome: 'Anamnese esportiva', padrao: false };

  it('já vem marcada a padrão; sem padrão (ou sem nenhuma), não enviar agora', () => {
    expect(anamneseInicialDoAceite([esportiva, geral])).toBe('q-geral');
    expect(anamneseInicialDoAceite([esportiva])).toBeNull();
    expect(anamneseInicialDoAceite([])).toBeNull();
  });

  it('opções: "Não enviar agora" primeiro e a padrão com o rótulo "(padrão)"', () => {
    expect(opcoesDeAnamneseDoAceite([esportiva, geral])).toEqual([
      { valor: null, rotulo: 'Não enviar agora' },
      { valor: 'q-esportiva', rotulo: 'Anamnese esportiva' },
      { valor: 'q-geral', rotulo: 'Anamnese geral (padrão)' },
    ]);
    expect(opcoesDeAnamneseDoAceite([])).toEqual([{ valor: null, rotulo: 'Não enviar agora' }]);
  });
});

describe('409 do aceite', () => {
  it('lê o aluno de ALUNO_JA_EXISTE e INSCRICAO_JA_ACEITA; outro erro não', () => {
    const campos = [{ field: 'alunoId', message: 'id-do-aluno' }];
    expect(alunoDoConflito(new ErroApi(409, 'ALUNO_JA_EXISTE', 'Já existe.', campos))).toBe('id-do-aluno');
    expect(alunoDoConflito(new ErroApi(409, 'INSCRICAO_JA_ACEITA', 'Já aceita.', campos))).toBe('id-do-aluno');
    expect(alunoDoConflito(new ErroApi(409, 'LIMITE_DO_PLANO', 'Limite.', [{ field: 'alunos_ativos', message: 'x' }]))).toBeNull();
    expect(alunoDoConflito(new ErroApi(409, 'INSCRICAO_JA_ACEITA', 'Já aceita.'))).toBeNull();
    expect(alunoDoConflito(new Error('x'))).toBeNull();
  });
});

describe('paginaQueSobra', () => {
  it('a segunda página esvaziou com 30 restantes: volta para a primeira', () => {
    expect(paginaQueSobra(1, { itens: [], total: 30 }, 30)).toBe(0);
  });
  it('fica onde está com itens, sem dados ou na primeira página', () => {
    expect(paginaQueSobra(1, { itens: [1], total: 31 }, 30)).toBe(1);
    expect(paginaQueSobra(2, undefined, 30)).toBe(2);
    expect(paginaQueSobra(0, { itens: [], total: 0 }, 30)).toBe(0);
  });
  it('lista toda vazia volta para a primeira; total maior volta para a última que existe', () => {
    expect(paginaQueSobra(3, { itens: [], total: 0 }, 30)).toBe(0);
    expect(paginaQueSobra(4, { itens: [], total: 61 }, 30)).toBe(2);
  });
});
