import { X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';
import { Botao } from './Botao';

/**
 * Filtros como uma etapa da folha que já está aberta (escolher exercícios no editor de treino e no Progresso por exercício;
 * `docs/planos/filtros-laterais.md`, passo 7A): a folha não empilha um painel por cima. O botão "Filtros" da
 * `BarraDeFiltros naFolha` chama `abrir`; a folha troca o título, o corpo (`corpo`) e o rodapé (`rodape`) pelos da etapa e,
 * no fim, volta à lista com a seleção e a busca como estavam. É o mesmo fluxo do painel lateral (D4 e D5): abrir copia o
 * aplicado para o rascunho; "Limpar filtros" só mexe no rascunho; "Aplicar filtros" aplica e volta; Cancelar volta sem
 * aplicar. A folha passa `aoFechar` da etapa como o dela enquanto a etapa está aberta: o X, o Esc, o fundo e o voltar
 * voltam à lista em vez de fechar a folha (nada marcado se perde).
 *
 * Foco (web): ao abrir vai ao primeiro campo ou caixa de marcar, senão à opção marcada (ou ao primeiro controle) da etapa; ao voltar, ao botão "Filtros" (dentro de
 * `barra`). Os seletores da etapa não abrem outra folha: com muitas opções, `Escolha` em chips que quebram linha.
 */
export function useEtapaDeFiltros<T>({ valor, limpo, aoAplicar, rotuloDoAplicar }: {
  valor: T; limpo: T; aoAplicar: (filtros: T) => void;
  /** Texto do botão principal a partir do rascunho ("Mostrar 18 exercícios"); sem ele, "Aplicar filtros". */
  rotuloDoAplicar?: (rascunho: T) => string;
}) {
  const [rascunho, setRascunho] = useState<{ filtros: T } | null>(null);
  const aberta = rascunho !== null;
  // Já abriu nesta folha: quem tem `autoFocus` (a busca) não pega o foco de volta ao remontar.
  const [jaAbriu, setJaAbriu] = useState(false);
  const gatilho = useRef<View>(null);
  const corpoRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !jaAbriu) return;
    const raiz = (aberta ? corpoRef.current : gatilho.current) as unknown as HTMLElement | null;
    // Busca ou chips de várias escolhas no topo (os grupos da folha de exercícios) vêm antes da opção marcada de um segmento abaixo.
    const alvo = aberta
      ? raiz?.querySelector<HTMLElement>('input, textarea, [role="checkbox"]') ?? raiz?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        ?? raiz?.querySelector<HTMLElement>('button, [role="radio"], [tabindex="0"]')
      : raiz?.querySelector<HTMLElement>('button, [role="button"]');
    alvo?.focus();
  }, [aberta, jaAbriu]);

  const fechar = () => setRascunho(null);
  const aplicar = () => {
    if (rascunho) aoAplicar(rascunho.filtros);
    setRascunho(null);
  };
  return {
    aberta,
    jaAbriu,
    rascunho: rascunho?.filtros ?? valor,
    mudar: (filtros: T) => setRascunho({ filtros }),
    abrir: () => { setJaAbriu(true); setRascunho({ filtros: valor }); },
    /** Cancelar, X, Esc, fundo e voltar: volta à lista, sem aplicar. */
    fechar,
    /** A folha fechou de vez: a próxima abertura começa na lista, sem rascunho, e a busca volta a pegar o foco. */
    reiniciar: () => { setRascunho(null); setJaAbriu(false); },
    /** Envolve a `BarraDeFiltros naFolha` para o foco voltar ao botão "Filtros". */
    barra: (filtros: ReactNode) => <View ref={gatilho} collapsable={false}>{filtros}</View>,
    corpo: (seletores: ReactNode) => <View ref={corpoRef} collapsable={false} style={estilos.corpo}>{seletores}</View>,
    rodape: (
      <>
        <Botao rotulo="Limpar filtros" tipo="fantasma" Icone={X} aoTocar={() => setRascunho({ filtros: limpo })} />
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
        <Botao rotulo={(rascunho && rotuloDoAplicar?.(rascunho.filtros)) || 'Aplicar filtros'} aoTocar={aplicar} />
      </>
    ),
  };
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(3) },
});
