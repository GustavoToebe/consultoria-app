import { ErroApi } from '@plataforma/web';

import {
  alunoDoConflito,
  anamneseInicialDoAceite,
  opcoesDeAnamneseDoAceite,
  alternarCampoOculto,
  CAMPOS_DA_INSCRICAO,
  corpoDaInscricao,
  paginaQueSobra,
  respostasDaPagina,
  TODOS_OS_CAMPOS,
  errosDaInscricao,
  INSCRICAO_VAZIA,
  linkDoWhatsApp,
  mascaraWhatsapp,
  podeAceitar,
  podeEncerrar,
  podeReabrir,
  resumoDoObjetivo,
  seloDaSituacao,
  seloDoPagamento,
  situacoesDoAndamento,
  textoDaDuplicidade,
  destinoDaColuna,
  destinosDoCartao,
  descontoDaProposta,
  dias,
  estadoVazio,
  historicoDaInscricao,
  intervaloDoPeriodo,
  INTERESSES,
  linhasPorMotivo,
  linkDoWhatsAppComTexto,
  mensagemComVariaveis,
  origemDoLink,
  porcentagem,
  PREVISOES,
  primeiroNome,
  rotuloDaOrigem,
  rotuloDoMotivo,
  rotuloOpcional,
  seloDoRetorno,
  temDuplicidade,
  textoDaColuna,
  textoDoEvento,
  valorDaProposta,
} from './inscricoes';

describe('selos da inscrição', () => {
  it('cor com significado: em atendimento âmbar, aceita verde, encerrada cinza', () => {
    expect(seloDaSituacao('NOVA')).toEqual({ texto: 'Nova', tipo: 'atencao' });
    expect(seloDaSituacao('EM_CONTATO').tipo).toBe('atencao');
    expect(seloDaSituacao('EM_NEGOCIACAO').tipo).toBe('atencao');
    expect(seloDaSituacao('ACEITA')).toEqual({ texto: 'Aceita', tipo: 'sucesso' });
    expect(seloDaSituacao('RECUSADA').tipo).toBe('neutro');
    expect(seloDaSituacao('DESISTIU').tipo).toBe('neutro');
  });

  it('pagamento só manual: confirmado é verde, aguardando âmbar, não controlado cinza', () => {
    expect(seloDoPagamento('CONFIRMADO_MANUAL')).toEqual({ texto: 'Confirmado (manual)', tipo: 'sucesso' });
    expect(seloDoPagamento('AGUARDANDO').tipo).toBe('atencao');
    expect(seloDoPagamento('NAO_CONTROLADO').tipo).toBe('neutro');
  });
});

describe('andamento', () => {
  it('o andamento só move entre as etapas abertas; encerrada e aceita ficam como estão', () => {
    expect(situacoesDoAndamento('NOVA').map((o) => o.valor)).toEqual(['NOVA', 'EM_CONTATO', 'EM_NEGOCIACAO']);
    expect(situacoesDoAndamento('ACEITA').map((o) => o.valor)).toEqual(['ACEITA']);
    expect(situacoesDoAndamento('RECUSADA').map((o) => o.valor)).toEqual(['RECUSADA']);
    expect(situacoesDoAndamento('DESISTIU').map((o) => o.valor)).toEqual(['DESISTIU']);
  });

  it('aceitar e encerrar só de uma etapa aberta; reabrir só de encerrada sem aluno', () => {
    expect(podeAceitar('NOVA')).toBe(true);
    expect(podeAceitar('RECUSADA')).toBe(false);
    expect(podeAceitar('ACEITA')).toBe(false);
    expect(podeEncerrar('EM_CONTATO')).toBe(true);
    expect(podeEncerrar('DESISTIU')).toBe(false);
    expect(podeReabrir('RECUSADA')).toBe(true);
    expect(podeReabrir('DESISTIU')).toBe(true);
    expect(podeReabrir('ACEITA')).toBe(false);
    expect(podeReabrir('NOVA')).toBe(false);
  });
});

