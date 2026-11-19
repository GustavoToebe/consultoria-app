import type { CobrancaDoAluno } from '../api/financeiroTipos';
import { motivoDoItemDaAcao } from './acoesEmLote';
import {
  acoesDePagamentoDoAluno, comoPagar, FORMAS_MANUAIS, pagamentoPendente, rotuloDaForma, rotuloDoMotivoDaConferencia, textoDasAbertasDoAluno,
  TEXTO_COMBINE_COM_O_TREINADOR,
} from './financeiro';
import {
  CAMPOS_DA_KIWIFY, clientIdParaTela, corpoDaKiwify, ehCobradaPelaKiwify, kiwifyDoPlanoParaEnvio, mensagemDoErroDaKiwify, MOTIVOS_DA_KIWIFY,
  perdeAKiwify, planoPodeTerKiwify, rotuloDoProvedor, TOKEN_MINIMO, validarCredenciaisKiwify, validarProdutoKiwify, VALORES_VAZIOS,
} from './kiwify';

// Só valores fictícios: nenhum é credencial de verdade.
const TOKEN = 'token-de-teste-bem-longo-1234';
const VALIDOS = { tokenDoWebhook: TOKEN, clientId: 'cliente-teste-a1b2', clientSecret: 'segredo-de-teste-xyz', accountId: 'conta-teste-9' };

describe('validarCredenciaisKiwify', () => {
  it('criando: os quatro são obrigatórios, cada um com a sua mensagem', () => {
    const { campos, nada } = validarCredenciaisKiwify(VALORES_VAZIOS, true);
    expect(Object.keys(campos).sort()).toEqual([...CAMPOS_DA_KIWIFY].sort());
    expect(campos.clientSecret).toBe('Informe o Client secret.');
    expect(nada).toBe(false);
  });

  it('criando com os quatro válidos: sem erro', () => {
    expect(validarCredenciaisKiwify(VALIDOS, true).campos).toEqual({});
  });

  it('token curto, espaço no meio e tamanho demais; nenhuma mensagem repete o valor digitado', () => {
    const valores = { ...VALIDOS, tokenDoWebhook: 'curto-demais', clientId: 'tem espaco', accountId: 'x'.repeat(201) };
    const { campos } = validarCredenciaisKiwify(valores, true);
    expect(campos.tokenDoWebhook).toBe(`Use pelo menos ${TOKEN_MINIMO} caracteres.`);
    expect(campos.clientId).toMatch(/Sem espaços/);
    expect(campos.accountId).toBe('Use até 200 caracteres.');
    for (const m of Object.values(campos)) {
      expect(m).not.toContain('curto-demais');
      expect(m).not.toContain('tem espaco');
      expect(m).not.toContain('xxxx');
    }
  });

  it('caractere de controle é recusado (cópia com lixo do painel)', () => {
    expect(validarCredenciaisKiwify({ ...VALIDOS, clientSecret: 'abc\u0007def' }, true).campos.clientSecret).toMatch(/Sem espaços/);
  });

  it('trocando: em branco mantém o gravado; nada digitado = `nada`; só o digitado é conferido', () => {
    expect(validarCredenciaisKiwify(VALORES_VAZIOS, false)).toEqual({ campos: {}, nada: true });
    const so = validarCredenciaisKiwify({ ...VALORES_VAZIOS, tokenDoWebhook: 'curto' }, false);
    expect(so.nada).toBe(false);
    expect(Object.keys(so.campos)).toEqual(['tokenDoWebhook']);
  });
});

describe('corpoDaKiwify', () => {
  it('leva só o que foi digitado, sem espaço nas pontas, e a versão', () => {
    expect(corpoDaKiwify({ ...VALORES_VAZIOS, clientSecret: '  novo-segredo-teste  ' }, 3)).toEqual({ clientSecret: 'novo-segredo-teste', versao: 3 });
    expect(corpoDaKiwify(VALIDOS, null)).toEqual({ ...VALIDOS, versao: null });
  });
});

