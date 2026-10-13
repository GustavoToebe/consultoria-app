import type { Documento } from './html';

const ID = 'treinos-impressao';

/**
 * Web: o documento entra num bloco só de impressão dentro da própria página e o navegador abre "Imprimir / Salvar
 * como PDF". Sem iframe (a CSP do Caddy bloqueia `frame-src`) e sem `Print.printAsync`, que imprime a tela atual.
 */
export async function imprimir(d: Documento): Promise<void> {
  document.getElementById(ID)?.remove();
  const bloco = document.createElement('div');
  bloco.id = ID;
  const estilo = document.createElement('style');
  estilo.textContent = `${d.css}
#${ID} { display: none; color-scheme: light; }
@media print {
  body > *:not(#${ID}) { display: none !important; }
  #${ID} { display: block; }
}`;
  const conteudo = document.createElement('div');
  conteudo.className = 'doc';
  // O HTML foi montado com esc() em todo texto do usuário (pdf/html.ts).
  conteudo.innerHTML = d.corpo;
  bloco.append(estilo, conteudo);
  document.body.append(bloco);

  const tituloAnterior = document.title;
  document.title = d.titulo; // vira o nome sugerido do arquivo ao salvar como PDF
  await esperarImagens(conteudo);
  const limpar = () => {
    document.title = tituloAnterior;
    bloco.remove();
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  window.print();
}

function esperarImagens(raiz: HTMLElement): Promise<void> {
  const imagens = [...raiz.querySelectorAll('img')].filter((i) => !i.complete);
  return Promise.all(imagens.map((i) => new Promise<void>((ok) => i.addEventListener('load', () => ok(), { once: true })))).then(
    () => undefined,
  );
}
