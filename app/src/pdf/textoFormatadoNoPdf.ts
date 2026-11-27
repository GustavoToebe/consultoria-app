import { linhaFormatada } from '../dominio/textoFormatado';
import { esc } from './html';

/**
 * Texto do treinador (`**negrito**`, `__sublinhado__`, quebras de linha) em HTML do PDF, linha a linha como o `escLinhas`:
 * cada `\n` vira `<br>` (linhas em branco inclusive), então o texto sem marcas sai igual ao de antes. Todo trecho passa
 * por `esc()` antes de ganhar a tag; a gramática é a de `dominio/textoFormatado`.
 */
export function htmlFormatadoNoPdf(texto: string | null | undefined): string {
  return (texto ?? '')
    .split(/\r?\n/)
    .map((linha) => linhaFormatada(linha)
      .map((t) => {
        let html = esc(t.texto);
        if (t.sublinhado) html = `<u>${html}</u>`;
        if (t.negrito) html = `<strong>${html}</strong>`;
        return html;
      })
      .join(''))
    .join('<br>');
}
