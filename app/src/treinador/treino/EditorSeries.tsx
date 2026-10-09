import { Minus, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, ModoIntensidade, Serie } from '../../api/tipos';
import { agrupar, descreverGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import {
  alterarGrupo,
  alterarPercentual,
  MODOS,
  mudarQuantidade,
  novaSerie,
  removerGrupo,
  type AlteracaoDeGrupo,
} from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  aoMudar: (series: Serie[]) => void;
  /** Com isto, "Usar receita" fica na mesma linha de "Adicionar série", com o mesmo tamanho. */
  aoUsarReceita?: () => void;
}

/**
 * Séries agrupadas como no PDF ("3x3 - FS 50/70/85%"), cada grupo com tipo, quantidade (− +), faixa de repetições e
 * intensidade. Em "% da trabalho" cada série tem o próprio percentual. Mudar a quantidade de FS reaplica a regra da
 * consultoria.
 */
export function EditorSeries({ series, config, aoMudar, aoUsarReceita }: Props) {
  const grupos = agrupar(series);
  return (
    <View style={estilos.lista}>
      {grupos.map((g) => (
        <EditorGrupo
          key={g.series[0].uid}
          grupo={g}
          config={config}
          aoAlterar={(m) => aoMudar(alterarGrupo(series, g, m, config))}
          aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, config))}
          aoPercentual={(i, p) => aoMudar(alterarPercentual(series, g.inicio + i, p))}
          aoRemover={() => aoMudar(removerGrupo(series, g))}
        />
      ))}
      <View style={estilos.adicionar}>
        <View style={aoUsarReceita ? estilos.metade : null}>
          <Botao rotulo="Adicionar série" tipo="secundario" Icone={Plus} cheio={!!aoUsarReceita} aoTocar={() => aoMudar([...series, novaSerie(config)])} />
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
  aoAlterar,
  aoQuantidade,
  aoPercentual,
  aoRemover,
}: {
  grupo: GrupoDeSeries;
  config: Configuracao | null;
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

  return (
    <View style={[estilos.grupo, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.topo}>
        <Texto style={estilos.resumo}>{descreverGrupo(grupo)}</Texto>
        <IconeBotao Icone={Trash2} rotulo="Remover este grupo de séries" cor={cores.perigo} aoTocar={aoRemover} />
      </View>
      <Escolha rotulo="Tipo" opcoes={tipos.map((t) => ({ valor: t, rotulo: t }))} valor={primeira.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
      <View style={estilos.linha}>
        <View style={estilos.quantidade}>
          <Texto variante="pequeno" style={estilos.rotulo}>Séries</Texto>
          <View style={estilos.contador}>
            <IconeBotao Icone={Minus} rotulo="Uma série a menos" desabilitado={n <= 1} aoTocar={() => aoQuantidade(n - 1)} />
            <Texto style={estilos.numero} accessibilityLabel={`${n} séries`}>{n}</Texto>
            <IconeBotao Icone={Plus} rotulo="Uma série a mais" desabilitado={n >= 30} aoTocar={() => aoQuantidade(n + 1)} />
          </View>
        </View>
        <View style={estilos.reps}>
          <CampoNumerico rotulo="Reps mín." inteiro valor={primeira.repsMin} aoMudar={(v) => aoAlterar({ repsMin: v })} />
        </View>
        <View style={estilos.reps}>
          <CampoNumerico rotulo="Reps máx." inteiro valor={primeira.repsMax} aoMudar={(v) => aoAlterar({ repsMax: v })} />
        </View>
      </View>
      <Campo
        rotulo={porTempo ? 'Alvo (tempo, distância…)' : 'Alvo extra (opcional)'}
        valor={primeira.alvoTexto ?? ''}
        aoMudar={(t) => aoAlterar({ alvoTexto: t })}
        placeholder={porTempo ? 'Ex.: 50 min' : 'Ex.: até a falha'}
        maxLength={120}
      />
      <Escolha rotulo="Intensidade" opcoes={MODOS} valor={modo} aoMudar={(m) => aoAlterar({ modo: m })} />
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
    </View>
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
  adicionar: { flexDirection: 'row', gap: espaco(1) },
  metade: { flex: 1 },
});
