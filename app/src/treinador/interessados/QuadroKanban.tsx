import { ArrowRightLeft } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ContagensInscricoes, FiltroDaFila, InscricaoResumo, SituacaoInscricao } from '../../api/inscricoesTipos';
import { etapaDaInscricao, listarInscricoes } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { instanteRelativo } from '../../dominio/datasRelativas';
import { dataParaTela } from '../../dominio/formatos';
import {
  destinoDaColuna,
  destinosDoCartao,
  ETAPAS_ABERTAS,
  FILTROS_INSCRICOES,
  seloDaSituacao,
  seloDoRetorno,
  SITUACOES_ENCERRADAS,
  temDuplicidade,
  textoDaColuna,
  type DestinoDoCartao,
} from '../../dominio/inscricoes';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import type { PedidoDaFolha } from './FolhaDaInscricao';

/** Cartões por vez em cada coluna; "Carregar mais" soma outro tanto, até o máximo de uma página da API. */
const POR_VEZ = 20;
const MAXIMO_NA_COLUNA = 100;
/** A partir desta largura do quadro as colunas ficam lado a lado; abaixo, uma de cada vez. */
const LARGURA_LADO_A_LADO = 760;

export type FiltrosDoQuadro = Omit<FiltroDaFila, 'situacao' | 'pagina' | 'tamanho'>;

/**
 * Kanban das inscrições: uma coluna por etapa aberta (e as encerradas, se pedidas), cada uma paginada no servidor.
 * Mover entre etapas abertas vai direto à API (com a versão do cartão); aceitar, encerrar e reabrir abrem a confirmação
 * na folha da inscrição. Arrastar (toque longo) e "Mover para" (botão, teclado) fazem o mesmo. O cartão só muda de
 * coluna quando as colunas recarregam depois da resposta: nunca fica num lugar falso. `etapas` (o filtro do endereço,
 * `?etapas=`) limita o quadro a essas colunas, sem "Mostrar encerradas"; quem sai delas some do quadro.
 */
