import { router, type Href } from 'expo-router';
import { FileDown, MousePointerClick, PlayCircle, RotateCcw } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View, type TextInput, type ViewStyle } from 'react-native';

import { AVISO_DE_VOLTA, mostrarDeNovo, temPrimeirosPassos } from '../dominio/primeirosPassos';
import { useSessao } from '../sessao/SessaoProvider';
import { usePrimeirosPassosGuardados } from '../treinador/painel/usePrimeirosPassosGuardados';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { AlvoDeRolagem } from '../ui/AlvoDeRolagem';
import { Botao } from '../ui/Botao';
import { Cabecalho } from '../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { EscolhaEmFolha } from '../ui/EscolhaEmFolha';
import { Alerta, Vazio } from '../ui/Estados';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { usePasseio } from '../ui/Passeio';
import { useRolagem } from '../ui/RolagemComTopo';
import { sobre } from '../ui/sobre';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { buscarNaAjuda, palavrasDaBusca, textoDoResultado } from './busca';
import { GUIAS, secoesDoGuia, textoDoItem, type Guia, type Publico, type SecaoGuia } from './conteudo';
import { TutorialGuiado } from './TutorialGuiado';
import { VIDEOS_DA_AJUDA, type VideosDaAjuda } from './videos';
import { VideosDaSecao } from './VideosDaSecao';

/** Coluna de leitura: texto corrido, no máximo 800 (guia de 11/11, pág. 19); encolhe até 520 antes de o índice sair. */
const LARGURA_DE_LEITURA = 800;
const MINIMO_DA_LEITURA = 520;
const LARGURA_DO_INDICE = 232;
const VAO = espaco(3);
/** Índice + vão + leitura: a largura da tela no PC. */
const LARGURA_DA_AJUDA = LARGURA_DO_INDICE + VAO + LARGURA_DE_LEITURA;
/** Abaixo disto (medido ao lado do menu) o índice vira o seletor "Ir para o tópico" no topo. */
const LIMITE_DO_INDICE = LARGURA_DO_INDICE + VAO + MINIMO_DA_LEITURA;

const COMECAR = 'comecar';
const PRIMEIROS_PASSOS = 'primeiros-passos';
const PERGUNTAS = 'perguntas';
/** Chave de rolagem com prefixo: os ids das seções não colidem com os blocos fixos da tela. */
const alvo = (id: string) => `ajuda:${id}`;

type Pergunta = Guia['perguntas'][number];
interface Topico { id: string; rotulo: string }

/**
 * Ajuda de cada área (o mesmo componente para treinador e aluno, cada um com o seu guia). No topo, a busca (sem acento,
 * nos nomes e nos textos; reabre o que casou). "Começar a usar": o tutorial e o "Conhecer o menu", e os primeiros passos.
 * "Consultar": uma seção por cartão recolhível (`CabecalhoDeGrupo`), com os vídeos da seção quando existem
 * (`ajuda/videos.ts`), e as perguntas frequentes. No PC, o índice fica ao lado, fixo enquanto a página rola, com o tópico
 * escolhido destacado (seleção neutra, texto em negrito e o indicador da marca); estreito, vira o seletor "Ir para o
 * tópico". `videos` só muda no teste.
 */
export function TelaAjuda({ publico, videos = VIDEOS_DA_AJUDA }: { publico: Publico; videos?: VideosDaAjuda }) {
  const { width } = useWindowDimensions();
  return (
    <Tela bordas={['top']} largura={LARGURA_DA_AJUDA} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
      <CorpoDaAjuda publico={publico} videos={videos} />
    </Tela>
  );
}

