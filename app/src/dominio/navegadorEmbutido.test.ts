import { ehAndroid, ehNavegadorEmbutido, linkParaChrome, oferecerOutroNavegador } from './navegadorEmbutido';

const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const INSTAGRAM_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.40.101 Android (34/14; 420dpi; 1080x2400; Google; Pixel 8; shiba; shiba; pt_BR; 000000000)';
const FACEBOOK_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.0.0;]';
const WEBVIEW_ANDROID = 'Mozilla/5.0 (Linux; Android 12; moto g; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36';
const INSTAGRAM_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 330.0.0.40.101 (iPhone14,5; iOS 17_5; pt_BR; pt; scale=3.00; 1170x2532; 000000000)';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('navegador embutido', () => {
  it.each([
    ['Instagram (Android)', INSTAGRAM_ANDROID],
    ['Facebook (FB_IAB)', FACEBOOK_ANDROID],
    ['WebView do Android (; wv)', WEBVIEW_ANDROID],
    ['Instagram (iPhone)', INSTAGRAM_IPHONE],
    ['WhatsApp', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1'],
    ['Line', 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0'],
    ['WeChat', 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.0'],
    ['Snapchat', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Mobile/21F90 Snapchat/12.0.0'],
    ['TikTok', 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0 Mobile Safari/537.36 musical_ly_33.0.0 BytedanceWebview/d8a21c6'],
  ])('reconhece %s', (_nome, ua) => {
    expect(ehNavegadorEmbutido(ua)).toBe(true);
    expect(oferecerOutroNavegador(ua)).toBe(true);
  });

  it.each([
    ['Chrome no Android', CHROME_ANDROID],
    ['Safari no iPhone', SAFARI_IPHONE],
    ['Chrome no PC', CHROME_PC],
    ['vazio', ''],
    ['não é texto', undefined],
  ])('não confunde %s com navegador embutido', (_nome, ua) => {
    expect(ehNavegadorEmbutido(ua)).toBe(false);
  });

  it('detecta Android pelo userAgent', () => {
    expect(ehAndroid(CHROME_ANDROID)).toBe(true);
    expect(ehAndroid(INSTAGRAM_ANDROID)).toBe(true);
    expect(ehAndroid(SAFARI_IPHONE)).toBe(false);
    expect(ehAndroid(CHROME_PC)).toBe(false);
    expect(ehAndroid(null)).toBe(false);
  });

  it('oferece outro navegador no Android e nos embutidos, nunca no PC nem no Safari do iPhone', () => {
    expect(oferecerOutroNavegador(CHROME_ANDROID)).toBe(true);
    expect(oferecerOutroNavegador(INSTAGRAM_IPHONE)).toBe(true);
    expect(oferecerOutroNavegador(SAFARI_IPHONE)).toBe(false);
    expect(oferecerOutroNavegador(CHROME_PC)).toBe(false);
  });
});

describe('linkParaChrome', () => {
  it('monta o intent com host, caminho, parâmetros e o endereço de volta codificado', () => {
    expect(linkParaChrome('https://overtraining.app/aluno/entrar?x=1')).toBe(
      'intent://overtraining.app/aluno/entrar?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fovertraining.app%2Faluno%2Fentrar%3Fx%3D1;end',
    );
  });

  it('não leva o fragmento (pode ter token) nem no intent nem no endereço de volta', () => {
    const link = linkParaChrome('https://overtraining.app/convite#codigo=ABC123');
    expect(link).toBe(
      'intent://overtraining.app/convite#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fovertraining.app%2Fconvite;end',
    );
    expect(link).not.toContain('ABC123');
  });

  it('mantém a porta e o esquema http dos testes locais', () => {
    expect(linkParaChrome('http://localhost:8105/entrar')).toContain('intent://localhost:8105/entrar#Intent;scheme=http;');
  });

  it('recusa o que não é endereço http(s)', () => {
    expect(linkParaChrome('javascript:alert(1)')).toBeNull();
    expect(linkParaChrome('não é endereço')).toBeNull();
    expect(linkParaChrome(undefined)).toBeNull();
  });
});
