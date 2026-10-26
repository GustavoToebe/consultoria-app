import { ArrowDown, ArrowUp, Minus, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Configuracao, Serie } from '../../api/tipos';
import { agrupar, descreverGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import { adicionarSerie, alterarGrupo, alterarPercentuais, DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, moverGrupo, mudarQuantidade, novoExercicio, removerGrupo, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { acrescentarExemplo, codigoPreparacao, novaWsComRestPause, quantidadeDoExemplo, restPauseNestaSerie, TEXTO_DO_EXEMPLO, textoDaContagemDeSeries } from '../../dominio/exemplosDePrescricao';
import { codigoTrabalho, explicacaoDaTecnica, explicacaoDoTipo, papelDe, padraoDaTecnica, tecnicaDescritiva } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
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
import { AvisoDoCampo, CamposDaTecnica, CamposDoCardio, CamposDoEsforco, ErroDoCampo, EscolhaDeCarga, FaixaDeCarga, ReferenciaDaCarga } from './CamposDaPrescricao';
import {
  type EscolhaDeTecnica,
  opcoesDeReferencia,
  opcoesDeTecnica,
  opcoesDeTipo,
  previaDaSerie,
  problemasDoExercicioSemSeries,
  problemasDoGrupoDeSeries,
  problemasPorSerie,
  secoesDaSerie,
  subProblemas,
  tecnicaParaOAluno,
} from './opcoesDoEditor';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  modalidade: string | null;
  aoMudar: (series: Serie[]) => void;
  aoUsarReceita?: () => void;
  /** Exercício sem carga (elástico, peso corporal): a prévia não fala de carga. */
  semCarga?: boolean;
}

const MODOS_DE_REPETICAO = [
  { valor: 'FAIXA', rotulo: 'Faixa de repetições' },
  { valor: 'AMRAP', rotulo: 'AMRAP (o máximo de repetições)' },
];

/**
 * Séries do exercício, na ordem em que o treinador pensa: tipo, prescrição, carga, esforço, técnica e alvo extra. Séries
 * iguais e seguidas formam um grupo e se editam juntas; o percentual de cada série é próprio. Cada campo mostra o erro e o
 * aviso da validação (a mesma da publicação) e a prévia diz como o aluno vai ler. Exercício de cardio só tem a prescrição de
 * cardio.
 */
export function EditorSeries({ series, config, modalidade, aoMudar, aoUsarReceita, semCarga = false }: Props) {
  const { cores } = useTema();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const cardio = modalidade === 'CARDIO';
  const grupos = agrupar(series);
  const [painel, setPainel] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [tecnicaNova, setTecnicaNova] = useState<EscolhaDeTecnica>('NENHUMA');
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
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
  const adicionar = () => {
    const novas = adicionarSerie(series, cfg, tipoNovo ?? undefined, tecnicaNova === 'NENHUMA' ? null : tecnicaNova, modalidade);
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
  const grupoDeTrabalho = grupos.filter((g) => abertos.has(g.series[0].uid) && papelDe(cfg, g.series[0].tipo) === 'TRABALHO').at(-1) ?? null;
  const motivoDoExemplo = (exemplo: 'fs-ws-cluster' | 'fs-cluster') => {
    if (!codigoPreparacao(cfg) || !codigoTrabalho(cfg)) return 'A metodologia precisa de um tipo de preparação e de um tipo de trabalho.';
    const quantidade = quantidadeDoExemplo(exemplo);
    if (series.length + quantidade > LIMITE_SERIES) return `O exemplo usa ${quantidade} séries e o exercício já tem ${series.length}.`;
    return undefined;
  };
  const aplicarExemplo = (exemplo: 'fs-ws-cluster' | 'fs-cluster') => {
    const novas = acrescentarExemplo(series, cfg, exemplo, modalidade);
    aoMudar(novas);
    abrirUltimo(novas);
  };
  return <View style={estilos.lista}>
    {grupos.map((g, i) => <EditorGrupo key={g.series[0].uid} grupo={g} series={series} config={cfg} cardio={cardio} semCarga={semCarga}
      tipos={tipos} podeMais={!cheio} primeiro={i === 0} ultimo={i === grupos.length - 1}
      porSerie={validacao.porSerieErros}
      aberto={abertos.has(g.series[0].uid)} aoAlternar={() => alternar(g.series[0].uid)}
      aoMover={(d) => aoMudar(moverGrupo(series, i, d))}
      aoAlterar={(m) => aoMudar(alterarGrupo(series, g, m, cfg, modalidade))}
      aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, cfg))}
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
    {!cardio ? <>
      <Texto variante="pequeno">{TEXTO_DO_EXEMPLO}</Texto>
      <LinhaDeAcoes>
        <Botao rotulo="Exemplo: FS, WS e Cluster" tipo="secundario" aoTocar={() => aplicarExemplo('fs-ws-cluster')} desabilitado={!!motivoDoExemplo('fs-ws-cluster')} motivo={motivoDoExemplo('fs-ws-cluster')} />
        <Botao rotulo="Exemplo: FS e Cluster" tipo="secundario" aoTocar={() => aplicarExemplo('fs-cluster')} desabilitado={!!motivoDoExemplo('fs-cluster')} motivo={motivoDoExemplo('fs-cluster')} />
      </LinhaDeAcoes>
      <LinhaDeAcoes>
        <Botao rotulo="Rest-pause nesta série" tipo="secundario" aoTocar={() => { if (grupoDeTrabalho) aoMudar(restPauseNestaSerie(series, grupoDeTrabalho, cfg, modalidade)); }}
          desabilitado={!grupoDeTrabalho} motivo="Abra a série de trabalho." />
        <Botao rotulo="Nova WS com Rest-pause" tipo="secundario" aoTocar={() => { const novas = novaWsComRestPause(series, cfg, modalidade); aoMudar(novas); abrirUltimo(novas); }}
          desabilitado={cheio || !codigoTrabalho(cfg)} motivo={motivoCheio ?? (!codigoTrabalho(cfg) ? 'A metodologia precisa de um tipo de trabalho.' : undefined)} />
      </LinhaDeAcoes>
    </> : null}
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

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <View style={estilos.secao}>
    <Texto variante="secao">{titulo}</Texto>
    {children}
  </View>;
}

interface PropsDoGrupo {
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean;
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; primeiro: boolean; ultimo: boolean;
  porSerie: ReturnType<typeof problemasPorSerie>;
  aberto: boolean; aoAlternar: () => void; aoMover: (d: -1 | 1) => void; aoAlterar: (m: AlteracaoDeGrupo) => void;
  aoQuantidade: (n: number) => void; aoPercentuais: (i: number, min: number | null, max: number | null) => void; aoRemover: () => void;
}

function EditorGrupo({ grupo: g, series, config, cardio, semCarga, tipos, podeMais, primeiro, ultimo, porSerie, aberto, aoAlternar, aoMover, aoAlterar, aoQuantidade, aoPercentuais, aoRemover }: PropsDoGrupo) {
  const { cores } = useTema();
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
  return <View style={[estilos.grupo, { borderColor: campos.size > 0 ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 }]}>
    <CabecalhoDeGrupo titulo={descreverGrupo(g, config, series)} selo={selo} aberto={aberto} aoAlternar={aoAlternar} acoes={<>
      <IconeBotao Icone={ArrowUp} rotulo="Subir este grupo de séries" desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
      <IconeBotao Icone={ArrowDown} rotulo="Descer este grupo de séries" desabilitado={ultimo} aoTocar={() => aoMover(1)} />
      <IconeBotao Icone={Trash2} rotulo="Remover este grupo de séries" cor={cores.perigo} aoTocar={aoRemover} />
    </>} />
    {aberto ? <>
      {secoes.tipo ? <Secao titulo="Tipo">
        <Tipos rotulo="Tipo da série" opcoes={tipos} valor={s.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
        {explicacao ? <Texto variante="pequeno">{explicacao}</Texto> : null}
        <ErroDoCampo mensagem={erros.tipo} />
        <AvisoDoCampo mensagem={avisos.tipo} />
      </Secao> : null}

      {secoes.tecnica ? <Secao titulo="Técnica">
        <Tecnicas rotulo="Técnica da série" opcoes={opcoesDeTecnica(config, s.tecnica?.tipo)} valor={s.tecnica?.tipo ?? 'NENHUMA'} aoMudar={aoTecnica} />
        {s.tecnica ? <>
          {tecnicaTexto ? <Texto variante="pequeno">{tecnicaTexto}</Texto> : null}
          {descritiva ? null : <CamposDaTecnica tecnica={s.tecnica} erros={errosDaTecnica} aoMudar={(tecnica) => aoAlterar({ tecnica })} />}
        </> : null}
      </Secao> : null}

      <Secao titulo={cardio ? 'Quantidade' : 'Prescrição'}>
        <View style={estilos.linha}>
          <View><Texto variante="rotulo">Séries completas</Texto><View style={estilos.linha}>
            <IconeBotao Icone={Minus} rotulo="Uma série completa a menos" desabilitado={g.series.length <= 1} aoTocar={() => aoQuantidade(g.series.length - 1)} />
            <Texto style={estilos.numero} accessibilityLabel={`${g.series.length} séries completas`}>{g.series.length}</Texto>
            <IconeBotao Icone={Plus} rotulo="Uma série completa a mais" desabilitado={!podeMais} aoTocar={() => aoQuantidade(g.series.length + 1)} />
          </View></View>
          {secoes.prescricao ? <View style={estilos.campo}><CampoNumerico rotulo="Descanso depois da série" inteiro sufixo="s" valor={s.descansoSegundos} aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })}
            erro={erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `De 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null)}
            ajuda="Vale depois da série inteira, não entre os blocos." /></View> : null}
        </View>
        {secoes.prescricao ? (cluster ? <>
          <Texto variante="pequeno">Uma WS contínua antes é outra série, sem técnica. O registro é um só, ao terminar o último bloco.</Texto>
          <ErroDoCampo mensagem={erros.repsMin} />
        </> : <>
          <Escolha rotulo="Repetições" opcoes={MODOS_DE_REPETICAO} valor={s.amrap ? 'AMRAP' : 'FAIXA'} aoMudar={(v) => aoAlterar({ amrap: v === 'AMRAP' })} />
          {!s.amrap ? <View style={estilos.linha}>
            <View style={estilos.campo}><CampoNumerico rotulo="Reps mín." inteiro valor={s.repsMin} aoMudar={(repsMin) => aoAlterar({ repsMin })} erro={erros.repsMin} /></View>
            <View style={estilos.campo}><CampoNumerico rotulo="Reps máx." inteiro valor={s.repsMax} aoMudar={(repsMax) => aoAlterar({ repsMax })} erro={erros.repsMax} /></View>
          </View> : <ErroDoCampo mensagem={erros.amrap} />}
          {!s.amrap && s.repsMin == null && s.repsMax == null ? <Texto variante="pequeno">Sem repetições: o aluno lê a série por tempo.</Texto> : null}
        </>) : null}
      </Secao>

      {secoes.carga ? <Secao titulo="Carga">
        <EscolhaDeCarga carga={s.carga} config={config} papel={papelDe(config, s.tipo)} aoMudarModo={(m) => aoAlterar({ modo: m })} erro={erros['carga.modo'] ?? erros.carga} />
        {modo === 'PERCENTUAL_WS' || modo === 'ACIMA_DA_ANTERIOR' || modo === 'ABAIXO_DA_REFERENCIA' ? <View style={estilos.bloco}>
          {g.series.map((x, j) => <FaixaDeCarga key={x.uid} carga={x.carga} config={config} prefixo={g.series.length > 1 ? `Série ${j + 1} · ` : ''}
            aoMudar={(min, max) => aoPercentuais(j, min, max)} erros={subProblemas(porSerie[g.inicio + j]?.erros, 'carga')} />)}
        </View> : null}
        {modo === 'ABAIXO_DA_REFERENCIA' ? <ReferenciaDaCarga opcoes={referencias} valor={s.carga?.referenciaUid} aoMudar={(referenciaUid) => aoAlterar({ carga: { referenciaUid } })} erro={erros['carga.referenciaUid']} /> : null}
        {cluster && modo === 'CARGA_TRABALHO' ? <Texto variante="pequeno">A carga sugerida vem da base do dia, não da série anterior.</Texto> : null}
        <AvisoDoCampo mensagem={avisos['carga.modo']} />
      </Secao> : null}

      {secoes.esforco ? <Secao titulo="Esforço">
        <CamposDoEsforco esforco={s.esforco} aoMudar={(esforco) => aoAlterar({ esforco })} erros={subProblemas(erros, 'esforco')} rotulo="Esforço percebido" />
        {cluster ? <Texto variante="pequeno">Revise o esforço e o descanso. A técnica não calcula esses valores.</Texto> : null}
        <AvisoDoCampo mensagem={avisos['esforco.rir']} />
      </Secao> : null}

      {secoes.alvoExtra ? <Secao titulo="Alvo extra">
        <Campo rotulo="Alvo extra (opcional)" valor={s.alvoExtra ?? ''} maxLength={120} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })}
          ajuda="Texto curto que o aluno lê junto da série (até 120 caracteres)." erro={erros.alvoExtra} />
      </Secao> : null}

      {secoes.cardio ? <Secao titulo="Cardio">
        <CamposDoCardio cardio={s.cardio} aoMudar={(c) => aoAlterar({ cardio: c })} erros={{ ...subProblemas(erros, 'cardio'), ...(erros.cardio ? { cardio: erros.cardio } : {}) }} />
      </Secao> : null}

      <PreviaDoAluno grupo={g} series={series} config={config} semCarga={semCarga} />
    </> : null}
  </View>;
}

/** "Para o aluno": a meta de cada série como ela chega à tela do aluno, a técnica por extenso e de onde sai a carga. */
function PreviaDoAluno({ grupo: g, series, config, semCarga }: { grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; semCarga: boolean }) {
  const { cores } = useTema();
  const tecnica = tecnicaParaOAluno(g.series[0], config);
  return <View style={[estilos.previa, { borderColor: cores.borda, backgroundColor: cores.superficie }]} accessibilityLabel="Para o aluno">
    <Texto variante="rotulo">Para o aluno</Texto>
    {g.series.map((x, j) => {
      const p = previaDaSerie(series, g.inicio + j, config, semCarga);
      return <View key={x.uid}>
        <Texto variante="pequeno" cor={cores.texto}>Série {g.inicio + j + 1} · {p.meta}</Texto>
        {p.referencia ? <Texto variante="pequeno">{p.referencia}</Texto> : null}
      </View>;
    })}
    {tecnica ? <Texto variante="pequeno">{tecnica}</Texto> : null}
  </View>;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  painel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.5) },
  grupo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), gap: espaco(1.5) },
  secao: { gap: espaco(1) },
  bloco: { gap: espaco(1) },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(0.75) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  numero: { fontFamily: fontes.negrito, fontSize: 18, minHeight: 44, paddingTop: 10 },
});
