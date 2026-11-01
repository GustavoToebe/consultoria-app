import type { AnaliseDaPlanilha, CriacaoDaPlanilha } from '../api/tipos';
import { agruparErros, textoDoGrupoDeErros } from './assistenteDaImportacao';
import {
  SEM_RESPOSTAS, aceitarSugestoesDeSuplemento, aceitarTodosOsProvaveis, destinoSemResposta, errosDoHistorico,
  errosDosProblemas, escolherLigacao, escolherTipo, filtrarPorNome, frasesDaCriacao, linhasAmbiguas, motivoParaNaoAvancar,
  ondeDaAba, opcoesDaPergunta, opcoesDoTipoDaAba, pendencias, respostaDoValor, responderNome, responderSuplemento,
  respostasParaApi, resumoDoDesfazer, rotuloDoTipoDeAba, textoDaLeitura, textoDaLigacao, textoDaParteDesfeita,
  textoDaPartePulada, textoDoProblema, tipoDaAba, valorDaResposta,
  AVISO_RESPONDIDO_ANTES, abaRespondidaAntes, alunosDaAba, blocoFicaDeFora, nomeRespondidoAntes, quantasRespostasSalvasMarcadas,
  respostasSalvasMarcadas, semRespostasSalvas, suplementoRespondidoAntes, textoDaSituacaoDoAluno, textoDasRespostasSalvas,
  textoDoBloco, textoDoFormato, textoDosAlunosDaAba,
} from './planilhaCompleta';

