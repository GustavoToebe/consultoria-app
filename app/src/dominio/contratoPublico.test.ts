import { ErroApi } from '@plataforma/web';

import { codigoDoFragmento } from './linkDeConvite';
import {
  erroDoCpfDoResponsavel, erroDoNomeDoResponsavel, errosDaAssinatura, linkDoContrato, linkDoWhatsAppDoContrato, mensagemDoWhatsAppDoContrato,
  normalizarNome, tipoDoErroPublico,
} from './contratoPublico';

const erro = (status: number, codigo: string | null = null) => new ErroApi(status, codigo, 'x');

describe('link do contrato', () => {
  it('código no fragmento, com a origem da tela ou a de produção', () => {
    expect(linkDoContrato('abc_DEF-123', 'http://localhost:8088/')).toBe('http://localhost:8088/contrato#codigo=abc_DEF-123');
    expect(linkDoContrato('abc')).toBe('https://overtraining.app/contrato#codigo=abc');
  });

  it('o fragmento do link volta ao mesmo código (a leitura do convite)', () => {
    const link = linkDoContrato('Zx9_-a');
    expect(codigoDoFragmento(link.slice(link.indexOf('#')))).toBe('Zx9_-a');
    expect(codigoDoFragmento('')).toBe('');
  });

  it('WhatsApp: texto fixo e wa.me sem telefone', () => {
    const link = 'https://overtraining.app/contrato#codigo=abc';
    expect(mensagemDoWhatsAppDoContrato(link)).toBe(`Olá! Segue o link para assinar o contrato: ${link}`);
    const wa = linkDoWhatsAppDoContrato(link);
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa.slice('https://wa.me/?text='.length))).toBe(mensagemDoWhatsAppDoContrato(link));
  });
});

describe('formulário da assinatura', () => {
  it('nome: tira espaços sobrando e pede duas palavras', () => {
    expect(normalizarNome('  Maria   da  Silva ')).toBe('Maria da Silva');
    expect(erroDoNomeDoResponsavel('   ')).toBe('Escreva o nome completo do responsável.');
    expect(erroDoNomeDoResponsavel(' Maria ')).toBe('Escreva o nome e o sobrenome.');
    expect(erroDoNomeDoResponsavel('Maria Silva')).toBeUndefined();
  });

  it('CPF: vazio, dígito verificador errado e válido (com ou sem máscara)', () => {
    expect(erroDoCpfDoResponsavel('')).toBe('Digite o CPF do responsável.');
    expect(erroDoCpfDoResponsavel('529.982.247-24')).toBe('CPF inválido. Confira os números.');
    expect(erroDoCpfDoResponsavel('529.982.247-25')).toBeUndefined();
    expect(erroDoCpfDoResponsavel('52998224725')).toBeUndefined();
  });

  it('os três erros pelos nomes da API, e nenhum quando está tudo certo', () => {
    expect(errosDaAssinatura({ nome: 'Ana', aceite: false, declaroResponsavelLegal: false })).toEqual({
      nome: 'Escreva o nome e o sobrenome.',
      aceite: 'Marque que leu e concorda com o contrato.',
      declaroResponsavelLegal: 'Marque que você é o responsável legal do aluno.',
    });
    expect(errosDaAssinatura({ nome: 'Ana Souza', aceite: true, declaroResponsavelLegal: true })).toEqual({});
  });
});

describe('erros da API pública', () => {
  it('qualquer 404 e a chave desligada são o mesmo link indisponível', () => {
    expect(tipoDoErroPublico(erro(404, 'NAO_ENCONTRADO'))).toBe('indisponivel');
    expect(tipoDoErroPublico(erro(404))).toBe('indisponivel');
    expect(tipoDoErroPublico(erro(503, 'CONTRATOS_INDISPONIVEL'))).toBe('indisponivel');
  });

  it('limite, sem internet, CPF, contrato alterado, assinatura e o resto', () => {
    expect(tipoDoErroPublico(erro(429, 'LIMITE'))).toBe('limite');
    expect(tipoDoErroPublico(erro(0, 'SEM_CONEXAO'))).toBe('sem-internet');
    expect(tipoDoErroPublico(erro(422, 'CPF_NAO_CONFERE'))).toBe('cpf');
    expect(tipoDoErroPublico(erro(409, 'CONTRATO_ALTERADO'))).toBe('alterado');
    expect(tipoDoErroPublico(erro(422, 'ASSINATURA_INVALIDA'))).toBe('assinatura');
    expect(tipoDoErroPublico(erro(500))).toBe('outro');
    expect(tipoDoErroPublico(new Error('x'))).toBe('outro');
  });
});
