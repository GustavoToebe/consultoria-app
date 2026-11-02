import { formularioNovo, pedidoDoFormulario } from './agendaPresencial';
import {
  dataDaTelaNaFaixa, dataNaFaixa, erroDaData, faixaDaRegra, mensagemDaFaixa, regraDaPerguntaData,
} from './datasValidas';
import { dataDaTela, mascaraData } from './formatos';

const HOJE = '2026-11-02';

/** Como "digitar" no campo: cada caractere passa pela máscara, como no `CampoData`. */
function digitar(texto: string): string {
  return [...texto].reduce((atual, c) => mascaraData(atual + c), '');
}

describe('reprodução do ano 0260 (C76)', () => {
  beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date(2026, 10, 2, 12)); });
  afterEach(() => { jest.useRealTimers(); });

  it('apagar um dígito do ano e completar de novo deixa o ano 0260 passar pela máscara e por dataDaTela', () => {
    // "01/11/2026": a pessoa apaga o ano e escreve "0260". A máscara só confere dígitos e barras; dataDaTela aceita 0100-9999.
    expect(mascaraData('01/11/026')).toBe('01/11/026');
    expect(mascaraData('01/11/0260')).toBe('01/11/0260');
    expect(dataDaTela(digitar('01110260'))).toBe('0260-11-01');
  });

  it('o formulário do compromisso recusa a data digitada com ano 0260 (no campo, e sem pedido para enviar)', () => {
    const f = { ...formularioNovo('r1', '2026-11-10'), alunoIds: ['a1'], hora: '09:00', data: digitar('01110260') };
    const { erros, pedido } = pedidoDoFormulario(f, false);
    expect(pedido).toBeNull();
    expect(erros.data).toBe('Data do compromisso: use uma data entre 01/01/2000 e 31/12/2031');
  });
});

describe('faixa por regra', () => {
  it('planejamento: 01/01/2000 até 31/12 do ano de hoje + 5', () => {
    expect(faixaDaRegra('PLANEJAMENTO', HOJE)).toEqual({ minimo: '2000-01-01', maximo: '2031-12-31' });
    expect(dataNaFaixa('2000-01-01', 'PLANEJAMENTO', HOJE)).toBe(true);
    expect(dataNaFaixa('1999-12-31', 'PLANEJAMENTO', HOJE)).toBe(false);
    expect(dataNaFaixa('2031-12-31', 'PLANEJAMENTO', HOJE)).toBe(true);
    expect(dataNaFaixa('2032-01-01', 'PLANEJAMENTO', HOJE)).toBe(false);
    expect(dataNaFaixa('0261-05-05', 'PLANEJAMENTO', HOJE)).toBe(false);
  });

  it('registro: 01/01/1900 até hoje, sem futuro', () => {
    expect(faixaDaRegra('REGISTRO', HOJE)).toEqual({ minimo: '1900-01-01', maximo: HOJE });
    expect(dataNaFaixa('1900-01-01', 'REGISTRO', HOJE)).toBe(true);
    expect(dataNaFaixa('1899-12-31', 'REGISTRO', HOJE)).toBe(false);
    expect(dataNaFaixa(HOJE, 'REGISTRO', HOJE)).toBe(true);
    expect(dataNaFaixa('2026-11-03', 'REGISTRO', HOJE)).toBe(false);
  });

  it('pergunta DATA: só passado vira registro; sem isso vai até o ano de hoje + 5', () => {
    expect(regraDaPerguntaData(true)).toBe('REGISTRO');
    expect(regraDaPerguntaData(false)).toBe('DATA_COM_FUTURO');
    expect(regraDaPerguntaData(undefined)).toBe('DATA_COM_FUTURO');
    expect(faixaDaRegra('DATA_COM_FUTURO', HOJE)).toEqual({ minimo: '1900-01-01', maximo: '2031-12-31' });
    expect(dataNaFaixa('1960-03-10', 'DATA_COM_FUTURO', HOJE)).toBe(true);
    expect(dataNaFaixa('2032-01-01', 'DATA_COM_FUTURO', HOJE)).toBe(false);
  });

  it('a faixa acompanha o ano de hoje (virada de ano)', () => {
    expect(faixaDaRegra('PLANEJAMENTO', '2027-01-01').maximo).toBe('2032-12-31');
    expect(faixaDaRegra('PLANEJAMENTO', '2026-12-31').maximo).toBe('2031-12-31');
  });
});

describe('mensagens', () => {
  it('nomeiam o campo e a faixa', () => {
    expect(mensagemDaFaixa('Início da pasta', 'PLANEJAMENTO', HOJE)).toBe('Início da pasta: use uma data entre 01/01/2000 e 31/12/2031');
    expect(mensagemDaFaixa('Data do peso', 'REGISTRO', HOJE)).toBe('Data do peso: use uma data entre 01/01/1900 e hoje');
  });

  it('erroDaData fica quieto até as 10 posições e nunca repete o valor digitado', () => {
    expect(erroDaData('', 'Início da pasta', 'PLANEJAMENTO', HOJE)).toBeNull();
    expect(erroDaData('01/11/02', 'Início da pasta', 'PLANEJAMENTO', HOJE)).toBeNull();
    expect(erroDaData('31/02/2027', 'Início da pasta', 'PLANEJAMENTO', HOJE)).toBe('Data inválida.');
    expect(erroDaData('01/11/2026', 'Início da pasta', 'PLANEJAMENTO', HOJE)).toBeNull();
    const msg = erroDaData('01/11/0260', 'Início da pasta', 'PLANEJAMENTO', HOJE);
    expect(msg).toBe('Início da pasta: use uma data entre 01/01/2000 e 31/12/2031');
    expect(msg).not.toContain('0260');
    expect(erroDaData('03/11/2026', 'Data do peso', 'REGISTRO', HOJE)).toBe('Data do peso: use uma data entre 01/01/1900 e hoje');
  });
});

describe('dataDaTelaNaFaixa', () => {
  it('vazio → null; incompleta, impossível ou fora da faixa → undefined; dentro → ISO', () => {
    expect(dataDaTelaNaFaixa('', 'PLANEJAMENTO', HOJE)).toBeNull();
    expect(dataDaTelaNaFaixa('01/11/02', 'PLANEJAMENTO', HOJE)).toBeUndefined();
    expect(dataDaTelaNaFaixa('31/02/2027', 'PLANEJAMENTO', HOJE)).toBeUndefined();
    expect(dataDaTelaNaFaixa('01/11/0260', 'PLANEJAMENTO', HOJE)).toBeUndefined();
    expect(dataDaTelaNaFaixa('01/01/2032', 'PLANEJAMENTO', HOJE)).toBeUndefined();
    expect(dataDaTelaNaFaixa('31/12/2031', 'PLANEJAMENTO', HOJE)).toBe('2031-12-31');
    expect(dataDaTelaNaFaixa('03/11/2026', 'REGISTRO', HOJE)).toBeUndefined();
    expect(dataDaTelaNaFaixa('02/11/2026', 'REGISTRO', HOJE)).toBe('2026-11-02');
  });
});
