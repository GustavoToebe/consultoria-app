// Gera as fixtures de paridade Java/TS em api/src/test/resources/paridade-questionario/ (`node scripts/questionario/gerar-fixtures.mjs`).
// Os esperados são escritos aqui à mão, não calculados por nenhum validador. Mudou uma regra? Ajuste o caso aqui, gere de novo
// e rode os dois lados (`mvn verify` e `npm test`). Os JSON gerados são versionados; a fábrica v2 sai da V017 como a V024 a deriva.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const SAIDA = `${RAIZ}/api/src/test/resources/paridade-questionario`;

const P = (id, tipo, extra = {}) => ({ id, tipo, rotulo: `Pergunta ${id}`, obrigatoria: false, ...extra });
const base = () => ({
  formato: 2, instrucoes: ['Uma instrução'],
  secoes: [{ uid: 's1', titulo: 'Geral', perguntas: [
    P('peso', 'PESO', { obrigatoria: true }),
    P('sono', 'NOTA', { obrigatoria: true, destaque: true, rotuloCurto: 'Sono' }),
  ] }],
});
const com = (...ps) => ({ formato: 2, instrucoes: [], secoes: [{ uid: 's1', titulo: 'Geral', perguntas: [P('peso', 'PESO'), ...ps] }] });
const pp = (k) => `secoes[0].perguntas[${k}]`;
const opts = (n) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, rotulo: `Opção ${i}` }));
const notas = (de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => P(`n${de + i}`, 'NOTA'));
const secao = (n, perguntas) => ({ uid: `s${n}`, titulo: `Seção ${n}`, perguntas });

const casos = [];
const c = (nome, conteudo, erros = [], avisos = []) => casos.push({ nome, conteudo, erros: [...new Set(erros)].sort(), avisos });

c('valido_minimo', base());
c('sem_peso_so_avisa', { formato: 2, instrucoes: [], secoes: [{ uid: 's1', titulo: 'Geral', perguntas: [P('sono', 'NOTA')] }] }, [], ['secoes']);
c('sem_secoes', { formato: 2, instrucoes: [], secoes: [] }, ['secoes']);
{ const x = base(); x.secoes.push({ uid: 's2', titulo: 'Vazia', perguntas: [] }); c('secao_sem_pergunta', x, ['secoes[1].perguntas']); }
{ const x = base(); x.secoes.push({ uid: 's1', titulo: '  ', perguntas: [P('x1', 'NOTA')] });
  c('secao_sem_titulo_e_uid_repetido', x, ['secoes[1].titulo', 'secoes[1].uid']); }
{ const x = base(); x.secoes.push({ uid: 'com espaço', titulo: 'B', perguntas: [P('x1', 'NOTA')] }, { titulo: 'C', perguntas: [P('x2', 'NOTA')] });
  c('secao_uid_invalido_e_ausente', x, ['secoes[1].uid', 'secoes[2].uid']); }
c('pergunta_id_repetido', com(P('peso', 'NOTA')), [`${pp(1)}.id`]);
c('pergunta_id_invalido_e_rotulo_vazio', com({ id: 'com espaço', tipo: 'NOTA', rotulo: '', obrigatoria: false }), [`${pp(1)}.id`, `${pp(1)}.rotulo`]);
c('rotulo_200_aceito', com(P('x', 'NOTA', { rotulo: 'a'.repeat(200) })));
c('rotulo_201_recusado', com(P('x', 'NOTA', { rotulo: 'a'.repeat(201) })), [`${pp(1)}.rotulo`]);
{ const x = com(P('x', 'NOTA')); x.secoes[0].titulo = '✅' + 'a'.repeat(79); c('titulo_80_utf16_aceito', x); }
{ const x = com(P('x', 'NOTA')); x.secoes[0].titulo = '😀' + 'a'.repeat(79); c('titulo_com_emoji_conta_utf16', x, ['secoes[0].titulo']); }
c('ajuda_300_aceita', com(P('x', 'NOTA', { ajuda: 'a'.repeat(300) })));
c('ajuda_301_recusada', com(P('x', 'NOTA', { ajuda: 'a'.repeat(301) })), [`${pp(1)}.ajuda`]);
{ const x = com(P('x', 'NOTA')); x.instrucoes = Array.from({ length: 11 }, () => 'a'); c('instrucoes_11', x, ['instrucoes']); }
{ const x = com(P('x', 'NOTA')); x.instrucoes = ['', 'a'.repeat(301), 'ok']; c('instrucoes_vazia_e_longa', x, ['instrucoes[0]', 'instrucoes[1]']); }
c('tipo_unico_repetido', com(P('peso2', 'PESO'), P('f1', 'FOTOS'), P('f2', 'FOTOS'), P('d1', 'DATA_AUTOMATICA'), P('d2', 'DATA_AUTOMATICA')),
  [`${pp(1)}.tipo`, `${pp(3)}.tipo`, `${pp(5)}.tipo`]);
