import { ErroApi } from '@plataforma/web';

import type { ConfirmacaoResultado, DuvidaImportacao, GrupoImportavel, SessaoDetalhe } from '../servicos/importacaoAssistida';
import {
  campoDoErroDoTexto,
  contagensDaSessaoEmAberto,
  contagensDasEtapas,
  duvidasVisiveis,
  etapaDaImportacao,
  prazoDaSessao,
  seloDaSessao,
  focoAoEntrar,
  gerarChaveIdempotencia,
  grupoResumido,
  idsComErro,
  idsParaGravar,
  idsSelecionaveisProntos,
  lidoSemIa,
  linhasDoGrupo,
  motivoDoErroDoArquivo,
  motivoDoErroDoGrupo,
  motivoParaNaoConfirmar,
  opcoesDoDestino,
  pedidoDoDestino,
  recarregarDepoisDoErro,
  resumoDaCoberturaDoArquivo,
  resumoDaSessao,
  resumoDoModoProcessamento,
  duvidasComSugestaoUnica,
  textoDaLeitura,
  resumoDoResultado,
  rotuloDaDuvida,
  seloDoGrupo,
  sessaoPodeCancelar,
  sessaoRetomavel,
  textoDoErroDaImportacao,
  textoDoEstadoDaSessao,
  tituloDoGrupoResumido,
  trechoDaDuvida,
  valorDoDestino,
  atalhosDoAlunoGravado,
  AVISO_DA_LEITURA_POR_IMAGEM,
  AVISO_LEITURA_NAO_TERMINOU,
  cadastroDoGrupo,
  FORMATOS_E_LIMITES,
  errosDoCadastro,
  FALHAS_ATE_AVISAR,
  melhorSugestao,
  motivosAntesDeEnviar,
  mudancasDoCadastro,
  resumoDaGravacao,
  rotuloDoLer,
  rotuloDoTipoDoApelido,
  sessaoAceitaArquivos,
  sessaoPodeLer,
  tetoDaEsperaMs,
  textoDoEnvio,
  textoDoModoDoArquivo,
} from './importacaoAssistida';

const ERROS = {
  LIMITE_DE_ARQUIVOS: 'Esta importação já tem arquivos demais. Leia estes e comece outra para o resto.',
  LIMITE_DE_VOLUME: 'Esta importação já passou do volume máximo. Leia estes e comece outra para o resto.',
};

const TUDO = ['ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR', 'PASTA_ALTERAR', 'MODELO_ALTERAR'];
const com = (lista: string[]) => (p: string) => lista.includes(p);

const grupo = (extra: Partial<GrupoImportavel> = {}): GrupoImportavel => ({
  id: 'g1', identificadorOrigem: 'g1', nomeDetectado: 'Aluna Fictícia', destino: 'CRIAR_ALUNO', arquivosOrigem: ['a.txt'],
  cadastro: { nome: 'Aluna Fictícia', email: 'aluna@exemplo.test' }, pesos: [], treino: null, dieta: null, pendenciasIds: [],
  estado: 'PRONTO', ...extra,
});

test('estado e dúvida em português; código desconhecido não quebra', () => {
  expect(textoDoEstadoDaSessao('RECEBENDO')).toBe('Recebendo arquivos');
  expect(textoDoEstadoDaSessao('OUTRO')).toBe('OUTRO');
  expect(rotuloDaDuvida('ALIMENTO_NAO_RECONHECIDO')).toBe('Alimento não reconhecido');
  expect(rotuloDaDuvida('NOVO_TIPO')).toBe('Termo ambíguo');
});

test('selo do grupo: âmbar só para dúvida, vermelho para erro, neutro para ignorado', () => {
  expect(seloDoGrupo('PRONTO').tipo).toBe('sucesso');
  expect(seloDoGrupo('IMPORTADO')).toEqual({ texto: 'Importado', tipo: 'sucesso' });
  expect(seloDoGrupo('IGNORADO')).toEqual({ texto: 'Ignorado', tipo: 'neutro' });
  expect(seloDoGrupo('COM_DUVIDAS')).toEqual({ texto: 'Com dúvidas', tipo: 'atencao' });
  expect(seloDoGrupo('ERRO').tipo).toBe('perigo');
});

test('importado e ignorado viram linha resumida; erro continua editável; o esqueleto ganha título pelo destino', () => {
  expect(grupoResumido({ estado: 'PRONTO' })).toBe(false);
  expect(grupoResumido({ estado: 'IMPORTADO' })).toBe(true);
  expect(grupoResumido({ estado: 'ERRO' })).toBe(false);
  expect(tituloDoGrupoResumido({ estado: 'IMPORTADO', destino: 'CRIAR_ALUNO', nomeDetectado: 'Importado' })).toBe('Aluno novo criado');
  expect(tituloDoGrupoResumido({ estado: 'IMPORTADO', destino: 'VINCULAR_EXISTENTE', nomeDetectado: 'Importado' })).toBe('Gravado num aluno já cadastrado');
  expect(tituloDoGrupoResumido({ estado: 'IMPORTADO', destino: 'MODELO_BIBLIOTECA', nomeDetectado: 'Importado' })).toBe('Salvo como modelo');
  expect(tituloDoGrupoResumido({ estado: 'IGNORADO', destino: 'CRIAR_ALUNO', nomeDetectado: 'Importado' })).toBe('Não gravado');
});

test('motivo do erro do grupo é legível; código desconhecido tem texto padrão', () => {
  expect(motivoDoErroDoGrupo('ALUNO_JA_EXISTE')).toBe('Já existe um aluno com este e-mail.');
  expect(motivoDoErroDoGrupo('SEM_PERMISSAO')).toMatch(/perfil/);
  expect(motivoDoErroDoGrupo('OUTRO_CODIGO')).toBe('Não foi possível gravar este aluno.');
  expect(motivoDoErroDoGrupo(null)).toBe('Não foi possível gravar este aluno.');
});

