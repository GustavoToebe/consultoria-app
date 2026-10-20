// Gera as fixtures de paridade Java/TS em api/src/test/resources/paridade-questionario/ (`node scripts/questionario/gerar-fixtures.mjs`).
// Os esperados são escritos aqui à mão, não calculados por nenhum validador. Mudou uma regra? Ajuste o caso aqui, gere de novo
// e rode os dois lados (`mvn verify` e `npm test`). Os JSON gerados são versionados; a fábrica sai do V001__inicial.sql.
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
// finalidade (padrão ATUALIZACAO): a anamnese não avisa da falta de peso e não aceita DATA_AUTOMATICA nem ajuda automática.
const c = (nome, conteudo, erros = [], avisos = [], finalidade) =>
  casos.push({ nome, conteudo, erros: [...new Set(erros)].sort(), avisos, ...(finalidade ? { finalidade } : {}) });
const ca = (nome, conteudo, erros = [], avisos = []) => c(nome, conteudo, erros, avisos, 'ANAMNESE');

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

// ---- Anamnese: finalidade, tipos novos, imagem e condição ----
const IMG = '0b6f9a1e-5c3d-4e2a-9f7b-1a2b3c4d5e6f';
const so = (...ps) => ({ formato: 2, instrucoes: [], secoes: [{ uid: 's1', titulo: 'Geral', perguntas: ps }] });
const lin = (n, pre = 'l') => Array.from({ length: n }, (_, i) => ({ id: `${pre}${i}`, rotulo: `Linha ${i}` }));
const col = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, rotulo: `Coluna ${i}` }));
const ACE = (extra = {}) => P('a', 'ACEITE', { texto: 'Regras da consultoria (texto fictício).', declaracao: 'Li e concordo.', ...extra });
const G = (extra = {}) => P('g', 'GRADE', { linhas: lin(2), colunas: col(3), ...extra });

ca('anamnese_sem_peso_nao_avisa', so(P('n', 'NOTA')));
ca('anamnese_com_peso_ok', so(P('peso', 'PESO'), P('n', 'NOTA')));
ca('anamnese_data_automatica', so(P('d', 'DATA_AUTOMATICA')), ['secoes[0].perguntas[0].tipo']);
ca('anamnese_ajuda_automatica', so(P('t', 'TEXTO', { ajudaAutomatica: 'MEDIA_DIAS_TREINO' })), ['secoes[0].perguntas[0].ajudaAutomatica']);
ca('tipos_novos_validos', so(P('nasc', 'DATA', { somentePassado: true }), P('fone', 'TELEFONE'), P('mail', 'EMAIL'), G(), ACE(),
  P('info', 'INFORMATIVO', { texto: 'Explicação (fictícia).', imagemId: IMG }), P('info2', 'INFORMATIVO')));
c('tipos_novos_na_atualizacao_ok', com(P('d', 'DATA'), P('t', 'TELEFONE'), P('e', 'EMAIL')));
c('somente_passado_fora_de_data', com(P('t', 'TEXTO', { somentePassado: true })), [`${pp(1)}.somentePassado`]);
c('grade_sem_linhas_e_uma_coluna', com(G({ linhas: [], colunas: col(1) })), [`${pp(1)}.linhas`, `${pp(1)}.colunas`]);
c('grade_ausentes', com(P('g', 'GRADE')), [`${pp(1)}.linhas`, `${pp(1)}.colunas`]);
c('grade_30_linhas_10_colunas_ok', com(G({ linhas: lin(30), colunas: col(10) })));
c('grade_31_linhas_11_colunas', com(G({ linhas: lin(31), colunas: col(11) })), [`${pp(1)}.linhas`, `${pp(1)}.colunas`]);
c('grade_repetidos_e_vazios', com(G({ linhas: [{ id: 'l0', rotulo: 'Dor' }, { id: 'l1', rotulo: ' dor ' }, { id: 'l1', rotulo: '' }],
  colunas: [{ id: 'com espaço', rotulo: 'A' }, { id: 'c1', rotulo: 'B' }] })),
  [`${pp(1)}.linhas[1].rotulo`, `${pp(1)}.linhas[2].id`, `${pp(1)}.linhas[2].rotulo`, `${pp(1)}.colunas[0].id`]);