describe('máscaras e textos', () => {
  it('clientIdParaTela: só os 4 finais, nunca o id inteiro; sem dado, "—"', () => {
    expect(clientIdParaTela('a1b2')).toBe('termina em a1b2');
    expect(clientIdParaTela('cliente-inteiro-a1b2')).toBe('termina em a1b2');
    expect(clientIdParaTela(null)).toBe('—');
    expect(clientIdParaTela('  ')).toBe('—');
  });

  it('erros com texto próprio: chave desligada e cobrança automática; o resto fica com a API', () => {
    expect(mensagemDoErroDaKiwify('KIWIFY_INDISPONIVEL')).toMatch(/não está disponível/);
    expect(mensagemDoErroDaKiwify('COBRANCA_AUTOMATICA')).toMatch(/cobrada pela Kiwify/);
    expect(mensagemDoErroDaKiwify('KIWIFY_INVALIDA')).toBeNull();
    expect(mensagemDoErroDaKiwify(null)).toBeNull();
  });

  it('motivos da conferência: os sete da Kiwify em português, a falha de consulta cita o provedor certo', () => {
    for (const m of Object.keys(MOTIVOS_DA_KIWIFY) as (keyof typeof MOTIVOS_DA_KIWIFY)[]) {
      expect(rotuloDoMotivoDaConferencia(m, 'KIWIFY')).toBe(MOTIVOS_DA_KIWIFY[m]);
      expect(rotuloDoMotivoDaConferencia(m, 'KIWIFY')).not.toMatch(/KIWIFY_/);
    }
    expect(rotuloDoMotivoDaConferencia('KIWIFY_EMAIL_DE_VARIOS_ALUNOS', 'KIWIFY')).toBe('O e-mail da compra é de mais de um aluno');
    expect(rotuloDoMotivoDaConferencia('CONSULTA_FALHOU', 'KIWIFY')).toMatch(/Kiwify/);
    expect(rotuloDoMotivoDaConferencia('CONSULTA_FALHOU')).toMatch(/InfinitePay/);
    expect(rotuloDoMotivoDaConferencia('VALOR_DIFERENTE', 'KIWIFY')).toBe('Valor diferente do combinado');
    expect(rotuloDoProvedor('KIWIFY')).toBe('Kiwify');
    expect(rotuloDoProvedor(undefined)).toBe('InfinitePay');
  });

  it('D4: a compra de produto sem plano (mandada para conferir) tem texto claro nos dois motivos possíveis, nunca "ignorado"', () => {
    for (const m of ['KIWIFY_SEM_CONTRATACAO_NO_PLANO', 'COBRANCA_NAO_ENCONTRADA'] as const) {
      const texto = rotuloDoMotivoDaConferencia(m, 'KIWIFY');
      expect(texto).toMatch(/produto/);
      expect(texto).not.toMatch(/ignorad|desconhecid|Conferir manualmente/i);
    }
    // Na InfinitePay a "cobrança não encontrada" segue com o texto de sempre.
    expect(rotuloDoMotivoDaConferencia('COBRANCA_NAO_ENCONTRADA', 'INFINITEPAY')).toBe('Cobrança não encontrada');
    expect(rotuloDoMotivoDaConferencia('COBRANCA_NAO_ENCONTRADA')).toBe('Cobrança não encontrada');
  });

  it('forma KIWIFY tem rótulo e nunca é escolhida na baixa manual', () => {
    expect(rotuloDaForma('KIWIFY')).toBe('Kiwify');
    expect(FORMAS_MANUAIS.map((f) => f.valor)).not.toContain('KIWIFY');
  });
});

describe('plano comercial', () => {
  it('só o mensal pode ter a assinatura pela Kiwify', () => {
    expect(planoPodeTerKiwify('MENSAL')).toBe(true);
    for (const p of ['TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PARCELA_UNICA'] as const) expect(planoPodeTerKiwify(p)).toBe(false);
  });

  it('produto: obrigatório, até 100, só letras, números, - e _, sem repetir o valor', () => {
    expect(validarProdutoKiwify('  ')).toBe('Informe o ID do produto na Kiwify.');
    expect(validarProdutoKiwify('a'.repeat(101))).toBe('Use até 100 caracteres.');
    expect(validarProdutoKiwify('produto com espaço')).not.toContain('produto com');
    expect(validarProdutoKiwify('produto com espaço')).toMatch(/Use só letras/);
    expect(validarProdutoKiwify('3f2a-produto_9')).toBeNull();
  });

  it('envio: mensal ligado leva o produto aparado; ligado sem produto dá erro; desligado vai nulo', () => {
    const base = { habilitada: true, periodicidade: 'MENSAL' as const };
    expect(kiwifyDoPlanoParaEnvio({ ...base, ligado: true, produtoTexto: ' prod-1 ' })).toEqual({ kiwifyAssinatura: true, kiwifyProdutoId: 'prod-1', erro: null });
    expect(kiwifyDoPlanoParaEnvio({ ...base, ligado: true, produtoTexto: '' }).erro).toBe('Informe o ID do produto na Kiwify.');
    expect(kiwifyDoPlanoParaEnvio({ ...base, ligado: false, produtoTexto: 'prod-1' })).toEqual({ kiwifyAssinatura: false, kiwifyProdutoId: null, erro: null });
  });

  it('envio fora do mensal: desligado e sem produto, mesmo com o interruptor ligado', () => {
    expect(kiwifyDoPlanoParaEnvio({ habilitada: true, periodicidade: 'TRIMESTRAL', ligado: true, produtoTexto: 'prod-1' }))
      .toEqual({ kiwifyAssinatura: false, kiwifyProdutoId: null, erro: null });
  });

  it('chave desligada: reenvia o gravado (o PUT substitui inteiro; renomear não desliga a assinatura)', () => {
    const gravado = { kiwifyAssinatura: true, kiwifyProdutoId: 'prod-gravado' };
    expect(kiwifyDoPlanoParaEnvio({ habilitada: false, periodicidade: 'MENSAL', ligado: false, produtoTexto: '', gravado }))
      .toEqual({ kiwifyAssinatura: true, kiwifyProdutoId: 'prod-gravado', erro: null });
    expect(kiwifyDoPlanoParaEnvio({ habilitada: false, periodicidade: 'MENSAL', ligado: true, produtoTexto: 'x', gravado: null }))
      .toEqual({ kiwifyAssinatura: false, kiwifyProdutoId: null, erro: null });
  });

  it('perdeAKiwify: só o plano gravado com a assinatura que muda para outra periodicidade', () => {
    expect(perdeAKiwify({ kiwifyAssinatura: true }, 'ANUAL')).toBe(true);
    expect(perdeAKiwify({ kiwifyAssinatura: true }, 'MENSAL')).toBe(false);
    expect(perdeAKiwify({ kiwifyAssinatura: false }, 'ANUAL')).toBe(false);
    expect(perdeAKiwify(null, 'ANUAL')).toBe(false);
  });
});

