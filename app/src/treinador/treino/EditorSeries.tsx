import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { Configuracao, PapelDaSerie, Serie, TipoDeTecnica } from '../../api/tipos';
import { agrupar, type GrupoDeSeries } from '../../dominio/agrupamento';
import { adicionarSerie, alterarGrupo, LIMITE_SERIES, moverGrupo, mudarQuantidade, novoExercicio, removerGrupo, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { grupoComSerie, uidDaAbaAposMudar } from '../../dominio/inspetorDoTreino';
import { restPauseNestaSerie, textoDaContagemDeSeries } from '../../dominio/exemplosDePrescricao';
import { codigoTrabalho, nomeDoTipo, tecnicaNaMetodologia } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { AvisoDoCampo, ErroDoCampo, useCamposLadoALado } from './CamposDaPrescricao';
import { EditorGrupo, nivelDoGrupo, type Nivel } from './EditorDoGrupoDeSeries';
import { opcoesDeTecnica, opcoesDeTipo, problemasDoExercicioSemSeries, problemasPorSerie } from './opcoesDoEditor';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  /** Exercício de cardio: só a prescrição de cardio, sem tipo, técnica, carga nem RIR. */
  cardio: boolean;
  aoMudar: (series: Serie[]) => void;
  /**
   * Aba aberta controlada por quem usa (o editor de treino guarda uma por exercício, para o "ir ao primeiro" abrir a série
   * com problema): uid de uma série qualquer do grupo; nulo ou desconhecido = o primeiro grupo. Sem `aoAbrirGrupo`, o
   * componente guarda a aba sozinho (receita de séries do Planejamento).
   */
  grupoAbertoUid?: string | null;
  aoAbrirGrupo?: (serieUid: string | null) => void;
  /** Exercício sem carga (elástico, peso corporal): a faixa da carga fica só com o RIR. */
  semCarga?: boolean;
  /** `false` no grupo cujo descanso é depois da volta. Hoje só repassado: a leitura "Para o aluno" não fala de descanso. */
  descansoPorSerie?: boolean;
}

/** A ordem dos botões de 1 clique do "+ Nova série" (FS, WS, Back off, Aquecimento), pelo papel do tipo. */
const ORDEM_DOS_PAPEIS: PapelDaSerie[] = ['PREPARACAO', 'TRABALHO', 'POS_TRABALHO', 'AQUECIMENTO', 'OUTRO'];
/** As técnicas que ganham botão próprio: criam uma série de trabalho já com a técnica. */
const TECNICAS_DE_1_CLIQUE: TipoDeTecnica[] = ['REST_PAUSE', 'CLUSTER', 'DROP_SET'];

/**
 * Séries do exercício: uma aba por grupo ("Série 2 · WS"), o "+ Nova série" tracejado depois das abas (que mostra os botões
 * de 1 clique, "+ FS", "+ WS", "+ Rest pause"...) e, embaixo, o grupo da aba aberta (`EditorDoGrupoDeSeries`) em três faixas: tipo e técnica;
 * estrutura (séries, repetições e descanso numa linha que quebra); carga e RIR, uma linha por série. No rodapé, a observação
 * desta série e "Para o aluno". Séries iguais e seguidas formam um grupo e se editam juntas; o % e o RIR de cada série são
 * próprios. Cada campo mostra o erro e o aviso da validação (a mesma da publicação).
 */