c('grade_linha_com_imagem', com(G({ linhas: [{ id: 'l0', rotulo: 'A', imagemId: IMG }] })), [`${pp(1)}.linhas[0].imagemId`]);
c('linhas_em_tipo_errado', com(P('n', 'NOTA', { linhas: lin(1), colunas: col(2) })), [`${pp(1)}.linhas`, `${pp(1)}.colunas`]);
c('aceite_sem_texto_e_declaracao', com(P('a', 'ACEITE')), [`${pp(1)}.texto`, `${pp(1)}.declaracao`]);
c('aceite_em_branco', com(ACE({ texto: '  ', declaracao: ' ' })), [`${pp(1)}.texto`, `${pp(1)}.declaracao`]);
c('aceite_texto_4000_ok', com(ACE({ texto: 'a'.repeat(4000), declaracao: 'b'.repeat(200) })));
c('aceite_texto_4001_declaracao_201', com(ACE({ texto: 'a'.repeat(4001), declaracao: 'b'.repeat(201) })), [`${pp(1)}.texto`, `${pp(1)}.declaracao`]);
c('informativo_texto_4001', com(P('i', 'INFORMATIVO', { texto: 'a'.repeat(4001) })), [`${pp(1)}.texto`]);
c('texto_e_declaracao_em_tipo_errado', com(P('t', 'TEXTO', { texto: 'x', declaracao: 'y' })), [`${pp(1)}.texto`, `${pp(1)}.declaracao`]);
c('imagem_valida_na_pergunta_e_opcao', com(P('e', 'ESCOLHA_UNICA', { imagemId: IMG, opcoes: [{ id: 'a', rotulo: 'A', imagemId: IMG }, { id: 'b', rotulo: 'B' }] })));
c('imagem_invalida', com(P('e', 'ESCOLHA_UNICA', { imagemId: 'abc', opcoes: [{ id: 'a', rotulo: 'A', imagemId: IMG.toUpperCase() }, { id: 'b', rotulo: 'B' }] })),
  [`${pp(1)}.imagemId`, `${pp(1)}.opcoes[0].imagemId`]);
const SQ = (id = 's', extra = {}) => P(id, 'SIM_NAO', extra);
const E2 = (id = 'e', extra = {}) => P(id, 'ESCOLHA_UNICA', { opcoes: opts(3), ...extra });
const se = (perguntaId, ...valores) => ({ mostrarSe: { perguntaId, valores } });
c('condicao_valida', { formato: 2, instrucoes: [], secoes: [
  { uid: 's1', titulo: 'A', perguntas: [P('peso', 'PESO'), SQ(), P('t', 'TEXTO', se('s', 'sim')), E2(), P('m', 'MULTIPLA_ESCOLHA', { opcoes: opts(2), ...se('e', 'o0', 'o2') }),
    P('n', 'NOTA', se('m', 'o1'))] },
  { uid: 's2', titulo: 'B', ...se('s', 'nao'), perguntas: [P('x', 'TEXTO')] },
] });
c('condicao_para_pergunta_posterior', com(P('t', 'TEXTO', se('s', 'sim')), SQ()), [`${pp(1)}.mostrarSe.perguntaId`]);
c('condicao_em_si_mesma', com(SQ('s', se('s', 'sim'))), [`${pp(1)}.mostrarSe.perguntaId`]);
c('condicao_para_tipo_errado', com(P('n', 'NOTA'), P('t', 'TEXTO', se('n', '5'))), [`${pp(2)}.mostrarSe.perguntaId`]);
c('condicao_para_inexistente', com(P('t', 'TEXTO', se('fantasma', 'sim'))), [`${pp(1)}.mostrarSe.perguntaId`]);
c('condicao_sem_valores', com(SQ(), P('t', 'TEXTO', se('s'))), [`${pp(2)}.mostrarSe.valores`]);
c('condicao_valor_inexistente', com(E2(), P('t', 'TEXTO', se('e', 'o0', 'zz'))), [`${pp(2)}.mostrarSe.valores`]);
c('condicao_sim_nao_com_valor_de_opcao', com(SQ(), P('t', 'TEXTO', se('s', 'true'))), [`${pp(2)}.mostrarSe.valores`]);
c('condicao_valores_repetidos', com(SQ(), P('t', 'TEXTO', se('s', 'sim', 'sim'))), [`${pp(2)}.mostrarSe.valores`]);
c('condicao_de_secao_para_pergunta_da_propria_secao', { formato: 2, instrucoes: [], secoes: [
  { uid: 's1', titulo: 'A', ...se('s', 'sim'), perguntas: [P('peso', 'PESO'), SQ()] }] }, ['secoes[0].mostrarSe.perguntaId']);

