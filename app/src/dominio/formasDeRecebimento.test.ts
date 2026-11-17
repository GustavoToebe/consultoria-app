import { ErroApi, MENSAGEM_SEM_CONEXAO } from '@plataforma/web';

import type { FormasDeRecebimento } from '../api/financeiroTipos';
import {
  contadorDoPix, corpoDasFormas, estadoDasFormas, FORMAS_DO_FORMULARIO, formasAlteradas, lerLinkDoPlano, mascaraDaChavePix, MENSAGEM_CONFLITO_DAS_FORMAS, normalizarChavePix,
  rotuloDaFormaDeRecebimento, textoDaChaveGravada, traduzirErroDasFormas, type EstadoDasFormas,
} from './formasDeRecebimento';

// Documentos de teste (dígitos verificadores válidos, ninguém real): CPF 529.982.247-25, CNPJ 11.222.333/0001-81.
const CPF = '529.982.247-25';
const CNPJ = '11.222.333/0001-81';
const UUID = '123E4567-E89B-12D3-A456-426614174000';

const resposta = (extra: Partial<FormasDeRecebimento> = {}): FormasDeRecebimento => ({
  infinitePay: true, linkProprio: false, pix: false, manual: true, pixConfig: null, versao: 3, ...extra,
});
const estado = (extra: Partial<EstadoDasFormas> = {}): EstadoDasFormas => ({ ...estadoDasFormas(resposta()), ...extra });
const comPix = (extra: Partial<EstadoDasFormas> = {}) =>
  estado({ pix: true, tipoChave: 'EMAIL', chave: 'treinador@exemplo.com', nomeRecebedor: 'Treino Teste', cidade: 'Cascavel', ...extra });

describe('estado do formulário', () => {
  it('sem resposta vale o padrão do servidor: InfinitePay ligada, o resto desligado, sem versão', () => {
    expect(estadoDasFormas(null)).toMatchObject({ infinitePay: true, linkProprio: false, pix: false, versao: null, chave: '', chaveConfigurada: false });
  });
  it('a chave nunca vem preenchida: só a máscara e o "configurada"', () => {
    const e = estadoDasFormas(resposta({
      pix: true, pixConfig: { tipoChave: 'CPF', chaveMascarada: '***.982.247-**', chaveConfigurada: true, nomeRecebedor: 'Treino', cidade: 'Cascavel' },
    }));
    expect(e).toMatchObject({ chave: '', chaveConfigurada: true, chaveMascarada: '***.982.247-**', tipoChave: 'CPF', tipoChaveGravado: 'CPF', nomeRecebedor: 'Treino', versao: 3 });
    expect(textoDaChaveGravada(e)).toBe('Chave gravada: ***.982.247-**. Deixe em branco para manter.');
    expect(textoDaChaveGravada(estado())).toBeNull();
  });
  it('rótulos: o Manual é a forma fixa', () => {
    expect(FORMAS_DO_FORMULARIO.map((f) => f.valor)).toEqual(['INFINITEPAY', 'LINK_PROPRIO', 'PIX', 'MANUAL']);
    expect(FORMAS_DO_FORMULARIO.filter((f) => f.fixa).map((f) => f.valor)).toEqual(['MANUAL']);
    expect(rotuloDaFormaDeRecebimento('PIX')).toBe('Pix copia e cola');
    expect(rotuloDaFormaDeRecebimento(null)).toBe('—');
  });
});