test('erros da API em português: código, 403 do confirmar, 429 e 503', () => {
  const erro = (status: number, codigo: string | null, msg = 'mensagem da API') => new ErroApi(status, codigo, msg);
  expect(textoDoErroDaImportacao(erro(400, 'FORMATO_NAO_SUPORTADO'))).toBe('Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.');
  expect(textoDoErroDaImportacao(erro(409, 'LIMITE_DE_SESSOES'))).toMatch(/importações demais/);
  expect(textoDoErroDaImportacao(erro(403, 'PERMISSAO_NEGADA'), 'confirmar')).toMatch(/Nada foi gravado/);
  expect(textoDoErroDaImportacao(erro(403, 'PERMISSAO_NEGADA'))).toBe('Seu perfil não permite esta ação.');
  expect(textoDoErroDaImportacao(erro(429, 'LOGIN_LIMITADO', 'Muitas tentativas de acesso.'))).toMatch(/^Muitas ações na importação/);
  expect(textoDoErroDaImportacao(erro(503, 'MIGRACAO_INDISPONIVEL'))).toBe('A importação assistida está desligada no momento.');
  expect(textoDoErroDaImportacao(erro(400, 'CODIGO_NOVO', 'Texto da API.'))).toBe('Texto da API.');
  expect(recarregarDepoisDoErro(erro(409, 'CONFLITO_EDICAO'))).toBe(true);
  expect(recarregarDepoisDoErro(erro(409, 'ALUNO_INATIVO'))).toBe(false);
  expect(campoDoErroDoTexto(erro(400, 'TITULO_GRANDE_DEMAIS'))).toBe('titulo');
  expect(campoDoErroDoTexto(erro(400, 'TEXTO_VAZIO'))).toBe('conteudo');
  expect(campoDoErroDoTexto(erro(409, 'LIMITE_DE_VOLUME'))).toBeNull();
});

test('sem a permissão de ler, peso, treino e dieta aparecem como "—", nunca zero', () => {
  const g = grupo({ pesos: [{ data: '2026-10-01', kg: 70 }], treino: { sessoes: [{}, {}] }, dieta: { refeicoes: [{}] } });
  const valor = (lista: string[], rotulo: string) => linhasDoGrupo(g, com(lista)).find((l) => l.rotulo === rotulo)?.valor;
  expect(valor(TUDO, 'Peso')).toBe('1 pesagem');
  expect(valor(TUDO, 'Treino')).toBe('2 divisões');
  expect(valor(TUDO, 'Dieta')).toBe('1 refeição');
  expect(valor([], 'Peso')).toBe('—');
  expect(valor([], 'Treino')).toBe('—');
  expect(valor(TUDO, 'WhatsApp')).toBeUndefined();
  expect(linhasDoGrupo(grupo(), com(TUDO)).find((l) => l.rotulo === 'Peso')?.valor).toBe('—');
});

test('dieta resume suplementos e medicação só em contagem; medicação só com ERGOGENICO_LER; zero não aparece', () => {
  const g = grupo({ dieta: { refeicoes: [{}], suplementacao: [{ nome: 'Segredo', dose: '5 g' }, {}], ergogenicos: [{ nome: 'Reservado' }] } });
  expect(linhasDoGrupo(g, com(TUDO)).find((l) => l.rotulo === 'Dieta')?.valor).toBe('1 refeição · 2 suplementos');
  const valor = linhasDoGrupo(g, com([...TUDO, 'ERGOGENICO_LER'])).find((l) => l.rotulo === 'Dieta')?.valor;
  expect(valor).toBe('1 refeição · 2 suplementos · 1 item de medicação e ergogênicos');
  expect(valor).not.toMatch(/Segredo|Reservado|5 g/);
  const vazio = grupo({ dieta: { refeicoes: [{}], suplementacao: [], ergogenicos: [] } });
  expect(linhasDoGrupo(vazio, com([...TUDO, 'ERGOGENICO_LER'])).find((l) => l.rotulo === 'Dieta')?.valor).toBe('1 refeição');
});

test('candidatos e "Criar aluno novo" numa escolha só; sem permissão, a opção fica desabilitada com o motivo', () => {
  const g = grupo({ treino: { sessoes: [{}] }, candidatos: [{ alunoId: 'a1', nome: 'Aluna Cadastrada', motivo: 'NOME' }] });
  const opcoes = opcoesDoDestino(g, com(TUDO));
  expect(opcoes.map((o) => o.rotulo)).toEqual(['Aluna Cadastrada · mesmo nome', 'Criar aluno novo', 'Salvar como modelo', 'Ignorar']);
  expect(opcoes.every((o) => !o.desabilitada)).toBe(true);

  const restritas = opcoesDoDestino(g, com([]));
  expect(restritas.find((o) => o.valor === 'NOVO')).toMatchObject({ desabilitada: true, motivo: 'Seu perfil não permite gravar treino e pasta.' });
  expect(restritas.find((o) => o.valor === 'MODELO_BIBLIOTECA')?.desabilitada).toBe(true);
  expect(restritas.find((o) => o.valor === 'IGNORAR')?.desabilitada).toBeUndefined();
});

test('com candidato e destino "criar", nada vem marcado até o treinador responder', () => {
  const g = grupo({ candidatos: [{ alunoId: 'a1', nome: 'Aluna Cadastrada', motivo: 'NOME' }] });
  expect(valorDoDestino(g, new Set())).toBeNull();
  expect(valorDoDestino(g, new Set(['g1']))).toBe('NOVO');
  expect(valorDoDestino(grupo(), new Set())).toBe('NOVO');
  expect(valorDoDestino(grupo({ destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'a1' }), new Set())).toBe('aluno:a1');
  expect(motivoParaNaoConfirmar([g], com(TUDO))).toBe('Diga se Aluna Fictícia é um aluno já cadastrado ou um aluno novo.');
  expect(motivoParaNaoConfirmar([g], com(TUDO), new Set(['g1']))).toBeNull();
});

test('pedido do destino: candidato vincula com o id; o resto só troca o destino', () => {
  expect(pedidoDoDestino('aluno:a1')).toEqual({ destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'a1' });
  expect(pedidoDoDestino('NOVO')).toEqual({ destino: 'CRIAR_ALUNO' });
  expect(pedidoDoDestino('IGNORAR')).toEqual({ destino: 'IGNORAR' });
});

