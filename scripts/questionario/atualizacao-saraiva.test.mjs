// node --test scripts/questionario/atualizacao-saraiva.test.mjs
// Roda o script de verdade contra uma API de mentira em 127.0.0.1 (sem rede, dados fictícios): simulação sem escrita e com a
// lista final, permissões, achar o padrão pela API, as 8 trocas conferidas contra as regras do ValidadorQuestionario,
// gravação na ordem certa, idempotência e a restauração do rascunho quando a API recusa.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const limites = JSON.parse(readFileSync(new URL('../../api/src/test/resources/paridade-questionario/limites.json', import.meta.url), 'utf8'));
const L = (nome, padrao) => limites[nome] ?? padrao;

const p = (id, tipo, rotulo, extra = {}) => ({ id, tipo, rotulo, obrigatoria: false, ...extra });
/** O rascunho do padrão de hoje (V001 do repositório: texto livre nas 8 perguntas que o script troca). */
const rascunhoDeHoje = () => ({
  formato: 2,
  instrucoes: ['O feedback deve ser enviado no dia da atualização. Caso ocorram atrasos, avise previamente.', 'Atualização de peso e fotos em jejum'],
  secoes: [
    { uid: 'secao-1', titulo: 'Atualização', perguntas: [
      p('data', 'DATA_AUTOMATICA', 'Atualização'),
      p('peso', 'PESO', 'Peso (em jejum)', { obrigatoria: true }),
      p('fotos', 'FOTOS', 'Fotos em jejum'),
      p('psicologico', 'TEXTO_LONGO', 'Como foi o seu psicológico durante o mês?'),
      p('sono', 'NOTA', 'De 0 a 10, como foi o seu sono?', { destaque: true, obrigatoria: true, rotuloCurto: 'Sono' }),
      p('estresse', 'TEXTO_LONGO', 'Passou algum momento de estresse?'),
    ] },
    { uid: 'secao-2', titulo: 'Alimentar', perguntas: [
      p('alim_desempenho', 'NOTA', 'Desempenho (0 a 10)', { destaque: true, obrigatoria: true, rotuloCurto: 'Alimentar' }),
      p('alim_faltou', 'TEXTO_LONGO', 'Sentiu que faltou algo durante a dieta?'),
      p('alim_livre', 'TEXTO_LONGO', 'O que comeu em cada refeição livre e em qual quantidade?'),
      p('alim_digestao', 'TEXTO', 'Como está sua digestão?'),
      p('alim_fome', 'TEXTO', 'Momento que mais ficou com fome'),
      p('alim_enjoou', 'TEXTO_LONGO', 'Algum alimento que enjoou ou gostaria de substituir?'),
      p('alim_incluir', 'TEXTO_LONGO', 'Gostaria de comer algo durante as refeições (e em qual refeição)?'),
    ] },
    { uid: 'secao-3', titulo: 'Treino', perguntas: [
      p('treino_dias', 'TEXTO', 'Quantos dias por semana está conseguindo treinar?', { ajudaAutomatica: 'MEDIA_DIAS_TREINO' }),
      p('treino_desempenho', 'NOTA', 'Desempenho (0 a 10)', { destaque: true, obrigatoria: true, rotuloCurto: 'Treino' }),
      p('treino_dores', 'TEXTO_LONGO', 'Sentiu dores ou dificuldades? Quais as dores? Em quais exercícios?'),
      p('treino_descanso', 'TEXTO', 'Precisou fazer descanso no meio da semana? Se sim, qual dia?'),
      p('treino_acrescentar', 'TEXTO_LONGO', 'Algo a acrescentar?'),
    ] },
    { uid: 'secao-4', titulo: 'Feedbacks dos treinos durante esse período', perguntas: [
      p('fb_recuperacao', 'TEXTO_LONGO', 'De 0 a 10, como foi a recuperação de cada dia?'),
      p('fb_dores', 'TEXTO_LONGO', 'Sentiu dores durante a semana?'),
      p('fb_fadiga', 'TEXTO_LONGO', 'Sentiu muita fadiga durante a semana?'),
      p('fb_desgastante', 'TEXTO', 'Qual dia foi mais desgastante?'),
      p('fb_substituiu', 'TEXTO_LONGO', 'Teve algum exercício que substituiu por não ter o maquinário próprio na sua academia? Se sim, quais?'),
      p('fb_recuperou', 'TEXTO_LONGO', 'Seu músculo recuperou até a próxima sessão de treino?'),
      p('fb_pos_treino', 'NOTAS_POR_DIA', 'De 0 a 10, como você se sentiu pós-treino nos dias abaixo', { dias: [1, 2, 3, 4, 5, 6] }),
      p('fb_mes', 'TEXTO_LONGO', 'Me diz brevemente um feedback desse mês ou alguma observação relevante para o seu desenvolvimento'),
    ] },
  ],
});

