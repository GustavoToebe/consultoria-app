import {
  aguardandoVerificacao,
  erroHttpFatalDoWidget,
  falhaDeVerificacao,
  htmlDoWidget,
  jsonParaScript,
  LIMITE_DE_FALHAS_SEGUIDAS,
  lerMensagemDoWidget,
  mensagemDaVerificacao,
  navegacaoPermitida,
  ORIGEM_DO_WIDGET,
  reagirAoWidget,
  rotuloDoEnvio,
  siteKeyValida,
  TOKEN_MAXIMO,
} from './verificacaoHumana';

const CHAVE = '0x4AAAAAAAexemplo_chave-1';

describe('chave pública do widget', () => {
  it('aceita só letras, números, _ e - de 10 a 64 caracteres', () => {
    expect(siteKeyValida(CHAVE)).toBe(true);
    expect(siteKeyValida('1x00000000000000000000AA')).toBe(true);
    expect(siteKeyValida('a'.repeat(64))).toBe(true);
  });

  it('recusa chave curta, longa, com símbolo, aspas, tag ou que não é texto', () => {
    expect(siteKeyValida('curta')).toBe(false);
    expect(siteKeyValida('a'.repeat(65))).toBe(false);
    expect(siteKeyValida('0x4AAAAAAA"; alert(1); "')).toBe(false);
    expect(siteKeyValida('0x4AAAAAAA</script><script>')).toBe(false);
    expect(siteKeyValida('0x4AAAAAAAAAAAA\n')).toBe(false);
    expect(siteKeyValida('')).toBe(false);
    expect(siteKeyValida(undefined)).toBe(false);
    expect(siteKeyValida(12345678901)).toBe(false);
  });
});

describe('mensagens do WebView', () => {
  it('lê token válido', () => {
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'token', token: 'abc.def' }))).toEqual({ tipo: 'token', token: 'abc.def' });
    const noLimite = 'a'.repeat(TOKEN_MAXIMO);
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'token', token: noLimite }))).toEqual({ tipo: 'token', token: noLimite });
  });

  it('ignora token vazio, sem token, que não é texto ou acima de 2048 caracteres', () => {
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'token', token: '' }))).toBeNull();
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'token' }))).toBeNull();
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'token', token: 123 }))).toBeNull();
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'token', token: 'a'.repeat(TOKEN_MAXIMO + 1) }))).toBeNull();
  });

  it('ignora mensagem malformada, grande demais ou fora do combinado', () => {
    expect(lerMensagemDoWidget('não é json')).toBeNull();
    expect(lerMensagemDoWidget('')).toBeNull();
    expect(lerMensagemDoWidget(undefined)).toBeNull();
    expect(lerMensagemDoWidget({ tipo: 'token', token: 'x' })).toBeNull();
    expect(lerMensagemDoWidget('null')).toBeNull();
    expect(lerMensagemDoWidget('[]')).toBeNull();
    expect(lerMensagemDoWidget('"token"')).toBeNull();
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'outro' }))).toBeNull();
    expect(lerMensagemDoWidget(JSON.stringify({ token: 'x' }))).toBeNull();
    expect(lerMensagemDoWidget(JSON.stringify({ tipo: 'erro', lixo: 'x'.repeat(5000) }))).toBeNull();
  });

  it('lê expiração, erro e falha de carregamento', () => {
    expect(lerMensagemDoWidget('{"tipo":"expirou"}')).toEqual({ tipo: 'expirou' });
    expect(lerMensagemDoWidget('{"tipo":"erro"}')).toEqual({ tipo: 'erro' });
    expect(lerMensagemDoWidget('{"tipo":"falha"}')).toEqual({ tipo: 'falha' });
  });

  it('lê a altura dentro de limites e ignora a que não é número', () => {
    expect(lerMensagemDoWidget('{"tipo":"altura","altura":120.2}')).toEqual({ tipo: 'altura', altura: 121 });
    expect(lerMensagemDoWidget('{"tipo":"altura","altura":10}')).toEqual({ tipo: 'altura', altura: 65 });
    expect(lerMensagemDoWidget('{"tipo":"altura","altura":99999}')).toEqual({ tipo: 'altura', altura: 500 });
    expect(lerMensagemDoWidget('{"tipo":"altura","altura":"80"}')).toBeNull();
    expect(lerMensagemDoWidget('{"tipo":"altura","altura":-5}')).toBeNull();
    expect(lerMensagemDoWidget('{"tipo":"altura"}')).toBeNull();
  });
});

