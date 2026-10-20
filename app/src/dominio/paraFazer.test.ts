import type { Atualizacao } from '../api/tipos';
import { ITEM_ANAMNESE, itemDaAtualizacao } from './paraFazer';

const base = { id: 'a', pastaId: 'p', alunoId: 'x', nomeAluno: null, dataAtualizacao: '2026-10-20', fase: 'AVISO', diasParaData: 3, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 1, questionarioVersaoId: 'v', questionarioNome: null, modelo: null, respostas: null,
  enviadaEm: null, feedback: null, versao: 1, resumo: null } as Atualizacao;

describe('anamnese nas pendências', () => {
  it('"Anamnese inicial" com selo neutro (vermelho é só de atrasada)', () => {
    expect(ITEM_ANAMNESE).toMatchObject({ titulo: 'Anamnese inicial', selo: { texto: 'Pendente', tipo: 'neutro' }, responder: true });
  });
});

describe('atualização nas pendências', () => {
  it('aberta: selo neutro curto com a data, sem ano, e o item é a resposta', () => {
    expect(itemDaAtualizacao({ ...base, fase: 'ABERTA' })).toEqual({
      titulo: 'Atualização do período', detalhe: 'Questionário disponível. O rascunho fica salvo neste aparelho.', selo: { texto: 'Até 20/10', tipo: 'neutro' }, responder: true,
    });
    const avisou = itemDaAtualizacao({ ...base, fase: 'ABERTA', atrasoAte: '2026-10-25' });
    expect(avisou.selo?.texto).toBe('Até 25/10');
    expect(avisou.detalhe).toBe('Você avisou que vai responder até 25/10.');
  });

  it('atrasada é a única em vermelho', () => {
    expect(itemDaAtualizacao({ ...base, fase: 'ATRASADA', diasDeAtraso: 1 }).selo).toEqual({ texto: 'Atrasada 1 dia', tipo: 'perigo' });
    expect(itemDaAtualizacao({ ...base, fase: 'ATRASADA', diasDeAtraso: 4 }).selo?.texto).toBe('Atrasada 4 dias');
    expect(itemDaAtualizacao({ ...base, fase: 'ATRASADA', diasDeAtraso: 4 }).detalhe).toBe('Era para 20/10. O rascunho fica salvo neste aparelho.');
  });

  it('enviada e respondida em verde, com o mesmo título', () => {
    expect(itemDaAtualizacao({ ...base, fase: 'ENVIADA' })).toMatchObject({ titulo: 'Atualização do período', selo: { texto: 'Enviada', tipo: 'sucesso' }, responder: false });
    expect(itemDaAtualizacao({ ...base, fase: 'REVISADA' })).toMatchObject({ detalhe: 'Seu treinador respondeu. Toque para ler.', selo: { texto: 'Resposta nova', tipo: 'sucesso' } });
  });

  it('antes da data: sem selo; com nova data avisada, selo neutro', () => {
    expect(itemDaAtualizacao(base)).toMatchObject({ detalhe: 'Abre em 3 dias (20/10). Toque para ver as perguntas.', selo: null, responder: false });
    expect(itemDaAtualizacao({ ...base, diasParaData: 1 }).detalhe).toContain('amanhã');
    expect(itemDaAtualizacao({ ...base, atrasoAte: '2026-10-25' }).selo).toEqual({ texto: 'Até 25/10', tipo: 'neutro' });
  });
});
