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

/** Prazo total para as imagens do documento; passado dele, imprime com o que carregou. */
export const LIMITE_IMAGENS_MS = 5000;

/** O que a espera usa de uma `<img>` (facilita o teste sem DOM). */
export interface ImagemParaEsperar {
  complete: boolean;
  addEventListener: (tipo: 'load' | 'error', ouvinte: () => void, opcoes: { once: true }) => void;
}

function esperarImagens(raiz: HTMLElement): Promise<void> {
  return esperarImagensTerminarem([...raiz.querySelectorAll('img')]);
}

/**
 * Espera cada imagem ainda pendente terminar: `load` ou `error` (imagem quebrada conta como terminada, senão a
 * impressão ficaria pendurada), com limite total de {@link LIMITE_IMAGENS_MS}. Imagem já `complete` é ignorada.
 */
export async function esperarImagensTerminarem(imagens: readonly ImagemParaEsperar[], limiteMs = LIMITE_IMAGENS_MS): Promise<void> {
  const pendentes = imagens.filter((i) => !i.complete);
  if (pendentes.length === 0) return;
  const terminadas = Promise.all(
    pendentes.map(
      (i) =>
        new Promise<void>((ok) => {
          i.addEventListener('load', () => ok(), { once: true });
          i.addEventListener('error', () => ok(), { once: true });
        }),
    ),
  );
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<void>((ok) => {
    relogio = setTimeout(ok, limiteMs);
  });
  try {
    await Promise.race([terminadas, prazo]);
  } finally {
    clearTimeout(relogio);
  }
}
