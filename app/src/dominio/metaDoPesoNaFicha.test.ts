import { linhaDaMeta, metaParaEnvio, opcaoDaMeta, textoDaMeta } from './metaDoPesoNaFicha';

describe('meta do peso na ficha', () => {
  it('abre em "Padrão" quando a meta lida é nula ou ausente', () => {
    expect(opcaoDaMeta(null)).toBe('PADRAO');
    expect(opcaoDaMeta(undefined)).toBe('PADRAO');
    expect(opcaoDaMeta('AUMENTAR')).toBe('AUMENTAR');
  });

  it('"Padrão" vai como PADRAO_DA_CONSULTORIA, nunca nulo; as três metas vão como estão', () => {
    expect(metaParaEnvio('PADRAO')).toBe('PADRAO_DA_CONSULTORIA');
    expect(metaParaEnvio('REDUZIR')).toBe('REDUZIR');
    expect(metaParaEnvio('AUMENTAR')).toBe('AUMENTAR');
    expect(metaParaEnvio('SEM_META')).toBe('SEM_META');
  });

  it('a leitura diz a meta ou "Padrão da consultoria"', () => {
    expect(textoDaMeta(undefined)).toBe('Padrão da consultoria');
    expect(textoDaMeta('SEM_META')).toBe('Sem meta');
  });

  it('a linha da D4 só aparece com REDUZIR ou AUMENTAR', () => {
    expect(linhaDaMeta('REDUZIR', 'equipe')).toBe('Cores pela meta: reduzir o peso');
    expect(linhaDaMeta('AUMENTAR', 'equipe')).toBe('Cores pela meta: aumentar o peso');
    expect(linhaDaMeta('AUMENTAR', 'aluno')).toBe('Verde: no caminho da sua meta');
    expect(linhaDaMeta('SEM_META', 'equipe')).toBeNull();
    expect(linhaDaMeta('SEM_META', 'aluno')).toBeNull();
    expect(linhaDaMeta(undefined, 'aluno')).toBeNull();
  });
});
