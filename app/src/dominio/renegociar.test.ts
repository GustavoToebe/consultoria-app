import { ErroApi, MENSAGEM_SEM_CONEXAO } from '@plataforma/web';

import type { CobrancaResponse } from '../api/financeiroTipos';
import {
  nomeNaListaDaCobranca, podeEntrarNoLote, referenciaDaCobranca, rotuloDoTipoDaCobranca, seloDaCobranca, seloDoTipoDaCobranca, temDescricaoPropria,
} from './financeiro';
import {
  corpoDaPrevia, lerAjuste, MENSAGEM_REPETIR_SEM_DOBRAR, mesmaPrevia, MOTIVO_RENEGOCIACAO_AUTOMATICA, motivoDeFicarDeFora,
  motivoDeLoteComAlunosDiferentes, motivoDeRenegociarDesabilitado, motivoDeRenegociarOLoteDesabilitado, oQueAcontece, podeDesfazerAcordo, podeRenegociar,
  rotuloDoConfirmar, separarParaRenegociar, textoDaRenegociacaoFeita, tituloDaRenegociacao, traduzirErroDaRenegociacao, validarCondicoes,
  type CondicoesDigitadas,
} from './renegociar';

const HOJE = '2026-11-18';

type C = Pick<CobrancaResponse, 'id' | 'situacao' | 'tipo' | 'alunoId' | 'alunoNome' | 'versao' | 'cobrancaAutomatica'>;
const c = (id: string, extra: Partial<C> = {}): C => ({ id, situacao: 'ABERTA', tipo: 'MENSALIDADE', alunoId: 'aluno-1', alunoNome: 'Ana', versao: 0, ...extra });

const digitado = (extra: Partial<CondicoesDigitadas> = {}): CondicoesDigitadas => ({
  acrescimoTexto: '', descontoTexto: '', parcelasTexto: '3', primeiroVencimentoTexto: '10/12/2026', motivo: 'Combinado com o aluno', ...extra,
});

