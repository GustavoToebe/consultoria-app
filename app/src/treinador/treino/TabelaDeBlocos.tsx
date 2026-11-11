import { CircleAlert, TriangleAlert } from 'lucide-react-native';
import { useId, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { textoAcessivelDoBloco, textoDaVariacao, type ResumoDoBloco } from '../../dominio/editorDeTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, BORDA_ITEM, espaco, fontes, RAIO } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { sobre as comMouse } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

export interface LinhaDoBloco {
  /** uid da 1ª série do bloco (o mesmo valor da antiga aba). */
  valor: string;
  /** "Série 2 · WS": começo do nome acessível (os e2e e o leitor de tela procuram por ele). */
  rotulo: string;
  /** "Série 2": a coluna Série. */
  serie: string;
  /** "WS", "Back off": a coluna Tipo (cardio não tem). */
  tipo?: string;
  /** Cor de identificação do tipo (`identificacao[chave]`): faixa lateral e selo da categoria. */
  categoria?: { cor: string; fundo: string };
  /** A coluna Carga, já em texto (`cargaDoBloco`); "—" sem carga prescrita; "Falta a carga" com `cargaFalta`. */
  carga: string;
  /** Carga obrigatória ainda vazia: o texto da coluna em âmbar (pendência, não erro; guia premium págs. 4 e 9). */
  cargaFalta?: boolean;
  resumo: ResumoDoBloco;
  problema?: 'perigo' | 'atencao';
}

const TEXTO_DO_PROBLEMA = { perigo: 'com problema a corrigir', atencao: 'com aviso' } as const;

/** Abaixo desta largura da coluna das séries as colunas viram linha empilhada com o editor embaixo (390). */
export const LARGURA_DAS_COLUNAS = 540;
/** A mesma largura da barra do tipo no cartão da série do aluno (`aluno/PartesDaSerie`), para os dois lados lerem igual. */
const FAIXA = 6;

/**
 * Tabela dos blocos do exercício (guia premium pág. 9 e 17): Série, Tipo, Carga, Reps e Descanso, uma linha por bloco de
 * `agrupar`, com o que varia entre as séries embaixo do tipo. No PC é uma lista de abas **vertical** com ativação manual
 * (APG Tabs): setas movem o foco, Enter ou Espaço escolhem, e o editor do bloco fica logo depois da tabela. Estreito
 * (`empilhado`, 390) as linhas viram sanfona (APG Accordion): cada uma é botão com `aria-expanded` e `aria-controls`, e o
 * editor (`detalhe`) abre logo abaixo da série escolhida (guia pág. 9). Uma fica sempre aberta, como nas abas.
 * Quatro sinais que não se confundem: o foco é o anel do `:focus-visible`; a escolhida é neutra, a superfície de seleção
 * com o contorno forte e "EDITANDO"; a categoria é a faixa lateral e o selo na cor do tipo; o problema é o ícone na cor
 * da gravidade (a carga ainda vazia é âmbar, "Falta a carga").
 */
export function TabelaDeBlocos({ linhas, ativa, aoMudar, depois, empilhado = false, detalhe }: {
  linhas: LinhaDoBloco[];
  ativa: string;
  aoMudar: (valor: string) => void;
  /** "+ Nova série", logo abaixo da última linha. */
  depois?: ReactNode;
  /** Coluna estreita: sanfona em vez de abas. */
  empilhado?: boolean;
  /** O editor do bloco escolhido, só no modo empilhado (no PC quem usa o põe depois da tabela). */
  detalhe?: ReactNode;
}) {
  const { cores } = useTema();
  const idDoDetalhe = `detalhe-da-serie-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // O primitivo das abas na web descarta `style` em função: o hover vem do mouse sobre a linha.
  const [sobre, setSobre] = useState<string | null>(null);

  const conteudo = (l: LinhaDoBloco, sel: boolean) => {
    const Icone = l.problema === 'perigo' ? CircleAlert : TriangleAlert;
    const variacao = textoDaVariacao(l.resumo.variacao);
    const series = `${l.resumo.quantidade} ${l.resumo.quantidade === 1 ? 'série' : 'séries'}`;
    const corDaCarga = l.cargaFalta ? { color: cores.atencao } : null;
    const numero = (
      <View style={estilos.titulo}>
        {l.problema ? <Icone size={16} color={cores[l.problema]} strokeWidth={2.5} aria-hidden /> : null}
        <Texto style={estilos.forte}>{l.serie}</Texto>
      </View>
    );
    const tipo = (
      <View style={estilos.titulo}>
        {l.tipo ? <Selo texto={l.tipo} categoria={l.categoria} /> : <Texto cor="suave">—</Texto>}
        {/* O "selected"/"expanded" já diz ao leitor de tela; o marcador é para quem vê (guia pág. 9). */}
        {sel ? <Texto variante="secao" cor={cores.texto} aria-hidden>Editando</Texto> : null}
      </View>
    );
    const detalhes = (
      <>
        {l.resumo.nome ? <Texto variante="pequeno" cor="suave">{l.resumo.nome}</Texto> : null}
        {variacao ? <Texto variante="pequeno" cor="suave">{variacao}</Texto> : null}
      </>
    );
    if (!empilhado) {
      return (
        <View style={estilos.linha}>
          <View style={[estilos.serie, estilos.celula]}>
            {numero}
            <Texto variante="pequeno" numerico cor="suave">{series}</Texto>
          </View>
          <View style={[estilos.tipo, estilos.celula]}>{tipo}{detalhes}</View>
          <Texto numerico style={[estilos.carga, corDaCarga]}>{l.carga}</Texto>
          <Texto numerico style={estilos.reps}>{l.resumo.repeticoes}</Texto>
          <Texto numerico style={estilos.descanso}>{l.resumo.descanso}</Texto>
        </View>
      );
    }
    return (
      <View style={estilos.empilhado}>
        <View style={estilos.titulo}>{numero}{tipo}</View>
        {detalhes}
        <Texto variante="pequeno" numerico>
          {[series, !l.cargaFalta && l.carga !== '—' ? l.carga : null, l.resumo.repeticoes, `descanso ${l.resumo.descanso}`].filter(Boolean).join(' · ')}
        </Texto>
        {l.cargaFalta ? <Texto variante="pequeno" style={[estilos.semi, corDaCarga]}>{l.carga}</Texto> : null}
      </View>
    );
  };
  const rotuloDe = (l: LinhaDoBloco) => [
    textoAcessivelDoBloco(l.rotulo, l.resumo),
    l.cargaFalta ? 'falta a carga' : l.carga !== '—' ? `carga ${l.carga}` : null,
    l.problema ? TEXTO_DO_PROBLEMA[l.problema] : null,
  ].filter(Boolean).join(', ');
  // Sem categoria a faixa fica na cor do fundo: as colunas não andam entre linhas com e sem cor.
  const caixa = (l: LinhaDoBloco, sel: boolean, fundo: string) =>
    [estilos.caixa, { backgroundColor: fundo, borderColor: sel ? cores.texto : cores.borda, borderLeftColor: l.categoria?.cor ?? fundo }];

  if (empilhado) {
    return (
      <View style={estilos.tabela}>
        <View style={estilos.lista} role="group" aria-label="Blocos do exercício">
          {linhas.map((l) => {
            const sel = l.valor === ativa;
            return (
              <View key={l.valor} style={estilos.lista}>
                <Pressable accessibilityRole="button" accessibilityLabel={rotuloDe(l)} aria-expanded={sel}
                  {...(Platform.OS === 'web' && sel && detalhe ? ({ 'aria-controls': idDoDetalhe } as object) : {})}
                  onPress={() => { if (!sel) aoMudar(l.valor); }}
                  style={(st) => caixa(l, sel, sel || comMouse(st) ? cores.superficie3 : cores.superficie2)}>
                  {conteudo(l, sel)}
                </Pressable>
                {sel && detalhe ? <View nativeID={idDoDetalhe} role="region" aria-label={`Editando ${l.rotulo}`}>{detalhe}</View> : null}
              </View>
            );
          })}
        </View>
        {depois ? <View style={estilos.depois}>{depois}</View> : null}
      </View>
    );
  }

  return (
    <View style={estilos.tabela}>
      {/* Cabeçalho só visual: cada linha já diz os valores no nome acessível. */}
      <View style={[estilos.linha, estilos.cabecalho]} aria-hidden importantForAccessibility="no-hide-descendants">
        <Texto variante="rotulo" style={estilos.serie}>Série</Texto>
        <Texto variante="rotulo" style={estilos.tipo}>Tipo</Texto>
        <Texto variante="rotulo" style={estilos.carga}>Carga</Texto>
        <Texto variante="rotulo" style={estilos.reps}>Reps</Texto>
        <Texto variante="rotulo" style={estilos.descanso}>Descanso</Texto>
      </View>
      <Tabs value={ativa} onValueChange={aoMudar} orientation="vertical" activationMode="manual">
        <TabsList aria-label="Blocos do exercício" style={estilos.lista}>
          {linhas.map((l) => {
            const sel = l.valor === ativa;
            const fundo = sel || sobre === l.valor ? cores.superficie3 : cores.superficie2;
            return (
              <TabsTrigger key={l.valor} value={l.valor} accessibilityRole="tab" accessibilityLabel={rotuloDe(l)} accessibilityState={{ selected: sel }}
                {...(Platform.OS === 'web' ? ({ onMouseEnter: () => setSobre(l.valor), onMouseLeave: () => setSobre(null) } as object) : {})}
                style={caixa(l, sel, fundo)}>
                {conteudo(l, sel)}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {depois ? <View style={estilos.depois}>{depois}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tabela: { gap: espaco(0.5) },
  // A lista e o gatilho do `components/ui/tabs` nascem em linha, `w-fit` e centrados: aqui são coluna e linha cheia.
  lista: { flexDirection: 'column', width: '100%', gap: espaco(0.5) },
  caixa: {
    width: '100%', height: 'auto', minHeight: ALVO_TOQUE, justifyContent: 'flex-start', alignItems: 'stretch',
    paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderWidth: BORDA_ITEM, borderLeftWidth: FAIXA, borderRadius: RAIO,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(2), width: '100%' },
  // Mesmo recuo da linha (padding mais as bordas), para as colunas do cabeçalho caírem sobre os valores.
  cabecalho: { paddingLeft: espaco(1.5) + FAIXA, paddingRight: espaco(1.5) + BORDA_ITEM },
  celula: { gap: espaco(0.25), minWidth: 0 },
  serie: { width: 80, flexShrink: 0 },
  // A sobra da linha é repartida (11/11): antes ia toda para o Tipo e Carga, Reps e Descanso ficavam colados à direita.
  tipo: { flexGrow: 4, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  carga: { flexGrow: 3, flexShrink: 0, flexBasis: 112 },
  reps: { flexGrow: 2, flexShrink: 0, flexBasis: 88 },
  descanso: { flexGrow: 2, flexShrink: 0, flexBasis: 88 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexWrap: 'wrap' },
  forte: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1 },
  semi: { fontFamily: fontes.semi },
  empilhado: { gap: espaco(0.5), width: '100%' },
  depois: { alignItems: 'flex-start', paddingTop: espaco(0.5) },
});
