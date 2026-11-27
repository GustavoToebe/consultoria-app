import { SlidersHorizontal, X } from 'lucide-react-native';
import { type ComponentProps, createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type TextInputProps } from 'react-native';

import { resultadoDoAplicar } from '../dominio/painelDeFiltros';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../tema/tokens';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { MensagemErro } from './Estados';
import { Folha } from './Folha';
import { depoisDeFecharAsFolhas } from './historicoDasFolhas';
import { sobre } from './sobre';
import { Texto } from './Texto';

export interface ChipDaBarra {
  chave: string;
  /** "Acesso: Sem acesso". */
  texto: string;
}

interface Props<T> {
  /**
   * Campo de busca (sempre à vista). Sem ele, a barra é só o botão "Filtros" (lista sem busca útil na API). `inputMode`
   * "search" faz dele um `searchbox` para o leitor de tela (o mural, que já era assim).
   */
  busca?: {
    valor: string; aoMudar: (texto: string) => void; rotulo?: string; placeholder?: string; inputMode?: TextInputProps['inputMode'];
    /** Mais propriedades do campo (a folha "Escolher exercício": teclas ↑↓ e Enter, `aria-activedescendant`, foco ao abrir). */
    campo?: Omit<ComponentProps<typeof Campo>, 'rotulo' | 'valor' | 'aoMudar' | 'placeholder' | 'inputMode'>;
  };
  /** Os filtros em vigor. */
  valor: T;
  /** Grava os filtros aplicados (ex.: no endereço), depois que o painel fecha e o histórico assenta. */
  aoAplicar: (filtros: T) => void;
  /** Os filtros de "nada filtrado": o "Limpar filtros". */
  limpo: T;
  /** Um chip por filtro ligado (fora a busca); o número do botão "Filtros" é quantos são. */
  chips: readonly ChipDaBarra[];
  /** ✕ do chip: tira só aquele filtro. */
  aoTirar: (chave: string) => void;
  /** Os seletores do painel, numa coluna agrupada por `GrupoDoPainel` (`SelecaoMultiplaSuspensa` para várias, `Escolha` para uma). */
  seletores: (filtros: T, aoMudar: (filtros: T) => void) => ReactNode;
  /** O painel lateral: título "Filtros de <assunto>" (nome do diálogo). */
  painelLateral: { titulo: string };
  /**
   * A barra mora dentro de uma folha (escolher exercícios): os filtros são uma etapa dessa folha (`ui/EtapaDeFiltros`), sem
   * painel empilhado por cima. O botão só chama `abrir`; o rascunho e o rodapé são da etapa.
   */
  naFolha?: { abrir: () => void };
  /**
   * Na mesma linha do botão "Filtros": `antes` à esquerda, ocupando o que sobra (a barra do calendário da Agenda), e `depois`
   * logo depois dele (o segmento da visão). As etiquetas "Filtrando" continuam embaixo da linha inteira.
   */
  antes?: ReactNode;
  depois?: ReactNode;
  /** Texto do botão principal do painel a partir do rascunho ("Mostrar 18 exercícios"); sem ele, "Aplicar filtros". */
  rotuloDoAplicar?: (rascunho: T) => string;
  /** O painel lateral abriu (a Biblioteca só busca a lista inteira, para as contagens, quando alguém abre os filtros). */
  aoAbrirPainel?: () => void;
}

/** Campos com problema dentro do painel lateral: quem tem erro se registra, o "Aplicar filtros" soma. */
interface Problemas { registrar: (id: string, quantos: number) => void; mostrar: boolean }
const ProblemasDoPainel = createContext<Problemas | null>(null);

/**
 * Para um seletor do painel lateral dizer quantos campos dele estão errados agora (data pela metade, Até antes de De).
 * `mostrar` diz se é hora de marcar o erro no campo (depois do primeiro "Aplicar filtros"). Fora do painel lateral não
 * faz nada (`noPainel` falso).
 */
export function useProblemaNoPainel(quantos: number): { noPainel: boolean; mostrar: boolean } {
  const ctx = useContext(ProblemasDoPainel);
  const id = useId();
  useEffect(() => { ctx?.registrar(id, quantos); }, [ctx, id, quantos]);
  useEffect(() => () => ctx?.registrar(id, 0), [ctx, id]);
  return { noPainel: !!ctx, mostrar: !!ctx?.mostrar };
}

/** Grupo do painel lateral (Identificação, Situação, Datas…): título de seção e um divisor entre grupos, sem cartão. */
export function GrupoDoPainel({ titulo, children, primeiro }: { titulo: string; children: ReactNode; primeiro?: boolean }) {
  const { cores } = useTema();
  return (
    <View role="group" aria-label={titulo} style={[estilos.grupo, !primeiro && [estilos.grupoSeguinte, { borderTopColor: cores.divisor }]]}>
      <Texto variante="secao" nivel={3}>{titulo}</Texto>
      {children}
    </View>
  );
}

