/** Web: baixa o arquivo pelo navegador (Blob + link com `download`). O BOM (que a leitura da resposta descarta) volta aqui para o Excel abrir os acentos. */
export async function baixarCsv(nome: string, texto: string): Promise<void> {
  const url = URL.createObjectURL(new Blob(['\uFEFF', texto], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