test('gravar manda os pendentes; tentar de novo, só os com erro; nunca os importados nem os ignorados', () => {
  const grupos = [
    grupo({ id: 'a' }),
    grupo({ id: 'b', destino: 'IGNORAR' }),
    grupo({ id: 'c', estado: 'ERRO', erroCodigo: 'ERRO_AO_GRAVAR' }),
    grupo({ id: 'd', estado: 'IMPORTADO' }),
  ];
  expect(idsParaGravar(grupos)).toEqual(['a']);
  expect(idsComErro(grupos)).toEqual(['c']);
});

test('confirmar precisa de um grupo pendente e da permissão do que ele traz', () => {
  expect(motivoParaNaoConfirmar([], com(TUDO))).toBe('Escolha o destino de pelo menos um aluno.');
  expect(motivoParaNaoConfirmar([grupo({ destino: 'IGNORAR' })], com(TUDO))).not.toBeNull();
  expect(motivoParaNaoConfirmar([grupo({ destino: 'IGNORAR' }), grupo({ id: 'g2' })], com(TUDO))).toBeNull();
  expect(motivoParaNaoConfirmar([grupo({ pesos: [{ data: '2026-10-01', kg: 70 }] })], com([]))).toBe(
    'Seu perfil não permite gravar dados sensíveis (peso, objetivo, observações). Escolha outro destino para Aluna Fictícia.');
  expect(motivoParaNaoConfirmar([grupo({ destino: 'MODELO_BIBLIOTECA', treino: { sessoes: [] } })], com([]))).toMatch(/modelos/);
});

test('resumo do resultado: só as contagens que aconteceram, peso ignorado explicado e alerta pela situação', () => {
  const base: ConfirmacaoResultado = {
    id: 's1', situacao: 'CONCLUIDA', gruposImportados: 2, alunosCriados: 1, alunosVinculados: 1, treinosCriados: 1,
    dietasCriadas: 0, modelosCriados: 0, gruposComErro: 0, pesosGravados: 3, pesosIgnorados: 1,
  };
  const ok = resumoDoResultado(base);
  expect(ok.titulo).toBe('Importação concluída');
  expect(ok.alerta).toBeNull();
  expect(ok.linhas).toContain('3 pesos gravados');
  expect(ok.linhas).toContain('1 peso não gravado: sem data legível, fora da faixa ou já registrado nessa data');
  expect(ok.linhas.some((l) => l.includes('dieta'))).toBe(false);

  expect(resumoDoResultado({ ...base, situacao: 'CONCLUIDA_COM_ERROS', gruposComErro: 1 }).alerta?.tom).toBe('atencao');
  const falhou = resumoDoResultado({ ...base, situacao: 'FALHOU', gruposImportados: 0, gruposComErro: 2 });
  expect(falhou.alerta?.tom).toBe('perigo');
  expect(falhou.descricao).toBeNull();
});

test('novos erros, estados, retomada e cancelamento da importação assistida', () => {
  const erro = (status: number, codigo: string) => new ErroApi(status, codigo, 'msg');
  expect(textoDoEstadoDaSessao('RASCUNHO')).toBe('Rascunho');
  expect(textoDoEstadoDaSessao('CANCELADA')).toBe('Cancelada');
  expect(textoDoEstadoDaSessao('EXPIRADA')).toBe('Expirada');
  expect(textoDoErroDaImportacao(erro(400, 'SELECAO_VAZIA'))).toMatch(/Selecione pelo menos um/);
  expect(textoDoErroDaImportacao(erro(409, 'PREVIA_DESATUALIZADA'))).toMatch(/prévia mudou/i);
  expect(textoDoErroDaImportacao(erro(409, 'IDEMPOTENCIA_CONFLITANTE'))).toMatch(/outra seleção/);
  expect(textoDoErroDaImportacao(erro(409, 'SESSAO_CANCELADA'))).toMatch(/cancelada/);
  expect(textoDoErroDaImportacao(erro(409, 'SESSAO_EXPIRADA'))).toMatch(/expirou/);
  expect(textoDoErroDaImportacao(erro(409, 'SESSAO_PROCESSANDO'))).toMatch(/processada/);
  expect(textoDoErroDaImportacao(erro(404, 'CONTEUDO_INDISPONIVEL'))).toMatch(/conteúdo original/i);
  expect(recarregarDepoisDoErro(erro(409, 'PREVIA_DESATUALIZADA'))).toBe(true);
  expect(recarregarDepoisDoErro(erro(400, 'SELECAO_INVALIDA'))).toBe(true);
  expect(motivoDoErroDoArquivo('PDF_PROTEGIDO_POR_SENHA')).toMatch(/senha/);

  expect(sessaoRetomavel({ estado: 'RASCUNHO', totalArquivos: 1 })).toBe(true);
  expect(sessaoRetomavel({ estado: 'PROCESSANDO', totalArquivos: 1 })).toBe(true);
  expect(sessaoRetomavel({ estado: 'REVISANDO', totalArquivos: 2 })).toBe(true);
  expect(sessaoRetomavel({ estado: 'ERRO', totalArquivos: 2 })).toBe(true);
  expect(sessaoRetomavel({ estado: 'CONCLUIDA', totalArquivos: 1 })).toBe(false);
  expect(sessaoRetomavel({ estado: 'CANCELADA', totalArquivos: 1 })).toBe(false);
  // Sessão sem arquivo nenhum não tem o que retomar (2.1).
  expect(sessaoRetomavel({ estado: 'RASCUNHO', totalArquivos: 0 })).toBe(false);
  expect(sessaoPodeCancelar('REVISANDO')).toBe(true);
  expect(sessaoPodeCancelar('CONCLUIDA')).toBe(false);
});

