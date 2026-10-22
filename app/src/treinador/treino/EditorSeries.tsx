import { ArrowDown, ArrowUp, Minus, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Configuracao, Serie, TipoDeTecnica } from '../../api/tipos';
import { agrupar, descreverGrupo, textoTecnicaPorExtenso, type GrupoDeSeries } from '../../dominio/agrupamento';
import { metaDaSerie } from '../../dominio/cargas';
import { adicionarSerie, alterarGrupo, alterarPercentuais, DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, moverGrupo, mudarQuantidade, removerGrupo, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { nomeDaTecnica, padraoDaTecnica, papelDe, TIPOS_DE_TECNICA, tipoTrabalho } from '../../dominio/metodologia';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { CamposDaIntensidade, CamposDaTecnica } from './CamposDaPrescricao';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  modalidade: string | null;
  aoMudar: (series: Serie[]) => void;
  aoUsarReceita?: () => void;
}
const tecnicas = (config: Configuracao | null) => [{ valor: 'SIMPLES' as const, rotulo: 'Simples' },
  ...(config?.tecnicas.map((t) => ({ valor: t.tipo, rotulo: t.nome })) ?? TIPOS_DE_TECNICA.map((t) => ({ valor: t, rotulo: nomeDaTecnica(config, t) })))];
const tiposDisponiveis = (series: Serie[], config: Configuracao | null): string[] =>
  [...new Set([...(config?.tipos.map((t) => t.nome) ?? []), ...series.map((s) => s.tipo)].filter((t): t is string => !!t))];

/** Tipo e técnica são escolhas independentes. Cada grupo mostra como o aluno vai ler a prescrição. */
export function EditorSeries({ series, config, modalidade, aoMudar, aoUsarReceita }: Props) {
  const grupos = agrupar(series);
  const [painel, setPainel] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [tecnicaNova, setTecnicaNova] = useState<'SIMPLES' | TipoDeTecnica>('SIMPLES');
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const cheio = series.length >= LIMITE_SERIES;
  const tipos = tiposDisponiveis(series, config);
  const alternar = (uid: string) => setAbertos((a) => { const novo = new Set(a); if (novo.has(uid)) novo.delete(uid); else novo.add(uid); return novo; });
  const adicionar = () => {
    const novas = adicionarSerie(series, config, tipoNovo, tecnicaNova === 'SIMPLES' ? null : tecnicaNova, modalidade);
    aoMudar(novas);
    const ultimo = agrupar(novas).at(-1);
    if (ultimo) setAbertos((a) => new Set(a).add(ultimo.series[0].uid));
    setPainel(false);
  };
  return <View style={estilos.lista}>
    {grupos.map((g, i) => <EditorGrupo key={g.series[0].uid} grupo={g} config={config}
      tipos={tipos} podeMais={!cheio} primeiro={i === 0} ultimo={i === grupos.length - 1}
      aberto={abertos.has(g.series[0].uid)} aoAlternar={() => alternar(g.series[0].uid)}
      temTrabalhoAntes={series.slice(0, g.inicio).some((s) => s.intensidade?.modo === 'CARGA_TRABALHO')}
      aoMover={(d) => aoMudar(moverGrupo(series, i, d))}
      aoAlterar={(m) => aoMudar(alterarGrupo(series, g, m, config, modalidade))}
      aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, config))}
      aoPercentuais={(j, min, max) => aoMudar(alterarPercentuais(series, g.inicio + j, min, max))}
      aoRemover={() => aoMudar(removerGrupo(series, g))} />)}
    {painel ? <View style={estilos.lista}>
      <Escolha rotulo="Tipo da série" opcoes={[...tipos.map((t) => ({ valor: t, rotulo: t })), { valor: null, rotulo: 'Só técnica' }]} valor={tipoNovo} aoMudar={setTipoNovo} />
      <Texto variante="pequeno">O tipo diz para que a série serve. A técnica diz como executar.</Texto>
      <Escolha rotulo="Técnica" opcoes={tecnicas(config)} valor={tecnicaNova} aoMudar={setTecnicaNova} />
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar" tipo="secundario" Icone={Plus} aoTocar={adicionar} desabilitado={cheio || (tipoNovo === null && tecnicaNova === 'SIMPLES')} motivo={tipoNovo === null && tecnicaNova === 'SIMPLES' ? 'Escolha uma técnica para a série sem tipo.' : undefined} />
        <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={() => setPainel(false)} />
      </LinhaDeAcoes>
    </View> : null}
    <LinhaDeAcoes>
      <Botao rotulo="Adicionar série" tipo="secundario" Icone={Plus} desabilitado={cheio} motivo={cheio ? `O exercício já tem ${LIMITE_SERIES} séries, o máximo.` : undefined}
        aoTocar={() => { if (!painel) { setTipoNovo(tipoTrabalho(config) ?? tipos[0] ?? null); setTecnicaNova('SIMPLES'); } setPainel(!painel); }} />
      {aoUsarReceita ? <Botao rotulo="Usar receita" tipo="secundario" Icone={NotebookTabs} aoTocar={aoUsarReceita} /> : null}
    </LinhaDeAcoes>
  </View>;
}

