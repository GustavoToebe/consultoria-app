import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Configuracao, Intensidade, ModoIntensidade, PapelDaSerie, Tecnica } from '../../api/tipos';
import { blocosValidos, lerBlocos, textoDeBlocos } from '../../dominio/blocos';
import { intensidadeDoModo, modosDeIntensidade } from '../../dominio/editorTreino';
import { problemaDaIntensidade, problemaDaTecnica } from '../../dominio/edicaoMetodologia';
import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Texto } from '../../ui/Texto';

/** Os mesmos campos de intensidade na metodologia e na série. RIR é independente do modo. */
export function CamposDaIntensidade({ valor, config, papel, aoMudar, comRir = true, comPercentuais = true, rotulo = 'Intensidade' }: {
  valor: Intensidade | null; config: Configuracao | null; papel?: PapelDaSerie | null; aoMudar: (i: Intensidade | null) => void;
  comRir?: boolean; comPercentuais?: boolean; rotulo?: string;
}) {
  const modo = valor?.modo ?? 'NENHUMA';
  const mudar = (parte: Partial<Intensidade>) => aoMudar({ ...(valor ?? { modo: 'NENHUMA' }), ...parte });
  const opcoes = modosDeIntensidade(config, papel);
  const todas = modosDeIntensidade(config);
  if (!opcoes.some((o) => o.valor === modo)) opcoes.push(todas.find((o) => o.valor === modo)!);
  const mudarModo = (m: ModoIntensidade) => aoMudar({ ...(intensidadeDoModo(m) ?? { modo: 'NENHUMA' }), rir: valor?.rir ?? null });
  return <>
    <Escolha rotulo={rotulo} opcoes={opcoes} valor={modo} aoMudar={mudarModo} />
    {comPercentuais && (modo === 'PERCENTUAL_WS' || modo === 'ACIMA_DA_ANTERIOR') ? <View style={estilos.linha}>
      <CampoNumerico rotulo="Percentual mín." sufixo="%" valor={valor?.percentualMin ?? null} aoMudar={(percentualMin) => mudar({ percentualMin })} />
      <CampoNumerico rotulo="Percentual máx. (opcional)" sufixo="%" valor={valor?.percentualMax ?? null} aoMudar={(percentualMax) => mudar({ percentualMax })} />
    </View> : null}
    {modo === 'RPE' ? <CampoNumerico rotulo="RPE" valor={valor?.rpe ?? null} aoMudar={(rpe) => mudar({ rpe })} /> : null}
    {comRir ? <CampoNumerico rotulo="RIR (opcional)" inteiro valor={valor?.rir ?? null} aoMudar={(rir) => mudar({ rir })} ajuda="0 = até a falha." /> : null}
    {comPercentuais && problemaDaIntensidade(valor) ? <Texto variante="pequeno">{problemaDaIntensidade(valor)}</Texto> : null}
  </>;
}

function CampoBlocos({ valor, aoMudar }: { valor: number[] | null; aoMudar: (v: number[] | null) => void }) {
  const [texto, setTexto] = useState(textoDeBlocos(valor));
  const chave = JSON.stringify(valor);
  const [anterior, setAnterior] = useState(chave);
  if (anterior !== chave) {
    setAnterior(chave);
    if (JSON.stringify(lerBlocos(texto)) !== chave) setTexto(textoDeBlocos(valor));
  }
  return <Campo rotulo="Blocos de repetições" valor={texto} maxLength={60} placeholder="4+2 ou 4×4"
    ajuda="As repetições da série são a soma dos blocos."
    erro={texto && !blocosValidos(lerBlocos(texto)) ? 'De 2 a 10 blocos, cada um com 1 a 50 repetições.' : null}
    aoMudar={(t) => { setTexto(t); aoMudar(lerBlocos(t)); }} />;
}

/** Campos próprios de cada técnica; o seletor fica na primeira linha do grupo. */
export function CamposDaTecnica({ tecnica: t, aoMudar, comPausas = false, parcial = false }: {
  tecnica: Tecnica; aoMudar: (t: Tecnica) => void; comPausas?: boolean; parcial?: boolean;
}) {
  const mudar = (parte: Partial<Tecnica>) => aoMudar({ ...t, ...parte });
  return <>
    {t.tipo === 'CLUSTER' ? <CampoBlocos valor={t.blocos} aoMudar={(blocos) => mudar({ blocos })} /> : null}
    {t.tipo !== 'DROP_SET' ? <View style={estilos.linha}>
      <CampoNumerico rotulo="Pausa" inteiro sufixo="s" valor={t.pausaSegundos} aoMudar={(pausaSegundos) => mudar({ pausaSegundos })} />
      <CampoNumerico rotulo="Pausa em respirações" inteiro valor={t.pausaRespiracoes} aoMudar={(pausaRespiracoes) => mudar({ pausaRespiracoes })} ajuda="Se preencher as duas, o aluno lê uma ou outra." />
    </View> : <View style={estilos.linha}>
      <CampoNumerico rotulo="Quedas" inteiro valor={t.quedas} aoMudar={(quedas) => mudar({ quedas })} />
      <CampoNumerico rotulo="Reduzir a carga" inteiro sufixo="%" valor={t.reducaoPercentual} aoMudar={(reducaoPercentual) => mudar({ reducaoPercentual })} ajuda="Vazio = sem fixar." />
      <CampoNumerico rotulo="Reps por queda" inteiro valor={t.repsPorQueda} aoMudar={(repsPorQueda) => mudar({ repsPorQueda })} ajuda="Vazio = até a falha." />
    </View>}
    {t.tipo === 'REST_PAUSE' && comPausas ? <CampoNumerico rotulo="Quantas pausas" inteiro valor={t.pausas} aoMudar={(pausas) => mudar({ pausas })} ajuda="Uma série com 3 micro-séries tem 2 pausas." /> : null}
    {problemaDaTecnica(t, parcial) ? <Texto variante="pequeno">{problemaDaTecnica(t, parcial)}</Texto> : null}
  </>;
}

const estilos = StyleSheet.create({ linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' } });
