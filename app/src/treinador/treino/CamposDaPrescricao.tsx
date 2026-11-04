import { Minus, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Cardio, Carga, Configuracao, Esforco, ModoDeCarga, PapelDaSerie } from '../../api/tipos';
import { modosDeCarga } from '../../dominio/editorTreino';
import { CASAS_EM_LIBRA, kgParaTela, nomeDaUnidade, telaParaKg } from '../../dominio/unidadeDeCarga';
import { mensagemDaCargaFixa, RIR_MAXIMO, type Problemas } from '../../dominio/validacaoDeSerie';
import { mascaraDeNumero } from '../../dominio/formatos';
import { escalar } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { ajudaDaCarga, formaDoEsforco, FORMAS_DE_ESFORCO, OPCOES_DE_RIR, rotulosDaFaixa, type FormaDeEsforco } from './opcoesDoEditor';
import { CampoSozinho, ErroDoCampo } from './CamposComuns';

// Quem usa os campos importa tudo daqui (e os testes mocam este módulo inteiro).
export * from './CamposComuns';
export { CamposDaTecnica } from './CamposDaTecnica';

/**
 * Os campos de prescrição que a série e a metodologia dividem: forma de carga e faixa, esforço (RIR ou RPE), técnica e
 * cardio. Cada um recebe os problemas do próprio trecho (chaves relativas: `percentualMin`, `rir`, `blocos`...) e mostra o
 * erro no campo; quem decide o que bloqueia é a tela.
 */

// ---- Carga ----

