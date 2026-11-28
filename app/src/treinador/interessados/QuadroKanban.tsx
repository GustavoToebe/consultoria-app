import { Ellipsis, GripVertical } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { ContagensInscricoes, FiltroDaFila, InscricaoResumo, SituacaoInscricao } from '../../api/inscricoesTipos';
import { etapaDaInscricao, listarInscricoes } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { podeConfirmarPagamento } from '../../dominio/cobrancaDoInteressado';
import { instanteRelativo } from '../../dominio/datasRelativas';
import { dataParaTela, inteiroComMilhar } from '../../dominio/formatos';
import {
  destinoDaColuna,
  destinosDoCartao,
  estaAberta,
  ETAPAS_ABERTAS,
  FILTROS_INSCRICOES,
  podeAceitarPago,
  seloDaSituacao,
  seloDoRetorno,
  SITUACOES_ENCERRADAS,
  temDuplicidade,
  textoDaColuna,
  type DestinoDoCartao,
} from '../../dominio/inscricoes';
import { planoEscolhidoNaPagina } from '../../dominio/planosDaInscricao';
import { alvoSobOPonteiro } from '../../dominio/reordenar';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { ItemArrastavel, useArraste, type Arraste } from '../../ui/ArrasteDaLista';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import type { PedidoDaFolha } from './FolhaDaInscricao';

type ArrasteDoQuadro = Arraste<InscricaoResumo, SituacaoInscricao>;

/** Cartões por vez em cada coluna; "Carregar mais" soma outro tanto, até o máximo de uma página da API. */
const POR_VEZ = 20;
const MAXIMO_NA_COLUNA = 100;
/** A partir desta largura do quadro as colunas ficam lado a lado; abaixo, uma de cada vez. */
const LARGURA_LADO_A_LADO = 760;

export type FiltrosDoQuadro = Omit<FiltroDaFila, 'situacao' | 'pagina' | 'tamanho'>;

