// node --test scripts/questionario/anamnese-saraiva.test.mjs
// Confere o conteúdo da anamnese do Saraiva contra os limites do questionário (os mesmos de
// api/src/test/resources/paridade-questionario/limites.json) e a troca das imagens. A validação completa é da API, no
// --gravar; aqui o objetivo é não descobrir um limite estourado só em produção.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARQUIVO_DA_IMAGEM, aplicarImagens, chaveDeImagem, COLUNAS_DOS_SINTOMAS, comImagensEnviadas, conteudoDaAnamnese, imagensDoConteudo, resumo,
} from './anamnese-saraiva-lib.mjs';

const limites = JSON.parse(readFileSync(new URL('../../api/src/test/resources/paridade-questionario/limites.json', import.meta.url), 'utf8'));
const L = (nome, padrao) => limites[nome] ?? padrao;
const conteudo = conteudoDaAnamnese();
const perguntas = conteudo.secoes.flatMap((s) => s.perguntas);

test('cabe nos limites de seções, perguntas e textos', () => {
  assert.ok(conteudo.secoes.length <= L('secoes', 15));
  assert.ok(perguntas.length <= L('perguntasTotal', 80));
  for (const s of conteudo.secoes) {
    assert.ok(s.perguntas.length <= L('perguntasPorSecao', 40), s.titulo);
    assert.ok(s.titulo.length <= L('tituloTamanho', 80), s.titulo);
    assert.ok((s.descricao ?? '').length <= 4000, s.titulo);
  }
  for (const i of conteudo.instrucoes) assert.ok(i.length <= L('instrucaoTamanho', 300));
  for (const p of perguntas) {
    assert.match(p.id, /^[A-Za-z0-9_-]{1,40}$/);
    assert.ok(p.rotulo.length <= L('rotuloTamanho', 200), p.rotulo);
    assert.ok((p.ajuda ?? '').length <= L('ajudaTamanho', 300), p.rotulo);
    for (const o of p.opcoes ?? []) assert.ok(o.rotulo.length <= L('opcaoTamanho', 80), o.rotulo);
    if (p.opcoes) assert.ok(p.opcoes.length >= 2 && p.opcoes.length <= L('opcoesMaximo', 20), p.rotulo);
  }
});

test('ids únicos, um destino por campo e a data do peso aponta para uma DATA "só hoje ou antes"', () => {
  const ids = perguntas.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  const destinos = perguntas.filter((p) => p.destino).map((p) => p.destino);
  assert.equal(new Set(destinos).size, destinos.length);
  const peso = perguntas.find((p) => p.tipo === 'PESO');
  const data = perguntas.find((p) => p.id === peso.destinoData);
  assert.equal(data.tipo, 'DATA');
  assert.equal(data.somentePassado, true);
});

test('tipos com campos próprios dentro das faixas', () => {
  const fotos = perguntas.filter((p) => p.tipo === 'FOTOS');
  assert.equal(fotos.length, 5);
  assert.deepEqual(fotos.map((p) => p.id), [
    'a2-foto-frente', 'a2-foto-costas', 'a2-foto-lado-esquerdo', 'a2-foto-lado-direito', 'a2-foto-livre',
  ]);
  assert.ok(fotos.every((p) => p.max === 1));
  const nota = perguntas.find((p) => p.tipo === 'NOTA');
  assert.deepEqual([nota.min, nota.max], [1, 10]);
  const grade = perguntas.find((p) => p.tipo === 'GRADE');
  assert.equal(grade.linhas.length, 19);
  assert.deepEqual(grade.colunas.map((c) => c.rotulo), COLUNAS_DOS_SINTOMAS);
  const aceite = perguntas.find((p) => p.tipo === 'ACEITE');
  assert.ok(aceite.texto.length <= L('textoInformativoTamanho', 4000) && aceite.declaracao.length <= L('declaracaoTamanho', 200));
  // Soma da capacidade de texto que o aluno pode escrever (TEXTO 500, TEXTO_LONGO 2000).
  const capacidade = perguntas.reduce((t, p) => t + (p.tipo === 'TEXTO' ? 500 : p.tipo === 'TEXTO_LONGO' ? 2000 : 0), 0);
  assert.ok(capacidade <= L('capacidadeDeTextoTotal', 40000), String(capacidade));
});

test('nome e e-mail não são perguntados (o app já sabe quem responde)', () => {
  const rotulos = perguntas.map((p) => chaveDeImagem(p.rotulo));
  assert.ok(!rotulos.some((r) => r.includes('nome completo') || r.includes('e mail')));
  assert.ok(!perguntas.some((p) => p.tipo === 'EMAIL'));
});

test('as imagens da versão publicada são reaproveitadas pelo texto, e o que falta é listado', () => {
  const anterior = {
    secoes: [{
      perguntas: [
        { rotulo: 'Modelo de envio de fotos 1, 2 e 3', imagemId: 'img-modelo' },
        { rotulo: 'Em que nível estão suas fezes na escala de Bristol?', imagemId: 'img-bristol' },
        { rotulo: 'Quais aparelhos de costas?', opcoes: [{ rotulo: 'Pullover Machine', imagemId: 'img-pullover' }, { rotulo: 'T-Bar Row', imagemId: 'img-tbar' }] },
      ],
    }],
  };
  const { conteudo: novo, faltando } = aplicarImagens(conteudoDaAnamnese(), imagensDoConteudo(anterior));
  const todas = novo.secoes.flatMap((s) => s.perguntas);
  assert.equal(todas.find((p) => p.tipo === 'INFORMATIVO').imagemId, 'img-modelo');
  assert.equal(todas.find((p) => p.id.endsWith('bristol')).imagemId, 'img-bristol');
  const costas = todas.find((p) => p.id.endsWith('maq-costas'));
  assert.equal(costas.opcoes[0].imagemId, 'img-pullover');
  assert.equal(costas.opcoes[1].imagemId, 'img-tbar');
  assert.ok(faltando.some((f) => f.toLowerCase().includes('armstrong')));
  assert.ok(faltando.some((f) => f.includes('Chest Dips')));
  // Nenhuma chave "imagem" sobra para a API.
  assert.ok(!JSON.stringify(novo).includes('"imagem"'));
  assert.equal(resumo(novo).imagens, 4);
});

test('toda imagem do conteúdo tem arquivo, e as enviadas preenchem tudo', () => {
  const vazio = imagensDoConteudo(undefined);
  const { chavesFaltando } = aplicarImagens(conteudoDaAnamnese(), vazio);
  assert.equal(chavesFaltando.length, 22);
  for (const f of chavesFaltando) assert.ok(ARQUIVO_DA_IMAGEM[f.imagem], f.imagem);
  assert.equal(new Set(Object.values(ARQUIVO_DA_IMAGEM)).size, 22);
  const enviadas = chavesFaltando.map((f, i) => ({ ...f, imagemId: `id-${i}` }));
  const { conteudo, faltando } = aplicarImagens(conteudoDaAnamnese(), comImagensEnviadas(vazio, enviadas));
  assert.deepEqual(faltando, []);
  assert.equal(resumo(conteudo).imagens, 22);
});
