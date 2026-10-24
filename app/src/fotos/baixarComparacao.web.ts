/** Web: baixa o JPEG ou o ZIP pelo navegador. O blob já veio da API; não há outro fetch. */
export async function baixarComparacao(blob: Blob, nome: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