c('tipo_ausente', com({ id: 'x', rotulo: 'Sem tipo', obrigatoria: false }), [`${pp(1)}.tipo`]);

c('escolha_unica_valida', com(P('e', 'ESCOLHA_UNICA', { opcoes: opts(3) })));
c('multipla_20_opcoes_ok', com(P('e', 'MULTIPLA_ESCOLHA', { opcoes: opts(20) })));
c('escolha_sem_opcoes', com(P('e', 'ESCOLHA_UNICA')), [`${pp(1)}.opcoes`]);
c('escolha_uma_opcao', com(P('e', 'MULTIPLA_ESCOLHA', { opcoes: opts(1) })), [`${pp(1)}.opcoes`]);
c('escolha_21_opcoes', com(P('e', 'ESCOLHA_UNICA', { opcoes: opts(21) })), [`${pp(1)}.opcoes`]);
c('opcao_repetida_sem_acento_e_caixa', com(P('e', 'ESCOLHA_UNICA', { opcoes: [{ id: 'a', rotulo: 'Não' }, { id: 'b', rotulo: ' nao ' }] })), [`${pp(1)}.opcoes[1].rotulo`]);
c('opcao_id_repetido_e_vazios', com(P('e', 'ESCOLHA_UNICA', { opcoes: [{ id: 'a', rotulo: 'x' }, { id: 'a', rotulo: '' }, { id: '', rotulo: 'y' }] })),
  [`${pp(1)}.opcoes[1].id`, `${pp(1)}.opcoes[1].rotulo`, `${pp(1)}.opcoes[2].id`]);
c('opcao_rotulo_81', com(P('e', 'ESCOLHA_UNICA', { opcoes: [{ id: 'a', rotulo: 'a'.repeat(81) }, { id: 'b', rotulo: 'b' }] })), [`${pp(1)}.opcoes[0].rotulo`]);
c('opcoes_em_tipo_sem_opcoes', com(P('n', 'NOTA', { opcoes: [] })), [`${pp(1)}.opcoes`]);

c('dias_validos', com(P('d', 'NOTAS_POR_DIA', { dias: [1, 2, 3] })));
c('dias_14_ok', com(P('d', 'NOTAS_POR_DIA', { dias: [14] })));
c('dias_vazio', com(P('d', 'NOTAS_POR_DIA', { dias: [] })), [`${pp(1)}.dias`]);
c('dias_ausente', com(P('d', 'NOTAS_POR_DIA')), [`${pp(1)}.dias`]);
c('dias_8', com(P('d', 'NOTAS_POR_DIA', { dias: [1, 2, 3, 4, 5, 6, 7, 8] })), [`${pp(1)}.dias`]);
c('dias_fora_da_faixa', com(P('d', 'NOTAS_POR_DIA', { dias: [0, 15] })), [`${pp(1)}.dias[0]`, `${pp(1)}.dias[1]`]);
c('dias_repetido', com(P('d', 'NOTAS_POR_DIA', { dias: [1, 1] })), [`${pp(1)}.dias[1]`]);
c('dias_em_nota', com(P('n', 'NOTA', { dias: [1] })), [`${pp(1)}.dias`]);