describe('corpoDasFormas', () => {
  it('Pix desligado: o Manual vai ligado e não vai pixConfig', () => {
    expect(corpoDasFormas(estado({ infinitePay: false, linkProprio: true }))).toEqual({
      ok: true, corpo: { infinitePay: false, linkProprio: true, pix: false, manual: true, versao: 3 },
    });
  });
  it('Pix ligado: tipo, chave digitada, nome e cidade (sem as pontas)', () => {
    expect(corpoDasFormas(comPix({ nomeRecebedor: ' Treino Teste ', cidade: ' Cascavel ' }))).toEqual({
      ok: true,
      corpo: {
        infinitePay: true, linkProprio: false, pix: true, manual: true, versao: 3,
        pixConfig: { tipoChave: 'EMAIL', chave: 'treinador@exemplo.com', nomeRecebedor: 'Treino Teste', cidade: 'Cascavel' },
      },
    });
  });
  it('a chave só vai quando digitada: a já gravada, com o mesmo tipo, fica sem o campo', () => {
    const r = corpoDasFormas(comPix({ tipoChave: 'CPF', chave: '', chaveConfigurada: true, tipoChaveGravado: 'CPF', chaveMascarada: '***.982.247-**' }));
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.corpo.pixConfig).toEqual({ tipoChave: 'CPF', nomeRecebedor: 'Treino Teste', cidade: 'Cascavel' });
    expect(JSON.stringify(r)).not.toContain('chave"');
  });
  it('trocar o tipo da chave gravada pede a chave nova; sem chave gravada, também', () => {
    expect(corpoDasFormas(comPix({ tipoChave: 'EMAIL', chave: '', chaveConfigurada: true, tipoChaveGravado: 'CPF' }))).toEqual({
      ok: false, erros: { chave: 'Você mudou o tipo: informe a chave deste tipo.' },
    });
    expect(corpoDasFormas(comPix({ chave: '' }))).toEqual({ ok: false, erros: { chave: 'Informe a chave Pix.' } });
  });
  it('Pix ligado exige tipo, nome (até 25) e cidade (até 15)', () => {
    expect(corpoDasFormas(comPix({ tipoChave: null }))).toMatchObject({ ok: false, erros: { tipoChave: 'Escolha o tipo da chave.' } });
    expect(corpoDasFormas(comPix({ nomeRecebedor: '  ', cidade: '' }))).toMatchObject({ ok: false, erros: { nomeRecebedor: 'Informe o nome de quem recebe.', cidade: 'Informe a cidade.' } });
    expect(corpoDasFormas(comPix({ nomeRecebedor: 'x'.repeat(25), cidade: 'y'.repeat(15) })).ok).toBe(true);
    expect(corpoDasFormas(comPix({ nomeRecebedor: 'x'.repeat(26) }))).toMatchObject({ erros: { nomeRecebedor: 'O nome pode ter até 25 caracteres.' } });
    expect(corpoDasFormas(comPix({ cidade: 'y'.repeat(16) }))).toMatchObject({ erros: { cidade: 'A cidade pode ter até 15 caracteres.' } });
  });
  it('nenhuma mensagem repete a chave digitada', () => {
    for (const [tipoChave, chave] of [['CPF', '111.111.111-11'], ['CNPJ', '11.111.111/1111-11'], ['EMAIL', 'sem-arroba'], ['TELEFONE', '123'], ['ALEATORIA', 'nao-e-uuid']] as const) {
      const r = corpoDasFormas(comPix({ tipoChave, chave }));
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r)).not.toContain(chave);
    }
  });
});

describe('chave Pix por tipo', () => {
  it('CPF e CNPJ: dígito verificador, só os caracteres no corpo', () => {
    expect(normalizarChavePix('CPF', CPF)).toBe('52998224725');
    expect(normalizarChavePix('CPF', '52998224725')).toBe('52998224725');
    expect(normalizarChavePix('CPF', '529.982.247-26')).toBeNull();
    expect(normalizarChavePix('CPF', '111.111.111-11')).toBeNull();
    expect(normalizarChavePix('CNPJ', CNPJ)).toBe('11222333000181');
    expect(normalizarChavePix('CNPJ', '11.222.333/0001-82')).toBeNull();
    expect(normalizarChavePix('CNPJ', CPF)).toBeNull();
  });
  it('e-mail: formato válido, minúsculas, até 77', () => {
    expect(normalizarChavePix('EMAIL', ' Treino@Exemplo.com ')).toBe('treino@exemplo.com');
    expect(normalizarChavePix('EMAIL', 'sem-arroba')).toBeNull();
    expect(normalizarChavePix('EMAIL', 'sem@ponto')).toBeNull();
    expect(normalizarChavePix('EMAIL', `${'a'.repeat(70)}@exemplo.com`)).toBeNull();
  });
  it('telefone BR: com DDD, vira +55', () => {
    expect(normalizarChavePix('TELEFONE', '(45) 99999-8888')).toBe('+5545999998888');
    expect(normalizarChavePix('TELEFONE', '+55 45 99999-8888')).toBe('+5545999998888');
    expect(normalizarChavePix('TELEFONE', '4532221111')).toBe('+554532221111');
    expect(normalizarChavePix('TELEFONE', '99999-8888')).toBeNull();
    expect(normalizarChavePix('TELEFONE', '(45) 89999-8888')).toBeNull();
  });
  it('aleatória: UUID em minúsculas', () => {
    expect(normalizarChavePix('ALEATORIA', UUID)).toBe(UUID.toLowerCase());
    expect(normalizarChavePix('ALEATORIA', '123e4567-e89b-12d3-a456')).toBeNull();
    expect(normalizarChavePix('ALEATORIA', `${UUID}0`)).toBeNull();
  });
  it('tipo desconhecido não vale', () => {
    expect(normalizarChavePix('OUTRO' as never, 'x')).toBeNull();
  });
});

describe('link de pagamento do plano', () => {
  it('vazio apaga; https vale; o resto é recusado', () => {
    expect(lerLinkDoPlano('   ')).toEqual({ valor: null, erro: null });
    expect(lerLinkDoPlano(' https://pagamento.exemplo.com/plano?id=1 ')).toEqual({ valor: 'https://pagamento.exemplo.com/plano?id=1', erro: null });
    for (const ruim of ['http://exemplo.com', 'exemplo.com/pagar', 'https://', 'https://exemplo .com', 'javascript:alert(1)', 'ftp://exemplo.com']) {
      expect(lerLinkDoPlano(ruim)).toEqual({ valor: null, erro: 'O link precisa começar com https://.' });
    }
  });
  it('até 500 caracteres', () => {
    expect(lerLinkDoPlano(`https://exemplo.com/${'a'.repeat(480)}`).erro).toBeNull();
    expect(lerLinkDoPlano(`https://exemplo.com/${'a'.repeat(481)}`).erro).toBe('O link pode ter até 500 caracteres.');
  });
});

