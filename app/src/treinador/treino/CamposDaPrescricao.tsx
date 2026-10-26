import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Cardio, Carga, Configuracao, Esforco, ModoDeCarga, PapelDaSerie, RegiaoDasParciais, Tecnica } from '../../api/tipos';
import { blocosIguais, blocosSeValidos, blocosValidos, lerBlocos, listaDeBlocosIguaisSeValidos, rascunhoDoModoDiferente, resumoDosBlocos, textoDeBlocos } from '../../dominio/blocos';
import { modosDeCarga } from '../../dominio/editorTreino';
import { REGIOES_DAS_PARCIAIS } from '../../dominio/metodologia';
import { problemasDaTecnica, type Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Texto } from '../../ui/Texto';
import { ajudaDaCarga, formaDoEsforco, FORMAS_DE_ESFORCO, OPCOES_DE_RIR, rotulosDaFaixa, type FormaDeEsforco } from './opcoesDoEditor';

/**
 * Os campos de prescrição que a série e a metodologia dividem: forma de carga e faixa, esforço (RIR ou RPE), técnica e
 * cardio. Cada um recebe os problemas do próprio trecho (chaves relativas: `percentualMin`, `rir`, `blocos`...) e mostra o
 * erro no campo; quem decide o que bloqueia é a tela.
 */

/** Erro de um campo que não é de digitar (escolha de chips). */
export function ErroDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{mensagem}</Texto> : null;
}

/** Aviso de um campo: aparece, mas não bloqueia. */
export function AvisoDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.atencao}>{mensagem}</Texto> : null;
}

// ---- Carga ----

/** A forma de carga (carga de trabalho, % da WS, mesma carga, acima da anterior, abaixo da referência, sem carga). */
export function EscolhaDeCarga({ carga, config, papel, aoMudarModo, erro, rotulo = 'Carga' }: {
  carga: Carga | null | undefined; config: Configuracao | null; papel?: PapelDaSerie | null;
  aoMudarModo: (modo: ModoDeCarga) => void; erro?: string | null; rotulo?: string;
}) {
  const modo = carga?.modo ?? 'NENHUMA';
  const ajuda = ajudaDaCarga(modo, config);
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotulo} opcoes={modosDeCarga(config, papel)} valor={modo} aoMudar={aoMudarModo} />
    {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
    <ErroDoCampo mensagem={erro} />
  </View>;
}

/** O percentual (mínimo e máximo opcional) das formas de carga que têm faixa; nada nas outras. */
export function FaixaDeCarga({ carga, config, prefixo = '', aoMudar, erros }: {
  carga: Carga | null | undefined; config: Configuracao | null; prefixo?: string;
  aoMudar: (min: number | null, max: number | null) => void; erros: Problemas;
}) {
  const rotulos = rotulosDaFaixa(carga?.modo, config);
  if (!rotulos) return null;
  return <View style={estilos.linha}>
    <View style={estilos.campo}><CampoNumerico rotulo={`${prefixo}${rotulos.minimo}`} sufixo="%" valor={carga?.percentualMin ?? null}
      aoMudar={(v) => aoMudar(v, carga?.percentualMax ?? null)} erro={erros.percentualMin} ajuda={rotulos.ajuda} /></View>
    <View style={estilos.campo}><CampoNumerico rotulo={`${prefixo}${rotulos.maximo}`} sufixo="%" valor={carga?.percentualMax ?? null}
      aoMudar={(v) => aoMudar(carga?.percentualMin ?? null, v)} erro={erros.percentualMax} /></View>
  </View>;
}

/** Série de referência do "abaixo da referência": só as anteriores do exercício. */
export function ReferenciaDaCarga({ opcoes, valor, aoMudar, erro }: {
  opcoes: { valor: string; rotulo: string }[]; valor: string | null | undefined; aoMudar: (uid: string) => void; erro?: string | null;
}) {
  if (opcoes.length === 0) return <ErroDoCampo mensagem={erro ?? 'Não há série anterior para servir de referência.'} />;
  return <View style={estilos.bloco}>
    <Escolha rotulo="Série de referência" opcoes={opcoes} valor={valor ?? null} aoMudar={(uid) => { if (uid) aoMudar(uid); }} />
    <ErroDoCampo mensagem={erro} />
  </View>;
}