/** A forma de carga (carga de trabalho, % da WS, mesma carga, acima da anterior, abaixo da referência, sem carga). */
export function EscolhaDeCarga({ carga, config, papel, aoMudarModo, erro, rotulo = 'Carga', rotuloVisivel = true, ajuda: ajudaPropria, exercicioComCarga = false }: {
  carga: Carga | null | undefined; config: Configuracao | null; papel?: PapelDaSerie | null;
  aoMudarModo: (modo: ModoDeCarga) => void; erro?: string | null; rotulo?: string;
  /** Falso quando o título da seção já diz o mesmo: o rótulo fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  /** Ajuda no lugar da padrão da forma de carga (o Cluster junta a dele numa linha só). */
  ajuda?: string;
  /** Série de um exercício com carga (fora do cardio): só então a carga fixa em kg é oferecida (`modosDeCarga`). */
  exercicioComCarga?: boolean;
}) {
  const modo = carga?.modo ?? 'NENHUMA';
  const unidade = useUnidadeDeCarga();
  const ajuda = ajudaPropria ?? ajudaDaCarga(modo, config, unidade);
  // As duas formas mais usadas para o papel (e a gravada) ficam à vista; as outras, atrás de "Outras formas de carga",
  // recolhidas (reunião de 30/10). A divisão usa a forma gravada quando o campo abriu: escolher uma das "outras" não a
  // faz pular para a linha de cima enquanto a pessoa ainda está olhando. Nenhuma forma válida some.
  const [modoAoAbrir] = useState(modo);
  const { principais, outras } = modosDeCarga(config, papel, modoAoAbrir, exercicioComCarga, unidade);
  const [verOutras, setVerOutras] = useState(false);
  const daOutras = outras.some((o) => o.valor === modo);
  const abertas = verOutras || daOutras;
  const escolher = (m: ModoDeCarga | null) => { if (m) aoMudarModo(m); };
  return <View style={estilos.bloco}>
    <Escolha<ModoDeCarga | null> rotulo={rotuloVisivel ? rotulo : undefined} descricao={rotulo} opcoes={principais} valor={daOutras ? null : modo} aoMudar={escolher} />
    {/* Com a forma gravada entre as "outras", elas ficam abertas (não se esconde o que está escolhido): só o título. */}
    {outras.length > 0 && daOutras ? <Texto variante="rotulo">Outras formas de carga</Texto> : null}
    {outras.length > 0 && !daOutras ? <BotaoDeAbrir texto="Outras formas de carga" rotuloAcessivel={rotulo === 'Carga' ? undefined : `Outras formas de carga (${rotulo.toLowerCase()})`}
      aberto={abertas} aoAlternar={() => setVerOutras(!abertas)} /> : null}
    {abertas && outras.length > 0 ? <Escolha<ModoDeCarga | null> descricao={`${rotulo}: outras formas de carga`} opcoes={outras} valor={daOutras ? modo : null}
      aoMudar={(m) => { setVerOutras(true); escolher(m); }} /> : null}
    {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
    <ErroDoCampo mensagem={erro} />
  </View>;
}

/**
 * O percentual (mínimo e máximo opcional) das formas de carga que têm faixa; nada nas outras. Com várias séries, quem
 * chama passa `semAjuda` e mostra a ajuda uma vez só, embaixo de todas (teste local de 30/10).
 */
export function FaixaDeCarga({ carga, config, prefixo = '', aoMudar, erros, semAjuda = false, aoLado }: {
  carga: Carga | null | undefined; config: Configuracao | null; prefixo?: string;
  aoMudar: (min: number | null, max: number | null) => void; erros: Problemas; semAjuda?: boolean;
  /** Mais uma célula na mesma linha, depois do máximo (o RIR daquela série, no grupo de séries). */
  aoLado?: ReactNode;
}) {
  const rotulos = rotulosDaFaixa(carga?.modo, config);
  if (!rotulos) return null;
  // Os dois campos começam no mesmo nível (rótulos e caixas alinhados); a ajuda vai embaixo da linha, não dentro de um
  // dos campos (ela deixava o mínimo mais alto que o máximo).
  return <View style={estilos.bloco}>
    <View style={estilos.linha}>
      <View style={estilos.campoDaFaixa}><CampoNumerico rotulo={`${prefixo}${rotulos.minimo}`} sufixo="%" valor={carga?.percentualMin ?? null}
        aoMudar={(v) => aoMudar(v, carga?.percentualMax ?? null)} erro={erros.percentualMin} /></View>
      <View style={estilos.campoDaFaixa}><CampoNumerico rotulo={`${prefixo}${rotulos.maximo}`} sufixo="%" valor={carga?.percentualMax ?? null}
        aoMudar={(v) => aoMudar(carga?.percentualMin ?? null, v)} erro={erros.percentualMax} /></View>
      {aoLado}
    </View>
    {semAjuda ? null : <Texto variante="pequeno">{rotulos.ajuda}</Texto>}
  </View>;
}

/**
 * A carga fixa na unidade de quem edita (kg ou lb, `useUnidadeDeCarga`): decimal com vírgula, até 2 casas em kg e 1 em libra
 * (a máscara não deixa passar a seguinte). `valor` e `aoMudar` falam sempre kg: a conversão é só da borda
 * (`kgParaTela`/`telaParaKg`), então o plano continua guardando kg. O rótulo não repete o nome da opção ("Carga fixa (kg)"),
 * para o leitor de tela não ouvir dois controles com o mesmo nome.
 */
export function CampoDaCargaFixa({ valor, aoMudar, erro }: { valor: number | null | undefined; aoMudar: (kg: number | null) => void; erro?: string | null }) {
  const unidade = useUnidadeDeCarga();
  const emLibra = unidade === 'lb';
  // A mensagem da regra (compartilhada com a API) fala do teto em kg; aqui ela sai no número que a pessoa lê.
  const mensagem = emLibra && erro === mensagemDaCargaFixa() ? mensagemDaCargaFixa(unidade) : erro;
  return <CampoSozinho>
    <CampoNumerico rotulo="Peso da carga fixa" rotuloAcessivel={emLibra ? `Peso da carga fixa, em ${nomeDaUnidade(unidade)}` : undefined} sufixo={unidade}
      valor={kgParaTela(valor, unidade)} mascara={(t) => mascaraDeNumero(t, emLibra ? CASAS_EM_LIBRA : 2)}
      aoMudar={(v) => aoMudar(telaParaKg(v, unidade))} erro={mensagem} />
  </CampoSozinho>;
}

/**
 * RIR de UMA série do grupo, num passo de − e +, de 0 ("falha") a 10. Fica na linha do percentual daquela série (ou na
 * lista do esforço, sem percentual): onze chips por série não caberiam em 390 px. O passo não sai da faixa; um valor
 * gravado fora dela (planilha antiga) aparece com o erro da validação.
 */
export function RirDaSerie({ numero, valor, aoMudar, erro }: { numero: number; valor: number; aoMudar: (rir: number) => void; erro?: string | null }) {
  const { cores, fatorTexto } = useTema();
  const rotulo = `Série ${numero} · RIR`;
  const falha = valor === 0;
  return <View style={estilos.rir}>
    <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
    <View style={estilos.passo}>
      <IconeBotao moldura Icone={Minus} rotulo={`Diminuir o RIR da série ${numero}`} desabilitado={valor <= 0} aoTocar={() => aoMudar(Math.min(valor - 1, RIR_MAXIMO))} />
      <View accessible accessibilityLabel={`${rotulo}: ${falha ? '0, até a falha' : valor}`} accessibilityLiveRegion="polite"
        style={[estilos.valorDoRir, { minWidth: escalar(LARGURA_DO_RIR, fatorTexto), borderColor: erro ? cores.perigo : cores.bordaCampo, backgroundColor: cores.campo }]}>
        <Texto numerico style={estilos.textoDoRir} cor={cores.texto}>{falha ? 'falha' : String(valor)}</Texto>
      </View>
      <IconeBotao moldura Icone={Plus} rotulo={`Aumentar o RIR da série ${numero}`} desabilitado={valor >= RIR_MAXIMO} aoTocar={() => aoMudar(Math.max(valor + 1, 0))} />
    </View>
    <ErroDoCampo mensagem={erro} />
  </View>;
}

/** Cabe "falha" no tamanho de texto padrão; cresce com o texto da pessoa. */
const LARGURA_DO_RIR = 64;

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

// ---- Repetições ----

// ---- Esforço ----

/**
 * Esforço percebido: RIR (0 a 10) ou RPE (1 a 10, de meio em meio), nunca os dois. A forma escolhida fica com a tela
 * enquanto o esforço ainda está vazio ("RIR" sem número não seria lembrado só pelo valor).
 *
 * No grupo de séries (`variasSeries`) o valor escolhido aqui vale para todas: o rótulo diz isso. Com RIR diferente em cada
 * série (`rirDeCadaSerie`, "3, 2, 2, 1"), nenhum número fica marcado, para não parecer que o grupo tem o RIR da primeira; só
 * um toque aqui troca todas. `semRpe` tira a opção RPE (séries de aquecimento e preparação, `mostraRpe`).
 */
export function CamposDoEsforco({ esforco, aoMudar, erros, rotulo = 'Esforço', rotuloVisivel = true, semRpe = false, variasSeries = false, rirDeCadaSerie }: {
  esforco: Esforco | null | undefined; aoMudar: (e: Esforco | null) => void; erros: Problemas; rotulo?: string;
  /** Falso quando o título da seção já diz o mesmo: o rótulo fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  semRpe?: boolean;
  variasSeries?: boolean;
  /** Os RIR do grupo em texto, quando não são todos iguais; nulo ou ausente quando são. */
  rirDeCadaSerie?: string | null;
}) {
  const [escolhida, setEscolhida] = useState<FormaDeEsforco>(formaDoEsforco(esforco));
  const doValor = formaDoEsforco(esforco);
  // Escolheu RPE (ainda sem número) e o tipo virou aquecimento: a opção sumiu, então vale "não prescrito".
  const forma = doValor !== 'NENHUM' ? doValor : semRpe && escolhida === 'RPE' ? 'NENHUM' : escolhida;
  const formas = semRpe && doValor !== 'RPE' ? FORMAS_DE_ESFORCO.filter((f) => f.valor !== 'RPE') : FORMAS_DE_ESFORCO;
  const mudarForma = (f: FormaDeEsforco) => {
    setEscolhida(f);
    if (f !== forma || f === 'NENHUM') aoMudar(null);
  };
  const misto = !!rirDeCadaSerie;
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotuloVisivel ? rotulo : undefined} descricao={rotulo} opcoes={formas} valor={forma} aoMudar={mudarForma} />
    {forma === 'RIR' ? <>
      {/* Lista suspensa (11 chips em duas linhas pesavam na tela); sem número gravado, ou com RIR diferente em cada série, mostra "—". */}
      <EscolhaSuspensa<number | null> rotulo={variasSeries ? 'RIR de todas as séries' : 'RIR (repetições na reserva)'} opcoes={OPCOES_DE_RIR} valor={misto ? null : esforco?.rir ?? null}
        aoMudar={(rir) => { if (rir != null) aoMudar({ rir, rpe: null }); }} style={estilos.rirSuspenso} />
      {misto ? <Texto variante="pequeno">Cada série tem o seu RIR ({rirDeCadaSerie}). Escolher um número aqui troca o de todas.</Texto>
        : variasSeries ? <Texto variante="pequeno">Vale para todas as séries. Para mudar só uma, use o RIR da própria série.</Texto> : null}
      {!misto && esforco?.rir === 0 ? <Texto variante="pequeno">RIR 0: o aluno vai até a falha.</Texto> : null}
      <ErroDoCampo mensagem={erros.rir} />
    </> : null}
    {forma === 'RPE' ? <CampoSozinho>
      <CampoNumerico rotulo={variasSeries ? 'RPE de todas as séries (1 a 10, de meio em meio)' : 'RPE (1 a 10, de meio em meio)'} valor={esforco?.rpe ?? null}
        aoMudar={(rpe) => aoMudar({ rir: null, rpe })} erro={erros.rpe} ajuda="Esforço percebido. Ex.: 8 ou 8,5." />
    </CampoSozinho> : null}
  </View>;
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
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  // Mesmo tamanho nos dois campos do percentual; largos o bastante para o rótulo "Série 3 · Máximo (%)" não quebrar.
  campoDaFaixa: { minWidth: 160, flexGrow: 1, flexBasis: 160, maxWidth: 220 },
  // A lista suspensa do RIR: não estica além de uma célula no PC (como os campos numéricos).
  rirSuspenso: { maxWidth: 260 },
  rir: { gap: espaco(0.5) },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  valorDoRir: { height: 40, paddingHorizontal: espaco(1), borderWidth: 1, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  textoDoRir: { fontFamily: fontes.negrito, fontSize: 15, lineHeight: 20 },
});