describe('quais cobranças entram', () => {
  it('só em aberto (vencida incluída), mensalidade ou avulsa; o resto fica de fora com o motivo', () => {
    expect(motivoDeFicarDeFora({ situacao: 'ABERTA', tipo: 'MENSALIDADE' })).toBeNull();
    expect(motivoDeFicarDeFora({ situacao: 'ABERTA', tipo: 'AVULSA' })).toBeNull();
    expect(motivoDeFicarDeFora({ situacao: 'PAGA', tipo: 'MENSALIDADE' })).toBe('Não está em aberto.');
    expect(motivoDeFicarDeFora({ situacao: 'RENEGOCIADA', tipo: 'AVULSA' })).toBe('Não está em aberto.');
    expect(motivoDeFicarDeFora({ situacao: 'ABERTA', tipo: 'SAIDA' })).toMatch(/saída/);
    expect(motivoDeFicarDeFora({ situacao: 'ABERTA', tipo: 'RENEGOCIACAO' })).toMatch(/parcela de um acordo/);
    expect(podeRenegociar({ situacao: 'ABERTA', tipo: 'AVULSA' })).toBe(true);
    expect(podeRenegociar({ situacao: 'CANCELADA', tipo: 'AVULSA' })).toBe(false);
  });

  it('separa a seleção mantendo a ordem e diz o aluno', () => {
    const s = separarParaRenegociar([c('1'), c('2', { tipo: 'SAIDA' }), c('3', { tipo: 'AVULSA' }), c('4', { tipo: 'RENEGOCIACAO' })]);
    expect(s.entram.map((x) => x.id)).toEqual(['1', '3']);
    expect(s.ficam.map((x) => x.cobranca.id)).toEqual(['2', '4']);
    expect(s.alunoNome).toBe('Ana');
    expect(s.problema).toBeNull();
  });

  it('alunos diferentes bloqueiam sem escolher por ninguém; nenhuma elegível e mais de 100 também', () => {
    const dois = separarParaRenegociar([c('1'), c('2', { alunoId: 'aluno-2', alunoNome: 'Bia' })]);
    expect(dois.problema).toMatch(/alunos diferentes/);
    expect(dois.alunoNome).toBeNull();
    // O mesmo motivo vale antes de abrir a folha (item apagado do "Mais ações"); a de outro aluno que ficaria de fora não conta.
    expect(motivoDeLoteComAlunosDiferentes([c('1'), c('2', { alunoId: 'aluno-2', alunoNome: 'Bia' })])).toBe(dois.problema);
    expect(motivoDeLoteComAlunosDiferentes([c('1'), c('2', { alunoId: 'aluno-2', tipo: 'SAIDA' })])).toBeNull();
    expect(motivoDeLoteComAlunosDiferentes([c('1'), c('3')])).toBeNull();
    // A de outro aluno que já ficaria de fora não conta.
    expect(separarParaRenegociar([c('1'), c('2', { alunoId: 'aluno-2', tipo: 'SAIDA' })]).problema).toBeNull();
    expect(separarParaRenegociar([c('1', { situacao: 'PAGA' })]).problema).toBe('Esta cobrança não pode ser renegociada.');
    expect(separarParaRenegociar([c('1', { situacao: 'PAGA' }), c('2', { tipo: 'SAIDA' })]).problema).toMatch(/Nenhuma das cobranças/);
    expect(separarParaRenegociar(Array.from({ length: 102 }, (_, i) => c(String(i)))).problema).toMatch(/limite é de 100.*Tire 2 cobranças/);
    expect(separarParaRenegociar(Array.from({ length: 100 }, (_, i) => c(String(i)))).problema).toBeNull();
  });

  it('D3: cobrança automática da Kiwify desabilita "Renegociar" com o motivo e barra o lote todo', () => {
    const kiwify = { situacao: 'ABERTA', tipo: 'MENSALIDADE', cobrancaAutomatica: 'KIWIFY' } as const;
    expect(motivoDeRenegociarDesabilitado(kiwify)).toBe(MOTIVO_RENEGOCIACAO_AUTOMATICA);
    expect(MOTIVO_RENEGOCIACAO_AUTOMATICA).toBe('Esta cobrança é cobrada automaticamente pela Kiwify e não pode ser renegociada.');
    // A ação continua existindo (desabilitada); sem a marca, ou sem poder entrar de qualquer forma, nada muda.
    expect(podeRenegociar(kiwify)).toBe(true);
    expect(motivoDeRenegociarDesabilitado({ ...kiwify, cobrancaAutomatica: null })).toBeNull();
    expect(motivoDeRenegociarDesabilitado({ situacao: 'ABERTA', tipo: 'MENSALIDADE' })).toBeNull();
    expect(motivoDeRenegociarDesabilitado({ ...kiwify, situacao: 'PAGA' })).toBeNull();
    expect(motivoDeRenegociarOLoteDesabilitado([c('1'), c('2', { cobrancaAutomatica: 'KIWIFY' })])).toBe(MOTIVO_RENEGOCIACAO_AUTOMATICA);
    expect(motivoDeRenegociarOLoteDesabilitado([c('1'), c('2')])).toBeNull();
    // Na folha: uma automática entre as que entram trava o Continuar com o mesmo motivo, antes até do "alunos diferentes".
    const s = separarParaRenegociar([c('1'), c('2', { cobrancaAutomatica: 'KIWIFY', alunoId: 'aluno-2' })]);
    expect(s.problema).toBe(MOTIVO_RENEGOCIACAO_AUTOMATICA);
    expect(s.entram).toHaveLength(2);
    expect(separarParaRenegociar([c('1', { cobrancaAutomatica: 'KIWIFY' })]).problema).toBe(MOTIVO_RENEGOCIACAO_AUTOMATICA);
    // Automática que já ficaria de fora (paga) não trava as outras.
    expect(separarParaRenegociar([c('1'), c('2', { cobrancaAutomatica: 'KIWIFY', situacao: 'PAGA' })]).problema).toBeNull();
  });

  it('desfazer: original renegociada ou parcela do acordo em aberto, sempre com o acordo', () => {
    expect(podeDesfazerAcordo({ situacao: 'RENEGOCIADA', tipo: 'MENSALIDADE', acordoId: 'x' })).toBe(true);
    expect(podeDesfazerAcordo({ situacao: 'ABERTA', tipo: 'RENEGOCIACAO', acordoId: 'x' })).toBe(true);
    expect(podeDesfazerAcordo({ situacao: 'PAGA', tipo: 'RENEGOCIACAO', acordoId: 'x' })).toBe(false);
    expect(podeDesfazerAcordo({ situacao: 'RENEGOCIADA', tipo: 'MENSALIDADE', acordoId: null })).toBe(false);
    expect(podeDesfazerAcordo({ situacao: 'ABERTA', tipo: 'MENSALIDADE' })).toBe(false);
  });
});