const ANALISE: AnaliseDaPlanilha = {
  abas: [
    { indice: 0, nome: 'Alunos', tipo: 'ALUNOS', linhaDoCabecalho: 1, linhas: 3, campos: { ALUNO: 1 }, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
    { indice: 1, nome: 'Rotinas', tipo: 'ROTINAS', linhaDoCabecalho: 1, linhas: 2, campos: {}, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
    { indice: 2, nome: 'Exercícios', tipo: 'TREINO', linhaDoCabecalho: 1, linhas: 5, campos: {}, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
    { indice: 3, nome: 'Notas', tipo: 'DESCONHECIDA', linhaDoCabecalho: 0, linhas: 4, campos: {}, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
  ],
  ligacoes: [
    { abaFilha: 1, colunaFilha: 1, abaMae: 0, colunaMae: 0, por: 'CODIGO', ligadas: 2, naoLigadas: 0, ambiguas: 0, pendentes: [] },
    { abaFilha: 2, colunaFilha: 1, abaMae: 1, colunaMae: 0, por: 'NOME', ligadas: 3, naoLigadas: 1, ambiguas: 1, pendentes: [{ linha: 6, candidatas: [2, 3] }] },
  ],
  resumo: {
    alunos: 3, alunosInativos: 0, pesos: 4, pesosIniciais: 1, pesosIniciaisNoHistorico: 0, treinos: 2, exercicios: 5,
    refeicoes: 0, itensDeDieta: 0, suplementos: 2, exerciciosNaLista: 0, nomesDeExercicio: { certo: 1, provavel: 1, nenhum: 1 },
    nomesDeAlimento: { certo: 0, provavel: 0, nenhum: 0 }, prescricoes: 5, prescricoesNaoEntendidas: 0, prescricoesComSobra: 0,
    faixasRecuperadasDeData: 0,
  },
  problemas: [], problemasAlem: 0, problemasPorTipo: {},
  exercicios: [
    { nome: 'Supino reto c/ hal.', nivel: 'PROVAVEL', sugestao: 'Supino reto com halteres', origem: 'BIBLIOTECA', nota: 0.7, ocorrencias: 3, respostaSalva: null, idSalvo: null },
    { nome: 'Xyzzy fictício', nivel: 'NENHUM', sugestao: null, origem: null, nota: 0, ocorrencias: 1, respostaSalva: null, idSalvo: null },
  ],
  alimentos: [{ nome: 'Arroz fictício', nivel: 'PROVAVEL', sugestao: 'Arroz branco', origem: 'BIBLIOTECA', nota: 0.6, ocorrencias: 2, respostaSalva: null, idSalvo: null }],
  suplementos: [
    { nome: 'Creatina', sugestao: 'SUPLEMENTO', ocorrencias: 2, destinoSalvo: null },
    { nome: 'Remédio Fictício', sugestao: null, ocorrencias: 1, destinoSalvo: null },
  ],
  respostasSalvas: 0,
};

const CRIACAO: CriacaoDaPlanilha = {
  alunosNovos: 156, alunosNovosInativos: 4, alunosReaproveitados: 1, pesos: 900, pesosIniciais: 20, pesosJaRegistrados: 2,
  exercicios: 12, pastas: 150, treinos: 140, sessoes: 420, exerciciosNosTreinos: 3000, exerciciosLigados: 2800, series: 9000,
  dietas: 130, refeicoes: 700, itens: 4000, itensLigados: 3100, suplementos: 200, ergogenicos: 30, ergogenicosPulados: 0,
  faixasRecuperadasDeData: 3,
};

test('tipos de aba: rótulo, opções (sem tabela de terceiros nem "não reconhecida") e troca que volta ao reconhecido', () => {
  expect(rotuloDoTipoDeAba('PESOS')).toBe('Histórico de pesos');
  expect(rotuloDoTipoDeAba('IGNORAR')).toBe('Ignorar esta aba');
  const opcoes = opcoesDoTipoDaAba().map((o) => o.valor);
  expect(opcoes).toContain('ALUNOS');
  expect(opcoes).not.toContain('TABELA_DE_ALIMENTOS');
  expect(opcoes[opcoes.length - 1]).toBe('IGNORAR');

  let e = escolherTipo(ANALISE, SEM_RESPOSTAS, 3, 'PESOS');
  expect(tipoDaAba(ANALISE, e, 3)).toBe('PESOS');
  expect(tipoDaAba(ANALISE, e, 0)).toBe('ALUNOS');
  e = escolherTipo(ANALISE, e, 3, 'DESCONHECIDA');
  expect(e.tipos).toEqual({});
});

test('respostas de nomes: valor do controle, aceitar todos os prováveis sem apagar o que já foi respondido', () => {
  expect(valorDaResposta(undefined)).toBe('');
  expect(valorDaResposta({ acao: 'BIBLIOTECA', id: 'abc' })).toBe('BIBLIOTECA:abc');
  expect(respostaDoValor('BIBLIOTECA:abc')).toEqual({ acao: 'BIBLIOTECA', id: 'abc' });
  expect(respostaDoValor('BIBLIOTECA:')).toBeNull();
  expect(respostaDoValor('CRIAR')).toEqual({ acao: 'CRIAR' });
  expect(respostaDoValor('')).toBeNull();

  let e = responderNome(SEM_RESPOSTAS, 'exercicios', 'Xyzzy fictício', { acao: 'CRIAR' });
  e = aceitarTodosOsProvaveis(e, 'exercicios', ANALISE.exercicios);
  expect(e.exercicios).toEqual({ 'Xyzzy fictício': { acao: 'CRIAR' }, 'Supino reto c/ hal.': { acao: 'ACEITAR' } });
  e = responderNome(e, 'exercicios', 'Supino reto c/ hal.', { acao: 'MANTER' });
  expect(aceitarTodosOsProvaveis(e, 'exercicios', ANALISE.exercicios).exercicios['Supino reto c/ hal.']).toEqual({ acao: 'MANTER' });
  expect(responderNome(e, 'exercicios', 'Xyzzy fictício', null).exercicios['Xyzzy fictício']).toBeUndefined();
});

test('opções da pergunta: aceitar só com sugestão, criar só no exercício e os itens da biblioteca', () => {
  const biblioteca = [{ id: 'e1', nome: 'Supino reto com halteres' }];
  const supino = opcoesDaPergunta(ANALISE.exercicios[0], 'exercicios', biblioteca).map((o) => o.valor);
  expect(supino).toEqual(['', 'ACEITAR', 'CRIAR', 'MANTER', 'BIBLIOTECA:e1']);
  expect(opcoesDaPergunta(ANALISE.exercicios[1], 'exercicios', []).map((o) => o.valor)).toEqual(['', 'CRIAR', 'MANTER']);
  expect(opcoesDaPergunta(ANALISE.alimentos[0], 'alimentos', []).map((o) => o.valor)).toEqual(['', 'ACEITAR', 'MANTER']);
});

test('suplementos: sem resposta vai para a sugestão ou para Medicação e ergogênicos; aceitar sugestões', () => {
  expect(destinoSemResposta(ANALISE.suplementos[0])).toBe('SUPLEMENTO');
  expect(destinoSemResposta(ANALISE.suplementos[1])).toBe('SENSIVEL');
  const e = aceitarSugestoesDeSuplemento(SEM_RESPOSTAS, ANALISE.suplementos);
  expect(e.suplementos).toEqual({ Creatina: 'SUPLEMENTO' });
  expect(responderSuplemento(e, 'Creatina', null).suplementos).toEqual({});
});

test('busca sem acento no nome e na sugestão', () => {
  expect(filtrarPorNome(ANALISE.exercicios, 'HALTERES').map((p) => p.nome)).toEqual(['Supino reto c/ hal.']);
  expect(filtrarPorNome(ANALISE.exercicios, 'ficticio').map((p) => p.nome)).toEqual(['Xyzzy fictício']);
  expect(filtrarPorNome(ANALISE.exercicios, '  ')).toHaveLength(2);
});

test('ligações ambíguas, pendências e a parte respostas só com o que foi respondido', () => {
  expect(linhasAmbiguas(ANALISE)).toEqual([{ aba: 2, abaMae: 1, linha: 6, candidatas: [2, 3] }]);
  expect(pendencias(ANALISE, SEM_RESPOSTAS)).toEqual({ exercicios: 1, alimentos: 1, suplementos: 1, ligacoes: 1 });

  let e = escolherTipo(ANALISE, SEM_RESPOSTAS, 3, 'IGNORAR');
  e = escolherLigacao(e, 2, 6, 3);
  e = responderNome(e, 'exercicios', 'Supino reto c/ hal.', { acao: 'BIBLIOTECA', id: 'e1' });
  e = responderNome(e, 'alimentos', 'Arroz fictício', { acao: 'ACEITAR' });
  e = responderSuplemento(e, 'Remédio Fictício', 'SENSIVEL');
  expect(pendencias(ANALISE, e)).toEqual({ exercicios: 0, alimentos: 0, suplementos: 0, ligacoes: 0 });
  expect(respostasParaApi(ANALISE, e)).toEqual({
    abas: [{ indice: 3, tipo: 'IGNORAR' }],
    ligacoes: [{ aba: 2, linha: 6, linhaDaMae: 3 }],
    exercicios: [{ nome: 'Supino reto c/ hal.', acao: 'BIBLIOTECA', id: 'e1' }],
    alimentos: [{ nome: 'Arroz fictício', acao: 'ACEITAR' }],
    suplementos: [{ nome: 'Remédio Fictício', destino: 'SENSIVEL' }],
  });
  expect(escolherLigacao(e, 2, 6, null).ligacoes).toEqual({});
  expect(respostasParaApi(ANALISE, SEM_RESPOSTAS)).toEqual({ abas: [], ligacoes: [], exercicios: [], alimentos: [], suplementos: [] });
});

test('frases da prévia e do resultado, sem zero e com o aviso do rascunho', () => {
  const previa = frasesDaCriacao(CRIACAO);
  expect(previa[0]).toBe('Vai criar 156 alunos (4 inativos), sem convite.');
  expect(previa).toContain('Vai usar 1 aluno que já existia (mesmo e-mail ou mesmo nome).');
  expect(previa).toContain('Vai criar 900 registros de peso (20 do peso inicial do cadastro).');
  expect(previa).toContain('2 pesos já estavam registrados na mesma data e ficaram como estavam.');
  expect(previa).toContain('Vai criar 150 pastas, uma por aluno, com 140 treinos (420 divisões, 3000 exercícios, 9000 séries) e 130 dietas (700 refeições, 4000 itens), tudo em rascunho.');
  expect(previa.join(' ')).not.toMatch(/\b0 /);
  expect(frasesDaCriacao({ ...CRIACAO, alunosNovos: 1, alunosNovosInativos: 0 }, true)[0]).toBe('Criou 1 aluno, sem convite.');
  const vazio = Object.fromEntries(Object.keys(CRIACAO).map((k) => [k, 0])) as unknown as CriacaoDaPlanilha;
  expect(frasesDaCriacao(vazio)).toEqual(['Nada vai ser criado com estas abas e respostas.']);
});

test('parte pulada e problemas em português, agrupados por aba', () => {
  expect(textoDaPartePulada({ parte: 'PESOS', permissao: 'ALUNO_SENSIVEL_ALTERAR' }))
    .toBe('Os pesos ficam de fora: seu perfil não tem a permissão de dados sensíveis do aluno.');
  expect(textoDoProblema('EMAIL_INVALIDO')).toBe('E-mail inválido: o aluno entra sem e-mail.');
  expect(textoDoProblema('XPTO')).toBe('Outro problema (XPTO).');
  const grupos = agruparErros(errosDosProblemas([
    { aba: 'Alunos', linha: 3, campo: 'EMAIL', tipo: 'EMAIL_INVALIDO' },
    { aba: 'Alunos', linha: 5, campo: 'EMAIL', tipo: 'EMAIL_INVALIDO' },
    { aba: 'Pesos', linha: 2, campo: 'DATA', tipo: 'SEM_DATA' },
  ]));
  expect(textoDoGrupoDeErros(grupos[0], ondeDaAba(grupos[0].campo))).toBe('Aba “Alunos”: E-mail inválido: o aluno entra sem e-mail. · 2 linhas: 3, 5');
  expect(textoDoGrupoDeErros(grupos[1], ondeDaAba(grupos[1].campo))).toBe('Linha 2 · Aba “Pesos”: Sem data.');
  expect(errosDoHistorico([{ linha: 4, campo: 'DATA', motivo: 'Histórico Pesos: SEM_DATA' }]))
    .toEqual([{ linha: 4, campo: 'Histórico Pesos', motivo: 'Sem data.' }]);
});

test('desfazer: cada parte em texto e o resumo', () => {
  expect(textoDaParteDesfeita({ tipo: 'ALUNO', apagados: 3, ficaram: 2, motivos: { COM_ACESSO: 1, EM_USO: 1 } }))
    .toBe('Alunos: 3 apagados; 2 ficaram (1 já tem acesso ao app, 1 em uso por algo criado depois).');
  expect(textoDaParteDesfeita({ tipo: 'PLANO_TREINO', apagados: 0, ficaram: 1, motivos: { PUBLICADO: 1 } }))
    .toBe('Treinos: 1 ficou (1 já publicado).');
  expect(textoDaParteDesfeita({ tipo: 'PESO', apagados: 0, ficaram: 0, motivos: {} })).toBeNull();
  const partes = [{ tipo: 'ALUNO' as const, apagados: 2, ficaram: 0, motivos: {} }];
  expect(resumoDoDesfazer({ importacaoId: 'x', partes, ficaram: [], ficaramAlem: 0 })).toBe('Tudo o que a importação criou foi apagado (2 itens).');
  expect(resumoDoDesfazer({ importacaoId: 'x', partes: [{ ...partes[0], apagados: 0 }], ficaram: [], ficaramAlem: 0 }))
    .toBe('Não havia nada desta importação para apagar.');
  expect(resumoDoDesfazer({ importacaoId: 'x', partes: [{ ...partes[0], ficaram: 1, motivos: { EM_USO: 1 } }], ficaram: [], ficaramAlem: 0 }))
    .toBe('2 itens apagados; 1 ficou, pelos motivos abaixo.');
});

test('leitura, ligação e motivo para não avançar', () => {
  expect(textoDaLeitura(ANALISE)).toBe('4 abas lidas: 3 alunos, 5 pesos, 2 divisões de treino com 5 exercícios e 2 suplementos ou medicações.');
  expect(textoDaLigacao(ANALISE, ANALISE.ligacoes[1])).toBe('“Exercícios” liga a “Rotinas” pelo nome: 3 linhas ligadas, 1 sem par, 1 ambígua.');
  expect(motivoParaNaoAvancar(1, { arquivoAceito: null, ocupado: false, temAnalise: false })).toBe('Escolha o arquivo da planilha.');
  expect(motivoParaNaoAvancar(1, { arquivoAceito: false, ocupado: false, temAnalise: false })).toBe('Envie um arquivo .xlsx ou .csv.');
  expect(motivoParaNaoAvancar(1, { arquivoAceito: true, ocupado: false, temAnalise: false })).toBeNull();
  expect(motivoParaNaoAvancar(2, { arquivoAceito: true, ocupado: true, temAnalise: true })).toBe('Aguarde.');
});

// ------------------------------------------------------------------------------------------- fase 2 (01/11)

describe('formatos: uma aba por aluno e blocos', () => {
  const blocoAna = { linha: 2, tipo: 'TREINO' as const, aluno: 'Ana Fictícia', situacao: 'NOVO' as const, titulo: 'Treino A', linhas: 4 };
  const umAluno = { formato: 'UM_ALUNO' as const, blocos: [blocoAna, { ...blocoAna, linha: 9, titulo: 'Treino B', linhas: 1 }] };
  const emBlocos = {
    formato: 'BLOCOS' as const,
    blocos: [
      { ...blocoAna, aluno: 'Bruno Inventado', situacao: 'PLANILHA' as const, titulo: null },
      { ...blocoAna, aluno: 'Carla Exemplo', situacao: 'AMBIGUO' as const },
      { ...blocoAna, aluno: 'carla exemplo', situacao: 'AMBIGUO' as const },
      { ...blocoAna, aluno: null, situacao: 'SEM_ALUNO' as const },
    ],
  };

  test('o formato em palavras (nada na tabela)', () => {
    expect(textoDoFormato({ formato: 'TABELA', blocos: [] })).toBeNull();
    expect(textoDoFormato(umAluno)).toBe('Um aluno por aba, 2 tabelas');
    expect(textoDoFormato({ formato: 'UM_ALUNO', blocos: [blocoAna] })).toBe('Um aluno por aba');
    expect(textoDoFormato(emBlocos)).toBe('Vários alunos em blocos (4 tabelas)');
  });

  test('de quem é a aba: os alunos sem repetir (sem caixa e sem acento), com a situação', () => {
    expect(textoDosAlunosDaAba({ formato: 'TABELA', blocos: [] })).toBeNull();
    expect(textoDosAlunosDaAba(umAluno)).toBe('De Ana Fictícia (aluno novo, entra só com o nome).');
    expect(alunosDaAba(emBlocos).map((a) => a.aluno)).toEqual(['Bruno Inventado', 'Carla Exemplo', null]);
    expect(textoDosAlunosDaAba(emBlocos)).toBe('3 alunos: Bruno Inventado, Carla Exemplo e sem aluno.');
  });

  test('cada bloco: linha, título, linhas e o aluno; ambíguo e sem aluno ficam de fora', () => {
    expect(textoDoBloco(blocoAna)).toBe('Linha 2 · Treino A · 4 linhas · Ana Fictícia (aluno novo, entra só com o nome)');
    expect(textoDoBloco(emBlocos.blocos[3])).toBe('Linha 2 · Treino A · 4 linhas · sem aluno: não entra');
    expect(textoDaSituacaoDoAluno('EXISTENTE')).toBe('já é seu aluno');
    expect(blocoFicaDeFora(emBlocos.blocos[1])).toBe(true);
    expect(blocoFicaDeFora(blocoAna)).toBe(false);
  });

  test('os problemas novos têm texto', () => {
    for (const codigo of ['BLOCO_SEM_ALUNO', 'ALUNO_DO_BLOCO_AMBIGUO', 'PIRAMIDE_DIFERENTE_DAS_SERIES', 'ESFORCO_CONFLITANTE',
      'TECNICA_FORA_DA_METODOLOGIA', 'TECNICA_INCOMPLETA', 'CLUSTER_DIFERENTE_DAS_REPETICOES']) {
      expect(textoDoProblema(codigo)).not.toContain('Outro problema');
    }
  });
});

describe('respostas salvas por consultoria', () => {
  const COM_SALVAS: AnaliseDaPlanilha = {
    ...ANALISE,
    respostasSalvas: 9,
    abas: ANALISE.abas.map((a) => (a.indice === 3 ? { ...a, tipoSalvo: 'IGNORAR' } : a.indice === 0 ? { ...a, tipoSalvo: 'ALUNOS' } : a)),
    exercicios: [
      { ...ANALISE.exercicios[0], respostaSalva: 'BIBLIOTECA', idSalvo: 'ex-1' },
      // "Aceitar" sem sugestão não tem o que aceitar: não volta marcado.
      { ...ANALISE.exercicios[1], respostaSalva: 'ACEITAR', idSalvo: null },
    ],
    alimentos: [{ ...ANALISE.alimentos[0], respostaSalva: 'ACEITAR', idSalvo: null }],
    suplementos: [ANALISE.suplementos[0], { ...ANALISE.suplementos[1], destinoSalvo: 'SENSIVEL' }],
  };

  test('voltam marcadas ao ler a planilha (só o que ainda vale)', () => {
    const e = respostasSalvasMarcadas(COM_SALVAS);
    expect(e.tipos).toEqual({ 3: 'IGNORAR' }); // o tipo salvo igual ao reconhecido não vira resposta
    expect(e.exercicios).toEqual({ 'Supino reto c/ hal.': { acao: 'BIBLIOTECA', id: 'ex-1' } });
    expect(e.alimentos).toEqual({ 'Arroz fictício': { acao: 'ACEITAR' } });
    expect(e.suplementos).toEqual({ 'Remédio Fictício': 'SENSIVEL' });
    expect(respostasParaApi(COM_SALVAS, e).abas).toEqual([{ indice: 3, tipo: 'IGNORAR' }]);
    expect(respostasSalvasMarcadas(ANALISE)).toEqual(SEM_RESPOSTAS);
  });

  test('o aviso aparece enquanto a resposta é a da importação anterior; trocar tira o aviso', () => {
    let e = respostasSalvasMarcadas(COM_SALVAS);
    expect(abaRespondidaAntes(COM_SALVAS, e, COM_SALVAS.abas[3])).toBe(true);
    expect(abaRespondidaAntes(COM_SALVAS, e, COM_SALVAS.abas[0])).toBe(false);
    expect(nomeRespondidoAntes(COM_SALVAS.exercicios[0], e.exercicios['Supino reto c/ hal.'])).toBe(true);
    expect(suplementoRespondidoAntes(COM_SALVAS.suplementos[1], e.suplementos['Remédio Fictício'])).toBe(true);
    expect(quantasRespostasSalvasMarcadas(COM_SALVAS, e)).toBe(4);
    e = responderNome(e, 'exercicios', 'Supino reto c/ hal.', { acao: 'BIBLIOTECA', id: 'ex-2' });
    expect(nomeRespondidoAntes(COM_SALVAS.exercicios[0], e.exercicios['Supino reto c/ hal.'])).toBe(false);
    e = escolherTipo(COM_SALVAS, e, 3, 'PESOS');
    expect(abaRespondidaAntes(COM_SALVAS, e, COM_SALVAS.abas[3])).toBe(false);
    expect(quantasRespostasSalvasMarcadas(COM_SALVAS, e)).toBe(2);
    expect(textoDasRespostasSalvas(COM_SALVAS, e)).toBe('9 respostas guardadas das importações anteriores: 2 vieram marcadas aqui. Confira e troque o que precisar; as que você mudar ficam guardadas ao confirmar.');
    expect(textoDasRespostasSalvas({ ...COM_SALVAS, respostasSalvas: 1 }, SEM_RESPOSTAS)).toBe('1 resposta guardada das importações anteriores; nenhuma vale para esta planilha.');
  });

  test('esquecer tira as marcas e só as respostas que vieram delas (o que foi trocado aqui fica)', () => {
    let e = respostasSalvasMarcadas(COM_SALVAS);
    e = responderNome(e, 'exercicios', 'Supino reto c/ hal.', { acao: 'MANTER' });
    const depois = semRespostasSalvas(COM_SALVAS, e);
    expect(depois.analise.respostasSalvas).toBe(0);
    expect(depois.analise.abas.every((a) => a.tipoSalvo === null)).toBe(true);
    expect(depois.analise.exercicios.every((p) => p.respostaSalva === null && p.idSalvo === null)).toBe(true);
    expect(depois.estado.tipos).toEqual({});
    expect(depois.estado.exercicios).toEqual({ 'Supino reto c/ hal.': { acao: 'MANTER' } });
    expect(depois.estado.alimentos).toEqual({});
    expect(depois.estado.suplementos).toEqual({});
    expect(AVISO_RESPONDIDO_ANTES).toBe('Respondido na importação anterior');
  });
});
