import { ErroApi } from '@plataforma/web';

import { compartilharFoiCancelado, podeCompartilhar, situacaoDoConvite } from './convidarAmigo';

const LINK = { link: 'https://exemplo.test/inscricao/abc?origem=indicacao#indicacao=00000000-0000-4000-8000-000000000001' };

describe('situacaoDoConvite', () => {
  it('sem internet o cartão some, mesmo com o link já lido', () => {
    expect(situacaoDoConvite(false, LINK, undefined)).toBe('oculto');
    expect(situacaoDoConvite(false, undefined, undefined)).toBe('oculto');
  });

  it('sem link aberto (404), conta anonimizada (409) ou sem conexão: some, sem erro na tela', () => {
    expect(situacaoDoConvite(true, undefined, new ErroApi(404, 'NAO_ENCONTRADO', 'Sem link.'))).toBe('oculto');
    expect(situacaoDoConvite(true, undefined, new ErroApi(409, 'ALUNO_ANONIMIZADO', 'Conta encerrada.'))).toBe('oculto');
    expect(situacaoDoConvite(true, undefined, new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'))).toBe('oculto');
  });

  it('outro erro mostra a mensagem (com "Tentar de novo"), também por cima de um link lido antes', () => {
    expect(situacaoDoConvite(true, undefined, new ErroApi(500, null, 'Erro interno.'))).toBe('erro');
    expect(situacaoDoConvite(true, LINK, new ErroApi(409, 'OUTRO', 'Conflito.'))).toBe('erro');
    expect(situacaoDoConvite(true, undefined, new Error('qualquer'))).toBe('erro');
  });

  it('carregando até chegar o link; pronto com ele', () => {
    expect(situacaoDoConvite(true, undefined, undefined)).toBe('carregando');
    expect(situacaoDoConvite(true, LINK, undefined)).toBe('pronto');
  });
});

describe('podeCompartilhar', () => {
  it('no celular sempre; na web só com navigator.share', () => {
    expect(podeCompartilhar('android', false)).toBe(true);
    expect(podeCompartilhar('ios', false)).toBe(true);
    expect(podeCompartilhar('web', true)).toBe(true);
    expect(podeCompartilhar('web', false)).toBe(false);
  });
});

describe('compartilharFoiCancelado', () => {
  it('só o AbortError conta como cancelado', () => {
    const cancelado = new Error('cancelou');
    cancelado.name = 'AbortError';
    expect(compartilharFoiCancelado(cancelado)).toBe(true);
    expect(compartilharFoiCancelado(new Error('falhou'))).toBe(false);
    expect(compartilharFoiCancelado('texto')).toBe(false);
  });
});
