import { router, type Href } from 'expo-router';
import { Search, Star } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps, type TextInput } from 'react-native';

import { atalhosPadrao, buscarTelas, favoritosVisiveis, legendaDaTela, telasPermitidas, type TelaDoCatalogo } from '../dominio/telas';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../tema/tokens';
import { Campo } from './Campo';
import { Folha } from './Folha';
import { useSaidaGuardada } from './GuardaDeSaida';
import { useDicaNoMenu, useMenuLateral } from './Navegacao';
import { useAlvoDoPasseio } from './Passeio';
import { propsDeLink } from './propsDeLink';
import { sobre } from './sobre';
import { Texto } from './Texto';
import { useFavoritos } from './useFavoritos';
import { useTeclado } from './usoWeb';

/** Texto da dica de atalho; no Mac o atalho é Cmd + K, e o rótulo mostra o que vale ali. */
export const ATALHO = Platform.OS === 'web' && typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

const Contexto = createContext<{ abrir: () => void } | null>(null);

/** Abre a busca global (o "Buscar" do menu lateral e o "Buscar telas" do Perfil no celular); `null` fora do provedor. */
export const useBuscaGlobal = () => useContext(Contexto);

/**
 * Dona da busca global do treinador (guia de 11/11, D2 e D6): uma `Folha` só, aberta pelo "Buscar" do menu lateral, pelo
 * "Buscar telas" do Perfil e por Ctrl+K / Cmd+K em qualquer tela (web). Os favoritos ficam lidos aqui, fora da folha, para a
 * lista não piscar ao abrir. Fechar desmonta o conteúdo: reabrir começa com o campo vazio.
 */
export function ProvedorDaBuscaGlobal({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const { favoritos, alternar } = useFavoritos();
  const campo = useRef<TextInput>(null);
  useTeclado(true, ({ key, ctrl }) => {
    if (!ctrl || key.toLowerCase() !== 'k') return undefined;
    // Já aberta: o atalho volta o foco ao campo (de uma estrela ou de um resultado).
    if (aberta) campo.current?.focus();
    else setAberta(true);
    return true;
  });
  const valor = useMemo(() => ({ abrir: () => setAberta(true) }), []);
  const fechar = () => setAberta(false);
  return (
    <Contexto.Provider value={valor}>
      {children}
      <Folha visivel={aberta} titulo="Buscar" aoFechar={fechar}>
        <PainelDaBusca campo={campo} favoritos={favoritos} alternar={alternar} aoFechar={fechar} />
      </Folha>
    </Contexto.Provider>
  );
}

/**
 * "Buscar" do menu lateral, na linha abaixo da identidade, com o recolher ao lado (D2). Menu aberto: linha leve, só com
 * contorno `divisor`, a lupa e "Buscar"; o atalho fica na dica e no nome acessível, sem selo. Minimizado (72): só a lupa,
 * centralizada, com o nome e o atalho na dica. Trilho do tablet (88): a lupa com "Buscar"
 * embaixo, como os itens. Não é campo de verdade: abre a folha da busca.
 */
export function BotaoDaBusca() {
  const busca = useBuscaGlobal();
  const { recolhido, trilho } = useMenuLateral();
  const { cores } = useTema();
  const soIcone = recolhido && !trilho;
  const noRef = useRef<View | null>(null);
  // O atalho não aparece mais no botão: a dica (no menu aberto e no minimizado) e o nome acessível o dizem.
  const dica = useDicaNoMenu(`Buscar (${ATALHO})`, !trilho, noRef);
  const alvo = useAlvoDoPasseio('menu:busca');
  const ref = useCallback((n: View | null) => {
    noRef.current = n;
    alvo(n);
  }, [alvo]);
  if (!busca) return null;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`Buscar telas e ações, atalho ${ATALHO}`}
      onPress={busca.abrir}
      {...dica}
      style={(estado) => [
        estilos.gatilho,
        recolhido
          ? [estilos.gatilhoIcone, trilho && estilos.gatilhoTrilho]
          : [estilos.gatilhoAberto, { borderColor: cores.divisor }],
        sobre(estado) && { backgroundColor: cores.superficie2 },
      ]}>
      <Search size={recolhido ? 20 : 16} color={cores.textoSuave} strokeWidth={2} />
      {soIcone ? null : (
        <Texto numberOfLines={1} style={[trilho ? estilos.rotuloTrilho : estilos.rotuloAberto, { color: cores.textoSuave }]}>Buscar</Texto>
      )}
    </Pressable>
  );
}

/**
 * Conteúdo da folha: o campo e a lista. Campo vazio mostra os favoritos (ou, sem nenhum, atalhos do dia a dia); digitando,
 * as telas e ações do catálogo (`dominio/telas.ts`) que o perfil pode abrir. Cada tela tem a estrela de favorito ao lado
 * (ação não vira favorito). Nunca lista o catálogo inteiro agrupado. Com o foco no campo, setas escolhem e Enter abre;
 * Esc fecha pela própria folha. Não procura alunos pelo nome.
 */