// ---- Esforço ----

/**
 * Esforço percebido: RIR (0 a 5) ou RPE (1 a 10, de meio em meio), nunca os dois. A forma escolhida fica com a tela
 * enquanto o esforço ainda está vazio ("RIR" sem número não seria lembrado só pelo valor).
 */
export function CamposDoEsforco({ esforco, aoMudar, erros, rotulo = 'Esforço' }: {
  esforco: Esforco | null | undefined; aoMudar: (e: Esforco | null) => void; erros: Problemas; rotulo?: string;
}) {
  const [escolhida, setEscolhida] = useState<FormaDeEsforco>(formaDoEsforco(esforco));
  const doValor = formaDoEsforco(esforco);
  const forma = doValor === 'NENHUM' ? escolhida : doValor;
  const mudarForma = (f: FormaDeEsforco) => {
    setEscolhida(f);
    if (f !== forma || f === 'NENHUM') aoMudar(null);
  };
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotulo} opcoes={FORMAS_DE_ESFORCO} valor={forma} aoMudar={mudarForma} />
    {forma === 'RIR' ? <>
      <Escolha rotulo="RIR (repetições na reserva)" opcoes={OPCOES_DE_RIR} valor={esforco?.rir ?? null} aoMudar={(rir) => aoMudar({ rir, rpe: null })} />
      {esforco?.rir === 0 ? <Texto variante="pequeno">RIR 0: o aluno vai até a falha técnica.</Texto> : null}
      <ErroDoCampo mensagem={erros.rir} />
    </> : null}
    {forma === 'RPE' ? <View style={estilos.campo}>
      <CampoNumerico rotulo="RPE (1 a 10, de meio em meio)" valor={esforco?.rpe ?? null} aoMudar={(rpe) => aoMudar({ rir: null, rpe })} erro={erros.rpe} ajuda="Ex.: 8 ou 8,5." />
    </View> : null}
  </View>;
}

// ---- Técnica ----

