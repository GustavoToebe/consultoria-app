import { router, useLocalSearchParams } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { temPrimeirosPassos } from '../dominio/primeirosPassos';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cabecalho } from '../ui/Cabecalho';
import { Campo } from '../ui/Campo';
import { EscolhaSuspensa } from '../ui/EscolhaSuspensa';
import { Vazio } from '../ui/Estados';
import { depoisDeFecharAsFolhas } from '../ui/historicoDasFolhas';
import { usePasseio } from '../ui/Passeio';
import { useRolagem } from '../ui/RolagemComTopo';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useFaixaDeLargura } from '../ui/useFaixaDeLargura';
import { ALVO_DO_ARTIGO, alvoDoTopico, ArtigoDaAjuda, ResultadosDaBusca } from './ArtigoDaAjuda';
import { artigosDaAjuda, buscarNaAjuda, palavrasDaBusca, textoDoResultado, type ResultadoDaBusca } from './busca';
import { GUIAS, secoesDoGuia, textoDoItem, type Publico, type SecaoGuia } from './conteudo';
import { IndiceDaAjuda, NestaPagina, type EntradaDoIndice } from './NavegacaoDaAjuda';
import { PaginaInicialDaAjuda } from './PaginaInicialDaAjuda';
import { TutorialGuiado } from './TutorialGuiado';
import { useTopicoVisivel } from './useTopicoVisivel';
import { VIDEOS_DA_AJUDA, type VideosDaAjuda } from './videos';

/**
 * Colunas da Ajuda no PC, medidas na área ao lado do menu: índice | artigo (largura de leitura) | "Nesta página". O
 * conjunto encosta à esquerda, junto do menu, e a sobra fica à direita dele (nunca entre as colunas nem antes do título).
 */
const LARGURA_DO_INDICE = 260;
const LARGURA_DA_NESTA_PAGINA = 240;
/** Coluna do artigo: o texto corrido para em ~72 caracteres (`LARGURA_TEXTO_CORRIDO`) e a coluna, em 760. */
const LARGURA_DE_LEITURA = 760;
const MINIMO_DA_LEITURA = 520;
const VAO = espaco(3);
/** Abaixo disto o índice vira o seletor "Assunto" no topo (celular, tablet em pé). */
const LIMITE_DO_INDICE = LARGURA_DO_INDICE + VAO + MINIMO_DA_LEITURA;
/** A partir disto cabe o "Nesta página" à direita do artigo (1280 de janela com o menu aberto fica abaixo). */
const LIMITE_DA_NESTA_PAGINA = LARGURA_DO_INDICE + VAO + 640 + VAO + LARGURA_DA_NESTA_PAGINA;
const LARGURA_DO_CONJUNTO = LARGURA_DO_INDICE + VAO + LARGURA_DE_LEITURA + VAO + LARGURA_DA_NESTA_PAGINA;
/** Quanto tempo o tópico pedido fica destacado. */
const DURACAO_DO_DESTAQUE = 2000;

/** Página inicial ("Começar a usar"): sem `?secao=` no endereço. */
const INICIO = 'comecar';

/**
 * Ajuda de cada área (o mesmo componente para treinador e aluno, cada um com o seu guia), em formato de documentação:
 * índice dos assuntos à esquerda, o artigo do assunto no meio e "Nesta página" (os tópicos, com o que está à vista
 * destacado) à direita. O assunto e o tópico moram no endereço (`?secao=<id>&topico=<id>`, o "Saiba mais" do ⓘ do
 * cabeçalho, `dominio/ajudaDaTela`); sem `secao`, a página inicial "Começar a usar". A busca, no topo, lista os tópicos
 * que casam, com o trecho, e Enter abre o primeiro. `videos` só muda no teste.
 */
export function TelaAjuda({ publico, videos = VIDEOS_DA_AJUDA }: { publico: Publico; videos?: VideosDaAjuda }) {
  const { width } = useWindowDimensions();
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
      <CorpoDaAjuda publico={publico} videos={videos} />
    </Tela>
  );
}

