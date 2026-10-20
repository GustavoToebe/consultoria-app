#!/usr/bin/env node
/**
 * Leva os rascunhos de treino e dieta gerados por `converter-planos.mjs` (um JSON por aluno) para a API, como
 * **rascunho** numa pasta nova de cada aluno. **Nunca publica**: o treinador revisa e publica.
 *
 *   node scripts/importacao/importar-planos.mjs --pasta C:\Users\<voce>\Documents\planos-saraiva --simular   (sem rede e sem login)
 *   node scripts/importacao/importar-planos.mjs --pasta C:\...\planos-saraiva --gravar                      (grava de verdade)
 *
 * Sem `--simular` nem `--gravar` o script não faz nada. `--simular` só lê os arquivos e os dados do repositório e mostra
 * contagens (exercícios com e sem par na biblioteca, refeições, itens): não chama a API nem faz login. A pasta precisa
 * ficar **fora do repositório**.
 *
 * Modo `--gravar`: variáveis API_URL (padrão http://localhost:8088/api), IMPORT_EMAIL e a senha em IMPORT_SENHA (nunca na
 * linha de comando). Confere as permissões em `GET /eu` antes de gravar qualquer coisa (inclusive `ERGOGENICO_ALTERAR` se
 * houver medicação: sem ela a API mantém a lista antiga calada). Acha o aluno pelo nome (que já precisa ter sido importado
 * por `importar-alunos.mjs`; nome repetido ou ausente é pulado). Por aluno: `POST /alunos/{id}/pastas` (título fixo, sem
 * datas), `POST /alunos/{id}/planos-treino` e `PUT /planos-treino/{id}/rascunho` (o mesmo para a dieta). Rodar de novo
 * não duplica: pasta com o título fixo é reaproveitada e o plano que já está nela é mantido. Os exercícios ganham o
 * `exercicioId` da biblioteca pelo nome; exercício sem par fica só com o nome (nunca é criado). Para no primeiro erro.
 * O terminal mostra só contagens e o código do aluno na planilha, nunca nome, dieta ou observação.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chaveDoNome } from './alunos-lib.mjs';
import { lerBibliotecaLocal } from './biblioteca-local.mjs';
import { dentroDoRepositorio, real } from './fora-do-repositorio.mjs';
import { chaveDoExercicio, exerciciosDoTreino, lerArquivoDePlano, resumoDaImportacao, treinoComBiblioteca } from './planos-lib.mjs';

const SIMULAR = process.argv.includes('--simular');
const GRAVAR = process.argv.includes('--gravar');
const indicePasta = process.argv.indexOf('--pasta');
const PASTA = indicePasta > 0 ? process.argv[indicePasta + 1] : null;
const BASE = process.env.API_URL ?? 'http://localhost:8088/api';

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

if (SIMULAR === GRAVAR) sair('Escolha um modo: --simular (só confere, sem API) ou --gravar (grava os rascunhos).');
if (!PASTA) sair('Informe a pasta com os JSON dos planos: --pasta <caminho>.');
const pasta = real(PASTA);
if (dentroDoRepositorio(pasta)) sair('A pasta está dentro do repositório. Use uma pasta fora dele (dado de aluno nunca vai para o git).');

let nomes;
try {
  nomes = readdirSync(pasta).filter((n) => n.toLowerCase().endsWith('.json')).sort();
} catch {
  sair('Não consegui ler a pasta informada.');
}
if (nomes.length === 0) sair('Nenhum arquivo .json na pasta informada.');
const planos = nomes.map((n) => {
  try {
    return lerArquivoDePlano(readFileSync(join(pasta, n), 'utf8'));
  } catch (e) {
    return sair(`Arquivo ${n}: ${e.message}.`);
  }
});

const contagem = (a) => resumoDaImportacao(a, lerBibliotecaLocal());

if (SIMULAR) {
  const c = contagem(planos);
  console.log(`Simulação (nenhuma API foi chamada, nada foi gravado): ${c.alunos} alunos, ${c.comTreino} com treino e ${c.comDieta} com dieta.`);
  console.log(`Criaria ${c.alunos} pasta(s) "${planos[0].pasta.titulo}", ${c.comTreino} rascunho(s) de treino e ${c.comDieta} de dieta. Nunca publica.`);
  console.log(`Exercícios: ${c.exercicios} (${c.naBiblioteca} na biblioteca do Saraiva, ${c.soNoCatalogo} só no catálogo público, ${c.semPar} sem par; ${c.nomesSemPar.size} nomes diferentes sem par).`);
  console.log(`Dieta: ${c.refeicoes} refeições, ${c.itens} itens; medicação e ergogênicos: ${c.ergogenicos} itens (no modo real exigem ERGOGENICO_ALTERAR).`);
  process.exit(0);
}

// ------------------------------------------------------------------------------------------------ modo --gravar
let token = null;
async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'X-Treinos-Cliente': 'nativo', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) {
    // Só status e código: a mensagem da API pode repetir o que foi enviado.
    let codigo = '';
    try { codigo = JSON.parse(texto).codigo ?? ''; } catch { /* corpo não é JSON */ }
    throw new Error(`${metodo} ${caminho.replace(/[0-9a-f-]{36}/g, '<id>').replace(/\?.*/, '')} -> ${r.status} ${codigo}`.trim());
  }
  return texto ? JSON.parse(texto) : null;
}

