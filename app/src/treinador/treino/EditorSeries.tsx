import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Minus, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao, ModoIntensidade, Serie, Tecnica } from '../../api/tipos';
import { agrupar, descreverGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import {
  adicionarSerie,
  alterarGrupo,
  alterarPercentual,
  DESCANSO_MAXIMO_SEGUNDOS,
  LIMITE_SERIES,
  modosDeIntensidade,
  moverGrupo,
  mudarQuantidade,
  removerGrupo,
  tecnicaVazia,
  type AlteracaoDeGrupo,
} from '../../dominio/editorTreino';
import { tecnicaHomonima } from '../../dominio/tiposDeSerie';
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

interface Props {
  series: Serie[];
  config: Configuracao | null;
  aoMudar: (series: Serie[]) => void;
  /** Com isto, "Usar receita" fica na mesma linha de "Adicionar série", com o mesmo tamanho. */
  aoUsarReceita?: () => void;
}

/**
 * Séries agrupadas como no PDF ("3x3 - FS 50/70/85%"). Cada grupo fechado é uma linha de resumo (↑↓ mudam a ordem,
 * a seta abre, a lixeira remove); aberto, edita nome da série, quantidade (− +), faixa de repetições, descanso e
 * intensidade, com alvo e técnica em "Mais opções" (revisão de telas de 19/10: cada grupo aberto ocupava ~300 px). Em "% da <série de trabalho>" (ex.: "% da WS") cada série tem o próprio percentual.
 * Mudar a quantidade de FS reaplica a regra da consultoria. "Adicionar série" abre um painel com o tipo (para que a
 * série serve, da metodologia; já vem a de trabalho), depois a técnica (como executar; padrão simples) e o botão
 * "Adicionar"; o FS novo pode subir para antes da WS pelo ↑.
 * Tipo fora da metodologia continua nos chips (séries já gravadas) com a marca "fora da metodologia": a publicação
 * avisa, não recusa. O limite de séries vale para o exercício todo, como no servidor.
 */
/** Ao adicionar: série simples ou já com a técnica (um grupo próprio, para "1 WS + 1 WS em cluster"). */
const TECNICAS_NOVAS: { valor: 'SIMPLES' | Tecnica['tipo']; rotulo: string }[] = [
  { valor: 'SIMPLES', rotulo: 'Simples' },
  { valor: 'CLUSTER', rotulo: 'Cluster' },
  { valor: 'REST_PAUSE', rotulo: 'Rest pause' },
  { valor: 'DROP_SET', rotulo: 'Drop-set' },
];

export function EditorSeries({ series, config, aoMudar, aoUsarReceita }: Props) {
  const grupos = agrupar(series);
  const [escolhendoTipo, setEscolhendoTipo] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [tecnicaNova, setTecnicaNova] = useState<'SIMPLES' | Tecnica['tipo']>('SIMPLES');
  const cheio = series.length >= LIMITE_SERIES;
  const tipos = [...new Set([...(config?.tiposSerie ?? []), ...series.map((x) => x.tipo)].filter(Boolean))];
  const foraDaMetodologia = tiposForaDaMetodologia(tipos, config);
  const opcoesDeTipo = tipos.map((t) => ({ valor: t, rotulo: t, detalhe: foraDaMetodologia.includes(t) ? 'fora da metodologia' : undefined }));
  // Grupos abertos pela primeira série (o uid não muda ao somar séries ao grupo); o grupo novo já abre.
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const alternar = (chave: string) => setAbertos((a) => { const novo = new Set(a); if (novo.has(chave)) novo.delete(chave); else novo.add(chave); return novo; });
  // O painel abre sempre com a série de trabalho e a técnica simples; cancelar não guarda a escolha anterior.
  const abrirPainel = () => {
    setTipoNovo(tipos.includes(config?.tipoTrabalho ?? '') ? config!.tipoTrabalho : tipos[0] ?? null);
    setTecnicaNova('SIMPLES');
    setEscolhendoTipo(true);
  };
  const fecharPainel = () => { setEscolhendoTipo(false); setTecnicaNova('SIMPLES'); };
  const adicionar = () => {
    const novas = adicionarSerie(series, config, tipoNovo ?? undefined, tecnicaNova === 'SIMPLES' ? null : tecnicaNova);
    const ultimo = agrupar(novas).at(-1);
    aoMudar(novas);
    if (ultimo) setAbertos((a) => new Set(a).add(ultimo.series[0].uid));
    fecharPainel();
  };
  return (
    <View style={estilos.lista}>
      {grupos.map((g, indice) => (
        <EditorGrupo
          key={g.series[0].uid}
          grupo={g}
          config={config}
          podeMais={!cheio}
          primeiro={indice === 0}
          ultimo={indice === grupos.length - 1}
          aberto={abertos.has(g.series[0].uid)}
          aoAlternar={() => alternar(g.series[0].uid)}
          aoMover={(delta) => aoMudar(moverGrupo(series, indice, delta))}
          aoAlterar={(m) => aoMudar(alterarGrupo(series, g, m, config))}
          aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, config))}
          aoPercentual={(i, p) => aoMudar(alterarPercentual(series, g.inicio + i, p))}
          aoRemover={() => aoMudar(removerGrupo(series, g))}
        />
      ))}
      {escolhendoTipo ? (
        <View style={estilos.escolhaTipo}>
          {opcoesDeTipo.length > OPCOES_PARA_BUSCAR
            ? <EscolhaEmFolha rotulo="Tipo da série" opcoes={opcoesDeTipo} valor={tipoNovo} aoMudar={setTipoNovo} />
            : <Escolha rotulo="Tipo da série" opcoes={opcoesDeTipo} valor={tipoNovo} aoMudar={setTipoNovo} />}
          <Texto variante="pequeno">
            Para que a série serve, segundo a metodologia.{foraDaMetodologia.length ? ` ${textoForaDaMetodologia(foraDaMetodologia)}` : ''}
          </Texto>
          <Escolha rotulo="Técnica" opcoes={TECNICAS_NOVAS} valor={tecnicaNova} aoMudar={setTecnicaNova} />
          <Texto variante="pequeno">Como executar: simples, cluster, rest pause ou drop-set.</Texto>
          <LinhaDeAcoes>
            <Botao rotulo="Adicionar" tipo="secundario" Icone={Plus} desabilitado={!tipoNovo} motivo={tipoNovo ? undefined : 'Escolha o tipo da série.'} aoTocar={adicionar} />
            <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={fecharPainel} />
          </LinhaDeAcoes>
        </View>
      ) : null}
      <View style={estilos.adicionar}>
        <View style={aoUsarReceita ? estilos.metade : null}>
          <Botao
            rotulo="Adicionar série"
            tipo="secundario"
            Icone={Plus}
            cheio={!!aoUsarReceita}
            desabilitado={cheio}
            motivo={cheio ? `O exercício já tem ${LIMITE_SERIES} séries, o máximo.` : undefined}
            aoTocar={() => (escolhendoTipo ? fecharPainel() : abrirPainel())}
          />
        </View>
        {aoUsarReceita ? <View style={estilos.metade}>
          <Botao rotulo="Usar receita" tipo="secundario" Icone={NotebookTabs} cheio aoTocar={aoUsarReceita} />
        </View> : null}
      </View>
    </View>
  );
}

