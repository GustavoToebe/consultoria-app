import { router, type Href } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_MENU_EXPANDIDO, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import {
  BORDA_DA_LINHA, DIREITA_DO_BOTAO_AO_LADO, ESPACO_ENTRE_COLUNAS, estiloDaColuna, LARGURA_DO_BOTAO_AO_LADO, margensDoCabecalho, RECUO_DA_LINHA,
  type ColunaDaLista,
} from './colunasDaLista';
import { propsDeLink } from './propsDeLink';
import { rotuloDaLinha, type SeloDaLinha } from './rotuloDaLinha';
import { Selo } from './Selo';
import { sobre } from './sobre';
import { Texto } from './Texto';

export { rotuloDaLinha, type ColunaDaLista, type SeloDaLinha };

/** Células da linha, uma por chave de coluna (as que faltarem ficam vazias). */
export type CelulasDaLinha = Readonly<Record<string, ReactNode>>;

interface Base {
  titulo: string;
  /** Linha pequena com números ("6 sessões · 32 exercícios", "Data: 12/10"). */
  metadados?: string;
  /** Texto suave, até 2 linhas. */
  descricao?: string;
  /** Só o que pede atenção, sempre com texto (nunca a cor da marca). */
  selos?: SeloDaLinha[];
  /** Miniatura ou caixa de marcar, à esquerda. Com `href`, fica fora do link (tocar nela não abre a tela). */
  inicio?: ReactNode;
  /** Nome acessível do link; padrão "título, metadados, selos". */
  rotulo?: string;
  /** Borda na cor do texto (item escolhido, como no Catálogo). */
  marcado?: boolean;
  /** Linha apagada (0,6), por exemplo o que já está na biblioteca. Ações e `children` não apagam. */
  esmaecido?: boolean;
  /** Conteúdo embaixo da linha, dentro da mesma borda (as instruções abertas do Catálogo). */
  children?: ReactNode;
  /**
   * Linha em colunas (lista de alunos): no PC (a partir de `LARGURA_DAS_COLUNAS`) as `celulas` ficam alinhadas ao
   * `CabecalhoDasColunas` com a mesma `definicao`, no lugar de título, metadados e selos, e a linha vira linha de tabela:
   * sem caixa (borda e fundo), com divisória embaixo e realce no hover (a `ListaDeLinhas emColunas` tira o espaço entre
   * elas). Abaixo disso a linha continua empilhada e na caixa, com a célula da primeira coluna no lugar do título e os
   * metadados e selos embaixo dela.
   */
  colunas?: { definicao: readonly ColunaDaLista[]; celulas: CelulasDaLinha };
}

/** A linha inteira abre outra tela: na web é um `<a href>` e não tem botão dentro. */
export type LinhaComLink = Base & {
  href: Href; aoAbrir?: () => void; acoes?: never; aoTocarTextos?: never; acoesAoLado?: never; marcar?: never;
  /**
   * Uma ação só de ícone (`IconeBotao moldura`, o lápis de editar) antes da seta, que fica por último. O botão é irmão do
   * `<a>`, nunca filho (linha-link não tem botão dentro): fica por cima do link, no espaço que ele deixa vazio antes da
   * seta. Assim a seta e quase toda a linha continuam sendo o link, e o leitor de tela lê o link e depois o botão, sem
   * repetir nada. Ocupa `LARGURA_AO_LADO`, que o `CabecalhoDasColunas aoLado` desconta.
   */
  aoLado?: ReactNode;
};
/**
 * A linha tem botões à direita (no celular, embaixo); `aoTocarTextos` faz tocar no nome agir também (Catálogo).
 * `acoesAoLado`: ações só de ícone (o lápis) ficam à direita também no celular, em vez de sozinhas numa linha embaixo.
 */
export type LinhaComAcoes = Base & { href?: never; aoAbrir?: never; acoes?: ReactNode; aoTocarTextos?: () => void; acoesAoLado?: boolean; marcar?: never; aoLado?: never };
/**
 * A linha inteira é a caixa de marcar (Selecionar dos alunos): um só alvo, role checkbox, com a caixa só desenhada à
 * esquerda. Sem seta, sem `href`, sem `inicio` nem ações: nunca link e caixa juntos.
 */
export type LinhaDeMarcar = Base & {
  href?: never; aoAbrir?: never; acoes?: never; aoTocarTextos?: never; acoesAoLado?: never; inicio?: never; aoLado?: never;
  marcar: { marcado: boolean; aoMudar: () => void };
};
export type PropsDaLinha = LinhaComLink | LinhaComAcoes | LinhaDeMarcar;

