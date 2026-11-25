/**
 * Fonte mono só em número (25/11): separa um texto em partes, as numéricas (com a fonte mono) e as de palavras (Geist).
 * Token numérico = dígitos com separadores comuns ("1.234,56", "12:30", "11/2026", "10-12", "3x12"), horas com "h" ("14h",
 * "14h30"), com o "R$" colado, "+", "−" ou "-" na frente e "%", "x", "º" ou "ª" depois. O "-" ASCII só é sinal quando não
 * vem colado a letra ou dígito ("-2 kg" sim, "COVID-19" não). Unidade solta ("kg", "min") e o resto ficam em palavras.
 */
export interface ParteDoTexto {
  texto: string;
  numerico: boolean;
}

const NUMERO = /[+−-]?(?:R\$\s?)?(?:\d{1,2}h(?:\d{2})?(?![A-Za-zÀ-ÿ\d])|\d+(?:[.,:/x×–-]\d+)*(?:[%x×ºª](?![A-Za-zÀ-ÿ\d]))?)/g;
const LETRA = /[A-Za-zÀ-ÿ]/;
const COLADO = /[A-Za-zÀ-ÿ\d]/;

/**
 * `null` quando o texto não tem palavra (só números, símbolos ou "—"): a peça segue como antes, tudo em mono. Sem número
 * e com palavra devolve uma parte só, de palavras.
 */
export function partirNumeros(texto: string): ParteDoTexto[] | null {
  const partes: ParteDoTexto[] = [];
  let desde = 0;
  let resto = '';
  for (const achado of texto.matchAll(NUMERO)) {
    let inicio = achado.index ?? 0;
    let token = achado[0];
    // Sem lookbehind (Hermes): o "-" ASCII colado a letra ou dígito antes não é sinal, é hífen, e fica em palavras.
    if (token[0] === '-' && inicio > 0 && COLADO.test(texto[inicio - 1])) { inicio += 1; token = token.slice(1); }
    if (inicio > desde) {
      partes.push({ texto: texto.slice(desde, inicio), numerico: false });
      resto += texto.slice(desde, inicio);
    }
    partes.push({ texto: token, numerico: true });
    desde = inicio + token.length;
  }
  if (desde < texto.length) {
    partes.push({ texto: texto.slice(desde), numerico: false });
    resto += texto.slice(desde);
  }
  return LETRA.test(resto) ? partes : null;
}

export type ParteDoFilho = ParteDoTexto | { elemento: unknown };

/**
 * Os filhos de um `Texto` em partes: texto seguido (string, número, `{n} cobranças`) é dividido por `partirNumeros` e
 * elemento React passa como está. `null` quando nenhum trecho tem palavra: a peça segue como antes, tudo em mono.
 */
export function partirFilhos(filhos: unknown): ParteDoFilho[] | null {
  const lista = Array.isArray(filhos) ? filhos : [filhos];
  const partes: ParteDoFilho[] = [];
  let seguido = '';
  let comPalavra = false;
  const fechar = () => {
    if (!seguido) return;
    const trecho = partirNumeros(seguido);
    comPalavra ||= trecho !== null;
    partes.push(...(trecho ?? [{ texto: seguido, numerico: true }]));
    seguido = '';
  };
  for (const f of lista) {
    if (typeof f === 'string' || typeof f === 'number') seguido += f;
    else if (f !== null && f !== undefined && typeof f !== 'boolean') {
      fechar();
      partes.push({ elemento: f });
    }
  }
  fechar();
  return comPalavra ? partes : null;
}