function CampoBlocos({ valor, aoMudar, erro, completa }: {
  valor: number[] | null | undefined; aoMudar: (v: number[] | null) => void; erro?: string | null; completa: boolean;
}) {
  const [texto, setTexto] = useState(textoDeBlocos(valor ?? null));
  const [modo, setModo] = useState<'iguais' | 'diferentes'>(blocosIguais(valor) || !valor?.length ? 'iguais' : 'diferentes');
  const [confirmar, setConfirmar] = useState(false);
  const [quantidade, setQuantidade] = useState<number | null>(blocosIguais(valor) ? valor!.length : null);
  const [repsCada, setRepsCada] = useState<number | null>(blocosIguais(valor) ? valor![0] : null);
  const [quantidadeInvalida, setQuantidadeInvalida] = useState(false);
  const [repsInvalidas, setRepsInvalidas] = useState(false);
  const [rascunho, setRascunho] = useState<(number | null)[]>(valor && !blocosIguais(valor) ? [...valor] : []);
  const [invalidos, setInvalidos] = useState<ReadonlySet<number>>(() => new Set());
  const chave = JSON.stringify(valor ?? null);
  const [anterior, setAnterior] = useState(chave);
  if (anterior !== chave) {
    setAnterior(chave);
    setConfirmar(false);
    // Lista inválida zera o gravado e deixa o que a pessoa digitou. Só uma lista válida puxa os campos de volta.
    if (valor && blocosValidos(valor)) {
      setQuantidadeInvalida(false);
      setRepsInvalidas(false);
      setInvalidos(new Set());
      setRascunho([...valor]);
      if (blocosIguais(valor)) {
        setModo('iguais');
        setQuantidade(valor.length);
        setRepsCada(valor[0]);
      } else setModo('diferentes');
      if (JSON.stringify(lerBlocos(texto)) !== chave) setTexto(textoDeBlocos(valor));
    }
  }
  const resumo = resumoDosBlocos(valor);
  const erroFaixa = quantidade != null && (quantidade < 2 || quantidade > 10) ? 'De 2 a 10 blocos.' : null;
  const erroReps = repsCada != null && (repsCada < 1 || repsCada > 50) ? 'De 1 a 50 repetições.' : null;
  const aplicarIguais = (q: number | null, reps: number | null, qInvalida: boolean, rInvalida: boolean) => {
    const lista = listaDeBlocosIguaisSeValidos(q, reps, qInvalida, rInvalida);
    if (!qInvalida && !rInvalida && q != null && reps != null) setTexto(lista ? textoDeBlocos(lista) : `${q}×${reps}`);
    else if (!qInvalida && !rInvalida && q == null && reps == null) setTexto('');
    if (lista) setRascunho(lista);
    aoMudar(lista);
  };
  const invalidarQuantidade = (ok: boolean) => {
    if (ok) return;
    setQuantidadeInvalida(true);
    setRascunho([]);
    setTexto('');
    aoMudar(null);
  };
  const invalidarReps = (ok: boolean) => {
    if (ok) return;
    setRepsInvalidas(true);
    setRascunho([]);
    setTexto('');
    aoMudar(null);
  };
  const escolher = (proximo: 'iguais' | 'diferentes') => {
    if (proximo === 'iguais' && valor && !blocosIguais(valor)) {
      setConfirmar(true);
      return;
    }
    setConfirmar(false);
    if (proximo === 'diferentes') setRascunho(rascunhoDoModoDiferente(valor, rascunho));
    setModo(proximo);
  };
  const celulas = rascunho.length >= 2 ? rascunho : valor && valor.length >= 2 ? [...valor] : [];
  const publicarCelulas = (lista: readonly (number | null)[], aindaInvalidos: ReadonlySet<number>) => {
    setRascunho([...lista]);
    setInvalidos(aindaInvalidos);
    aoMudar(blocosSeValidos(lista, aindaInvalidos.size > 0));
  };
  const alterarBloco = (indice: number, reps: number | null) => {
    const proximo = [...celulas];
    proximo[indice] = reps;
    const ainda = new Set(invalidos);
    ainda.delete(indice);
    publicarCelulas(proximo, ainda);
  };
  const invalidarBloco = (indice: number, ok: boolean) => {
    if (ok) return;
    setInvalidos((atual) => new Set(atual).add(indice));
    aoMudar(null);
  };
  return <View style={estilos.bloco}>
    <Escolha rotulo="Distribuição dos blocos" opcoes={[{ valor: 'iguais', rotulo: 'Blocos iguais' }, { valor: 'diferentes', rotulo: 'Blocos diferentes' }]} valor={modo} aoMudar={escolher} />
    {confirmar ? <View style={estilos.bloco}>
      <Texto variante="pequeno">Isso substitui os blocos diferentes por blocos iguais, usando as repetições do primeiro.</Texto>
      <Botao tipo="secundario" rotulo="Converter para blocos iguais" aoTocar={() => {
        const primeiro = valor?.[0];
        if (valor && primeiro != null) {
          const iguais = Array.from({ length: valor.length }, () => primeiro);
          setRascunho(iguais);
          setQuantidade(iguais.length);
          setRepsCada(primeiro);
          setQuantidadeInvalida(false);
          setRepsInvalidas(false);
          setInvalidos(new Set());
          aoMudar(iguais);
        }
        setModo('iguais');
        setConfirmar(false);
      }} />
    </View> : null}
    {modo === 'iguais' && !confirmar ? <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Quantos blocos" inteiro valor={quantidade} erro={erroFaixa}
        aoMudar={(q) => { setQuantidade(q); setQuantidadeInvalida(false); aplicarIguais(q, repsCada, false, repsInvalidas); }} aoValidade={invalidarQuantidade} ajuda="De 2 a 10." /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Repetições em cada bloco" inteiro valor={repsCada} erro={erroReps}
        aoMudar={(reps) => { setRepsCada(reps); setRepsInvalidas(false); aplicarIguais(quantidade, reps, quantidadeInvalida, false); }} aoValidade={invalidarReps} ajuda="De 1 a 50." /></View>
    </View> : null}
    {modo === 'diferentes' && celulas.length < 2 ? <Texto variante="pequeno">Escreva a notação, como 4+2, para editar cada bloco.</Texto> : null}
    {modo === 'diferentes' && celulas.length >= 2 ? <View style={estilos.bloco}>
      {celulas.map((reps, indice) => <View key={indice} style={estilos.campo}>
        <CampoNumerico rotulo={`Bloco ${indice + 1}`} inteiro valor={reps} erro={reps != null && (reps < 1 || reps > 50) ? 'De 1 a 50 repetições.' : null}
          aoMudar={(v) => alterarBloco(indice, v)} aoValidade={(ok) => invalidarBloco(indice, ok)} />
      </View>)}
      <View style={estilos.linha}>
        <Botao tipo="secundario" rotulo="Mais um bloco" desabilitado={celulas.length >= 10 || invalidos.size > 0} motivo={invalidos.size > 0 ? 'Corrija o bloco com número inválido.' : undefined} aoTocar={() => publicarCelulas([...celulas, celulas[celulas.length - 1]], invalidos)} />
        <Botao tipo="fantasma" rotulo="Menos um bloco" desabilitado={celulas.length <= 2 || invalidos.size > 0} motivo={invalidos.size > 0 ? 'Corrija o bloco com número inválido.' : undefined} aoTocar={() => publicarCelulas(celulas.slice(0, -1), invalidos)} />
      </View>
    </View> : null}
    <Campo rotulo="Blocos de repetições" valor={texto} maxLength={60} placeholder="4+2 ou 4×4"
      ajuda="Notação compacta. Grava os mesmos blocos."
      erro={erro ?? (texto && !blocosValidos(lerBlocos(texto)) ? 'De 2 a 10 blocos, cada um com 1 a 50 repetições.' : null)}
      aoMudar={(t) => {
        setTexto(t);
        const lidos = lerBlocos(t);
        const gravados = blocosSeValidos(lidos, false);
        aoMudar(gravados);
        setQuantidadeInvalida(false);
        setRepsInvalidas(false);
        setInvalidos(new Set());
        if (lidos && lidos.length >= 2 && !blocosIguais(lidos)) {
          setModo('diferentes');
          setRascunho(lidos);
        } else if (gravados && blocosIguais(gravados)) {
          setModo('iguais');
          setQuantidade(gravados.length);
          setRepsCada(gravados[0]);
          setRascunho(gravados);
        }
      }} />
    {resumo ? <Texto variante="pequeno">{`${resumo.repeticoes} repetições por série · ${resumo.blocos} blocos · ${resumo.pausas} ${resumo.pausas === 1 ? 'pausa interna' : 'pausas internas'}`}</Texto> : null}
    {completa && !resumo ? <Texto variante="pequeno">Complete os blocos para visualizar a prescrição.</Texto> : null}
  </View>;
}