/**
 * Kanban das inscrições: uma coluna por etapa aberta (e as encerradas, se pedidas), cada uma paginada no servidor.
 * Mover entre etapas abertas vai direto à API (com a versão do cartão); aceitar, encerrar e reabrir abrem a confirmação
 * na folha da inscrição. Arrastar (a peça `ui/ArrasteDaLista`, plano `docs/planos/arrastar-com-copia-translucida.md` D5:
 * no mouse o cartão inteiro depois de 4 px, no toque o toque longo; só com as colunas lado a lado) e o ⋯ do cartão
 * ("Mover para", teclado e leitor de tela) fazem o mesmo. O cartão só muda de coluna quando as colunas recarregam depois
 * da resposta: nunca fica num lugar falso. `etapas` (o filtro do endereço, `?etapas=`) limita o quadro a essas colunas,
 * sem "Mostrar encerradas"; quem sai delas some do quadro.
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
  const { pode } = useSessao();
  const [largura, setLargura] = useState(0);
  const [encerradas, setEncerradas] = useState(false);
  const [ativa, setAtiva] = useState<SituacaoInscricao>('NOVA');
  const [mover, setMover] = useState<InscricaoResumo | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);
  const ladoALado = largura >= LARGURA_LADO_A_LADO;
  const situacoes: SituacaoInscricao[] = etapas?.length ? [...etapas] : [...ETAPAS_ABERTAS, ...(encerradas ? SITUACOES_ENCERRADAS : [])];
  const colunaAtiva = situacoes.includes(ativa) ? ativa : situacoes[0];
  const visiveis = ladoALado ? situacoes : situacoes.filter((s) => s === colunaAtiva);
  const rotulo = (s: SituacaoInscricao) => FILTROS_INSCRICOES.find((f) => f.valor === s)?.rotulo ?? seloDaSituacao(s).texto;
  const contagem = (s: SituacaoInscricao) => contagens?.porSituacao[s];

  const executar = (item: InscricaoResumo, destino: DestinoDoCartao) => {
    setMover(null);
    // Um pedido de cada vez por cartão: o segundo sairia com a versão velha e voltaria 409.
    if (movendo === item.id) return;
    if (destino.tipo === 'aceitar') {
      if (podeAceitarPago(item.situacao, item.pagamento)) return aoAbrir(item.id, { tipo: 'aceitar' });
      avisar('Confirme o pagamento na inscrição antes de aceitar, ou use Aceitar sem cobrança.', 'neutro');
      // Já abre o "Confirmar pagamento?" com o plano escolhido; depois dele, o Aceitar da folha fica liberado.
      return aoAbrir(item.id, pode('INSCRICAO_ALTERAR') && podeConfirmarPagamento(item.situacao, item.pagamento) ? { tipo: 'confirmar_pagamento' } : undefined);
    }
    if (destino.tipo === 'encerrar') return aoAbrir(item.id, { tipo: 'encerrar', situacao: destino.situacao });
    if (destino.tipo === 'reabrir') return aoAbrir(item.id, { tipo: 'reabrir' });
    const anterior = item.situacao;
    const falhou = (e: unknown) => {
      setMovendo(null);
      if (codigoApi(e) === 'CONFLITO_EDICAO') avisar('A inscrição foi alterada em outro lugar. Recarregamos o quadro.', 'neutro');
      else avisar(textoDoErro(e), 'perigo');
      aoMudou();
    };
    setMovendo(item.id);
    etapaDaInscricao(item.id, destino.situacao, item.versao).then((r) => {
      setMovendo(null);
      // Desfazer só entre etapas abertas: volta à etapa de antes com a versão da resposta (409 = alterada em outro lugar).
      const desfazer = estaAberta(anterior)
        ? { rotulo: 'Desfazer', aoTocar: () => etapaDaInscricao(item.id, anterior, r.versao).then(() => { avisar(`Voltou para ${rotulo(anterior)}.`, 'neutro'); aoMudou(); }, falhou) }
        : undefined;
      avisar(`Movido para ${destino.rotulo}.`, 'sucesso', desfazer);
      aoMudou();
    }, falhou);
  };

  // Arrastar entre colunas (D5): o alvo é a coluna sob o ponteiro, pela faixa de x (as colunas têm alturas diferentes).
  const arraste = useArraste<InscricaoResumo, SituacaoInscricao>({
    ativo: ladoALado,
    encaixar: false,
    destino: (_de, ponto, colunas) => alvoSobOPonteiro([...colunas], ponto, true),
    aoSoltar: (item, alvo) => {
      const destino = destinoDaColuna(item.situacao, alvo);
      if (destino) executar(item, destino);
      else if (alvo !== item.situacao) avisar('Esta inscrição não pode ir para essa coluna. Use "Mover para" no ⋯ do cartão.', 'neutro');
      return !!destino;
    },
  });
  const recebe = (s: SituacaoInscricao) => !!arraste.de && destinoDaColuna(arraste.de.situacao, s) !== null;

  return (
    <View style={estilos.quadro} onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}>
      <View style={estilos.topo}>
        {!ladoALado ? (
          <View style={estilos.caber}>
            <Escolha rotulo="Coluna" valor={colunaAtiva} aoMudar={setAtiva}
              opcoes={situacoes.map((s) => ({ valor: s, rotulo: contagem(s) === undefined ? rotulo(s) : `${rotulo(s)} · ${inteiroComMilhar(contagem(s)!)}` }))} />
          </View>
        ) : null}
        {etapas?.length ? null : <CaixaSelecao rotulo="Mostrar encerradas" marcado={encerradas} aoMudar={setEncerradas} />}
      </View>
      <Texto variante="pequeno">{ladoALado ? 'Arraste pelo ⋮⋮ ou use o ⋯ do cartão.' : 'Use o ⋯ do cartão para mudar de etapa.'}</Texto>
      <View style={ladoALado ? estilos.colunasLado : estilos.colunasPilha}>
        {visiveis.map((s) => (
          <View key={s} ref={arraste.alvo(s)} collapsable={false} style={ladoALado ? estilos.colunaLado : null}>
            <Coluna situacao={s} titulo={rotulo(s)} total={contagem(s)} filtros={filtros} rodada={rodada} movendo={movendo}
              arraste={arraste} recebe={recebe(s)} aoAbrir={aoAbrir} aoMover={setMover} />
          </View>
        ))}
      </View>
      <Folha visivel={!!mover} titulo={mover ? `Mover ${mover.nome}` : 'Mover'} aoFechar={() => setMover(null)}>
        {mover ? <DestinosDoCartao situacao={mover.situacao} rotuloDaEtapa={seloDaSituacao(mover.situacao).texto} aoEscolher={(d) => executar(mover, d)} /> : null}
      </Folha>
    </View>
  );
}

/**
 * Destinos do "Mover para" (P3 de `docs/design-e-front.md` 4.6): uma ação por linha, todas da mesma largura
 * (`ItemDeLista`, como a `FolhaDeAcoes`), em dois grupos. "Mudar de etapa" vale na hora; aceitar, encerrar e reabrir
 * só abrem a confirmação na folha da inscrição (encerrar e reabrir pedem o motivo), por isso ficam à parte, com
 * Recusar e Desistiu em vermelho como o painel deles.
 */