// Destino no perfil (fase C): só na anamnese, tipo compatível, um por campo; a data da pesagem é uma DATA "só hoje ou antes".
const DP = (extra = {}) => P('peso', 'PESO', { destino: 'PESO', ...extra });
const DS = (id = 'pesagem', extra = {}) => P(id, 'DATA', { somentePassado: true, ...extra });
ca('destino_peso_e_objetivo_ok', so(DS(), DP({ destinoData: 'pesagem' }), P('obj', 'TEXTO', { destino: 'OBJETIVO' })));
ca('destino_data_da_pesagem_depois_ok', so(DP({ destinoData: 'pesagem' }), DS()));
ca('destino_peso_sem_data_ok', so(DP()));
c('destino_na_atualizacao', com(P('o', 'TEXTO', { destino: 'OBJETIVO' })), [`${pp(1)}.destino`]);
ca('destino_tipo_errado', so(P('o', 'TEXTO_LONGO', { destino: 'OBJETIVO' }), P('n', 'NUMERO', { destino: 'PESO' })),
  ['secoes[0].perguntas[0].destino', 'secoes[0].perguntas[1].destino']);
ca('destino_repetido', so(P('a', 'TEXTO', { destino: 'OBJETIVO' }), P('b', 'TEXTO', { destino: 'OBJETIVO' })), ['secoes[0].perguntas[1].destino']);
ca('destino_data_sem_destino_peso', so(DS(), P('peso', 'PESO', { destinoData: 'pesagem' })), ['secoes[0].perguntas[1].destinoData']);
ca('destino_data_sem_somente_passado', so(DS('pesagem', { somentePassado: undefined }), DP({ destinoData: 'pesagem' })),
  ['secoes[0].perguntas[1].destinoData']);
ca('destino_data_inexistente_e_de_texto', { formato: 2, instrucoes: [], secoes: [
  { uid: 's1', titulo: 'A', perguntas: [P('t', 'TEXTO'), DP({ destinoData: 'fantasma' })] },
  { uid: 's2', titulo: 'B', perguntas: [P('p2', 'NOTA', {}), P('x', 'TEXTO', { destinoData: 't' })] }] },
  ['secoes[0].perguntas[1].destinoData', 'secoes[1].perguntas[1].destinoData']);
ca('destino_data_aponta_para_texto', so(P('t', 'TEXTO'), DP({ destinoData: 't' })), ['secoes[0].perguntas[1].destinoData']);

// CPF, telefone e endereço no cadastro (destinos novos) e o tipo ENDERECO, que só existe na anamnese.
const DCPF = (id = 'cpf', extra = {}) => P(id, 'TEXTO', { destino: 'CPF', ...extra });
const DTEL = (id = 'tel', extra = {}) => P(id, 'TELEFONE', { destino: 'TELEFONE', ...extra });
const DEND = (id = 'end', extra = {}) => P(id, 'ENDERECO', { destino: 'ENDERECO', ...extra });
ca('destino_cpf_telefone_endereco_ok', so(DCPF(), DTEL(), DEND()));
ca('endereco_sem_destino_ok', so(P('end', 'ENDERECO', { obrigatoria: true })));
ca('destino_tipo_errado_dos_novos', so(DCPF('a', { tipo: 'TEXTO_LONGO' }), DTEL('b', { tipo: 'TEXTO' }), DEND('c', { tipo: 'TEXTO' })),
  ['secoes[0].perguntas[0].destino', 'secoes[0].perguntas[1].destino', 'secoes[0].perguntas[2].destino']);