c('numero_valido', com(P('n', 'NUMERO', { min: 0, max: 10, casas: 1, unidade: 'kg' })));
c('numero_min_igual_max_ok', com(P('n', 'NUMERO', { min: 5, max: 5 })));
c('numero_min_maior_que_max', com(P('n', 'NUMERO', { min: 10, max: 1 })), [`${pp(1)}.max`]);
c('numero_limites_no_absoluto_ok', com(P('n', 'NUMERO', { min: -1000000000, max: 1000000000 })));
c('numero_limites_acima_do_absoluto', com(P('n', 'NUMERO', { min: -1000000001, max: 1e12 })), [`${pp(1)}.min`, `${pp(1)}.max`]);
c('numero_casas_3', com(P('n', 'NUMERO', { casas: 3 })), [`${pp(1)}.casas`]);
c('numero_casas_negativo', com(P('n', 'NUMERO', { casas: -1 })), [`${pp(1)}.casas`]);
c('numero_unidade_12_ok', com(P('n', 'NUMERO', { unidade: 'a'.repeat(12) })));
c('numero_unidade_13', com(P('n', 'NUMERO', { unidade: 'a'.repeat(13) })), [`${pp(1)}.unidade`]);
c('campos_de_numero_fora_de_numero', com(P('t', 'TEXTO', { min: 0, max: 1, casas: 1, unidade: 'x' })),
  [`${pp(1)}.min`, `${pp(1)}.max`, `${pp(1)}.casas`, `${pp(1)}.unidade`]);

c('destaques_4_ok', com(...notas(1, 4).map((p) => ({ ...p, destaque: true }))));
c('destaques_5', com(...notas(1, 5).map((p) => ({ ...p, destaque: true }))), [`${pp(5)}.destaque`]);
c('destaque_sim_nao_e_escolha_ok', com(P('s', 'SIM_NAO', { destaque: true, rotuloCurto: 'Sim' }), P('e', 'ESCOLHA_UNICA', { destaque: true, opcoes: opts(2) })));
c('destaque_em_texto', com(P('t', 'TEXTO', { destaque: true })), [`${pp(1)}.destaque`]);
c('rotulo_curto_sem_destaque', com(P('n', 'NOTA', { rotuloCurto: 'Curto' })), [`${pp(1)}.rotuloCurto`]);
c('rotulo_curto_com_destaque_false', com(P('n', 'NOTA', { destaque: false, rotuloCurto: 'X' })), [`${pp(1)}.rotuloCurto`]);
c('rotulo_curto_21', com(P('n', 'NOTA', { destaque: true, rotuloCurto: 'a'.repeat(21) })), [`${pp(1)}.rotuloCurto`]);
c('rotulo_curto_20_ok', com(P('n', 'NOTA', { destaque: true, rotuloCurto: 'a'.repeat(20) })));
c('rotulo_curto_em_branco_ok', com(P('n', 'NOTA', { rotuloCurto: '  ' })));

c('ajuda_automatica_texto_e_numero_ok', com(P('t', 'TEXTO', { ajudaAutomatica: 'MEDIA_DIAS_TREINO' }), P('n', 'NUMERO', { ajudaAutomatica: 'MEDIA_DIAS_TREINO' })));
c('ajuda_automatica_em_nota', com(P('n', 'NOTA', { ajudaAutomatica: 'MEDIA_DIAS_TREINO' })), [`${pp(1)}.ajudaAutomatica`]);

c('perguntas_40_na_secao_ok', { formato: 2, instrucoes: [], secoes: [secao(1, [P('peso', 'PESO'), ...notas(1, 39)])] });
c('perguntas_41_na_secao', { formato: 2, instrucoes: [], secoes: [secao(1, [P('peso', 'PESO'), ...notas(1, 40)])] }, ['secoes[0].perguntas']);
c('perguntas_80_no_total_ok', { formato: 2, instrucoes: [], secoes: [secao(1, [P('peso', 'PESO'), ...notas(1, 39)]), secao(2, notas(40, 79))] });
c('perguntas_81_no_total', { formato: 2, instrucoes: [], secoes: [secao(1, [P('peso', 'PESO'), ...notas(1, 39)]), secao(2, notas(40, 79)), secao(3, notas(80, 80))] }, ['secoes']);
c('secoes_15_ok', { formato: 2, instrucoes: [], secoes: Array.from({ length: 15 }, (_, i) => secao(i + 1, i === 0 ? [P('peso', 'PESO')] : [P(`n${i}`, 'NOTA')])) });
c('secoes_16', { formato: 2, instrucoes: [], secoes: Array.from({ length: 16 }, (_, i) => secao(i + 1, i === 0 ? [P('peso', 'PESO')] : [P(`n${i}`, 'NOTA')])) }, ['secoes']);
const longos = (n) => Array.from({ length: n }, (_, i) => P(`t${i}`, 'TEXTO_LONGO'));
c('capacidade_de_texto_40000_ok', com(...longos(20)));
c('capacidade_de_texto_acima', com(...longos(21)), ['secoes']);

