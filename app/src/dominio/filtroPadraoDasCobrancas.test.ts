import {
  mesesDoFiltro, enderecoDasCobrancas, filtroPadraoDasCobrancas, filtrosDaAbaDeCobrancas, temChaveDasCobrancas,
} from './filtroPadraoDasCobrancas';
import {
  chipsDasCobrancas, cobrancasParaApi, descricaoDasCobrancas, lerCobrancasDoEndereco, limpoDasCobrancas, SEM_FILTROS_DE_COBRANCAS,
  semOFiltroDeCobrancas, SITUACOES_ATIVAS, textoDasSituacoes,
} from './filtrosDoFinanceiro';

// Filtro padrão das cobranças (19/11).
const HOJE = '2026-11-19';
const ALUNO = '00000000-0000-4000-8000-000000000001';

describe('filtro padrão das cobranças', () => {
  it('ativas = o que entra nos Totais: aberta (com as vencidas), paga e contestada; cancelada, estornada e renegociada fora', () => {
    expect([...SITUACOES_ATIVAS].sort()).toEqual(['ABERTA', 'CONTESTADA', 'PAGA']);
    expect(textoDasSituacoes(['CONTESTADA', 'ABERTA', 'PAGA'])).toBe('Ativas');
    expect(textoDasSituacoes(['ABERTA', 'PAGA'])).toBe('Em aberto, Pagas');
  });

  it('sem chave no endereço: Ativas e o mês de vencimento de Brasília, que vai à API como vencimento do mês inteiro', () => {
    const f = filtrosDaAbaDeCobrancas({}, HOJE);
    expect(f).toEqual(filtroPadraoDasCobrancas(HOJE));
    expect(f.mesVencimento).toBe('2026-11');
    expect(cobrancasParaApi(f, HOJE)).toMatchObject({ situacoes: ['ABERTA', 'PAGA', 'CONTESTADA'], de: '2026-11-01', ate: '2026-11-30' });
    expect(chipsDasCobrancas(f, HOJE).map((c) => c.texto)).toEqual(['Situação: Ativas', 'Mês de vencimento: 11/2026']);
    expect(descricaoDasCobrancas(f, HOJE, 2)).toBe('Ativas, mês de vencimento 11/2026: 2 cobranças, por vencimento. Toque na linha para abrir.');
    // Fevereiro de ano bissexto e virada do ano.
    expect(cobrancasParaApi(filtroPadraoDasCobrancas('2028-02-10'), '2028-02-10')).toMatchObject({ de: '2028-02-01', ate: '2028-02-29' });
  });

  it('quem chega com filtro próprio fica com ele (Início, ficha), mesmo com valor desconhecido', () => {
    expect(filtrosDaAbaDeCobrancas({ situacao: 'VENCIDA' }, HOJE)).toEqual({ ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['VENCIDA'] });
    expect(filtrosDaAbaDeCobrancas({ alunoId: ALUNO }, HOJE)).toEqual({ ...SEM_FILTROS_DE_COBRANCAS, alunoId: ALUNO });
    expect(filtrosDaAbaDeCobrancas({ situacao: 'QUALQUER' }, HOJE)).toEqual(SEM_FILTROS_DE_COBRANCAS);
    expect(temChaveDasCobrancas({ vencimento: 'PROXIMOS_7_DIAS' })).toBe(true);
    expect(temChaveDasCobrancas({})).toBe(false);
  });

  it('tirar todos grava filtro=nenhum, e o recarregar continua sem filtro', () => {
    const tudoFora = limpoDasCobrancas(filtroPadraoDasCobrancas(HOJE));
    expect(enderecoDasCobrancas(tudoFora)).toEqual({ filtro: 'nenhum' });
    expect(filtrosDaAbaDeCobrancas(enderecoDasCobrancas(tudoFora), HOJE)).toEqual(SEM_FILTROS_DE_COBRANCAS);
    // Tirar só um mantém o outro no endereço, e a marca não vai junto.
    const semMes = semOFiltroDeCobrancas(filtroPadraoDasCobrancas(HOJE), 'mesVencimento');
    expect(enderecoDasCobrancas(semMes)).toEqual({ situacao: 'ABERTA,PAGA,CONTESTADA' });
    expect(filtrosDaAbaDeCobrancas(enderecoDasCobrancas(semMes), HOJE)).toEqual(semMes);
    const semSituacao = semOFiltroDeCobrancas(filtroPadraoDasCobrancas(HOJE), 'situacao');
    expect(enderecoDasCobrancas(semSituacao)).toEqual({ mesVencimento: '2026-11' });
  });

  it('mês de vencimento no endereço: só mês válido, e o vencimento do endereço vale mais', () => {
    expect(lerCobrancasDoEndereco({ mesVencimento: '2026-10' }).mesVencimento).toBe('2026-10');
    for (const ruim of ['2026-13', '2026-1', '10/2026', '']) expect(lerCobrancasDoEndereco({ mesVencimento: ruim }).mesVencimento).toBeNull();
    expect(lerCobrancasDoEndereco({ mesVencimento: '2026-10', vencimento: 'PROXIMOS_7_DIAS' }).mesVencimento).toBeNull();
    expect(lerCobrancasDoEndereco({ mesVencimento: '2026-10', de: '2026-10-05' }).mesVencimento).toBeNull();
  });

  it('os meses do painel: o mês seguinte, o atual e 11 anteriores, em MM/AAAA; a escolhida de fora entra no fim', () => {
    const meses = mesesDoFiltro('2026-01-15');
    expect(meses).toHaveLength(13);
    expect(meses.slice(0, 3)).toEqual([
      { valor: '2026-02', rotulo: '02/2026' }, { valor: '2026-01', rotulo: '01/2026' }, { valor: '2025-12', rotulo: '12/2025' },
    ]);
    expect(meses.at(-1)?.valor).toBe('2025-02');
    expect(mesesDoFiltro('2026-01-15', '2024-05').at(-1)).toEqual({ valor: '2024-05', rotulo: '05/2024' });
    expect(mesesDoFiltro('2026-01-15', '2026-01')).toHaveLength(13);
  });
});
