import { grupoEncerraramSemRenovar } from './encerraramSemRenovar';

const item = (n: number, termino: string, nome: string | null = `Aluno ${n}`) => ({
  contratacaoId: `c${n}`, alunoId: `a${n}`, alunoNome: nome, terminoVigencia: termino, valorCentavos: 70_000 + n,
});

describe('grupo "Encerraram sem renovar"', () => {
  it('sem ninguém (ou sem dado), o grupo não existe', () => {
    expect(grupoEncerraramSemRenovar(null)).toBeNull();
    expect(grupoEncerraramSemRenovar(undefined)).toBeNull();
    expect(grupoEncerraramSemRenovar({ encerraramSemRenovarCount: 0, encerraramSemRenovar: [] })).toBeNull();
  });
  it('uma linha por plano, com a data do término e o valor; nome nulo vira "—"', () => {
    const g = grupoEncerraramSemRenovar({ encerraramSemRenovarCount: 2, encerraramSemRenovar: [item(1, '2026-11-13'), item(2, '2026-11-01', null)] });
    expect(g?.resumo).toBe('2 planos');
    expect(g?.resto).toBe(0);
    expect(g?.linhas[0]).toMatchObject({ chave: 'c1', alunoId: 'a1', titulo: 'Aluno 1', detalhe: 'R$ 700,01', selo: 'Encerrado em 13/11/2026' });
    expect(g?.linhas[0].rotulo).toBe('Abrir ficha de Aluno 1, plano encerrado em 13/11/2026, R$ 700,01');
    expect(g?.linhas[1]).toMatchObject({ titulo: '—' });
  });
  it('um plano no singular; o total acima da lista vira o resto', () => {
    expect(grupoEncerraramSemRenovar({ encerraramSemRenovarCount: 1, encerraramSemRenovar: [item(1, '2026-11-13')] })?.resumo).toBe('1 plano');
    const g = grupoEncerraramSemRenovar({ encerraramSemRenovarCount: 53, encerraramSemRenovar: [item(1, '2026-11-13'), item(2, '2026-11-12')] });
    expect(g).toMatchObject({ resumo: '53 planos', resto: 51 });
  });
});
