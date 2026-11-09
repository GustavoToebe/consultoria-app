import { ErroApi } from '@plataforma/web';

import type { ConfirmacaoResultado, GrupoImportavel } from '../servicos/importacaoAssistida';
import {
  campoDoErroDoTexto,
  grupoResumido,
  idsComErro,
  idsParaGravar,
  linhasDoGrupo,
  motivoDoErroDoGrupo,
  motivoParaNaoConfirmar,
  opcoesDoDestino,
  pedidoDoDestino,
  recarregarDepoisDoErro,
  resumoDoResultado,
  rotuloDaDuvida,
  seloDoGrupo,
  textoDoErroDaImportacao,
  textoDoEstadoDaSessao,
  tituloDoGrupoResumido,
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
  expect(valor(TUDO, 'Peso')).toBe('1 pesagem(ns)');
  expect(valor(TUDO, 'Treino')).toBe('2 divisão(ões)');
  expect(valor(TUDO, 'Dieta')).toBe('1 refeição(ões)');
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
  expect(ok.linhas).toContain('3 peso(s) gravado(s)');
  expect(ok.linhas).toContain('1 peso(s) não gravado(s): sem data legível, fora da faixa ou já registrado nessa data');
  expect(ok.linhas.some((l) => l.includes('dieta'))).toBe(false);

  expect(resumoDoResultado({ ...base, situacao: 'CONCLUIDA_COM_ERROS', gruposComErro: 1 }).alerta?.tom).toBe('atencao');
  const falhou = resumoDoResultado({ ...base, situacao: 'FALHOU', gruposImportados: 0, gruposComErro: 2 });
  expect(falhou.alerta?.tom).toBe('perigo');
  expect(falhou.descricao).toBeNull();
});