async function entrar() {
  const email = process.env.IMPORT_EMAIL;
  const senha = process.env.IMPORT_SENHA;
  if (!email || !senha) sair('Defina IMPORT_EMAIL e IMPORT_SENHA no ambiente (não na linha de comando).');
  const j = await chamar('POST', '/auth/login', { email, senha });
  token = j.accessToken;
  if (!token) sair('Login sem token de acesso.');
}

async function alunosExistentes() {
  const mapa = new Map();
  for (let pagina = 0; ; pagina++) {
    const p = await chamar('GET', `/alunos?situacao=TODOS&tamanho=100&pagina=${pagina}`);
    for (const a of p.itens) {
      const chave = chaveDoNome(a.nome);
      // Dois alunos com o mesmo nome: não dá para escolher; o plano desse nome é pulado.
      mapa.set(chave, mapa.has(chave) ? null : a.id);
    }
    if ((pagina + 1) * 100 >= p.total || p.itens.length === 0) break;
  }
  for (const [k, v] of mapa) if (v === null) mapa.delete(k);
  return mapa;
}

/** Cria o plano na pasta e grava o rascunho; se o rascunho falhar, arquiva o plano vazio para o próximo ciclo não achar que já foi feito. */
async function criarRascunho(tipo, alunoId, pastaId, plano, conteudo) {
  const criado = await chamar('POST', `/alunos/${alunoId}/planos-${tipo}`, { titulo: plano.titulo, inicio: null, fim: null, pastaId });
  try {
    await chamar('PUT', `/planos-${tipo}/${criado.plano.id}/rascunho`, { titulo: plano.titulo, inicio: null, fim: null, conteudo, versao: criado.plano.versao });
  } catch (e) {
    await chamar('DELETE', `/planos-${tipo}/${criado.plano.id}`).catch(() => {});
    throw e;
  }
}

async function gravar() {
  const exigidas = new Set(['ALUNO_LER', 'PASTA_ALTERAR', 'BIBLIOTECA_LER']);
  if (planos.some((p) => p.treino)) exigidas.add('TREINO_ALTERAR');
  if (planos.some((p) => p.dieta)) exigidas.add('DIETA_ALTERAR');
  if (planos.some((p) => p.dieta?.conteudo.ergogenicos?.length)) exigidas.add('ERGOGENICO_ALTERAR');
  await entrar();
  const eu = await chamar('GET', '/eu');
  const faltam = [...exigidas].filter((p) => !eu.permissoes?.includes(p));
  if (faltam.length) sair(`Faltam permissões para este login: ${faltam.join(', ')}. Nada foi gravado.`);

  const alunos = await alunosExistentes();
  const biblioteca = new Map();
  for (const e of await chamar('GET', '/exercicios')) if (!biblioteca.has(chaveDoExercicio(e.nome))) biblioteca.set(chaveDoExercicio(e.nome), e);

  const total = { semAluno: 0, jaFeitos: 0, pastas: 0, treinos: 0, dietas: 0, semPar: 0 };
  for (const plano of planos) {
    const alunoId = alunos.get(chaveDoNome(plano.nome));
    if (!alunoId) { total.semAluno++; continue; }
    try {
      const existentes = await chamar('GET', `/alunos/${alunoId}/pastas`);
      let pastaPronta = existentes.find((p) => p.titulo === plano.pasta.titulo);
      const pastaNova = !pastaPronta;
      if (pastaNova) {
        pastaPronta = await chamar('POST', `/alunos/${alunoId}/pastas`, { titulo: plano.pasta.titulo, inicio: null, fim: null });
        total.pastas++;
      }
      let algo = false;
      for (const tipo of ['treino', 'dieta']) {
        if (!plano[tipo]) continue;
        const jaTem = !pastaNova && (await chamar('GET', `/alunos/${alunoId}/planos-${tipo}`)).some((p) => p.pastaId === pastaPronta.id);
        if (jaTem) continue;
        algo = true;
        const conteudo = tipo === 'treino' ? treinoComBiblioteca(plano.treino.conteudo, biblioteca) : plano.dieta.conteudo;
        if (tipo === 'treino') total.semPar += exerciciosDoTreino({ conteudo }).filter((e) => !e.exercicioId).length;
        await criarRascunho(tipo, alunoId, pastaPronta.id, plano[tipo], conteudo);
        total[tipo === 'treino' ? 'treinos' : 'dietas']++;
      }
      if (!algo && !pastaNova) total.jaFeitos++;
    } catch (e) {
      sair(`Plano do aluno ${plano.codigo} (código na planilha): ${e.message}. Já gravado: ${total.pastas} pastas, ${total.treinos} treinos, ${total.dietas} dietas; rodar de novo continua sem duplicar.`);
    }
  }
  console.log(`Gravado como rascunho (nada publicado): ${total.pastas} pastas novas, ${total.treinos} treinos e ${total.dietas} dietas.`);
  console.log(`Pulados: ${total.semAluno} sem aluno de mesmo nome na consultoria (importe os alunos antes) e ${total.jaFeitos} já importados. Exercícios gravados sem par na biblioteca: ${total.semPar}.`);
}

gravar().catch((e) => sair(`ERRO: ${e.message}`));