/** Texto do botão de filtros para o leitor de tela: o rótulo visível e quantos estão ligados. */
export function rotuloDoBotaoDeFiltros(quantos: number, rotulo = 'Filtros'): string {
  if (quantos === 0) return `${rotulo}, nenhum ligado`;
  return `${rotulo}, ${quantos} ${quantos === 1 ? 'ligado' : 'ligados'}`;
}

/**
 * Barra de filtros das listas (`docs/planos/filtros-laterais.md`): o campo de busca e o botão "Filtros" com o número de
 * filtros ligados, que abre o painel lateral (rascunho; Aplicar valida e aplica de uma vez). Embaixo, numa linha só:
 * "Filtrando:", um chip por filtro (o ✕ tira aquele, na hora) e o link "Limpar filtros" (tira todos, a busca fica). Quem usa
 * decide os seletores e o que cada chip significa.
 *
 * O Aplicar grava depois de o histórico assentar (`depoisDeFecharAsFolhas`): gravar no endereço com a Folha aberta cairia
 * na entrada de histórico dela e o fechar desfaria a escolha. Enquanto essa gravação não sai, o botão não reabre o painel
 * (B3): o rascunho copiaria o valor antigo e a gravação atrasada cairia na entrada da folha nova. Se a tela sai antes de a
 * gravação correr (saída confirmada de um editor com a guarda ativa), ela é descartada: o `setParams` cairia na rota nova.
 */
