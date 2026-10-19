/**
 * O link do convite do aluno leva o código no fragmento (`/convite#codigo=XYZ`): o fragmento não vai ao servidor, ao
 * log de acesso nem ao Referer, e a tela o tira do endereço logo depois de ler.
 */
export function codigoDoFragmento(fragmento: string): string {
  return (new URLSearchParams(fragmento.replace(/^#/, '')).get('codigo') ?? '').trim();
}