describe('reação ao widget', () => {
  it('token novo zera os erros seguidos', () => {
    expect(reagirAoWidget({ tipo: 'token', token: 't' }, 2)).toMatchObject({ falhas: 0, token: 't', renovar: false, falhou: false });
  });

  it('expiração tira o token e renova na hora, sem contar como erro', () => {
    expect(reagirAoWidget({ tipo: 'expirou' }, 1)).toMatchObject({ falhas: 1, token: null, renovar: true, atrasoMs: 0, falhou: false });
  });

  it('erro tira o token e renova com espera crescente', () => {
    expect(reagirAoWidget({ tipo: 'erro' }, 0)).toMatchObject({ falhas: 1, token: null, renovar: true, atrasoMs: 1000, falhou: false });
    expect(reagirAoWidget({ tipo: 'erro' }, 1)).toMatchObject({ falhas: 2, renovar: true, atrasoMs: 2000 });
  });

  it('desiste depois de erros demais seguidos em vez de renovar para sempre', () => {
    const reacao = reagirAoWidget({ tipo: 'erro' }, LIMITE_DE_FALHAS_SEGUIDAS);
    expect(reacao).toMatchObject({ token: null, renovar: false, falhou: true });
  });

  it('falha de carregamento desiste sem renovar; altura não mexe no token', () => {
    expect(reagirAoWidget({ tipo: 'falha' }, 0)).toMatchObject({ token: null, renovar: false, falhou: true });
    const altura = reagirAoWidget({ tipo: 'altura', altura: 90 }, 2);
    expect(altura).toMatchObject({ altura: 90, falhas: 2, renovar: false, falhou: false });
    expect(altura.token).toBeUndefined();
  });
});

describe('página do WebView', () => {
  it('carrega o api.js com render explícito', () => {
    const html = htmlDoWidget(CHAVE, 'dark') as string;
    expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    expect(html).toContain('ReactNativeWebView.postMessage');
  });

  it('põe a chave e o tema como strings JSON escapadas', () => {
    const html = htmlDoWidget(CHAVE, 'dark') as string;
    expect(html).toContain(`var CHAVE = "${CHAVE}";`);
    expect(html).toContain('var TEMA = "dark";');
  });

  it('o tema desconhecido vira claro', () => {
    expect(htmlDoWidget(CHAVE, '"; alert(1); "')).toContain('var TEMA = "light";');
    expect(htmlDoWidget(CHAVE, undefined)).toContain('var TEMA = "light";');
  });

  it('a origem (baseUrl) não vai dentro do HTML', () => {
    const html = htmlDoWidget(CHAVE, 'light') as string;
    expect(html).not.toContain(ORIGEM_DO_WIDGET);
    expect(html).not.toContain('servirea');
  });

  it('com chave inválida não monta página nenhuma', () => {
    expect(htmlDoWidget('0x4AAAAAAA"; alert(1); "', 'light')).toBeNull();
    expect(htmlDoWidget('</script><script>alert(1)</script>', 'light')).toBeNull();
    expect(htmlDoWidget('', 'light')).toBeNull();
    expect(htmlDoWidget(null, 'light')).toBeNull();
  });
});

describe('texto dentro do <script>', () => {
  it('é uma string JSON que nunca fecha a tag nem abre comentário', () => {
    expect(jsonParaScript('abc_123-X')).toBe('"abc_123-X"');
    const perigoso = jsonParaScript('</script><script>alert(1)</script><!--"\u2028\u2029');
    expect(perigoso).not.toContain('<');
    expect(perigoso).not.toContain('>');
    expect(perigoso).not.toContain('\u2028');
    expect(perigoso).not.toContain('\u2029');
    expect(perigoso).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(perigoso)).toBe('</script><script>alert(1)</script><!--"\u2028\u2029');
  });
});