function DestinosDoCartao({ situacao, rotuloDaEtapa, aoEscolher }: {
  situacao: SituacaoInscricao;
  rotuloDaEtapa: string;
  aoEscolher: (destino: DestinoDoCartao) => void;
}) {
  const destinos = destinosDoCartao(situacao);
  if (destinos.length === 0) return <Texto variante="suave">Inscrição aceita: abra a ficha do aluno.</Texto>;
  const etapas = destinos.filter((d) => d.tipo === 'etapa');
  const decisoes = destinos.filter((d) => d.tipo !== 'etapa');
  const linha = (d: DestinoDoCartao) => (
    <ItemDeLista key={`${d.tipo}:${'situacao' in d ? d.situacao : ''}`} titulo={d.rotulo} perigo={d.tipo === 'encerrar'} aoTocar={() => aoEscolher(d)} />
  );
  // Encerrada só tem "Reabrir atendimento": o grupo dispensa o título (a etapa atual já diz por quê).
  const tituloDasDecisoes = etapas.length ? 'Aceitar ou encerrar' : null;
  return (
    <View style={estilos.destinos}>
      <Texto variante="suave">Etapa atual: {rotuloDaEtapa}.</Texto>
      {etapas.length ? (
        <View style={estilos.grupo} role="group" aria-label="Mudar de etapa">
          <Texto variante="rotulo">Mudar de etapa</Texto>
          <Texto variante="pequeno">Muda na hora.</Texto>
          {etapas.map(linha)}
        </View>
      ) : null}
      <View style={estilos.grupo} role="group" aria-label={tituloDasDecisoes ?? 'Reabrir'}>
        {tituloDasDecisoes ? <Texto variante="rotulo">{tituloDasDecisoes}</Texto> : null}
        <Texto variante="pequeno">Abre a confirmação antes de valer.</Texto>
        {decisoes.map(linha)}
      </View>
    </View>
  );
}

function Coluna({ situacao, titulo, total, filtros, rodada, movendo, arraste, recebe, aoAbrir, aoMover }: {
  situacao: SituacaoInscricao;
  titulo: string;
  total: number | undefined;
  filtros: FiltrosDoQuadro;
  rodada: number;
  movendo: string | null;
  arraste: ArrasteDoQuadro;
  /** O cartão em arraste pode ir para esta coluna. */
  recebe: boolean;
  aoAbrir: (id: string) => void;
  aoMover: (item: InscricaoResumo) => void;
}) {
  const { cores } = useTema();
  const [limite, setLimite] = useState(POR_VEZ);
  const chave = `kanban:${situacao}:${JSON.stringify(filtros)}:${rodada}:${limite}`;
  const lista = useCarregar(chave, () => listarInscricoes({ ...filtros, situacao, pagina: 0, tamanho: limite }));
  const itens = lista.dados?.itens ?? [];
  const totalDaColuna = total ?? lista.dados?.total;
  const mostrando = textoDaColuna(itens.length, totalDaColuna);
  const cabe = (totalDaColuna ?? 0) > itens.length && limite < MAXIMO_NA_COLUNA;
  // Destino de agora (D5): borda na cor de ação, fundo `acaoSuave` e o espaço tracejado no topo, onde o cartão entra.
  const destacada = recebe && arraste.para === situacao;
  const vazia = !!lista.dados && itens.length === 0;
  return (
    <View style={[estilos.coluna, destacada ? { borderColor: cores.acao, backgroundColor: cores.acaoSuave } : { borderColor: cores.borda, backgroundColor: cores.superficie }]}
      accessibilityRole="list" accessibilityLabel={`${titulo}: ${inteiroComMilhar(totalDaColuna ?? itens.length)}`}>
      <View style={[estilos.cabecalho, { backgroundColor: cores.superficie3 }]}>
        <Texto variante="bloco" nivel={2}>{titulo}</Texto>
        <Texto variante="suave" numerico>{totalDaColuna === undefined ? '—' : inteiroComMilhar(totalDaColuna)}</Texto>
      </View>
      {mostrando ? <Texto variante="pequeno">{mostrando}</Texto> : null}
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
      {!lista.dados && !lista.erro ? <Esqueleto /> : null}
      {destacada ? (
        <View aria-hidden style={[estilos.entrada, { borderColor: cores.acao, minHeight: arraste.origem?.h ?? ALVO_TOQUE * 2 }]}>
          <Texto variante="rotulo" cor={cores.acao}>Solte aqui</Texto>
        </View>
      ) : vazia ? <Texto variante="suave">{recebe ? 'Solte aqui' : 'Nenhuma inscrição.'}</Texto> : null}
      {itens.map((i) => (
        <CartaoDoQuadro key={i.id} item={i} arraste={arraste} movendo={movendo === i.id} aoAbrir={() => aoAbrir(i.id)} aoMover={() => aoMover(i)} />
      ))}
      {cabe ? <Botao rotulo="Carregar mais" tipo="secundario" aoTocar={() => setLimite(Math.min(MAXIMO_NA_COLUNA, limite + POR_VEZ))} carregando={lista.carregando} /> : null}
      {!cabe && (totalDaColuna ?? 0) > itens.length ? <Texto variante="pequeno">Para ver todas, use a busca ou a visão Lista.</Texto> : null}
    </View>
  );
}