describe('condições', () => {
  it('ajuste vazio ou zero é 0; valor com máscara vira centavos; texto ruim é null', () => {
    expect(lerAjuste('')).toBe(0);
    expect(lerAjuste('  ')).toBe(0);
    expect(lerAjuste('0')).toBe(0);
    expect(lerAjuste('R$ 0,00')).toBe(0);
    expect(lerAjuste('R$ 50,00')).toBe(5_000);
    expect(lerAjuste('1.234,56')).toBe(123_456);
    expect(lerAjuste('abc')).toBeNull();
  });

  it('válidas: monta as condições sem calcular nada', () => {
    expect(validarCondicoes(digitado({ acrescimoTexto: 'R$ 20,00', descontoTexto: '5,50' }), HOJE)).toEqual({
      ok: true, condicoes: { acrescimoCentavos: 2_000, descontoCentavos: 550, parcelas: 3, primeiroVencimento: '2026-12-10', motivo: 'Combinado com o aluno' },
    });
  });

  it('cada campo errado tem a sua mensagem, sem repetir o digitado', () => {
    const r = validarCondicoes(digitado({ acrescimoTexto: 'xx', descontoTexto: '99999999999', parcelasTexto: '13', primeiroVencimentoTexto: '10/12', motivo: '  ' }), HOJE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros.acrescimo).toMatch(/acréscimo inválido/);
    expect(r.erros.desconto).toMatch(/desconto/);
    expect(r.erros.parcelas).toBe('As parcelas vão de 1 a 12.');
    expect(r.erros.primeiroVencimento).toBe('Informe a data completa, como 05/12/2026.');
    expect(r.erros.motivo).toMatch(/motivo/);
    expect(JSON.stringify(r.erros)).not.toContain('99999999999');
    const datas = validarCondicoes(digitado({ primeiroVencimentoTexto: '31/02/2026', parcelasTexto: '0', motivo: 'x'.repeat(301) }), HOJE);
    expect(datas.ok ? null : datas.erros).toMatchObject({ primeiroVencimento: 'Data inválida.', parcelas: 'As parcelas vão de 1 a 12.', motivo: 'O motivo pode ter até 300 caracteres.' });
    const fora = validarCondicoes(digitado({ primeiroVencimentoTexto: '01/01/1999' }), HOJE);
    expect(fora.ok ? null : fora.erros.primeiroVencimento).toMatch(/Primeiro vencimento/);
    expect(validarCondicoes(digitado({ primeiroVencimentoTexto: '' }), HOJE)).toMatchObject({ erros: { primeiroVencimento: 'Informe o primeiro vencimento.' } });
  });

  it('o corpo da prévia leva as versões vistas e não leva o motivo; mesmaPrevia compara o corpo inteiro', () => {
    const r = validarCondicoes(digitado(), HOJE);
    if (!r.ok) throw new Error('condições deveriam valer');
    const corpo = corpoDaPrevia([{ id: 'c1', versao: 2 }, { id: 'c2', versao: 0 }], r.condicoes);
    expect(corpo).toEqual({ itens: [{ cobrancaId: 'c1', versao: 2 }, { cobrancaId: 'c2', versao: 0 }], acrescimoCentavos: 0, descontoCentavos: 0, parcelas: 3, primeiroVencimento: '2026-12-10' });
    expect(mesmaPrevia(corpo, { ...corpo })).toBe(true);
    expect(mesmaPrevia(corpo, { ...corpo, parcelas: 4 })).toBe(false);
    expect(mesmaPrevia(null, corpo)).toBe(false);
  });
});