function CamposDePausa({ t, mudar, e, rotulo = 'Pausa', ajuda }: {
  t: Tecnica; mudar: (parte: Partial<Tecnica>) => void; e: Problemas; rotulo?: string; ajuda?: string;
}) {
  return <View style={estilos.linha}>
    <View style={estilos.campo}><CampoNumerico rotulo={rotulo} inteiro sufixo="s" valor={t.pausaSegundos ?? null} aoMudar={(pausaSegundos) => mudar({ pausaSegundos })} erro={e.pausaSegundos} ajuda={ajuda} /></View>
    <View style={estilos.campo}><CampoNumerico rotulo="Pausa em respirações" inteiro valor={t.pausaRespiracoes ?? null} aoMudar={(pausaRespiracoes) => mudar({ pausaRespiracoes })}
      erro={e.pausaRespiracoes} ajuda="Se preencher as duas, o aluno lê as duas." /></View>
  </View>;
}

const OPCOES_DE_REGIAO: { valor: RegiaoDasParciais | null; rotulo: string }[] = REGIOES_DAS_PARCIAIS;

/**
 * Campos próprios de cada uma das seis técnicas. `completa` é a técnica da série (cobra o que falta); falso é o padrão
 * parcial da metodologia, em que só os valores presentes são conferidos. Sem `erros`, calcula os da própria técnica.
 */
