/** @jest-environment jsdom */
import { readFileSync } from 'fs';
import { join } from 'path';

import { montarCorpo } from './imprimir.web';

const noCorpo = (html: string) => {
  const raiz = document.createElement('div');
  raiz.append(montarCorpo(html));
  return raiz;
};

describe('montarCorpo (impressão na web)', () => {
  describe('trava de código-fonte: nada de HTML por texto direto na página', () => {
    const PROIBIDO = /\.(innerHTML|outerHTML)\s*[-+*/%|&?^<>]*=|insertAdjacentHTML|createContextualFragment|document\.write/;
    it('imprimir.web.ts não atribui HTML por texto', () => {
      expect(readFileSync(join(__dirname, 'imprimir.web.ts'), 'utf8')).not.toMatch(PROIBIDO);
    });
    it('a trava pega atribuição, concatenação e os atalhos', () => {
      for (const amostra of ['a.innerHTML = x', 'a.innerHTML += x', 'a.innerHTML||=x', 'a.outerHTML = x', 'a.insertAdjacentHTML("x", y)', 'document.write(x)']) {
        expect(amostra).toMatch(PROIBIDO);
      }
    });
  });

  it('mantém o resultado do innerHTML para o HTML que os geradores escrevem', () => {
    const html =
      '<div class="faixa-marca com-logo" style="background:#C62828;color:#fff"><span class="faixa-logo"><img src="data:image/png;base64,AAAA" alt="Marca &amp; Cia"></span><span class="faixa-nome">Marca</span></div>' +
      '<table><thead><tr><th>Item</th></tr></thead><tbody><tr><td>Ovo 2 un<br>linha &lt;b&gt;</td></tr></tbody></table>' +
      '<p><a href="https://youtu.be/abc">Vídeo</a> — <strong>fim</strong></p>';
    const referencia = document.createElement('div');
    referencia.innerHTML = html; // só o teste usa: é o comportamento antigo a preservar
    expect(noCorpo(html).innerHTML).toBe(referencia.innerHTML);
  });

  describe('HTML hostil não vira nó ativo nem executa', () => {
    const hostil =
      '<div><img src=x onerror="window.__executou = 1"><script>window.__executou = 2</script>' +
      '<a href="javascript:window.__executou = 3" onclick="window.__executou = 4">x</a>' +
      '<iframe src="https://exemplo.invalid"></iframe><object data="x"></object><embed src="x"><form action="javascript:1"><button formaction="javascript:2">b</button></form>' +
      '<svg onload="window.__executou = 5"><a xlink:href="javascript:1"></a></svg><base href="https://exemplo.invalid/"><link rel="stylesheet" href="x"><meta http-equiv="refresh" content="0"></div>';

    it('sem script, iframe, object, embed, form, base, link nem meta', () => {
      const raiz = noCorpo(hostil);
      expect(raiz.querySelectorAll('script, iframe, object, embed, form, base, link, meta')).toHaveLength(0);
    });

    it('sem atributo on* nem javascript:', () => {
      const raiz = noCorpo(hostil);
      for (const e of raiz.querySelectorAll('*')) {
        for (const nome of e.getAttributeNames()) {
          expect(nome).not.toMatch(/^on/i);
          expect(e.getAttribute(nome) ?? '').not.toMatch(/javascript:/i);
        }
      }
      expect(raiz.querySelector('img')?.getAttribute('src')).toBe('x');
    });

    it('nada executa ao entrar na página', async () => {
      const marca = window as unknown as { __executou?: number };
      delete marca.__executou;
      const raiz = noCorpo(hostil);
      document.body.append(raiz);
      raiz.querySelector('a')?.click();
      await new Promise((r) => setTimeout(r, 20));
      raiz.remove();
      expect(marca.__executou).toBeUndefined();
    });

    it.each([
      '<a href="java&#9;script:alert(1)">x</a>',
      '<a href="java&#10;script:alert(1)">x</a>',
      '<a href="  JaVaScRiPt:alert(1)">x</a>',
      '<a href="vbscript:x">x</a>',
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
      '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
      '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
      '<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>',
      '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
      '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">b</button></form>',
      '<div><button formaction="javascript:alert(1)">b</button></div>',
    ])('endereço ou elemento perigoso é removido: %s', (html) => {
      const raiz = noCorpo(html);
      expect(raiz.querySelectorAll('script, svg, animate, set, form').length).toBe(0);
      for (const e of raiz.querySelectorAll('*')) {
        for (const nome of e.getAttributeNames()) {
          expect(e.getAttribute(nome) ?? '').not.toMatch(/script|text\/html|svg/i);
        }
      }
    });

    it('<style> no corpo sai, mas o atributo style continua', () => {
      const raiz = noCorpo('<style>body{display:none}</style><div style="background:#C62828;color:#fff">x</div>');
      expect(raiz.querySelector('style')).toBeNull();
      expect(raiz.querySelector('div')?.getAttribute('style')).toBe('background:#C62828;color:#fff');
    });

    it('endereços legítimos ficam: https, mailto, âncora, relativo e a logo em data:image/png', () => {
      const raiz = noCorpo(
        '<a href="https://youtu.be/abc">v</a><a href="mailto:a@b.c">m</a><a href="#x">a</a><a href="/rel">r</a><img src="data:image/png;base64,AAAA" alt="l">',
      );
      expect([...raiz.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://youtu.be/abc', 'mailto:a@b.c', '#x', '/rel']);
      expect(raiz.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    });

    it('texto escapado pelo gerador continua texto', () => {
      const raiz = noCorpo('<div>&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</div>');
      expect(raiz.querySelector('img')).toBeNull();
      expect(raiz.textContent).toBe('"><img src=x onerror=alert(1)>');
    });
  });
});