const IDS_VELHOS = ['alim_fome', 'alim_enjoou', 'treino_dias', 'treino_dores', 'treino_descanso', 'fb_desgastante', 'fb_substituiu', 'fb_recuperou'];
const SCRIPT = fileURLToPath(new URL('./atualizacao-saraiva.mjs', import.meta.url));
const ID_PADRAO = 'a0000000-0000-4000-8000-000000000001';
const ID_OUTRO = 'a0000000-0000-4000-8000-000000000002';

let servidor;
let base;
let chamadas;
let estado;

const reiniciar = () => {
  chamadas = [];
  estado = {
    permissoes: ['QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR'],
    errosDaValidacao: [],
    questionarios: [
      { id: ID_PADRAO, nome: 'Atualização padrão', descricao: 'Descrição do padrão', finalidade: 'ATUALIZACAO', padrao: true, arquivado: false,
        versaoPublicada: 3, alteradoDesdePublicacao: false, versao: 9, rascunho: rascunhoDeHoje() },
      { id: ID_OUTRO, nome: 'Outra atualização', descricao: null, finalidade: 'ATUALIZACAO', padrao: false, arquivado: false,
        versaoPublicada: 1, alteradoDesdePublicacao: false, versao: 2, rascunho: rascunhoDeHoje() },
    ],
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
      if (caminho === '/questionarios' && req.method === 'GET') return responder(estado.questionarios.filter((x) => busca === `finalidade=${x.finalidade}`).map(resumoDe));
      if (q && req.method === 'GET') return responder(q);
      if (q && req.method === 'PUT') {
        q.nome = corpo.nome; q.descricao = corpo.descricao; q.rascunho = corpo.conteudo; q.versao += 1; q.alteradoDesdePublicacao = true;
        return responder(q);
      }
      if (q && caminho.endsWith('/validar')) return responder({ erros: estado.errosDaValidacao, avisos: [] });
      if (q && caminho.endsWith('/publicar')) { q.versaoPublicada += 1; q.alteradoDesdePublicacao = false; return responder(q); }
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
  for (const k of ['API_URL', 'ATUALIZACAO_EMAIL', 'ATUALIZACAO_SENHA', 'CODIGO_MFA', 'IMPORT_PERMITIR_HTTP']) delete limpo[k];
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env: { ...limpo, ...env }, timeout: 30000 }, (erro, stdout, stderr) => {
      resolve({ codigo: erro ? erro.code : 0, saida: `${stdout}${stderr}` });
    });
  });
}

const ENV = () => ({ API_URL: base, ATUALIZACAO_EMAIL: 'treinador@exemplo.com', ATUALIZACAO_SENHA: 'senha-de-teste' });
const escritas = () => chamadas.filter((c) => c.metodo !== 'GET' && c.caminho !== '/auth/login');
const caminhos = () => escritas().map((c) => `${c.metodo} ${c.caminho.replace(/[0-9a-f-]{36}/g, '<id>')}`);
const padrao = () => estado.questionarios.find((q) => q.id === ID_PADRAO);
const todas = (conteudo) => conteudo.secoes.flatMap((s) => s.perguntas);
const porId = (conteudo, id) => todas(conteudo).find((x) => x.id === id);