/**
 * Linha de largura total das listas de registros (o formato do Planejamento por coleção): título, metadados e descrição,
 * selos e, à direita, as ações ou a seta do link. No PC (a partir do menu lateral) tudo numa linha; no celular, os textos
 * em cima e as ações embaixo. Ou abre outra tela (`href`), ou tem ações (`acoes`), ou a linha toda marca (`marcar`),
 * nunca duas: botão dentro de link quebra o leitor de tela e o Ctrl+clique.
 */
/**
 * A lista em colunas só vira colunas com o menu aberto por inteiro: com o menu só de ícones (768 a 1023 px) as colunas
 * apertavam e os textos ficavam cortados, então ali a linha fica empilhada, como no celular (Gustavo, 30/10).
 */
export const LARGURA_DAS_COLUNAS = LARGURA_MENU_EXPANDIDO;

export function LinhaDaLista(p: PropsDaLinha) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const largo = width >= (p.colunas ? LARGURA_DAS_COLUNAS : LARGURA_MENU_LATERAL);
  const [ativo, setAtivo] = useState(false);
  const selos = p.selos ?? [];
  const escolhida = !!(p.marcado || p.marcar?.marcado);
  // Em colunas no PC a linha é linha de tabela: sem caixa, só a divisória embaixo (a borda transparente mantém o 1 px
  // que o cabeçalho desconta). A linha marcada no Selecionar continua com a borda na cor do texto, como na caixa.
  const tabela = !!p.colunas && largo;
  const caixa = tabela
    ? [estilos.linhaDeTabela, escolhida
      ? { borderColor: cores.texto }
      : { borderTopColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: cores.divisor }]
    : { borderColor: escolhida ? cores.texto : cores.borda };
  const fundo = (aceso: boolean) => ({ backgroundColor: aceso ? cores.superficie3 : tabela ? 'transparent' : cores.superficie2 });
  const apagado = p.esmaecido ? estilos.esmaecido : null;

  const colunas = p.colunas;
  const textos = (
    <View style={estilos.textos}>
      {colunas && colunas.definicao.length ? colunas.celulas[colunas.definicao[0].chave] ?? null : <Texto variante="bloco">{p.titulo}</Texto>}
      {p.metadados ? <Texto variante="pequeno" numerico>{p.metadados}</Texto> : null}
      {p.descricao ? <Texto variante="suave" numberOfLines={2}>{p.descricao}</Texto> : null}
      {selos.length && !largo ? <SelosDaLinha selos={selos} /> : null}
    </View>
  );
  // No PC os selos ganham coluna própria, entre os textos e as ações; no celular ficam embaixo dos textos.
  const miolo = colunas && largo
    ? <Celulas definicao={colunas.definicao} celulas={colunas.celulas} />
    : selos.length && largo
      ? <View style={estilos.mioloLargo}>{textos}<SelosDaLinha selos={selos} /></View>
      : textos;

  if (p.marcar) {
    const { marcado, aoMudar } = p.marcar;
    // A linha toda é o alvo (checkbox); a caixa é só desenho. O realce do mouse sobe para o contêiner, como no link.
    return (
      <View style={[estilos.contorno, caixa, fundo(ativo)]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={p.rotulo ?? p.titulo}
          accessibilityState={{ checked: marcado }}
          aria-checked={marcado}
          onPress={aoMudar}
          onHoverIn={() => setAtivo(true)}
          onHoverOut={() => setAtivo(false)}
          onPressIn={() => setAtivo(true)}
          onPressOut={() => setAtivo(false)}
          style={estilos.link}>
          <View style={[estilos.linkConteudo, apagado]}>
            <View style={estilos.fixo}><DesenhoDaCaixa marcado={marcado} /></View>
            {miolo}
          </View>
        </Pressable>
        {p.children}
      </View>
    );
  }

  if (p.href !== undefined) {
    const href = p.href;
    const abrir = p.aoAbrir ?? (() => router.navigate(href));
    const link = (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={p.rotulo ?? rotuloDaLinha(p.titulo, p.metadados, selos)}
        {...propsDeLink(href, abrir)}
        onHoverIn={() => setAtivo(true)}
        onHoverOut={() => setAtivo(false)}
        onPressIn={() => setAtivo(true)}
        onPressOut={() => setAtivo(false)}
        style={[estilos.link, p.inicio ? estilos.linkDepoisDoInicio : null]}>
        <View style={[estilos.linkConteudo, apagado]}>
          {miolo}
          {/* O lugar do botão ao lado: o link fica vazio ali e o botão fica por cima, antes da seta. */}
          {p.aoLado ? <View style={estilos.lugarDoAoLado} /> : null}
          <View testID="seta-da-linha" style={estilos.fixo}><ChevronRight size={20} color={cores.textoSuave} /></View>
        </View>
      </Pressable>
    );
    // O `inicio` e o `aoLado` são irmãos do link, dentro da mesma borda: a caixa do Selecionar marca sem abrir a ficha e o
    // lápis abre a edição. O realce do mouse sobe para o contêiner, para a linha acender inteira (sem `overflow: hidden`,
    // que cortaria o anel de foco); com o mouse no lápis a linha apaga e acende o lápis, que é outro alvo.
    return (
      <View style={[estilos.contorno, caixa, fundo(ativo)]}>
        <View style={estilos.linhaDoLink}>
          {p.inicio ? <View style={[estilos.inicioDoLink, apagado]}>{p.inicio}</View> : null}
          {link}
          {p.aoLado ? <View style={estilos.aoLado}>{p.aoLado}</View> : null}
        </View>
        {p.children}
      </View>
    );
  }

  const conteudo = p.aoTocarTextos
    // Tocar no nome também marca (Catálogo); o foco e o leitor de tela ficam na caixa, por isso este toque não é focável.
    ? <Pressable focusable={false} accessible={false} onPress={p.aoTocarTextos} style={estilos.toqueDosTextos}>{miolo}</Pressable>
    : miolo;
  const principal = p.inicio
    ? <View style={[estilos.comInicio, apagado]}><View style={estilos.fixo}>{p.inicio}</View>{conteudo}</View>
    : apagado ? <View style={[estilos.comInicio, apagado]}>{conteudo}</View> : conteudo;
  return (
    <View style={[estilos.contorno, caixa, fundo(false)]}>
      <View style={[estilos.linha, largo || p.acoesAoLado ? estilos.linhaLarga : null]}>
        {principal}
        {p.acoes ? <View style={[estilos.acoes, p.acoesAoLado ? estilos.fixo : null]}>{p.acoes}</View> : null}
      </View>
      {p.children}
    </View>
  );
}

