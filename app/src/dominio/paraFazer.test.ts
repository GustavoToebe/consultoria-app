import type { Atualizacao } from '../api/tipos';
import type { CobrancaDoAluno } from '../api/financeiroTipos';
import type { AvisoDeCompromisso } from '../api/agendaTipos';
import { AVISOS_VISIVEIS, avisosDoInicio, ITEM_ANAMNESE, itemDaAtualizacao, itemDoAviso, itemDoPagamento, temAvisoDeCompromisso, textoDoAviso } from './paraFazer';

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

describe('aviso de compromisso nas pendências (D12)', () => {
  const hoje = '2026-10-29';
  // 12:00 UTC = 09:00 em Brasília.
  const aviso = (extra: Partial<AvisoDeCompromisso> = {}): AvisoDeCompromisso =>
    ({ id: 'v1', tipo: 'NOVO', inicio: '2026-11-05T12:00:00Z', responsavelNome: 'Ana', ...extra });

  it('as três frases da D12, com data e hora de Brasília', () => {
    expect(textoDoAviso(aviso(), hoje)).toBe('Novo compromisso: 05/11 às 09:00 com Ana');
    expect(textoDoAviso(aviso({ tipo: 'REMARCADO' }), hoje)).toBe('Compromisso remarcado: agora 05/11 às 09:00 com Ana');
    expect(textoDoAviso(aviso({ tipo: 'CANCELADO' }), hoje)).toBe('Compromisso cancelado: 05/11 às 09:00 com Ana');
  });

  it('sem responsável: "com a equipe"', () => {
    expect(textoDoAviso(aviso({ responsavelNome: null }), hoje)).toBe('Novo compromisso: 05/11 às 09:00 com a equipe');
    expect(textoDoAviso(aviso({ tipo: 'REMARCADO', responsavelNome: '  ' }), hoje)).toBe('Compromisso remarcado: agora 05/11 às 09:00 com a equipe');
  });

  it('o ano só entra quando não é o corrente (o de Brasília)', () => {
    expect(textoDoAviso(aviso({ inicio: '2027-01-10T12:00:00Z' }), hoje)).toBe('Novo compromisso: 10/01/2027 às 09:00 com Ana');
    // 01/01/2027 01:00 UTC ainda é 31/12/2026 22:00 em Brasília: sem ano, e a hora é a de Brasília.
    expect(textoDoAviso(aviso({ inicio: '2027-01-01T01:00:00Z' }), hoje)).toBe('Novo compromisso: 31/12 às 22:00 com Ana');
    // Virada: o corrente é 2027, então 2026 leva o ano.
    expect(textoDoAviso(aviso({ inicio: '2026-12-31T12:00:00Z' }), '2027-01-02')).toBe('Novo compromisso: 31/12/2026 às 09:00 com Ana');
  });

  it('o item: frase no título, selo neutro com o tipo, sem botão de responder e com o id para marcar visto', () => {
    expect(itemDoAviso(aviso({ tipo: 'CANCELADO' }), hoje)).toEqual({
      id: 'v1', tipo: 'CANCELADO', titulo: 'Compromisso cancelado: 05/11 às 09:00 com Ana', detalhe: 'Toque para ver seus compromissos.',
      selo: { texto: 'Cancelado', tipo: 'neutro' }, responder: false,
    });
    expect(itemDoAviso(aviso({ tipo: 'REMARCADO' }), hoje).selo).toEqual({ texto: 'Remarcado', tipo: 'neutro' });
    expect(itemDoAviso(aviso(), hoje).selo).toEqual({ texto: 'Novo', tipo: 'neutro' });
  });

  it('mantém a ordem da API (mais novos primeiro) e limita o que aparece', () => {
    const lista = Array.from({ length: 8 }, (_, i) => aviso({ id: `v${i}`, inicio: `2026-11-0${i + 1}T12:00:00Z` }));
    const { itens, ocultos, total } = avisosDoInicio(lista, hoje);
    expect(itens.map((i) => i.id)).toEqual(['v0', 'v1', 'v2', 'v3', 'v4']);
    expect(itens).toHaveLength(AVISOS_VISIVEIS);
    expect(ocultos).toBe(3);
    expect(total).toBe(8);
  });

  it('sem aviso, nulo ou lista vazia: nada e sem ponto; id repetido e data inválida não entram', () => {
    expect(avisosDoInicio(null, hoje)).toEqual({ itens: [], ocultos: 0, total: 0 });
    expect(avisosDoInicio(undefined, hoje).total).toBe(0);
    expect(avisosDoInicio([], hoje).total).toBe(0);
    expect(avisosDoInicio([aviso(), aviso(), aviso({ id: 'v2', inicio: 'x' })], hoje).total).toBe(1);
    expect(temAvisoDeCompromisso(null)).toBe(false);
    expect(temAvisoDeCompromisso([])).toBe(false);
    expect(temAvisoDeCompromisso([aviso({ inicio: 'x' })])).toBe(false);
    expect(temAvisoDeCompromisso([aviso()])).toBe(true);
  });
});