ca('destino_cpf_em_pergunta_de_endereco', so(DEND('a', { destino: 'CPF' }), P('b', 'TELEFONE', { destino: 'CPF' })),
  ['secoes[0].perguntas[0].destino', 'secoes[0].perguntas[1].destino']);
ca('destino_cpf_telefone_endereco_repetidos', so(DCPF('a'), DCPF('b'), DTEL('c'), DTEL('d'), DEND('e'), DEND('f')),
  ['secoes[0].perguntas[1].destino', 'secoes[0].perguntas[3].destino', 'secoes[0].perguntas[5].destino']);
ca('destino_data_em_cpf', so(DS(), DCPF('c', { destinoData: 'pesagem' })), ['secoes[0].perguntas[1].destinoData']);
c('endereco_na_atualizacao', com(P('e', 'ENDERECO')), [`${pp(1)}.tipo`]);
c('endereco_com_destino_na_atualizacao', com(DEND('e')), [`${pp(1)}.tipo`, `${pp(1)}.destino`]);
c('destino_cpf_e_telefone_na_atualizacao', com(DCPF('a'), DTEL('b')), [`${pp(1)}.destino`, `${pp(2)}.destino`]);

// Fábrica: o questionário de onde sai o Padrão de cada consultoria, como está no V001 (o teste de integração confere o banco).
{
  const sql = readFileSync(`${RAIZ}/api/src/main/resources/db/migration/V001__inicial.sql`, 'utf8');
  const m = sql.match(/INSERT INTO public\.atualizacao_modelo VALUES \('[0-9a-f-]+', \d+, '(.*?)', '[^']*'\);/);
  c('fabrica_v2', JSON.parse(m[1].replace(/''/g, "'")));
}

writeFileSync(`${SAIDA}/questionarios.json`, JSON.stringify(casos, null, 1) + '\n');

// ---- respostas ----
const Q = (...perguntas) => ({ secoes: [{ perguntas }] });
const E = (id, extra = {}) => ({ id, tipo: 'ESCOLHA_UNICA', rotulo: id, obrigatoria: false, opcoes: [{ id: 'a', rotulo: 'A' }, { id: 'b', rotulo: 'B' }], ...extra });
const M = (extra = {}) => E('m', { tipo: 'MULTIPLA_ESCOLHA', ...extra });
const N = (extra = {}) => ({ id: 'n', tipo: 'NUMERO', rotulo: 'n', obrigatoria: false, ...extra });
const S = (extra = {}) => ({ id: 's', tipo: 'SIM_NAO', rotulo: 's', obrigatoria: false, ...extra });
const respostas = [];
// fotosLigadas (padrão true): com as fotos desligadas na API a pergunta FOTOS é ignorada. hoje (padrão o dia de hoje):
// limita DATA com somentePassado. chavesAceitas: sem erro, as respostas que sobram depois de descartar as escondidas.
const r = (nome, modelo, resp, campos = [], extra = {}) => respostas.push({ nome, modelo, respostas: resp, camposComErro: [...campos].sort(), ...extra });
const F = (extra = {}) => ({ id: 'f', tipo: 'FOTOS', rotulo: 'f', obrigatoria: false, ...extra });
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

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
r('fotos_validas', Q(F()), { f: [U(1), U(2)] });
r('fotos_no_limite', Q(F()), { f: [1, 2, 3, 4, 5, 6].map(U) });
r('fotos_acima_do_limite', Q(F()), { f: [1, 2, 3, 4, 5, 6, 7].map(U) }, ['f']);
r('fotos_obrigatoria_ausente', Q(F({ obrigatoria: true })), {}, ['f']);
r('fotos_vazia_obrigatoria', Q(F({ obrigatoria: true })), { f: [] }, ['f']);
r('fotos_vazia_opcional', Q(F()), { f: [] });
r('fotos_repetida', Q(F()), { f: [U(1), U(1)] }, ['f']);
r('fotos_repetida_em_maiuscula', Q(F()), { f: [U(10), U(10).toUpperCase()] }, ['f']);
r('fotos_nao_e_uuid', Q(F()), { f: ['foto.jpg'] }, ['f']);
r('fotos_item_nao_texto', Q(F()), { f: [1] }, ['f']);
r('fotos_nao_e_lista', Q(F()), { f: U(1) }, ['f']);
r('fotos_desligadas_ignora_a_pergunta', Q(F({ obrigatoria: true })), { f: 'lixo' }, [], { fotosLigadas: false });
r('fotos_desligadas_sem_resposta_obrigatoria', Q(F({ obrigatoria: true })), {}, [], { fotosLigadas: false });

// Tipos novos (dados fictícios).
const D = (extra = {}) => ({ id: 'd', tipo: 'DATA', rotulo: 'd', obrigatoria: false, ...extra });
const HOJE = { hoje: '2026-10-19' };
r('data_valida', Q(D()), { d: '1990-05-10' });
r('data_inexistente', Q(D()), { d: '1990-02-30' }, ['d']);
r('data_formato_br', Q(D()), { d: '10/05/1990' }, ['d']);
r('data_ano_1899', Q(D()), { d: '1899-12-31' }, ['d']);
r('data_ano_2101', Q(D()), { d: '2101-01-01' }, ['d']);
r('data_hoje_somente_passado_ok', Q(D({ somentePassado: true })), { d: '2026-10-19' }, [], HOJE);
r('data_amanha_somente_passado', Q(D({ somentePassado: true })), { d: '2026-10-20' }, ['d'], HOJE);
r('data_futura_sem_restricao_ok', Q(D()), { d: '2030-01-01' }, [], HOJE);
r('data_numero', Q(D()), { d: 19900510 }, ['d']);
const T = (extra = {}) => ({ id: 'f', tipo: 'TELEFONE', rotulo: 'f', obrigatoria: false, ...extra });
r('telefone_valido', Q(T()), { f: '(45) 99999-8888' });
r('telefone_com_55', Q(T()), { f: '+55 45 99999-8888' });
r('telefone_curto', Q(T()), { f: '9999-8888' }, ['f']);
r('telefone_com_letra', Q(T()), { f: '(45) 9999A-8888' }, ['f']);
r('telefone_14_digitos', Q(T()), { f: '55 45 999998888 1' }, ['f']);
r('telefone_obrigatorio_vazio', Q(T({ obrigatoria: true })), { f: '  ' }, ['f']);
const M2 = (extra = {}) => ({ id: 'e', tipo: 'EMAIL', rotulo: 'e', obrigatoria: false, ...extra });
r('email_valido', Q(M2()), { e: 'pessoa@exemplo.com.br' });
r('email_sem_arroba', Q(M2()), { e: 'pessoa.exemplo.com' }, ['e']);
r('email_com_espaco', Q(M2()), { e: 'pes soa@exemplo.com' }, ['e']);
r('email_sem_dominio', Q(M2()), { e: 'pessoa@exemplo' }, ['e']);
r('email_255', Q(M2()), { e: `${'a'.repeat(243)}@exemplo.com` }, ['e']);
const GR = (extra = {}) => ({ id: 'g', tipo: 'GRADE', rotulo: 'g', obrigatoria: false,
  linhas: [{ id: 'l0', rotulo: 'A' }, { id: 'l1', rotulo: 'B' }], colunas: [{ id: 'c0', rotulo: 'Nunca' }, { id: 'c1', rotulo: 'Sempre' }], ...extra });
r('grade_completa', Q(GR({ obrigatoria: true })), { g: { l0: 'c0', l1: 'c1' } });
r('grade_parcial_opcional', Q(GR()), { g: { l0: 'c1' } });
r('grade_parcial_obrigatoria', Q(GR({ obrigatoria: true })), { g: { l0: 'c1' } }, ['g']);
r('grade_vazia_obrigatoria', Q(GR({ obrigatoria: true })), { g: {} }, ['g']);
r('grade_linha_inexistente', Q(GR()), { g: { l9: 'c0' } }, ['g']);
r('grade_coluna_inexistente', Q(GR()), { g: { l0: 'c9' } }, ['g']);
r('grade_valor_nao_texto', Q(GR()), { g: { l0: 1 } }, ['g']);
r('grade_nao_objeto', Q(GR()), { g: ['c0'] }, ['g']);
const AC = (extra = {}) => ({ id: 'a', tipo: 'ACEITE', rotulo: 'a', obrigatoria: false, texto: 't', declaracao: 'd', ...extra });
r('aceite_marcado', Q(AC({ obrigatoria: true })), { a: true });
r('aceite_falso', Q(AC()), { a: false }, ['a']);
r('aceite_obrigatorio_ausente', Q(AC({ obrigatoria: true })), {}, ['a']);
r('aceite_texto', Q(AC()), { a: 'sim' }, ['a']);
r('informativo_ignorado', Q({ id: 'i', tipo: 'INFORMATIVO', rotulo: 'i', obrigatoria: true }), { i: 'lixo' }, [], { chavesAceitas: [] });
// Condição: escondida não é obrigatória e a resposta dela é descartada (nunca vira "não").
const SN = (id, extra = {}) => ({ id, tipo: 'SIM_NAO', rotulo: id, obrigatoria: false, ...extra });
const TX = (id, extra = {}) => ({ id, tipo: 'TEXTO', rotulo: id, obrigatoria: false, ...extra });
const quando = (perguntaId, ...valores) => ({ mostrarSe: { perguntaId, valores } });
r('condicao_escondida_nao_obriga', Q(SN('s'), TX('t', { obrigatoria: true, ...quando('s', 'sim') })), { s: false }, [], { chavesAceitas: ['s'] });
r('condicao_visivel_obriga', Q(SN('s'), TX('t', { obrigatoria: true, ...quando('s', 'sim') })), { s: true }, ['t']);
r('condicao_escondida_descarta_resposta', Q(SN('s'), TX('t', quando('s', 'sim'))), { s: false, t: 'texto fictício' }, [], { chavesAceitas: ['s'] });
r('condicao_escondida_resposta_invalida_ignorada', Q(SN('s'), TX('t', quando('s', 'sim'))), { s: false, t: 5 }, [], { chavesAceitas: ['s'] });
r('condicao_sem_resposta_de_controle_esconde', Q(SN('s'), TX('t', { obrigatoria: true, ...quando('s', 'nao') })), {}, [], { chavesAceitas: [] });
r('condicao_nao_mostra', Q(SN('s'), TX('t', { obrigatoria: true, ...quando('s', 'nao') })), { s: false }, ['t']);
r('condicao_multipla_alguma_marcada', Q(M(), TX('t', { obrigatoria: true, ...quando('m', 'b') })), { m: ['a', 'b'] }, ['t']);
r('condicao_multipla_nenhuma_marcada', Q(M(), TX('t', { obrigatoria: true, ...quando('m', 'b') })), { m: ['a'], t: 'x' }, [], { chavesAceitas: ['m'] });
r('condicao_escolha_unica', Q(E('e'), TX('t', quando('e', 'a'))), { e: 'a', t: 'x' }, [], { chavesAceitas: ['e', 't'] });
r('condicao_controle_invalido_esconde', Q(E('e'), TX('t', { obrigatoria: true, ...quando('e', 'a') })), { e: 'z' }, ['e']);
r('condicao_em_cadeia', Q(SN('s'), E('e', quando('s', 'sim')), TX('t', { obrigatoria: true, ...quando('e', 'a') })),
  { s: false, e: 'a' }, [], { chavesAceitas: ['s'] });
r('condicao_de_secao', { secoes: [{ perguntas: [SN('s')] }, { ...quando('s', 'sim'), perguntas: [TX('t', { obrigatoria: true }), TX('u')] }] },
  { s: false, u: 'x' }, [], { chavesAceitas: ['s'] });
r('condicao_de_secao_visivel', { secoes: [{ perguntas: [SN('s')] }, { ...quando('s', 'sim'), perguntas: [TX('t', { obrigatoria: true })] }] },
  { s: true }, ['t']);

// Texto que vai para o objetivo do cadastro cabe nele (200).
const OB = (extra = {}) => ({ id: 'o', tipo: 'TEXTO', rotulo: 'o', obrigatoria: false, destino: 'OBJETIVO', ...extra });
r('objetivo_200_ok', Q(OB()), { o: 'x'.repeat(200) });
r('objetivo_201', Q(OB()), { o: 'x'.repeat(201) }, ['o']);
r('texto_sem_destino_500_ok', Q(TX('t')), { t: 'x'.repeat(500) });

// CPF, telefone e endereço que alimentam o cadastro (dados fictícios; os CPFs têm dígitos verificadores corretos).
const CP = (extra = {}) => ({ id: 'c', tipo: 'TEXTO', rotulo: 'c', obrigatoria: false, destino: 'CPF', ...extra });
r('cpf_destino_formatado_ok', Q(CP()), { c: '529.982.247-25' });
r('cpf_destino_so_digitos_ok', Q(CP()), { c: '52998224725' });
r('cpf_destino_outro_valido_ok', Q(CP()), { c: '123.456.789-09' });
r('cpf_destino_digito_errado', Q(CP()), { c: '529.982.247-26' }, ['c']);
r('cpf_destino_digitos_iguais', Q(CP()), { c: '111.111.111-11' }, ['c']);
r('cpf_destino_15_caracteres', Q(CP()), { c: '529.982.247-250' }, ['c']);
r('cpf_destino_curto', Q(CP()), { c: '5299822472' }, ['c']);
r('cpf_destino_texto', Q(CP()), { c: 'abc' }, ['c']);
r('cpf_destino_obrigatorio_ausente', Q(CP({ obrigatoria: true })), {}, ['c']);
r('cpf_destino_opcional_em_branco_ok', Q(CP()), { c: '  ' });
r('texto_sem_destino_nao_confere_cpf', Q(TX('c')), { c: '123' });
const TD = (extra = {}) => ({ id: 'f', tipo: 'TELEFONE', rotulo: 'f', obrigatoria: false, destino: 'TELEFONE', ...extra });
r('telefone_destino_celular_ok', Q(TD()), { f: '(45) 99999-8888' });
r('telefone_destino_com_55_ok', Q(TD()), { f: '+55 45 99999-8888' });
r('telefone_destino_fixo_ok', Q(TD()), { f: '(45) 3333-8888' });
r('telefone_destino_fixo_com_9_recusado', Q(TD()), { f: '(45) 9999-8888' }, ['f']);
r('telefone_sem_destino_fixo_com_9_ok', Q(T()), { f: '(45) 9999-8888' });
r('telefone_destino_ddd_com_zero_recusado', Q(TD()), { f: '(05) 99999-8888' }, ['f']);
r('telefone_sem_destino_ddd_com_zero_ok', Q(T()), { f: '(05) 99999-8888' });
const EN = (extra = {}) => ({ id: 'e', tipo: 'ENDERECO', rotulo: 'e', obrigatoria: false, ...extra });
const ENDERECO_OK = { cep: '85800-000', logradouro: 'Rua das Flores', numero: '100', complemento: 'Apto 2', bairro: 'Centro', cidade: 'Cidade Exemplo', uf: 'PR' };
r('endereco_completo_ok', Q(EN({ obrigatoria: true })), { e: ENDERECO_OK });
r('endereco_parcial_ok', Q(EN({ obrigatoria: true })), { e: { cidade: 'Cidade Exemplo', uf: 'sp' } });
r('endereco_cep_so_digitos_ok', Q(EN()), { e: { cep: '85800000' } });
r('endereco_pontas_com_espaco_ok', Q(EN()), { e: { cep: ' 85800-000 ', uf: ' PR ', cidade: ' Cidade ' } });
r('endereco_chave_desconhecida', Q(EN()), { e: { rua: 'x' } }, ['e']);
r('endereco_chave_desconhecida_junto_de_valida', Q(EN()), { e: { cidade: 'x', pais: 'BR' } }, ['e']);
r('endereco_cep_curto', Q(EN()), { e: { cep: '1234' } }, ['e']);
r('endereco_cep_10_caracteres', Q(EN()), { e: { cep: '85800-0000' } }, ['e']);
r('endereco_uf_inexistente', Q(EN()), { e: { uf: 'XX' } }, ['e']);
r('endereco_uf_3_letras', Q(EN()), { e: { uf: 'sps' } }, ['e']);
r('endereco_vazio_opcional_ok', Q(EN()), { e: {} });
r('endereco_vazio_obrigatorio', Q(EN({ obrigatoria: true })), { e: {} }, ['e']);
r('endereco_ausente_obrigatorio', Q(EN({ obrigatoria: true })), {}, ['e']);
r('endereco_em_branco_opcional_ok', Q(EN()), { e: { cep: '', cidade: ' ' } });
r('endereco_em_branco_obrigatorio', Q(EN({ obrigatoria: true })), { e: { cep: '', cidade: ' ' } }, ['e']);
r('endereco_valor_nao_texto', Q(EN()), { e: { numero: 10 } }, ['e']);
r('endereco_valor_nulo', Q(EN()), { e: { numero: null } }, ['e']);
r('endereco_nao_e_objeto', Q(EN()), { e: 'Rua das Flores, 100' }, ['e']);
r('endereco_lista', Q(EN()), { e: ['Rua'] }, ['e']);
r('endereco_logradouro_200_ok', Q(EN()), { e: { logradouro: 'x'.repeat(200) } });
r('endereco_logradouro_201', Q(EN()), { e: { logradouro: 'x'.repeat(201) } }, ['e']);
r('endereco_logradouro_200_com_espacos_nas_pontas_ok', Q(EN()), { e: { logradouro: ` ${'x'.repeat(200)} ` } });
r('endereco_numero_20_ok', Q(EN()), { e: { numero: '1'.repeat(20) } });
r('endereco_numero_21', Q(EN()), { e: { numero: '1'.repeat(21) } }, ['e']);
r('endereco_complemento_100_ok', Q(EN()), { e: { complemento: 'x'.repeat(100) } });
r('endereco_complemento_101', Q(EN()), { e: { complemento: 'x'.repeat(101) } }, ['e']);
r('endereco_bairro_100_ok', Q(EN()), { e: { bairro: 'x'.repeat(100) } });
r('endereco_bairro_101', Q(EN()), { e: { bairro: 'x'.repeat(101) } }, ['e']);
r('endereco_cidade_100_ok', Q(EN()), { e: { cidade: 'x'.repeat(100) } });
r('endereco_cidade_101', Q(EN()), { e: { cidade: 'x'.repeat(101) } }, ['e']);

writeFileSync(`${SAIDA}/respostas.json`, JSON.stringify(respostas, null, 1) + '\n');

const limites = {
  secoes: 15, perguntasPorSecao: 40, perguntasTotal: 80, instrucoes: 10, instrucaoTamanho: 300, tituloTamanho: 80,
  rotuloTamanho: 200, ajudaTamanho: 300, rotuloCurtoTamanho: 20, opcoesMinimo: 2, opcoesMaximo: 20, opcaoTamanho: 80,
  unidadeTamanho: 12, casasMaximo: 2, diasMaximo: 7, diaValorMaximo: 14, destaquesMaximo: 4, textoCurtoCapacidade: 500,
  textoLongoCapacidade: 2000, capacidadeDeTextoTotal: 40000, rascunhoBytes: 262144, respostasBytes: 262144, idTamanho: 40,
  numeroAbsoluto: 1000000000, fotosPorPergunta: 6, linhasMinimo: 1, linhasMaximo: 30, colunasMinimo: 2, colunasMaximo: 10,
  textoInformativoTamanho: 4000, declaracaoTamanho: 200, telefoneTamanho: 25, telefoneDigitosMinimo: 10,
  telefoneDigitosMaximo: 13, emailTamanho: 254, dataAnoMinimo: 1900, dataAnoMaximo: 2100, imagemBytes: 300000, imagemLado: 1600,
  objetivoTamanho: 200, cpfTamanho: 14, enderecoCepTamanho: 9, enderecoLogradouroTamanho: 200, enderecoNumeroTamanho: 20,
  enderecoComplementoTamanho: 100, enderecoBairroTamanho: 100, enderecoCidadeTamanho: 100, enderecoUfTamanho: 2,
};
writeFileSync(`${SAIDA}/limites.json`, JSON.stringify(limites, null, 1) + '\n');
console.log(`${casos.length} casos de questionário, ${respostas.length} de respostas`);