/** Dentro da `Tela`: só aqui o `useRolagem` enxerga a rolagem da tela. */
function CorpoDaAjuda({ publico, videos }: { publico: Publico; videos: VideosDaAjuda }) {
  const guia = GUIAS[publico];
  const { cicloHabilitado, retornoHabilitado, pode, perfilEquipe } = useSessao();
  const { rever } = usePasseio();
  const { rolarAte } = useRolagem();
  const [tutorial, setTutorial] = useState(false);
  const [busca, setBusca] = useState('');
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());
  const [atual, setAtual] = useState(COMECAR);
  const [largura, setLargura] = useState(0);
  const campo = useRef<TextInput>(null);

  // Textos como a tela mostra (sem a frase do ciclo, sem as seções do retorno desligado): a busca procura no que se vê.
  const secoes: SecaoGuia[] = secoesDoGuia(guia, retornoHabilitado).map((s) => ({ ...s, itens: s.itens.map((i) => ({ ...i, texto: textoDoItem(i.texto, cicloHabilitado) })) }));
  const buscando = palavrasDaBusca(busca).length > 0;
  const achado = buscarNaAjuda(secoes, guia.perguntas, busca);
  const comPrimeirosPassos = publico === 'aluno' || temPrimeirosPassos({ pode, administrador: !!perfilEquipe?.acessoTotal });

  const topicos: Topico[] = [
    ...(buscando ? [] : [{ id: COMECAR, rotulo: 'Começar a usar' }, ...(comPrimeirosPassos ? [{ id: PRIMEIROS_PASSOS, rotulo: 'Primeiros passos' }] : [])]),
    ...achado.secoes.map((s) => ({ id: s.id, rotulo: s.titulo })),
    ...(achado.perguntas.length ? [{ id: PERGUNTAS, rotulo: 'Perguntas frequentes' }] : []),
  ];

  const buscar = (texto: string) => {
    setBusca(texto);
    // Buscar abre tudo o que casou (inclusive o que estava recolhido); limpar deixa aberto o que estava.
    if (palavrasDaBusca(texto).length) {
      const r = buscarNaAjuda(secoes, guia.perguntas, texto);
      setAbertas(new Set([...r.secoes.map((s) => s.id), ...(r.perguntas.length ? [PERGUNTAS] : [])]));
    }
  };
  const limpar = () => {
    setBusca('');
    campo.current?.focus();
  };
  const alternar = (id: string) => setAbertas((atuais) => {
    const novas = new Set(atuais);
    if (!novas.delete(id)) novas.add(id);
    return novas;
  });
  const irPara = (id: string) => {
    setAtual(id);
    setAbertas((atuais) => (atuais.has(id) ? atuais : new Set([...atuais, id])));
    rolarAte([alvo(id)]);
  };

  const lateral = largura >= LIMITE_DO_INDICE;
  const conteudo = (
    <View style={[estilos.leitura, lateral && estilos.leituraAoLado]}>
      {buscando ? null : (
        <>
          <AlvoDeRolagem chave={alvo(COMECAR)}>
            <Cartao titulo="Começar a usar">
              <Texto variante="suave">
                {`O tutorial passa pelas telas, na ordem em que você vai usá-las (${guia.tutorial.length} passos). "Conhecer o menu" destaca cada item do menu, como no primeiro acesso. Dá para sair dos dois a qualquer momento.`}
              </Texto>
              <LinhaDeAcoes>
                <Botao rotulo="Tutorial passo a passo" Icone={PlayCircle} aoTocar={() => setTutorial(true)} />
                <Botao rotulo="Conhecer o menu" tipo="secundario" Icone={MousePointerClick} aoTocar={rever} />
              </LinhaDeAcoes>
            </Cartao>
          </AlvoDeRolagem>
          {comPrimeirosPassos ? (
            <AlvoDeRolagem chave={alvo(PRIMEIROS_PASSOS)}>
              {publico === 'treinador' ? <CartaoPrimeirosPassosDoTreinador /> : <PrimeirosPassosDoAluno guia={guia} />}
            </AlvoDeRolagem>
          ) : null}
          <View style={estilos.consultar}>
            <View style={estilos.textoDoConsultar}>
              <Texto variante="bloco" nivel={2}>Consultar</Texto>
              <Texto variante="suave">
                {Platform.OS === 'web'
                  ? 'Os assuntos do app e as perguntas frequentes. O guia em PDF serve para ler com calma, imprimir ou enviar.'
                  : 'Os assuntos do app e as perguntas frequentes.'}
              </Texto>
            </View>
            {Platform.OS === 'web' ? (
              <Botao rotulo="Abrir o guia" rotuloAcessivel={`Abrir o guia (${guia.titulo.toLowerCase()} em PDF)`} tipo="secundario" Icone={FileDown}
                aoTocar={() => void Linking.openURL(`/guias/${guia.arquivoPdf}`)} />
            ) : null}
          </View>
        </>
      )}
      {buscando && achado.total === 0 ? (
        <Vazio titulo="Nenhum resultado" texto="Tente outra palavra, um sinônimo ou o nome da tela." acao={{ rotulo: 'Limpar busca', aoTocar: limpar }} />
      ) : null}
      {achado.secoes.map((s) => (
        <AlvoDeRolagem key={s.id} chave={alvo(s.id)}>
          <SecaoRecolhivel titulo={s.titulo} quantos={s.itens.length} aberta={abertas.has(s.id)} aoAlternar={() => alternar(s.id)}>
            <VideosDaSecao videos={videos[publico][s.id]} />
            {s.itens.map((item) => (
              <View key={item.titulo} style={estilos.item}>
                <Texto variante="rotulo" nivel={3}>{item.titulo}</Texto>
                <Texto>{item.texto}</Texto>
              </View>
            ))}
          </SecaoRecolhivel>
        </AlvoDeRolagem>
      ))}
      {achado.perguntas.length ? (
        <AlvoDeRolagem chave={alvo(PERGUNTAS)}>
          <SecaoRecolhivel titulo="Perguntas frequentes" quantos={achado.perguntas.length} unidade="pergunta"
            aberta={abertas.has(PERGUNTAS)} aoAlternar={() => alternar(PERGUNTAS)}>
            {achado.perguntas.map((p: Pergunta) => (
              <View key={p.pergunta} style={estilos.item}>
                <Texto variante="rotulo" nivel={3}>{p.pergunta}</Texto>
                <Texto>{p.resposta}</Texto>
              </View>
            ))}
          </SecaoRecolhivel>
        </AlvoDeRolagem>
      ) : null}
    </View>
  );

  return (
    <>
      <Cabecalho titulo="Ajuda" subtitulo={guia.introducao} />
      <View style={estilos.area} onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
        {/* A busca fica sempre no mesmo lugar da árvore: trocar de índice para seletor não tira o foco de quem digita. */}
        <View style={[estilos.busca, lateral && estilos.buscaAoLadoDoIndice]}>
          <Campo ref={campo} rotulo="Buscar na ajuda" valor={busca} aoMudar={buscar} placeholder="Palavra de um assunto, tela ou botão"
            autoCorrect={false} inputMode="search" />
          {/* O número de resultados é anunciado ao leitor de tela enquanto a pessoa digita. */}
          <View accessibilityLiveRegion="polite">
            {buscando ? <Texto variante="suave" numerico>{textoDoResultado(achado.total)}</Texto> : null}
          </View>
          {!lateral && largura > 0 && topicos.length > 1 ? (
            <EscolhaEmFolha rotulo="Ir para o tópico" titulo="Tópicos da ajuda" valor={atual} rotuloDoValor="Escolher"
              opcoes={topicos.map((t) => ({ valor: t.id, rotulo: t.rotulo }))} aoMudar={irPara} />
          ) : null}
        </View>
        {largura === 0 ? null : lateral ? (
          <View style={estilos.colunas}>
            <IndiceDaAjuda topicos={topicos} atual={atual} aoEscolher={irPara} />
            {conteudo}
          </View>
        ) : conteudo}
      </View>
      {tutorial ? <TutorialGuiado passos={guia.tutorial} aoFechar={() => setTutorial(false)} /> : null}
    </>
  );
}

