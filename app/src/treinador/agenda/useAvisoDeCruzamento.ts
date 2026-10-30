import { useEffect, useRef, useState } from 'react';

import type { CruzamentoDeEvento, CruzamentoRequest } from '../../api/agendaTipos';
import { cruzamentosDoEvento } from '../../api/rotas';

/** Espera depois da última mudança no horário ou na repetição antes de perguntar à API. */
export const ESPERA_DO_AVISO_DE_CRUZAMENTO_MS = 400;

/**
 * A resposta de `POST /agenda/eventos/cruzamentos` para a pergunta atual (só aviso, P5: nunca impede nem atrasa o salvar).
 * Sem pergunta (horário incompleto, dia inteiro, fora do formulário) ou sem conexão, não pergunta. Pergunta 400 ms depois da
 * última mudança; a resposta só vale para a pergunta que a pediu (a chave), então uma resposta atrasada não troca a da
 * pergunta nova e, mudando a pergunta, o aviso antigo some na hora. Falha da rota: sem aviso e sem erro, em silêncio.
 */
export function useAvisoDeCruzamento(pergunta: CruzamentoRequest | null, offline: boolean): CruzamentoDeEvento | null {
  const chave = pergunta && !offline ? JSON.stringify(pergunta) : null;
  const [resultado, setResultado] = useState<{ chave: string; resposta: CruzamentoDeEvento } | null>(null);
  // Número da pergunta em curso: trocar a pergunta ou fechar a folha o muda, e a resposta de uma antiga é descartada.
  const vez = useRef(0);

  useEffect(() => {
    if (!chave) return;
    const id = ++vez.current;
    const corpo = JSON.parse(chave) as CruzamentoRequest;
    const relogio = setTimeout(() => {
      cruzamentosDoEvento(corpo).then(
        (resposta) => { if (vez.current === id) setResultado({ chave, resposta }); },
        () => undefined,
      );
    }, ESPERA_DO_AVISO_DE_CRUZAMENTO_MS);
    return () => {
      clearTimeout(relogio);
      vez.current += 1;
    };
  }, [chave]);

  return chave && resultado?.chave === chave ? resultado.resposta : null;
}