describe('WhatsApp', () => {
  it('link wa.me com 55 e só dígitos, sem texto pré-preenchido', () => {
    expect(linkDoWhatsApp('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
    expect(linkDoWhatsApp('+55 (11) 98765-4321')).toBe('https://wa.me/5511987654321');
    expect(linkDoWhatsApp('(45) 3222-1111')).toBe('https://wa.me/554532221111');
  });

  it('sem DDD ou inválido não vira link', () => {
    expect(linkDoWhatsApp('98765-4321')).toBeNull();
    expect(linkDoWhatsApp('')).toBeNull();
    expect(linkDoWhatsApp(null)).toBeNull();
    expect(linkDoWhatsApp('(01) 98765-4321')).toBeNull();
  });

  it('máscara enquanto digita', () => {
    expect(mascaraWhatsapp('11987654321')).toBe('(11) 98765-4321');
    expect(mascaraWhatsapp('119')).toBe('(11) 9');
  });
});

describe('textos da fila', () => {
  it('objetivo resumido; ausente é traço', () => {
    expect(resumoDoObjetivo(null)).toBe('—');
    expect(resumoDoObjetivo('   ')).toBe('—');
    expect(resumoDoObjetivo('Ganhar força')).toBe('Ganhar força');
    const longo = resumoDoObjetivo('a'.repeat(200), 20);
    expect(longo).toHaveLength(20);
    expect(longo.endsWith('…')).toBe(true);
  });

  it('duplicidade é só aviso, com o motivo', () => {
    expect(textoDaDuplicidade(null)).toBeNull();
    expect(textoDaDuplicidade({ alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0, outrasInscricoesAnteriores: 0 })).toBeNull();
    expect(textoDaDuplicidade({ alunoExistente: true, alunoId: 'x', outrasInscricoesAbertas: 0, outrasInscricoesAnteriores: 0 })).toBe('Já existe um aluno com este e-mail.');
    expect(textoDaDuplicidade({ alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 2, outrasInscricoesAnteriores: 0 })).toContain('outras 2 inscrições');
    expect(textoDaDuplicidade({ alunoExistente: true, alunoId: null, outrasInscricoesAbertas: 1, outrasInscricoesAnteriores: 0 })).toContain('outra inscrição');
  });
});

describe('formulário público', () => {
  const ok = { ...INSCRICAO_VAZIA, nome: 'Pessoa Fictícia', whatsapp: '(11) 98765-4321' };

  it('nome e WhatsApp obrigatórios; e-mail opcional mas válido', () => {
    expect(errosDaInscricao(INSCRICAO_VAZIA, false, false)).toEqual({
      nome: 'Informe seu nome.',
      whatsapp: 'Informe o WhatsApp com DDD.',
    });
    expect(errosDaInscricao(ok, false, false)).toEqual({});
    expect(errosDaInscricao({ ...ok, whatsapp: '98765-4321' }, false, false).whatsapp).toContain('DDD');
    expect(errosDaInscricao({ ...ok, email: 'sem-arroba' }, false, false).email).toBe('E-mail inválido.');
    expect(errosDaInscricao({ ...ok, email: 'pessoa@exemplo.com' }, false, false)).toEqual({});
  });

  it('limites iguais aos da API e ciência quando a consultoria tem texto', () => {
    expect(errosDaInscricao({ ...ok, nome: 'a'.repeat(121) }, false, false).nome).toBeDefined();
    expect(errosDaInscricao({ ...ok, objetivo: 'a'.repeat(501) }, false, false).objetivo).toBeDefined();
    expect(errosDaInscricao(ok, true, false).cienciaPrivacidade).toBeDefined();
    expect(errosDaInscricao(ok, true, true)).toEqual({});
  });

  it('corpo sem espaços nas pontas, vazio vira nulo e o token só quando há', () => {
    expect(corpoDaInscricao({ ...ok, email: '  ', objetivo: ' Força ' }, true, null)).toEqual({
      nome: 'Pessoa Fictícia',
      whatsapp: '(11) 98765-4321',
      email: null,
      objetivo: 'Força',
      interesse: null,
      modalidade: null,
      previsaoInicio: null,
      origem: null,
      origemLink: null,
      cienciaPrivacidade: true,
      textoVersao: null,
      questionarioVersaoId: null,
      respostas: null,
    });
    const qualificada = corpoDaInscricao({ ...ok, interesse: 'TREINO', modalidade: 'NAO_SEI', previsaoInicio: 'ESTE_MES', origem: 'INSTAGRAM' },
      false, null, null, 'instagram');
    expect(qualificada).toMatchObject({ interesse: 'TREINO', modalidade: 'NAO_SEI', previsaoInicio: 'ESTE_MES', origem: 'INSTAGRAM', origemLink: 'instagram' });
    expect(corpoDaInscricao(ok, false, 'tok').turnstileToken).toBe('tok');
    expect(corpoDaInscricao(ok, true, null, 'abc123').textoVersao).toBe('abc123');
  });

  it('campo fixo escondido não é conferido nem enviado', () => {
    const visiveis = TODOS_OS_CAMPOS.filter((c) => c !== 'EMAIL' && c !== 'ORIGEM' && c !== 'SEXO');
    expect(errosDaInscricao({ ...ok, email: 'sem-arroba' }, false, false, visiveis)).toEqual({});
    const corpo = corpoDaInscricao({ ...ok, email: 'pessoa@exemplo.com', origem: 'INSTAGRAM', sexo: 'FEMININO', interesse: 'DIETA' },
      false, null, null, null, visiveis);
    expect(corpo).toMatchObject({ email: null, origem: null, interesse: 'DIETA' });
    expect('sexo' in corpo).toBe(false);
  });

  it('as perguntas do treinador vão com a versão que a página mostrou', () => {
    const corpo = corpoDaInscricao(ok, false, null, null, null, TODOS_OS_CAMPOS, { versaoId: 'v1', respostas: { observacao: 'Texto fictício' } });
    expect(corpo).toMatchObject({ questionarioVersaoId: 'v1', respostas: { observacao: 'Texto fictício' } });
  });

  it('das perguntas do treinador só vão as visíveis desta versão', () => {
    const modelo = { instrucoes: [], secoes: [{ uid: 's', titulo: 'S', perguntas: [
      { id: 'treina', tipo: 'SIM_NAO' as const, rotulo: 'Treina?', obrigatoria: false },
      { id: 'onde', tipo: 'TEXTO' as const, rotulo: 'Onde?', obrigatoria: false, mostrarSe: { perguntaId: 'treina', valores: ['sim'] } },
    ] }] };
    expect(respostasDaPagina(modelo, { treina: false, onde: 'Some', saiu: 'x' })).toEqual({ treina: false });
    expect(respostasDaPagina(modelo, { treina: true, onde: 'Academia' })).toEqual({ treina: true, onde: 'Academia' });
  });

  it('esconder e mostrar campo mantém a ordem da página', () => {
    expect(alternarCampoOculto(['ORIGEM'], 'EMAIL', true)).toEqual(['EMAIL', 'ORIGEM']);
    expect(alternarCampoOculto(['EMAIL', 'ORIGEM'], 'EMAIL', false)).toEqual(['ORIGEM']);
    expect(alternarCampoOculto(['EMAIL'], 'EMAIL', true)).toEqual(['EMAIL']);
    expect(CAMPOS_DA_INSCRICAO.map((c) => c.valor)).toEqual(TODOS_OS_CAMPOS);
  });
});

describe('anamnese no aceite', () => {
  const geral = { id: 'q-geral', nome: 'Anamnese geral', padrao: true };
  const esportiva = { id: 'q-esportiva', nome: 'Anamnese esportiva', padrao: false };

  it('já vem marcada a padrão; sem padrão (ou sem nenhuma), não enviar agora', () => {
    expect(anamneseInicialDoAceite([esportiva, geral])).toBe('q-geral');
    expect(anamneseInicialDoAceite([esportiva])).toBeNull();
    expect(anamneseInicialDoAceite([])).toBeNull();
  });

  it('opções: "Não enviar agora" primeiro e a padrão com o rótulo "(padrão)"', () => {
    expect(opcoesDeAnamneseDoAceite([esportiva, geral])).toEqual([
      { valor: null, rotulo: 'Não enviar agora' },
      { valor: 'q-esportiva', rotulo: 'Anamnese esportiva' },
      { valor: 'q-geral', rotulo: 'Anamnese geral (padrão)' },
    ]);
    expect(opcoesDeAnamneseDoAceite([])).toEqual([{ valor: null, rotulo: 'Não enviar agora' }]);
  });
});

describe('409 do aceite', () => {
  it('lê o aluno de ALUNO_JA_EXISTE e INSCRICAO_JA_ACEITA; outro erro não', () => {
    const campos = [{ field: 'alunoId', message: 'id-do-aluno' }];
    expect(alunoDoConflito(new ErroApi(409, 'ALUNO_JA_EXISTE', 'Já existe.', campos))).toBe('id-do-aluno');
    expect(alunoDoConflito(new ErroApi(409, 'INSCRICAO_JA_ACEITA', 'Já aceita.', campos))).toBe('id-do-aluno');
    expect(alunoDoConflito(new ErroApi(409, 'LIMITE_DO_PLANO', 'Limite.', [{ field: 'alunos_ativos', message: 'x' }]))).toBeNull();
    expect(alunoDoConflito(new ErroApi(409, 'INSCRICAO_JA_ACEITA', 'Já aceita.'))).toBeNull();
    expect(alunoDoConflito(new Error('x'))).toBeNull();
  });
});

describe('paginaQueSobra', () => {
  it('a segunda página esvaziou com 30 restantes: volta para a primeira', () => {
    expect(paginaQueSobra(1, { itens: [], total: 30 }, 30)).toBe(0);
  });
  it('fica onde está com itens, sem dados ou na primeira página', () => {
    expect(paginaQueSobra(1, { itens: [1], total: 31 }, 30)).toBe(1);
    expect(paginaQueSobra(2, undefined, 30)).toBe(2);
    expect(paginaQueSobra(0, { itens: [], total: 0 }, 30)).toBe(0);
  });
  it('lista toda vazia volta para a primeira; total maior volta para a última que existe', () => {
    expect(paginaQueSobra(3, { itens: [], total: 0 }, 30)).toBe(0);
    expect(paginaQueSobra(4, { itens: [], total: 61 }, 30)).toBe(2);
  });
});

describe('CRM: rótulos e duplicidade', () => {
  it('motivo e origem nulos têm texto próprio', () => {
    expect(rotuloDoMotivo(null)).toBe('Não informado');
    expect(rotuloDoMotivo('OUTRO_SERVICO')).toBe('Escolheu outro serviço');
    expect(rotuloDaOrigem(null)).toBe('Não informada');
    expect(rotuloDaOrigem('CAMPANHA')).toBe('Campanha');
    expect(rotuloOpcional(PREVISOES, null)).toBe('—');
    expect(rotuloOpcional(INTERESSES, 'NAO_SEI')).toBe('Ainda não sei');
  });

  it('duplicidade cita as inscrições anteriores', () => {
    expect(textoDaDuplicidade({ alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0, outrasInscricoesAnteriores: 1 }))
      .toBe('Há 1 inscrição anterior com o mesmo e-mail ou WhatsApp.');
    expect(textoDaDuplicidade({ alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0, outrasInscricoesAnteriores: 3 }))
      .toBe('Há 3 inscrições anteriores com o mesmo e-mail ou WhatsApp.');
    expect(temDuplicidade({ alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0, outrasInscricoesAnteriores: 0 })).toBe(false);
  });

  it('origem do link: só letras minúsculas, números, hífen e sublinhado', () => {
    expect(origemDoLink('Instagram')).toBe('instagram');
    expect(origemDoLink(['campanha-novembro_1'])).toBe('campanha-novembro_1');
    expect(origemDoLink('a b')).toBeNull();
    expect(origemDoLink('<script>')).toBeNull();
    expect(origemDoLink('x'.repeat(41))).toBeNull();
    expect(origemDoLink(undefined)).toBeNull();
  });
});

describe('CRM: respostas prontas', () => {
  it('troca as variáveis e aponta o que falta', () => {
    const r = mensagemComVariaveis('Oi, {primeiro_nome}! Aqui é da {consultoria}. Plano: {plano}.', { primeiroNome: 'Ana', consultoria: 'Equipe Teste', plano: null });
    expect(r.texto).toBe('Oi, Ana! Aqui é da Equipe Teste. Plano: {plano}.');
    expect(r.faltando).toEqual(['{plano}']);
    expect(mensagemComVariaveis('{primeiro_nome}, {desconhecida}', { primeiroNome: 'Ana' }).faltando).toEqual(['{desconhecida}']);
    expect(mensagemComVariaveis('Tudo certo, {primeiro_nome}.', { primeiroNome: 'Ana' }).faltando).toEqual([]);
  });

  it('primeiro nome e link do WhatsApp com texto', () => {
    expect(primeiroNome('  Ana Paula Souza ')).toBe('Ana');
    expect(linkDoWhatsAppComTexto('(11) 98765-4321', 'Oi & tudo?')).toBe('https://wa.me/5511987654321?text=Oi%20%26%20tudo%3F');
    expect(linkDoWhatsAppComTexto('(11) 98765-4321', '  ')).toBeNull();
    expect(linkDoWhatsAppComTexto('98765-4321', 'Oi')).toBeNull();
  });
});

describe('CRM: histórico', () => {
  const base = { de: null, para: null, motivo: null, detalhe: null };
  it('texto de cada evento, sem o texto da mensagem', () => {
    expect(textoDoEvento({ ...base, tipo: 'ETAPA', de: 'NOVA', para: 'EM_CONTATO' })).toBe('Etapa: Nova → Em contato');
    expect(textoDoEvento({ ...base, tipo: 'ENCERRADA', para: 'RECUSADA', motivo: 'PRECO' })).toBe('Encerrada: Recusada · Preço');
    expect(textoDoEvento({ ...base, tipo: 'ENCERRADA', para: 'DESISTIU', detalhe: 'Mudou de cidade' })).toBe('Encerrada: Desistiu · Não informado (Mudou de cidade)');
    expect(textoDoEvento({ ...base, tipo: 'REABERTA', detalhe: 'Voltou a procurar' })).toBe('Reaberta: Voltou a procurar');
    expect(textoDoEvento({ ...base, tipo: 'MENSAGEM_PREPARADA', para: 'WHATSAPP_ABERTO', detalhe: 'Apresentação' })).toBe('Mensagem preparada: Apresentação (WhatsApp aberto)');
    expect(textoDoEvento({ ...base, tipo: 'MENSAGEM_PREPARADA', para: 'COPIADA', detalhe: 'Apresentação' })).toBe('Mensagem preparada: Apresentação (copiada)');
    expect(textoDoEvento({ ...base, tipo: 'ORIGEM', de: null, para: 'INSTAGRAM' })).toBe('Origem: Não informada → Instagram');
    expect(textoDoEvento({ ...base, tipo: 'CRIADA' })).toBe('Inscrição recebida');
    expect(textoDoEvento({ ...base, tipo: 'ACEITA' })).toBe('Aceita: virou aluno');
  });

  it('eventos e notas juntos, do mais novo ao mais antigo', () => {
    const itens = historicoDaInscricao(
      [{ id: 'e1', tipo: 'CRIADA', ciclo: 1, de: null, para: null, motivo: null, detalhe: null, autorNome: null, criadoEm: '2026-10-01T10:00:00Z' }],
      [{ id: 'n1', texto: 'Liguei', autorNome: 'Ana', criadaEm: '2026-10-02T10:00:00Z' }],
    );
    expect(itens.map((i) => i.id)).toEqual(['n1', 'e1']);
  });
});

describe('CRM: Kanban', () => {
  it('de aberta: as outras abertas, aceitar e encerrar; de encerrada: reabrir; aceita: nada', () => {
    expect(destinosDoCartao('NOVA').map((d) => d.rotulo)).toEqual(['Em contato', 'Em negociação', 'Aceitar (cadastrar aluno)', 'Recusar', 'Desistiu']);
    expect(destinosDoCartao('RECUSADA').map((d) => d.tipo)).toEqual(['reabrir']);
    expect(destinosDoCartao('ACEITA')).toEqual([]);
  });

  it('soltar numa coluna escolhe o destino certo', () => {
    expect(destinoDaColuna('NOVA', 'EM_NEGOCIACAO')).toEqual({ tipo: 'etapa', situacao: 'EM_NEGOCIACAO', rotulo: 'Em negociação' });
    expect(destinoDaColuna('NOVA', 'ACEITA')?.tipo).toBe('aceitar');
    expect(destinoDaColuna('EM_CONTATO', 'DESISTIU')).toMatchObject({ tipo: 'encerrar', situacao: 'DESISTIU' });
    expect(destinoDaColuna('RECUSADA', 'NOVA')?.tipo).toBe('reabrir');
    expect(destinoDaColuna('RECUSADA', 'ACEITA')).toBeNull();
    expect(destinoDaColuna('NOVA', 'NOVA')).toBeNull();
    expect(destinoDaColuna('ACEITA', 'NOVA')).toBeNull();
  });

  it('cabeçalho da coluna só avisa quando carregou menos que o total', () => {
    expect(textoDaColuna(20, 34)).toBe('Mostrando 20 de 34');
    expect(textoDaColuna(5, 5)).toBeNull();
    expect(textoDaColuna(0, undefined)).toBeNull();
  });
});

describe('CRM: estados vazios, retornos, proposta e indicadores', () => {
  it('textos distintos para busca, Meus, filtros e a fila vazia', () => {
    expect(estadoVazio({ filtro: 'ABERTAS', meus: false, busca: 'ana', temFiltros: false }).titulo).toBe('Nada encontrado para esta busca.');
    expect(estadoVazio({ filtro: 'ABERTAS', meus: true, busca: '', temFiltros: false }).titulo).toBe('Nenhuma inscrição atribuída a você nesta lista.');
    expect(estadoVazio({ filtro: 'ABERTAS', meus: false, busca: '', temFiltros: true }).titulo).toBe('Nenhuma inscrição com estes filtros.');
    expect(estadoVazio({ filtro: 'ABERTAS', meus: false, busca: '', temFiltros: false }).texto).toContain('Divulgue o link');
  });

  it('retorno atrasado, de hoje ou futuro', () => {
    expect(seloDoRetorno('2026-10-28', '2026-10-29')).toEqual({ texto: 'Atrasado', tipo: 'perigo' });
    expect(seloDoRetorno('2026-10-29', '2026-10-29')).toEqual({ texto: 'Hoje', tipo: 'atencao' });
    expect(seloDoRetorno('2026-10-30', '2026-10-29')).toBeNull();
  });

  it('valor da proposta: vazio é nulo, zero vale, inválido é erro; desconto só com os dois valores', () => {
    expect(valorDaProposta('')).toEqual({ valor: null, erro: null });
    expect(valorDaProposta('0')).toEqual({ valor: 0, erro: null });
    expect(valorDaProposta('199,90')).toEqual({ valor: 19990, erro: null });
    expect(valorDaProposta('abc').erro).toBeTruthy();
    expect(descontoDaProposta({ valorReferenciaCentavos: 20000, valorCentavos: 15000 })).toBe(25);
    expect(descontoDaProposta({ valorReferenciaCentavos: 20000, valorCentavos: 20000 })).toBeNull();
    expect(descontoDaProposta({ valorReferenciaCentavos: null, valorCentavos: 15000 })).toBeNull();
  });

  it('indicadores: porcentagem, dias e períodos em datas de Brasília', () => {
    expect(porcentagem(0.375)).toBe('38%');
    expect(porcentagem(null)).toBe('—');
    expect(dias(3.45)).toBe('3,5 dias');
    expect(dias(1)).toBe('1 dia');
    expect(dias(null)).toBe('—');
    expect(intervaloDoPeriodo('30', '2026-10-29')).toEqual({ de: '2026-09-30', ate: '2026-10-29' });
    expect(intervaloDoPeriodo('ano', '2026-10-29')).toEqual({ de: '2026-01-01', ate: '2026-10-29' });
    expect(linhasPorMotivo({ porMotivo: [{ motivo: null, quantidade: 1 }, { motivo: 'PRECO', quantidade: 3 }] }))
      .toEqual([{ rotulo: 'Preço', quantidade: 3 }, { rotulo: 'Não informado', quantidade: 1 }]);
  });
});