// Fábrica v2: o mesmo que a V024 deriva da v1 (o teste de integração confere que o banco tem exatamente isto).
{
  const sql = readFileSync(`${RAIZ}/api/src/main/resources/db/migration/V017__atualizacoes.sql`, 'utf8');
  const m = sql.match(/values \('b582a268-f6e7-44fc-9b97-cf379f485c26',1,'(.*)'\);/s);
  const v1 = JSON.parse(m[1].replace(/''/g, "'"));
  const extras = {
    sono: { destaque: true, rotuloCurto: 'Sono' },
    alim_desempenho: { destaque: true, rotuloCurto: 'Alimentar' },
    treino_desempenho: { destaque: true, rotuloCurto: 'Treino' },
    treino_dias: { ajudaAutomatica: 'MEDIA_DIAS_TREINO' },
  };
  const v2 = {
    formato: 2, instrucoes: v1.instrucoes,
    secoes: v1.secoes.map((s, i) => ({ uid: `secao-${i + 1}`, titulo: s.titulo, perguntas: s.perguntas.map((p) => ({ ...p, ...(extras[p.id] ?? {}) })) })),
  };
  c('fabrica_v2', v2);
}

writeFileSync(`${SAIDA}/questionarios.json`, JSON.stringify(casos, null, 1) + '\n');

// ---- respostas ----
const Q = (...perguntas) => ({ secoes: [{ perguntas }] });
const E = (id, extra = {}) => ({ id, tipo: 'ESCOLHA_UNICA', rotulo: id, obrigatoria: false, opcoes: [{ id: 'a', rotulo: 'A' }, { id: 'b', rotulo: 'B' }], ...extra });
const M = (extra = {}) => E('m', { tipo: 'MULTIPLA_ESCOLHA', ...extra });
const N = (extra = {}) => ({ id: 'n', tipo: 'NUMERO', rotulo: 'n', obrigatoria: false, ...extra });
const S = (extra = {}) => ({ id: 's', tipo: 'SIM_NAO', rotulo: 's', obrigatoria: false, ...extra });
const respostas = [];
const r = (nome, modelo, resp, campos = []) => respostas.push({ nome, modelo, respostas: resp, camposComErro: [...campos].sort() });

