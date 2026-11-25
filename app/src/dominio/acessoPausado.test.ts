import { ErroApi } from '@plataforma/web';

import { CODIGO_ACESSO_PAUSADO, ehAcessoPausado, ordenarCobrancasParaRegularizacao } from './acessoPausado';

describe('ehAcessoPausado', () => {
  it('reconhece 403 ACESSO_PAUSADO_POR_ATRASO', () => {
    expect(ehAcessoPausado(new ErroApi(403, CODIGO_ACESSO_PAUSADO, 'Acesso pausado'))).toBe(true);
  });

  it('ignora outros status, outros códigos e erros comuns', () => {
    expect(ehAcessoPausado(new ErroApi(403, 'ACESSO_NEGADO', 'Sem permissão'))).toBe(false);
    expect(ehAcessoPausado(new ErroApi(409, CODIGO_ACESSO_PAUSADO, 'Outro status'))).toBe(false);
    expect(ehAcessoPausado(new Error('falha de rede'))).toBe(false);
    expect(ehAcessoPausado(null)).toBe(false);
  });
});

describe('ordenarCobrancasParaRegularizacao', () => {
  it('coloca cobranças vencidas primeiro e ordena pelo vencimento mais antigo', () => {
    const entrada = [
      { id: 'futura-2', vencida: false, vencimento: '2026-12-05' },
      { id: 'vencida-recente', vencida: true, vencimento: '2026-10-05' },
      { id: 'futura-1', vencida: false, vencimento: '2026-11-05' },
      { id: 'vencida-antiga', vencida: true, vencimento: '2026-09-05' },
    ];
    expect(ordenarCobrancasParaRegularizacao(entrada).map((c) => c.id)).toEqual([
      'vencida-antiga',
      'vencida-recente',
      'futura-1',
      'futura-2',
    ]);
  });
});
