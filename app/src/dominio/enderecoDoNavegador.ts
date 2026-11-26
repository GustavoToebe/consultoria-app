import { UFS } from '@plataforma/web';

/**
 * O preenchimento automático do navegador põe a "linha 1" do endereço salvo no campo da rua ("Rua Exemplo, 3420") e não
 * tem campo de número. Aqui o número é separado da rua, só quando o campo Número está vazio (o que a pessoa digitou nunca é
 * trocado) e só quando o fim do texto é, sem dúvida, o número.
 *
 * shortcut: heurística de texto, sem base de logradouros. Separa quando o fim é (1) `, 123` ou `, nº 123` (vírgula antes),
 * (2) `nº 123` / `n° 123` / `no 123` / `n.º 123` / `numero 123` / `número 123` sem vírgula, (3) `s/n`, ou (4) um número de 1 a 6
 * dígitos sem vírgula, só se sobrarem ao menos duas palavras para a rua e a palavra antes dele não for "BR", sigla de estado nem
 * "km" ("Rodovia BR 277" fica inteira). "Rua 7 de Setembro" e "Avenida 9 de Julho" não acabam em número e ficam como estão;
 * "Rua Dois 7" (nome de rua que acaba em número, sem vírgula) seria separada por engano e a pessoa corrige no campo. Trocar
 * por um parser de endereço se aparecer um caso comum que isto erre.
 */
export function separarNumeroDaRua(logradouro: string, numeroAtual: string): { logradouro: string; numero: string } {
  const intacto = { logradouro, numero: numeroAtual };
  const texto = logradouro.trim();
  if (numeroAtual.trim() || !texto) return intacto;

  const prefixo = String.raw`(?:n[º°o]|n\.º|n[uú]mero)\.?`;
  const numero = String.raw`(\d{1,6}|s\/n)`;
  const dividido = (rua: string | undefined, n: string | undefined) => {
    const limpa = rua?.trim().replace(/,$/, '').trim();
    return limpa && n ? { logradouro: limpa, numero: n.toLowerCase() } : intacto;
  };

  // Vírgula antes do número, com ou sem "nº": "Rua X, 123", "Rua X, nº 123", "Rua X, s/n".
  const comVirgula = texto.match(new RegExp(String.raw`^(.+?)\s*,\s*(?:${prefixo}\s*)?${numero}$`, 'i'));
  if (comVirgula) return dividido(comVirgula[1], comVirgula[2]);
  // "nº 123" sem vírgula: o prefixo é o que diz que é número, e precisa vir depois de espaço (não no meio de "Zeno").
  const comPrefixo = texto.match(new RegExp(String.raw`^(.+?)\s+${prefixo}\s*(\d{1,6})$`, 'i'));
  if (comPrefixo) return dividido(comPrefixo[1], comPrefixo[2]);
  // "Rua X s/n".
  const semNumero = texto.match(/^(.+?)\s+(s\/n)$/i);
  if (semNumero) return dividido(semNumero[1], semNumero[2]);

  // "Rua X 123": só com duas palavras ou mais antes sem vírgula nem " - " no texto e sem "BR", sigla de estado ou "km" colada no número.
  const palavras = texto.split(/\s+/);
  const ultima = palavras[palavras.length - 1];
  const anterior = palavras[palavras.length - 2]?.toUpperCase();
  const naoEhNumero = anterior === 'KM' || anterior === 'BR' || (UFS as readonly string[]).includes(anterior);
  // Com vírgula ou " - " no meio ("Rua X, 12 - Sala 2") o número já ficou lá atrás: o fim é complemento, não número.
  if (palavras.length >= 3 && /^\d{1,6}$/.test(ultima) && !naoEhNumero && !/,| [-–] /.test(texto)) {
    return dividido(palavras.slice(0, -1).join(' '), ultima);
  }
  return intacto;
}
