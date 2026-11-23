import { ErroApi, MENSAGEM_SEM_CONEXAO as SEM_CONEXAO_DA_API } from '@plataforma/web';

import type { ResponsavelFinanceiro } from '../api/financeiroResponsavel';
import {
  acoesDoResponsavel, corpoDoResponsavel, errosDoResponsavel, formDoResponsavel, houveMudanca, linhaDoResponsavel, MENSAGEM_ANONIMIZADO,
  MENSAGEM_CONFIRA, MENSAGEM_CONFLITO, MENSAGEM_NAO_ENCONTRADO, MENSAGEM_SEM_CONEXAO, SEM_RESPONSAVEL_NA_RESPOSTA, temResponsavel, traduzirErroDoResponsavel,
} from './responsavelFinanceiro';

// Só dados fictícios.
const GRAVADO: ResponsavelFinanceiro = {
  nome: 'Responsável Teste', parentesco: 'Mãe', cpf: '529.982.247-25', telefone: '(45) 99999-8888', email: 'responsavel@exemplo.invalid',
  versao: 3, atualizadoEm: '2026-11-18T12:00:00Z',
};
const VAZIO = { nome: '', parentesco: '', cpf: '', telefone: '', email: '' };

describe('temResponsavel e ações do cartão', () => {
  it('versão nula é "não tem"', () => {
    expect(temResponsavel(SEM_RESPONSAVEL_NA_RESPOSTA)).toBe(false);
    expect(temResponsavel(GRAVADO)).toBe(true);
    expect(temResponsavel(undefined)).toBe(false);
  });
  it('só com permissão, e só depois de a leitura chegar; remover só quando há responsável', () => {
    expect(acoesDoResponsavel(false, GRAVADO)).toEqual({ editar: null, remover: false });
    expect(acoesDoResponsavel(true, undefined)).toEqual({ editar: null, remover: false });
    expect(acoesDoResponsavel(true, SEM_RESPONSAVEL_NA_RESPOSTA)).toEqual({ editar: 'Adicionar responsável', remover: false });
    expect(acoesDoResponsavel(true, GRAVADO)).toEqual({ editar: 'Editar responsável', remover: true });
  });
});

describe('linhaDoResponsavel', () => {
  // ficha do aluno: dados (23/11)
  it('o que falta some da linha; o CPF só com a permissão de vê-lo', () => {
    expect(linhaDoResponsavel({ ...GRAVADO, parentesco: null, email: '  ', cpf: null }, true))
      .toEqual({ quem: 'Responsável Teste', contato: '(45) 99999-8888', cpf: null });
    expect(linhaDoResponsavel({ ...GRAVADO, parentesco: 'Mãe', email: 'r@exemplo.test', cpf: '529.982.247-25' }, true))
      .toEqual({ quem: 'Responsável Teste · Mãe', contato: '(45) 99999-8888 · r@exemplo.test', cpf: '529.982.247-25' });
    expect(linhaDoResponsavel({ ...GRAVADO, cpf: '529.982.247-25' }, false).cpf).toBeNull();
    expect(linhaDoResponsavel({ ...GRAVADO, telefone: null, email: null }, true).contato).toBeNull();
  });
});

describe('formulário', () => {
  it('nasce com tudo o que o GET trouxe (o PUT substitui tudo) e vazio sem responsável', () => {
    expect(formDoResponsavel(GRAVADO)).toEqual({ nome: 'Responsável Teste', parentesco: 'Mãe', cpf: '529.982.247-25', telefone: '(45) 99999-8888', email: 'responsavel@exemplo.invalid' });
    expect(formDoResponsavel(SEM_RESPONSAVEL_NA_RESPOSTA)).toEqual(VAZIO);
  });
  it('mudança ignora espaços nas pontas', () => {
    expect(houveMudanca({ ...formDoResponsavel(GRAVADO), nome: ' Responsável Teste ' }, GRAVADO)).toBe(false);
    expect(houveMudanca({ ...formDoResponsavel(GRAVADO), parentesco: 'Pai' }, GRAVADO)).toBe(true);
    expect(houveMudanca(VAZIO, SEM_RESPONSAVEL_NA_RESPOSTA)).toBe(false);
  });
});