export function QuadroKanban({ filtros, contagens, rodada, etapas, aoAbrir, aoMudou }: {
  filtros: FiltrosDoQuadro;
  /** Só estas colunas, na ordem dada; ausente = as etapas abertas (e as encerradas, se pedidas). */
  etapas?: readonly SituacaoInscricao[];
  contagens: ContagensInscricoes | undefined;
  /** Muda depois de qualquer alteração na tela: as colunas recarregam. */
  rodada: number;
  aoAbrir: (id: string, pedido?: PedidoDaFolha) => void;
  aoMudou: () => void;
}) {
  const { avisar } = useAviso();
  const [largura, setLargura] = useState(0);
  const [encerradas, setEncerradas] = useState(false);
  const [ativa, setAtiva] = useState<SituacaoInscricao>('NOVA');
  const [mover, setMover] = useState<InscricaoResumo | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);
  const colunas = useRef(new Map<SituacaoInscricao, { x: number; y: number; w: number; h: number }>());
  const nos = useRef(new Map<SituacaoInscricao, View | null>());
  const ladoALado = largura >= LARGURA_LADO_A_LADO;
  const situacoes: SituacaoInscricao[] = etapas?.length ? [...etapas] : [...ETAPAS_ABERTAS, ...(encerradas ? SITUACOES_ENCERRADAS : [])];
  const colunaAtiva = situacoes.includes(ativa) ? ativa : situacoes[0];
  const visiveis = ladoALado ? situacoes : situacoes.filter((s) => s === colunaAtiva);
  const rotulo = (s: SituacaoInscricao) => FILTROS_INSCRICOES.find((f) => f.valor === s)?.rotulo ?? seloDaSituacao(s).texto;
  const contagem = (s: SituacaoInscricao) => contagens?.porSituacao[s];

  const executar = (item: InscricaoResumo, destino: DestinoDoCartao) => {
    setMover(null);
    if (destino.tipo === 'aceitar') return aoAbrir(item.id, { tipo: 'aceitar' });
    if (destino.tipo === 'encerrar') return aoAbrir(item.id, { tipo: 'encerrar', situacao: destino.situacao });
    if (destino.tipo === 'reabrir') return aoAbrir(item.id, { tipo: 'reabrir' });
    setMovendo(item.id);
    etapaDaInscricao(item.id, destino.situacao, item.versao).then(() => {
      setMovendo(null);
      avisar(`${item.nome}: ${destino.rotulo}.`, 'sucesso');
      aoMudou();
    }, (e: unknown) => {
      setMovendo(null);
      if (codigoApi(e) === 'CONFLITO_EDICAO') avisar('A inscrição foi alterada em outro lugar. Recarregamos o quadro.', 'neutro');
      else avisar(textoDoErro(e), 'perigo');
      aoMudou();
    });
  };

  /** Mede as colunas na janela antes de arrastar (a rolagem pode ter mudado desde a última medida). */
  const medir = () => {
    nos.current.forEach((no, s) => no?.measureInWindow((x, y, w, h) => colunas.current.set(s, { x, y, w, h })));
  };

  const soltar = (item: InscricaoResumo, x: number, y: number) => {
    let alvo: SituacaoInscricao | null = null;
    colunas.current.forEach((r, s) => { if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) alvo = s; });
    if (!alvo) return;
    const destino = destinoDaColuna(item.situacao, alvo);
    if (destino) executar(item, destino);
    else if (alvo !== item.situacao) avisar('Esta inscrição não pode ir para essa coluna. Use "Mover para".', 'neutro');
  };

  return (
    <View style={estilos.quadro} onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}>
      <View style={estilos.topo}>
        {!ladoALado ? (
          <View style={estilos.caber}>
            <Escolha rotulo="Coluna" valor={colunaAtiva} aoMudar={setAtiva}
              opcoes={situacoes.map((s) => ({ valor: s, rotulo: contagem(s) === undefined ? rotulo(s) : `${rotulo(s)} · ${contagem(s)}` }))} />
          </View>
        ) : null}
        {etapas?.length ? null : <CaixaSelecao rotulo="Mostrar encerradas" marcado={encerradas} aoMudar={setEncerradas} />}
      </View>
      <Texto variante="pequeno">
        {Platform.OS === 'web' ? 'Segure o cartão para arrastar, ou use "Mover para".' : 'Toque e segure o cartão para arrastar, ou use "Mover para".'}
      </Texto>
      <View style={ladoALado ? estilos.colunasLado : estilos.colunasPilha}>
        {visiveis.map((s) => (
          <View key={s} ref={(no) => { nos.current.set(s, no); }} collapsable={false}
            style={[estilos.colunaCaixa, ladoALado ? { flex: 1, minWidth: 0 } : null]}>
            <Coluna situacao={s} titulo={rotulo(s)} total={contagem(s)} filtros={filtros} rodada={rodada} movendo={movendo}
              aoAbrir={aoAbrir} aoMover={setMover} aoComecarArrasto={medir} aoSoltar={soltar} />
          </View>
        ))}
      </View>
      <Folha visivel={!!mover} titulo={mover ? `Mover ${mover.nome}` : 'Mover'} aoFechar={() => setMover(null)}>
        <View style={estilos.destinos}>
          {mover ? destinosDoCartao(mover.situacao).map((d) => (
            <Botao key={`${d.tipo}:${'situacao' in d ? d.situacao : ''}`} rotulo={d.rotulo}
              tipo={d.tipo === 'encerrar' ? 'perigoTexto' : 'secundario'} aoTocar={() => executar(mover, d)} />
          )) : null}
          {mover && destinosDoCartao(mover.situacao).length === 0 ? <Texto variante="suave">Inscrição aceita: abra a ficha do aluno.</Texto> : null}
        </View>
      </Folha>
    </View>
  );
}

function Coluna({ situacao, titulo, total, filtros, rodada, movendo, aoAbrir, aoMover, aoComecarArrasto, aoSoltar }: {
  situacao: SituacaoInscricao;
  titulo: string;
  total: number | undefined;
  filtros: FiltrosDoQuadro;
  rodada: number;
  movendo: string | null;
  aoAbrir: (id: string) => void;
  aoMover: (item: InscricaoResumo) => void;
  aoComecarArrasto: () => void;
  aoSoltar: (item: InscricaoResumo, x: number, y: number) => void;
}) {
  const { cores } = useTema();
  const [limite, setLimite] = useState(POR_VEZ);
  const chave = `kanban:${situacao}:${JSON.stringify(filtros)}:${rodada}:${limite}`;
  const lista = useCarregar(chave, () => listarInscricoes({ ...filtros, situacao, pagina: 0, tamanho: limite }));
  const itens = lista.dados?.itens ?? [];
  const totalDaColuna = total ?? lista.dados?.total;
  const mostrando = textoDaColuna(itens.length, totalDaColuna);
  const cabe = (totalDaColuna ?? 0) > itens.length && limite < MAXIMO_NA_COLUNA;
  return (
    <View style={[estilos.coluna, { borderColor: cores.borda, backgroundColor: cores.superficie }]}
      accessibilityRole="list" accessibilityLabel={`${titulo}: ${totalDaColuna ?? itens.length}`}>
      <View style={[estilos.cabecalho, { backgroundColor: cores.superficie3 }]}>
        <Texto variante="bloco" nivel={2}>{titulo}</Texto>
        <Texto variante="suave" numerico>{totalDaColuna ?? '—'}</Texto>
      </View>
      {mostrando ? <Texto variante="pequeno">{mostrando}</Texto> : null}
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
      {!lista.dados && !lista.erro ? <Esqueleto /> : null}
      {lista.dados && itens.length === 0 ? <Texto variante="suave">Nenhuma inscrição.</Texto> : null}
      {itens.map((i) => (
        <CartaoDoQuadro key={i.id} item={i} movendo={movendo === i.id} aoAbrir={() => aoAbrir(i.id)} aoMover={() => aoMover(i)}
          aoComecarArrasto={aoComecarArrasto} aoSoltar={(x, y) => aoSoltar(i, x, y)} />
      ))}
      {cabe ? <Botao rotulo="Carregar mais" tipo="secundario" aoTocar={() => setLimite(Math.min(MAXIMO_NA_COLUNA, limite + POR_VEZ))} carregando={lista.carregando} /> : null}
      {!cabe && (totalDaColuna ?? 0) > itens.length ? <Texto variante="pequeno">Para ver todas, use a busca ou a visão Lista.</Texto> : null}
    </View>
  );
}

