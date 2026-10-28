import { ErroApi } from '@plataforma/web';

import type { MeusDadosResponse } from '../api/tipos';
import { CPF_EM_USO, ENDERECO_VAZIO, MENSAGEM_CPF_EM_USO } from './cadastroDoAluno';
import {
  corpoDoPut, cpfEditavel, ehConflitoDeEdicao, errosDoForm, errosDoServidor, formDeMeusDados, houveMudanca, MENSAGEM_ANONIMIZADO,
  MENSAGEM_CAMPOS_INVALIDOS, MENSAGEM_CONFLITO, MENSAGEM_CPF_SO_PELO_TREINADOR, mensagemDeErroMeusDados, temErros, TEXTO_SO_LEITURA,
} from './meusDados';

// Só dados de teste: 529.982.247-25 é um CPF válido de exemplo (dígitos verificadores corretos), sem dono.
const CPF_DE_TESTE = '529.982.247-25';
const ENDERECO = { cep: '01310-100', logradouro: 'Rua Exemplo', numero: '100', complemento: 'Sala 2', bairro: 'Centro', cidade: 'Cidade Exemplo', uf: 'SP' };

const RESP: MeusDadosResponse = {
  nome: 'Aluno Exemplo', email: 'aluno@exemplo.test', emailDeAcesso: 'acesso@exemplo.test',
  telefone: '(45) 99999-8888', cpf: null, endereco: ENDERECO, sexo: 'FEMININO', versao: 3,
};
const SEM_NADA: MeusDadosResponse = { nome: 'Aluno Exemplo', email: 'aluno@exemplo.test', versao: 0 };

const erroApi = (status: number, codigo: string | null, campos: { field: string; message: string }[] = []) =>
  new ErroApi(status, codigo, 'Mensagem do servidor com 529.982.247-25', campos);

describe('texto de só leitura', () => {
  it('é o mesmo para nome, e-mail e e-mail de acesso', () => {
    expect(TEXTO_SO_LEITURA).toBe('Para mudar, fale com o seu treinador.');
  });
});

describe('formDeMeusDados', () => {
  it('traz os dados com máscara', () => {
    expect(formDeMeusDados({ ...RESP, telefone: '45999998888', cpf: '52998224725' })).toEqual({
      telefone: '(45) 99999-8888', cpf: CPF_DE_TESTE, endereco: ENDERECO, sexo: 'FEMININO',
    });
  });
  it('ausente e nulo viram vazio; sexo inválido vira "Não informado"', () => {
    expect(formDeMeusDados(SEM_NADA)).toEqual({ telefone: '', cpf: '', endereco: ENDERECO_VAZIO, sexo: '' });
    expect(formDeMeusDados({ ...RESP, sexo: 'XYZ', endereco: null }).sexo).toBe('');
  });
});

describe('cpfEditavel', () => {
  it('só quando o CPF está vazio no servidor', () => {
    expect(cpfEditavel(SEM_NADA)).toBe(true);
    expect(cpfEditavel({ ...RESP, cpf: null })).toBe(true);
    expect(cpfEditavel({ ...RESP, cpf: '  ' })).toBe(true);
    expect(cpfEditavel({ ...RESP, cpf: CPF_DE_TESTE })).toBe(false);
  });
});