function SelosDaLinha({ selos }: { selos: readonly SeloDaLinha[] }) {
  return <View style={estilos.selos}>{selos.map((s) => <Selo key={s.texto} texto={s.texto} tipo={s.tipo} Icone={s.Icone} />)}</View>;
}

function Celulas({ definicao, celulas }: { definicao: readonly ColunaDaLista[]; celulas: CelulasDaLinha }) {
  return (
    <View style={[estilos.colunas, estilos.colunasDaLinha]}>
      {definicao.map((c) => <View key={c.chave} style={[estilos.celula, estiloDaColuna(c)]}>{celulas[c.chave] ?? null}</View>)}
    </View>
  );
}

/**
 * Cabeçalho das colunas de uma lista em colunas (texto `rotulo`, em `textoSuave`, com divisor embaixo), só no PC; no
 * celular não aparece, porque a linha fica empilhada. `marcar` e `aoLado` dizem como são as linhas embaixo (caixa à
 * esquerda no Selecionar; ação ao lado e seta fora dele), para as colunas caírem no mesmo lugar. É só visual: o nome
 * acessível de cada linha já diz o que ela mostra.
 */
export function CabecalhoDasColunas({ colunas, marcar, aoLado }: { colunas: readonly ColunaDaLista[]; marcar?: boolean; aoLado?: boolean }) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  if (width < LARGURA_DAS_COLUNAS) return null;
  const { antes, depois } = margensDoCabecalho({ marcar, aoLado });
  const recuo = BORDA_DA_LINHA + RECUO_DA_LINHA;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden
      style={[estilos.colunas, estilos.cabecalho, { borderBottomColor: cores.divisor, paddingLeft: recuo + antes, paddingRight: recuo + depois }]}>
      {colunas.map((c) => <View key={c.chave} style={estiloDaColuna(c)}><Texto variante="rotulo" numberOfLines={1}>{c.rotulo}</Texto></View>)}
    </View>
  );
}