export function BarraDeFiltros<T>({ busca, valor, aoAplicar, limpo, chips, aoTirar, seletores, painelLateral, naFolha, antes, depois, rotuloDoAplicar, aoAbrirPainel }: Props<T>) {
  const { cores } = useTema();
  // O que foi escolhido e ainda não foi aplicado; `null` = painel fechado.
  const [rascunho, setRascunho] = useState<{ filtros: T } | null>(null);
  const aplicando = useRef(false);
  // A gravação atrasada do Aplicar só vale com a barra ainda na tela.
  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => { montada.current = false; aplicando.current = false; };
  }, []);
  const aberto = rascunho !== null;
  const quantos = chips.length;
  const abrir = () => {
    // Aplicação ainda a caminho (dura o voltar do histórico, uns milissegundos): o toque não abre com o valor velho.
    if (aplicando.current) return;
    if (naFolha) { naFolha.abrir(); return; }
    setRascunho({ filtros: valor });
    aoAbrirPainel?.();
  };
  const aplicar = (filtros: T) => {
    setRascunho(null);
    aplicando.current = true;
    depoisDeFecharAsFolhas(() => {
      try { if (montada.current) aoAplicar(filtros); } finally { aplicando.current = false; }
    });
  };

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.linha, antes ? estilos.linhaComAntes : null]}>
        {antes ? <View style={estilos.antes}>{antes}</View> : null}
        {busca ? (
          <View style={estilos.busca}>
            <Campo rotulo={busca.rotulo ?? 'Buscar'} valor={busca.valor} aoMudar={busca.aoMudar} placeholder={busca.placeholder} inputMode={busca.inputMode}
              autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" enterKeyHint="search" {...busca.campo} />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rotuloDoBotaoDeFiltros(quantos)}
          accessibilityState={{ expanded: aberto }}
          aria-expanded={aberto}
          aria-haspopup={naFolha ? undefined : 'dialog'}
          onPress={abrir}
          style={(e) => [estilos.filtros, { borderColor: cores.bordaCampo, backgroundColor: aberto ? cores.superficie3 : sobre(e) ? cores.superficie2 : 'transparent' }]}>
          <SlidersHorizontal size={18} color={cores.texto} strokeWidth={2} />
          <Texto style={estilos.rotuloFiltros} cor={cores.texto}>Filtros</Texto>
          {/* Contagem neutra: `superficie3` com o botão fechado; aberto (o botão já é `superficie3`), o cartão. */}
          {quantos > 0 ? (
            <View style={[estilos.contagem, { backgroundColor: aberto ? cores.superficie : cores.superficie3 }]}>
              <Texto variante="pequeno" numerico cor={cores.texto} style={estilos.numero}>{String(quantos)}</Texto>
            </View>
          ) : null}
        </Pressable>
        {depois}
      </View>
      {/* Montado só aberto: cada abertura começa sem erro à vista. */}
      {rascunho ? (
        <PainelLateral titulo={painelLateral.titulo} rascunho={rascunho.filtros} limpo={limpo}
          aoMudar={(filtros) => setRascunho({ filtros })} seletores={seletores} rotuloDoAplicar={rotuloDoAplicar}
          aoDescartar={() => setRascunho(null)} aoAplicar={aplicar} />
      ) : null}
      {quantos > 0 ? (
        <View style={estilos.filtrado}>
          <Texto variante="suave">Filtrando:</Texto>
          <View style={[estilos.filtrado, estilos.chipsAtivos]} role="group" aria-label="Filtros aplicados">
            {chips.map((c) => (
              <Pressable
                key={c.chave}
                accessibilityRole="button"
                accessibilityLabel={`Tirar filtro: ${c.texto}`}
                onPress={() => aoTirar(c.chave)}
                style={(e) => [estilos.chip, { borderColor: cores.bordaCampo, backgroundColor: sobre(e) ? cores.superficie3 : cores.superficie2 }]}>
                <Texto variante="pequeno" cor={cores.texto} style={estilos.textoDoChip}>{c.texto}</Texto>
                <X size={14} color={cores.texto} strokeWidth={2.5} />
              </Pressable>
            ))}
          </View>
          {/* Nome próprio (com o texto visível no começo): a lista vazia também oferece um "Limpar filtros". */}
          <Botao rotulo="Limpar filtros" rotuloAcessivel="Limpar filtros aplicados" tipo="fantasma" aoTocar={() => aoAplicar(limpo)} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * O painel lateral: `Folha lateral` (direita no PC, folha de baixo no celular) com o rascunho. X, Esc, fundo, arrastar e o
 * voltar do navegador descartam (`aoFechar` da Folha); "Limpar filtros" só volta o rascunho ao limpo; "Aplicar filtros"
 * confere os campos e, sem problema, aplica tudo de uma vez.
 */
function PainelLateral<T>({ titulo, rascunho, limpo, aoMudar, seletores, aoDescartar, aoAplicar, rotuloDoAplicar }: {
  titulo: string; rascunho: T; limpo: T; aoMudar: (filtros: T) => void; rotuloDoAplicar?: (rascunho: T) => string;
  seletores: (filtros: T, aoMudar: (filtros: T) => void) => ReactNode; aoDescartar: () => void; aoAplicar: (filtros: T) => void;
}) {
  // Trocar a chave remonta os seletores: o "Limpar filtros" também apaga a data digitada pela metade e o modo escolhido.
  const [versao, setVersao] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const [problemas, setProblemas] = useState<Readonly<Record<string, number>>>({});
  const registrar = useCallback((id: string, quantos: number) => setProblemas((p) => {
    if ((p[id] ?? 0) === quantos) return p;
    const novo = { ...p };
    if (quantos > 0) novo[id] = quantos; else delete novo[id];
    return novo;
  }), []);
  const mostrar = tentativa > 0;
  const contexto = useMemo(() => ({ registrar, mostrar }), [registrar, mostrar]);
  const total = Object.values(problemas).reduce((a, b) => a + b, 0);
  // Depois do primeiro "Aplicar filtros", a frase do rodapé acompanha os campos e some quando ficam certos.
  const resultado = resultadoDoAplicar(total);
  const mensagem = mostrar && !resultado.ok ? resultado.mensagem : null;
  // O foco vai ao primeiro campo marcado (web), para a pessoa corrigir sem procurar.
  useEffect(() => {
    if (tentativa === 0 || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const dialogo = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((d) => d.getAttribute('aria-label') === titulo);
    const campo = dialogo?.querySelector<HTMLElement>('[aria-invalid="true"]');
    campo?.focus();
    // Centralizado, a mensagem embaixo do campo não fica sob o rodapé fixo.
    campo?.scrollIntoView?.({ block: 'center' });
  }, [tentativa, titulo]);
  const aplicar = () => {
    if (resultado.ok) aoAplicar(rascunho);
    else setTentativa((n) => n + 1);
  };
  const limpar = () => { aoMudar(limpo); setVersao((v) => v + 1); setTentativa(0); };
  return (
    <Folha visivel lateral titulo={titulo} aoFechar={aoDescartar}
      statusDoRodape={mensagem ? <MensagemErro texto={mensagem} /> : undefined}
      rodape={<>
        <Botao rotulo="Limpar filtros" tipo="fantasma" Icone={X} aoTocar={limpar} />
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoDescartar} />
        <Botao rotulo={rotuloDoAplicar?.(rascunho) ?? 'Aplicar filtros'} aoTocar={aplicar} />
      </>}>
      <ProblemasDoPainel.Provider value={contexto}>
        <View key={versao} style={estilos.coluna}>{seletores(rascunho, aoMudar)}</View>
      </ProblemasDoPainel.Provider>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(1.5), rowGap: espaco(1) },
  busca: { flexGrow: 1, flexShrink: 1, flexBasis: 240, maxWidth: 480 },
  linhaComAntes: { alignItems: 'center' },
  antes: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  filtros: {
    minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5),
    borderWidth: 1, borderRadius: RAIO_CONTROLE,
  },
  rotuloFiltros: { fontFamily: fontes.semi },
  contagem: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  numero: { fontFamily: fontes.semi },
  filtrado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  // Os chips seguem a frase na mesma linha e só quebram quando não cabem.
  chipsAtivos: { flexShrink: 1, maxWidth: '100%' },
  chip: {
    minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingHorizontal: espaco(1.25),
    borderWidth: 1, borderRadius: RAIO_CONTROLE, maxWidth: '100%',
  },
  textoDoChip: { flexShrink: 1 },
  // Painel lateral: uma coluna, grupos separados por um divisor (sem cartão dentro do painel).
  coluna: { gap: espaco(3) },
  grupo: { gap: espaco(2) },
  grupoSeguinte: { borderTopWidth: 1, paddingTop: espaco(3) },
});
