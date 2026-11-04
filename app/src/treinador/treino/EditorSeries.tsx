import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { Configuracao, Serie } from '../../api/tipos';
import { agrupar, type GrupoDeSeries } from '../../dominio/agrupamento';
import { adicionarSerie, alterarEsforcoDaSerie, alterarGrupo, alterarPercentuais, LIMITE_SERIES, moverGrupo, mudarQuantidade, novoExercicio, removerGrupo, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { grupoComSerie, uidDaAbaAposMudar } from '../../dominio/inspetorDoTreino';
import { assinaturaDoEsforco, marcaConfere, origemAposConteudo, origemAoTrocarTipo, restPauseNestaSerie, textoDaContagemDeSeries, type MarcaDeOrigem } from '../../dominio/exemplosDePrescricao';
import { codigoTrabalho, esforcoInicial, nomeDoTipo, tipoPorCodigo } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { AvisoDoCampo, ErroDoCampo, useCamposLadoALado } from './CamposDaPrescricao';
import { EditorGrupo, nivelDoGrupo, Tecnicas, Tipos, type Nivel } from './EditorDoGrupoDeSeries';
import { type EscolhaDeTecnica, opcoesDeTecnica, opcoesDeTipo, problemasDoExercicioSemSeries, problemasPorSerie } from './opcoesDoEditor';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  modalidade: string | null;
  aoMudar: (series: Serie[]) => void;
  /**
   * Aba aberta controlada por quem usa (o editor de treino guarda uma por exercício, para o "ir ao primeiro" abrir a série
   * com problema): uid de uma série qualquer do grupo; nulo ou desconhecido = o primeiro grupo. Sem `aoAbrirGrupo`, o
   * componente guarda a aba sozinho (receita de séries do Planejamento).
   */
  grupoAbertoUid?: string | null;
  aoAbrirGrupo?: (serieUid: string | null) => void;
  /** Exercício sem carga (elástico, peso corporal): a prévia não fala de carga. */
  semCarga?: boolean;
  /**
   * Séries de um exercício com carga, fora do cardio: só aí a carga fixa em kg é oferecida. Falso na receita de séries,
   * que não é de um exercício (a mesma regra da metodologia).
   */
  exercicioComCarga?: boolean;
  /** `false` no grupo cujo descanso é depois da volta: a leitura não repete o descanso da série. */
  descansoPorSerie?: boolean;
}

/**
 * Séries do exercício: uma aba por grupo ("Série 2 · Trabalho"), o "+ Nova série" tracejado no fim da faixa e, embaixo, o
 * cartão do grupo da aba aberta. O cartão do grupo tem seções nesta ordem: tipo e técnica, estrutura (séries completas,
 * repetições e os campos da técnica), carga, esforço, descanso, observação desta série e "Para o aluno" no fim. Séries
 * iguais e seguidas formam um grupo e se editam juntas; o percentual de cada série é próprio. Cada campo mostra o erro e o
 * aviso da validação (a mesma da publicação) e a prévia diz como o aluno vai ler. Exercício de cardio só tem a prescrição de
 * cardio.
 */
