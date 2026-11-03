import type { AvisoDeCompromisso } from '../api/agendaTipos';
import type { CobrancaDoAluno } from '../api/financeiroTipos';
import type { Atualizacao } from '../api/tipos';
import { seloDaSituacao } from './agendaPresencial';
import { seloDaAnamnese } from './anamnese';
import { statusAtualizacao, statusAtualizacaoTreinador } from './atualizacao';
import { seloDaCobranca } from './financeiro';
import { situacaoDoLembrete } from './lembretesDeCobranca';
import { situacaoDaCobrancaParaTela } from './minhaConta';
import { itemDaAtualizacao, itemDoAviso, itemDoPagamento } from './paraFazer';

/**
 * Uma linha por situação da tabela de `docs/planos/auditoria-cores.md` (D2, D6, D7 e D11): chama as funções do aluno e as
 * do treinador e confere o tom decidido. Âmbar só para quem precisa agir; quem espera vê neutro; a cobrança segue os
 * três tons comuns (exceção D11).
 */
const hoje = '2026-10-20';
const atualizacao = (extra: Partial<Atualizacao>) => ({
  id: 'a', pastaId: 'p', alunoId: 'x', nomeAluno: null, dataAtualizacao: '2026-10-20', fase: 'ABERTA', diasParaData: 0, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 1, questionarioVersaoId: 'v', questionarioNome: null, modelo: null, respostas: null,
  enviadaEm: null, feedback: null, versao: 1, resumo: null, ...extra,
}) as Atualizacao;
const cobranca = (extra: Partial<CobrancaDoAluno>): CobrancaDoAluno => ({
  id: 'c', competencia: '2026-10-01', vencimento: '2026-10-23', valorCentavos: 15000, situacao: 'ABERTA', vencida: false, forma: null, pagoEm: null, ...extra,
});
const tomDoItem = (a: Atualizacao) => itemDaAtualizacao(a, hoje).selo?.tipo;

describe('uma cor por situação, no aluno e no treinador', () => {
  it('atualização enviada: o aluno espera (neutro), o treinador age (âmbar)', () => {
    const a = atualizacao({ fase: 'ENVIADA' });
    expect(statusAtualizacao(a, hoje)).toMatchObject({ texto: 'Enviada · aguardando revisão', tipo: 'neutro' });
    expect(tomDoItem(a)).toBe('neutro');
    expect(statusAtualizacaoTreinador(a, hoje).tipo).toBe('atencao');
  });

  it('anamnese enviada: aluno neutro, treinador âmbar; pendente: aluno âmbar, treinador neutro', () => {
    expect(seloDaAnamnese('ENVIADA', true)).toEqual({ texto: 'Enviada · aguardando revisão', tipo: 'neutro' });
    expect(seloDaAnamnese('ENVIADA').tipo).toBe('atencao');
    expect(seloDaAnamnese('PENDENTE', true).tipo).toBe('atencao');
    expect(seloDaAnamnese('PENDENTE').tipo).toBe('neutro');
  });

  it('atualização aberta: o aluno age (âmbar, nos dois pontos), o treinador espera (neutro)', () => {
    const a = atualizacao({ fase: 'ABERTA', diasParaData: 0 });
    expect(statusAtualizacao(a, hoje).tipo).toBe('atencao');
    expect(tomDoItem(a)).toBe('atencao');
    expect(statusAtualizacaoTreinador(a, hoje).tipo).toBe('neutro');
  });

  it('atualização adiada: o aluno age (âmbar, nos dois pontos), o treinador espera (neutro)', () => {
    for (const fase of ['ABERTA', 'NENHUMA'] as const) {
      const a = atualizacao({ fase, diasParaData: fase === 'ABERTA' ? 0 : 5, atrasoAte: '2026-10-25' });
      expect(statusAtualizacao(a, hoje).tipo).toBe('atencao');
      expect(tomDoItem(a)).toBe('atencao');
      expect(statusAtualizacaoTreinador(a, hoje).tipo).toBe('neutro');
    }
  });

  it('atualização atrasada: vermelho nos dois lados', () => {
    const a = atualizacao({ fase: 'ATRASADA', diasDeAtraso: 3 });
    expect(statusAtualizacao(a, hoje).tipo).toBe('perigo');
    expect(tomDoItem(a)).toBe('perigo');
    expect(statusAtualizacaoTreinador(a, hoje).tipo).toBe('perigo');
  });

  it('cobrança em aberto (D11): âmbar nos dois lados e nos dois pontos do aluno', () => {
    const c = cobranca({});
    expect(itemDoPagamento([c], hoje)?.selo?.tipo).toBe('atencao');
    expect(itemDoPagamento([c], hoje, 'informar')?.selo?.tipo).toBe('atencao');
    expect(seloDaCobranca(c).tom).toBe('atencao');
    expect(situacaoDaCobrancaParaTela({ situacao: 'ABERTA', vencida: false }).tipo).toBe('atencao');
  });

  it('cobrança vencida (D6): vermelho nos dois lados, com "Vencida há N dias" no Início do aluno', () => {
    const c = cobranca({ vencida: true, vencimento: '2026-10-17' });
    for (const modo of ['botao', 'informar'] as const) {
      expect(itemDoPagamento([c], hoje, modo)?.selo).toEqual({ texto: 'Vencida há 3 dias', tipo: 'perigo' });
    }
    expect(seloDaCobranca(c).tom).toBe('perigo');
    expect(situacaoDaCobrancaParaTela({ situacao: 'ABERTA', vencida: true }).tipo).toBe('perigo');
  });

  it('cobrança paga, cancelada e isenta (D11): verde e cinza, igual no Financeiro e na conta', () => {
    expect(seloDaCobranca({ situacao: 'PAGA' }).tom).toBe('sucesso');
    expect(situacaoDaCobrancaParaTela({ situacao: 'PAGA', vencida: false }).tipo).toBe('sucesso');
    expect(seloDaCobranca({ situacao: 'CANCELADA' }).tom).toBe('neutro');
    expect(situacaoDaCobrancaParaTela({ situacao: 'CANCELADA', vencida: false }).tipo).toBe('neutro');
    expect(situacaoDaCobrancaParaTela({ situacao: 'ISENTA', vencida: false }).tipo).toBe('neutro');
  });

  it('coisa futura marcada (D7): neutro em todo lugar', () => {
    const aviso = { id: 'v', tipo: 'NOVO', inicio: '2026-11-05T12:00:00Z', responsavelNome: 'Ana' } as AvisoDeCompromisso;
    expect(itemDoAviso(aviso, hoje).selo?.tipo).toBe('neutro');
    expect(seloDaSituacao('AGENDADO').tipo).toBe('neutro');
    expect(situacaoDoLembrete({ situacao: 'PENDENTE', dataPrevista: '2026-10-25', atualizadoEm: '2026-10-20T10:00:00Z' } as Parameters<typeof situacaoDoLembrete>[0]).tom).toBe('neutro');
    const futura = atualizacao({ fase: 'NENHUMA', diasParaData: 15 });
    expect(statusAtualizacao(futura, hoje).tipo).toBe('neutro');
    expect(statusAtualizacaoTreinador(futura, hoje).tipo).toBe('neutro');
  });
});
