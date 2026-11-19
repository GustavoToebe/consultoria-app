import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { AvisoSairSemSalvar } from '../ui/GuardaDeSaida';

/**
 * Fechar uma Folha de criar ou editar (X, Cancelar, Esc, toque fora): com alteração, pergunta "Sair sem salvar?" antes;
 * sem, fecha na hora. "Sair sem salvar" chama `descartar` (que zera o rascunho e fecha); "Continuar editando" deixa tudo
 * como estava. `aviso` vai como filho da Folha, para o diálogo nascer dentro dela.
 *
 * Só na web:
 * - o painel devolve o foco a quem o tinha ao abrir, que pelo X ou pelo Cancelar é o botão: o último campo de texto da
 *   folha recebe o foco antes de o aviso abrir, e "Continuar editando" volta para ele;
 * - o Esc fecha o aviso no `keydown`, e o `keyup` do mesmo toque chega ao Modal da Folha, que pediria para fechar de novo
 *   (e o aviso reabriria): esse Esc é engolido.
 */
export function useFecharComAviso(visivel: boolean, alterado: boolean, descartar: () => void) {
  const [perguntando, setPerguntando] = useState(false);
  const perguntandoRef = useRef(false);
  const ultimoCampo = useRef<HTMLElement | null>(null);
  const engolirEsc = useRef(false);
  const perguntar = (sim: boolean) => { perguntandoRef.current = sim; setPerguntando(sim); };

  useEffect(() => {
    if (Platform.OS !== 'web' || !visivel) return;
    const guardar = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) ultimoCampo.current = e.target;
    };
    // Na captura da `window`: corre antes do diálogo (que escuta no `document`) fechar e soltar o `perguntandoRef`.
    const descer = (e: KeyboardEvent) => { if (e.key === 'Escape' && perguntandoRef.current) engolirEsc.current = true; };
    const subir = (e: KeyboardEvent) => { if (e.key === 'Escape' && engolirEsc.current) setTimeout(() => { engolirEsc.current = false; }, 0); };
    document.addEventListener('focusin', guardar);
    window.addEventListener('keydown', descer, true);
    window.addEventListener('keyup', subir, true);
    return () => {
      document.removeEventListener('focusin', guardar);
      window.removeEventListener('keydown', descer, true);
      window.removeEventListener('keyup', subir, true);
      ultimoCampo.current = null;
    };
  }, [visivel]);

  const fechar = () => {
    if (engolirEsc.current) return;
    if (!alterado) { descartar(); return; }
    if (ultimoCampo.current?.isConnected) ultimoCampo.current.focus({ preventScroll: true });
    perguntar(true);
  };

  const aviso = (
    <AvisoSairSemSalvar visivel={perguntando} aoContinuar={() => perguntar(false)}
      aoSair={() => { perguntar(false); descartar(); }} />
  );
  return { fechar, aviso };
}
