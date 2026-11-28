import { NotebookTabs, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { Configuracao, PapelDaSerie, Serie, TipoDeTecnica } from '../../api/tipos';
import { agrupar, tituloDoGrupoDeSeries, type GrupoDeSeries } from '../../dominio/agrupamento';
import { adicionarSerie, alterarGrupoComANova, LIMITE_SERIES, moverGrupo, mudarQuantidade, novoExercicio, removerGrupo, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { grupoComSerie, uidDaAbaAposMudar } from '../../dominio/inspetorDoTreino';
import { restPauseNestaSerie } from '../../dominio/exemplosDePrescricao';
import { resumoDoBloco } from '../../dominio/editorDeTreino';
import { corDoTipoDeSerie } from '../../dominio/corDaSerie';
import { codigoTrabalho, nomeDoTipo, papelDe, tecnicaNaMetodologia } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { corDaSerie } from '../../ui/pinturaDaSerie';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { cargaDoBloco, FALTA_A_CARGA } from './cargaDaSerie';
import { AvisoDoCampo, ErroDoCampo } from './CamposDaPrescricao';
import { EditorGrupo, faltaCargaNoGrupo, nivelDoGrupo, type Nivel } from './EditorDoGrupoDeSeries';
import { LARGURA_DAS_COLUNAS, TabelaDeBlocos } from './TabelaDeBlocos';
import { reordenarPorPassos } from '../../dominio/reordenar';
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
  /** `false` no membro de superset/circuito cujo descanso é depois da volta: a série não acusa "Falta o descanso". */
  descansoPorSerie?: boolean;
  /** Abre a folha de receitas; com ela, o estado vazio oferece "Usar receita" antes dos botões de tipo (D13). */
  aoUsarReceita?: () => void;
}

/** A ordem dos botões de 1 clique do "+ Nova série" (FS, WS, Back off, Aquecimento), pelo papel do tipo. */
const ORDEM_DOS_PAPEIS: PapelDaSerie[] = ['PREPARACAO', 'TRABALHO', 'POS_TRABALHO', 'AQUECIMENTO', 'OUTRO'];
/** As técnicas que ganham botão próprio: criam uma série de trabalho já com a técnica. */
const TECNICAS_DE_1_CLIQUE: TipoDeTecnica[] = ['REST_PAUSE', 'CLUSTER', 'DROP_SET'];

/**
 * Séries do exercício: uma aba por grupo ("Série 2 · WS"), o "+ Nova série" tracejado depois das abas (que mostra os botões
 * de 1 clique, "+ FS", "+ WS", "+ Rest pause"...) e, embaixo, o grupo da aba aberta (`EditorDoGrupoDeSeries`): o formulário
 * em linhas e a prévia do aluno ao lado (embaixo, na coluna estreita). Séries iguais e seguidas formam um grupo e se editam
 * juntas; o % e o RIR de cada série são próprios. Cada campo mostra o erro e o aviso da validação (a mesma da publicação).
 */
export function EditorSeries({ series, config, cardio, aoMudar: aoMudarFora, grupoAbertoUid, aoAbrirGrupo, semCarga = false, descansoPorSerie = true, aoUsarReceita }: Props) {
  const { identificacao, cores, preferencias } = useTema();
  const unidade = useUnidadeDeCarga();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const modalidade = cardio ? 'CARDIO' : null;
  const grupos = agrupar(series);
  // A prévia do aluno ao lado do formulário pela largura desta coluna, não da janela (no inspetor de 1280 a coluna é estreita).
  // Sem medida ainda, embaixo: a janela larga não diz que a coluna cabe, e a prévia pularia de lado para baixo.
  const [largura, setLargura] = useState<number | null>(ultimaLargura);
  const previaAoLado = largura !== null && largura >= LARGURA_DA_PREVIA_AO_LADO;
  const medir = (e: LayoutChangeEvent) => { ultimaLargura = e.nativeEvent.layout.width; setLargura(ultimaLargura); };
  // Uma aba por grupo; quem controla é o editor de treino (D8) quando passa `aoAbrirGrupo`, mesmo antes do primeiro toque.
  const [abertoInterno, setAbertoInterno] = useState<string | null>(null);
  const controlado = aoAbrirGrupo !== undefined;

  const guardado = controlado ? grupoAbertoUid ?? null : abertoInterno;
  // Séries no padrão da dieta (19/11): tocar na série aberta fecha. O sentinela vem antes do `grupoComSerie`, que trata
  // uid desconhecido (e nulo) como "o primeiro grupo"; nulo continua sendo a primeira aberta, como antes.
  const fechado = guardado === NENHUM_BLOCO_ABERTO;
  const grupoAberto = fechado ? null : grupoComSerie(series, guardado);
  const uidAberto = grupoAberto?.series[0].uid ?? null;
  // A série que a pessoa abriu (o guardado, se é do grupo; senão a 1ª): é a chave do editor e o que segue a aba depois de
  // uma mudança. Pela 1ª do grupo, juntar a aberta ao grupo de cima (o − de um bloco que a deixa igual à anterior) trocava
  // a chave e remontava o editor, perdendo o modo dos blocos e o foco (S10, `EditorSeries.chave.test.tsx`).
  const uidDaSerieAberta = guardado !== null && grupoAberto?.series.some((s) => s.uid === guardado) ? guardado : uidAberto;
  // Compara com o guardado, não com o exibido: nulo (ou a 2ª série do grupo) precisa virar o uid certo ao mover ou tirar séries.
  const definirAberto = (uid: string | null) => {
    if (uid === guardado) return;
    if (aoAbrirGrupo) aoAbrirGrupo(uid);
    else setAbertoInterno(uid);
  };
  /** Toda mudança nas séries passa por aqui: a aba aberta segue o grupo (ou passa ao vizinho, se ele sumiu). */
  const aoMudar = (novas: Serie[], abrir?: string | null) => {
    aoMudarFora(novas);
    // Tudo fechado continua fechado (arrastar não reabre a série 1); série nova e receita abrem a delas.
    if (abrir !== undefined) definirAberto(abrir);
    else if (!fechado) definirAberto(uidDaAbaAposMudar(series, novas, uidDaSerieAberta));
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
  };
  const motivoCheio = cheio ? `O exercício já tem ${LIMITE_SERIES} séries, o máximo.` : undefined;
  // A série que o "+ Nova série" acabou de somar ao bloco aberto: o tipo e a técnica escolhidos depois valem só para ela
  // (`alterarGrupoComANova`), sem reescrever as séries que já estavam no bloco. Abrir outro bloco esquece.
  const [uidDaNova, setUidDaNova] = useState<string | null>(null);
  const alterar = (g: GrupoDeSeries, m: AlteracaoDeGrupo) => {
    const r = alterarGrupoComANova(series, g, m, cfg, uidDaNova);
    if (r.separou) aoMudar(r.series, r.abrir);
    else aoMudar(r.series);
  };
  const iAberto = grupoAberto ? grupos.findIndex((g) => g.series[0].uid === uidAberto) : -1;
  const g = iAberto >= 0 ? grupos[iAberto] : null;
  const rotuloDaNova = cardio ? 'Novo cardio' : 'Nova série';
  // 27/11: "+ Nova série" (a última linha da tabela) já adiciona a série (a de trabalho da metodologia, `novaSerie`) e a
  // abre em edição; o tipo e a técnica se trocam nela. Os botões de 1 clique ("+ FS", "+ Cluster"…) ficam no estado vazio.
  const aoNova = () => {
    const novas = adicionarSerie(series, cfg, undefined, null, modalidade);
    setUidDaNova(novas.length > series.length ? novas[novas.length - 1].uid : null);
    aoMudar(novas, doUltimo(novas));
  };
  const nova = <Botao rotulo={rotuloDaNova} tipo="secundario" Icone={Plus} desabilitado={cheio} motivo={motivoCheio} aoTocar={aoNova} />;
  const botoesDaNova = cardio || cheio ? null : <BotoesDeNovaSerie config={cfg} aoAdicionar={adicionar} />;
  // Estreito (390): a linha vira divulgação e o editor abre logo abaixo da série escolhida (guia premium pág. 9).
  const empilhado = largura !== null && largura < LARGURA_DAS_COLUNAS;
  const editor = g ? <EditorGrupo key={uidDaSerieAberta} aoFechar={() => definirAberto(NENHUM_BLOCO_ABERTO)} previaAoLado={previaAoLado} grupo={g} series={series} config={cfg} cardio={cardio} semCarga={semCarga}
    descansoSoDoGrupo={!descansoPorSerie}
    tipos={tipos} podeMais={!cheio} numero={iAberto + 1}
    porSerie={validacao.porSerieErros}
    aoAlterar={(m) => alterar(g, m)}
    aoMudarSeries={(novas) => aoMudar(novas)}
    aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, cfg))}
    aoRestPauseNaUltima={() => aoMudar(restPauseNestaSerie(series, g, cfg))}
    aoRemover={() => aoMudar(removerGrupo(series, g))} /> : null;
  return <View style={estilos.lista} onLayout={medir}>
    {grupos.length > 0 ? <TabelaDeBlocos ativa={uidAberto} aoMudar={(uid) => { setUidDaNova(null); definirAberto(uid ?? NENHUM_BLOCO_ABERTO); }}
      empilhado={empilhado} detalhe={editor}
      // "Mover para cima/baixo" do ⋯ de cada linha (a alternativa ao arrastar): o bloco anda e a aberta vai junto.
      aoMover={(i, d) => aoMudar(moverGrupo(series, i, d))}
      // Arrastar (18/11): a mesma regra da seta (`moverGrupo`), um vizinho por vez, achando o bloco pela 1ª série dele.
      aoSoltar={(de, para) => {
        const uid = grupos[de]?.series[0].uid;
        aoMudar(reordenarPorPassos(series, para, (s) => agrupar(s).findIndex((x) => x.series.some((y) => y.uid === uid)), moverGrupo));
      }}
      semCarga={semCarga}
      linhas={grupos.map((x, i) => {
        const faltaCarga = !cardio && faltaCargaNoGrupo(validacao.porSerieErros, x);
        const chaveCor = corDoTipoDeSerie(x.series[0].tipo, papelDe(cfg, x.series[0].tipo));
        const tipo = cardio ? undefined : tipos.find((t) => t.valor === x.series[0].tipo)?.rotulo ?? nomeDoTipo(cfg, x.series[0].tipo);
        return {
          valor: x.series[0].uid,
          rotulo: `Série ${i + 1}${tipo ? ` · ${tipo}` : ''}`,
          serie: `Série ${i + 1}`,
          tipo,
          ...comCor(corDaSerie(preferencias?.corDasSeries ?? 'TIPO', chaveCor, identificacao, cores)),
          carga: cardio ? '—' : faltaCarga ? FALTA_A_CARGA : cargaDoBloco(x, cfg, unidade),
          cargaFalta: faltaCarga,
          // Cardio e membro de grupo com o descanso depois da volta não acusam "Falta o descanso".
          resumo: resumoDoBloco(x, cfg, { ignorarDescanso: cardio || !descansoPorSerie }),
          problema: problemaDaAba(nivelDoGrupo(validacao.porSerieErros, x)),
          edicao: `Editando série ${i + 1}${cardio ? '' : `, ${tituloDoGrupoDeSeries(x, cfg)}`}`,
        };
      })}
      // Cheio, a linha sai do fim da tabela: o botão desabilitado com o motivo fica embaixo dela.
      nova={cheio ? undefined : { rotulo: rotuloDaNova, aoTocar: aoNova }} />
      : <View style={estilos.vazio}>
        <Texto variante="suave">Nenhuma série ainda.</Texto>
        {aoUsarReceita ? <LinhaDeAcoes><Botao rotulo="Usar receita de séries" tipo="acao" Icone={NotebookTabs} aoTocar={aoUsarReceita} /></LinhaDeAcoes> : null}
        {botoesDaNova ?? <LinhaDeAcoes>{nova}</LinhaDeAcoes>}
      </View>}
    {grupos.length > 0 && cheio ? <LinhaDeAcoes>{nova}</LinhaDeAcoes> : null}
    <ErroDoCampo mensagem={validacao.daLista.series} />
    <AvisoDoCampo mensagem={validacao.avisosDaLista.series} />
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