/** Seção de "Consultar": cartão com a faixa recolhível; recolhida por padrão, a busca e o índice a abrem. */
function SecaoRecolhivel({ titulo, quantos, unidade = 'assunto', aberta, aoAlternar, children }: {
  titulo: string; quantos: number; unidade?: 'assunto' | 'pergunta'; aberta: boolean; aoAlternar: () => void; children: ReactNode;
}) {
  return (
    <Cartao cabecalho={<CabecalhoDeGrupo titulo={titulo} resumo={`${quantos} ${quantos === 1 ? unidade : `${unidade}s`}`} aberto={aberta} aoAlternar={aoAlternar} acoesJuntas />}>
      {aberta ? children : null}
    </Cartao>
  );
}

/**
 * Índice lateral do PC: fica parado enquanto a página rola (web) e rola sozinho se passar da altura da janela. O tópico
 * escolhido usa a seleção neutra (`superficie3`), texto principal em negrito e o indicador pequeno da marca; a cor nunca
 * é o único sinal.
 */
function IndiceDaAjuda({ topicos, atual, aoEscolher }: { topicos: readonly Topico[]; atual: string; aoEscolher: (id: string) => void }) {
  const { cores, marcaPeca } = useTema();
  const { height } = useWindowDimensions();
  const fixo = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), maxHeight: height - espaco(4), overflowY: 'auto' } : {}) as unknown as ViewStyle;
  return (
    <View role="navigation" aria-label="Tópicos da ajuda" style={[estilos.indice, fixo]}>
      {/* Busca sem resultado: a coluna fica (busca e "Nenhum resultado" não pulam de lugar), sem título vazio. */}
      {topicos.length ? <Texto variante="secao" style={estilos.tituloDoIndice}>Nesta página</Texto> : null}
      {topicos.map((t) => {
        const ativo = t.id === atual;
        return (
          <Pressable key={t.id} accessibilityRole="button" aria-current={ativo ? 'location' : undefined}
            onPress={() => aoEscolher(t.id)}
            style={(estado) => [estilos.topico, ativo ? { backgroundColor: cores.superficie3 } : sobre(estado) && { backgroundColor: cores.superficie2 }]}>
            {ativo ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
            <Texto style={{ color: ativo ? cores.texto : cores.textoSuave, fontFamily: ativo ? fontes.semi : fontes.medio }}>{t.rotulo}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

function PrimeirosPassosDoAluno({ guia }: { guia: Guia }) {
  const passos = guia.primeirosPassos.filter((p) => !p.soNoPdf);
  return (
    <Cartao titulo="Primeiros passos">
      {passos.map((p, i) => (
        <View key={p.titulo} style={estilos.passo}>
          <View style={estilos.textoDoPasso}>
            <Texto numerico variante="bloco">{i + 1}. {p.titulo}</Texto>
            <Texto variante="suave">{p.texto}</Texto>
          </View>
          {p.rota ? (
            <Botao rotulo="Abrir" rotuloAcessivel={`Abrir: ${p.titulo}`} tipo="secundario" aoTocar={() => router.navigate(p.rota as Href)} />
          ) : null}
        </View>
      ))}
    </Cartao>
  );
}

/**
 * Treinador: os Primeiros passos moram no Início (bloco no topo). Aqui fica o texto curto e o "Mostrar no Início de novo"
 * para quem dispensou ou fechou; a lista dos passos (o `guia.primeirosPassos`) segue no guia em PDF.
 */
function CartaoPrimeirosPassosDoTreinador() {
  const { usuario } = useSessao();
  const { estado, gravar } = usePrimeirosPassosGuardados(usuario?.id ?? null);
  const [voltou, setVoltou] = useState(false);
  const noInicio = !!estado && !estado.dispensado && !estado.fechado;
  const motivo = !estado ? 'Conferindo o que ficou salvo neste aparelho.' : noInicio && !voltou ? 'Eles já estão no Início.' : undefined;
  return (
    <Cartao titulo="Primeiros passos">
      <Texto variante="suave">
        No topo do Início, enquanto você monta a consultoria: marca e logo, metodologia, modelos de treino, o primeiro aluno, o acesso dele ao app e o link de inscrição. Cada item abre a tela certa. Se dispensou ou fechou, traga de volta por aqui.
      </Texto>
      {voltou ? <Alerta tom="sucesso" texto={AVISO_DE_VOLTA} /> : null}
      <LinhaDeAcoes>
        <Botao rotulo="Mostrar no Início de novo" tipo="secundario" Icone={RotateCcw} desabilitado={!!motivo || voltou} motivo={voltou ? undefined : motivo}
          aoTocar={() => {
            gravar(mostrarDeNovo);
            setVoltou(true);
          }} />
        {noInicio ? <Botao rotulo="Abrir o Início" tipo="fantasma" aoTocar={() => router.navigate('/treinador')} /> : null}
      </LinhaDeAcoes>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  area: { gap: espaco(3) },
  busca: { gap: espaco(1), maxWidth: LARGURA_DE_LEITURA, width: '100%' },
  // Sem largura fixa: ocupa o que sobra depois do índice (100% + margem passaria da borda com o texto maior).
  buscaAoLadoDoIndice: { marginLeft: LARGURA_DO_INDICE + VAO, width: 'auto' },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  leitura: { width: '100%', maxWidth: LARGURA_DE_LEITURA, gap: espaco(3) },
  leituraAoLado: { flex: 1, minWidth: 0, width: undefined },
  // A folga de 4 px deixa o anel de foco (2 px + 2 px) inteiro: o índice rola por dentro e cortaria a borda.
  indice: { width: LARGURA_DO_INDICE, alignSelf: 'flex-start', gap: 2, padding: 4 },
  tituloDoIndice: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1) },
  topico: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderRadius: RAIO },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  consultar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: espaco(1.5) },
  textoDoConsultar: { flex: 1, minWidth: 240, gap: espaco(0.5) },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap' },
  textoDoPasso: { flex: 1, minWidth: 220, gap: espaco(0.5) },
  item: { gap: espaco(0.25) },
});
