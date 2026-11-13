import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { resultadoDoAplicar } from '../dominio/painelDeFiltros';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO_CONTROLE } from '../tema/tokens';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { Cartao } from './Cartao';
import { MensagemErro } from './Estados';
import { FaixaDeChips } from './FaixaDeChips';
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
  /** Campo de busca (sempre à vista). Sem ele, a barra é só o botão "Filtros" (lista sem busca útil na API). */
  busca?: { valor: string; aoMudar: (texto: string) => void; rotulo?: string; placeholder?: string };
  /** Os filtros em vigor. */
  valor: T;
  /** Grava os filtros escolhidos (ex.: no endereço). No celular só quando a folha fecha (ver abaixo). */
  aoAplicar: (filtros: T) => void;
  /** Os filtros de "nada filtrado": o "Limpar filtros". */
  limpo: T;
  /** Um chip por filtro ligado (fora a busca); o número do botão "Filtros" é quantos são. */
  chips: readonly ChipDaBarra[];
  /** ✕ do chip: tira só aquele filtro. */
  aoTirar: (chave: string) => void;
  /** Os seletores do painel "Filtros avançados" (`SelecaoMultiplaSuspensa` para várias opções, `Escolha` para uma). */
  seletores: (filtros: T, aoMudar: (filtros: T) => void) => ReactNode;
  /** Título do painel no PC; padrão "Filtros avançados". No celular a folha se chama "Filtros". */
  tituloDoPainel?: string;
  /** Texto do botão que fecha a folha no celular ("Ver alunos"). */
  rotuloDoResultado?: string;
  /** Texto do botão que abre o painel; padrão "Filtros" ("Mais filtros" quando há `atalhos` ao lado). */
  rotuloDoBotao?: string;
  /**
   * Chips rápidos (um `Escolha chips`, por exemplo) entre a busca e o botão. Ficam com o botão numa faixa que rola de lado
   * no celular (`FaixaDeChips`), embaixo da busca, para a lista começar cedo.
   */
  atalhos?: ReactNode;
  /**
   * Painel lateral (`docs/planos/filtros-laterais.md`): o botão abre um painel modal "Filtros de <assunto>" com rascunho
   * nas duas larguras, rodapé Limpar filtros · Cancelar · Aplicar filtros e validação no Aplicar. Os seletores vêm numa
   * coluna, agrupados por `GrupoDoPainel`.
   * shortcut: o modo antigo (cartão no PC com efeito na hora, folha do celular que aplica ao fechar) fica para as telas
   * ainda não migradas; sai junto com esta prop quando todas migrarem (passos 4 e 5 do plano).
   */
  painelLateral?: { titulo: string };
}

/** Campos com problema dentro do painel lateral: quem tem erro se registra, o "Aplicar filtros" soma. */
interface Problemas { registrar: (id: string, quantos: number) => void; mostrar: boolean }
const ProblemasDoPainel = createContext<Problemas | null>(null);

/**
 * Para um seletor do painel lateral dizer quantos campos dele estão errados agora (data pela metade, Até antes de De).
 * `mostrar` diz se é hora de marcar o erro no campo (depois do primeiro "Aplicar filtros"). Fora do painel lateral não
 * faz nada (`noPainel` falso): a tela segue com o comportamento de antes.
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
 * Barra de filtros das listas (padrão da Central: busca + botão de filtros que abre os filtros avançados). Linha de
 * cima: o campo de busca, os `atalhos` (se houver) e o botão "Filtros" com o número de filtros ligados. No PC
 * (janela ≥ 768) o botão abre e fecha um cartão "Filtros avançados" logo abaixo, com os seletores em grade; no celular
 * abre uma `Folha` "Filtros". Embaixo, numa linha só: "Filtrando:", um chip por filtro (o ✕ tira aquele) e
 * "• Limpar filtros" (guia de 11/11, pág. 7). Serve a todas as listas do treinador (`docs/planos/filtros-nas-listas.md`):
 * quem usa decide os seletores e o que cada chip significa.
 *
 * No PC cada escolha vale na hora (a de um seletor que abre a própria Folha, como `EscolhaEmFolha`, quando ela fecha, pelo
 * mesmo motivo do celular). Na folha do celular as escolhas ficam num rascunho e só são gravadas quando ela fecha
 * (X, tocar fora ou "Ver resultado"), depois do histórico assentar (`depoisDeFecharAsFolhas`): gravar no endereço com a
 * Folha aberta cairia na entrada de histórico dela e o fechar desfaria a escolha.
 */
