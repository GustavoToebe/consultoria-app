import { useEffect, useId, useRef, useState } from 'react';

import { CHAVE_DA_PREVIA, cssDaPrevia } from '../../pdf/html';
import { montarCorpo } from '../../pdf/imprimir.web';
import { useTema } from '../../tema/TemaProvider';
import type { PropsDaPrevia } from './PreviaDoDocumento';

/** Largura da folha A4 na tela: 210 mm a 96 px por polegada. */
const LARGURA_A4 = 794;

/**
 * Prévia na web (D10 de `docs/planos/documentos-pdf-motor.md`): o corpo entra pelo `montarCorpo`, o mesmo sanitizador
 * da impressão (nunca `innerHTML`), num papel com o CSS do `.doc` (`cssDaPrevia`, sem as regras globais). A folha é A4
 * contínua, reduzida por `zoom` para caber na largura. `inert`: a prévia não é clicável (D8), seus títulos não entram na
 * estrutura da tela e os links do exemplo não roubam o Tab; o nome da prévia vai no rótulo de fora (`role="img"`).
 *
 * O CSS é preso à instância (`data-previa`, `cssDaPrevia`): prévias de modelos diferentes na mesma página (a galeria) não
 * trocam de CSS. `chave` (só `[a-z0-9-]`, gerada pelo código) é opcional; sem ela, ou inválida, vale um id próprio do React.
 */
export function PreviaDoDocumento({ documento, rotulo, chave }: PropsDaPrevia) {
  const propria = `previa-${useId().replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
  const chaveDaPrevia = chave && CHAVE_DA_PREVIA.test(chave) ? chave : propria;
  const caixa = useRef<HTMLDivElement>(null);
  const papel = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const { cores } = useTema();

  useEffect(() => {
    const alvo = papel.current;
    if (!alvo) return;
    const estilo = document.createElement('style');
    estilo.textContent = cssDaPrevia(documento.css, chaveDaPrevia);
    const doc = document.createElement('div');
    doc.className = 'doc';
    doc.append(montarCorpo(documento.corpo));
    alvo.replaceChildren(estilo, doc);
  }, [documento, chaveDaPrevia]);

  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo) return;
    const medir = () => setEscala(Math.min(1, alvo.clientWidth / LARGURA_A4));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={caixa} role="img" aria-label={rotulo} style={{ width: '100%' }}>
      {/* `aria-hidden` além do `inert`: nem todo leitor de tela e ferramenta de teste trata o `inert` como oculto. */}
      {/* Contorno em `divisor`: o papel branco não some sobre o cartão claro; a largura compensa o `zoom` para ficar em 1 px. */}
      <div ref={papel} className="previa-pdf" data-previa={chaveDaPrevia} data-testid="previa-pdf" inert aria-hidden style={{ zoom: escala, margin: '0 auto', outline: `${1 / escala}px solid ${cores.divisor}` }} />
    </div>
  );
}
