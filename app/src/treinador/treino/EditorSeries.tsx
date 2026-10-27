import { ArrowDown, ArrowUp, Minus, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Configuracao, Serie } from '../../api/tipos';
import { agrupar, descreverGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import { blocosValidos } from '../../dominio/blocos';
import { adicionarSerie, alterarGrupo, alterarPercentuais, DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, moverGrupo, mudarQuantidade, novoExercicio, removerGrupo, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { assinaturaDoEsforco, marcaConfere, origemAposConteudo, origemAoTrocarTipo, podeRestPauseNaUltima, restPauseNestaSerie, textoDaContagemDeSeries, textoDaRevisaoDoEsforco, type MarcaDeOrigem } from '../../dominio/exemplosDePrescricao';
import { codigoTrabalho, esforcoInicial, explicacaoDaTecnica, explicacaoDoTipo, nomeDaSerieDeTrabalho, nomeDoTipo, papelDe, padraoDaTecnica, tecnicaDescritiva, tipoPorCodigo } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { previaDoGrupo } from '../../dominio/resumoDaSerie';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { AvisoDoCampo, CampoSozinho, CamposDaTecnica, CamposDasRepeticoes, CamposDoCardio, CamposDoEsforco, ErroDoCampo, EscolhaDeCarga, FaixaDeCarga, ReferenciaDaCarga, useCamposLadoALado } from './CamposDaPrescricao';
import {
  type EscolhaDeTecnica,
  opcoesDeReferencia,
  opcoesDeTecnica,
  opcoesDeTipo,
  referenciaDaCarga,
  problemasDoExercicioSemSeries,
  problemasDoGrupoDeSeries,
  problemasPorSerie,
  secoesDaSerie,
  subProblemas,
} from './opcoesDoEditor';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  modalidade: string | null;
  aoMudar: (series: Serie[]) => void;
  aoUsarReceita?: () => void;
  /** Exercício sem carga (elástico, peso corporal): a prévia não fala de carga. */
  semCarga?: boolean;
  /** `false` no grupo cujo descanso é depois da volta: a leitura não repete o descanso da série. */
  descansoPorSerie?: boolean;
}

/**
 * Séries do exercício. O cartão de cada grupo tem seções nesta ordem: tipo e técnica, estrutura (séries completas,
 * repetições e os campos da técnica), carga, esforço, descanso, alvo extra e "Para o aluno" no fim. Séries
 * iguais e seguidas formam um grupo e se editam juntas; o percentual de cada série é próprio. Cada campo mostra o erro e o
 * aviso da validação (a mesma da publicação) e a prévia diz como o aluno vai ler. Exercício de cardio só tem a prescrição de
 * cardio.
 */
export function EditorSeries({ series, config, modalidade, aoMudar, aoUsarReceita, semCarga = false, descansoPorSerie = true }: Props) {
  const { cores } = useTema();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const cardio = modalidade === 'CARDIO';
  const grupos = agrupar(series);
  const [painel, setPainel] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [tecnicaNova, setTecnicaNova] = useState<EscolhaDeTecnica>('NENHUMA');
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
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
  const alternar = (uid: string) => setAbertos((a) => { const novo = new Set(a); if (novo.has(uid)) novo.delete(uid); else novo.add(uid); return novo; });
  const abrirUltimo = (novas: Serie[]) => {
    const ultimo = agrupar(novas).at(-1);
    if (ultimo) setAbertos((a) => new Set(a).add(ultimo.series[0].uid));
  };
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
    aoMudar(novas);
    abrirUltimo(novas);
    setPainel(false);
  };
  const adicionarCardio = () => {
    const novas = adicionarSerie(series, cfg, undefined, null, modalidade);
    aoMudar(novas);
    abrirUltimo(novas);
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
  const quantidade = (g: GrupoDeSeries, n: number) => {
    const novas = mudarQuantidade(series, g, n, cfg);
    const conhecidas = new Set(series.map((s) => s.uid));
    gravarOrigem(novas.filter((s) => !conhecidas.has(s.uid)), g.series.every(aindaDoTipo));
    aoMudar(novas);
  };
  return <View style={estilos.lista}>
    {grupos.map((g, i) => <EditorGrupo key={g.series[0].uid} grupo={g} series={series} config={cfg} cardio={cardio} semCarga={semCarga} descansoPorSerie={descansoPorSerie}
      tipos={tipos} podeMais={!cheio} primeiro={i === 0} ultimo={i === grupos.length - 1}
      porSerie={validacao.porSerieErros}
      aberto={abertos.has(g.series[0].uid)} aoAlternar={() => alternar(g.series[0].uid)}
      esforcoVeioDoPadrao={g.series.length > 0 && g.series.every(aindaDoTipo)}
      aoMover={(d) => aoMudar(moverGrupo(series, i, d))}
      aoAlterar={(m) => alterar(g, m)}
      aoQuantidade={(n) => quantidade(g, n)}
      aoRestPauseNaUltima={() => aoMudar(restPauseNestaSerie(series, g, cfg))}
      aoPercentuais={(j, min, max) => aoMudar(alterarPercentuais(series, g.inicio + j, min, max))}
      aoRemover={() => aoMudar(removerGrupo(series, g))} />)}
    {series.length === 0 ? <Texto variante="suave">Nenhuma série ainda.</Texto> : null}
    <ErroDoCampo mensagem={validacao.daLista.series} />
    <AvisoDoCampo mensagem={validacao.avisosDaLista.series} />
    {/* Bloco próprio, para não se confundir com os campos do exercício; enquanto aberto, os botões de baixo somem. */}
    {painel && !cardio ? <View style={[estilos.painel, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Texto variante="bloco">Nova série</Texto>
      <Tipos rotulo="Tipo da série" opcoes={tipos} valor={tipoNovo} aoMudar={setTipoNovo} />
      <Texto variante="pequeno">O tipo diz para que a série serve. A técnica diz como executar.</Texto>
      <Tecnicas rotulo="Técnica" opcoes={opcoesDeTecnica(cfg)} valor={tecnicaNova} aoMudar={setTecnicaNova} />
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar série" tipo="secundario" Icone={Plus} aoTocar={adicionar} desabilitado={cheio || !tipoNovo} motivo={motivoCheio ?? (!tipoNovo ? 'Escolha o tipo da série.' : undefined)} />
        <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={() => setPainel(false)} />
      </LinhaDeAcoes>
    </View> : <LinhaDeAcoes>
      <Botao rotulo={cardio ? 'Adicionar cardio' : 'Adicionar série'} tipo="secundario" Icone={Plus} desabilitado={cheio} motivo={motivoCheio}
        aoTocar={cardio ? adicionarCardio : abrirPainel} />
      {aoUsarReceita && !cardio ? <Botao rotulo="Usar receita" tipo="secundario" Icone={NotebookTabs} aoTocar={aoUsarReceita} /> : null}
    </LinhaDeAcoes>}
    <Texto variante="pequeno">{textoDaContagemDeSeries(series.length)}</Texto>
  </View>;
}

/** Os tipos como chips pelo NOME (código só quando o tipo não está na metodologia); muitos tipos viram busca em folha. */
function Tipos({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string; opcoes: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; valor: string | null; aoMudar: (codigo: string) => void;
}) {
  const aoEscolher = (codigo: string | null) => { if (codigo) aoMudar(codigo); };
  if (opcoes.length > OPCOES_PARA_BUSCAR) {
    return <EscolhaEmFolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor as string | null, rotulo: o.rotulo, detalhe: o.foraDaMetodologia ? 'Fora da metodologia' : undefined }))}
      valor={valor} aoMudar={aoEscolher} rotuloDoValor="Escolha o tipo" />;
  }
  return <Escolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor as string | null, rotulo: o.rotulo }))} valor={valor} aoMudar={aoEscolher} />;
}