export function EditorSeries({ series, config, cardio, aoMudar: aoMudarFora, grupoAbertoUid, aoAbrirGrupo, semCarga = false }: Props) {
  const { cores } = useTema();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const modalidade = cardio ? 'CARDIO' : null;
  const grupos = agrupar(series);
  // Lado a lado pela largura desta coluna, não da janela: no inspetor de 1280 a janela é larga e a coluna não.
  const janelaLarga = useCamposLadoALado();
  const [largura, setLargura] = useState<number | null>(ultimaLargura);
  const largo = janelaLarga && (largura === null || largura >= LARGURA_LADO_A_LADO);
  const medir = (e: LayoutChangeEvent) => { ultimaLargura = e.nativeEvent.layout.width; setLargura(ultimaLargura); };
  const [novaAberta, setNovaAberta] = useState(false);
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
  const adicionar = (tipo: string | undefined, tecnica: TipoDeTecnica | null) => {
    const novas = adicionarSerie(series, cfg, tipo, tecnica, modalidade);
    aoMudar(novas, doUltimo(novas));
    setNovaAberta(false);
  };
  const motivoCheio = cheio ? `O exercício já tem ${LIMITE_SERIES} séries, o máximo.` : undefined;
  const alterar = (g: GrupoDeSeries, m: AlteracaoDeGrupo) => aoMudar(alterarGrupo(series, g, m, cfg));
  const iAberto = grupoAberto ? grupos.findIndex((g) => g.series[0].uid === uidAberto) : -1;
  const g = iAberto >= 0 ? grupos[iAberto] : null;
  const rotuloDaNova = cardio ? 'Novo cardio' : 'Nova série';
  // Cardio não tem tipo: "Novo cardio" já adiciona. Na musculação, "Nova série" mostra os botões de 1 clique.
  const aoNova = cardio ? () => adicionar(undefined, null) : () => setNovaAberta(!novaAberta);
  const nova = <Botao rotulo={rotuloDaNova} tipo="secundario" Icone={Plus} desabilitado={cheio} motivo={motivoCheio} aoTocar={aoNova} />;
  const botoesDaNova = cardio || cheio ? null : <BotoesDeNovaSerie config={cfg} aoAdicionar={adicionar} />;
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
        {botoesDaNova ?? <LinhaDeAcoes>{nova}</LinhaDeAcoes>}
      </View>}
    {grupos.length > 0 && cheio ? <LinhaDeAcoes>{nova}</LinhaDeAcoes> : null}
    {grupos.length > 0 && novaAberta ? botoesDaNova : null}
    <ErroDoCampo mensagem={validacao.daLista.series} />
    <AvisoDoCampo mensagem={validacao.avisosDaLista.series} />
    {g ? <EditorGrupo key={g.series[0].uid} largo={largo} grupo={g} series={series} config={cfg} cardio={cardio} semCarga={semCarga}
      tipos={tipos} podeMais={!cheio} primeiro={iAberto === 0} ultimo={iAberto === grupos.length - 1} numero={iAberto + 1}
      porSerie={validacao.porSerieErros}
      aoMover={(d) => aoMudar(moverGrupo(series, iAberto, d))}
      aoAlterar={(m) => alterar(g, m)}
      aoMudarSeries={(novas) => aoMudar(novas)}
      aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, cfg))}
      aoRestPauseNaUltima={() => aoMudar(restPauseNestaSerie(series, g, cfg))}
      aoRemover={() => aoMudar(removerGrupo(series, g))} /> : null}
    <Texto variante="pequeno">{textoDaContagemDeSeries(series.length)}</Texto>
  </View>;
}

/**
 * Os botões de 1 clique: um por tipo da metodologia (na ordem FS, WS, Back off, Aquecimento) e, se a metodologia tem a
 * técnica e há tipo de trabalho, "Rest pause", "Cluster" e "Drop-set", que já criam a série de trabalho com ela.
 */
function BotoesDeNovaSerie({ config, aoAdicionar }: { config: Configuracao; aoAdicionar: (tipo: string | undefined, tecnica: TipoDeTecnica | null) => void }) {
  const ws = codigoTrabalho(config);
  const porTipo = ORDEM_DOS_PAPEIS.flatMap((papel) => config.tipos.filter((t) => t.papel === papel && t.codigo.trim()));
  const tecnicas = ws ? opcoesDeTecnica(config).filter((o): o is { valor: TipoDeTecnica; rotulo: string } =>
    o.valor !== 'NENHUMA' && TECNICAS_DE_1_CLIQUE.includes(o.valor) && tecnicaNaMetodologia(config, o.valor)) : [];
  return <View style={estilos.juntos} role="group" aria-label="Adicionar série">
    <Texto variante="rotulo">Adicionar</Texto>
    <LinhaDeAcoes>
      {porTipo.map((t) => <Botao key={t.codigo} rotulo={nomeDoTipo(config, t.codigo)} rotuloAcessivel={`Adicionar ${nomeDoTipo(config, t.codigo)}`} tipo="secundario" Icone={Plus}
        aoTocar={() => aoAdicionar(t.codigo, null)} />)}
      {tecnicas.map((o) => <Botao key={o.valor} rotulo={o.rotulo} rotuloAcessivel={`Adicionar ${nomeDoTipo(config, ws)} com ${o.rotulo}`} tipo="secundario" Icone={Plus}
        aoTocar={() => aoAdicionar(ws ?? undefined, o.valor)} />)}
    </LinhaDeAcoes>
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
 * A partir desta largura da coluna das séries, Tipo e Técnica ficam lado a lado e o "Mover grupo" tem texto: 1440 e 1024
 * cabem; o inspetor de 1280 (uns 560 px) empilha.
 */
const LARGURA_LADO_A_LADO = 640;
/**
 * Última largura medida: o cartão do exercício remonta ao trocar de exercício, e todos têm a mesma largura (sem piscar).
 * shortcut: na 1ª montagem ainda não há medida e vale a janela (`useCamposLadoALado`), um quadro só; se piscar, medir mais acima.
 */
let ultimaLargura: number | null = null;

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  juntos: { gap: espaco(0.5) },
  vazio: { gap: espaco(1) },
  // "+ Nova série" depois das abas: tracejado, para ler como "lugar de mais uma" e não como outra aba.
  tracejado: { borderStyle: 'dashed', alignSelf: 'center' },
});