test('resumo do modo de processamento e cobertura de leitura dos arquivos', () => {
  const ia = resumoDoModoProcessamento({ modoEfetivo: 'IA', provedorConfigurado: 'GEMINI', fallbackParaRegras: false });
  expect(ia.titulo).toMatch(/IA/);
  expect(ia.alertaFallback).toBeNull();

  const fallback = resumoDoModoProcessamento({
    modoEfetivo: 'REGRAS',
    provedorConfigurado: 'GEMINI',
    fallbackParaRegras: true,
    motivoFallback: 'TIMEOUT',
  });
  expect(fallback.titulo).toBe('Lido sem IA');
  expect(fallback.alertaFallback).toBe('A IA não pôde ler e foi lido sem IA. Confira os termos e os alunos com atenção.');

  const cortada = resumoDoModoProcessamento({ modoEfetivo: 'REGRAS', fallbackParaRegras: true, motivoFallback: 'RESPOSTA_CORTADA' });
  expect(cortada.alertaFallback).toBe('O documento era grande demais para a IA e foi lido sem IA. Confira os termos e os alunos com atenção.');
  // Uma frase, sem falar de servidor, chave nem provedor (2.8).
  for (const r of [ia, fallback, cortada, resumoDoModoProcessamento(null)]) {
    expect(`${r.descricao} ${r.alertaFallback ?? ''}`).not.toMatch(/servidor|chave|provedor|serviço/i);
  }

  expect(lidoSemIa({ modoEfetivo: 'REGRAS', fallbackParaRegras: false })).toBe(true);
  expect(lidoSemIa({ modoEfetivo: 'REGRAS', fallbackParaRegras: true })).toBe(true);
  expect(lidoSemIa({ modoEfetivo: 'IA', fallbackParaRegras: false })).toBe(false);
  expect(lidoSemIa(null)).toBe(false);

  expect(resumoDaCoberturaDoArquivo({ status: 'SEM_TEXTO', paginasTotal: 4, paginasLidas: 0, paginasSemTexto: 4 })).toEqual({
    texto: 'Nenhuma página legível (0 de 4)',
    tom: 'perigo',
  });
  expect(resumoDaCoberturaDoArquivo({
    status: 'PARCIAL',
    paginasTotal: 10,
    paginasLidas: 8,
    paginasSemTexto: 2,
    truncado: true,
  })).toEqual({
    texto: '8 de 10 páginas lidas · 2 sem texto · conteúdo truncado',
    tom: 'atencao',
  });
  expect(resumoDaCoberturaDoArquivo({ status: 'COMPLETA', blocos: 5, truncado: false })).toEqual({
    texto: '5 blocos lidos',
    tom: 'sucesso',
  });
});

test('seleção explícita de grupos e trava de hashPrevia na confirmação', () => {
  const g1 = grupo({ id: 'g1', estado: 'PRONTO' });
  const g2 = grupo({ id: 'g2', estado: 'COM_DUVIDAS' });
  const g3 = grupo({ id: 'g3', destino: 'IGNORAR' });
  // `COM_DUVIDAS` (termo aberto) também grava e entra nos prontos; o ignorado, não.
  expect(idsSelecionaveisProntos([g1, g2, g3], com(TUDO))).toEqual(['g1', 'g2']);

  expect(motivoParaNaoConfirmar([g1, g2], com(TUDO), new Set(), new Set(), 'hash-1')).toBe('Selecione pelo menos um aluno para gravar.');
  expect(motivoParaNaoConfirmar([g1, g2], com(TUDO), new Set(), new Set(['g1']), null)).toMatch(/prévia/i);
  expect(motivoParaNaoConfirmar([g1, g2], com(TUDO), new Set(), new Set(['g1']), 'hash-1')).toBeNull();

  const c1 = gerarChaveIdempotencia();
  const c2 = gerarChaveIdempotencia();
  expect(c1.length).toBeGreaterThan(8);
  expect(c1).not.toBe(c2);
});

