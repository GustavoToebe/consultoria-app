/**
 * Regras puras do importador de alunos e histórico de peso (R25/R26/R51 da reunião de 17/10): leitura dos dois CSV do
 * modelo, conferência linha a linha e o plano do que será gravado. Nada aqui fala com a API nem lê arquivo, para os
 * testes (`node --test scripts/importacao/`) rodarem só com dados fictícios.
 *
 * Mensagens de erro citam só a linha e o campo, nunca o valor: o terminal de quem importa não vira lugar de dado de aluno.
 */

/** Separa os campos de uma linha CSV (`;` ou `,`), com aspas duplas e `""` dentro delas. */
export function campos(linha, separador) {
  const saida = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) { saida.push(atual.trim()); atual = ''; }
    else atual += c;
  }
  saida.push(atual.trim());
  return saida;
}

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Nome do cabeçalho comparável: "Peso (kg)" = "peso_kg". */
const coluna = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
/** Nome de pessoa comparável, para achar o aluno que já existe na consultoria. */
export const chaveDoNome = (t) => semAcento(t).toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Lê um CSV com cabeçalho na primeira linha (vazias são ignoradas). Devolve as linhas como objetos pelo nome da coluna
 * (sem acento, minúsculo) e o número da linha no arquivo, para a mensagem de erro.
 */
export function lerCsv(texto) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).map((l, i) => ({ l, n: i + 1 })).filter((x) => x.l.trim() !== '');
  if (linhas.length === 0) return { colunas: [], linhas: [] };
  const separador = linhas[0].l.includes(';') ? ';' : ',';
  const colunas = campos(linhas[0].l, separador).map(coluna);
  return {
    colunas,
    linhas: linhas.slice(1).map(({ l, n }) => {
      const valores = campos(l, separador);
      return { n, ...Object.fromEntries(colunas.map((c, i) => [c, valores[i] ?? ''])) };
    }),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `DD/MM/AAAA` ou `AAAA-MM-DD` para `AAAA-MM-DD`; data que não existe (31/02) = null. Nunca corrige o ano. */
export function dataIso(texto) {
  const t = texto.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const [d, mes, a] = m ? [m[1], m[2], m[3]] : (m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)) ? [m[3], m[2], m[1]] : [];
  if (!a) return null;
  const iso = `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const data = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** "82,5", "82.5" ou "82" para número; vazio, texto, zero ou acima de 500 = null (nunca vira zero). */
export function pesoKg(texto) {
  const t = texto.trim().replace(/\s*kg$/i, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const v = Number(t);
  return v > 0 && v < 500 ? v : null;
}

/**
 * Confere os dois arquivos e monta o plano. `existentes` = nomes (já com {@link chaveDoNome}) dos alunos da consultoria,
 * com o id de cada um. `hoje` = `AAAA-MM-DD` (peso no futuro é recusado, como na API).
 *
 * Regras: `codigo` liga as duas planilhas e não se repete em alunos.csv; nome obrigatório; e-mail opcional e válido;
 * dias de atualização de 1 a 365 ou vazio. Aluno com o mesmo nome de um que já existe é reaproveitado (rodar de novo não
 * duplica); dois da planilha com o mesmo nome param tudo, porque não dá para saber de quem é cada peso. Peso precisa de
 * aluno, data válida e não futura, e valor; duas linhas do mesmo aluno na mesma data são erro (a API guarda um por dia).
 */
export function planejar(alunosCsv, pesosCsv, existentes, hoje) {
  const erros = [];
  const exigir = (arquivo, cols, obrigatorias) => {
    for (const c of obrigatorias) if (!cols.includes(c)) erros.push(`${arquivo}: falta a coluna "${c}".`);
  };
  exigir('alunos.csv', alunosCsv.colunas, ['codigo', 'nome']);
  exigir('pesos.csv', pesosCsv.colunas, ['codigo', 'data', 'peso_kg']);
  if (erros.length) return { erros, alunos: [], pesos: [] };

  const alunos = [];
  const porCodigo = new Map();
  const nomesDaPlanilha = new Map();
  for (const l of alunosCsv.linhas) {
    const local = `alunos.csv linha ${l.n}`;
    const codigo = l.codigo.trim();
    const nome = l.nome.trim().replace(/\s+/g, ' ');
    const email = (l.email ?? '').trim().toLowerCase();
    const dias = (l.dias_atualizacao ?? '').trim();
    if (!codigo) { erros.push(`${local}: código vazio.`); continue; }
    if (porCodigo.has(codigo)) { erros.push(`${local}: código repetido (já na linha ${porCodigo.get(codigo).n}).`); continue; }
    if (!nome) erros.push(`${local}: nome vazio.`);
    else if (nome.length > 120) erros.push(`${local}: nome com mais de 120 letras.`);
    if (email && (!EMAIL.test(email) || email.length > 254)) erros.push(`${local}: e-mail inválido.`);
    const diasNum = dias === '' ? null : Number(dias);
    if (diasNum !== null && !(Number.isInteger(diasNum) && diasNum >= 1 && diasNum <= 365)) {
      erros.push(`${local}: dias de atualização precisa ser de 1 a 365 (ou vazio).`);
    }
    const chave = chaveDoNome(nome);
    if (nome && nomesDaPlanilha.has(chave)) erros.push(`${local}: mesmo nome da linha ${nomesDaPlanilha.get(chave)}.`);
    nomesDaPlanilha.set(chave, l.n);
    const aluno = { n: l.n, codigo, nome, email: email || null, diasAtualizacao: diasNum, idExistente: existentes.get(chave) ?? null };
    porCodigo.set(codigo, aluno);
    alunos.push(aluno);
  }

  const pesos = [];
  const vistos = new Map();
  for (const l of pesosCsv.linhas) {
    const local = `pesos.csv linha ${l.n}`;
    const aluno = porCodigo.get(l.codigo.trim());
    const data = dataIso(l.data);
    const kg = pesoKg(l.peso_kg);
    const observacao = (l.observacao ?? '').trim();
    if (!aluno) { erros.push(`${local}: código sem aluno em alunos.csv.`); continue; }
    if (!data) { erros.push(`${local}: data inválida (use DD/MM/AAAA).`); continue; }
    if (data > hoje) { erros.push(`${local}: data no futuro.`); continue; }
    if (kg === null) { erros.push(`${local}: peso inválido (número maior que 0 e menor que 500).`); continue; }
    if (observacao.length > 300) { erros.push(`${local}: observação com mais de 300 letras.`); continue; }
    const chave = `${aluno.codigo}|${data}`;
    if (vistos.has(chave)) { erros.push(`${local}: mesmo aluno e data da linha ${vistos.get(chave)}.`); continue; }
    vistos.set(chave, l.n);
    pesos.push({ n: l.n, codigo: aluno.codigo, data, pesoKg: kg, observacao: observacao || null });
  }
  return { erros, alunos, pesos };
}
