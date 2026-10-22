/**
 * Regras de acesso à API que os scripts de importação dividem (`importar.mjs`, `importar-alunos.mjs`, `importar-planos.mjs`
 * e `../questionario/anamnese-saraiva.mjs`): o endereço só em https, o corpo do login com o código da verificação em duas
 * etapas e a conferência das permissões do login. Nada aqui lê arquivo nem faz rede; o terminal nunca mostra a senha.
 */

/** Únicos nomes que dispensam o https: a própria máquina. Comparados pelo host já separado, nunca pelo começo do texto. */
const MAQUINA_LOCAL = new Set(['localhost', '127.0.0.1']);

/**
 * Confere o `API_URL` e devolve o endereço sem a barra final. Recusa o que não é https, para a senha nunca ir em claro;
 * `http` só vale para `localhost` e `127.0.0.1`. Exceção deliberada: com `IMPORT_PERMITIR_HTTP=sim` o `http` passa
 * (o serviço `importacao` do compose fala com a API pelo nome do contêiner, `http://api:8080`, dentro da rede do compose).
 * Credencial dentro do endereço (`https://usuario:senha@...`) também é recusada.
 */
export function baseDaApi(valor, env = process.env) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('API_URL inválida: use https://endereco-da-api (http só para localhost ou 127.0.0.1).');
  }
  if (url.username || url.password) throw new Error('API_URL não pode levar usuário nem senha.');
  const https = url.protocol === 'https:';
  const http = url.protocol === 'http:';
  const local = http && MAQUINA_LOCAL.has(url.hostname);
  const liberado = http && env.IMPORT_PERMITIR_HTTP === 'sim';
  if (!https && !local && !liberado) {
    throw new Error('API_URL precisa ser https (http só para localhost ou 127.0.0.1): a senha iria em claro.');
  }
  return valor.replace(/\/+$/, '');
}

/** Lê `API_URL` (ou o padrão), confere e, se recusar, escreve o motivo e sai com erro. */
export function baseDaApiOuSair(padrao, env = process.env) {
  try {
    return baseDaApi(env.API_URL ?? padrao, env);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

/** Corpo do `POST /auth/login`: leva `codigoMfa` só quando `CODIGO_MFA` está no ambiente (a conta tem verificação em duas etapas). */
export function corpoDoLogin(email, senha, env = process.env) {
  return { email, senha, ...(env.CODIGO_MFA ? { codigoMfa: env.CODIGO_MFA } : {}) };
}

/** Permissões de `exigidas` que o `GET /eu` não trouxe. */
export function permissoesQueFaltam(eu, exigidas) {
  return [...exigidas].filter((p) => !eu?.permissoes?.includes(p));
}