/** Cor da linha e do selo (o selo fica neutro no modo "Cor de ação"; cardio e "Outro" ficam sem cor). */
function comCor(c: ReturnType<typeof corDaSerie>): { cor: string | null; categoria?: { cor: string; fundo: string } } {
  return { cor: c.cor, categoria: c.categoria ?? undefined };
}

function problemaDaAba(nivel: Nivel): 'perigo' | 'atencao' | undefined {
  return nivel === 'sucesso' ? undefined : nivel;
}

/**
 * A partir desta largura da coluna das séries, a prévia do aluno fica à direita do formulário (SERIE-ABERTA, seção 1: ~900).
 * 920 = prévia (340) + vão (24) + recuos do corpo (24) e a faixa da série (4) + formulário de ~528, ainda acima do
 * `LARGURA_PARA_EMPILHAR` (520) das linhas. Em 1920 com o menu aberto a coluna tem ~996: a prévia fica ao lado.
 */
const LARGURA_DA_PREVIA_AO_LADO = 920;
/** Nenhuma série aberta (tocar na aberta ou "Fechar edição"): nunca é uid de série (`novoUid` gera UUID). */
const NENHUM_BLOCO_ABERTO = 'nenhum-bloco-aberto';

/**
 * Última largura medida: o cartão do exercício remonta ao trocar de exercício, e todos têm a mesma largura (sem piscar).
 * shortcut: na 1ª montagem ainda não há medida e a prévia abre embaixo por um quadro; se o salto incomodar, medir mais acima.
 */
let ultimaLargura: number | null = null;

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  juntos: { gap: espaco(0.5) },
  vazio: { gap: espaco(1) },
});
