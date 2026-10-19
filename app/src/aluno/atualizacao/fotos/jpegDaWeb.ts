/**
 * Arquivo da foto a partir do base64 que o `expo-image-manipulator` devolve na web. A CSP de produção tem
 * `connect-src 'self'`: um `fetch` do `blob:` ou `data:` da foto reduzida falha ("Failed to fetch", visto em 19/10), e
 * abrir a CSP para isso deixaria o app mais permissivo. Montar o `Blob` aqui não passa pela rede. Aceita o base64 com ou
 * sem o prefixo `data:...;base64,`.
 */
export function blobDeBase64(base64: string, tipo = 'image/jpeg'): Blob {
  const binario = atob(base64.replace(/^data:[^,]*,/, ''));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}
