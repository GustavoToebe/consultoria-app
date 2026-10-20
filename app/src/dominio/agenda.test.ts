import type { AtualizacaoDaLista } from '../api/tipos';
import { agruparPorDia, compararItens, DIAS_DA_AGENDA, diaDaSemana, hojeDoServidor, resumoDeAtrasadas, rotuloDoDia } from './agenda';

// 2026-10-20 é uma terça-feira.
const HOJE = '2026-10-20';

const item = (nome: string | null, data: string | null, extra: Partial<AtualizacaoDaLista> = {}): AtualizacaoDaLista => ({
  id: null,
  pastaId: `p-${nome ?? 'sem-nome'}-${data ?? 'sem-data'}`,
  alunoId: `a-${nome ?? 'sem-nome'}`,
  nomeAluno: nome,
  dataAtualizacao: data,
  fase: 'ABERTA',
  diasParaData: 0,
  diasDeAtraso: 0,
  atrasoAte: null,
  ...extra,
});

describe('dia da semana e rótulo', () => {
  it('lê o dia civil sem depender do fuso do aparelho', () => {
    expect(diaDaSemana('2026-10-20')).toBe('Terça-feira');
    expect(diaDaSemana('2026-10-22')).toBe('Quinta-feira');
    expect(diaDaSemana('2026-10-25')).toBe('Domingo');
    expect(diaDaSemana('2026-10-24')).toBe('Sábado');
    // Aceita data com hora.
    expect(diaDaSemana('2026-10-26T03:00:00Z')).toBe('Segunda-feira');
  });

  it('Hoje, Amanhã e depois o dia da semana', () => {
    expect(rotuloDoDia('2026-10-20', HOJE)).toBe('Hoje');
    expect(rotuloDoDia('2026-10-21', HOJE)).toBe('Amanhã');
    expect(rotuloDoDia('2026-10-22', HOJE)).toBe('Quinta-feira');
    expect(rotuloDoDia('2026-10-27', HOJE)).toBe('Terça-feira');
  });

  it('Amanhã atravessa o fim do mês e do ano', () => {
    expect(rotuloDoDia('2026-11-01', '2026-10-31')).toBe('Amanhã');
    expect(rotuloDoDia('2027-01-01', '2026-12-31')).toBe('Amanhã');
  });
});

