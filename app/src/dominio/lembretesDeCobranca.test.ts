import type { LembreteDaCobranca } from '../api/financeiroTipos';
import {
  ajustarDias, botaoDoWhatsApp, linkDoWhatsApp, MOTIVO_ALUNO_INATIVO, MOTIVO_SEM_TELEFONE, numeroDoWhatsApp, pontosDaLinhaDoTempo,
  resumoDosLembretes, rotuloDoTipo, situacaoDoLembrete, STATUS_DESLIGADOS, STATUS_LIGADOS, STATUS_LIGADOS_SEM_EMAIL, statusDosLembretes,
  textoDaLinhaDoTempo, textoDosDias,
} from './lembretesDeCobranca';

const lembrete = (parcial: Partial<LembreteDaCobranca>): LembreteDaCobranca => ({
  id: 'l1', tipo: 'ANTES', situacao: 'PENDENTE', motivo: null, dataPrevista: '2027-03-07', enviadoEm: null,
  atualizadoEm: '2027-03-07T12:00:00Z', ...parcial,
});

// Lembretes e recebimento (19/11): o passo de dias substituiu o campo digitado (`lerDias` saiu).
describe('ajustarDias e textoDosDias', () => {
  it('prende o passo de 0 ao máximo, sempre inteiro', () => {
    expect(ajustarDias(3, 1, 15)).toBe(4);
    expect(ajustarDias(0, -1, 15)).toBe(0);
    expect(ajustarDias(15, 1, 15)).toBe(15);
    expect(ajustarDias(28, 5, 30)).toBe(30);
    expect(ajustarDias(3, -15, 30)).toBe(0);
  });
  it('0 é "não manda"; 1 dia no singular', () => {
    expect(textoDosDias(0)).toBe('não manda');
    expect(textoDosDias(1)).toBe('1 dia');
    expect(textoDosDias(3)).toBe('3 dias');
  });
});

describe('linha do tempo dos lembretes', () => {
  it('o ponto que não manda some, na ordem do eixo', () => {
    expect(pontosDaLinhaDoTempo({ diasAntes: 3, noDia: true, diasDepois: 3 }).map((p) => p.rotulo)).toEqual(['3 dias antes', 'No vencimento', '3 dias depois']);
    expect(pontosDaLinhaDoTempo({ diasAntes: 1, noDia: false, diasDepois: 0 }).map((p) => p.rotulo)).toEqual(['1 dia antes']);
    expect(pontosDaLinhaDoTempo({ diasAntes: 0, noDia: true, diasDepois: 0 }).map((p) => p.tipo)).toEqual(['NO_DIA']);
    expect(pontosDaLinhaDoTempo({ diasAntes: 0, noDia: false, diasDepois: 0 })).toEqual([]);
  });
  it('o texto equivalente diz o mesmo que o eixo', () => {
    expect(textoDaLinhaDoTempo({ diasAntes: 3, noDia: true, diasDepois: 3 })).toBe('Lembretes 3 dias antes, no dia e 3 dias depois do vencimento.');
    expect(textoDaLinhaDoTempo({ diasAntes: 1, noDia: false, diasDepois: 0 })).toBe('Lembretes 1 dia antes do vencimento.');
    expect(textoDaLinhaDoTempo({ diasAntes: 0, noDia: true, diasDepois: 0 })).toBe('Lembretes no dia do vencimento.');
    expect(textoDaLinhaDoTempo({ diasAntes: 0, noDia: false, diasDepois: 0 })).toMatch(/^Nenhum lembrete escolhido: /);
  });
});

describe('statusDosLembretes', () => {
  it('diz o que está na tela, sem prometer envio com o e-mail do app desligado', () => {
    expect(statusDosLembretes(true, true)).toBe(STATUS_LIGADOS);
    expect(statusDosLembretes(false, true)).toBe(STATUS_DESLIGADOS);
    expect(statusDosLembretes(false, false)).toBe(STATUS_DESLIGADOS);
    expect(statusDosLembretes(true, false)).toBe(STATUS_LIGADOS_SEM_EMAIL);
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
    expect(situacaoDoLembrete(lembrete({}))).toMatchObject({ selo: 'Agendado', tom: 'neutro' });
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
    expect(botaoDoWhatsApp({ itens: [], whatsapp: null, motivoSemWhatsapp: null, alunoDesligou: false })).toBeNull();
    expect(botaoDoWhatsApp({ itens: [], whatsapp: { telefone: null, mensagem: 'Oi' }, motivoSemWhatsapp: null, alunoDesligou: false })).toEqual({ link: null, motivo: MOTIVO_SEM_TELEFONE });
    expect(botaoDoWhatsApp({ itens: [], whatsapp: { telefone: '(45) 99999-8888', mensagem: 'Oi' }, motivoSemWhatsapp: null, alunoDesligou: true }))
      .toEqual({ link: 'https://wa.me/5545999998888?text=Oi', motivo: null });
  });

  it('o motivo da API decide: inativo fica desabilitado com o porquê; cobrança não aberta e anonimizado não mostram botão', () => {
    const sem = (motivoSemWhatsapp: 'COBRANCA_NAO_ABERTA' | 'ALUNO_ANONIMIZADO' | 'ALUNO_INATIVO' | null) => ({ itens: [], whatsapp: null, motivoSemWhatsapp, alunoDesligou: false });
    expect(botaoDoWhatsApp(sem('ALUNO_INATIVO'))).toEqual({ link: null, motivo: MOTIVO_ALUNO_INATIVO });
    expect(botaoDoWhatsApp(sem('COBRANCA_NAO_ABERTA'))).toBeNull();
    expect(botaoDoWhatsApp(sem('ALUNO_ANONIMIZADO'))).toBeNull();
    expect(botaoDoWhatsApp(sem(null))).toBeNull();
    expect(MOTIVO_ALUNO_INATIVO).toMatch(/inativo/);
  });
});
