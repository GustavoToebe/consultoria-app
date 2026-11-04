// node --test scripts/questionario/inscricao-saraiva.test.mjs
// 1) Confere o conteúdo da inscrição do Saraiva contra os limites do questionário (os mesmos de
//    api/src/test/resources/paridade-questionario/limites.json) e contra o que a inscrição pública recusa.
// 2) Roda o script de verdade contra uma API de mentira em 127.0.0.1 (sem rede, dados fictícios): simulação sem
//    escrita, permissões, MFA, gravação com a ordem e os corpos certos, o texto e o resto do link preservados,
//    idempotência e a restauração do rascunho quando a API recusa.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CAMPOS_ESCONDIDOS, DESCRICAO, NOME, TEXTO_DO_LINK, TIPOS_FORA_DA_INSCRICAO, canonico, conteudoDaInscricao, mesmoConteudo,
  perguntasDe, planoDaConfiguracao, problemasDaInscricao, resumo,
} from './inscricao-saraiva-lib.mjs';

const limites = JSON.parse(readFileSync(new URL('../../api/src/test/resources/paridade-questionario/limites.json', import.meta.url), 'utf8'));
const L = (nome, padrao) => limites[nome] ?? padrao;
const conteudo = conteudoDaInscricao();
const perguntas = perguntasDe(conteudo);

// ---- conteúdo ----

test('cabe nos limites de seções, perguntas e textos', () => {
  assert.ok(conteudo.secoes.length <= L('secoes', 15));
  assert.ok(perguntas.length <= L('perguntasTotal', 80));
  for (const s of conteudo.secoes) {
    assert.ok(s.perguntas.length <= L('perguntasPorSecao', 40), s.titulo);
    assert.ok(s.titulo.length <= L('tituloTamanho', 80), s.titulo);
  }
  assert.ok(conteudo.instrucoes.length <= L('instrucoes', 10));
  for (const p of perguntas) {
    assert.match(p.id, /^[A-Za-z0-9_-]{1,40}$/);
    assert.ok(p.rotulo.length <= L('rotuloTamanho', 200), p.rotulo);
    assert.ok((p.ajuda ?? '').length <= L('ajudaTamanho', 300), p.rotulo);
    for (const o of p.opcoes ?? []) assert.ok(o.rotulo.length <= L('opcaoTamanho', 80), o.rotulo);
    if (p.opcoes) assert.ok(p.opcoes.length >= L('opcoesMinimo', 2) && p.opcoes.length <= L('opcoesMaximo', 20), p.rotulo);
  }
  assert.ok(DESCRICAO.length <= 400 && NOME.length <= 120);
  assert.ok(TEXTO_DO_LINK.length <= 2000);
  // Capacidade de texto que a pessoa pode escrever (TEXTO 500, TEXTO_LONGO 2000) dentro do teto do questionário.
  const capacidade = perguntas.reduce((soma, p) => soma + (p.tipo === 'TEXTO' ? L('textoCurtoCapacidade', 500)
    : p.tipo === 'TEXTO_LONGO' ? L('textoLongoCapacidade', 2000) : 0), 0);
  assert.ok(capacidade <= L('capacidadeDeTextoTal', L('capacidadeDeTextoTotal', 40000)));
});

test('ids únicos e as 14 perguntas pedidas, na ordem, com a 4b logo depois da 4', () => {
  const ids = perguntas.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(perguntas.map((p) => [p.tipo, p.rotulo]), [
    ['TEXTO', 'Qual o seu Instagram? Pode enviar o @ ou o link do Instagram.'],
    ['ESCOLHA_UNICA', 'Qual a sua idade?'],
    ['TEXTO_LONGO', 'Treina musculação há quanto tempo? Você gosta de treinar?'],
    ['SIM_NAO', 'Você tem alguma planilha do time?'],
    ['TEXTO_LONGO', 'Me conte como foi a sua experiência com a planilha.'],
    ['TEXTO', 'Qual a sua profissão?'],
    ['ESCOLHA_UNICA', 'Você já contratou alguma consultoria antes?'],
    ['ESCOLHA_UNICA', 'Em que tipo de academia você treina?'],
    ['TEXTO', 'Você é hormonizado ou natural?'],
    ['TEXTO_LONGO', 'O que você busca com a consultoria SV Team? Qual o seu objetivo? Seja detalhista.'],
    ['TEXTO_LONGO', 'Qual o seu maior desafio hoje? Seja detalhista.'],
    ['TEXTO_LONGO', 'Por que me vê como seu treinador?'],
    ['TEXTO_LONGO', 'O que te fez procurar o meu trabalho?'],
    ['TEXTO_LONGO', 'O que você gostaria de conquistar com a consultoria em 1 ano? Alguma meta, algo no seu corpo te incomoda?'],
    ['ESCOLHA_UNICA', 'Quanto você está disposto a investir mensalmente na consultoria?'],
  ]);
  assert.equal(perguntas.length, 15);
  assert.deepEqual(resumo(conteudo), { secoes: 1, perguntas: 15, obrigatorias: 13, condicionais: 1 });
});