export function CamposDaTecnica({ tecnica: t, aoMudar, completa = true, erros }: {
  tecnica: Tecnica; aoMudar: (t: Tecnica) => void; completa?: boolean; erros?: Problemas;
}) {
  const e = erros ?? problemasDaTecnica(t, completa);
  const mudar = (parte: Partial<Tecnica>) => aoMudar({ ...t, ...parte });
  const pausa = <CamposDePausa t={t} mudar={mudar} e={e} />;
  switch (t.tipo) {
    case 'REST_PAUSE':
      return <View style={estilos.bloco}>
        {pausa}
        <View style={estilos.campo}><CampoNumerico rotulo="Quantas pausas" inteiro valor={t.pausas ?? null} aoMudar={(pausas) => mudar({ pausas })} erro={e.pausas} ajuda="3 micro-séries = 2 pausas. Vazio = 1." /></View>
      </View>;
    case 'CLUSTER':
      return <View style={estilos.bloco}>
        <CampoBlocos valor={t.blocos} completa={completa} aoMudar={(blocos) => mudar({ blocos })} erro={e.blocos} />
        <CamposDePausa t={t} mudar={mudar} e={e} rotulo="Pausa entre blocos" ajuda="Não entra depois do último bloco. O descanso da série fica no outro campo." />
      </View>;
    case 'DROP_SET':
      return <View style={estilos.linha}>
        <View style={estilos.campo}><CampoNumerico rotulo="Quedas" inteiro valor={t.quedas ?? null} aoMudar={(quedas) => mudar({ quedas })} erro={e.quedas} /></View>
        <View style={estilos.campo}><CampoNumerico rotulo="Reduzir a carga" inteiro sufixo="%" valor={t.reducaoPercentual ?? null} aoMudar={(reducaoPercentual) => mudar({ reducaoPercentual })}
          erro={e.reducaoPercentual} ajuda="Vazio = sem fixar." /></View>
        <View style={estilos.campo}><CampoNumerico rotulo="Reps por queda" inteiro valor={t.repsPorQueda ?? null} aoMudar={(repsPorQueda) => mudar({ repsPorQueda })}
          erro={e.repsPorQueda} ajuda="Vazio = até a falha." /></View>
        <View style={estilos.campo}><CampoNumerico rotulo="Descanso entre quedas" inteiro sufixo="s" valor={t.pausaSegundos ?? null} aoMudar={(pausaSegundos) => mudar({ pausaSegundos })}
          erro={e.pausaSegundos} ajuda="0 ou vazio = sem descanso." /></View>
      </View>;
    case 'MYO_REPS':
      return <View style={estilos.bloco}>
        <View style={estilos.linha}>
          <View style={estilos.campo}><CampoNumerico rotulo="Mini-séries" inteiro valor={t.miniSeries ?? null} aoMudar={(miniSeries) => mudar({ miniSeries })} erro={e.miniSeries} ajuda="De 2 a 10." /></View>
          <View style={estilos.campo}><CampoNumerico rotulo="Reps por mini-série" inteiro valor={t.repsPorMiniSerie ?? null} aoMudar={(repsPorMiniSerie) => mudar({ repsPorMiniSerie })} erro={e.repsPorMiniSerie} /></View>
        </View>
        {pausa}
      </View>;
    case 'PARTIAL_REPS':
      return <View style={estilos.bloco}>
        <View style={estilos.campo}><CampoNumerico rotulo="Repetições parciais" inteiro valor={t.repsParciais ?? null} aoMudar={(repsParciais) => mudar({ repsParciais })} erro={e.repsParciais} /></View>
        <Escolha rotulo="Região das parciais" opcoes={OPCOES_DE_REGIAO} valor={t.regiao ?? null} aoMudar={(regiao) => mudar({ regiao })} />
        <ErroDoCampo mensagem={e.regiao} />
      </View>;
    case 'FORCED_REPS':
      return <View style={estilos.bloco}>
        <View style={estilos.campo}><CampoNumerico rotulo="Repetições assistidas" inteiro valor={t.repsAssistidas ?? null} aoMudar={(repsAssistidas) => mudar({ repsAssistidas })} erro={e.repsAssistidas} ajuda="De 1 a 5." /></View>
        <AvisoDoCampo mensagem="Forced reps precisa de um parceiro para ajudar nas repetições." />
      </View>;
    default:
      return <ErroDoCampo mensagem={e.tipo} />;
  }
}