/** Dentro da `Tela`: só aqui o `useRolagem` enxerga a rolagem da tela. */
function CorpoDaAjuda({ publico, videos }: { publico: Publico; videos: VideosDaAjuda }) {
  const guia = GUIAS[publico];
  const { cicloHabilitado, retornoHabilitado, vitrineHabilitada, lojaHabilitada, contratosHabilitados, pode, perfilEquipe } = useSessao();
  const { rever } = usePasseio();
  const { rolarAte } = useRolagem();
  const [tutorial, setTutorial] = useState(false);
  const [busca, setBusca] = useState('');
  const { largura, aoMedir } = useFaixaDeLargura();
  const campo = useRef<TextInput>(null);

  // Textos como a tela mostra (sem a frase do ciclo, sem as seções das chaves desligadas): a busca procura no que se vê.
  const secoes: SecaoGuia[] = secoesDoGuia(guia, retornoHabilitado, vitrineHabilitada, lojaHabilitada, contratosHabilitados)
    .map((s) => ({ ...s, itens: s.itens.map((i) => ({ ...i, texto: textoDoItem(i.texto, cicloHabilitado) })) }));
  const artigos = artigosDaAjuda(secoes, guia.perguntas);
  const comPrimeirosPassos = publico === 'aluno' || temPrimeirosPassos({ pode, administrador: !!perfilEquipe?.acessoTotal });

  // O endereço é o dono do assunto aberto: seção que não existe nesta área (ou desligada) abre a página inicial.
  const { secao, topico } = useLocalSearchParams<{ secao?: string; topico?: string }>();
  const artigo = typeof secao === 'string' ? artigos.find((a) => a.id === secao) ?? null : null;
  const topicoPedido = artigo && typeof topico === 'string' && artigo.topicos.some((t) => t.id === topico) ? topico : null;
  const atual = artigo?.id ?? INICIO;

  // O tópico pedido fica destacado por um instante; cada pedido novo no endereço destaca de novo.
  const pedido = `${atual}#${topicoPedido ?? ''}`;
  const [pedidoVisto, setPedidoVisto] = useState(pedido);
  const [destaque, setDestaque] = useState<string | null>(topicoPedido);
  if (pedidoVisto !== pedido) {
    setPedidoVisto(pedido);
    setDestaque(topicoPedido);
  }
  useEffect(() => {
    if (!destaque) return undefined;
    const t = setTimeout(() => setDestaque(null), DURACAO_DO_DESTAQUE);
    return () => clearTimeout(t);
  }, [destaque]);
  const buscando = palavrasDaBusca(busca).length > 0;
  // O conteúdo só existe depois da primeira medida: o deep-link rola quando ele aparece.
  const medido = largura > 0;
  // Trocar de assunto leva ao topo do artigo; com tópico, ao tópico. Só a rolagem é efeito.
  useEffect(() => {
    if (medido) rolarAte([topicoPedido ? alvoDoTopico(topicoPedido) : ALVO_DO_ARTIGO]);
  }, [atual, topicoPedido, medido, rolarAte]);

  const resultados = buscarNaAjuda(artigos, busca);
  const lateral = largura >= LIMITE_DO_INDICE;
  const comNestaPagina = !!artigo && !buscando && largura >= LIMITE_DA_NESTA_PAGINA;
  const visivel = useTopicoVisivel(artigo?.topicos.map((t) => t.id) ?? [], comNestaPagina);

  const abrir = (id: string, topicoId?: string) => {
    setBusca('');
    if (id === atual && topicoId && topicoId === topicoPedido) {
      // O mesmo tópico de novo (o endereço não muda): rola e destaca sem passar pelo endereço.
      setDestaque(topicoId);
      rolarAte([alvoDoTopico(topicoId)]);
      return;
    }
    router.setParams({ secao: id === INICIO ? undefined : id, topico: topicoId });
  };
  const abrirResultado = (r: ResultadoDaBusca) => abrir(r.artigoId, r.topicoId);
  const limpar = () => {
    setBusca('');
    campo.current?.focus();
  };

  const entradas: EntradaDoIndice[] = [{ id: INICIO, rotulo: 'Começar a usar' }, ...artigos.map((a) => ({ id: a.id, rotulo: a.titulo, quantos: a.topicos.length }))];

  const conteudo = buscando ? (
    resultados.length ? <ResultadosDaBusca resultados={resultados} aoAbrir={abrirResultado} /> : (
      <Vazio titulo="Nenhum resultado" texto="Tente outra palavra, um sinônimo ou o nome da tela." acao={{ rotulo: 'Limpar busca', aoTocar: limpar }} />
    )
  ) : artigo ? (
    <View style={estilos.artigoENestaPagina}>
      <View style={estilos.leitura}>
        <ArtigoDaAjuda artigo={artigo} videos={videos[publico][artigo.id]} destaque={destaque} />
      </View>
      {comNestaPagina ? (
        <NestaPagina largura={LARGURA_DA_NESTA_PAGINA} topicos={artigo.topicos} atual={Math.min(visivel.atual, artigo.topicos.length - 1)}
          aoEscolher={(i) => {
            visivel.marcar(i);
            rolarAte([alvoDoTopico(artigo.topicos[i].id)]);
          }} />
      ) : null}
    </View>
  ) : (
    <PaginaInicialDaAjuda publico={publico} guia={guia} artigos={artigos} comPrimeirosPassos={comPrimeirosPassos}
      aoTutorial={() => setTutorial(true)} aoConhecerOMenu={rever} aoAbrir={(id) => abrir(id)} />
  );

  return (
    <View onLayout={aoMedir}>
      <View testID="bloco-da-ajuda" style={estilos.conjunto}>
        <Cabecalho titulo="Ajuda" descricao={guia.introducao} />
        {largura === 0 ? null : (
          <View style={lateral ? estilos.colunas : estilos.pilha}>
            {lateral ? <IndiceDaAjuda largura={LARGURA_DO_INDICE} entradas={entradas} atual={atual} aoEscolher={(id) => abrir(id)} /> : null}
            {/* A busca fica sempre no mesmo lugar da árvore: trocar de índice para seletor não tira o foco de quem digita. */}
            <View style={estilos.principal}>
              <View style={estilos.topo}>
                <View style={estilos.busca}>
                  <Campo ref={campo} rotulo="Buscar na ajuda" valor={busca} aoMudar={setBusca} placeholder="Palavra de um assunto, tela ou botão"
                    autoCorrect={false} inputMode="search" enterKeyHint="search" returnKeyType="search"
                    onSubmitEditing={() => { if (resultados[0]) abrirResultado(resultados[0]); }} />
                </View>
                {Platform.OS === 'web' ? (
                  <Botao rotulo="Abrir o guia (PDF)" rotuloAcessivel={`Abrir o guia (PDF): ${guia.titulo.toLowerCase()}`} tipo="secundario" Icone={FileDown}
                    aoTocar={() => void Linking.openURL(`/guias/${guia.arquivoPdf}`)} />
                ) : null}
              </View>
              {/* O número de resultados é anunciado ao leitor de tela enquanto a pessoa digita. */}
              <View accessibilityLiveRegion="polite" aria-live="polite">
                {buscando ? <Texto variante="suave" numerico>{textoDoResultado(resultados.length)}</Texto> : null}
              </View>
              {/* No celular a lista abre numa Folha: gravar o assunto no endereço com ela aberta seria desfeito pelo fechar. */}
              {!lateral ? (
                <EscolhaSuspensa rotulo="Assunto" titulo="Assuntos da ajuda" valor={atual} rotuloDaBusca="Buscar assunto" textoVazio="Nenhum assunto encontrado."
                  opcoes={entradas.map((e) => ({ valor: e.id, rotulo: e.rotulo, detalhe: e.quantos === undefined ? undefined : `${e.quantos} ${e.quantos === 1 ? 'tópico' : 'tópicos'}` }))}
                  aoMudar={(id) => depoisDeFecharAsFolhas(() => abrir(id))} />
              ) : null}
              {conteudo}
            </View>
          </View>
        )}
        {tutorial ? <TutorialGuiado passos={guia.tutorial} aoFechar={() => setTutorial(false)} /> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  conjunto: { width: '100%', maxWidth: LARGURA_DO_CONJUNTO, alignSelf: 'flex-start', gap: espaco(3) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  pilha: { gap: espaco(3) },
  principal: { flex: 1, minWidth: 0, gap: espaco(2) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1.5) },
  busca: { flexGrow: 1, flexBasis: 280, maxWidth: LARGURA_DE_LEITURA },
  artigoENestaPagina: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  leitura: { flex: 1, minWidth: 0, maxWidth: LARGURA_DE_LEITURA },
});