/**
 * Cartão do quadro (D5): ⋮⋮ à esquerda do nome (só o sinal: no mouse o cartão inteiro arrasta depois de 4 px e clicar abre
 * a inscrição; no toque, toque longo) e o ⋯ no canto, que abre os destinos ("Mover para"), com o nome acessível de antes.
 */
function CartaoDoQuadro({ item, arraste, movendo, aoAbrir, aoMover }: {
  item: InscricaoResumo;
  arraste: ArrasteDoQuadro;
  movendo: boolean;
  aoAbrir: () => void;
  aoMover: () => void;
}) {
  const { cores } = useTema();
  // Soltar depois de arrastar não pode valer também como clique (abriria a folha da inscrição por cima da mudança).
  const tocar = () => { if (!arraste.arrastouHaPouco()) aoAbrir(); };
  const hoje = hojeEmBrasilia();
  const retorno = item.proximoRetorno;
  const seloRetorno = retorno ? seloDoRetorno(retorno.data, hoje) : null;
  return (
    <ItemArrastavel arraste={arraste} indice={item}>
      {/* `pan-y`: na web por toque, o dedo sobre os cartões ainda rola a página. */}
      <GestureDetector gesture={arraste.gesto(item).enabled(arraste.ativo && !movendo)} touchAction="pan-y">
        <View style={[estilos.cartao, { borderColor: cores.borda, backgroundColor: cores.superficie2, opacity: movendo ? 0.5 : 1, paddingLeft: arraste.ativo ? espaco(0.5) : espaco(1) },
          Platform.OS === 'web' ? estilos.semSelecao : null]}>
          {arraste.ativo ? (
            <View aria-hidden importantForAccessibility="no-hide-descendants" style={estilos.alca}>
              <GripVertical size={18} color={cores.textoSuave} strokeWidth={2} />
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Abrir inscrição de ${item.nome}`} onPress={tocar} style={estilos.abrir}>
            {/* Nome → (a etapa é a coluna) → próximo retorno → responsável; o resto é contexto. Cor só na exceção. */}
            <Texto variante="bloco" numberOfLines={2}>{item.nome}</Texto>
            {retorno || item.ciclo > 1 || temDuplicidade(item.duplicidade) ? (
              <View style={estilos.selos}>
                {retorno ? <Selo texto={seloRetorno ? `Retorno: ${seloRetorno.texto}` : `Retorno ${dataParaTela(retorno.data)}`} tipo={seloRetorno?.tipo ?? 'neutro'} /> : null}
                {item.ciclo > 1 ? <Selo texto={`${item.ciclo}º atendimento`} tipo="neutro" /> : null}
                {temDuplicidade(item.duplicidade) ? <Selo texto="Possível duplicidade" tipo="atencao" /> : null}
              </View>
            ) : null}
            <Texto variante="pequeno">{item.responsavelNome ?? (item.responsavelId ? 'Membro inativo' : 'Sem responsável')} · {instanteRelativo(item.ultimaAtividadeEm)}</Texto>
            {/* A proposta vale mais; sem ela, o plano que a pessoa escolheu na página (ou o texto de "Outro"). */}
            {item.propostaPlanoNome || planoEscolhidoNaPagina(item)
              ? <Texto variante="pequeno" numberOfLines={1}>Plano: {item.propostaPlanoNome ?? planoEscolhidoNaPagina(item)}</Texto> : null}
            {item.indicadoPor ? <Texto variante="pequeno" numberOfLines={1}>Indicado por: {item.indicadoPor}</Texto> : null}
          </Pressable>
          <IconeBotao Icone={Ellipsis} rotulo={`Mover ${item.nome} para`} aoTocar={aoMover} />
        </View>
      </GestureDetector>
    </ItemArrastavel>
  );
}

const estilos = StyleSheet.create({
  quadro: { gap: espaco(1.5) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(3), rowGap: espaco(1) },
  caber: { flexShrink: 1, maxWidth: '100%' },
  colunasLado: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start' },
  colunasPilha: { gap: espaco(1.5) },
  colunaLado: { flex: 1, minWidth: 0 },
  coluna: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), gap: espaco(1) },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: RAIO, paddingHorizontal: espaco(1), minHeight: ALVO_TOQUE },
  entrada: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  cartao: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(1), paddingRight: espaco(0.5), gap: espaco(0.5) },
  alca: { width: 20, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  abrir: { flex: 1, minWidth: 0, gap: 2, minHeight: ALVO_TOQUE },
  semSelecao: { userSelect: 'none' } as never,
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5) },
  destinos: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
});