describe('corpoDoPut', () => {
  it('leva a versão da resposta e os campos do formulário', () => {
    const form = { ...formDeMeusDados(RESP), telefone: '45988887777', sexo: 'MASCULINO' };
    expect(corpoDoPut(form, RESP)).toEqual({
      telefone: '(45) 98888-7777', cpf: null, endereco: ENDERECO, sexo: 'MASCULINO', versao: 3,
    });
  });
  it('telefone em branco apaga, endereço vazio apaga, sexo vazio = não informado', () => {
    const form = { telefone: '  ', cpf: '', endereco: ENDERECO_VAZIO, sexo: '' };
    expect(corpoDoPut(form, RESP)).toEqual({ telefone: null, cpf: null, endereco: null, sexo: null, versao: 3 });
  });
  it('endereço sai normalizado (espaços, CEP com máscara, UF em maiúsculas)', () => {
    const form = { ...formDeMeusDados(RESP), endereco: { ...ENDERECO, cep: '01310100', logradouro: ' Rua Exemplo ', uf: 'sp', bairro: '   ' } };
    expect(corpoDoPut(form, RESP).endereco).toEqual({ ...ENDERECO, logradouro: 'Rua Exemplo', bairro: null });
  });
  it('CPF só vai se editável e preenchido', () => {
    const vazio = { ...formDeMeusDados(SEM_NADA), cpf: '52998224725' };
    expect(corpoDoPut(vazio, SEM_NADA).cpf).toBe(CPF_DE_TESTE);
    expect(corpoDoPut({ ...vazio, cpf: '' }, SEM_NADA).cpf).toBeNull();
    // Preenchido no servidor: o que estiver no campo é ignorado.
    const preenchido = { ...RESP, cpf: CPF_DE_TESTE };
    expect(corpoDoPut({ ...formDeMeusDados(preenchido), cpf: '111.444.777-35' }, preenchido).cpf).toBeNull();
  });
  it('sexo desconhecido não vai', () => {
    expect(corpoDoPut({ ...formDeMeusDados(RESP), sexo: 'XYZ' }, RESP).sexo).toBeNull();
  });
});

describe('errosDoForm', () => {
  it('formulário certo não tem erro', () => {
    const erros = errosDoForm(formDeMeusDados(RESP), RESP);
    expect(erros).toEqual({ endereco: {} });
    expect(temErros(erros)).toBe(false);
    expect(temErros(errosDoForm(formDeMeusDados(SEM_NADA), SEM_NADA))).toBe(false);
  });
  it('telefone sem DDD', () => {
    const erros = errosDoForm({ ...formDeMeusDados(RESP), telefone: '9999' }, RESP);
    expect(erros.telefone).toMatch(/Telefone inválido/);
    expect(temErros(erros)).toBe(true);
  });
  it('CPF inválido só conta quando editável', () => {
    const form = { ...formDeMeusDados(SEM_NADA), cpf: '529.982.247-26' };
    expect(errosDoForm(form, SEM_NADA).cpf).toBe('CPF inválido.');
    expect(errosDoForm(form, { ...SEM_NADA, cpf: CPF_DE_TESTE }).cpf).toBeUndefined();
  });
  it('endereço parcial pede os campos obrigatórios', () => {
    const erros = errosDoForm({ ...formDeMeusDados(RESP), endereco: { ...ENDERECO_VAZIO, bairro: 'Centro' } }, RESP);
    expect(Object.keys(erros.endereco).sort()).toEqual(['cep', 'cidade', 'logradouro', 'numero', 'uf']);
    expect(temErros(erros)).toBe(true);
  });
});

describe('houveMudanca', () => {
  it('sem mexer, não há mudança', () => {
    expect(houveMudanca(formDeMeusDados(RESP), RESP)).toBe(false);
    expect(houveMudanca(formDeMeusDados(SEM_NADA), SEM_NADA)).toBe(false);
  });
  it('máscara e espaços não contam', () => {
    const form = { ...formDeMeusDados(RESP), telefone: '45999998888', endereco: { ...ENDERECO, cep: '01310100', logradouro: ' Rua Exemplo ' } };
    expect(houveMudanca(form, RESP)).toBe(false);
  });
  it('telefone, sexo e endereço mudados', () => {
    const base = formDeMeusDados(RESP);
    expect(houveMudanca({ ...base, telefone: '' }, RESP)).toBe(true);
    expect(houveMudanca({ ...base, telefone: '(45) 98888-7777' }, RESP)).toBe(true);
    expect(houveMudanca({ ...base, sexo: '' }, RESP)).toBe(true);
    expect(houveMudanca({ ...base, sexo: 'OUTRO' }, RESP)).toBe(true);
    expect(houveMudanca({ ...base, endereco: { ...ENDERECO, numero: '101' } }, RESP)).toBe(true);
    expect(houveMudanca({ ...base, endereco: ENDERECO_VAZIO }, RESP)).toBe(true);
  });
  it('CPF digitado conta só quando editável', () => {
    expect(houveMudanca({ ...formDeMeusDados(SEM_NADA), cpf: '5' }, SEM_NADA)).toBe(true);
    const preenchido = { ...RESP, cpf: CPF_DE_TESTE };
    expect(houveMudanca({ ...formDeMeusDados(preenchido), cpf: '111.444.777-35' }, preenchido)).toBe(false);
  });
});