describe('agruparPorDia', () => {
  it('traz os 8 dias da janela, em ordem, com os vazios sem itens', () => {
    const dias = agruparPorDia([], HOJE);
    expect(dias).toHaveLength(DIAS_DA_AGENDA);
    expect(dias.map((d) => d.data)).toEqual([
      '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27',
    ]);
    expect(dias.map((d) => d.rotulo)).toEqual(['Hoje', 'Amanhã', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo', 'Segunda-feira', 'Terça-feira']);
    expect(dias.every((d) => d.itens.length === 0)).toBe(true);
  });

  it('título com a data curta, sem o ano corrente', () => {
    const dias = agruparPorDia([], HOJE);
    expect(dias[0].titulo).toBe('Hoje, 20/10');
    expect(dias[1].titulo).toBe('Amanhã, 21/10');
    expect(dias[2].titulo).toBe('Quinta-feira, 22/10');
  });

  it('agrupa por dataAtualizacao e ordena por nome dentro do dia', () => {
    const itens = [
      item('Zeca', '2026-10-22'),
      item('Ana', '2026-10-20'),
      item('Bruno', '2026-10-22'),
      item('ana clara', '2026-10-22'),
      item('Édson', '2026-10-22'),
    ];
    const dias = agruparPorDia(itens, HOJE);
    expect(dias[0].itens.map((i) => i.nomeAluno)).toEqual(['Ana']);
    expect(dias[1].itens).toEqual([]);
    // Sem acento e sem diferença de caixa: ana clara, Bruno, Édson, Zeca.
    expect(dias[2].itens.map((i) => i.nomeAluno)).toEqual(['ana clara', 'Bruno', 'Édson', 'Zeca']);
  });

  it('não muda a lista recebida', () => {
    const itens = [item('Zeca', '2026-10-22'), item('Ana', '2026-10-22')];
    const copia = [...itens];
    agruparPorDia(itens, HOJE);
    expect(itens).toEqual(copia);
  });

  it('nome ausente conta como "Aluno" e o empate cai na pasta, sempre na mesma ordem', () => {
    const a = item(null, '2026-10-21', { pastaId: 'p2' });
    const b = item('Aluno', '2026-10-21', { pastaId: 'p1' });
    expect(compararItens(a, b)).toBeGreaterThan(0);
    const dias = agruparPorDia([a, b], HOJE);
    expect(dias[1].itens.map((i) => i.pastaId)).toEqual(['p1', 'p2']);
    expect(agruparPorDia([b, a], HOJE)[1].itens.map((i) => i.pastaId)).toEqual(['p1', 'p2']);
  });

  it('data com hora cai no mesmo dia', () => {
    const dias = agruparPorDia([item('Ana', '2026-10-21T00:00:00')], HOJE);
    expect(dias[1].itens).toHaveLength(1);
  });

  it('virada de ano: data com ano diferente do corrente mostra o ano', () => {
    const dias = agruparPorDia([item('Ana', '2027-01-02')], '2026-12-29');
    expect(dias.map((d) => d.data)).toEqual([
      '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05',
    ]);
    expect(dias[1].rotulo).toBe('Amanhã');
    expect(dias[2].rotulo).toBe('Quinta-feira');
    expect(dias[0].titulo).toBe('Hoje, 29/12');
    expect(dias[4].titulo).toBe('Sábado, 02/01/2027');
    expect(dias[4].itens).toHaveLength(1);
  });

  it('atualização fora da janela ganha o próprio dia, no lugar certo, em vez de sumir', () => {
    const dias = agruparPorDia([item('Ana', '2026-10-19'), item('Bia', '2026-10-30')], HOJE);
    expect(dias).toHaveLength(DIAS_DA_AGENDA + 2);
    expect(dias[0].data).toBe('2026-10-19');
    expect(dias[0].rotulo).toBe('Segunda-feira');
    expect(dias[0].itens.map((i) => i.nomeAluno)).toEqual(['Ana']);
    expect(dias.at(-1)?.data).toBe('2026-10-30');
    expect(dias.at(-1)?.itens.map((i) => i.nomeAluno)).toEqual(['Bia']);
  });

  it('atualização sem data vai para um grupo no fim', () => {
    const dias = agruparPorDia([item('Ana', null), item('Bia', '2026-10-20')], HOJE);
    expect(dias).toHaveLength(DIAS_DA_AGENDA + 1);
    const ultimo = dias.at(-1);
    expect(ultimo).toMatchObject({ data: null, rotulo: 'Sem data', titulo: 'Sem data' });
    expect(ultimo?.itens.map((i) => i.nomeAluno)).toEqual(['Ana']);
    expect(dias[0].itens.map((i) => i.nomeAluno)).toEqual(['Bia']);
  });
});

describe('hojeDoServidor', () => {
  it('deduz o dia do servidor por data - diasParaData', () => {
    expect(hojeDoServidor([item('Ana', '2026-10-25', { diasParaData: 5 })])).toBe('2026-10-20');
    expect(hojeDoServidor([item('Ana', '2026-10-20', { diasParaData: 0 })])).toBe('2026-10-20');
    expect(hojeDoServidor([item('Ana', '2027-01-02', { diasParaData: 4 })])).toBe('2026-12-29');
  });

  it('pula quem não dá a conta e devolve nulo sem nenhum', () => {
    expect(hojeDoServidor([])).toBeNull();
    expect(hojeDoServidor([item('Ana', null), item('Bia', '2026-10-22', { diasParaData: 2 })])).toBe('2026-10-20');
    expect(hojeDoServidor([item('Ana', null)])).toBeNull();
  });
});

describe('resumoDeAtrasadas', () => {
  it('só mostra número de verdade e maior que zero', () => {
    expect(resumoDeAtrasadas(1)).toBe('1 atrasada');
    expect(resumoDeAtrasadas(3)).toBe('3 atrasadas');
    expect(resumoDeAtrasadas(0)).toBeNull();
    expect(resumoDeAtrasadas(undefined)).toBeNull();
    expect(resumoDeAtrasadas(null)).toBeNull();
    expect(resumoDeAtrasadas(Number.NaN)).toBeNull();
  });
});
