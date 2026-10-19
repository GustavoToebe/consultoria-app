import { ChevronDown, ChevronUp, Minus, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
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
 * Séries agrupadas como no PDF ("3x3 - FS 50/70/85%"), cada grupo com tipo, quantidade (− +), faixa de repetições,
 * intensidade e descanso, e ↑↓ para mudar a ordem dos grupos. Em "% da <série de trabalho>" (ex.: "% da WS") cada série tem o próprio percentual.
 * Mudar a quantidade de FS reaplica a regra da consultoria. "Adicionar série" pergunta o tipo (o FS novo pode subir
 * para antes da WS pelo ↑). O limite de séries vale para o exercício todo, como no servidor.
 */
/** Ao adicionar: série simples ou já com a técnica (um grupo próprio, para "1 WS + 1 WS em cluster"). */
const TECNICAS_NOVAS: { valor: 'SIMPLES' | Tecnica['tipo']; rotulo: string }[] = [
  { valor: 'SIMPLES', rotulo: 'Simples' },
  { valor: 'CLUSTER', rotulo: 'Cluster' },
  { valor: 'REST_PAUSE', rotulo: 'Rest pause' },
];

export function EditorSeries({ series, config, aoMudar, aoUsarReceita }: Props) {
  const grupos = agrupar(series);
  const [escolhendoTipo, setEscolhendoTipo] = useState(false);
  const [tecnicaNova, setTecnicaNova] = useState<'SIMPLES' | Tecnica['tipo']>('SIMPLES');
  const cheio = series.length >= LIMITE_SERIES;
  const tipos = [...new Set([...(config?.tiposSerie ?? []), ...series.map((x) => x.tipo)].filter(Boolean))];
  const adicionar = (tipo?: string) => {
    aoMudar(adicionarSerie(series, config, tipo, tecnicaNova === 'SIMPLES' ? null : tecnicaNova));
    setEscolhendoTipo(false);
    setTecnicaNova('SIMPLES');
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
          aoMover={(delta) => aoMudar(moverGrupo(series, indice, delta))}
          aoAlterar={(m) => aoMudar(alterarGrupo(series, g, m, config))}
          aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, config))}
          aoPercentual={(i, p) => aoMudar(alterarPercentual(series, g.inicio + i, p))}
          aoRemover={() => aoMudar(removerGrupo(series, g))}
        />
      ))}
      {escolhendoTipo ? (
        <View style={estilos.escolhaTipo}>
          <Escolha rotulo="Técnica da série nova" opcoes={TECNICAS_NOVAS} valor={tecnicaNova} aoMudar={setTecnicaNova} />
          <Texto variante="rotulo">Tipo da série nova</Texto>
          <LinhaDeAcoes>
            {tipos.map((t) => (
              <Botao key={t} rotulo={t} tipo="secundario" aoTocar={() => adicionar(t)} />
            ))}
            <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={() => setEscolhendoTipo(false)} />
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
            aoTocar={() => setEscolhendoTipo((v) => !v)}
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
  const n = grupo.series.length;
  const porTempo = primeira.repsMin === null && primeira.repsMax === null;
  const descansoInvalido =
    primeira.descansoSegundos != null && (primeira.descansoSegundos < 0 || primeira.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS);

  return (
    <View style={[estilos.grupo, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.topo}>
        <Texto style={estilos.resumo}>{descreverGrupo(grupo)}</Texto>
        <IconeBotao Icone={ChevronUp} rotulo="Subir este grupo de séries" desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
        <IconeBotao Icone={ChevronDown} rotulo="Descer este grupo de séries" desabilitado={ultimo} aoTocar={() => aoMover(1)} />
        <IconeBotao Icone={Trash2} rotulo="Remover este grupo de séries" cor={cores.perigo} aoTocar={aoRemover} />
      </View>
      <Escolha rotulo="Tipo" opcoes={tipos.map((t) => ({ valor: t, rotulo: t }))} valor={primeira.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
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
      <Campo
        rotulo={porTempo ? 'Alvo (tempo, distância…)' : 'Alvo extra (opcional)'}
        valor={primeira.alvoTexto ?? ''}
        aoMudar={(t) => aoAlterar({ alvoTexto: t })}
        placeholder={porTempo ? 'Ex.: 50 min' : 'Ex.: até a falha'}
        maxLength={120}
      />
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
      <CamposDaTecnica tecnica={primeira.tecnica ?? null} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
    </View>
  );
}

const TECNICAS: { valor: Tecnica['tipo'] | 'NENHUMA'; rotulo: string }[] = [
  { valor: 'NENHUMA', rotulo: 'Nenhuma' },
  { valor: 'CLUSTER', rotulo: 'Cluster' },
  { valor: 'REST_PAUSE', rotulo: 'Rest pause' },
];

/**
 * Técnica do grupo com campos próprios (pedido do Saraiva em 17/10): cluster = blocos, repetições por bloco e pausa
 * entre blocos; rest pause = pausa, retomadas e repetições por retomada (vazio = até a falha). Nasce sem números.
 */
function CamposDaTecnica({ tecnica, aoMudar }: { tecnica: Tecnica | null; aoMudar: (t: Tecnica | null) => void }) {
  const mudar = (parte: Partial<Tecnica>) => tecnica && aoMudar({ ...tecnica, ...parte });
  return (
    <>
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
    </>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  grupo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.25) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  resumo: { fontFamily: fontes.semi, flex: 1 },
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
