import { useCallback, useEffect, useRef, useState } from 'react';

const ESPERA_MS = 1500;

/**
 * Salva sozinho 1,5 s depois da última mudança e envia na hora quando a tela é fechada (mesma regra do
 * `usePlanoEditor`, para editores simples de um formulário só). `valido` falso segura o envio; o valor de partida não
 * é enviado. Uma falha fica em `erro` até a próxima mudança ou `salvarAgora`.
 */
export function useAutosalvar<T>(valor: T, valido: boolean, salvar: (valor: T) => Promise<void>) {
  const chave = JSON.stringify(valor);
  const salvoRef = useRef<string | null>(chave);
  const atualRef = useRef({ valor, valido, chave });
  const salvarRef = useRef(salvar);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  useEffect(() => {
    atualRef.current = { valor, valido, chave };
    salvarRef.current = salvar;
  });

  const salvarAgora = useCallback(async () => {
    const { valor: v, valido: ok, chave: k } = atualRef.current;
    if (!ok || k === salvoRef.current) return;
    salvoRef.current = k;
    setSalvando(true);
    setErro(null);
    try {
      await salvarRef.current(v);
    } catch (e) {
      salvoRef.current = null; // a próxima mudança (ou "salvar agora") tenta de novo
      setErro(e);
    } finally {
      setSalvando(false);
    }
  }, []);

  useEffect(() => {
    if (!valido || chave === salvoRef.current) return;
    const relogio = setTimeout(() => void salvarAgora(), ESPERA_MS);
    return () => clearTimeout(relogio);
  }, [chave, valido, salvarAgora]);

  // Saiu da tela com mudança pendente: envia na hora.
  useEffect(() => () => void salvarAgora(), [salvarAgora]);

  return { salvando, erro, salvarAgora };
}
