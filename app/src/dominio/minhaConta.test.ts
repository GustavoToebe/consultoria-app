import {
  competenciaParaTela,
  contatosOrdenados,
  enderecoParaTela,
  estadoDoConsumoParaTela,
  fracaoDoConsumo,
  moedaParaTela,
  periodicidadeParaTela,
  resumoFinanceiro,
  situacaoComercialParaTela,
  situacaoDaCobrancaParaTela,
  usoParaTela,
} from './minhaConta';
import type { CobrancaDaConta } from '../api/tipos';

const cobranca = (situacao: CobrancaDaConta['situacao'], vencida = false): CobrancaDaConta => ({
  id: 'x', competenciaInicio: '2026-09-01', competenciaFim: '2026-09-30', vencimento: '2026-09-10',
  valor: 150, situacao, vencida, pagoEm: null,
});

describe('moeda', () => {
  it('usa vírgula, ponto de milhar e duas casas', () => {
    expect(moedaParaTela(150)).toBe('R$ 150,00');
    expect(moedaParaTela(1234.5)).toBe('R$ 1.234,50');
    expect(moedaParaTela(1234567.891)).toBe('R$ 1.234.567,89');
    expect(moedaParaTela(0)).toBe('R$ 0,00');
  });
  it('ausência é "—", não zero', () => {
    expect(moedaParaTela(null)).toBe('—');
    expect(moedaParaTela(undefined)).toBe('—');
  });
});

describe('rótulos da contratação', () => {
  it('periodicidade em português; ausente = "—"', () => {
    expect(periodicidadeParaTela('MENSAL')).toBe('Mensal');
    expect(periodicidadeParaTela('ANUAL')).toBe('Anual');
    expect(periodicidadeParaTela(null)).toBe('—');
  });
  it('situação comercial: ativa verde, inadimplente/bloqueada vermelho, resto neutro ou âmbar', () => {
    expect(situacaoComercialParaTela('ATIVA')).toEqual({ texto: 'Ativa', tipo: 'sucesso' });
    expect(situacaoComercialParaTela('TRIAL').tipo).toBe('atencao');
    expect(situacaoComercialParaTela('INADIMPLENTE').tipo).toBe('perigo');
    expect(situacaoComercialParaTela('BLOQUEADA').tipo).toBe('perigo');
    expect(situacaoComercialParaTela('CANCELADA').tipo).toBe('neutro');
    expect(situacaoComercialParaTela(null)).toEqual({ texto: '—', tipo: 'neutro' });
  });
});

describe('cobranças', () => {
  it('vencida vence a situação gravada', () => {
    expect(situacaoDaCobrancaParaTela(cobranca('ABERTA', true))).toEqual({ texto: 'Vencida', tipo: 'perigo' });
    expect(situacaoDaCobrancaParaTela(cobranca('ABERTA'))).toEqual({ texto: 'Em aberto', tipo: 'atencao' });
    expect(situacaoDaCobrancaParaTela(cobranca('PAGA'))).toEqual({ texto: 'Paga', tipo: 'sucesso' });
    expect(situacaoDaCobrancaParaTela(cobranca('CANCELADA')).tipo).toBe('neutro');
    expect(situacaoDaCobrancaParaTela(cobranca('ISENTA')).texto).toBe('Isenta');
  });
  it('competência de um mês e de vários', () => {
    expect(competenciaParaTela('2026-09-01', '2026-09-30')).toBe('09/2026');
    expect(competenciaParaTela('2026-07-01', '2026-09-30')).toBe('07/2026 a 09/2026');
  });
  it('resumo conta abertas e vencidas', () => {
    const lista = [cobranca('PAGA'), cobranca('ABERTA', true), cobranca('ABERTA'), cobranca('ISENTA')];
    expect(resumoFinanceiro(lista)).toEqual({ emAberto: 2, vencidas: 1 });
    expect(resumoFinanceiro([])).toEqual({ emAberto: 0, vencidas: 0 });
  });
});

describe('cadastro', () => {
  it('endereço sem partes vazias', () => {
    expect(enderecoParaTela({
      logradouro: 'Rua Exemplo', numero: '100', complemento: null, bairro: 'Centro', cidade: 'Cidade', uf: 'SP', cep: '00000-000',
    })).toEqual(['Rua Exemplo, 100 - Centro', 'Cidade/SP - 00000-000']);
    expect(enderecoParaTela({
      logradouro: null, numero: null, complemento: null, bairro: null, cidade: 'Cidade', uf: null, cep: null,
    })).toEqual(['Cidade']);
    expect(enderecoParaTela(null)).toEqual([]);
  });
  it('contato principal primeiro, sem perder a ordem dos outros', () => {
    const c = (nome: string, principal: boolean) => ({ nome, email: null, telefone: null, principal });
    expect(contatosOrdenados([c('A', false), c('B', true), c('C', false)]).map((x) => x.nome)).toEqual(['B', 'A', 'C']);
  });
});

describe('consumo do plano', () => {
  it('estado vira texto e selo', () => {
    expect(estadoDoConsumoParaTela('DISPONIVEL').tipo).toBe('sucesso');
    expect(estadoDoConsumoParaTela('ATENCAO').tipo).toBe('atencao');
    expect(estadoDoConsumoParaTela('ATINGIDO').tipo).toBe('atencao');
    expect(estadoDoConsumoParaTela('EXCEDIDO').tipo).toBe('perigo');
    expect(estadoDoConsumoParaTela('SEM_LIMITE_CONFIGURADO')).toEqual({ texto: 'Sem limite configurado', tipo: 'neutro' });
  });
  it('uso: "12 de 150" ou só o número sem limite', () => {
    expect(usoParaTela({ usado: 12, limite: 150 })).toBe('12 de 150');
    expect(usoParaTela({ usado: 12, limite: null })).toBe('12');
    expect(usoParaTela({ usado: 0, limite: 0 })).toBe('0 de 0');
  });
  it('fração da barra: limitada a 1 e ausente sem limite', () => {
    expect(fracaoDoConsumo({ usado: 75, limite: 150 })).toBe(0.5);
    expect(fracaoDoConsumo({ usado: 200, limite: 150 })).toBe(1);
    expect(fracaoDoConsumo({ usado: 5, limite: null })).toBeNull();
    expect(fracaoDoConsumo({ usado: 0, limite: 0 })).toBeNull();
  });
});