r('escolha_unica_valida', Q(E('e')), { e: 'a' });
r('escolha_unica_opcao_inexistente', Q(E('e')), { e: 'z' }, ['e']);
r('escolha_unica_numero', Q(E('e')), { e: 5 }, ['e']);
r('escolha_unica_obrigatoria_ausente', Q(E('e', { obrigatoria: true })), {}, ['e']);
r('multipla_valida', Q(M()), { m: ['a', 'b'] });
r('multipla_vazia_obrigatoria', Q(M({ obrigatoria: true })), { m: [] }, ['m']);
r('multipla_vazia_opcional', Q(M()), { m: [] });
r('multipla_repetida', Q(M()), { m: ['a', 'a'] }, ['m']);
r('multipla_opcao_inexistente', Q(M()), { m: ['a', 'z'] }, ['m']);
r('multipla_nao_e_lista', Q(M()), { m: 'a' }, ['m']);
r('multipla_item_nao_texto', Q(M()), { m: [1] }, ['m']);
r('numero_valido', Q(N({ min: 0, max: 10 })), { n: 5 });
r('numero_zero_obrigatorio_e_resposta', Q(N({ obrigatoria: true })), { n: 0 });
r('numero_acima_do_maximo', Q(N({ min: 0, max: 10 })), { n: 11 }, ['n']);
r('numero_abaixo_do_minimo', Q(N({ min: 0, max: 10 })), { n: -1 }, ['n']);
r('numero_nos_limites', Q(N({ min: 0, max: 10 })), { n: 10 });
r('numero_casas_a_mais', Q(N()), { n: 2.5 }, ['n']);
r('numero_casas_ok', Q(N({ casas: 1 })), { n: 2.5 });
r('numero_duas_casas', Q(N({ casas: 2 })), { n: 2.25 });
r('numero_como_texto', Q(N()), { n: '5' }, ['n']);
r('numero_sem_limites', Q(N()), { n: 1000000 });
r('numero_acima_do_absoluto', Q(N()), { n: 1000000001 }, ['n']);
r('sim_nao_verdadeiro', Q(S()), { s: true });
r('sim_nao_falso_obrigatorio_e_resposta', Q(S({ obrigatoria: true })), { s: false });
r('sim_nao_como_texto', Q(S()), { s: 'sim' }, ['s']);
r('sim_nao_nulo_obrigatorio', Q(S({ obrigatoria: true })), { s: null }, ['s']);
r('nota_valida_e_invalida', Q({ id: 'a', tipo: 'NOTA', rotulo: 'a', obrigatoria: false }, { id: 'b', tipo: 'NOTA', rotulo: 'b', obrigatoria: false }), { a: 0, b: 11 }, ['b']);
r('peso_invalido', Q({ id: 'peso', tipo: 'PESO', rotulo: 'p', obrigatoria: true }), { peso: 80.55 }, ['peso']);
r('texto_501', Q({ id: 't', tipo: 'TEXTO', rotulo: 't', obrigatoria: false }), { t: 'x'.repeat(501) }, ['t']);
r('texto_longo_2000_ok', Q({ id: 't', tipo: 'TEXTO_LONGO', rotulo: 't', obrigatoria: false }), { t: 'x'.repeat(2000) });
r('notas_por_dia_vazia_obrigatoria', Q({ id: 'd', tipo: 'NOTAS_POR_DIA', rotulo: 'd', obrigatoria: true, dias: [1, 2] }), { d: {} }, ['d']);
r('notas_por_dia_dia_fora', Q({ id: 'd', tipo: 'NOTAS_POR_DIA', rotulo: 'd', obrigatoria: false, dias: [1, 2] }), { d: { 3: 5 } }, ['d']);
r('resposta_desconhecida_e_ignorada', Q(E('e')), { e: 'a', fantasma: 'x' });
r('tipo_desconhecido_respondido', Q({ id: 'x', tipo: 'TIPO_NOVO', rotulo: 'x', obrigatoria: false }), { x: 'a' }, ['x']);
r('tipo_desconhecido_sem_resposta', Q({ id: 'x', tipo: 'TIPO_NOVO', rotulo: 'x', obrigatoria: false }), {});

writeFileSync(`${SAIDA}/respostas.json`, JSON.stringify(respostas, null, 1) + '\n');

const limites = {
  secoes: 15, perguntasPorSecao: 40, perguntasTotal: 80, instrucoes: 10, instrucaoTamanho: 300, tituloTamanho: 80,
  rotuloTamanho: 200, ajudaTamanho: 300, rotuloCurtoTamanho: 20, opcoesMinimo: 2, opcoesMaximo: 20, opcaoTamanho: 80,
  unidadeTamanho: 12, casasMaximo: 2, diasMaximo: 7, diaValorMaximo: 14, destaquesMaximo: 4, textoCurtoCapacidade: 500,
  textoLongoCapacidade: 2000, capacidadeDeTextoTotal: 40000, rascunhoBytes: 262144, respostasBytes: 262144, idTamanho: 40,
  numeroAbsoluto: 1000000000,
};
writeFileSync(`${SAIDA}/limites.json`, JSON.stringify(limites, null, 1) + '\n');
console.log(`${casos.length} casos de questionário, ${respostas.length} de respostas`);