describe('textos', () => {
  const parcelas = (k: number) => Array.from({ length: k }, (_, i) => ({ numero: i + 1, vencimento: '2026-12-10', valorCentavos: 100, descricao: '' }));
  it('título, botão e aviso dizem o resultado', () => {
    expect(tituloDaRenegociacao(1)).toBe('Renegociar cobrança');
    expect(tituloDaRenegociacao(3)).toBe('Renegociar 3 cobranças');
    expect(rotuloDoConfirmar({ quantidadeDeOriginais: 3, parcelas: parcelas(4) })).toBe('Renegociar 3 cobranças em 4 parcelas');
    expect(rotuloDoConfirmar({ quantidadeDeOriginais: 1, parcelas: parcelas(1) })).toBe('Renegociar 1 cobrança em 1 parcela');
    expect(textoDaRenegociacaoFeita({ renegociadas: 3, parcelas: 4 })).toBe('3 cobranças renegociadas em 4 parcelas.');
    expect(textoDaRenegociacaoFeita({ renegociadas: 1, parcelas: 1 })).toBe('1 cobrança renegociada em 1 parcela.');
  });
  it('o que acontece com as originais e as novas, no singular e no plural', () => {
    const um = oQueAcontece({ quantidadeDeOriginais: 1, parcelas: parcelas(1) });
    expect(um[0]).toMatch(/^A cobrança original passa a “Renegociada”: sai dos totais/);
    expect(um[1]).toMatch(/^Nasce 1 cobrança nova/);
    const varias = oQueAcontece({ quantidadeDeOriginais: 2, parcelas: parcelas(3) });
    expect(varias[0]).toMatch(/^As 2 cobranças originais passam/);
    expect(varias[1]).toMatch(/^Nascem 3 cobranças novas/);
    expect(varias[2]).toMatch(/desfazer/);
  });
});

