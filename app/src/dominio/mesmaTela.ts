import type { Href } from 'expo-router';

/**
 * O destino é a tela que já está aberta. Tocar de novo (o recorde da semana dentro da própria ficha, o item do menu
 * da página atual) não sai e não passa pela guarda de saída.
 */
export function mesmaTela(atual: string, href: Href): boolean {
  const destino = caminhoDoHref(href);
  if (destino === null) return false;
  return semBarra(semConsulta(atual)) === semBarra(semConsulta(destino));
}

function caminhoDoHref(href: Href): string | null {
  if (typeof href === 'string') return href;
  if (typeof href === 'object' && href !== null && 'pathname' in href && typeof href.pathname === 'string') {
    let caminho = href.pathname;
    const params = 'params' in href && href.params && typeof href.params === 'object'
      ? href.params as Record<string, string | number | undefined>
      : null;
    if (params) {
      for (const [chave, valor] of Object.entries(params)) {
        if (valor === undefined) continue;
        caminho = caminho.replaceAll(`[${chave}]`, String(valor)).replaceAll(`[...${chave}]`, String(valor));
      }
    }
    if (caminho.includes('[')) return null;
    return caminho;
  }
  return null;
}

function semConsulta(caminho: string): string {
  return caminho.split('?')[0].split('#')[0];
}

function semBarra(caminho: string): string {
  return caminho.length > 1 && caminho.endsWith('/') ? caminho.slice(0, -1) : caminho;
}