test('sem ATUALIZACAO_EMAIL e ATUALIZACAO_SENHA para antes de qualquer chamada', async () => {
  const r = await rodar([], { API_URL: base });
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /Defina ATUALIZACAO_EMAIL e ATUALIZACAO_SENHA/);
  assert.deepEqual(chamadas, []);
});

test('recusa API_URL em http fora da máquina local, sem abrir conexão nem repetir a senha', async () => {
  const r = await rodar(['--gravar'], { API_URL: 'http://consultoria.exemplo.com/api', ATUALIZACAO_EMAIL: 'a@b.c', ATUALIZACAO_SENHA: 'senha-de-teste' });
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

test('sem QUESTIONARIO_ALTERAR nada é lido nem gravado, nem na simulação', async () => {
  estado.permissoes = ['QUESTIONARIO_LER'];
  for (const args of [[], ['--gravar']]) {
    chamadas = [];
    const r = await rodar(args, ENV());
    assert.equal(r.codigo, 1);
    assert.match(r.saida, /Faltam permissões para este login: QUESTIONARIO_ALTERAR\. Nada foi gravado\./);
    assert.deepEqual(chamadas.map((c) => c.caminho), ['/auth/login', '/eu']);
  }
});

test('sem questionário padrão da atualização: para sem gravar', async () => {
  for (const q of estado.questionarios) q.padrao = false;
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /Não há questionário de atualização padrão/);
  assert.deepEqual(escritas(), []);
});

test('simular imprime a lista final e o diff e não escreve nada', async () => {
  const antes = JSON.stringify(estado);
  const r = await rodar([], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(escritas(), []);
  assert.equal(JSON.stringify(estado), antes);
  assert.match(r.saida, /Questionário padrão da atualização: "Atualização padrão" \(versão publicada 3\); rascunho diferente/);
  assert.match(r.saida, /Lista final \(32 perguntas/);
  assert.match(r.saida, /\[MULTIPLA_ESCOLHA\] Momento que mais ficou com fome {2}\(opções: Manhã \| Tarde \| Noite \| Madrugada \| Não senti mais fome que o normal\)/);
  assert.match(r.saida, /Em quais exercícios\?.*fonte EXERCICIOS_DO_TREINO.*motivo OPCIONAL.*rótulo do motivo "Onde e como doeu\?".*só aparece se "Sentiu dores ou dificuldades\?" = Sim/);
  assert.match(r.saida, /Qual dia foi mais desgastante\?.*fonte DIAS_TREINADOS; escolha única; motivo OPCIONAL/);
  assert.match(r.saida, /só aparece se "Seu músculo recuperou até a próxima sessão\?" = Não/);
  assert.match(r.saida, /Diff contra o rascunho atual: 8 saem, 14 entram, 18 ficam como estão\./);
  assert.match(r.saida, /Motivo de "Qual dia foi mais desgastante\?": OPCIONAL/);
  assert.match(r.saida, /Simulação: nada foi gravado\./);
  assert.ok(!r.saida.includes('senha-de-teste') && !r.saida.includes('token-de-teste') && !r.saida.includes('treinador@exemplo.com'));
});

test('--gravar troca as 8 perguntas, mantém o resto e publica, nessa ordem', async () => {
  const antigo = rascunhoDeHoje();
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(caminhos(), ['PUT /questionarios/<id>', 'POST /questionarios/<id>/validar', 'POST /questionarios/<id>/publicar']);
  assert.ok(escritas().every((c) => c.caminho.includes(ID_PADRAO)));
  const [salvar, , publicar] = escritas();
  assert.equal(salvar.corpo.nome, 'Atualização padrão');
  assert.equal(salvar.corpo.descricao, 'Descrição do padrão');
  assert.equal(salvar.corpo.versao, 9);
  assert.deepEqual(publicar.corpo, { versao: 10, confirmarAvisos: true });
  assert.equal(padrao().versaoPublicada, 4);
  // O outro questionário não foi tocado.
  assert.deepEqual(estado.questionarios.find((q) => q.id === ID_OUTRO).rascunho, antigo);

  const novo = salvar.corpo.conteudo;
  assert.deepEqual(novo.instrucoes, antigo.instrucoes);
  assert.deepEqual(novo.secoes.map((s) => [s.uid, s.titulo]), antigo.secoes.map((s) => [s.uid, s.titulo]));
  // As 18 perguntas que já eram de tocar ou de texto que fica, idênticas e na mesma ordem relativa.
  const ficam = todas(antigo).filter((x) => !IDS_VELHOS.includes(x.id));
  assert.deepEqual(todas(novo).filter((x) => ficam.some((f) => f.id === x.id)), ficam);
  assert.equal(ficam.length, 18);
  // Nenhum id velho sobra e nenhum id novo repete um velho (o tipo de um id publicado não muda).
  for (const id of IDS_VELHOS) assert.equal(porId(novo, id), undefined, id);
  const idsNovos = todas(novo).map((x) => x.id);
  assert.equal(new Set(idsNovos).size, idsNovos.length);
  assert.ok(!r.saida.includes('senha-de-teste'));
});

test('as 8 perguntas: tipos, textos, opções e configuração do contrato', async () => {
  await rodar(['--gravar'], ENV());
  const c = padrao().rascunho;
  const resumo = (id) => { const x = porId(c, id); return [x.tipo, x.rotulo]; };

  assert.deepEqual(resumo('alim_fome_periodo'), ['MULTIPLA_ESCOLHA', 'Momento que mais ficou com fome']);
  assert.deepEqual(porId(c, 'alim_fome_periodo').opcoes.map((o) => o.rotulo), ['Manhã', 'Tarde', 'Noite', 'Madrugada', 'Não senti mais fome que o normal']);

  assert.deepEqual(resumo('alim_enjoou_sn'), ['SIM_NAO', 'Algum alimento que enjoou ou gostaria de substituir?']);
  const enjoou = porId(c, 'alim_enjoou_itens');
  assert.deepEqual([enjoou.fonte, enjoou.motivo, enjoou.max, enjoou.mostrarSe], ['ALIMENTOS_DA_DIETA', 'OPCIONAL', 10, { perguntaId: 'alim_enjoou_sn', valores: ['sim'] }]);

  assert.deepEqual(resumo('treino_dias_faltou'), ['ESCOLHA_UNICA', 'Quantos dias por semana está conseguindo treinar?']);
  assert.deepEqual(porId(c, 'treino_dias_faltou').opcoes.map((o) => o.rotulo), ['Todos os prescritos', 'Faltei 1 dia', 'Faltei 2 ou mais']);
  assert.ok(!('ajudaAutomatica' in porId(c, 'treino_dias_faltou')));

  assert.deepEqual(resumo('treino_dores_sn'), ['SIM_NAO', 'Sentiu dores ou dificuldades?']);
  const dores = porId(c, 'treino_dores_itens');
  assert.deepEqual([dores.fonte, dores.motivo, dores.rotuloMotivo, dores.mostrarSe.valores], ['EXERCICIOS_DO_TREINO', 'OPCIONAL', 'Onde e como doeu?', ['sim']]);

  assert.deepEqual(resumo('treino_descanso_sn'), ['SIM_NAO', 'Precisou fazer descanso no meio da semana?']);
  const descanso = porId(c, 'treino_descanso_dias');
  assert.deepEqual(descanso.opcoes.map((o) => o.rotulo), ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']);
  assert.deepEqual(descanso.mostrarSe, { perguntaId: 'treino_descanso_sn', valores: ['sim'] });

  const dia = porId(c, 'fb_desgastante_dia');
  assert.deepEqual([dia.tipo, dia.rotulo, dia.fonte, dia.max, dia.motivo, dia.mostrarSe], ['ITENS_DO_PLANO', 'Qual dia foi mais desgastante?', 'DIAS_TREINADOS', 1, 'OPCIONAL', undefined]);

  assert.deepEqual(resumo('fb_substituiu_sn'), ['SIM_NAO', 'Teve algum exercício que substituiu por não ter o maquinário?']);
  const subst = porId(c, 'fb_substituiu_itens');
  assert.deepEqual([subst.fonte, subst.motivo, subst.rotuloMotivo], ['EXERCICIOS_DO_TREINO', 'OPCIONAL', 'O que usou no lugar?']);
  const foto = porId(c, 'fb_substituiu_foto');
  assert.deepEqual([foto.tipo, foto.rotulo, foto.max, foto.mostrarSe], ['FOTOS', 'Foto do aparelho que você usou', 2, { perguntaId: 'fb_substituiu_sn', valores: ['sim'] }]);

  assert.deepEqual(resumo('fb_recuperou_sn'), ['SIM_NAO', 'Seu músculo recuperou até a próxima sessão?']);
  const dolorido = porId(c, 'fb_recuperou_dias');
  assert.deepEqual([dolorido.rotulo, dolorido.fonte, dolorido.motivo, dolorido.mostrarSe], ['Em quais treinos você ainda estava dolorido?', 'DIAS_TREINADOS', 'OPCIONAL', { perguntaId: 'fb_recuperou_sn', valores: ['nao'] }]);

  // Cada pergunta nova vem logo depois da que ela troca, na seção dela.
  const ordem = c.secoes[2].perguntas.map((x) => x.id);
  assert.deepEqual(ordem, ['treino_dias_faltou', 'treino_desempenho', 'treino_dores_sn', 'treino_dores_itens', 'treino_descanso_sn', 'treino_descanso_dias', 'treino_acrescentar']);
});

test('o conteúdo gravado passa nas regras do ValidadorQuestionario que dá para conferir sem a API', async () => {
  await rodar(['--gravar'], ENV());
  const c = padrao().rascunho;
  const lista = todas(c);
  const vistas = new Map();
  let capacidade = 0;
  for (const x of lista) {
    assert.match(x.id, /^[A-Za-z0-9_-]{1,40}$/);
    assert.ok(x.rotulo.length <= L('rotuloTamanho', 200), x.rotulo);
    for (const o of x.opcoes ?? []) assert.ok(o.rotulo.length <= L('opcaoTamanho', 80) && /^[A-Za-z0-9_-]{1,40}$/.test(o.id), o.rotulo);
    if (x.opcoes) assert.ok(x.opcoes.length >= L('opcoesMinimo', 2) && x.opcoes.length <= L('opcoesMaximo', 20), x.rotulo);
    if (x.mostrarSe) {
      const alvo = vistas.get(x.mostrarSe.perguntaId);
      assert.ok(alvo && ['SIM_NAO', 'ESCOLHA_UNICA', 'MULTIPLA_ESCOLHA'].includes(alvo.tipo), `${x.id}: condição aponta para uma pergunta de escolha anterior`);
      if (alvo.tipo === 'SIM_NAO') assert.ok(x.mostrarSe.valores.every((v) => ['sim', 'nao'].includes(v)));
    }
    if (x.tipo === 'ITENS_DO_PLANO') {
      assert.ok(['ALIMENTOS_DA_DIETA', 'EXERCICIOS_DO_TREINO', 'DIAS_TREINADOS'].includes(x.fonte));
      assert.ok(Number.isInteger(x.max) && x.max >= 1 && x.max <= 20, `${x.id}: max definido de 1 a 20`);
      assert.ok(['NENHUM', 'OPCIONAL', 'OBRIGATORIO'].includes(x.motivo));
      if (x.rotuloMotivo) { assert.notEqual(x.motivo, 'NENHUM'); assert.ok(x.rotuloMotivo.length <= 60); }
      if (x.motivo !== 'NENHUM') capacidade += x.max * 300;
    } else {
      for (const campo of ['fonte', 'motivo', 'rotuloMotivo']) assert.ok(!(campo in x), `${x.id}: ${campo}`);
    }
    if (x.tipo === 'FOTOS' && x.max !== undefined) assert.ok(x.max >= 1 && x.max <= L('fotosPorPergunta', 6));
    capacidade += x.tipo === 'TEXTO' ? L('textoCurtoCapacidade', 500) : x.tipo === 'TEXTO_LONGO' ? L('textoLongoCapacidade', 2000) : 0;
    vistas.set(x.id, x);
  }
  assert.ok(lista.length <= L('perguntasTotal', 80));
  assert.ok(lista.filter((x) => x.tipo === 'FOTOS').length <= L('perguntasFotos', 6));
  assert.ok(capacidade <= L('capacidadeDeTextoTotal', 40000), String(capacidade));
  // Peso continua (sem ele a API avisa que o peso não é registrado).
  assert.equal(lista.filter((x) => x.tipo === 'PESO').length, 1);
});

test('rodar duas vezes é idempotente: a segunda não salva nem publica', async () => {
  await rodar(['--gravar'], ENV());
  const depois = JSON.stringify(estado);
  chamadas = [];
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(escritas(), []);
  assert.equal(JSON.stringify(estado), depois);
  assert.match(r.saida, /Nada a gravar/);
  assert.equal(todas(padrao().rascunho).length, 32);
  // A simulação também diz que não há o que mudar, sem pergunta duplicada.
  const simulada = await rodar([], ENV());
  assert.match(simulada.saida, /rascunho igual ao que o script monta/);
  assert.match(simulada.saida, /Diff contra o rascunho atual: 0 saem, 0 entram, 32 ficam como estão\./);
  assert.match(simulada.saida, /Já está publicado com este conteúdo/);
});

test('rascunho já certo mas alterado depois da publicação: só publica, sem salvar de novo', async () => {
  await rodar(['--gravar'], ENV());
  padrao().alteradoDesdePublicacao = true;
  chamadas = [];
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(caminhos(), ['POST /questionarios/<id>/validar', 'POST /questionarios/<id>/publicar']);
  assert.equal(padrao().versaoPublicada, 5);
});

test('rascunho mexido à mão numa pergunta nova volta ao que o script define, sem duplicar', async () => {
  await rodar(['--gravar'], ENV());
  porId(padrao().rascunho, 'fb_desgastante_dia').motivo = 'OBRIGATORIO';
  porId(padrao().rascunho, 'alim_fome_periodo').rotulo = 'Mexido';
  chamadas = [];
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(caminhos(), ['PUT /questionarios/<id>', 'POST /questionarios/<id>/validar', 'POST /questionarios/<id>/publicar']);
  assert.equal(porId(padrao().rascunho, 'fb_desgastante_dia').motivo, 'OPCIONAL');
  assert.equal(todas(padrao().rascunho).length, 32);
});

test('o padrão sem uma das perguntas de origem (editado à mão): para sem gravar', async () => {
  const q = padrao();
  q.rascunho.secoes[1].perguntas = q.rascunho.secoes[1].perguntas.filter((x) => x.id !== 'alim_fome');
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /O padrão não tem mais as perguntas: alim_fome\./);
  assert.deepEqual(escritas(), []);
});

test('a API recusando o conteúdo: restaura o rascunho anterior e não publica', async () => {
  const antigo = JSON.parse(JSON.stringify(padrao().rascunho));
  estado.errosDaValidacao = [{ caminho: 'secoes[1].perguntas[5].fonte', mensagem: 'Escolha de onde vêm os itens.' }];
  const r = await rodar(['--gravar'], ENV());
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /A API recusou 1 ponto\(s\):/);
  assert.match(r.saida, /O rascunho anterior foi restaurado\. Nada foi publicado\./);
  assert.deepEqual(caminhos(), ['PUT /questionarios/<id>', 'POST /questionarios/<id>/validar', 'PUT /questionarios/<id>']);
  assert.deepEqual(padrao().rascunho, antigo);
  assert.equal(padrao().descricao, 'Descrição do padrão');
  assert.equal(padrao().versaoPublicada, 3);
  // A segunda escrita restaura com a versão que a primeira devolveu.
  const [salvar, , restaurar] = escritas();
  assert.equal(restaurar.corpo.versao, salvar.corpo.versao + 1);
});

test('erro da API mostra só método, caminho, status e código (nunca o corpo)', async () => {
  const falho = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/auth/login') return res.end(JSON.stringify({ accessToken: 't' }));
    if (req.url === '/eu') return res.end(JSON.stringify({ permissoes: ['QUESTIONARIO_ALTERAR'] }));
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
