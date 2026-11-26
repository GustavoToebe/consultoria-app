/** Na web o PDF é baixado (ver abaixo). */
export const ROTULO_DO_PDF = 'Baixar o PDF';
export const VERBO_DO_PDF = 'Baixe';

/**
 * Web: baixa o PDF pelo navegador (Blob + link com `download`, como o CSV e o ZIP). Não abre guia nova: a política de
 * segurança do app (`object-src 'none'`, herdada pelo `blob:`) pode impedir o visualizador de PDF do navegador, e a guia
 * aberta depois de um `await` cai no bloqueio de janelas. Os bytes vêm pelo cliente da API (com o token).
 */
export async function abrirPdf(baixar: () => Promise<Blob>): Promise<void> {
  const blob = await baixar();
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'contrato.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  // shortcut: solta a URL depois de 60 s, trocar se um navegador demorar mais que isso para começar o download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