describe('termos para conferir e resumo da sessão', () => {
  const duvida = (id: string, termo: string, extra: Partial<DuvidaImportacao> = {}): DuvidaImportacao => ({
    id, tipo: 'EXERCICIO_NAO_RECONHECIDO', termoOriginal: termo, trechoOriginal: `${termo} 4x10`, arquivoOrigem: 'Arquivo',
    ocorrencias: 1, sugestoes: [], resolvida: false, ...extra,
  });

  it('esconde o termo em branco ou só pontuação e mantém o resto', () => {
    const lista = [duvida('a', ''), duvida('b', '   '), duvida('c', '"" .;'), duvida('d', 'sup inc'), duvida('e', 'açaí'), duvida('f', '3x')];
    expect(duvidasVisiveis(lista).map((d) => d.id)).toEqual(['d', 'e', 'f']);
    expect(duvidasVisiveis(undefined)).toEqual([]);
  });

  it('trecho em branco vira "—"', () => {
    expect(trechoDaDuvida({ trechoOriginal: '' })).toBe('—');
    expect(trechoDaDuvida({ trechoOriginal: '  ' })).toBe('—');
    expect(trechoDaDuvida({ trechoOriginal: ' sup inc 4x10 ' })).toBe('sup inc 4x10');
  });

  const g = (id: string, extra: Partial<GrupoImportavel> = {}): GrupoImportavel => ({
    id, identificadorOrigem: id, nomeDetectado: id, destino: 'CRIAR_ALUNO', arquivosOrigem: [], pesos: [], pendenciasIds: [],
    estado: 'PRONTO', ...extra,
  });
  const arquivo = (id: string, erroCodigo: string | null = null) => ({
    id, nomeOriginal: id, formato: 'PDF', tamanhoBytes: 1, estado: 'LIDO', criadoEm: '', erroCodigo,
  });
  const sessao: Pick<SessaoDetalhe, 'estado' | 'arquivos' | 'grupos' | 'duvidas'> = {
    estado: 'REVISANDO',
    arquivos: [arquivo('a'), arquivo('b', 'ARQUIVO_ILEGIVEL'), arquivo('c')],
    grupos: [g('1', { treino: {} }), g('2', { treino: {}, dieta: {} }), g('3')],
    duvidas: [duvida('x', 'sup'), duvida('y', 'rosca', { resolvida: true }), duvida('z', '')],
  };

  it('conta arquivos lidos, alunos, treinos, dietas e termos pendentes', () => {
    expect(resumoDaSessao(sessao, () => true)).toEqual({
      linhas: [
        { rotulo: 'Arquivos lidos', valor: '2 de 3' },
        { rotulo: 'Alunos encontrados', valor: '3' },
        { rotulo: 'Treinos encontrados', valor: '2' },
        { rotulo: 'Dietas encontradas', valor: '1' },
      ],
      termosPendentes: 1,
    });
  });

  it('sem permissão de ler treino e dieta mostra "—", nunca zero', () => {
    const { linhas } = resumoDaSessao(sessao, () => false);
    expect(linhas.map((l) => l.valor)).toEqual(['2 de 3', '3', '—', '—']);
  });

  it('antes de ler só conta os arquivos enviados', () => {
    expect(resumoDaSessao({ ...sessao, estado: 'RECEBENDO', grupos: [], duvidas: [] }, () => true)).toEqual({
      linhas: [
        { rotulo: 'Arquivos enviados', valor: '3' },
        { rotulo: 'Alunos encontrados', valor: '—' },
        { rotulo: 'Treinos encontrados', valor: '—' },
        { rotulo: 'Dietas encontradas', valor: '—' },
      ],
      termosPendentes: null,
    });
  });

  describe('etapa atual (máquina de estados → 5 etapas)', () => {
    const resolvidas = { ...sessao, duvidas: [duvida('y', 'rosca', { resolvida: true }), duvida('z', '')] };
    it.each([
      ['sem sessão', null, false, 1],
      ['sessão sem arquivo', { ...sessao, estado: 'RASCUNHO' as const, arquivos: [] }, false, 1],
      ['recebendo', { ...sessao, estado: 'RECEBENDO' as const }, false, 2],
      ['lendo', { ...sessao, estado: 'PROCESSANDO' as const }, false, 2],
      ['erro de leitura', { ...sessao, estado: 'ERRO' as const }, false, 2],
      ['lida sem aluno encontrado', { ...sessao, grupos: [] }, true, 2],
      ['termo pendente', sessao, true, 3],
      ['sem termo, seleção inválida', resolvidas, false, 4],
      ['sem termo, pronto para gravar', resolvidas, true, 5],
      ['concluída', { ...sessao, estado: 'CONCLUIDA' as const }, false, 5],
    ])('%s', (_nome, s, pronto, etapa) => {
      expect(etapaDaImportacao(s, pronto)).toBe(etapa);
    });
  });

  it('contagens das etapas: as da sessão, a seleção e os gravados; antes de ler, "—"', () => {
    const lida = { ...sessao, grupos: [...sessao.grupos, g('4', { estado: 'IMPORTADO' })] };
    expect(contagensDasEtapas(lida, () => true, { marcados: 1, possiveis: 3 })).toEqual([
      [{ rotulo: 'Arquivos enviados', valor: '3' }],
      [
        { rotulo: 'Arquivos lidos', valor: '2 de 3' },
        { rotulo: 'Alunos encontrados', valor: '4' },
        { rotulo: 'Treinos encontrados', valor: '2' },
        { rotulo: 'Dietas encontradas', valor: '1' },
      ],
      [{ rotulo: 'Termos pendentes', valor: '1', atencao: true }],
      [{ rotulo: 'Selecionados', valor: '1 de 3' }],
      [{ rotulo: 'Já gravados', valor: '1' }],
    ]);
    const antes = contagensDasEtapas({ ...sessao, estado: 'RECEBENDO', grupos: [], duvidas: [] }, () => true, { marcados: 0, possiveis: 0 });
    expect(antes.flat().map((c) => c.valor)).toEqual(['3', '—', '—', '—', '—', '—', '—', '—']);
    const semTermo = contagensDasEtapas({ ...sessao, duvidas: [] }, () => true, { marcados: 0, possiveis: 3 });
    expect(semTermo[2]).toEqual([{ rotulo: 'Termos pendentes', valor: 'Nenhum', atencao: false }]);
  });
});

describe('importações em aberto', () => {
  it('selo: âmbar onde o treinador age, vermelho no erro, neutro lendo', () => {
    expect(seloDaSessao('REVISANDO')).toEqual({ texto: 'Em revisão', tipo: 'atencao' });
    expect(seloDaSessao('RECEBENDO')).toEqual({ texto: 'Recebendo arquivos', tipo: 'atencao' });
    expect(seloDaSessao('ERRO')).toEqual({ texto: 'Com erro', tipo: 'perigo' });
    expect(seloDaSessao('PROCESSANDO')).toEqual({ texto: 'Processando', tipo: 'neutro' });
    expect(seloDaSessao('RASCUNHO').tipo).toBe('neutro');
  });

  it('contagens: alunos e dúvidas só depois de ler, singular e plural', () => {
    const item = { estado: 'REVISANDO' as const, totalArquivos: 2, totalGrupos: 16, duvidasAbertas: 26 };
    expect(contagensDaSessaoEmAberto(item)).toBe('2 arquivos · 16 alunos · 26 dúvidas');
    expect(contagensDaSessaoEmAberto({ ...item, totalArquivos: 1, totalGrupos: 1, duvidasAbertas: 1 })).toBe('1 arquivo · 1 aluno · 1 dúvida');
    expect(contagensDaSessaoEmAberto({ ...item, duvidasAbertas: 0 })).toBe('2 arquivos · 16 alunos · 0 dúvidas');
    expect(contagensDaSessaoEmAberto({ ...item, estado: 'RECEBENDO', totalGrupos: 0, duvidasAbertas: 0 })).toBe('2 arquivos');
    expect(contagensDaSessaoEmAberto({ ...item, estado: 'ERRO' })).toBe('2 arquivos');
  });

  it('prazo pelas datas de Brasília: hoje, 1 dia, N dias; vencida ou sem data some', () => {
    const agora = new Date('2026-11-26T15:00:00Z'); // 12h em Brasília
    expect(prazoDaSessao('2026-11-27T02:00:00Z', agora)).toBe('expira hoje'); // 23h do mesmo dia
    expect(prazoDaSessao('2026-11-27T03:30:00Z', agora)).toBe('expira em 1 dia'); // 0h30 do dia seguinte
    expect(prazoDaSessao('2026-12-03T15:00:00Z', agora)).toBe('expira em 7 dias');
    expect(prazoDaSessao('2026-11-26T14:00:00Z', agora)).toBeNull();
    expect(prazoDaSessao(null, agora)).toBeNull();
    expect(prazoDaSessao('não é data', agora)).toBeNull();
  });

  it('o 413 do corpo vira arquivo grande demais com o limite', () => {
    expect(textoDoErroDaImportacao(new ErroApi(413, 'CORPO_EXCEDIDO', 'x'))).toMatch(/900 KB/);
  });
});