test('todas obrigatórias, menos a 4 e a 4b', () => {
  const opcionais = perguntas.filter((p) => !p.obrigatoria).map((p) => p.rotulo);
  assert.deepEqual(opcionais, ['Você tem alguma planilha do time?', 'Me conte como foi a sua experiência com a planilha.']);
});

test('a 4b só aparece com "Sim" na 4, que vem antes e é SIM_NAO (a API confere sim/nao)', () => {
  const planilha = perguntas.find((p) => p.tipo === 'SIM_NAO');
  const experiencia = perguntas.find((p) => p.mostrarSe);
  assert.deepEqual(experiencia.mostrarSe, { perguntaId: planilha.id, valores: ['sim'] });
  assert.ok(perguntas.indexOf(planilha) < perguntas.indexOf(experiencia));
  assert.equal(perguntas.filter((p) => p.mostrarSe).length, 1);
});

test('opções exatas das quatro escolhas, com ids únicos por pergunta', () => {
  const rotulos = (rotuloDaPergunta) => perguntas.find((p) => p.rotulo === rotuloDaPergunta).opcoes.map((o) => o.rotulo);
  assert.deepEqual(rotulos('Qual a sua idade?'), [
    'Menos de 15 anos', '15 a 17 anos', '18 a 21 anos', '22 a 25 anos', '26 a 29 anos', '30 a 34 anos', '35 anos ou mais',
  ]);
  assert.deepEqual(rotulos('Você já contratou alguma consultoria antes?'), [
    'Sim, tive uma boa experiência', 'Não, nunca contratei um acompanhamento', 'Sim, tive uma experiência ruim', 'Sim, já tive acompanhamento presencial',
  ]);
  assert.deepEqual(rotulos('Em que tipo de academia você treina?'), [
    'Academia de bairro',
    'Academia de rede (Smart Fit, Blue Fit, Panobianco etc.)',
    'Academia premium (Retro Flex, Bodytech, Ironberg, Nation etc.)',
    'Academia de condomínio ou treino em casa',
  ]);
  assert.deepEqual(rotulos('Quanto você está disposto a investir mensalmente na consultoria?'), [
    'Até R$ 300', 'De R$ 300 a R$ 500', 'De R$ 500 a R$ 1.000', 'Mais de R$ 1.000', 'Não tenho nenhuma quantia para investir',
  ]);
  for (const p of perguntas.filter((x) => x.opcoes)) assert.equal(new Set(p.opcoes.map((o) => o.id)).size, p.opcoes.length);
});

test('passa nas regras da inscrição: sem FOTOS, ENDERECO, PESO, imagem, destino nem ajuda automática', () => {
  assert.deepEqual(problemasDaInscricao(conteudo), []);
  for (const p of perguntas) {
    assert.ok(!TIPOS_FORA_DA_INSCRICAO.includes(p.tipo), p.rotulo);
    for (const campo of ['imagemId', 'imagem', 'destino', 'destinoData', 'ajudaAutomatica']) assert.ok(!(campo in p), `${p.rotulo}: ${campo}`);
    for (const o of p.opcoes ?? []) assert.ok(!('imagemId' in o) && !('imagem' in o));
  }
  // O verificador de verdade recusa o que a inscrição não aceita.
  const ruim = { ...conteudo, secoes: [{ ...conteudo.secoes[0], perguntas: [
    { id: 'x1', tipo: 'FOTOS', rotulo: 'Foto', obrigatoria: false },
    { id: 'x2', tipo: 'TEXTO', rotulo: 'Peso', obrigatoria: false, destino: 'OBJETIVO' },
    { id: 'x3', tipo: 'ESCOLHA_UNICA', rotulo: 'Com imagem', obrigatoria: false, opcoes: [{ id: 'o1', rotulo: 'A', imagemId: 'abc' }] },
  ] }] };
  assert.equal(problemasDaInscricao(ruim).length, 3);
});

