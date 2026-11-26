import { contraste } from '../tema/tokens';

/**
 * Apoio de teste (nunca importado pelo app; roda em jsdom, no ambiente `@jest-environment jsdom`): resolve a cascata do CSS
 * gerado como o navegador (especificidade, `!important`, `style` do atributo, ordem e herança da cor) e, com ela, mede o
 * contraste de cada texto contra o fundo em que ele de fato cai. Diferente de `contrasteDoCss.apoioTeste`, que só lê cada
 * regra isolada, este acusa o que nasce da combinação de regras (o `th` escuro de uma regra com a cor de texto de outra, a
 * listra do gerador por cima da listra da opção) e serve também para afirmar qual regra venceu (`valor`: padding, tamanho de
 * fonte, margem). Só entende o que o CSS dos PDFs usa: cor `#RRGGBB` ou `#RGB`, `none`, `transparent` e `inherit` em
 * `color` e `background`; as outras propriedades saem como o texto declarado. `html, body` do `cssBase` dão o papel (fundo
 * branco e texto `#111`); sem regra, o fundo é branco.
 */
type Declaracao = { valor: string; importante: boolean };
type Regra = { seletor: string; peso: [number, number, number]; ordem: number; declaracoes: Record<string, Declaracao> };

const PROPRIEDADES = new Set(['color', 'background', 'background-color', 'display', 'padding', 'margin', 'font-size']);
const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/i;

function especificidade(seletor: string): [number, number, number] {
  const s = seletor.replace(/:nth-[\w-]+\([^)]*\)/g, ':n').replace(/:(not|is|where)\(/g, '(');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+/g) ?? []).length + (s.match(/\[[^\]]*\]/g) ?? []).length + (s.match(/(?<!:):[\w-]+/g) ?? []).length;
  const tags = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|:[\w-]+/g, ' ').match(/(^|[\s>+~(,])[a-zA-Z][\w-]*/g) ?? []).length;
  return [ids, classes, tags];
}

function declaracoes(texto: string): Record<string, Declaracao> {
  const saida: Record<string, Declaracao> = {};
  for (const parte of texto.split(';')) {
    const i = parte.indexOf(':');
    if (i < 0) continue;
    const propriedade = parte.slice(0, i).trim().toLowerCase();
    if (!PROPRIEDADES.has(propriedade)) continue;
    const valor = parte.slice(i + 1).trim();
    const importante = /!important\s*$/i.test(valor);
    saida[propriedade === 'background-color' ? 'background' : propriedade] = { valor: valor.replace(/\s*!important\s*$/i, ''), importante };
  }
  return saida;
}

function lerRegras(css: string): Regra[] {
  const regras: Regra[] = [];
  let ordem = 0;
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const seletores = m[1].trim();
    if (seletores.startsWith('@')) continue;
    const dec = declaracoes(m[2]);
    if (!Object.keys(dec).length) continue;
    for (const seletor of seletores.split(',').map((x) => x.trim())) {
      if (seletor && !seletor.includes('::')) regras.push({ seletor, peso: especificidade(seletor), ordem: ordem++, declaracoes: dec });
    }
  }
  return regras;
}

/** Comparação da cascata: importante, `style` do atributo, especificidade e, por fim, a ordem. */
const pesa = (a: number[], b: number[]) => {
  const i = a.findIndex((x, k) => x !== b[k]);
  return i >= 0 && a[i] > b[i];
};

/** Uma cor `#RRGGBB` (maiúscula), `null` = transparente, `undefined` = valor que o apoio não entende. */
function cor(valor: string): string | null | undefined {
  const hex = HEX.exec(valor)?.[0];
  if (hex) return (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex).toUpperCase();
  return /^(none|transparent)$/i.test(valor.trim()) ? null : undefined;
}

export function cascata(css: string, corpo: string) {
  const regras = lerRegras(css);
  document.body.innerHTML = `<div class="doc">${corpo}</div>`;
  const raiz = document.body.firstElementChild as Element;
  const memoria = new Map<Element, Record<string, string>>();

  /** O que a cascata declara para o próprio elemento (sem herança). */
  const declarado = (el: Element): Record<string, string> => {
    const guardado = memoria.get(el);
    if (guardado) return guardado;
    const venceu: Record<string, { peso: number[]; valor: string }> = {};
    const consideradas: { propriedade: string; valor: string; peso: number[] }[] = [];
    for (const r of regras) {
      let casa = false;
      try {
        casa = el.matches(r.seletor);
      } catch {
        casa = false;
      }
      if (casa) for (const [propriedade, d] of Object.entries(r.declaracoes)) consideradas.push({ propriedade, valor: d.valor, peso: [d.importante ? 1 : 0, 0, ...r.peso, r.ordem] });
    }
    const inline = el.getAttribute('style');
    if (inline) for (const [propriedade, d] of Object.entries(declaracoes(inline))) consideradas.push({ propriedade, valor: d.valor, peso: [d.importante ? 1 : 0, 1, 0, 0, 0, 0] });
    for (const c of consideradas) {
      const atual = venceu[c.propriedade];
      if (!atual || pesa(c.peso, atual.peso)) venceu[c.propriedade] = { peso: c.peso, valor: c.valor };
    }
    const saida = Object.fromEntries(Object.entries(venceu).map(([k, v]) => [k, v.valor]));
    memoria.set(el, saida);
    return saida;
  };

  const corDoTexto = (el: Element | null): string => {
    for (let e = el; e; e = e.parentElement) {
      const valor = declarado(e).color;
      if (valor === undefined || /^inherit$/i.test(valor.trim())) continue;
      const c = cor(valor);
      if (c) return c;
    }
    return '#000000';
  };
  const fundoDoTexto = (el: Element): string => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const valor = declarado(e).background;
      if (valor === undefined) continue;
      const c = cor(valor);
      if (c) return c;
    }
    return '#FFFFFF';
  };
  const oculto = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) if (declarado(e).display === 'none') return true;
    return false;
  };

  return {
    /** Os elementos do documento que casam com o seletor. */
    todos: (seletor: string) => Array.from(raiz.querySelectorAll(seletor)),
    /** O valor declarado que venceu a cascata para a propriedade neste elemento (sem herança); `undefined` = nenhum. */
    valor: (el: Element, propriedade: string) => declarado(el)[propriedade],
    /** O fundo que o texto do elemento enxerga (`#RRGGBB`; o do primeiro ancestral com fundo, ou o branco do papel). */
    fundo: fundoDoTexto,
    /** Cada texto do documento (cor herdada e fundo reais) abaixo de `minimo`:1, sem repetição. */
    textosSemContraste(minimo = 4.5): string[] {
      const problemas: string[] = [];
      for (const el of [raiz, ...Array.from(raiz.querySelectorAll('*'))]) {
        const temTexto = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
        if (!temTexto || oculto(el)) continue;
        const texto = corDoTexto(el);
        const fundo = fundoDoTexto(el);
        const razao = contraste(texto, fundo);
        if (razao < minimo) problemas.push(`${el.tagName.toLowerCase()}.${el.className}: ${texto} sobre ${fundo} = ${razao.toFixed(2)}`);
      }
      return [...new Set(problemas)];
    },
  };
}
