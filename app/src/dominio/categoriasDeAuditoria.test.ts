import { ACOES_AUDITORIA } from '../treinador/equipe/acoesAuditoria';
import {
  ACOES_DE_LOGIN, acoesCombinadas, acoesDoAtalho, atalhoDoEndereco, atalhoParaEndereco, categoriaDaAcao, CODIGOS_DA_CATEGORIA,
  type CategoriaDeAuditoria,
} from './categoriasDeAuditoria';
import { pedidoComAtalho, SEM_FILTROS } from './filtrosDeAuditoria';

const CODIGOS = Object.keys(ACOES_AUDITORIA);

describe('categorias da auditoria', () => {
  it('todo código do catálogo tem exatamente uma categoria', () => {
    const semCategoria = CODIGOS.filter((c) => categoriaDaAcao(c) === null);
    expect(semCategoria).toEqual([]);
    const todas = Object.values(CODIGOS_DA_CATEGORIA).flat();
    const repetidos = todas.filter((c, i) => todas.indexOf(c) !== i);
    expect(repetidos).toEqual([]);
  });

  it('nenhuma categoria tem código que o catálogo não conhece', () => {
    expect(Object.values(CODIGOS_DA_CATEGORIA).flat().filter((c) => !ACOES_AUDITORIA[c])).toEqual([]);
  });

  it('pontos de conferência das exceções ao prefixo', () => {
    const casos: [string, CategoriaDeAuditoria][] = [
      ['INSCRICAO_PAGAMENTO_CONFIRMADO', 'FINANCEIRO'], ['INSCRICAO_ACEITA', 'ALUNOS'], ['INSCRICAO_LINK_RENOVADO', 'CONFIGURACOES'],
      ['ALUNO_ACESSO_PAUSADO', 'FINANCEIRO'], ['ALUNO_QUESTIONARIO_ALTERADO', 'ALUNOS'], ['PASTA_QUESTIONARIO_ALTERADO', 'PLANOS'],
      ['MFA_ATIVADO', 'ACESSO'], ['TAG_ALUNO_CRIADA', 'CONFIGURACOES'], ['ALUNO_TAGS_ALTERADAS', 'ALUNOS'], ['PERFIL_CRIADO', 'EQUIPE'],
    ];
    for (const [codigo, categoria] of casos) expect([codigo, categoriaDaAcao(codigo)]).toEqual([codigo, categoria]);
    expect(categoriaDaAcao('CODIGO_NOVO_DA_API')).toBeNull();
  });

  // A `acao` de `GET /auditoria` aceita até 100 valores; "Sem logins" vai por `acaoExceto` (até 50) e não entra aqui.
  it('as categorias cabem no teto da acao (100)', () => {
    const tamanhos = Object.fromEntries((['ALUNOS', 'PLANOS', 'FINANCEIRO', 'EQUIPE'] as const).map((a) => [a, acoesDoAtalho(a, ACOES_AUDITORIA)!.length]));
    expect(tamanhos).toEqual({ ALUNOS: 62, PLANOS: 24, FINANCEIRO: 55, EQUIPE: 11 });
    for (const n of Object.values(tamanhos)) expect(n).toBeLessThanOrEqual(100);
    expect(ACOES_DE_LOGIN.length).toBeLessThanOrEqual(50);
  });
});

describe('atalhos', () => {
  it('Tudo não restringe; Sem logins é o catálogo menos os logins', () => {
    expect(acoesDoAtalho('TUDO', ACOES_AUDITORIA)).toBeNull();
    const semLogins = acoesDoAtalho('SEM_LOGINS', ACOES_AUDITORIA)!;
    for (const l of ACOES_DE_LOGIN) expect(semLogins).not.toContain(l);
    expect(semLogins).toContain('SENHA_ALTERADA');
    expect(semLogins).toContain('MFA_DESATIVADO');
  });

  it('endereço: ida e volta; valor desconhecido é Tudo', () => {
    for (const a of ['SEM_LOGINS', 'ALUNOS', 'PLANOS', 'FINANCEIRO', 'EQUIPE'] as const) expect(atalhoDoEndereco(atalhoParaEndereco(a))).toBe(a);
    expect(atalhoParaEndereco('TUDO')).toBeUndefined();
    expect(atalhoDoEndereco('Equipe')).toBe('EQUIPE');
    expect(atalhoDoEndereco('outra')).toBe('TUDO');
    expect(atalhoDoEndereco(undefined)).toBe('TUDO');
  });

  it('combina com o filtro Ação por interseção', () => {
    expect(acoesCombinadas([], 'TUDO', ACOES_AUDITORIA)).toEqual({ acoes: [] });
    expect(acoesCombinadas(['ALUNO_CRIADO'], 'TUDO', ACOES_AUDITORIA)).toEqual({ acoes: ['ALUNO_CRIADO'] });
    expect(acoesCombinadas([], 'EQUIPE', ACOES_AUDITORIA)).toEqual({ acoes: CODIGOS_DA_CATEGORIA.EQUIPE.filter((c) => ACOES_AUDITORIA[c]) });
    expect(acoesCombinadas(['PERFIL_CRIADO', 'ALUNO_CRIADO'], 'EQUIPE', ACOES_AUDITORIA)).toEqual({ acoes: ['PERFIL_CRIADO'] });
    // Sem nada em comum: nunca uma lista vazia (que a API leria como "todas").
    expect(acoesCombinadas(['LOGIN_SUCESSO'], 'SEM_LOGINS', ACOES_AUDITORIA)).toBe('NENHUMA');
  });

  it('pedido da API com atalho mantém pessoa e período', () => {
    const f = { ...SEM_FILTROS, pessoas: ['sistema'], periodo: { de: '2026-11-01', ate: '2026-11-27' } };
    expect(pedidoComAtalho(f, 'PLANOS', ACOES_AUDITORIA)).toEqual({
      de: '2026-11-01', ate: '2026-11-27', usuarioId: ['sistema'], acao: acoesDoAtalho('PLANOS', ACOES_AUDITORIA),
    });
    expect(pedidoComAtalho(f, 'TUDO', ACOES_AUDITORIA)).toEqual({ de: '2026-11-01', ate: '2026-11-27', usuarioId: ['sistema'] });
    expect(pedidoComAtalho({ ...f, acoes: ['LOGIN_SUCESSO'] }, 'SEM_LOGINS', ACOES_AUDITORIA)).toBe('NENHUMA');
  });

  it('Sem logins: acaoExceto sem o filtro Ação; com ele, a acao já sem os logins e sem acaoExceto', () => {
    expect(pedidoComAtalho(SEM_FILTROS, 'SEM_LOGINS', ACOES_AUDITORIA)).toEqual({ acaoExceto: ['LOGIN_SUCESSO', 'LOGIN_BLOQUEADO'] });
    expect(pedidoComAtalho({ ...SEM_FILTROS, acoes: ['LOGIN_SUCESSO', 'ALUNO_CRIADO'] }, 'SEM_LOGINS', ACOES_AUDITORIA)).toEqual({ acao: ['ALUNO_CRIADO'] });
  });
});