describe('errosDoResponsavel (espelho do ResponsavelFinanceiroService)', () => {
  it('nome obrigatório e até 120 depois de aparar; parentesco até 30', () => {
    expect(errosDoResponsavel({ ...VAZIO, nome: '   ' }, true)).toEqual({ nome: 'Informe o nome do responsável.' });
    expect(errosDoResponsavel({ ...VAZIO, nome: ` ${'a'.repeat(120)} ` }, true)).toEqual({});
    expect(errosDoResponsavel({ ...VAZIO, nome: 'a'.repeat(121) }, true)).toEqual({ nome: 'O nome pode ter até 120 caracteres.' });
    expect(errosDoResponsavel({ ...VAZIO, nome: 'X', parentesco: 'p'.repeat(31) }, true)).toEqual({ parentesco: 'O parentesco pode ter até 30 caracteres.' });
  });
  it('CPF, telefone e e-mail opcionais; preenchidos, conferidos sem repetir o valor', () => {
    const erros = errosDoResponsavel({ nome: 'X', parentesco: '', cpf: '111.111.111-11', telefone: '(45) 9', email: 'sem-arroba' }, true);
    expect(erros).toEqual({ cpf: 'CPF inválido.', telefone: 'Telefone inválido. Informe o DDD e o número.', email: 'E-mail inválido.' });
    expect(Object.values(erros).join(' ')).not.toMatch(/111|sem-arroba|\(45\)/);
    expect(errosDoResponsavel({ ...VAZIO, nome: 'X', email: `${'a'.repeat(250)}@x.io` }, true)).toEqual({ email: 'E-mail inválido.' });
  });
  it('sem a permissão de ver o CPF, o campo nem é conferido (não está na tela e a API o ignora)', () => {
    expect(errosDoResponsavel({ ...VAZIO, nome: 'X', cpf: '111' }, false)).toEqual({});
  });
});

describe('corpoDoResponsavel', () => {
  it('apara, vazio vira nulo (apaga) e leva a versão; sem a permissão o CPF vai nulo', () => {
    const form = { nome: ' Responsável Teste ', parentesco: ' ', cpf: '529.982.247-25', telefone: '', email: ' r@exemplo.invalid ' };
    expect(corpoDoResponsavel(form, null, true)).toEqual({ nome: 'Responsável Teste', parentesco: null, cpf: '529.982.247-25', telefone: null, email: 'r@exemplo.invalid', versao: null });
    expect(corpoDoResponsavel(form, 3, false)).toMatchObject({ cpf: null, versao: 3 });
  });
});

describe('traduzirErroDoResponsavel', () => {
  it('422 vai a cada campo; campo fora da tela (CPF sem a permissão) vai ao texto geral', () => {
    const e = new ErroApi(422, 'RESPONSAVEL_INVALIDO', 'Confira.', [
      { field: 'nome', message: 'Informe o nome do responsável.' }, { field: 'email', message: 'E-mail inválido.' }, { field: 'cpf', message: 'CPF inválido.' },
    ]);
    expect(traduzirErroDoResponsavel(e, true)).toEqual({
      mensagem: MENSAGEM_CONFIRA, campos: { nome: 'Informe o nome do responsável.', email: 'E-mail inválido.', cpf: 'CPF inválido.' }, recarregar: false, esconder: false,
    });
    expect(traduzirErroDoResponsavel(e, false)).toMatchObject({ mensagem: 'CPF inválido.', campos: { nome: 'Informe o nome do responsável.', email: 'E-mail inválido.' } });
  });
  it('409 recarrega; 503 esconde; 404 e sem conexão avisam', () => {
    expect(traduzirErroDoResponsavel(new ErroApi(409, 'CONFLITO_EDICAO', 'x'), true)).toMatchObject({ mensagem: MENSAGEM_CONFLITO, recarregar: true });
    expect(traduzirErroDoResponsavel(new ErroApi(409, 'ALUNO_ANONIMIZADO', 'x'), true)).toMatchObject({ mensagem: MENSAGEM_ANONIMIZADO, recarregar: true });
    expect(traduzirErroDoResponsavel(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'Desligado.'), true)).toMatchObject({ esconder: true });
    expect(traduzirErroDoResponsavel(new ErroApi(404, 'NAO_ENCONTRADO', 'x'), true).mensagem).toBe(MENSAGEM_NAO_ENCONTRADO);
    expect(traduzirErroDoResponsavel(new ErroApi(0, null, SEM_CONEXAO_DA_API), true).mensagem).toBe(MENSAGEM_SEM_CONEXAO);
    expect(traduzirErroDoResponsavel(new ErroApi(403, 'PERMISSAO_NEGADA', 'Sem permissão.'), true).mensagem).toBe('Sem permissão.');
  });
});
