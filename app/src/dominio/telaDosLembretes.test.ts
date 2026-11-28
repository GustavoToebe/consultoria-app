import { marcaParaTexto } from '../tema/tokens';
import {
  alternarPonto, diasLembrados, emailDoLembrete, envioLigado, lerDiasDigitados, opcoesDeDias, pontosClicaveis, remetenteDoEmail,
  textoDaOpcaoDeDias, valorDoEmail, type DadosDoEmail,
} from './telaDosLembretes';

// Os mesmos dados e frases de `api/src/test/java/.../pagamentos/TextoDoLembreteTest.java`: a prévia repete o texto do servidor.
const DADOS: DadosDoEmail = {
  nomeDoAluno: 'Ana Maria Teste', nomeDaConsultoria: 'Equipe Fictícia', valorCentavos: 123_456, vencimento: '2027-03-05',
  appUrl: 'https://app.teste.local/', emAberto: 1, mensalidade: true,
};

describe('emailDoLembrete (paridade com TextoDoLembrete.java)', () => {
  it('antes, no dia e depois, com o assunto e o link da Conta', () => {
    const antes = emailDoLembrete('ANTES', DADOS);
    expect(antes.paragrafos.join('\n\n')).toBe('Olá, Ana.\n\nA mensalidade de Equipe Fictícia no valor de R$ 1.234,56 vence em 05/03.\n\n'
      + 'Abra o app para ver como pagar: https://app.teste.local/aluno/conta');
    expect(antes.assunto).toBe('Lembrete de mensalidade - Equipe Fictícia');
    expect(antes.link).toBe('https://app.teste.local/aluno/conta');
    expect(emailDoLembrete('NO_DIA', DADOS).paragrafos[1]).toContain('vence hoje (05/03).');
    expect(emailDoLembrete('DEPOIS', DADOS).paragrafos[1])
      .toContain('venceu em 05/03 e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.');
  });

  it('sem nome, sem consultoria e sem endereço do app', () => {
    const e = emailDoLembrete('ANTES', { ...DADOS, nomeDoAluno: '  ', nomeDaConsultoria: null, valorCentavos: 7, vencimento: '2027-01-01', appUrl: null });
    expect(e.paragrafos.join('\n\n')).toBe('Olá.\n\nA mensalidade de sua consultoria no valor de R$ 0,07 vence em 01/01.');
    expect(e.assunto).toBe('Lembrete de mensalidade');
    expect(e.link).toBeNull();
  });

  it('várias em aberto e avulsa', () => {
    expect(emailDoLembrete('DEPOIS', { ...DADOS, emAberto: 3 }).paragrafos).toContain('Você tem 3 cobranças em aberto no total.');
    const avulsa = emailDoLembrete('ANTES', { ...DADOS, mensalidade: false, valorCentavos: 5000 });
    expect(avulsa.paragrafos[1]).toBe('A cobrança de Equipe Fictícia no valor de R$ 50,00 vence em 05/03.');
    expect(avulsa.assunto).toBe('Lembrete de cobrança - Equipe Fictícia');
  });

  it('quebra de linha no nome da consultoria não entra no assunto', () => {
    expect(emailDoLembrete('ANTES', { ...DADOS, nomeDaConsultoria: 'Treino\r\nBcc: x' }).assunto).toBe('Lembrete de mensalidade - Treino Bcc: x');
  });

  it('a cor da marca no papel branco: os mesmos casos de TextoDoLembreteTest.corDaMarcaComoOApp', () => {
    expect(marcaParaTexto('#FFD60A', '#FFFFFF')).toBe('#856F05');
    expect(marcaParaTexto('#1A1A2E', '#FFFFFF')).toBe('#1A1A2E');
    expect(marcaParaTexto('#22C55E', '#FFFFFF')).toBe('#178640');
    expect(marcaParaTexto('#ffffff', '#FFFFFF')).toBe('#707070');
  });

  it('valor como o servidor', () => {
    expect(valorDoEmail(100_000_000)).toBe('R$ 1.000.000,00');
    expect(valorDoEmail(99)).toBe('R$ 0,99');
  });
});

describe('remetenteDoEmail', () => {
  it('o nome de Contato vence; sem ele, o da consultoria; sem nenhum, só o app', () => {
    expect(remetenteDoEmail('Time Fictício', 'Consultoria X', 'Overtraining')).toBe('Time Fictício via Overtraining');
    expect(remetenteDoEmail('  ', 'Consultoria X', 'Overtraining')).toBe('Consultoria X via Overtraining');
    expect(remetenteDoEmail(null, null, 'Overtraining')).toBe('Overtraining');
  });
});

describe('linha do tempo clicável', () => {
  const dias = { diasAntes: 3, noDia: true, diasDepois: 5 };

  it('três pontos sempre na ordem, com o nome que diz o estado', () => {
    const pontos = pontosClicaveis(dias, diasLembrados(dias));
    expect(pontos.map((p) => p.nome)).toEqual([
      'Lembrete 3 dias antes: ligado', 'Lembrete no vencimento: ligado', 'Lembrete 5 dias depois: ligado',
    ]);
  });

  it('desligar põe 0 e religar volta aos dias lembrados', () => {
    const lembrados = diasLembrados(dias);
    const sem = alternarPonto(dias, 'ANTES', lembrados);
    expect(sem.diasAntes).toBe(0);
    expect(pontosClicaveis(sem, diasLembrados(sem, lembrados))[0]).toMatchObject({ ligado: false, nome: 'Lembrete 3 dias antes: desligado' });
    expect(alternarPonto(sem, 'ANTES', diasLembrados(sem, lembrados)).diasAntes).toBe(3);
    expect(alternarPonto(dias, 'NO_DIA', lembrados).noDia).toBe(false);
    expect(alternarPonto({ ...dias, diasDepois: 0 }, 'DEPOIS', lembrados).diasDepois).toBe(5);
  });

  it('salvo em 0 religa no padrão da API (3) e 1 dia fica no singular', () => {
    const zerado = { diasAntes: 0, noDia: false, diasDepois: 1 };
    const lembrados = diasLembrados(zerado);
    expect(lembrados).toEqual({ antes: 3, depois: 1 });
    expect(pontosClicaveis(zerado, lembrados)[2].rotulo).toBe('1 dia depois');
    expect(envioLigado(zerado, 'ANTES')).toBe(false);
    expect(envioLigado(zerado, 'NO_DIA')).toBe(false);
    expect(envioLigado(zerado, 'DEPOIS')).toBe(true);
  });
});

describe('dias "digite ou escolha"', () => {
  it('opções de 0 ao máximo, o 0 é "Não manda"', () => {
    const opcoes = opcoesDeDias(15);
    expect(opcoes).toHaveLength(16);
    expect(opcoes[0]).toEqual({ valor: 0, rotulo: 'Não manda' });
    expect(opcoes[15].rotulo).toBe('15 dias');
    expect(textoDaOpcaoDeDias(1)).toBe('1 dia');
  });

  it('lê de 0 ao máximo; fora da faixa ou texto não é número', () => {
    expect(lerDiasDigitados(' 0 ', 15)).toBe(0);
    expect(lerDiasDigitados('15', 15)).toBe(15);
    expect(lerDiasDigitados('16', 15)).toBeNull();
    expect(lerDiasDigitados('30', 30)).toBe(30);
    expect(lerDiasDigitados('-1', 30)).toBeNull();
    expect(lerDiasDigitados('3 dias', 30)).toBeNull();
    expect(lerDiasDigitados('', 30)).toBeNull();
  });
});