// ---- Cardio ----

const CARDIO_VAZIO: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null };
const ZONAS = [1, 2, 3, 4, 5].map((valor) => ({ valor: valor as number | null, rotulo: `Zona ${valor}` }));

/** Prescrição de cardio: duração, distância, ritmo, zona e, se quiser, intervalos de esforço e descanso em voltas. */
export function CamposDoCardio({ cardio, aoMudar, erros }: { cardio: Cardio | null | undefined; aoMudar: (c: Cardio) => void; erros: Problemas }) {
  const c = cardio ?? CARDIO_VAZIO;
  const mudar = (parte: Partial<Cardio>) => aoMudar({ ...CARDIO_VAZIO, ...c, ...parte });
  const i = c.intervalos;
  const mudarIntervalos = (parte: Partial<NonNullable<Cardio['intervalos']>>) => mudar({ intervalos: { trabalhoSeg: i?.trabalhoSeg ?? null, descansoSeg: i?.descansoSeg ?? null, voltas: i?.voltas ?? null, ...parte } });
  return <View style={estilos.bloco}>
    <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Duração" inteiro sufixo="min" valor={c.duracaoMin ?? null} aoMudar={(duracaoMin) => mudar({ duracaoMin })} erro={erros.duracaoMin} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Distância" sufixo="km" valor={c.distanciaKm ?? null} aoMudar={(distanciaKm) => mudar({ distanciaKm })} erro={erros.distanciaKm} /></View>
      <View style={estilos.campo}><Campo rotulo="Ritmo" valor={c.ritmo ?? ''} maxLength={40} placeholder="Ex.: 6 min/km"
        aoMudar={(t) => mudar({ ritmo: t.trim() ? t : null })} erro={erros.ritmo} /></View>
    </View>
    <Escolha rotulo="Zona de esforço" opcoes={ZONAS} valor={c.zona ?? null} aoMudar={(zona) => mudar({ zona })} limpavel />
    <ErroDoCampo mensagem={erros.zona} />
    <Interruptor rotulo="Intervalado" ajuda="Voltas de esforço e descanso." valor={!!i} aoMudar={(ligado) => mudar({ intervalos: ligado ? { trabalhoSeg: null, descansoSeg: null, voltas: null } : null })} />
    {i ? <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Esforço" inteiro sufixo="s" valor={i.trabalhoSeg ?? null} aoMudar={(trabalhoSeg) => mudarIntervalos({ trabalhoSeg })} erro={erros['intervalos.trabalhoSeg']} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Descanso" inteiro sufixo="s" valor={i.descansoSeg ?? null} aoMudar={(descansoSeg) => mudarIntervalos({ descansoSeg })} erro={erros['intervalos.descansoSeg']} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Voltas" inteiro valor={i.voltas ?? null} aoMudar={(voltas) => mudarIntervalos({ voltas })} erro={erros['intervalos.voltas']} /></View>
    </View> : null}
    <ErroDoCampo mensagem={erros.cardio} />
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { minWidth: 140, flexGrow: 1, flexBasis: 140, maxWidth: 260 },
});