describe('navegação permitida no WebView', () => {
  it('deixa carregar a página em branco, a origem do widget e a Cloudflare', () => {
    expect(navegacaoPermitida('about:blank')).toBe(true);
    expect(navegacaoPermitida('about:srcdoc')).toBe(true);
    expect(navegacaoPermitida('https://consultoria.servirea.com.br')).toBe(true);
    expect(navegacaoPermitida('https://consultoria.servirea.com.br/')).toBe(true);
    expect(navegacaoPermitida('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')).toBe(true);
    expect(navegacaoPermitida('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/turnstile/if/ov2/av0/rcv0/0/x/0x4/light')).toBe(true);
    expect(navegacaoPermitida('https://CHALLENGES.cloudflare.com:443/x')).toBe(true);
  });

  it('bloqueia outros hosts, imitações, usuário na URL e outros esquemas', () => {
    expect(navegacaoPermitida('https://evil.com/')).toBe(false);
    expect(navegacaoPermitida('https://challenges.cloudflare.com.evil.com/')).toBe(false);
    expect(navegacaoPermitida('https://challenges.cloudflare.com@evil.com/')).toBe(false);
    expect(navegacaoPermitida('https://evil.com\\.challenges.cloudflare.com/')).toBe(false);
    expect(navegacaoPermitida('https://evil.com#.challenges.cloudflare.com')).toBe(false);
    expect(navegacaoPermitida('https://challenges.cloudflare.com:8443/')).toBe(false);
    expect(navegacaoPermitida('http://challenges.cloudflare.com/')).toBe(false);
    expect(navegacaoPermitida('http://consultoria.servirea.com.br/')).toBe(false);
    expect(navegacaoPermitida('https://servirea.com.br/')).toBe(false);
    expect(navegacaoPermitida('javascript:alert(1)')).toBe(false);
    expect(navegacaoPermitida('data:text/html,<script>1</script>')).toBe(false);
    expect(navegacaoPermitida('intent://x#Intent;end')).toBe(false);
    expect(navegacaoPermitida('')).toBe(false);
    expect(navegacaoPermitida(undefined)).toBe(false);
  });
});

describe('erro HTTP do WebView', () => {
  it('só derruba o widget se for a página ou o script do Turnstile', () => {
    expect(erroHttpFatalDoWidget('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', 503)).toBe(true);
    expect(erroHttpFatalDoWidget(ORIGEM_DO_WIDGET, 500)).toBe(true);
    expect(erroHttpFatalDoWidget('https://consultoria.servirea.com.br/favicon.ico', 404)).toBe(false);
    expect(erroHttpFatalDoWidget('https://challenges.cloudflare.com/turnstile/v0/api.js', 200)).toBe(false);
    expect(erroHttpFatalDoWidget(undefined, 500)).toBe(false);
  });
});

describe('botão de envio', () => {
  it('espera só quando a verificação é exigida e ainda não há token', () => {
    expect(aguardandoVerificacao(true, null)).toBe(true);
    expect(aguardandoVerificacao(true, '')).toBe(true);
    expect(aguardandoVerificacao(true, 'token')).toBe(false);
    expect(aguardandoVerificacao(false, null)).toBe(false);
  });

  it('mostra "Verificando…" enquanto espera o token e o rótulo normal nos outros casos', () => {
    expect(rotuloDoEnvio('Entrar', true, false)).toBe('Verificando…');
    expect(rotuloDoEnvio('Entrar', false, false)).toBe('Entrar');
    expect(rotuloDoEnvio('Entrar', true, true)).toBe('Entrar');
  });
});

describe('erro de verificação da API', () => {
  it('reconhece o 400 VERIFICACAO_HUMANA e usa o texto fixo', () => {
    const erro = { status: 400, codigo: 'VERIFICACAO_HUMANA' };
    expect(falhaDeVerificacao(erro)).toBe(true);
    expect(mensagemDaVerificacao(erro)).toBe('Não foi possível confirmar que você é uma pessoa. Tente de novo.');
  });

  it('deixa o 503 e os outros erros com a mensagem do servidor', () => {
    expect(falhaDeVerificacao({ status: 503, codigo: 'VERIFICACAO_INDISPONIVEL' })).toBe(false);
    expect(mensagemDaVerificacao({ status: 503, codigo: 'VERIFICACAO_INDISPONIVEL' })).toBeNull();
    expect(mensagemDaVerificacao(new Error('x'))).toBeNull();
    expect(mensagemDaVerificacao(undefined)).toBeNull();
  });
});