describe('foco ao entrar na tela', () => {
  const termo = (id: string, termoOriginal: string, resolvida = false): DuvidaImportacao => ({
    id, tipo: 'EXERCICIO_NAO_RECONHECIDO', termoOriginal, trechoOriginal: '', arquivoOrigem: 'Arquivo', ocorrencias: 1,
    sugestoes: [], resolvida,
  });
  const parecido = grupo({ id: 'g2', candidatos: [{ alunoId: 'a1', nome: 'Aluno Fictício', motivo: 'NOME' }] });
  const base: Pick<SessaoDetalhe, 'estado' | 'duvidas' | 'grupos'> = { estado: 'REVISANDO', duvidas: [], grupos: [] };

  it('sem sessão vai ao título', () => {
    expect(focoAoEntrar(null)).toEqual({ tipo: 'titulo' });
  });

  it('antes de ler e depois de uma leitura que não terminou, o botão de ler', () => {
    expect(focoAoEntrar({ ...base, estado: 'RECEBENDO' })).toEqual({ tipo: 'ler' });
    expect(focoAoEntrar({ ...base, estado: 'RASCUNHO' })).toEqual({ tipo: 'ler' });
    expect(focoAoEntrar({ ...base, estado: 'ERRO' })).toEqual({ tipo: 'ler' });
  });

  it('o primeiro termo pendente visível vem antes do aluno parecido', () => {
    const duvidas = [termo('a', ''), termo('b', 'rosca', true), termo('c', 'sup inc'), termo('d', 'leg')];
    expect(focoAoEntrar({ ...base, duvidas, grupos: [parecido] })).toEqual({ tipo: 'termo', duvidaId: 'c' });
  });

  it('sem termo pendente, o primeiro aluno parecido sem resposta', () => {
    expect(focoAoEntrar({ ...base, duvidas: [termo('b', 'rosca', true)], grupos: [grupo(), parecido] })).toEqual({ tipo: 'aluno', grupoId: 'g2' });
  });

  it('nada pendente (lendo ou só gravar) fica no título', () => {
    expect(focoAoEntrar({ ...base, estado: 'PROCESSANDO' })).toEqual({ tipo: 'titulo' });
    expect(focoAoEntrar({ ...base, grupos: [grupo(), { ...parecido, destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'a1' }] })).toEqual({ tipo: 'titulo' });
  });
});

test('motivo da contingência dito com clareza e contagem da leitura em andamento', () => {
  const semChave = resumoDoModoProcessamento({ modoEfetivo: 'REGRAS', fallbackParaRegras: true, motivoFallback: 'CHAVE_AUSENTE' });
  expect(semChave.alertaFallback).toMatch(/^A leitura com IA não está disponível agora/);
  const falhou = resumoDoModoProcessamento({ modoEfetivo: 'REGRAS', fallbackParaRegras: true, motivoFallback: 'ERRO_PROVEDOR' });
  expect(falhou.alertaFallback).toMatch(/segunda tentativa/);
  expect(falhou.alertaFallback).toMatch(/Confira/);
  const desligado = resumoDoModoProcessamento({ modoEfetivo: 'REGRAS', fallbackParaRegras: false, motivoFallback: 'ENVIO_DESLIGADO' });
  expect(desligado.alertaFallback).toBeNull();
  expect(desligado.descricao).toBe('Lido sem IA, por regras fixas. Confira os termos antes de gravar.');

  expect(textoDaLeitura({ lidos: 2, total: 5 })).toBe('Lendo 2 de 5 arquivos');
  expect(textoDaLeitura({ lidos: 0, total: 1 })).toBe('Lendo 0 de 1 arquivo');
  expect(textoDaLeitura({ lidos: 9, total: 5 })).toBe('Lendo 5 de 5 arquivos');
  expect(textoDaLeitura(null)).toBeNull();
  expect(textoDaLeitura({ lidos: 0, total: 0 })).toBeNull();
  // Na fila da consultoria: sem contagem falsa; ao começar volta ao "Lendo X de N".
  expect(textoDaLeitura({ lidos: 0, total: 3, aguardando: true })).toBe('Na fila: aguardando outra leitura terminar');
  expect(textoDaLeitura({ lidos: 0, total: 3, aguardando: false })).toBe('Lendo 0 de 3 arquivos');
});

test('só a sugestão única da biblioteca entra no "Aceitar todas as sugestões"', () => {
  const duvida = (id: string, tipo: string, sugestoes: { termo: string; referenciaId?: string | null }[], resolvida = false) => ({
    id, tipo, termoOriginal: id, trechoOriginal: '', arquivoOrigem: 'a.txt', ocorrencias: 1, resolvida,
    sugestoes: sugestoes.map((s) => ({ ...s, origem: s.referenciaId ? 'BIBLIOTECA' : 'IA', nota: null })),
  }) as DuvidaImportacao;
  const lista = [
    duvida('a', 'EXERCICIO_NAO_RECONHECIDO', [{ termo: 'Supino', referenciaId: 'r1' }]),
    duvida('b', 'ALIMENTO_NAO_RECONHECIDO', [{ termo: 'Arroz', referenciaId: 'r2' }]),
    duvida('c', 'EXERCICIO_NAO_RECONHECIDO', [{ termo: 'X', referenciaId: 'r3' }, { termo: 'Y', referenciaId: 'r4' }]),
    duvida('d', 'EXERCICIO_NAO_RECONHECIDO', [{ termo: 'Só IA', referenciaId: null }]),
    duvida('e', 'EXERCICIO_NAO_RECONHECIDO', [{ termo: 'Feita', referenciaId: 'r5' }], true),
    duvida('f', 'OUTRO_TERMO', [{ termo: 'Z', referenciaId: 'r6' }]),
  ];
  expect(duvidasComSugestaoUnica(lista).map((d) => d.id)).toEqual(['a', 'b']);
});

test('planilha .xls antiga pede para salvar como .xlsx', () => {
  const erro = new ErroApi(422, 'FORMATO_XLS_ANTIGO', 'texto do servidor');
  expect(textoDoErroDaImportacao(erro)).toBe('Salve como .xlsx no Excel e envie de novo.');
});