describe('errosDoServidor', () => {
  it('mapeia os campos do 422 ALUNO_INVALIDO para as chaves do formulário', () => {
    const erro = erroApi(422, 'ALUNO_INVALIDO', [
      { field: 'telefone', message: 'Telefone inválido.' },
      { field: 'cpf', message: 'CPF inválido.' },
      { field: 'sexo', message: 'Sexo inválido.' },
      { field: 'endereco.cep', message: 'CEP inválido.' },
      { field: 'endereco.uf', message: 'Escolha a UF.' },
      { field: 'outro', message: 'ignorado' },
    ]);
    expect(errosDoServidor(erro)).toEqual({
      telefone: 'Telefone inválido.', cpf: 'CPF inválido.', sexo: 'Sexo inválido.', endereco: { cep: 'CEP inválido.', uf: 'Escolha a UF.' },
    });
  });
  it('erro sem campos, ou que nem é da API, não tem erro de campo', () => {
    expect(errosDoServidor(erroApi(409, 'CONFLITO_EDICAO'))).toEqual({ endereco: {} });
    expect(errosDoServidor(new Error('x'))).toEqual({ endereco: {} });
    expect(errosDoServidor(null)).toEqual({ endereco: {} });
  });
});

describe('mensagemDeErroMeusDados', () => {
  it('textos em português para cada código, sem o valor digitado nem a mensagem do servidor', () => {
    expect(mensagemDeErroMeusDados(erroApi(409, 'CONFLITO_EDICAO'))).toBe(MENSAGEM_CONFLITO);
    expect(MENSAGEM_CONFLITO).toBe('Seus dados foram atualizados por outra pessoa. Mostramos os dados mais recentes.');
    expect(mensagemDeErroMeusDados(erroApi(409, CPF_EM_USO))).toBe(MENSAGEM_CPF_EM_USO);
    expect(mensagemDeErroMeusDados(erroApi(409, 'CPF_SO_PELO_TREINADOR'))).toBe(MENSAGEM_CPF_SO_PELO_TREINADOR);
    expect(MENSAGEM_CPF_SO_PELO_TREINADOR).toBe('Este CPF só pode ser alterado pelo seu treinador.');
    expect(mensagemDeErroMeusDados(erroApi(409, 'ALUNO_ANONIMIZADO'))).toBe(MENSAGEM_ANONIMIZADO);
    expect(mensagemDeErroMeusDados(erroApi(422, 'ALUNO_INVALIDO', [{ field: 'cpf', message: 'CPF inválido.' }]))).toBe(MENSAGEM_CAMPOS_INVALIDOS);
  });
  it('fallback fixo; sem conexão usa o texto de sem conexão', () => {
    const generico = mensagemDeErroMeusDados(erroApi(500, null));
    expect(generico).toBe('Não foi possível salvar seus dados. Tente de novo.');
    expect(generico).not.toContain('529');
    expect(mensagemDeErroMeusDados(new Error('x'))).toBe(generico);
    expect(mensagemDeErroMeusDados(new ErroApi(0, null, 'Sem conexão com o servidor. Confira a internet e tente de novo.'))).toMatch(/Sem conexão/);
  });
  it('nenhuma mensagem fixa traz o CPF de teste', () => {
    for (const e of [erroApi(409, 'CONFLITO_EDICAO'), erroApi(409, CPF_EM_USO), erroApi(409, 'CPF_SO_PELO_TREINADOR'), erroApi(409, 'ALUNO_ANONIMIZADO'), erroApi(500, null)]) {
      expect(mensagemDeErroMeusDados(e)).not.toContain('529');
    }
  });
});

describe('ehConflitoDeEdicao', () => {
  it('só o 409 CONFLITO_EDICAO', () => {
    expect(ehConflitoDeEdicao(erroApi(409, 'CONFLITO_EDICAO'))).toBe(true);
    expect(ehConflitoDeEdicao(erroApi(409, CPF_EM_USO))).toBe(false);
    expect(ehConflitoDeEdicao(new Error('x'))).toBe(false);
  });
});