function EditorGrupo({
  grupo,
  config,
  podeMais,
  primeiro,
  ultimo,
  aberto,
  aoAlternar,
  aoMover,
  aoAlterar,
  aoQuantidade,
  aoPercentual,
  aoRemover,
}: {
  grupo: GrupoDeSeries;
  config: Configuracao | null;
  podeMais: boolean;
  primeiro: boolean;
  ultimo: boolean;
  aberto: boolean;
  aoAlternar: () => void;
  aoMover: (delta: -1 | 1) => void;
  aoAlterar: (m: AlteracaoDeGrupo) => void;
  aoQuantidade: (n: number) => void;
  aoPercentual: (indice: number, p: number | null) => void;
  aoRemover: () => void;
}) {
  const { cores } = useTema();
  const primeira = grupo.series[0];
  const modo: ModoIntensidade = primeira.intensidade?.modo ?? 'NENHUMA';
  const tipos = [...new Set([...(config?.tiposSerie ?? []), primeira.tipo].filter(Boolean))];
  const foraDaMetodologia = tiposForaDaMetodologia(tipos, config);
  const n = grupo.series.length;
  const porTempo = primeira.repsMin === null && primeira.repsMax === null;
  const descansoInvalido =
    primeira.descansoSegundos != null && (primeira.descansoSegundos < 0 || primeira.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS);
  // "Mais opções" (alvo extra e técnica) abre sozinho quando um dos dois já está preenchido.
  const [maisAberto, setMaisAberto] = useState(!!(primeira.tecnica || (!porTempo && primeira.alvoTexto)));
  const resumoDoMais = [primeira.tecnica ? `Técnica: ${TECNICAS.find((t) => t.valor === primeira.tecnica?.tipo)?.rotulo ?? ''}` : null, !porTempo && primeira.alvoTexto ? `Alvo: ${primeira.alvoTexto}` : null]
    .filter(Boolean).join(' · ') || 'Alvo extra e técnica';

  const Seta = aberto ? ChevronUp : ChevronDown;
  const opcoesDeTipo = tipos.map((t) => ({ valor: t, rotulo: t, detalhe: foraDaMetodologia.includes(t) ? 'fora da metodologia' : undefined }));
  const resumo = descreverGrupo(grupo);

  return (
    <View style={[estilos.grupo, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.topo}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${resumo}, ${aberto ? 'aberto' : 'fechado'}`} accessibilityState={{ expanded: aberto }}
          onPress={aoAlternar} style={({ pressed }) => [estilos.resumoBotao, { opacity: pressed ? 0.7 : 1 }]}>
          <Texto style={estilos.resumo} numerico>{resumo}</Texto>
        </Pressable>
        <IconeBotao Icone={ArrowUp} rotulo="Subir este grupo de séries" desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
        <IconeBotao Icone={ArrowDown} rotulo="Descer este grupo de séries" desabilitado={ultimo} aoTocar={() => aoMover(1)} />
        <IconeBotao Icone={Seta} rotulo={aberto ? 'Fechar este grupo de séries' : 'Abrir este grupo de séries'} aoTocar={aoAlternar} />
        <IconeBotao Icone={Trash2} rotulo="Remover este grupo de séries" cor={cores.perigo} aoTocar={aoRemover} />
      </View>
      {aberto ? <>
      {opcoesDeTipo.length > OPCOES_PARA_BUSCAR
        ? <EscolhaEmFolha rotulo="Tipo da série" opcoes={opcoesDeTipo} valor={primeira.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
        : <Escolha rotulo="Tipo da série" opcoes={opcoesDeTipo} valor={primeira.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />}
      {foraDaMetodologia.length ? <Texto variante="pequeno">{textoForaDaMetodologia(foraDaMetodologia)}</Texto> : null}
      <View style={estilos.linha}>
        <View style={estilos.quantidade}>
          <Texto variante="pequeno" style={estilos.rotulo}>Séries</Texto>
          <View style={estilos.contador}>
            <IconeBotao Icone={Minus} rotulo="Uma série a menos" desabilitado={n <= 1} aoTocar={() => aoQuantidade(n - 1)} />
            <Texto style={estilos.numero} accessibilityLabel={`${n} séries`}>{n}</Texto>
            <IconeBotao Icone={Plus} rotulo="Uma série a mais" desabilitado={!podeMais} aoTocar={() => aoQuantidade(n + 1)} />
          </View>
        </View>
        <View style={estilos.reps}>
          <CampoNumerico rotulo="Reps mín." inteiro valor={primeira.repsMin} aoMudar={(v) => aoAlterar({ repsMin: v })} />
        </View>
        <View style={estilos.reps}>
          <CampoNumerico rotulo="Reps máx." inteiro valor={primeira.repsMax} aoMudar={(v) => aoAlterar({ repsMax: v })} />
        </View>
        <View style={estilos.reps}>
          <CampoNumerico
            rotulo="Descanso"
            inteiro
            sufixo="s"
            valor={primeira.descansoSegundos}
            aoMudar={(v) => aoAlterar({ descansoSegundos: v })}
            erro={descansoInvalido ? `De 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : undefined}
          />
        </View>
      </View>
      {porTempo ? (
        <Campo rotulo="Alvo (tempo, distância…)" valor={primeira.alvoTexto ?? ''} aoMudar={(t) => aoAlterar({ alvoTexto: t })} placeholder="Ex.: 50 min" maxLength={120} />
      ) : null}
      <Escolha rotulo="Intensidade" opcoes={modosDeIntensidade(config?.tipoTrabalho)} valor={modo} aoMudar={(m) => aoAlterar({ modo: m })} />
      {modo === 'PERCENTUAL_WS' ? (
        <View style={estilos.linha}>
          {grupo.series.map((s, i) => (
            <View key={s.uid} style={estilos.reps}>
              <CampoNumerico
                rotulo={`Série ${i + 1}`}
                sufixo="%"
                valor={s.intensidade?.percentual ?? null}
                aoMudar={(p) => aoPercentual(i, p)}
              />
            </View>
          ))}
        </View>
      ) : null}
      {modo === 'RIR' ? (
        <View style={estilos.reps}>
          <CampoNumerico rotulo="RIR" inteiro valor={primeira.intensidade?.rir ?? null} aoMudar={(rir) => aoAlterar({ intensidade: { rir } })} />
        </View>
      ) : null}
      {modo === 'RPE' ? (
        <View style={estilos.reps}>
          <CampoNumerico rotulo="RPE" valor={primeira.intensidade?.rpe ?? null} aoMudar={(rpe) => aoAlterar({ intensidade: { rpe } })} />
        </View>
      ) : null}
      {modo === 'LIVRE' ? (
        <Campo
          rotulo="Intensidade (texto)"
          valor={primeira.intensidade?.texto ?? ''}
          aoMudar={(texto) => aoAlterar({ intensidade: { texto } })}
          maxLength={120}
        />
      ) : null}
      <CabecalhoDeGrupo titulo="Mais opções" resumo={maisAberto ? undefined : resumoDoMais} aberto={maisAberto} aoAlternar={() => setMaisAberto((v) => !v)} />
      {maisAberto ? <>
        {porTempo ? null : (
          <Campo rotulo="Alvo extra (opcional)" valor={primeira.alvoTexto ?? ''} aoMudar={(t) => aoAlterar({ alvoTexto: t })} placeholder="Ex.: até a falha" maxLength={120} />
        )}
        <CamposDaTecnica tecnica={primeira.tecnica ?? null} nomeDaSerie={primeira.tipo} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
      </> : null}
      </> : null}
    </View>
  );
}