export function EditorSeries({ series, config, modalidade, aoMudar: aoMudarFora, grupoAbertoUid, aoAbrirGrupo, semCarga = false, exercicioComCarga = false, descansoPorSerie = true }: Props) {
  const { cores } = useTema();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const cardio = modalidade === 'CARDIO';
  const grupos = agrupar(series);
  // Lado a lado pela largura desta coluna, não da janela: no inspetor de 1280 a janela é larga e a coluna não.
  const janelaLarga = useCamposLadoALado();
  const [largura, setLargura] = useState<number | null>(ultimaLargura);
  const largo = janelaLarga && (largura === null || largura >= LARGURA_LADO_A_LADO);
  const medir = (e: LayoutChangeEvent) => { ultimaLargura = e.nativeEvent.layout.width; setLargura(ultimaLargura); };
  const [painel, setPainel] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [tecnicaNova, setTecnicaNova] = useState<EscolhaDeTecnica>('NENHUMA');
  // Uma aba por grupo; quem controla é o editor de treino (D8) quando passa `aoAbrirGrupo`, mesmo antes do primeiro toque.
  const [abertoInterno, setAbertoInterno] = useState<string | null>(null);
  const controlado = aoAbrirGrupo !== undefined;

  const guardado = controlado ? grupoAbertoUid ?? null : abertoInterno;
  const grupoAberto = grupoComSerie(series, guardado);
  const uidAberto = grupoAberto?.series[0].uid ?? null;
  // Compara com o guardado, não com o exibido: nulo (ou a 2ª série do grupo) precisa virar o uid certo ao mover ou tirar séries.
  const definirAberto = (uid: string | null) => {
    if (uid === guardado) return;
    if (aoAbrirGrupo) aoAbrirGrupo(uid);
    else setAbertoInterno(uid);
  };
  /** Toda mudança nas séries passa por aqui: a aba aberta segue o grupo (ou passa ao vizinho, se ele sumiu). */
  const aoMudar = (novas: Serie[], abrir?: string | null) => {
    aoMudarFora(novas);
    definirAberto(abrir !== undefined ? abrir : uidDaAbaAposMudar(series, novas, uidAberto));
  };
  /**
   * Esforço e tipo que a metodologia preencheu nesta abertura, por uid. Não vai para o JSON. Substituição externa
   * apaga a marca; voltar ao mesmo número não a recria.
   */
  const [origemDoEsforco, setOrigemDoEsforco] = useState<ReadonlyMap<string, MarcaDeOrigem>>(() => new Map());
  const origemVigente = origemAposConteudo(origemDoEsforco, series);
  if (origemVigente !== origemDoEsforco) setOrigemDoEsforco(origemVigente);
  const cheio = series.length >= LIMITE_SERIES;
  const tipos = opcoesDeTipo(cfg, series);
  const validacao = useMemo(() => {
    const r = validarExercicio({ ...novoExercicio(), nome: 'Exercício', modalidade, series }, cfg);
    return {
      porSerieErros: problemasPorSerie(r.erros, r.avisos, series.length),
      daLista: problemasDoExercicioSemSeries(r.erros),
      avisosDaLista: problemasDoExercicioSemSeries(r.avisos),
    };
  }, [series, cfg, modalidade]);
  /** Série nova (e receita) abre a aba nova, a do último grupo (D12). */
  const doUltimo = (novas: Serie[]) => agrupar(novas).at(-1)?.series[0].uid ?? null;
  const aindaDoTipo = (s: Serie) => marcaConfere(origemVigente.get(s.uid), s);
  const gravarOrigem = (itens: readonly Serie[], ligar: boolean) => setOrigemDoEsforco((atual) => {
    const n = new Map(origemAposConteudo(atual, series));
    for (const s of itens) {
      if (ligar && (s.esforco?.rir != null || s.esforco?.rpe != null)) n.set(s.uid, { assinatura: assinaturaDoEsforco(s.esforco), tipo: s.tipo ?? null });
      else n.delete(s.uid);
    }
    return n;
  });
  const marcarNovasDoTipo = (antes: readonly Serie[], depois: readonly Serie[]) => {
    const conhecidas = new Set(antes.map((s) => s.uid));
    gravarOrigem(depois.filter((s) => !conhecidas.has(s.uid) && tipoPorCodigo(cfg, s.tipo)), true);
  };
  const adicionar = () => {
    const novas = adicionarSerie(series, cfg, tipoNovo ?? undefined, tecnicaNova === 'NENHUMA' ? null : tecnicaNova, modalidade);
    const conhecidas = new Set(series.map((s) => s.uid));
    const criadas = novas.filter((s) => !conhecidas.has(s.uid));
    const ultimo = grupos.at(-1);
    const mesmoGrupo = !!ultimo && criadas.length > 0
      && (ultimo.series[0].tipo ?? null) === (criadas[0].tipo ?? null)
      && (ultimo.series[0].tecnica?.tipo ?? null) === (criadas[0].tecnica?.tipo ?? null);
    if (mesmoGrupo) gravarOrigem(criadas, ultimo.series.every(aindaDoTipo));
    else marcarNovasDoTipo(series, novas);
    aoMudar(novas, doUltimo(novas));
    setPainel(false);
  };
  const adicionarCardio = () => {
    const novas = adicionarSerie(series, cfg, undefined, null, modalidade);
    aoMudar(novas, doUltimo(novas));
  };
  const abrirPainel = () => {
    if (!painel) { setTipoNovo(codigoTrabalho(cfg) ?? tipos[0]?.valor ?? null); setTecnicaNova('NENHUMA'); }
    setPainel(!painel);
  };
  const motivoCheio = cheio ? `O exercício já tem ${LIMITE_SERIES} séries, o máximo.` : undefined;
  const alterar = (g: GrupoDeSeries, m: AlteracaoDeGrupo) => {
    const novas = alterarGrupo(series, g, m, cfg, modalidade);
    const uids = new Set(g.series.map((s) => s.uid));
    const tocadas = novas.filter((s) => uids.has(s.uid));
    if (m.esforco !== undefined) gravarOrigem(tocadas, false);
    else if (m.tipo !== undefined && m.tipo !== (g.series[0].tipo ?? null)) {
      const tipo = tipoPorCodigo(cfg, m.tipo);
      const marcas = origemAoTrocarTipo(tocadas, tipo ? esforcoInicial(tipo, modalidade) : null);
      setOrigemDoEsforco((atual) => {
        const n = new Map(origemAposConteudo(atual, novas));
        for (const s of tocadas) n.delete(s.uid);
        if (marcas) for (const [uid, marca] of marcas) n.set(uid, marca);
        return n;
      });
    }
    aoMudar(novas);
  };
  /** RIR de uma série só (índice na lista do exercício): o grupo continua um só, e a marca de "veio do padrão" sai dela. */
  const rirDaSerie = (indice: number, valor: number) => {
    const alvo = series[indice];
    if (alvo) gravarOrigem([alvo], false);
    aoMudar(alterarEsforcoDaSerie(series, indice, valor));
  };
  const quantidade = (g: GrupoDeSeries, n: number) => {
    const novas = mudarQuantidade(series, g, n, cfg);
    const conhecidas = new Set(series.map((s) => s.uid));
    gravarOrigem(novas.filter((s) => !conhecidas.has(s.uid)), g.series.every(aindaDoTipo));
    aoMudar(novas);
  };
  const iAberto = grupoAberto ? grupos.findIndex((g) => g.series[0].uid === uidAberto) : -1;
  const g = iAberto >= 0 ? grupos[iAberto] : null;
  const rotuloDaNova = cardio ? 'Novo cardio' : 'Nova série';
  const aoNova = cardio ? adicionarCardio : abrirPainel;
  const nova = <Botao rotulo={rotuloDaNova} tipo="secundario" Icone={Plus} desabilitado={cheio} motivo={motivoCheio} aoTocar={aoNova} />;
  return <View style={estilos.lista} onLayout={medir}>
    {grupos.length > 0 ? <Abas variante="invertida" fundo={cores.superficie} ativa={uidAberto ?? grupos[0].series[0].uid} aoMudar={definirAberto}
      abas={grupos.map((x, i) => ({
        valor: x.series[0].uid,
        rotulo: `Série ${i + 1}${cardio ? '' : ` · ${tipos.find((t) => t.valor === x.series[0].tipo)?.rotulo ?? nomeDoTipo(cfg, x.series[0].tipo)}`}`,
        detalhe: detalheDaAba(x),
        problema: problemaDaAba(nivelDoGrupo(validacao.porSerieErros, x)),
      }))}
      // Cheio, o botão sai da linha das abas: desabilitado ele perdia o tracejado e o motivo ficava escondido.
      depois={cheio ? undefined : <Botao rotulo={rotuloDaNova} tipo="secundario" Icone={Plus} style={estilos.tracejado} aoTocar={aoNova} />} />
      : <View style={estilos.vazio}>
        <Texto variante="suave">Nenhuma série ainda.</Texto>
        <LinhaDeAcoes>{nova}</LinhaDeAcoes>
      </View>}
    {grupos.length > 0 && cheio ? <LinhaDeAcoes>{nova}</LinhaDeAcoes> : null}
    <ErroDoCampo mensagem={validacao.daLista.series} />
    <AvisoDoCampo mensagem={validacao.avisosDaLista.series} />
    {/* Bloco próprio, para não se confundir com os campos do grupo aberto; o "Nova série" da faixa abre e fecha. */}
    {painel && !cardio ? <View style={[estilos.painel, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Texto variante="bloco">Nova série</Texto>
      <Tipos rotulo="Tipo da série" opcoes={tipos} valor={tipoNovo} aoMudar={setTipoNovo} />
      <Texto variante="pequeno">O tipo diz para que a série serve. A técnica diz como executar.</Texto>
      <Tecnicas rotulo="Técnica" opcoes={opcoesDeTecnica(cfg)} valor={tecnicaNova} aoMudar={setTecnicaNova} />
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar série" tipo="secundario" Icone={Plus} aoTocar={adicionar} desabilitado={cheio || !tipoNovo} motivo={motivoCheio ?? (!tipoNovo ? 'Escolha o tipo da série.' : undefined)} />
        <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={() => setPainel(false)} />
      </LinhaDeAcoes>
    </View> : null}
    {g ? <EditorGrupo key={g.series[0].uid} largo={largo} largura={largura} grupo={g} series={series} config={cfg} cardio={cardio} semCarga={semCarga} exercicioComCarga={exercicioComCarga} descansoPorSerie={descansoPorSerie}
      tipos={tipos} podeMais={!cheio} primeiro={iAberto === 0} ultimo={iAberto === grupos.length - 1} numero={iAberto + 1}
      porSerie={validacao.porSerieErros}
      esforcoVeioDoPadrao={g.series.length > 0 && g.series.every(aindaDoTipo)}
      aoMover={(d) => aoMudar(moverGrupo(series, iAberto, d))}
      aoAlterar={(m) => alterar(g, m)}
      aoQuantidade={(n) => quantidade(g, n)}
      aoRestPauseNaUltima={() => aoMudar(restPauseNestaSerie(series, g, cfg))}
      aoPercentuais={(j, min, max) => aoMudar(alterarPercentuais(series, g.inicio + j, min, max))}
      aoRir={(j, valor) => rirDaSerie(g.inicio + j, valor)}
      aoRemover={() => aoMudar(removerGrupo(series, g))} /> : null}
    <Texto variante="pequeno">{textoDaContagemDeSeries(series.length)}</Texto>
  </View>;
}

/** "3 séries": quantas séries completas o grupo tem, quando são mais de uma (o tipo já está no rótulo da aba). */
function detalheDaAba(g: GrupoDeSeries): string | undefined {
  return g.series.length > 1 ? `${g.series.length} séries` : undefined;
}

function problemaDaAba(nivel: Nivel): 'perigo' | 'atencao' | undefined {
  return nivel === 'sucesso' ? undefined : nivel;
}

/**
 * A partir desta largura da coluna das séries, Tipo e Técnica ficam lado a lado e o recuo cresce: 1440 e 1024
 * cabem; o inspetor de 1280 (uns 560 px) empilha. Repetições, Carga, Esforço e Descanso seguem `colunasDaPrescricao`.
 */
const LARGURA_LADO_A_LADO = 640;
/**
 * Última largura medida: o cartão do exercício remonta ao trocar de exercício, e todos têm a mesma largura (sem piscar).
 * shortcut: na 1ª montagem ainda não há medida e vale a janela (`useCamposLadoALado`), um quadro só; se piscar, medir mais acima.
 */
let ultimaLargura: number | null = null;

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  painel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.5) },
  vazio: { gap: espaco(1) },
  // "+ Nova série" depois das abas: tracejado, para ler como "lugar de mais uma" e não como outra aba.
  tracejado: { borderStyle: 'dashed', alignSelf: 'center' },
});
