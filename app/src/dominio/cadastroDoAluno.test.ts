import {
  enderecoDaResposta, enderecoParaEnvio, enderecoParaForm, enderecoParaLeitura, ENDERECO_VAZIO, erroDoCpf, erroDoTelefone, errosDoEndereco,
  mascaraCep, mascaraCpf, mascaraTelefone, respostaDeEndereco,
} from './cadastroDoAluno';

// Só dados de teste: 529.982.247-25 é um CPF válido de exemplo (dígitos verificadores corretos), sem dono.
const CPF_DE_TESTE = '529.982.247-25';
const ENDERECO = { cep: '01310-100', logradouro: 'Rua Exemplo', numero: '100', complemento: 'Sala 2', bairro: 'Centro', cidade: 'Cidade Exemplo', uf: 'SP' };

describe('máscaras', () => {
  it('CPF e CEP com máscara enquanto digita, só dígitos e no tamanho certo', () => {
    expect(mascaraCpf('52998224725')).toBe(CPF_DE_TESTE);
    expect(mascaraCpf('529.982.247-25999')).toBe(CPF_DE_TESTE);
    expect(mascaraCpf('abc')).toBe('');
    expect(mascaraCep('01310100')).toBe('01310-100');
    expect(mascaraCep('01310-100999')).toBe('01310-100');
  });
  it('telefone com DDD', () => {
    expect(mascaraTelefone('45999998888')).toBe('(45) 99999-8888');
  });
});

describe('validação do que o formulário mostra (a API decide de verdade)', () => {
  it('CPF vazio é válido; preenchido precisa dos dígitos verificadores', () => {
    expect(erroDoCpf('')).toBeUndefined();
    expect(erroDoCpf(CPF_DE_TESTE)).toBeUndefined();
    expect(erroDoCpf('529.982.247-26')).toBe('CPF inválido.');
    expect(erroDoCpf('111.111.111-11')).toBe('CPF inválido.');
  });
  it('telefone vazio é válido; preenchido precisa de DDD', () => {
    expect(erroDoTelefone('')).toBeUndefined();
    expect(erroDoTelefone('(45) 99999-8888')).toBeUndefined();
    expect(erroDoTelefone('9999')).toMatch(/Telefone inválido/);
  });
  it('endereço: CEP de 8 dígitos e UF da lista só quando preenchidos', () => {
    expect(errosDoEndereco(ENDERECO_VAZIO)).toEqual({});
    expect(errosDoEndereco(enderecoParaForm(ENDERECO))).toEqual({});
    expect(errosDoEndereco({ ...ENDERECO_VAZIO, cep: '123' }).cep).toMatch(/CEP inválido/);
    expect(errosDoEndereco({ ...ENDERECO_VAZIO, uf: 'XX' }).uf).toBeDefined();
    expect(errosDoEndereco({ ...ENDERECO_VAZIO, uf: 'sp' })).toEqual({});
  });
});

describe('endereço no formulário e no envio', () => {
  it('da API para o formulário: nulo e ausente viram vazio', () => {
    expect(enderecoParaForm(null)).toEqual(ENDERECO_VAZIO);
    expect(enderecoParaForm({ cep: '01310-100', uf: null })).toEqual({ ...ENDERECO_VAZIO, cep: '01310-100' });
  });
  it('do formulário para o envio: vazio vira null, tudo vazio vira sem endereço, CEP com máscara e UF em maiúsculas', () => {
    expect(enderecoParaEnvio(ENDERECO_VAZIO)).toBeNull();
    expect(enderecoParaEnvio({ ...ENDERECO_VAZIO, cep: '01310100', uf: 'sp', bairro: '  Centro ' })).toEqual({
      cep: '01310-100', logradouro: null, numero: null, complemento: null, bairro: 'Centro', cidade: null, uf: 'SP',
    });
  });
  it('resposta da anamnese: só as chaves preenchidas, texto como digitado; nada preenchido = sem resposta', () => {
    expect(respostaDeEndereco(ENDERECO_VAZIO)).toBeNull();
    expect(respostaDeEndereco({ ...ENDERECO_VAZIO, logradouro: 'Rua ', numero: '5' })).toEqual({ logradouro: 'Rua ', numero: '5' });
  });
  it('leitura da resposta e do cadastro: duas linhas sem partes vazias', () => {
    expect(enderecoParaLeitura(null)).toBeNull();
    expect(enderecoParaLeitura(enderecoDaResposta({}))).toBeNull();
    expect(enderecoParaLeitura(ENDERECO)).toBe('Rua Exemplo, 100 - Sala 2 - Centro\nCidade Exemplo/SP - 01310-100');
    expect(enderecoDaResposta('texto')).toBeNull();
    expect(enderecoDaResposta({ cidade: ' Cidade Exemplo ', uf: '', desconhecido: 'x' })).toMatchObject({ cidade: 'Cidade Exemplo', uf: null });
  });
});