test('o texto do link é o pedido, com o negrito, e os campos escondidos são os quatro', () => {
  assert.match(TEXTO_DO_LINK, /^Esta é uma lista do time da consultoria do SV Team e iremos te guiar rumo à sua melhor versão!/);
  assert.ok(TEXTO_DO_LINK.includes('\n\n**Obs: NÃO preencha este formulário caso NÃO tiver a pretensão de entrar AGORA.**\n\n'));
  assert.ok(TEXTO_DO_LINK.endsWith('Seus dados são usados só para entrarmos em contato com você sobre a consultoria.'));
  assert.deepEqual(CAMPOS_ESCONDIDOS, ['SEXO', 'OBJETIVO', 'INTERESSE', 'MODALIDADE']);
});

test('comparação ignora ordem de chaves e campos nulos (a API devolve os ausentes como null)', () => {
  const comNulos = JSON.parse(JSON.stringify(conteudo));
  for (const p of comNulos.secoes[0].perguntas) { p.ajuda = null; p.mostrarSe ??= null; p.destino = null; }
  assert.ok(mesmoConteudo(comNulos, conteudo));
  assert.deepEqual(canonico({ b: 1, a: null, c: [{ z: 1, y: undefined }] }), { b: 1, c: [{ z: 1 }] });
  const outro = JSON.parse(JSON.stringify(conteudo));
  outro.secoes[0].perguntas[0].rotulo += '!';
  assert.ok(!mesmoConteudo(outro, conteudo));
});

test('plano do link: troca texto e campos só se mudou e mantém ligado e responsável', () => {
  assert.deepEqual(planoDaConfiguracao({ aberta: true, responsavelId: 'u1', texto: null, camposOcultos: [] }),
    { aberta: true, responsavelId: 'u1', texto: true, campos: true, voltamAAparecer: [] });
  assert.deepEqual(planoDaConfiguracao({ aberta: false, responsavelId: null, texto: TEXTO_DO_LINK, camposOcultos: ['OBJETIVO', 'SEXO', 'MODALIDADE', 'INTERESSE'] }),
    { aberta: false, responsavelId: null, texto: false, campos: false, voltamAAparecer: [] });
  assert.deepEqual(planoDaConfiguracao({ aberta: true, texto: 'outro', camposOcultos: ['EMAIL', 'SEXO'] }).voltamAAparecer, ['EMAIL']);
});

// ---- o script contra uma API de mentira ----

const SCRIPT = fileURLToPath(new URL('./inscricao-saraiva.mjs', import.meta.url));
const PADRAO_ANTIGO = { id: 'a0000000-0000-4000-8000-000000000001', nome: 'Inscrição padrão', descricao: null, finalidade: 'INSCRICAO', padrao: true,
  arquivado: false, versaoPublicada: 1, alteradoDesdePublicacao: false };

let servidor;
let base;
let chamadas;
let estado;

const reiniciar = () => {
  chamadas = [];
  estado = {
    permissoes: ['QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR', 'INSCRICAO_LER', 'INSCRICAO_ALTERAR'],
    questionarios: [{ ...PADRAO_ANTIGO, versao: 4, rascunho: { formato: 2, instrucoes: [], secoes: [] } }],
    config: { aberta: true, codigo: 'codigo-de-teste', link: 'http://exemplo.test/inscricao/codigo-de-teste', responsavelId: 'b0000000-0000-4000-8000-000000000002',
      texto: 'Texto antigo.', camposOcultos: ['EMAIL'], versao: 7 },
    errosDaValidacao: [],
  };
};

const resumoDe = (q) => ({ id: q.id, nome: q.nome, descricao: q.descricao, finalidade: q.finalidade, padrao: q.padrao, arquivado: false,
  versaoPublicada: q.versaoPublicada, alteradoDesdePublicacao: q.alteradoDesdePublicacao });

