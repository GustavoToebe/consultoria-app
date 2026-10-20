import type { Atualizacao } from '../api/tipos';
import { itemDaAtualizacao } from './paraFazer';

const base = { id: 'a', pastaId: 'p', alunoId: 'x', nomeAluno: null, dataAtualizacao: '2026-10-20', fase: 'AVISO', diasParaData: 3, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 1, questionarioVersaoId: 'v', questionarioNome: null, modelo: null, respostas: null,
  enviadaEm: null, feedback: null, versao: 1, resumo: null } as Atualizacao;

describe('atualização no "Para fazer"', () => {
  it('aberta: selo curto com a data, sem ano, e o item é a resposta', () => {
    expect(itemDaAtualizacao({ ...base, fase: 'ABERTA' })).toEqual({
      titulo: 'Responder a atualização', detalhe: 'O rascunho fica salvo neste aparelho.', selo: { texto: 'Até 20/10', tipo: 'atencao' }, responder: true,
    });
    expect(itemDaAtualizacao({ ...base, fase: 'ABERTA', atrasoAte: '2026-10-25' }).selo?.texto).toBe('Até 25/10');
  });

  it('atrasada, enviada, respondida e antes da data', () => {
    expect(itemDaAtualizacao({ ...base, fase: 'ATRASADA', diasDeAtraso: 1 }).selo).toEqual({ texto: 'Atrasada 1 dia', tipo: 'perigo' });
    expect(itemDaAtualizacao({ ...base, fase: 'ATRASADA', diasDeAtraso: 4 }).selo?.texto).toBe('Atrasada 4 dias');
    expect(itemDaAtualizacao({ ...base, fase: 'ENVIADA' }).selo?.texto).toBe('Enviada');
    expect(itemDaAtualizacao({ ...base, fase: 'REVISADA' }).titulo).toBe('Seu treinador respondeu');
    expect(itemDaAtualizacao(base)).toMatchObject({ detalhe: 'Abre em 3 dias (20/10). Toque para ver as perguntas.', selo: null, responder: false });
    expect(itemDaAtualizacao({ ...base, diasParaData: 1 }).detalhe).toContain('amanhã');
  });
});
