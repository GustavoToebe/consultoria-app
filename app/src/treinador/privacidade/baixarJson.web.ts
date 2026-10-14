/** Web: baixa o arquivo pelo navegador (Blob + link com `download`). */
export async function baixarJson(nome: string, texto: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
