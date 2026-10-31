import type { Atualizacao } from '../api/tipos';
import { atualizacaoParaOPlano, rotuloDaAtualizacaoAnterior, ultimaEnviada } from './atualizacaoDoPlano';

// Dados fictícios.
const at = (campos: Partial<Atualizacao>) => ({
  id: null, pastaId: null, alunoId: 'aluno-1', nomeAluno: null, dataAtualizacao: null, fase: 'NENHUMA',
  diasParaData: 0, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0,
  questionarioVersaoId: null, questionarioNome: null, modelo: null, respostas: null, enviadaEm: null, feedback: null,
  versao: null, resumo: null, ...campos,
}) as Atualizacao;

const PLANO_16 = at({ id: 'a16', pastaId: 'p16', dataAtualizacao: '2026-10-20', fase: 'ENVIADA', enviadaEm: '2026-10-20T10:00:00Z' });
const PLANO_15 = at({ id: 'a15', pastaId: 'p15', dataAtualizacao: '2026-10-05', fase: 'REVISADA', enviadaEm: '2026-10-05T10:00:00Z' });

describe('atualizacaoParaOPlano', () => {
  it('a pasta com atualização enviada mostra a dela', () => {
    expect(atualizacaoParaOPlano('p16', null, [PLANO_15, PLANO_16])).toEqual({ atualizacao: PLANO_16, daPasta: true });
  });

  it('pasta renovada, sem linha gravada: a última enviada do aluno, marcada como de outra pasta', () => {
    expect(atualizacaoParaOPlano('p17', null, [PLANO_15, PLANO_16])).toEqual({ atualizacao: PLANO_16, daPasta: false });
  });

  it('pasta vigente ainda aberta: a última enviada vem antes da aberta', () => {
    const aberta = at({ pastaId: 'p17', dataAtualizacao: '2026-11-04', fase: 'NENHUMA' });
    expect(atualizacaoParaOPlano('p17', aberta, [PLANO_16])).toEqual({ atualizacao: PLANO_16, daPasta: false });
  });

  it('sem nenhuma enviada: a da pasta, mesmo aberta, ou nada', () => {
    const aberta = at({ pastaId: 'p17', dataAtualizacao: '2026-11-04', fase: 'ABERTA' });
    expect(atualizacaoParaOPlano('p17', aberta, [])).toEqual({ atualizacao: aberta, daPasta: true });
    expect(atualizacaoParaOPlano('p17', null, [])).toBeNull();
    expect(atualizacaoParaOPlano('p17', at({ pastaId: 'p17' }), [])).toBeNull();
  });

  it('aviso de atraso sem envio não conta como enviada', () => {
    const avisou = at({ id: 'x', pastaId: 'p16', dataAtualizacao: '2026-10-20', fase: 'ATRASADA', atrasoAte: '2026-10-25' });
    expect(atualizacaoParaOPlano('p17', null, [avisou, PLANO_15])).toEqual({ atualizacao: PLANO_15, daPasta: false });
  });
});

describe('ultimaEnviada', () => {
  it('não depende da ordem da lista e desempata pelo envio', () => {
    expect(ultimaEnviada([PLANO_16, PLANO_15])).toBe(PLANO_16);
    expect(ultimaEnviada([PLANO_15, PLANO_16])).toBe(PLANO_16);
    const mesmoDia = at({ ...PLANO_16, id: 'b', enviadaEm: '2026-10-21T08:00:00Z' });
    expect(ultimaEnviada([mesmoDia, PLANO_16])).toBe(mesmoDia);
    expect(ultimaEnviada([])).toBeNull();
  });
});

describe('rotuloDaAtualizacaoAnterior', () => {
  it('diz a pasta e a data; sem título, "outra pasta"', () => {
    expect(rotuloDaAtualizacaoAnterior('Plano 16', '20/10/2026')).toBe('Atualização de Plano 16 · 20/10/2026');
    expect(rotuloDaAtualizacaoAnterior(null, '20/10/2026')).toBe('Atualização de outra pasta · 20/10/2026');
    expect(rotuloDaAtualizacaoAnterior('  ', '20/10/2026')).toBe('Atualização de outra pasta · 20/10/2026');
  });
});
