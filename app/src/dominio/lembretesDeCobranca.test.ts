import type { LembreteDaCobranca } from '../api/financeiroTipos';
import {
  botaoDoWhatsApp, lerDias, linkDoWhatsApp, MOTIVO_SEM_TELEFONE, numeroDoWhatsApp, resumoDosLembretes, rotuloDoTipo,
  situacaoDoLembrete,
} from './lembretesDeCobranca';

const lembrete = (parcial: Partial<LembreteDaCobranca>): LembreteDaCobranca => ({
  id: 'l1', tipo: 'ANTES', situacao: 'PENDENTE', motivo: null, dataPrevista: '2027-03-07', enviadoEm: null,
  atualizadoEm: '2027-03-07T12:00:00Z', ...parcial,
});

describe('lerDias', () => {
  it('aceita de 0 ao máximo e recusa o resto sem virar 0', () => {
    expect(lerDias('0', 15)).toEqual({ valor: 0, erro: null });
    expect(lerDias(' 15 ', 15)).toEqual({ valor: 15, erro: null });
    expect(lerDias('16', 15).valor).toBeNull();
    expect(lerDias('', 15).erro).toBe('Use um número de 0 a 15.');
    expect(lerDias('-1', 30).valor).toBeNull();
    expect(lerDias('2,5', 30).valor).toBeNull();
  });
});

describe('resumoDosLembretes', () => {
  it('descreve o que está ligado', () => {
    expect(resumoDosLembretes({ ligado: false, diasAntes: 3, noDia: true, diasDepois: 3 })).toBe('Desligados');
    expect(resumoDosLembretes({ ligado: true, diasAntes: 3, noDia: true, diasDepois: 3 })).toBe('3 dias antes, no dia e 3 dias depois');
    expect(resumoDosLembretes({ ligado: true, diasAntes: 1, noDia: false, diasDepois: 0 })).toBe('1 dia antes');
    expect(resumoDosLembretes({ ligado: true, diasAntes: 0, noDia: true, diasDepois: 5 })).toBe('No dia e 5 dias depois');
    expect(resumoDosLembretes({ ligado: true, diasAntes: 0, noDia: false, diasDepois: 0 })).toBe('Nenhum lembrete escolhido');
  });
});

describe('situacaoDoLembrete', () => {
  it('enviado mostra a data de Brasília do envio', () => {
    // 02:00 UTC de 08/03 ainda é 07/03 em Brasília.
    const s = situacaoDoLembrete(lembrete({ situacao: 'ENVIADO', enviadoEm: '2027-03-08T02:00:00Z' }));
    expect(s).toEqual({ selo: 'Enviado', tom: 'sucesso', texto: 'Enviado em 07/03/2027' });
  });

  it('agendado, falhou e cancelado com o motivo em palavras', () => {
    expect(situacaoDoLembrete(lembrete({})).selo).toBe('Agendado');
    expect(situacaoDoLembrete(lembrete({ situacao: 'FALHOU' })).tom).toBe('perigo');
    expect(situacaoDoLembrete(lembrete({ situacao: 'CANCELADO', motivo: 'SEM_EMAIL' })).texto).toBe('Não enviado: o aluno não tem e-mail');
    expect(situacaoDoLembrete(lembrete({ situacao: 'CANCELADO', motivo: 'OUTRO' })).texto).toBe('Não enviado');
    expect(rotuloDoTipo('NO_DIA')).toBe('No dia do vencimento');
  });
});

describe('WhatsApp', () => {
  it('monta o número com 55 a partir do telefone gravado', () => {
    expect(numeroDoWhatsApp('(45) 99999-8888')).toBe('5545999998888');
    expect(numeroDoWhatsApp('(45) 3333-4444')).toBe('554533334444');
    expect(numeroDoWhatsApp('+55 45 99999-8888')).toBe('5545999998888');
    expect(numeroDoWhatsApp('999')).toBeNull();
    expect(numeroDoWhatsApp(null)).toBeNull();
  });

  it('codifica a mensagem no link (acentos, quebras e &)', () => {
    const link = linkDoWhatsApp('(45) 99999-8888', 'Olá, Ana.\n\nR$ 150,00 & mais');
    expect(link).toBe('https://wa.me/5545999998888?text=Ol%C3%A1%2C%20Ana.%0A%0AR%24%20150%2C00%20%26%20mais');
    expect(linkDoWhatsApp('(45) 99999-8888', '  ')).toBeNull();
  });

  it('o botão some sem mensagem e fica desabilitado sem telefone', () => {
    expect(botaoDoWhatsApp(undefined)).toBeNull();
    expect(botaoDoWhatsApp({ itens: [], whatsapp: null })).toBeNull();
    expect(botaoDoWhatsApp({ itens: [], whatsapp: { telefone: null, mensagem: 'Oi' } })).toEqual({ link: null, motivo: MOTIVO_SEM_TELEFONE });
    expect(botaoDoWhatsApp({ itens: [], whatsapp: { telefone: '(45) 99999-8888', mensagem: 'Oi' } }))
      .toEqual({ link: 'https://wa.me/5545999998888?text=Oi', motivo: null });
  });
});