/** "Nenhuma" e as técnicas da metodologia. Acima de oito, a mesma folha dos tipos; a de fora fica com o detalhe. */
function Tecnicas({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string; opcoes: ReturnType<typeof opcoesDeTecnica>; valor: EscolhaDeTecnica; aoMudar: (v: EscolhaDeTecnica) => void;
}) {
  const aoEscolher = (v: EscolhaDeTecnica | null) => { if (v) aoMudar(v); };
  const fora = opcoes.find((o) => o.valor === valor)?.detalhe;
  const escolha = opcoes.length > OPCOES_PARA_BUSCAR
    ? <EscolhaEmFolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor, rotulo: o.rotulo, detalhe: o.detalhe }))} valor={valor} aoMudar={aoEscolher} rotuloDoValor="Escolha a técnica" />
    : <Escolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} valor={valor} aoMudar={aoEscolher} />;
  return <>
    {escolha}
    {fora ? <Texto variante="pequeno">{fora}</Texto> : null}
  </>;
}

/** Cluster em carga de trabalho: a ajuda da carga numa linha só (no lugar da padrão e da frase sobre a série anterior). */
const AJUDA_DA_CARGA_DO_CLUSTER = 'A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.';

/**
 * Uma seção do cartão do grupo: título de seção (h3, 12 px em caixa alta, abaixo do título do grupo, que é `bloco`) e,
 * da segunda em diante, uma linha fina em cima. O espaço entre seções é o do corpo do cartão (24 px, como entre blocos).
 */