describe('revisão de 28/11', () => {
  it('0.3: a leitura que falhou oferece "Tentar ler de novo"', () => {
    expect(sessaoPodeLer('ERRO')).toBe(true);
    expect(sessaoPodeLer('RECEBENDO')).toBe(true);
    expect(sessaoPodeLer('REVISANDO')).toBe(false);
    expect(sessaoPodeLer('REVISANDO', [{ estado: 'PROCESSADO' }, { estado: 'RECEBIDO' }])).toBe(true);
    expect(sessaoPodeLer('REVISANDO', [{ estado: 'PROCESSADO' }])).toBe(false);
    expect(sessaoPodeLer('PROCESSANDO')).toBe(false);
    expect(rotuloDoLer('ERRO')).toBe('Tentar ler de novo');
    expect(rotuloDoLer('RECEBENDO')).toBe('Ler os arquivos');
    expect(AVISO_LEITURA_NAO_TERMINOU).toBe('A leitura não terminou. Seus arquivos continuam aqui.');
  });

  it('2.1: acrescentar arquivos com a sessão aberta, menos lendo ou encerrada', () => {
    expect(sessaoAceitaArquivos('REVISANDO')).toBe(true);
    expect(sessaoAceitaArquivos('ERRO')).toBe(true);
    expect(sessaoAceitaArquivos('PROCESSANDO')).toBe(false);
    expect(sessaoAceitaArquivos('CONCLUIDA')).toBe(false);
  });

  it('2.1: confere extensão, 900 KB, 20 arquivos e 8 MB antes de subir, contando o que a sessão já tem', () => {
    const KB = 1024;
    const motivos = motivosAntesDeEnviar([
      { nome: 'treino.PDF', tamanho: 100 * KB },
      { nome: 'foto.png', tamanho: 10 },
      { nome: 'antiga.xls', tamanho: 10 },
      { nome: 'grande.docx', tamanho: 901 * KB },
      { nome: 'vazio.csv', tamanho: 0 },
      { nome: 'sem-tamanho.xlsx' },
      { nome: 'semextensao' },
    ], { quantos: 0, bytes: 0 });
    expect(motivos).toEqual([
      null,
      'Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.',
      'Salve como .xlsx no Excel e envie de novo.',
      'Passa do tamanho máximo de 900 KB. Divida em partes menores.',
      'O arquivo está vazio.',
      null,
      'Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.',
    ]);
    // 19 na sessão: o primeiro aceito ocupa a vaga e o seguinte passa de 20.
    expect(motivosAntesDeEnviar([{ nome: 'a.pdf', tamanho: 1 }, { nome: 'b.pdf', tamanho: 1 }], { quantos: 19, bytes: 0 }))
      .toEqual([null, ERROS.LIMITE_DE_ARQUIVOS]);
    // O recusado não conta: o volume e a vaga ficam para o próximo.
    expect(motivosAntesDeEnviar([{ nome: 'x.png' }, { nome: 'a.pdf', tamanho: 500 * KB }], { quantos: 19, bytes: 8 * 1024 * KB - 600 * KB }))
      .toEqual(['Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.', null]);
    expect(motivosAntesDeEnviar([{ nome: 'a.pdf', tamanho: 800 * KB }], { quantos: 3, bytes: 8 * 1024 * KB - 100 * KB }))
      .toEqual([ERROS.LIMITE_DE_VOLUME]);
    expect(textoDoEnvio({ nome: 'a.pdf', motivo: null })).toBe('Enviado');
    expect(textoDoEnvio({ nome: 'x.png', motivo: 'Formato não aceito.' })).toBe('Recusado: Formato não aceito.');
  });

  it('4.2: com a leitura por imagem ligada, JPG e PNG passam no mesmo 900 KB; desligada, nada muda', () => {
    const KB = 1024;
    const lista = [
      { nome: 'print.PNG', tamanho: 300 * KB },
      { nome: 'foto.jpeg', tamanho: 900 * KB },
      { nome: 'foto.jpg', tamanho: 901 * KB },
      { nome: 'anim.gif', tamanho: 10 },
    ];
    expect(motivosAntesDeEnviar(lista, { quantos: 0, bytes: 0 }, true)).toEqual([
      null,
      null,
      'Passa do tamanho máximo de 900 KB. Divida em partes menores.',
      'Formato não aceito. Envie PDF, DOCX, XLSX, CSV, JPG ou PNG.',
    ]);
    expect(motivosAntesDeEnviar(lista, { quantos: 0, bytes: 0 })).toEqual(Array(4).fill('Formato não aceito. Envie PDF, DOCX, XLSX ou CSV.'));
    // Imagem conta na vaga e no volume como qualquer arquivo.
    expect(motivosAntesDeEnviar([{ nome: 'a.png', tamanho: 1 }, { nome: 'b.jpg', tamanho: 1 }], { quantos: 19, bytes: 0 }, true))
      .toEqual([null, ERROS.LIMITE_DE_ARQUIVOS]);
    expect(FORMATOS_E_LIMITES).toBe('PDF, DOCX, XLSX ou CSV · até 20 arquivos, 900 KB cada e 8 MB no total');
    expect(AVISO_DA_LEITURA_POR_IMAGEM).toMatch(/enviados inteiros ao provedor de IA/);
    expect(AVISO_DA_LEITURA_POR_IMAGEM).toMatch(/não envie fotos de corpo/);
  });

  it('4.2: lido pela imagem do documento, sem a cobertura do texto extraído', () => {
    expect(textoDoModoDoArquivo({ modo: 'IA', enviadoComoArquivo: true })).toEqual({ texto: 'Lido pela imagem do documento', atencao: false });
    expect(textoDoModoDoArquivo({ modo: 'IA', enviadoComoArquivo: false })).toEqual({ texto: 'Lido com IA', atencao: false });
    expect(resumoDaCoberturaDoArquivo({ status: 'SEM_TEXTO', paginasTotal: 2, paginasLidas: 0 }, true)).toBeNull();
    expect(resumoDaCoberturaDoArquivo({ status: 'SEM_TEXTO' }, false)?.tom).toBe('perigo');
  });

  it('2.2: cadastro editável valida nome, e-mail e WhatsApp e manda só o que mudou', () => {
    const antes = cadastroDoGrupo(grupo({ cadastro: { nome: 'Aluna Fictícia', email: 'aluna@exemplo.test', telefone: null } }));
    expect(antes).toEqual({ nome: 'Aluna Fictícia', email: 'aluna@exemplo.test', telefone: '' });
    expect(errosDoCadastro(antes)).toEqual({});
    expect(errosDoCadastro({ nome: ' ', email: 'sem-arroba', telefone: '123' })).toEqual({
      nome: 'Informe o nome do aluno.',
      email: 'Informe um e-mail válido, como nome@exemplo.com.',
      telefone: 'Telefone inválido. Informe o DDD e o número.',
    });
    expect(mudancasDoCadastro(antes, { ...antes })).toBeNull();
    expect(mudancasDoCadastro(antes, { ...antes, email: '', telefone: '(11) 98765-4321' })).toEqual({ email: '', telefone: '(11) 98765-4321' });
  });

  it('2.4: a melhor sugestão é a da biblioteca de maior nota', () => {
    const sug = (termo: string, referenciaId: string | null, nota: number | null) => ({ termo, referenciaId, origem: 'X', nota });
    expect(melhorSugestao({ sugestoes: [sug('Só IA', null, 0.99), sug('Supino reto', 'r1', 0.6), sug('Supino', 'r2', 0.9)] })?.termo).toBe('Supino');
    expect(melhorSugestao({ sugestoes: [sug('Só IA', null, 0.5)] })?.termo).toBe('Só IA');
    expect(melhorSugestao({ sugestoes: [] })).toBeNull();
  });

  it('2.7: frase do que a gravação vai fazer, pelo destino dos marcados', () => {
    const lista = [grupo({ id: 'a' }), grupo({ id: 'b' }), grupo({ id: 'c', destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'x' }), grupo({ id: 'd', destino: 'MODELO_BIBLIOTECA' })];
    expect(resumoDaGravacao(lista, new Set(['a', 'b']))).toBe('Vai criar 2 alunos novos.');
    expect(resumoDaGravacao(lista, new Set(['a', 'c', 'd']))).toBe('Vai criar 1 aluno novo, gravar em 1 aluno já cadastrado e salvar 1 modelo.');
    expect(resumoDaGravacao(lista, new Set())).toBeNull();
  });

  it('2.6: o teto da espera cresce a cada 3 arquivos', () => {
    expect(tetoDaEsperaMs(0)).toBe(12 * 60_000);
    expect(tetoDaEsperaMs(3)).toBe(12 * 60_000);
    expect(tetoDaEsperaMs(4)).toBe(24 * 60_000);
    expect(FALHAS_ATE_AVISAR).toBe(5);
  });

  it('2.5: atalhos por aluno gravado: ficha sempre, rascunhos só os criados', () => {
    expect(atalhosDoAlunoGravado({ alunoId: 'a1', nome: 'Aluna Fictícia', criado: true, treinoId: 't1', dietaId: null }).map((a) => [a.rotulo, a.href])).toEqual([
      ['Abrir ficha', '/treinador/alunos/a1'],
      ['Abrir rascunho do treino', '/treinador/treinos/t1'],
    ]);
    expect(atalhosDoAlunoGravado({ alunoId: 'a2', nome: 'Aluno Fictício', criado: false }).map((a) => a.rotulo)).toEqual(['Abrir ficha']);
  });

  it('2.8: textos sem "grupo" e modo por arquivo', () => {
    expect(textoDoModoDoArquivo({ modo: 'IA' })).toEqual({ texto: 'Lido com IA', atencao: false });
    expect(textoDoModoDoArquivo({ modo: 'REGRAS', motivoFallback: 'ENVIO_DESLIGADO' })).toEqual({ texto: 'Lido sem IA, por regras fixas', atencao: false });
    expect(textoDoModoDoArquivo({ modo: 'REGRAS', motivoFallback: 'RESPOSTA_CORTADA' })).toEqual({ texto: 'O documento era grande demais para a IA e foi lido sem IA.', atencao: true });
    expect(textoDoModoDoArquivo({ modo: null })).toBeNull();
    expect(textoDoModoDoArquivo({ modo: 'IA', motivoFallback: 'RESPOSTA_CORTADA' })).toEqual({ texto: 'Lido pela IA; uma parte caiu nas regras', atencao: true });
    const emParte = resumoDoModoProcessamento({ modoEfetivo: 'IA', fallbackParaRegras: true, motivoFallback: 'RESPOSTA_CORTADA' });
    expect(emParte.titulo).toBe('Lido pela IA; uma parte caiu nas regras');
    expect(emParte.alertaFallback).toMatch(/^Uma parte do documento foi lida sem IA/);
    // Tempo da IA esgotado: o aviso fixo da API, sem um segundo "Confira".
    const tempo = 'O tempo de leitura com IA acabou: parte do documento foi lida pelas regras fixas. Confira com atenção.';
    expect(textoDoModoDoArquivo({ modo: 'REGRAS', motivoFallback: 'TEMPO_ESGOTADO' })).toEqual({ texto: tempo, atencao: true });
    expect(textoDoModoDoArquivo({ modo: 'IA', motivoFallback: 'TEMPO_ESGOTADO' })).toEqual({ texto: 'Lido pela IA; uma parte caiu nas regras', atencao: true });
    const semTempo = resumoDoModoProcessamento({ modoEfetivo: 'REGRAS', fallbackParaRegras: true, motivoFallback: 'TEMPO_ESGOTADO' });
    expect(semTempo).toEqual({ titulo: 'Lido sem IA', descricao: 'Lido sem IA, por regras fixas.', alertaFallback: tempo });
    const emParteSemTempo = resumoDoModoProcessamento({ modoEfetivo: 'IA', fallbackParaRegras: true, motivoFallback: 'TEMPO_ESGOTADO' });
    expect(emParteSemTempo.titulo).toBe('Lido pela IA; uma parte caiu nas regras');
    expect(emParteSemTempo.alertaFallback).toBe(tempo);
    expect(textoDoErroDaImportacao(new ErroApi(409, 'GRUPO_JA_IMPORTADO', 'x'))).not.toMatch(/grupo/i);
    expect(rotuloDoTipoDoApelido('EXERCICIO_NAO_RECONHECIDO')).toBe('Exercício');
    expect(rotuloDoTipoDoApelido('ALIMENTO')).toBe('Alimento');
  });
});