export function BarraDeFiltros<T>({ busca, valor, aoAplicar, limpo, chips, aoTirar, seletores, tituloDoPainel = 'Filtros avançados', rotuloDoResultado = 'Ver resultado', rotuloDoBotao = 'Filtros', atalhos, painelLateral }: Props<T>) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const [aberto, setAberto] = useState(false);
  // Na folha: o que foi escolhido e ainda não foi gravado.
  const [rascunho, setRascunho] = useState<{ filtros: T } | null>(null);
  const emFolha = width < LARGURA_MENU_LATERAL;
  const quantos = chips.length;
  const Seta = aberto ? ChevronUp : ChevronDown;
  const alternar = () => {
    if (emFolha || painelLateral) {
      setRascunho({ filtros: valor });
      setAberto(true);
    } else {
      setAberto((v) => !v);
    }
  };
  const fecharFolha = () => {
    const escolhido = rascunho;
    setAberto(false);
    setRascunho(null);
    if (escolhido) depoisDeFecharAsFolhas(() => aoAplicar(escolhido.filtros));
  };

  const botao = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloDoBotaoDeFiltros(quantos, rotuloDoBotao)}
      accessibilityState={{ expanded: aberto }}
      aria-expanded={aberto}
      aria-haspopup={painelLateral ? 'dialog' : undefined}
      onPress={alternar}
      style={(e) => [estilos.filtros, { borderColor: cores.bordaCampo, backgroundColor: aberto ? cores.superficie3 : sobre(e) ? cores.superficie2 : 'transparent' }]}>
      <SlidersHorizontal size={18} color={cores.texto} strokeWidth={2} />
      <Texto style={estilos.rotuloFiltros} cor={cores.texto}>{rotuloDoBotao}</Texto>
      {/* Contagem neutra: `superficie3` com o botão fechado; aberto (o botão já é `superficie3`), o cartão. */}
      {quantos > 0 ? (
        <View style={[estilos.contagem, { backgroundColor: aberto ? cores.superficie : cores.superficie3 }]}>
          <Texto variante="pequeno" numerico cor={cores.texto} style={estilos.numero}>{String(quantos)}</Texto>
        </View>
      ) : null}
      {emFolha || painelLateral ? null : <Seta size={18} color={cores.textoSuave} strokeWidth={2} />}
    </Pressable>
  );

  return (
    <View style={estilos.raiz}>
      <View style={estilos.linha}>
        {busca ? (
          <View style={estilos.busca}>
            <Campo rotulo={busca.rotulo ?? 'Buscar'} valor={busca.valor} aoMudar={busca.aoMudar} placeholder={busca.placeholder}
              autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" enterKeyHint="search" />
          </View>
        ) : null}
        {/* Com atalhos, eles e o botão rolam juntos de lado no celular: o botão nunca fica sozinho numa linha. */}
        {atalhos ? <View style={estilos.faixa}><FaixaDeChips>{atalhos}{botao}</FaixaDeChips></View> : botao}
      </View>
      {/* Montado só aberto: cada abertura começa sem erro à vista. */}
      {painelLateral && aberto && rascunho ? (
        <PainelLateral titulo={painelLateral.titulo} rascunho={rascunho.filtros} limpo={limpo}
          aoMudar={(filtros) => setRascunho({ filtros })} seletores={seletores}
          aoDescartar={() => { setAberto(false); setRascunho(null); }}
          aoAplicar={(filtros) => { setAberto(false); setRascunho(null); depoisDeFecharAsFolhas(() => aoAplicar(filtros)); }} />
      ) : null}
      {aberto && !emFolha && !painelLateral ? (
        <Cartao titulo={tituloDoPainel}>
          {/* Seletor que abre a própria Folha (`EscolhaEmFolha`) escolhe com ela aberta: grava depois que ela fecha. */}
          <View style={estilos.grade}>{seletores(valor, (filtros) => depoisDeFecharAsFolhas(() => aoAplicar(filtros)))}</View>
        </Cartao>
      ) : null}
      {aberto && emFolha && rascunho && !painelLateral ? (
        <Folha visivel titulo="Filtros" aoFechar={fecharFolha}
          rodape={<Botao rotulo={rotuloDoResultado} cheio aoTocar={fecharFolha} />}>
          <View style={estilos.pilha}>{seletores(rascunho.filtros, (filtros) => setRascunho({ filtros }))}</View>
          <Botao rotulo="Limpar filtros" tipo="fantasma" Icone={X} aoTocar={() => setRascunho({ filtros: limpo })} />
        </Folha>
      ) : null}
      {quantos > 0 ? (
        <View style={estilos.filtrado}>
          <Texto variante="suave">Filtrando:</Texto>
          <View style={[estilos.filtrado, estilos.chipsAtivos]} accessibilityRole="list" accessibilityLabel="Filtrando">
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
          <Texto variante="suave" aria-hidden>•</Texto>
          <Botao rotulo="Limpar filtros" tipo="fantasma" aoTocar={() => aoAplicar(limpo)} />
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
function PainelLateral<T>({ titulo, rascunho, limpo, aoMudar, seletores, aoDescartar, aoAplicar }: {
  titulo: string; rascunho: T; limpo: T; aoMudar: (filtros: T) => void;
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
        <Botao rotulo="Aplicar filtros" aoTocar={aplicar} />
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
  // A faixa nunca passa da largura da linha: o que sobra rola dentro dela.
  faixa: { flexShrink: 1, minWidth: 0, maxWidth: '100%' },
  filtros: {
    minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5),
    borderWidth: 1, borderRadius: RAIO_CONTROLE,
  },
  rotuloFiltros: { fontFamily: fontes.semi },
  contagem: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  numero: { fontFamily: fontes.semi },
  // Seletores em grade no PC: cada um com pelo menos 260 px, quebrando linha.
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(2), alignItems: 'flex-start' },
  // Na folha a mesma linha que quebra: cada seletor (com base de 280 px, a da célula) ocupa a largura toda. Em coluna, a
  // base viraria altura.
  pilha: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(2), alignItems: 'flex-start' },
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