function Secao({ titulo, primeira, children }: { titulo: string; primeira?: boolean; children: ReactNode }) {
  const { cores } = useTema();
  return <View style={[estilos.secao, primeira ? null : [estilos.divisoria, { borderTopColor: cores.borda }]]}>
    <Texto variante="secao" nivel={3} cor={cores.texto}>{titulo}</Texto>
    {children}
  </View>;
}

/** Explicação recolhida (do tipo ou da técnica): o texto só aparece depois do "O que é?". */
function Explicacao({ texto }: { texto: string }) {
  const { cores } = useTema();
  return <View style={[estilos.explicacao, { borderLeftColor: cores.borda }]}>
    <Texto variante="suave">{texto}</Texto>
  </View>;
}

interface PropsDoGrupo {
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean; descansoPorSerie: boolean;
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; primeiro: boolean; ultimo: boolean;
  porSerie: ReturnType<typeof problemasPorSerie>;
  aberto: boolean; esforcoVeioDoPadrao: boolean; aoAlternar: () => void; aoMover: (d: -1 | 1) => void; aoAlterar: (m: AlteracaoDeGrupo) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoPercentuais: (i: number, min: number | null, max: number | null) => void; aoRemover: () => void;
}

function EditorGrupo({ grupo: g, series, config, cardio, semCarga, descansoPorSerie, tipos, podeMais, primeiro, ultimo, porSerie, aberto, esforcoVeioDoPadrao, aoAlternar, aoMover, aoAlterar, aoQuantidade, aoRestPauseNaUltima, aoPercentuais, aoRemover }: PropsDoGrupo) {
  const { cores } = useTema();
  const largo = useCamposLadoALado();
  // Explicações do tipo e da técnica começam recolhidas; o "O que é?" abre.
  const [explicarTipo, setExplicarTipo] = useState(false);
  const [explicarTecnica, setExplicarTecnica] = useState(false);
  const s = g.series[0];
  const secoes = secoesDaSerie(cardio ? 'CARDIO' : null);
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const modo = s.carga?.modo ?? 'NENHUMA';
  const { erros, avisos } = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  const campos = new Set<string>();
  for (let i = g.inicio; i < g.inicio + g.series.length; i++) for (const c of Object.keys(porSerie[i]?.erros ?? {})) campos.add(c);
  const selo = campos.size > 0 ? { texto: `${campos.size} ${campos.size === 1 ? 'problema' : 'problemas'}`, tipo: 'perigo' as const }
    : Object.keys(avisos).length > 0 ? { texto: 'Aviso', tipo: 'atencao' as const } : undefined;
  const explicacao = explicacaoDoTipo(config, s.tipo);
  const tecnicaTexto = s.tecnica ? (explicacaoDaTecnica(config, s.tecnica.tipo) || (tecnicaDescritiva(s.tecnica.tipo) ? explicacaoDoCatalogo(s.tecnica.tipo) : null)) : null;
  const descritiva = tecnicaDescritiva(s.tecnica?.tipo);
  const errosDaTecnica = subProblemas(erros, 'tecnica');
  const aoTecnica = (v: EscolhaDeTecnica) => aoAlterar({ tecnica: v === 'NENHUMA' ? null : tecnicaVazia(v, padraoDaTecnica(config, v)) });
  const referencias = opcoesDeReferencia(series, g.inicio, config);
  const nomeTipo = tipos.find((t) => t.valor === s.tipo)?.rotulo ?? nomeDoTipo(config, s.tipo);
  const opcoesTecnica = opcoesDeTecnica(config, s.tecnica?.tipo);
  const nomeTecnica = s.tecnica ? opcoesTecnica.find((o) => o.valor === s.tecnica?.tipo)?.rotulo ?? null : null;
  const recuo = espaco(largo ? 2.5 : 2);
  return <View style={[estilos.grupo, { borderColor: campos.size > 0 ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 }]}>
    <CabecalhoDeGrupo titulo={descreverGrupo(g, config, series)} selo={selo} aberto={aberto} aoAlternar={aoAlternar} acoes={<>
      <IconeBotao Icone={ArrowUp} rotulo="Subir este grupo de séries" desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
      <IconeBotao Icone={ArrowDown} rotulo="Descer este grupo de séries" desabilitado={ultimo} aoTocar={() => aoMover(1)} />
      <IconeBotao Icone={Trash2} rotulo="Remover este grupo de séries" cor={cores.perigo} aoTocar={aoRemover} />
    </>} />
    {aberto ? <View style={[estilos.corpo, { padding: recuo }]}>
      {secoes.tipo ? <Secao titulo="Tipo e técnica" primeira>
        <View style={estilos.juntos}>
          <Tipos rotulo="Tipo da série" opcoes={tipos} valor={s.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
          {explicacao ? <BotaoDeAbrir texto={`O que é o tipo ${nomeTipo}?`} aberto={explicarTipo} aoAlternar={() => setExplicarTipo(!explicarTipo)} /> : null}
          {explicacao && explicarTipo ? <Explicacao texto={explicacao} /> : null}
          <ErroDoCampo mensagem={erros.tipo} />
          <AvisoDoCampo mensagem={avisos.tipo} />
        </View>
        {secoes.tecnica ? <View style={estilos.juntos}>
          <Tecnicas rotulo="Técnica da série" opcoes={opcoesTecnica} valor={s.tecnica?.tipo ?? 'NENHUMA'} aoMudar={aoTecnica} />
          {tecnicaTexto && nomeTecnica ? <BotaoDeAbrir texto={`O que é ${nomeTecnica}?`} aberto={explicarTecnica} aoAlternar={() => setExplicarTecnica(!explicarTecnica)} /> : null}
          {tecnicaTexto && nomeTecnica && explicarTecnica ? <Explicacao texto={tecnicaTexto} /> : null}
        </View> : null}
        {secoes.tecnica && podeRestPauseNaUltima(g, config) ? <LinhaDeAcoes>
          <Botao rotulo="Aplicar Rest-pause só na última série" tipo="secundario" aoTocar={aoRestPauseNaUltima} />
        </LinhaDeAcoes> : null}
      </Secao> : null}

      <Secao titulo={cardio ? 'Quantidade' : 'Estrutura'} primeira={!secoes.tipo}>
        <View>
          <Texto variante="rotulo">Número de séries completas</Texto>
          <View style={estilos.contador}>
            <IconeBotao Icone={Minus} rotulo="Uma série completa a menos" desabilitado={g.series.length <= 1} aoTocar={() => aoQuantidade(g.series.length - 1)} />
            <Texto style={estilos.numero} accessibilityLabel={`${g.series.length} séries completas`}>{g.series.length}</Texto>
            <IconeBotao Icone={Plus} rotulo="Uma série completa a mais" desabilitado={!podeMais} aoTocar={() => aoQuantidade(g.series.length + 1)} />
          </View>
        </View>
        {secoes.prescricao && !cluster ? <CamposDasRepeticoes valor={s} erros={erros} semRepeticoes="Sem repetições: o aluno lê a série por tempo."
          aoMudar={(r) => aoAlterar({ repsMin: r.repsMin, repsMax: r.repsMax, amrap: r.amrap })} /> : null}
        {secoes.tecnica && s.tecnica && !descritiva
          ? <CamposDaTecnica tecnica={s.tecnica} erros={errosDaTecnica} semCarga={semCarga} ws={nomeDaSerieDeTrabalho(config)} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
          : null}
        {secoes.prescricao && cluster ? <ErroDoCampo mensagem={erros.repsMin} /> : null}
      </Secao>

      {secoes.carga ? <Secao titulo="Carga">
        <EscolhaDeCarga carga={s.carga} config={config} papel={papelDe(config, s.tipo)} aoMudarModo={(m) => aoAlterar({ modo: m })} erro={erros['carga.modo'] ?? erros.carga} rotuloVisivel={false}
          ajuda={cluster && modo === 'CARGA_TRABALHO' && !semCarga ? AJUDA_DA_CARGA_DO_CLUSTER : undefined} />
        {modo === 'PERCENTUAL_WS' || modo === 'ACIMA_DA_ANTERIOR' || modo === 'ABAIXO_DA_REFERENCIA' ? <View style={estilos.bloco}>
          {g.series.map((x, j) => <FaixaDeCarga key={x.uid} carga={x.carga} config={config} prefixo={g.series.length > 1 ? `Série ${j + 1} · ` : ''}
            aoMudar={(min, max) => aoPercentuais(j, min, max)} erros={subProblemas(porSerie[g.inicio + j]?.erros, 'carga')} />)}
        </View> : null}
        {modo === 'ABAIXO_DA_REFERENCIA' ? <ReferenciaDaCarga opcoes={referencias} valor={s.carga?.referenciaUid} aoMudar={(referenciaUid) => aoAlterar({ carga: { referenciaUid } })} erro={erros['carga.referenciaUid']} /> : null}
        <AvisoDoCampo mensagem={avisos['carga.modo']} />
      </Secao> : null}

      {secoes.esforco ? <Secao titulo="Esforço">
        <CamposDoEsforco esforco={s.esforco} aoMudar={(esforco) => aoAlterar({ esforco })} erros={subProblemas(erros, 'esforco')} rotulo="Esforço percebido" rotuloVisivel={false} />
        {cluster ? <Texto variante="pequeno">{textoDaRevisaoDoEsforco(esforcoVeioDoPadrao, nomeDoTipo(config, s.tipo))}</Texto> : null}
        <AvisoDoCampo mensagem={avisos['esforco.rir']} />
      </Secao> : null}

      {secoes.prescricao ? <Secao titulo="Descanso">
        <CampoSozinho>
          <CampoNumerico rotulo="Descanso depois da série" inteiro sufixo="s" valor={s.descansoSegundos} aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })}
            erro={erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `De 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null)} />
        </CampoSozinho>
      </Secao> : null}

      {secoes.alvoExtra ? <Secao titulo="Alvo extra">
        <Campo rotulo="Texto curto para o aluno (opcional)" rotuloAcessivel="Alvo extra (opcional)" valor={s.alvoExtra ?? ''} maxLength={120} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })}
          erro={erros.alvoExtra} />
      </Secao> : null}

      {secoes.cardio ? <Secao titulo="Cardio">
        <CamposDoCardio cardio={s.cardio} aoMudar={(c) => aoAlterar({ cardio: c })} erros={{ ...subProblemas(erros, 'cardio'), ...(erros.cardio ? { cardio: erros.cardio } : {}) }} />
      </Secao> : null}

      <PreviaDoAluno grupo={g} series={series} config={config} semCarga={semCarga} descansoPorSerie={descansoPorSerie} />
    </View> : null}
  </View>;
}

/**
 * "Para o aluno": o resultado final em uma linha (quantas séries completas e a estrutura), e embaixo só o que está
 * informado: carga e de onde ela sai, esforço, descanso e alvo extra. A leitura longa da técnica fica com o aluno.
 */
function PreviaDoAluno({ grupo: g, series, config, semCarga, descansoPorSerie }: { grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; semCarga: boolean; descansoPorSerie: boolean }) {
  const { cores } = useTema();
  const previa = previaDoGrupo(g, series, config, { semCarga, descansoPorSerie, referencia: semCarga ? null : referenciaDaCarga(series, g.inicio, config) });
  const tecnica = g.series[0].tecnica;
  // Cluster sem blocos válidos: o resumo diria só "complete os blocos"; a frase inteira fica no lugar dele.
  const incompleto = tecnica?.tipo === 'CLUSTER' && !blocosValidos(tecnica.blocos);
  return <View style={[estilos.previa, { borderColor: cores.borda, backgroundColor: cores.superficie }]} accessibilityLabel="Para o aluno">
    <Texto variante="secao" nivel={3} cor={cores.texto}>Para o aluno</Texto>
    {incompleto
      ? <Texto>Complete os blocos para visualizar a prescrição.</Texto>
      : <Texto numerico cor={cores.texto}>{previa.resumo}</Texto>}
    {previa.linhas.map((linha) => <Texto key={linha} numerico variante="suave">{linha}</Texto>)}
  </View>;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  painel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.5) },
  // A faixa do cabeçalho fica rente às bordas; o corpo tem o próprio recuo.
  grupo: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  corpo: { gap: espaco(3) },
  secao: { gap: espaco(1.5) },
  // Linha fina no começo de cada seção depois da primeira: o espaço até ela é o `gap` do corpo.
  divisoria: { borderTopWidth: 1, paddingTop: espaco(2) },
  juntos: { gap: espaco(0.5) },
  bloco: { gap: espaco(1) },
  explicacao: { borderLeftWidth: 2, paddingLeft: espaco(1.5), paddingVertical: espaco(0.5) },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.75) },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  numero: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 24, minWidth: 24, textAlign: 'center' },
});