describe('traduzirErroDasFormas', () => {
  it('409 CONFLITO_EDICAO recarrega', () => {
    expect(traduzirErroDasFormas(new ErroApi(409, 'CONFLITO_EDICAO', 'x'))).toEqual({ mensagem: MENSAGEM_CONFLITO_DAS_FORMAS, campos: {}, recarregar: true });
  });
  it('422 FORMAS_INVALIDAS por campo, com ou sem o prefixo pixConfig', () => {
    const e = new ErroApi(422, 'FORMAS_INVALIDAS', 'Dados inválidos.', [
      { field: 'pixConfig.chave', message: 'A chave não vale para o tipo.' },
      { field: 'pixConfig.cidade', message: 'A cidade pode ter até 15 caracteres.' },
      { field: 'nomeRecebedor', message: 'Informe o nome.' },
    ]);
    expect(traduzirErroDasFormas(e)).toEqual({
      mensagem: 'Confira os campos destacados.', recarregar: false,
      campos: { chave: 'A chave não vale para o tipo.', cidade: 'A cidade pode ter até 15 caracteres.', nomeRecebedor: 'Informe o nome.' },
    });
  });
  it('campo que a tela não mostra vai ao texto geral (pix sem pixConfig)', () => {
    expect(traduzirErroDasFormas(new ErroApi(422, 'FORMAS_INVALIDAS', 'x', [{ field: 'pixConfig', message: 'Informe os dados do Pix.' }]))).toMatchObject({ mensagem: 'Informe os dados do Pix.', campos: {} });
    expect(traduzirErroDasFormas(new ErroApi(422, 'FORMAS_INVALIDAS', 'Formas inválidas.')).mensagem).toBe('Formas inválidas.');
  });
  it('403, 503 FINANCEIRO_INDISPONIVEL e sem conexão mostram o texto da API; o resto, uma frase fixa', () => {
    expect(traduzirErroDasFormas(new ErroApi(403, 'PERMISSAO_NEGADA', 'Sem permissão.')).mensagem).toBe('Sem permissão.');
    expect(traduzirErroDasFormas(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'Financeiro desligado.')).mensagem).toBe('Financeiro desligado.');
    expect(traduzirErroDasFormas(new ErroApi(0, null, MENSAGEM_SEM_CONEXAO)).mensagem).toContain('Sem conexão');
    const fixa = 'Não foi possível salvar as formas de recebimento. Tente de novo.';
    expect(traduzirErroDasFormas(new ErroApi(500, null, 'detalhe interno')).mensagem).toBe(fixa);
    expect(traduzirErroDasFormas(new ErroApi(503, 'OUTRO', 'detalhe interno')).mensagem).toBe(fixa);
  });
});

describe('máscara, contador e mudança', () => {
  it('máscara por tipo; e-mail e aleatória só perdem os espaços', () => {
    expect(mascaraDaChavePix('CPF', '52998224725')).toBe(CPF);
    expect(mascaraDaChavePix('CNPJ', '11222333000181')).toBe(CNPJ);
    expect(mascaraDaChavePix('CNPJ', '12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(mascaraDaChavePix('TELEFONE', '45999998888')).toBe('(45) 99999-8888');
    expect(mascaraDaChavePix('EMAIL', ' treinador @exemplo.com')).toBe('treinador@exemplo.com');
    expect(mascaraDaChavePix(null, 'abc def')).toBe('abcdef');
  });
  it('contador conta sem as pontas', () => {
    expect(contadorDoPix('  Cascavel ', 15)).toBe('8 de 15 caracteres');
  });
  it('formasAlteradas: formas, tipo, nome, cidade e chave digitada; com o Pix desligado os campos dele não contam', () => {
    const gravado = estadoDasFormas(resposta({ pix: true, pixConfig: { tipoChave: 'EMAIL', chaveConfigurada: true, chaveMascarada: 't***@exemplo.com', nomeRecebedor: 'Treino Teste', cidade: 'Cascavel' } }));
    expect(formasAlteradas(gravado, gravado)).toBe(false);
    expect(formasAlteradas({ ...gravado, cidade: ' Cascavel ' }, gravado)).toBe(false);
    expect(formasAlteradas({ ...gravado, linkProprio: true }, gravado)).toBe(true);
    expect(formasAlteradas({ ...gravado, chave: 'outra@exemplo.com' }, gravado)).toBe(true);
    expect(formasAlteradas({ ...gravado, tipoChave: 'CPF' }, gravado)).toBe(true);
    expect(formasAlteradas({ ...gravado, nomeRecebedor: 'Outro' }, gravado)).toBe(true);
    const desligado = { ...gravado, pix: false };
    expect(formasAlteradas({ ...desligado, cidade: 'Toledo' }, desligado)).toBe(false);
  });
});