function EditorGrupo({ grupo: g, config, tipos, podeMais, primeiro, ultimo, aberto, aoAlternar, temTrabalhoAntes, aoMover, aoAlterar, aoQuantidade, aoPercentuais, aoRemover }: {
  grupo: GrupoDeSeries; config: Configuracao | null; tipos: string[]; podeMais: boolean; primeiro: boolean; ultimo: boolean; aberto: boolean;
  aoAlternar: () => void; temTrabalhoAntes: boolean; aoMover: (d: -1 | 1) => void; aoAlterar: (m: AlteracaoDeGrupo) => void;
  aoQuantidade: (n: number) => void; aoPercentuais: (i: number, min: number | null, max: number | null) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  const s = g.series[0];
  const modo = s.intensidade?.modo ?? 'NENHUMA';
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const [mais, setMais] = useState(false);
  const opcoes = [...tipos.map((t) => ({ valor: t, rotulo: t })), { valor: null, rotulo: 'Só técnica' }];
  const Tipo = opcoes.length > OPCOES_PARA_BUSCAR ? EscolhaEmFolha : Escolha;
  const fora = config && s.tipo && !config.tipos.some((t) => t.nome.trim() === s.tipo?.trim());
  const meta = metaDaSerie({ ...s, tecnica: null }, tipoTrabalho(config) ?? 'série de trabalho');
  const tecnica = textoTecnicaPorExtenso(s.tecnica, config);
  return <View style={[estilos.grupo, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
    <CabecalhoDeGrupo titulo={descreverGrupo(g, config)} aberto={aberto} aoAlternar={aoAlternar} acoesJuntas acoes={<>
      <IconeBotao Icone={ArrowUp} rotulo="Subir este grupo de séries" desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
      <IconeBotao Icone={ArrowDown} rotulo="Descer este grupo de séries" desabilitado={ultimo} aoTocar={() => aoMover(1)} />
      <IconeBotao Icone={Trash2} rotulo="Remover este grupo de séries" cor={cores.perigo} aoTocar={aoRemover} />
    </>} />
    {aberto ? <>
      <Tipo rotulo="Tipo da série" opcoes={opcoes} valor={s.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
      {fora ? <Texto variante="pequeno">“{s.tipo}” não está na metodologia do plano: a publicação vai avisar.</Texto> : null}
      <View style={estilos.linha}>
        <View><Texto variante="rotulo">Séries</Texto><View style={estilos.linha}>
          <IconeBotao Icone={Minus} rotulo="Uma série a menos" desabilitado={g.series.length <= 1} aoTocar={() => aoQuantidade(g.series.length - 1)} />
          <Texto style={estilos.numero} accessibilityLabel={`${g.series.length} séries`}>{g.series.length}</Texto>
          <IconeBotao Icone={Plus} rotulo="Uma série a mais" desabilitado={!podeMais} aoTocar={() => aoQuantidade(g.series.length + 1)} />
        </View></View>
        {!cluster ? <><View style={estilos.campo}><CampoNumerico rotulo="Reps mín." inteiro valor={s.repsMin} aoMudar={(repsMin) => aoAlterar({ repsMin })} /></View>
          <View style={estilos.campo}><CampoNumerico rotulo="Reps máx." inteiro valor={s.repsMax} aoMudar={(repsMax) => aoAlterar({ repsMax })} /></View></> : null}
        <View style={estilos.campo}><CampoNumerico rotulo="Descanso" inteiro sufixo="s" valor={s.descansoSegundos} aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })}
          erro={s.descansoSegundos != null && (s.descansoSegundos < 0 || s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS) ? `De 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null} /></View>
      </View>
      <CamposDaIntensidade valor={s.intensidade} config={config} papel={papelDe(config, s.tipo)} comRir={false} comPercentuais={false} aoMudar={(i) => {
        const novoModo = i?.modo ?? 'NENHUMA';
        aoAlterar(novoModo !== modo ? { modo: novoModo } : { intensidade: i ?? { modo: 'NENHUMA' } });
      }} />
      {modo === 'PERCENTUAL_WS' || modo === 'ACIMA_DA_ANTERIOR' ? <View style={estilos.linha}>
        {g.series.map((x, j) => <View key={x.uid} style={estilos.campo}>
          <CampoNumerico rotulo={`Série ${j + 1} mín.`} sufixo="%" valor={x.intensidade?.percentualMin ?? null} aoMudar={(v) => aoPercentuais(j, v, x.intensidade?.percentualMax ?? null)} />
          <CampoNumerico rotulo={`Série ${j + 1} máx.`} sufixo="%" valor={x.intensidade?.percentualMax ?? null} aoMudar={(v) => aoPercentuais(j, x.intensidade?.percentualMin ?? null, v)} />
        </View>)}
      </View> : null}
      {modo === 'MESMA_CARGA' && !temTrabalhoAntes ? <Texto variante="pequeno">Adicione uma série de carga de trabalho antes desta no exercício para usar a mesma carga.</Texto> : null}
      <Escolha rotulo="Técnica" opcoes={tecnicas(config)} valor={s.tecnica?.tipo ?? 'SIMPLES'} aoMudar={(v) => aoAlterar({ tecnica: v === 'SIMPLES' ? null : tecnicaVazia(v, padraoDaTecnica(config, v)) })} />
      {!s.tipo && !s.tecnica ? <Texto variante="pequeno">Série sem tipo nem técnica: escolha uma técnica.</Texto> : null}
      {s.tecnica ? <CamposDaTecnica tecnica={s.tecnica} aoMudar={(t) => aoAlterar({ tecnica: t })} /> : null}
      <CabecalhoDeGrupo titulo="Mais opções" resumo="RIR e quantas pausas" aberto={mais} aoAlternar={() => setMais(!mais)} />
      {mais ? <>
        <CampoNumerico rotulo="RIR (opcional)" inteiro valor={s.intensidade?.rir ?? null} aoMudar={(rir) => aoAlterar({ intensidade: { rir } })} ajuda="0 = até a falha." />
        {s.tecnica?.tipo === 'REST_PAUSE' ? <CampoNumerico rotulo="Quantas pausas" inteiro valor={s.tecnica.pausas} aoMudar={(pausas) => aoAlterar({ tecnica: { ...s.tecnica!, pausas } })} ajuda="3 micro-séries = 2 pausas." /> : null}
      </> : null}
      <Texto variante="pequeno">Para o aluno: {meta.replace(/^Meta: /, '')}{tecnica ? ` · ${tecnica}` : ''}</Texto>
    </> : null}
  </View>;
}
const estilos = StyleSheet.create({ lista: { gap: espaco(1.5) }, grupo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), gap: espaco(1.25) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), alignItems: 'flex-start' }, campo: { width: 130, gap: espaco(1) }, numero: { fontFamily: fontes.negrito, fontSize: 18, minHeight: 44, paddingTop: 10 } });
