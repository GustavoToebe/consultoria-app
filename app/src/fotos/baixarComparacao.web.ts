/** Web: baixa `comparacao.jpg` pelo navegador. O blob já veio da API; não há outro fetch. */
export async function baixarComparacao(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'comparacao.jpg';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