describe('traduzirErroDaRenegociacao', () => {
  it('422 por campo: itens viram "cobrancas"; campo desconhecido vai ao texto geral; sem campo, a mensagem da API', () => {
    const e = new ErroApi(422, 'RENEGOCIACAO_INVALIDA', 'Dados inválidos.', [
      { field: 'descontoCentavos', message: 'O desconto não pode zerar o total.' },
      { field: 'itens[0]', message: 'Repetida.' },
    ]);
    expect(traduzirErroDaRenegociacao(e, 'previa')).toEqual({
      mensagem: 'Confira os campos destacados.', bloqueia: false, campos: { desconto: 'O desconto não pode zerar o total.', cobrancas: 'Repetida.' },
    });
    expect(traduzirErroDaRenegociacao(new ErroApi(422, 'RENEGOCIACAO_INVALIDA', 'x', [{ field: 'pedidoId', message: 'Pedido inválido.' }]), 'confirmar').mensagem).toBe('Pedido inválido.');
    expect(traduzirErroDaRenegociacao(new ErroApi(422, 'RENEGOCIACAO_INVALIDA', 'Corpo inválido.'), 'previa').mensagem).toBe('Corpo inválido.');
  });
  it('404 e os 409 de dado velho bloqueiam a folha e dizem que nada foi renegociado', () => {
    for (const [status, codigo] of [[404, 'NAO_ENCONTRADO'], [404, 'COBRANCA_NAO_ENCONTRADA'], [409, 'CONFLITO_EDICAO'], [409, 'COBRANCA_NAO_ABERTA'],
      [409, 'COBRANCAS_DE_ALUNOS_DIFERENTES'], [409, 'COBRANCA_NAO_RENEGOCIAVEL'], [409, 'ALUNO_INATIVO'], [409, 'ALUNO_ANONIMIZADO'], [404, null]] as const) {
      const t = traduzirErroDaRenegociacao(new ErroApi(status, codigo, 'detalhe interno'), 'confirmar');
      expect(t.bloqueia).toBe(true);
      expect(t.mensagem).toContain('Nada foi renegociado');
      expect(t.mensagem).not.toContain('detalhe interno');
    }
  });
  it('409 RENEGOCIACAO_COBRANCA_AUTOMATICA mostra a mensagem da API, bloqueia a folha e não diz que a lista foi atualizada', () => {
    for (const fase of ['previa', 'confirmar'] as const) {
      expect(traduzirErroDaRenegociacao(new ErroApi(409, 'RENEGOCIACAO_COBRANCA_AUTOMATICA', 'Mensagem da API.'), fase)).toEqual({
        mensagem: 'Mensagem da API.', campos: {}, bloqueia: true,
      });
    }
    expect(traduzirErroDaRenegociacao(new ErroApi(409, 'RENEGOCIACAO_COBRANCA_AUTOMATICA', ''), 'confirmar').mensagem).toBe(MOTIVO_RENEGOCIACAO_AUTOMATICA);
  });
  it('403 e 503 do financeiro mostram a frase da API; sem conexão e erro desconhecido dependem da fase', () => {
    expect(traduzirErroDaRenegociacao(new ErroApi(403, 'PERMISSAO_NEGADA', 'Você não pode alterar o financeiro.'), 'previa').mensagem).toBe('Você não pode alterar o financeiro.');
    expect(traduzirErroDaRenegociacao(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'O financeiro está desligado.'), 'confirmar').mensagem).toBe('O financeiro está desligado.');
    expect(traduzirErroDaRenegociacao(new ErroApi(0, null, MENSAGEM_SEM_CONEXAO), 'previa').mensagem).toBe('Sem conexão com o servidor. Confira a internet e tente de novo.');
    expect(traduzirErroDaRenegociacao(new ErroApi(0, null, MENSAGEM_SEM_CONEXAO), 'confirmar').mensagem).toBe(`Sem conexão com o servidor. ${MENSAGEM_REPETIR_SEM_DOBRAR}`);
    expect(traduzirErroDaRenegociacao(new ErroApi(500, null, 'detalhe interno'), 'previa').mensagem).toBe('Não foi possível calcular a prévia agora. Tente de novo.');
    expect(traduzirErroDaRenegociacao(new Error('boom'), 'confirmar')).toEqual({ mensagem: MENSAGEM_REPETIR_SEM_DOBRAR, campos: {}, bloqueia: false });
  });
});

describe('situação e tipo novos nas listas (dominio/financeiro)', () => {
  it('Renegociada é neutra e não entra no lote; a parcela do acordo tem o selo Acordo e a descrição do servidor', () => {
    expect(seloDaCobranca({ situacao: 'RENEGOCIADA', vencida: true })).toEqual({ tom: 'neutro', rotulo: 'Renegociada' });
    expect(podeEntrarNoLote({ situacao: 'RENEGOCIADA' })).toBe(false);
    expect(seloDoTipoDaCobranca('RENEGOCIACAO')).toEqual({ tom: 'neutro', rotulo: 'Acordo' });
    expect(rotuloDoTipoDaCobranca('RENEGOCIACAO')).toBe('Parcela do acordo');
    expect(temDescricaoPropria('RENEGOCIACAO')).toBe(true);
    expect(temDescricaoPropria('MENSALIDADE')).toBe(false);
    const parcela = { tipo: 'RENEGOCIACAO' as const, planoNome: null, competencia: null, descricao: 'Renegociação (Parcela 1/3)' };
    expect(nomeNaListaDaCobranca(parcela)).toBe('Renegociação (Parcela 1/3)');
    expect(referenciaDaCobranca(parcela)).toBe('Renegociação (Parcela 1/3)');
    expect(nomeNaListaDaCobranca({ ...parcela, descricao: null })).toBe('Parcela do acordo');
  });
});