describe('aluno (D18): a mensalidade cobrada pela Kiwify', () => {
  const ABERTA: CobrancaDoAluno = {
    id: 'c-1', competencia: '2026-11-05', vencimento: '2026-11-05', valorCentavos: 15_000, situacao: 'ABERTA', vencida: false,
    forma: null, pagoEm: null, tipo: 'MENSALIDADE', descricao: null,
  };
  const KIWIFY = { ...ABERTA, cobrancaAutomatica: 'KIWIFY' as const };
  const todas = ['INFINITEPAY', 'LINK_PROPRIO', 'PIX', 'MANUAL'] as const;
  const ligadas = { pagarNoIos: true, pagarNoAndroid: true };

  it('nenhuma ação em plataforma nenhuma, com todas as formas e as chaves da loja ligadas', () => {
    for (const p of ['web', 'ios', 'android'] as const) {
      expect(acoesDePagamentoDoAluno(p, true, ligadas, 'MENSALIDADE', { formas: todas, temLinkProprio: true, cobrancaAutomatica: 'KIWIFY' })).toEqual([]);
      expect(comoPagar(p, true, ligadas, 'MENSALIDADE', { formas: todas, temLinkProprio: true, cobrancaAutomatica: 'KIWIFY' })).toBe('automatica');
    }
    expect(comoPagar('web', true, {}, 'MENSALIDADE', { cobrancaAutomatica: 'KIWIFY' })).toBe('automatica');
    // Sem a marca, nada muda.
    expect(comoPagar('web', true, {}, 'MENSALIDADE', { formas: todas, cobrancaAutomatica: null })).toBe('botao');
  });

  it('D16: celular com a chave da plataforma desligada só informa (nada de Kiwify); a chave do outro sistema não vale', () => {
    const kiwify = { formas: todas, temLinkProprio: true, cobrancaAutomatica: 'KIWIFY' as const };
    for (const p of ['ios', 'android'] as const) {
      expect(comoPagar(p, true, {}, 'MENSALIDADE', kiwify)).toBe('informar');
      expect(acoesDePagamentoDoAluno(p, true, {}, 'MENSALIDADE', kiwify)).toEqual([]);
    }
    expect(comoPagar('ios', true, { pagarNoIos: false, pagarNoAndroid: true }, 'MENSALIDADE', kiwify)).toBe('informar');
    expect(comoPagar('android', true, { pagarNoIos: true, pagarNoAndroid: false }, 'MENSALIDADE', kiwify)).toBe('informar');
    // Com a chave da plataforma ligada, vale a regra de antes.
    expect(comoPagar('ios', true, { pagarNoIos: true }, 'MENSALIDADE', kiwify)).toBe('automatica');
    expect(comoPagar('android', true, { pagarNoAndroid: true }, 'MENSALIDADE', kiwify)).toBe('automatica');
  });

  it('não vira "combine com o treinador": só Kiwify em aberto não tem frase; ao lado de uma sem ação, a frase é da outra', () => {
    expect(textoDasAbertasDoAluno('combinar', ['automatica'])).toBeNull();
    expect(textoDasAbertasDoAluno('botao', ['automatica', 'botao'])).toBeNull();
    expect(textoDasAbertasDoAluno('botao', ['automatica', 'combinar'])).toBe(TEXTO_COMBINE_COM_O_TREINADOR);
    expect(textoDasAbertasDoAluno('informar', ['automatica'])).toBeNull();
  });

  it('não é pendência do Início, nem vencida', () => {
    const hoje = '2026-11-04';
    expect(pagamentoPendente([KIWIFY], hoje)).toEqual([]);
    expect(pagamentoPendente([{ ...KIWIFY, vencida: true, vencimento: '2026-10-05' }], hoje)).toEqual([]);
    expect(pagamentoPendente([KIWIFY, ABERTA], hoje)).toEqual([ABERTA]);
  });

  it('link em lote recusa a cobrada pela Kiwify com texto próprio (nunca o código cru)', () => {
    expect(motivoDoItemDaAcao('LINK', 'COBRANCA_AUTOMATICA')).toBe('Cobrada pela Kiwify: sem link de pagamento.');
  });

  it('ehCobradaPelaKiwify', () => {
    expect(ehCobradaPelaKiwify(KIWIFY)).toBe(true);
    expect(ehCobradaPelaKiwify(ABERTA)).toBe(false);
    expect(ehCobradaPelaKiwify(null)).toBe(false);
  });
});