const TECNICAS: { valor: Tecnica['tipo'] | 'NENHUMA'; rotulo: string }[] = [
  { valor: 'NENHUMA', rotulo: 'Nenhuma' },
  { valor: 'CLUSTER', rotulo: 'Cluster' },
  { valor: 'REST_PAUSE', rotulo: 'Rest pause' },
  { valor: 'DROP_SET', rotulo: 'Drop-set' },
];

/**
 * Técnica do grupo com campos próprios (pedido do Saraiva em 17/10): cluster = blocos, repetições por bloco e pausa
 * entre blocos; rest pause = pausa, retomadas e repetições por retomada (vazio = até a falha); drop-set = quedas,
 * redução da carga em % (vazio = sem fixar) e repetições por queda (vazio = até a falha). Nasce sem números.
 */
function CamposDaTecnica({ tecnica, nomeDaSerie, aoMudar }: { tecnica: Tecnica | null; nomeDaSerie: string; aoMudar: (t: Tecnica | null) => void }) {
  const mudar = (parte: Partial<Tecnica>) => tecnica && aoMudar({ ...tecnica, ...parte });
  // Série gravada com tipo "Cluster"/"Rest pause" (metodologia antiga ou importação): o tipo não liga a técnica.
  const homonima = !tecnica ? TECNICAS.find((t) => t.valor === tecnicaHomonima(nomeDaSerie)) : undefined;
  return (
    <>
      <Texto variante="pequeno">A técnica é como executar (blocos, pausas ou quedas). O tipo da série é para que ela serve, segundo a metodologia.</Texto>
      {homonima ? <Texto variante="pequeno">O tipo “{nomeDaSerie}” não liga a técnica: escolha {homonima.rotulo} abaixo para o aluno ver os blocos.</Texto> : null}
      <Escolha
        rotulo="Técnica"
        opcoes={TECNICAS}
        valor={tecnica?.tipo ?? 'NENHUMA'}
        aoMudar={(v) => aoMudar(v === 'NENHUMA' ? null : tecnica?.tipo === v ? tecnica : tecnicaVazia(v))}
      />
      {tecnica?.tipo === 'CLUSTER' ? (
        <View style={estilos.linha}>
          <View style={estilos.reps}>
            <CampoNumerico rotulo="Blocos" inteiro valor={tecnica.blocos} aoMudar={(blocos) => mudar({ blocos })} />
          </View>
          <View style={estilos.reps}>
            <CampoNumerico rotulo="Reps por bloco" inteiro valor={tecnica.repsPorBloco} aoMudar={(repsPorBloco) => mudar({ repsPorBloco })} />
          </View>
          <View style={estilos.reps}>
            <CampoNumerico rotulo="Pausa entre blocos" inteiro sufixo="s" valor={tecnica.pausaSegundos} aoMudar={(pausaSegundos) => mudar({ pausaSegundos })} />
          </View>
        </View>
      ) : null}
      {tecnica?.tipo === 'REST_PAUSE' ? (
        <View style={estilos.linha}>
          <View style={estilos.reps}>
            <CampoNumerico rotulo="Pausa" inteiro sufixo="s" valor={tecnica.pausaSegundos} aoMudar={(pausaSegundos) => mudar({ pausaSegundos })} />
          </View>
          <View style={estilos.reps}>
            <CampoNumerico rotulo="Retomadas" inteiro valor={tecnica.retomadas} aoMudar={(retomadas) => mudar({ retomadas })} />
          </View>
          <View style={estilos.repsLargo}>
            <CampoNumerico
              rotulo="Reps por retomada"
              inteiro
              valor={tecnica.repsPorRetomada}
              aoMudar={(repsPorRetomada) => mudar({ repsPorRetomada })}
              ajuda="Vazio = até a falha."
            />
          </View>
        </View>
      ) : null}
      {tecnica?.tipo === 'DROP_SET' ? (
        <View style={estilos.linha}>
          <View style={estilos.reps}>
            <CampoNumerico rotulo="Quedas" inteiro valor={tecnica.quedas ?? null} aoMudar={(quedas) => mudar({ quedas })} />
          </View>
          <View style={estilos.repsLargo}>
            <CampoNumerico
              rotulo="Reduzir a carga"
              inteiro
              sufixo="%"
              valor={tecnica.reducaoPercentual ?? null}
              aoMudar={(reducaoPercentual) => mudar({ reducaoPercentual })}
              ajuda="Vazio = sem fixar."
            />
          </View>
          <View style={estilos.repsLargo}>
            <CampoNumerico
              rotulo="Reps por queda"
              inteiro
              valor={tecnica.repsPorQueda ?? null}
              aoMudar={(repsPorQueda) => mudar({ repsPorQueda })}
              ajuda="Vazio = até a falha."
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

/** Tipos usados nas séries que a metodologia do plano não lista (ficam nos chips; a publicação avisa). */
function tiposForaDaMetodologia(tipos: string[], config: Configuracao | null): string[] {
  if (!config) return [];
  const daMetodologia = new Set(config.tiposSerie.map((t) => t.trim()));
  return tipos.filter((t) => !daMetodologia.has(t.trim()));
}

function textoForaDaMetodologia(tipos: string[]): string {
  const lista = tipos.map((t) => `“${t}”`).join(', ');
  return tipos.length === 1 ? `${lista} não está na metodologia do plano: a publicação vai avisar.` : `${lista} não estão na metodologia do plano: a publicação vai avisar.`;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  grupo: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), gap: espaco(1.25) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(0.5) },
  resumoBotao: { flex: 1, minHeight: 44, justifyContent: 'center' },
  resumo: { fontFamily: fontes.semi },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-end' },
  quantidade: { gap: espaco(0.5) },
  rotulo: { fontFamily: fontes.semi },
  contador: { flexDirection: 'row', alignItems: 'center' },
  numero: { fontFamily: fontes.negrito, fontSize: 18, minWidth: 28, textAlign: 'center' },
  reps: { width: 110 },
  repsLargo: { width: 160 },
  adicionar: { flexDirection: 'row', gap: espaco(1) },
  escolhaTipo: { gap: espaco(0.75) },
  metade: { flex: 1 },
});