before(async () => {
  servidor = createServer((req, res) => {
    let texto = '';
    req.on('data', (c) => { texto += c; });
    req.on('end', () => {
      const corpo = texto ? JSON.parse(texto) : null;
      const [caminho, busca] = req.url.split('?');
      chamadas.push({ metodo: req.method, caminho, busca: busca ?? '', corpo });
      const responder = (dados, status = 200) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(dados)); };
      const q = estado.questionarios.find((x) => caminho.startsWith(`/questionarios/${x.id}`));
      if (caminho === '/auth/login') return responder({ accessToken: 'token-de-teste' });
      if (caminho === '/eu') return responder({ permissoes: estado.permissoes });
      if (caminho === '/questionarios' && req.method === 'GET') return responder(estado.questionarios.map(resumoDe));
      if (caminho === '/questionarios' && req.method === 'POST') {
        const novo = { id: 'c0000000-0000-4000-8000-000000000003', nome: corpo.nome, descricao: corpo.descricao, finalidade: corpo.finalidade, padrao: false,
          versaoPublicada: 0, alteradoDesdePublicacao: false, versao: 0, rascunho: { formato: 2, instrucoes: [], secoes: [] } };
        estado.questionarios.push(novo);
        return responder(novo);
      }
      if (q && req.method === 'GET') return responder(q);
      if (q && req.method === 'PUT') {
        q.nome = corpo.nome; q.descricao = corpo.descricao; q.rascunho = corpo.conteudo; q.versao += 1; q.alteradoDesdePublicacao = true;
        return responder(q);
      }
      if (q && caminho.endsWith('/validar')) return responder({ erros: estado.errosDaValidacao, avisos: [] });
      if (q && caminho.endsWith('/publicar')) { q.versaoPublicada += 1; q.alteradoDesdePublicacao = false; return responder(q); }
      if (q && caminho.endsWith('/padrao')) { for (const o of estado.questionarios) o.padrao = false; q.padrao = true; return responder(q); }
      if (caminho === '/inscricoes/configuracao' && req.method === 'GET') return responder(estado.config);
      if (caminho === '/inscricoes/configuracao' && req.method === 'PUT') {
        estado.config = { ...estado.config, aberta: corpo.aberta, responsavelId: corpo.responsavelId, texto: corpo.texto, versao: estado.config.versao + 1 };
        return responder(estado.config);
      }
      if (caminho === '/inscricoes/configuracao/campos-ocultos') {
        estado.config = { ...estado.config, camposOcultos: corpo.camposOcultos, versao: estado.config.versao + 1 };
        return responder(estado.config);
      }
      return responder({}, 404);
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => { await new Promise((ok) => servidor.close(ok)); });
beforeEach(reiniciar);

/** Roda o script com ambiente limpo (nada do ambiente real do PC chega nele). */
function rodar(args, env) {
  const limpo = { ...process.env };
  for (const k of ['API_URL', 'INSCRICAO_EMAIL', 'INSCRICAO_SENHA', 'CODIGO_MFA', 'IMPORT_PERMITIR_HTTP']) delete limpo[k];
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env: { ...limpo, ...env }, timeout: 30000 }, (erro, stdout, stderr) => {
      resolve({ codigo: erro ? erro.code : 0, saida: `${stdout}${stderr}` });
    });
  });
}

const ENV = () => ({ API_URL: base, INSCRICAO_EMAIL: 'treinador@exemplo.com', INSCRICAO_SENHA: 'senha-de-teste' });
const escritas = () => chamadas.filter((c) => c.metodo !== 'GET' && c.caminho !== '/auth/login');
const caminhos = () => escritas().map((c) => `${c.metodo} ${c.caminho.replace(/[0-9a-f-]{36}/g, '<id>')}`);

test('sem INSCRICAO_EMAIL e INSCRICAO_SENHA para antes de qualquer chamada', async () => {
  const r = await rodar([], { API_URL: base });
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /Defina INSCRICAO_EMAIL e INSCRICAO_SENHA/);
  assert.deepEqual(chamadas, []);
});

test('recusa API_URL em http fora da máquina local, sem abrir conexão nem repetir a senha', async () => {
  const r = await rodar(['--gravar'], { API_URL: 'http://consultoria.exemplo.com/api', INSCRICAO_EMAIL: 'a@b.c', INSCRICAO_SENHA: 'senha-de-teste' });
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /API_URL precisa ser https/);
  assert.ok(!r.saida.includes('senha-de-teste'));
  assert.deepEqual(chamadas, []);
});

test('o login leva o código MFA do ambiente; sem CODIGO_MFA o campo não vai', async () => {
  await rodar([], { ...ENV(), CODIGO_MFA: '123456' });
  assert.deepEqual(chamadas.find((c) => c.caminho === '/auth/login').corpo, { email: 'treinador@exemplo.com', senha: 'senha-de-teste', codigoMfa: '123456' });
  reiniciar();
  await rodar([], ENV());
  assert.deepEqual(chamadas.find((c) => c.caminho === '/auth/login').corpo, { email: 'treinador@exemplo.com', senha: 'senha-de-teste' });
});

