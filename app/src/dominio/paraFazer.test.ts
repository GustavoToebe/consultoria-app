import type { Atualizacao } from '../api/tipos';
import type { CobrancaDoAluno } from '../api/financeiroTipos';
import { ITEM_ANAMNESE, itemDaAtualizacao, itemDoPagamento } from './paraFazer';

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

describe('pagamento nas pendências', () => {
  const hoje = '2026-10-20';
  const cobranca = (extra: Partial<CobrancaDoAluno>): CobrancaDoAluno => ({
    id: 'c', competencia: '2026-10-01', vencimento: '2026-10-25', valorCentavos: 15000, situacao: 'ABERTA', vencida: false, forma: null, pagoEm: null, ...extra,
  });
  const semEspaco = (t: string) => t.replace(/ /g, ' ');

  it('sem cobrança em aberto (ou longe de vencer), não há pendência', () => {
    expect(itemDoPagamento([], hoje)).toBeNull();
    expect(itemDoPagamento(null, hoje)).toBeNull();
    expect(itemDoPagamento([cobranca({ vencimento: '2026-11-10' })], hoje)).toBeNull();
  });
  it('vence em até 3 dias: selo neutro com a data', () => {
    const item = itemDoPagamento([cobranca({ vencimento: '2026-10-23' })], hoje);
    expect(item).toMatchObject({ titulo: 'Pagamento em aberto', selo: { texto: 'Vence 23/10', tipo: 'neutro' }, responder: false });
    expect(semEspaco(item?.detalhe ?? '')).toBe('R$ 150,00, vence em 23/10.');
  });
  it('vencida (a API decide): selo âmbar, nunca vermelho, e manda falar com o treinador', () => {
    const item = itemDoPagamento([cobranca({ vencida: true, vencimento: '2026-10-05' })], hoje);
    expect(item?.selo).toEqual({ texto: 'Vencida', tipo: 'atencao' });
    expect(item?.detalhe).toContain('Fale com o seu treinador');
  });
  it('várias: a mais antiga primeiro, com a contagem das outras', () => {
    const item = itemDoPagamento([cobranca({ id: 'b', vencimento: '2026-10-22' }), cobranca({ id: 'a', vencida: true, vencimento: '2026-09-10' })], hoje);
    expect(item?.detalhe).toContain('e mais 1');
    expect(item?.detalhe).toContain('10/09');
  });
  it('celular sem o "Pagar" (informar): só informa, no formato exato, sem frase de chamada', () => {
    const noPrazo = itemDoPagamento([cobranca({ vencimento: '2026-10-23' })], hoje, 'informar');
    expect(semEspaco(noPrazo?.detalhe ?? '')).toBe('Mensalidade de R$ 150,00, vence em 23/10');
    expect(noPrazo?.selo).toEqual({ texto: 'Vence 23/10', tipo: 'neutro' });
    const vencida = itemDoPagamento([cobranca({ vencida: true, vencimento: '2026-10-05' })], hoje, 'informar');
    expect(vencida?.detalhe).toBe('Em aberto desde 05/10');
    expect(vencida?.selo).toEqual({ texto: 'Vencida', tipo: 'atencao' });
    expect(JSON.stringify([noPrazo, vencida])).not.toMatch(/treinador|pagar|pague|link|site/i);
  });
  it('informar com várias: a mais antiga primeiro, com a contagem das outras', () => {
    const item = itemDoPagamento([cobranca({ id: 'b', vencimento: '2026-10-22' }), cobranca({ id: 'a', vencida: true, vencimento: '2026-09-10' })], hoje, 'informar');
    expect(item?.detalhe).toBe('Em aberto desde 10/09 (e mais 1)');
  });
  it('os outros modos seguem como antes', () => {
    const doBotao = itemDoPagamento([cobranca({ vencimento: '2026-10-23' })], hoje, 'botao');
    expect(semEspaco(doBotao?.detalhe ?? '')).toBe('R$ 150,00, vence em 23/10.');
    expect(itemDoPagamento([cobranca({ vencimento: '2026-10-23' })], hoje, 'combinar')).toEqual(doBotao);
  });
  it('não tem botão de pagar nem texto de cobrança por link', () => {
    const item = itemDoPagamento([cobranca({ vencimento: '2026-10-21' })], hoje);
    expect(JSON.stringify(item).toLowerCase()).not.toContain('pagar');
  });
});
