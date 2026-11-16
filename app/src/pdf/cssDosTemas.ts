import { textoSobre } from '../tema/tokens';
import type { TemaPdf } from './temas';

/**
 * Regras que cada tema acrescenta ao `.doc` clássico (`cssDoDoc`, em `pdf/html.ts`). O HTML é o mesmo nos três temas:
 * quem muda é só o CSS, que vem daqui e nunca de texto do usuário. `marca` é a cor já validada (`corDaMarca`) e
 * `marcaTexto` a mesma cor escurecida até 4,5:1 sobre o branco (`corDeTextoDaMarca`); texto sobre a cor da marca usa
 * `textoSobre(marca)`; o cabeçalho de tabela sobre o cinza leve tem texto neutro escuro. Nada de cor crua em texto.
 */

/** Fundo leve do cabeçalho de tabela do `MARCANTE` (também usado nas tabelas escuras da dieta nesse tema). */
export const FUNDO_LEVE = '#F3F4F6';
/** Borda suave dos cartões do `MARCANTE`. */
export const BORDA_SUAVE = '#DCDEE3';

/** Linha neutra sob o cabeçalho de tabela do `MINIMALISTA`: a cor da marca fica só no título de seção, no topo e no rodapé. */
const DIVISORIA_NEUTRA = '#C8C8C8';

/**
 * `CLASSICO` não acrescenta nada: o CSS dele é o de sempre, caractere por caractere. Nos outros, cor contida (a marca é
 * sinal, não fundo de tudo): o `MINIMALISTA` usa a marca numa linha fina por seção, e o `MARCANTE` só no topo cheio e no
 * texto dos títulos; dentro dos cartões, linhas e cabeçalhos de tabela são neutros.
 */
export function cssDoTema(tema: TemaPdf, marca: string, marcaTexto: string): string {
  if (tema === 'MINIMALISTA') {
    // A faixa traz o fundo e a cor no atributo `style` (`faixaDaMarca`): o `!important` é o que a deixa limpa sem mudar o HTML.
    return `.doc h1 { font-weight: 600; letter-spacing: 2px; color: #111; }
.doc h2 { font-weight: 600; color: #111; border-bottom: 1px solid ${marca}; }
.doc .faixa-marca { background: transparent !important; color: ${marcaTexto} !important; padding: 0 0 3pt; margin-bottom: 6pt; }
.doc .faixa-marca.com-logo { padding: 0 0 3pt; }
.doc .topo { border-bottom: 1px solid ${marca}; }
.doc th { background: transparent; color: #333; font-weight: 600; border-bottom: 1px solid ${DIVISORIA_NEUTRA}; }
.doc td { border-bottom: 1px solid #e6e6e6; }
.doc .rodape { border-top: 1px solid ${marca}; }
`;
  }
  if (tema === 'MARCANTE') {
    const sobreMarca = textoSobre(marca);
    return `.doc .faixa-marca { margin: 0; padding: 7pt 12pt 2pt; border-radius: 6pt 6pt 0 0; font-size: 8.5pt; }
.doc .faixa-marca.com-logo { padding: 7pt 12pt 2pt; }
.doc .topo { background: ${marca}; color: ${sobreMarca}; border-bottom: 0; border-radius: 0 0 6pt 6pt; padding: 4pt 12pt 10pt; margin-bottom: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.doc .topo h1, .doc .topo .pequeno { color: ${sobreMarca}; }
.doc > .bloco, .doc > section, .doc > .refeicao, .doc > .lista-pdf { border: 1px solid ${BORDA_SUAVE}; border-radius: 6pt; padding: 8pt 10pt; margin: 8pt 0; }
.doc > .bloco > h2:first-child, .doc > section > h2:first-child { margin-top: 0; }
.doc h2 { border-bottom: 1px solid ${BORDA_SUAVE}; }
.doc th { background: ${FUNDO_LEVE}; color: #333; border-bottom: 1px solid ${BORDA_SUAVE}; }
`;
  }
  return '';
}