function PainelDaBusca({ campo, favoritos, alternar, aoFechar }: {
  campo: RefObject<TextInput | null>;
  favoritos: readonly string[];
  alternar: (id: string) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const { pode, perfilEquipe, funcionalidadesDoPlano, pagamentosHabilitados } = useSessao();
  const administrador = !!perfilEquipe?.acessoTotal;
  const permitidas = useMemo(
    () => telasPermitidas(pode, undefined, funcionalidadesDoPlano, pagamentosHabilitados, administrador),
    [pode, funcionalidadesDoPlano, pagamentosHabilitados, administrador],
  );
  const [texto, setTexto] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [noCampo, setNoCampo] = useState(false);
  const { confirmar } = useSaidaGuardada();

  const digitando = texto.trim().length > 0;
  const marcados = favoritosVisiveis(favoritos, permitidas);
  const resultados = digitando ? buscarTelas(texto, permitidas) : marcados.length > 0 ? marcados : atalhosPadrao(permitidas);
  const indice = Math.min(ativo, Math.max(resultados.length - 1, 0));

  const abrir = (tela: TelaDoCatalogo) => {
    aoFechar();
    confirmar(() => router.navigate(tela.href as Href));
  };

  // Setas e Enter só aceleram quando o foco está no campo; fora dele, Tab percorre os links e as estrelas.
  useTeclado(noCampo, ({ key }) => {
    if ((key === 'ArrowDown' || key === 'ArrowUp') && resultados.length > 0) {
      setAtivo((indice + (key === 'ArrowDown' ? 1 : resultados.length - 1)) % resultados.length);
      return true;
    }
    if (key === 'Enter' && resultados[indice]) {
      abrir(resultados[indice]);
      return true;
    }
    return undefined;
  });

  const situacao = digitando
    ? resultados.length === 0 ? 'Nada encontrado. Tente outra palavra.' : `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`
    : marcados.length > 0 ? 'Favoritos' : 'Atalhos';

  return (
    <View style={estilos.painel}>
      <Campo
        ref={campo}
        rotulo="Tela ou ação"
        rotuloAcessivel="Buscar tela ou ação"
        role="searchbox"
        placeholder="Ex.: alunos, faturas, novo modelo"
        valor={texto}
        aoMudar={(t) => {
          setTexto(t);
          setAtivo(0);
        }}
        onFocus={() => setNoCampo(true)}
        onBlur={() => setNoCampo(false)}
        autoCorrect={false}
        autoComplete="off"
      />
      <View style={estilos.cabeca}>
        <Texto variante={digitando ? 'suave' : 'rotulo'} accessibilityLiveRegion="polite">{situacao}</Texto>
        {!digitando && marcados.length === 0 ? (
          <Texto variante="pequeno">Marque a estrela de uma tela para ela aparecer aqui.</Texto>
        ) : null}
      </View>
      <View style={estilos.lista}>
        {resultados.map((tela, i) => {
          const favorita = favoritos.includes(tela.id);
          return (
            <View key={tela.id} style={estilos.linha}>
              <LinkDeTela
                href={tela.acao ? undefined : (tela.href as Href)}
                navegar={() => abrir(tela)}
                accessibilityLabel={`${tela.rotulo}, ${legendaDaTela(tela)}`}
                onHoverIn={() => setAtivo(i)}
                style={(estado) => [
                  estilos.resultado,
                  sobre(estado) && { backgroundColor: cores.superficie2 },
                  noCampo && i === indice && { backgroundColor: cores.superficie3 },
                ]}>
                <Texto style={estilos.nome} numberOfLines={1}>{tela.rotulo}</Texto>
                <Texto variante="pequeno" numberOfLines={1}>{legendaDaTela(tela)}</Texto>
              </LinkDeTela>
              {tela.acao ? (
                <View style={estilos.semEstrela} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={favorita ? `Tirar ${tela.rotulo} dos favoritos` : `Favoritar ${tela.rotulo}`}
                  onPress={() => {
                    alternar(tela.id);
                    // Sem texto, a linha do favorito desmarcado some: o foco volta ao campo em vez de cair no fim da página.
                    if (!digitando && favorita) campo.current?.focus();
                  }}
                  style={(estado) => [estilos.estrela, sobre(estado) && { backgroundColor: cores.superficie2 }]}>
                  <Star size={20} color={favorita ? cores.atencao : cores.textoSuave} fill={favorita ? cores.atencao : 'transparent'} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Resultado da busca. Tela (com `href`) é link (`<a href>` na web, abre em outra guia com Ctrl/Cmd); ação segue como
 * botão. A navegação entra por prop e só é chamada no clique (regra do React Compiler).
 */
function LinkDeTela({ href, navegar, ...resto }: PressableProps & { href?: Href; navegar: () => void }) {
  return <Pressable {...resto} {...(href ? propsDeLink(href, navegar) : { accessibilityRole: 'button' as const, onPress: navegar })} />;
}

const estilos = StyleSheet.create({
  gatilho: { flexDirection: 'row', alignItems: 'center', minHeight: ALVO_TOQUE, borderRadius: RAIO_CONTROLE },
  gatilhoAberto: { gap: espaco(1), paddingLeft: espaco(1.5), paddingRight: espaco(1), borderWidth: 1 },
  gatilhoIcone: { justifyContent: 'center' },
  gatilhoTrilho: { flexDirection: 'column', gap: 2, paddingVertical: espaco(0.5) },
  rotuloAberto: { flex: 1, fontSize: 15 },
  rotuloTrilho: { alignSelf: 'stretch', textAlign: 'center', fontSize: 12, lineHeight: 16, fontFamily: fontes.medio },
  painel: { gap: espaco(1.5) },
  cabeca: { gap: 2 },
  lista: { gap: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  resultado: { flex: 1, minWidth: 0, minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderRadius: RAIO_CONTROLE },
  nome: { fontFamily: fontes.semi, fontSize: 15 },
  estrela: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  semEstrela: { width: ALVO_TOQUE },
});