test('sem QUESTIONARIO_ALTERAR e INSCRICAO_ALTERAR nada é lido nem gravado, nem na simulação', async () => {
  estado.permissoes = ['QUESTIONARIO_LER', 'INSCRICAO_LER'];
  for (const args of [[], ['--gravar']]) {
    chamadas = [];
    const r = await rodar(args, ENV());
    assert.equal(r.codigo, 1);
    assert.match(r.saida, /Faltam permissões para este login: QUESTIONARIO_ALTERAR, INSCRICAO_ALTERAR\. Nada foi gravado\./);
    assert.deepEqual(chamadas.map((c) => c.caminho), ['/auth/login', '/eu']);
  }
  estado.permissoes = ['QUESTIONARIO_ALTERAR'];
  const so = await rodar(['--gravar'], ENV());
  assert.match(so.saida, /Faltam permissões para este login: INSCRICAO_ALTERAR\./);
});

test('simular lê, mostra o resumo e não escreve nada (nem o login muda a API)', async () => {
  const antes = JSON.stringify(estado);
  const r = await rodar([], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(escritas(), []);
  assert.equal(JSON.stringify(estado), antes);
  assert.match(r.saida, /Questionário "Inscrição Saraiva Team" não existe: será criado\./);
  assert.match(r.saida, /1 seção, 15 perguntas \(13 obrigatórias, 1 condicional\)/);
  assert.match(r.saida, /Será o padrão da inscrição \(hoje o padrão é "Inscrição padrão"\)\./);
  assert.match(r.saida, /Link: ligado, com responsável \(não mudam\)\./);
  assert.match(r.saida, /Campos fixos escondidos: SEXO, OBJETIVO, INTERESSE, MODALIDADE; voltam a aparecer: EMAIL\./);
  assert.match(r.saida, /Simulação: nada foi gravado\./);
  assert.ok(!r.saida.includes('senha-de-teste'));
  // Não mostra o texto que está no ar nem as perguntas.
  assert.ok(!r.saida.includes('Texto antigo.') && !r.saida.includes('hormonizado'));
});

test('--gravar cria, salva, valida, publica, define o padrão, troca o texto e esconde os campos, nessa ordem', async () => {
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(caminhos(), [
    'POST /questionarios',
    'PUT /questionarios/<id>',
    'POST /questionarios/<id>/validar',
    'POST /questionarios/<id>/publicar',
    'POST /questionarios/<id>/padrao',
    'PUT /inscricoes/configuracao',
    'PUT /inscricoes/configuracao/campos-ocultos',
  ]);
  const [criar, salvar, , publicar, , config, campos] = escritas();
  assert.deepEqual(criar.corpo, { nome: NOME, descricao: DESCRICAO, origem: 'VAZIO', finalidade: 'INSCRICAO' });
  assert.deepEqual(salvar.corpo, { nome: NOME, descricao: DESCRICAO, conteudo, versao: 0 });
  assert.deepEqual(publicar.corpo, { versao: 1, confirmarAvisos: true });
  // O resto do link fica como estava: ligado, responsável; só o texto muda. Cada rota usa a versão que a anterior devolveu.
  assert.deepEqual(config.corpo, { aberta: true, responsavelId: 'b0000000-0000-4000-8000-000000000002', texto: TEXTO_DO_LINK, versao: 7 });
  assert.deepEqual(campos.corpo, { camposOcultos: ['SEXO', 'OBJETIVO', 'INTERESSE', 'MODALIDADE'], versao: 8 });
  assert.equal(estado.config.codigo, 'codigo-de-teste');
  assert.equal(estado.config.aberta, true);
  const nosso = estado.questionarios.find((q) => q.nome === NOME);
  assert.equal(nosso.padrao, true);
  assert.equal(estado.questionarios.find((q) => q.nome === 'Inscrição padrão').padrao, false);
  assert.ok(!r.saida.includes('senha-de-teste'));
});

test('rodar duas vezes é idempotente: a segunda não cria, não salva, não publica nem mexe no link', async () => {
  await rodar(['--gravar'], ENV());
  const depois = JSON.stringify(estado);
  chamadas = [];
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(escritas(), []);
  assert.equal(JSON.stringify(estado), depois);
  assert.match(r.saida, /Nada a gravar/);
  assert.equal(estado.questionarios.filter((q) => q.nome === NOME).length, 1);
  // E a simulação diz que está tudo como o script monta.
  chamadas = [];
  const simulada = await rodar([], ENV());
  assert.match(simulada.saida, /Já está publicado com este conteúdo/);
  assert.match(simulada.saida, /Já é o padrão da inscrição\./);
  assert.match(simulada.saida, /Texto de apresentação: já é este\./);
});

test('link desligado e sem responsável continua assim', async () => {
  estado.config = { aberta: false, codigo: 'codigo-de-teste', link: 'x', responsavelId: null, texto: null, camposOcultos: [], versao: 2 };
  await rodar(['--gravar'], ENV());
  const config = escritas().find((c) => c.caminho === '/inscricoes/configuracao');
  assert.deepEqual(config.corpo, { aberta: false, responsavelId: null, texto: TEXTO_DO_LINK, versao: 2 });
  assert.equal(estado.config.aberta, false);
});

test('só o texto errado: troca o texto e não mexe nos campos nem no questionário', async () => {
  await rodar(['--gravar'], ENV());
  estado.config.texto = 'Outro texto.';
  chamadas = [];
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(caminhos(), ['PUT /inscricoes/configuracao']);
  assert.equal(estado.config.texto, TEXTO_DO_LINK);
});

test('rascunho alterado depois da publicação: salva e publica de novo, sem recriar nem trocar o padrão', async () => {
  await rodar(['--gravar'], ENV());
  const nosso = estado.questionarios.find((q) => q.nome === NOME);
  nosso.rascunho = { ...nosso.rascunho, instrucoes: ['Mexido à mão.'] };
  nosso.alteradoDesdePublicacao = true;
  chamadas = [];
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(caminhos(), ['PUT /questionarios/<id>', 'POST /questionarios/<id>/validar', 'POST /questionarios/<id>/publicar']);
  assert.ok(mesmoConteudo(nosso.rascunho, conteudo));
  assert.equal(nosso.versaoPublicada, 2);
});

test('a API recusando o conteúdo: restaura o rascunho anterior, não publica nem troca o padrão e não mexe no link', async () => {
  // O questionário já existe, com um rascunho antigo que não é o do script.
  const antigo = { formato: 2, instrucoes: ['Rascunho antigo.'], secoes: [] };
  estado.questionarios.push({ id: 'c0000000-0000-4000-8000-000000000003', nome: NOME, descricao: 'Descrição antiga', finalidade: 'INSCRICAO',
    padrao: false, versaoPublicada: 1, alteradoDesdePublicacao: true, versao: 3, rascunho: antigo });
  estado.errosDaValidacao = [{ caminho: 'secoes[0].perguntas[0].tipo', mensagem: 'Este tipo não vale no formulário de inscrição.' }];
  const configAntes = JSON.stringify(estado.config);
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /A API recusou 1 ponto\(s\):/);
  assert.match(r.saida, /O rascunho anterior foi restaurado\. Nada foi publicado\./);
  assert.deepEqual(caminhos(), ['PUT /questionarios/<id>', 'POST /questionarios/<id>/validar', 'PUT /questionarios/<id>']);
  const nosso = estado.questionarios.find((q) => q.nome === NOME);
  assert.deepEqual(nosso.rascunho, antigo);
  assert.equal(nosso.descricao, 'Descrição antiga');
  assert.equal(nosso.versaoPublicada, 1);
  assert.equal(nosso.padrao, false);
  assert.equal(JSON.stringify(estado.config), configAntes);
  // A segunda escrita restaura com a versão que a primeira devolveu.
  const [salvar, , restaurar] = escritas();
  assert.equal(restaurar.corpo.versao, salvar.corpo.versao + 1);
});

test('erro da API mostra só método, caminho, status e código (nunca o corpo)', async () => {
  const falho = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/auth/login') return res.end(JSON.stringify({ accessToken: 't' }));
    if (req.url === '/eu') return res.end(JSON.stringify({ permissoes: ['QUESTIONARIO_ALTERAR', 'INSCRICAO_ALTERAR'] }));
    res.statusCode = 500;
    return res.end(JSON.stringify({ codigo: 'ERRO_X', message: 'segredo-do-corpo' }));
  });
  await new Promise((ok) => falho.listen(0, '127.0.0.1', ok));
  try {
    const r = await rodar([], { ...ENV(), API_URL: `http://127.0.0.1:${falho.address().port}` });
    assert.equal(r.codigo, 1);
    assert.match(r.saida, /GET \/questionarios -> 500 ERRO_X/);
    assert.ok(!r.saida.includes('segredo-do-corpo'));
  } finally {
    await new Promise((ok) => falho.close(ok));
  }
});
