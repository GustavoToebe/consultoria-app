import { ErroApi } from '@plataforma/web';

import type { ConfirmacaoResultado, DuvidaImportacao, GrupoImportavel, SessaoDetalhe } from '../servicos/importacaoAssistida';
import {
  campoDoErroDoTexto,
  duvidasVisiveis,
  gerarChaveIdempotencia,
  grupoResumido,
  idsComErro,
  idsParaGravar,
  idsSelecionaveisProntos,
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
} from './importacaoAssistida';

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

test('importado, ignorado e erro viram linha resumida; o esqueleto sem nome ganha título pelo destino', () => {
  expect(grupoResumido({ estado: 'PRONTO' })).toBe(false);
  expect(grupoResumido({ estado: 'IMPORTADO' })).toBe(true);
  expect(tituloDoGrupoResumido({ estado: 'IMPORTADO', destino: 'CRIAR_ALUNO', nomeDetectado: 'Importado' })).toBe('Aluno novo criado');
  expect(tituloDoGrupoResumido({ estado: 'IMPORTADO', destino: 'VINCULAR_EXISTENTE', nomeDetectado: 'Importado' })).toBe('Gravado num aluno já cadastrado');
  expect(tituloDoGrupoResumido({ estado: 'IMPORTADO', destino: 'MODELO_BIBLIOTECA', nomeDetectado: 'Importado' })).toBe('Salvo como modelo');
  expect(tituloDoGrupoResumido({ estado: 'IGNORADO', destino: 'CRIAR_ALUNO', nomeDetectado: 'Importado' })).toBe('Não gravado');
  expect(tituloDoGrupoResumido({ estado: 'ERRO', destino: 'CRIAR_ALUNO', nomeDetectado: 'Aluna Fictícia' })).toBe('Aluna Fictícia');
});

test('motivo do erro do grupo é legível; código desconhecido tem texto padrão', () => {
  expect(motivoDoErroDoGrupo('ALUNO_JA_EXISTE')).toBe('Já existe um aluno com este e-mail.');
  expect(motivoDoErroDoGrupo('SEM_PERMISSAO')).toMatch(/perfil/);
  expect(motivoDoErroDoGrupo('OUTRO_CODIGO')).toBe('Não foi possível gravar este grupo.');
  expect(motivoDoErroDoGrupo(null)).toBe('Não foi possível gravar este grupo.');
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
  expect(valor(TUDO, 'WhatsApp')).toBe('—');
  expect(linhasDoGrupo(grupo(), com(TUDO)).find((l) => l.rotulo === 'Peso')?.valor).toBe('—');
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
  expect(motivoParaNaoConfirmar([], com(TUDO))).toBe('Escolha o destino de pelo menos um grupo.');
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

  expect(sessaoRetomavel({ estado: 'RASCUNHO' })).toBe(true);
  expect(sessaoRetomavel({ estado: 'PROCESSANDO' })).toBe(true);
  expect(sessaoRetomavel({ estado: 'REVISANDO' })).toBe(true);
  expect(sessaoRetomavel({ estado: 'CONCLUIDA' })).toBe(false);
  expect(sessaoRetomavel({ estado: 'CANCELADA' })).toBe(false);
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
  expect(fallback.titulo).toMatch(/contingência/);
  expect(fallback.alertaFallback).toMatch(/regras fixas/);

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
  expect(idsSelecionaveisProntos([g1, g2, g3], com(TUDO))).toEqual(['g1']);

  expect(motivoParaNaoConfirmar([g1, g2], com(TUDO), new Set(), new Set(), 'hash-1')).toBe('Selecione pelo menos um grupo para gravar.');
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
});