/**
 * Linhas de uma lista, uma embaixo da outra, com o mesmo espaço que as linhas têm dentro de um `Cartao`. `emColunas`: as
 * linhas usam `colunas`; no PC (a partir de `LARGURA_DAS_COLUNAS`) viram linhas de tabela, encostadas uma na outra e
 * separadas só pela divisória de cada uma.
 */
export function ListaDeLinhas({ children, emColunas }: { children: ReactNode; emColunas?: boolean }) {
  const { width } = useWindowDimensions();
  return <View style={emColunas && width >= LARGURA_DAS_COLUNAS ? estilos.listaDeTabela : estilos.lista}>{children}</View>;
}

/**
 * Caixa de marcar sozinha, para o `inicio` da linha (Selecionar dos alunos, Catálogo): 44 px de toque com a caixa de 24
 * no meio. A `CaixaSelecao` não serve aqui porque já é uma linha inteira com o texto da opção.
 */
export function CaixaDaLinha({ rotulo, marcado, aoMudar, desabilitado }: { rotulo: string; marcado: boolean; aoMudar: () => void; desabilitado?: boolean }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: marcado, disabled: !!desabilitado }}
      aria-checked={marcado}
      aria-disabled={!!desabilitado}
      disabled={desabilitado}
      onPress={aoMudar}
      style={(estado) => [estilos.alvoDaCaixa, { backgroundColor: sobre(estado) && !desabilitado ? cores.superficie3 : 'transparent' }]}>
      <DesenhoDaCaixa marcado={marcado} />
    </Pressable>
  );
}

/** O quadrado da caixa de marcar (seleção invertida), sem toque: usado pela `CaixaDaLinha` e pela linha que marca. */
function DesenhoDaCaixa({ marcado }: { marcado: boolean }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.caixa, { backgroundColor: marcado ? cores.texto : cores.campo, borderColor: marcado ? cores.texto : cores.bordaCampo }]}>
      {marcado ? <Check size={18} color={cores.fundo} strokeWidth={3} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(2) },
  listaDeTabela: { gap: 0 },
  contorno: { borderWidth: BORDA_DA_LINHA, borderRadius: RAIO },
  // Linha de tabela: cantos retos, para o realce encostar na divisória de cima e na de baixo.
  linhaDeTabela: { borderRadius: 0 },
  esmaecido: { opacity: 0.6 },
  // Seta, caixa e miniatura nunca encolhem quando o nome é comprido.
  fixo: { flexShrink: 0 },
  // Igual à `LinhaDeModelo` de antes: o Planejamento não muda.
  linha: { padding: espaco(1.5), gap: espaco(1), minHeight: ALVO_TOQUE },
  linhaLarga: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(2) },
  textos: { flexShrink: 1, flexGrow: 1, gap: espaco(0.5) },
  mioloLargo: { flexShrink: 1, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: espaco(2) },
  selos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  comInicio: { flexShrink: 1, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  toqueDosTextos: { flexShrink: 1, flexGrow: 1, flexDirection: 'row', alignItems: 'center', minHeight: ALVO_TOQUE },
  linhaDoLink: { flexDirection: 'row', alignItems: 'stretch' },
  inicioDoLink: { flexShrink: 0, justifyContent: 'center', paddingLeft: espaco(1) },
  link: { flex: 1, borderRadius: RAIO, padding: RECUO_DA_LINHA, minHeight: ALVO_TOQUE + espaco(1), justifyContent: 'center' },
  linkDepoisDoInicio: { paddingLeft: espaco(1) },
  linkConteudo: { flexDirection: 'row', alignItems: 'center', gap: RECUO_DA_LINHA },
  // Colunas: as medidas vêm de `colunasDaLista` (o cabeçalho usa as mesmas).
  colunas: { flexDirection: 'row', alignItems: 'center', gap: ESPACO_ENTRE_COLUNAS },
  colunasDaLinha: { flex: 1, minWidth: 0 },
  celula: { justifyContent: 'center' },
  cabecalho: { paddingBottom: espaco(1.25), borderBottomWidth: 1 },
  // O lugar do botão ao lado, dentro do link e vazio; o botão fica por cima dele (`box-none`: o toque em volta do botão,
  // acima e abaixo, continua chegando ao link).
  lugarDoAoLado: { width: LARGURA_DO_BOTAO_AO_LADO, flexShrink: 0 },
  aoLado: { position: 'absolute', top: 0, bottom: 0, right: DIREITA_DO_BOTAO_AO_LADO, justifyContent: 'center', pointerEvents: 'box-none' },
  alvoDaCaixa: { width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  caixa: { width: 24, height: 24, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
