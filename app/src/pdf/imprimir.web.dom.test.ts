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
  it('não usa innerHTML para atribuir o documento', () => {
    const fonte = readFileSync(join(__dirname, 'imprimir.web.ts'), 'utf8');
    expect(fonte).not.toMatch(/\.(innerHTML|outerHTML)\s*=/);
    expect(fonte).not.toContain('insertAdjacentHTML');
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

    it('texto escapado pelo gerador continua texto', () => {
      const raiz = noCorpo('<div>&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</div>');
      expect(raiz.querySelector('img')).toBeNull();
      expect(raiz.textContent).toBe('"><img src=x onerror=alert(1)>');
    });
  });
});