function CartaoDoQuadro({ item, movendo, aoAbrir, aoMover, aoComecarArrasto, aoSoltar }: {
  item: InscricaoResumo;
  movendo: boolean;
  aoAbrir: () => void;
  aoMover: () => void;
  aoComecarArrasto: () => void;
  aoSoltar: (x: number, y: number) => void;
}) {
  const { cores } = useTema();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const arrastando = useSharedValue(0);
  // Soltar depois de arrastar não pode valer também como toque (abriria a folha da inscrição por cima da mudança).
  const arrastou = useSharedValue(0);
  const tocar = () => {
    if (arrastou.get()) {
      arrastou.set(0);
      return;
    }
    aoAbrir();
  };
  const estilo = useAnimatedStyle(() => {
    const a = arrastando.get();
    if (!a) return {};
    return { transform: [{ translateX: x.get() }, { translateY: y.get() }], zIndex: 10, opacity: 0.9 };
  });
  const gesto = Gesture.Pan().activateAfterLongPress(250)
    .onStart(() => { arrastando.set(1); arrastou.set(1); scheduleOnRN(aoComecarArrasto); })
    .onUpdate((e) => { x.set(e.translationX); y.set(e.translationY); })
    .onEnd((e) => { scheduleOnRN(aoSoltar, e.absoluteX, e.absoluteY); })
    .onFinalize(() => { arrastando.set(0); x.set(0); y.set(0); });
  const hoje = hojeEmBrasilia();
  const retorno = item.proximoRetorno;
  const seloRetorno = retorno ? seloDoRetorno(retorno.data, hoje) : null;
  return (
    <GestureDetector gesture={gesto}>
      <Animated.View style={[estilos.cartao, { borderColor: cores.borda, backgroundColor: cores.superficie2, opacity: movendo ? 0.5 : 1 }, estilo]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir inscrição de ${item.nome}`} onPress={tocar} style={estilos.abrir}>
          <Texto variante="bloco" numberOfLines={2}>{item.nome}</Texto>
          <Texto variante="pequeno">{item.responsavelNome ?? (item.responsavelId ? 'Membro inativo' : 'Sem responsável')} · {instanteRelativo(item.ultimaAtividadeEm)}</Texto>
          {item.propostaPlanoNome ? <Texto variante="pequeno" numberOfLines={1}>Plano: {item.propostaPlanoNome}</Texto> : null}
          <View style={estilos.selos}>
            {retorno ? <Selo texto={seloRetorno ? `Retorno: ${seloRetorno.texto}` : `Retorno ${dataParaTela(retorno.data)}`} tipo={seloRetorno?.tipo ?? 'neutro'} /> : null}
            {item.ciclo > 1 ? <Selo texto={`${item.ciclo}º atendimento`} tipo="neutro" /> : null}
            {temDuplicidade(item.duplicidade) ? <Selo texto="Possível duplicidade" tipo="atencao" /> : null}
          </View>
        </Pressable>
        <Botao rotulo="Mover para" rotuloAcessivel={`Mover ${item.nome} para`} Icone={ArrowRightLeft} tipo="fantasma" aoTocar={aoMover}
          desabilitado={movendo} motivo="Movendo." />
      </Animated.View>
    </GestureDetector>
  );
}

const estilos = StyleSheet.create({
  quadro: { gap: espaco(1.5) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(3), rowGap: espaco(1) },
  caber: { flexShrink: 1, maxWidth: '100%' },
  colunasLado: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start' },
  colunasPilha: { gap: espaco(1.5) },
  colunaCaixa: {},
  coluna: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), gap: espaco(1) },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: RAIO, paddingHorizontal: espaco(1), minHeight: ALVO_TOQUE },
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), gap: espaco(0.5) },
  abrir: { gap: 2, minHeight: ALVO_TOQUE },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5) },
  destinos: { gap: espaco(1) },
});
