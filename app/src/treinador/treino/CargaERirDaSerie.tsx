import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Carga, Configuracao, ModoDeCarga, Serie, Tecnica } from '../../api/tipos';
import { modoDoGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import { alterarGrupo, alterarRirDaSerie } from '../../dominio/editorTreino';
import { mascaraDeNumero } from '../../dominio/formatos';
import { AJUDA_SEM_CARGA, cargaERirIguais, dicaDaCarga, esforcoDoGrupo, percentuaisEmTodas, podeEscolherRpe, rirEmTodas, rpeEmTodas } from '../../dominio/camposDaSerie';
import { nomeDaSerieDeTrabalho, papelDe } from '../../dominio/metodologia';
import { escalar } from '../../dominio/preferencias';
import { wsDeReferenciaKg } from '../../dominio/previaDaSerie';
import { CASAS_EM_LIBRA, kgParaTela, nomeDaUnidade, telaParaKg, type UnidadeDeCarga } from '../../dominio/unidadeDeCarga';
import { mensagemDaCargaFixa, type Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeInfo, Explicacao } from './BotaoDeAbrir';
import { AvisoDoCampo, CampoSozinho, ErroDoCampo } from './CamposBasicos';
import { CamposDasCargasDosBlocos } from './CamposDaTecnica';
import { cargaPendente, escolhaDeCargaDoPapel, FALTA_A_CARGA, modoAoEscolher, OPCOES_DO_RIR, percentuaisNoGrupo } from './cargaDaSerie';
import { ALTURA_DO_CONTROLE, CampoDaSerie, LinhaDoFormulario } from './LinhaDoFormulario';
import { ajudaDaCarga, problemasDoGrupoDeSeries, rotulosDaFaixa, subProblemas, type ProblemasDaSerie } from './opcoesDoEditor';

/**
 * A carga fixa na unidade de quem edita (kg ou lb, `useUnidadeDeCarga`): decimal com vírgula, até 2 casas em kg e 1 em libra
 * (a máscara não deixa passar a seguinte). `valor` e `aoMudar` falam sempre kg: a conversão é só da borda
 * (`kgParaTela`/`telaParaKg`), então o plano continua guardando kg. O rótulo não repete o nome da opção ("Carga fixa (kg)"),
 * para o leitor de tela não ouvir dois controles com o mesmo nome.
 */
export function CampoDaCargaFixa({ valor, aoMudar, erro, rotulo = 'Peso da carga fixa', emKg = false, rotuloOculto = false }: {
  valor: number | null | undefined; aoMudar: (kg: number | null) => void; erro?: string | null; rotulo?: string;
  /** A metodologia fica sempre em kg, qualquer que seja a unidade de quem vê. */
  emKg?: boolean;
  /** Sem o rótulo em cima, a unidade dentro da caixa. */
  rotuloOculto?: boolean;
}) {
  const preferida = useUnidadeDeCarga();
  const unidade = emKg ? 'kg' : preferida;
  const emLibra = unidade === 'lb';
  return <CampoSozinho>
    <CampoNumerico rotulo={rotulo} rotuloAcessivel={emLibra ? `${rotulo}, em ${nomeDaUnidade(unidade)}` : undefined} sufixo={unidade} rotuloOculto={rotuloOculto} sufixoNaCaixa={rotuloOculto}
      valor={kgParaTela(valor, unidade)} mascara={(t) => mascaraDeNumero(t, emLibra ? CASAS_EM_LIBRA : 2)}
      aoMudar={(v) => aoMudar(telaParaKg(v, unidade))} erro={mensagemNaUnidade(erro, unidade)} />
  </CampoSozinho>;
}

/** A mensagem da regra (compartilhada com a API) fala do teto em kg; em libra ela sai no número que a pessoa lê. */
function mensagemNaUnidade(erro: string | null | undefined, unidade: UnidadeDeCarga): string | null | undefined {
  return unidade === 'lb' && erro === mensagemDaCargaFixa() ? mensagemDaCargaFixa(unidade) : erro;
}

/** O percentual (mínimo e máximo opcional) do padrão do tipo na metodologia; nada nas formas sem percentual. */
export function FaixaDeCarga({ carga, config, aoMudar, erros }: {
  carga: Carga | null | undefined; config: Configuracao | null; aoMudar: (min: number | null, max: number | null) => void; erros: Problemas;
}) {
  const rotulos = rotulosDaFaixa(carga?.modo, config);
  if (!rotulos) return null;
  return <View style={estilos.bloco}>
    <View style={estilos.faixa}>
      <View style={estilos.campoDaFaixa}><CampoNumerico rotulo={rotulos.minimo} sufixo="%" valor={carga?.percentualMin ?? null}
        aoMudar={(v) => aoMudar(v, carga?.percentualMax ?? null)} erro={erros.percentualMin} /></View>
      <View style={estilos.campoDaFaixa}><CampoNumerico rotulo={rotulos.maximo} sufixo="%" valor={carga?.percentualMax ?? null}
        aoMudar={(v) => aoMudar(carga?.percentualMin ?? null, v)} erro={erros.percentualMax} /></View>
    </View>
    <Texto variante="pequeno">{rotulos.ajuda}</Texto>
  </View>;
}

/**
 * O RIR numa lista suspensa: "—" (não prescrito), "0" (até a falha) e 1 a 10 (onze chips por série não caberiam em 390 px).
 * Na linha da série o rótulo visível é só "RIR" (a linha já diz qual é a série) e o nome inteiro vai em `rotuloAcessivel`.
 */
export function EscolhaDoRir({ rotulo, valor, aoMudar, style, rotuloAcessivel }: {
  rotulo: string; valor: number | null; aoMudar: (rir: number | null) => void; style?: StyleProp<ViewStyle>; rotuloAcessivel?: string;
}) {
  return <EscolhaSuspensa<number | null> rotulo={rotulo} rotuloAcessivel={rotuloAcessivel} opcoes={OPCOES_DO_RIR} valor={valor} aoMudar={aoMudar} style={[estilos.rir, style]} />;
}

/** Cluster em carga de trabalho: a ajuda da carga numa linha só (a base do dia, não a série anterior). */
const AJUDA_DA_CARGA_DO_CLUSTER = 'A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.';

/** O texto do ⓘ da linha da carga. Nulo sem nada a explicar. */
export function ajudaDaCargaDoGrupo(g: GrupoDeSeries, config: Configuracao, semCarga: boolean, unidade: UnidadeDeCarga): string | null {
  if (semCarga) return null;
  const s = g.series[0];
  const papel = papelDe(config, s.tipo);
  const modo = modoDoGrupo(g);
  const escolha = escolhaDeCargaDoPapel(config, papel, modo, unidade, 'serie');
  if (escolha.marcado === 'PERCENTUAL_WS') return papel === 'AQUECIMENTO' ? 'Em branco, o aluno não recebe sugestão de carga.' : rotulosDaFaixa('PERCENTUAL_WS', config)?.ajuda ?? null;
  if (s.tecnica?.tipo === 'CLUSTER' && modo === 'CARGA_TRABALHO') return AJUDA_DA_CARGA_DO_CLUSTER;
  return modo === 'CARGA_FIXA' ? ajudaDaCarga(modo, config, unidade) : null;
}

/** Larguras da linha (SERIE-ABERTA.md, seções 1 a 3): o nome "Série N", o RIR e a carga em kg (cabe "102,5"). */
const LARGURA_DO_NOME_DA_SERIE = 64;
const LARGURA_DO_RIR = 96;
const LARGURA_DO_KG = 88;
/**
 * A coluna da carga nas linhas por série: o RIR fica alinhado de uma série para a outra. Cabe "[85] a [90] % da WS" (~220);
 * com 260 a linha (64 + 260 + 96 + vãos) passava dos ~418 px dos controles com a prévia ao lado em 1280 e o RIR descia.
 */
const LARGURA_DA_CARGA = 224;

type Esforco = 'RIR' | 'RPE';
const OPCOES_DO_ESFORCO: { valor: Esforco; rotulo: string }[] = [{ valor: 'RIR', rotulo: 'RIR' }, { valor: 'RPE', rotulo: 'RPE' }];

/**
 * A linha "Carga e RIR" da série aberta (SERIE-ABERTA.md, seções 1 a 3), já como `LinhaDoFormulario` (com o ⓘ e a dica):
 * a forma de carga pelo papel ("% da WS · Carga fixa (kg)"), o segmento RIR · RPE (na série de trabalho, ou onde já há
 * RPE; trocar apaga o esforço do grupo, com confirmação quando há valor gravado) e, com mais de uma série, "Mesmo valor
 * para todas" (nasce ligado quando todas estão iguais e só vale enquanto estiverem: o grupo que cresce com outro RIR
 * volta às linhas por série). Ligado (ou uma série só), os campos ficam na própria linha: `[50] a [60] % da WS` (ou `[kg]`) e o RIR.
 * Desligado, uma linha por série: `Série 1 | [50] a [50] % da WS | RIR 3`. O RIR é de cada série (`alterarRirDaSerie`) e
 * não separa o grupo; os kg são do grupo (kg diferentes separam as séries em grupos) e ficam na linha de cima. No Cluster,
 * embaixo, "Carga diferente por bloco". A dica é a estimativa sobre a WS de referência (`dicaDaCarga`, `wsDeReferenciaKg`).
 */
export function CargaERirDaSerie({ grupo: g, series, config, porSerie, semCarga, aoMudar }: {
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; porSerie: readonly ProblemasDaSerie[]; semCarga: boolean; aoMudar: (novas: Serie[]) => void;
}) {
  const { cores, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  const s = g.series[0];
  const papel = papelDe(config, s.tipo);
  const modo = modoDoGrupo(g);
  const escolha = escolhaDeCargaDoPapel(config, papel, modo, unidade, 'serie');
  const percentual = !semCarga && escolha.marcado === 'PERCENTUAL_WS';
  const fixa = !semCarga && modo === 'CARGA_FIXA';
  const { erros, avisos } = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  const temRpe = esforcoDoGrupo(g) === 'RPE';
  const temRir = g.series.some((x) => x.esforco?.rir != null);
  const [usarRpe, setUsarRpe] = useState(temRpe);
  const podeRpe = podeEscolherRpe(papel, temRpe);
  // O gravado vence a escolha guardada: o editor não remonta quando o grupo cresce, e a série que entra com RPE (ou com
  // RIR) não pode ficar escondida atrás do segmento. Sem esforço gravado, vale o segmento.
  const rpe = podeRpe && (temRpe || (!temRir && usarRpe));
  const varias = g.series.length > 1;
  const iguais = cargaERirIguais(g);
  const [mesmo, setMesmo] = useState(iguais);
  // Pelo mesmo motivo, "Mesmo valor para todas" só vale com as séries iguais agora: senão "Todas as séries" mostraria o
  // valor da 1ª e gravaria por cima das outras sem aviso.
  const mesmoVale = mesmo && iguais;
  const umaLinha = !varias || mesmoVale;
  const [confirmarTroca, setConfirmarTroca] = useState(false);
  const comEsforco = g.series.filter((x) => x.esforco?.rir != null || x.esforco?.rpe != null).length;
  const [infoAberta, setInfoAberta] = useState(false);
  const ajuda = ajudaDaCargaDoGrupo(g, config, semCarga, unidade);
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const ws = nomeDaSerieDeTrabalho(config);
  const largura = (px: number) => ({ width: escalar(px, fatorTexto) });

  const aplicarTroca = (v: Esforco) => {
    setUsarRpe(v === 'RPE');
    if (comEsforco) aoMudar(alterarGrupo(series, g, { esforco: null }, config));
  };
  // Trocar apaga o esforço do grupo: sem nada gravado troca direto; com valor, pergunta antes (painel na tela).
  const trocarEsforco = (v: Esforco) => {
    if ((v === 'RPE') === rpe) return;
    if (comEsforco) setConfirmarTroca(true);
    else aplicarTroca(v);
  };
  // Ligar com valores diferentes copia a Série 1 para as outras (a dica embaixo do interruptor diz isso antes).
  const ligarMesmo = (ligado: boolean) => {
    setMesmo(ligado);
    if (!ligado || iguais) return;
    let novas = percentual ? percentuaisEmTodas(series, g, s.carga?.percentualMin ?? null, s.carga?.percentualMax ?? null, papel) : series;
    novas = s.esforco?.rpe != null ? rpeEmTodas(novas, g, s.esforco.rpe) : rirEmTodas(novas, g, s.esforco?.rir ?? null);
    aoMudar(novas);
  };
  const mudarPercentuais = (j: number, min: number | null, max: number | null) =>
    aoMudar(umaLinha ? percentuaisEmTodas(series, g, min, max, papel) : percentuaisNoGrupo(series, g, j, min, max, config));
  const mudarRir = (i: number, rir: number | null) => aoMudar(umaLinha ? rirEmTodas(series, g, rir) : alterarRirDaSerie(series, i, rir));
  const mudarRpe = (i: number, valor: number | null) => aoMudar(umaLinha ? rpeEmTodas(series, g, valor)
    : series.map((x, k) => (k === i ? { ...x, esforco: valor == null ? null : { rir: null, rpe: valor } } : x)));
  const mudarTecnica = (parte: Partial<Tecnica>) => { if (s.tecnica) aoMudar(alterarGrupo(series, g, { tecnica: { ...s.tecnica, ...parte } }, config)); };

  // Carga obrigatória ainda vazia: aviso âmbar "Falta a carga." (guia premium págs. 4 e 9), não o erro vermelho do valor inválido.
  const kgPendente = !!erros['carga.valorKg'] && cargaPendente(s, 'carga.valorKg');
  const minPendente = (x: Serie, e: Problemas) => !!e['carga.percentualMin'] && cargaPendente(x, 'carga.percentualMin');
  /** As frases de uma série (erro vermelho e "Falta a carga" âmbar): a caixa só fica marcada, a frase vem embaixo. */
  const mensagensDaSerie = (x: Serie, i: number): ReactNode[] => {
    const e = porSerie[i]?.erros ?? {};
    const pendente = minPendente(x, e);
    const frases = [...new Set([pendente ? null : e['carga.percentualMin'], e['carga.percentualMax'], rpe ? e['esforco.rpe'] : e['esforco.rir']].filter((m): m is string => !!m))];
    return [
      ...frases.map((m) => <ErroDoCampo key={m} mensagem={m} />),
      pendente ? <AvisoDoCampo key="falta" mensagem={`${FALTA_A_CARGA}.`} /> : null,
      porSerie[i]?.avisos['esforco.rir'] ? <AvisoDoCampo key="aviso-rir" mensagem={porSerie[i]?.avisos['esforco.rir']} /> : null,
    ].filter(Boolean);
  };

  const camposDoPercentual = (x: Serie, j: number, nome: string) => {
    const e = porSerie[g.inicio + j]?.erros ?? {};
    return <>
      <CampoDaSerie rotulo={`${nome} · Mínimo (%)`} unidade="a" valor={x.carga?.percentualMin ?? null} erro={minPendente(x, e) ? null : e['carga.percentualMin']}
        aoMudar={(min) => mudarPercentuais(j, min, x.carga?.percentualMax ?? null)} />
      <CampoDaSerie rotulo={`${nome} · Máximo (%)`} unidade={`% da ${ws}`} valor={x.carga?.percentualMax ?? null} erro={e['carga.percentualMax']}
        aoMudar={(max) => mudarPercentuais(j, x.carga?.percentualMin ?? null, max)} />
    </>;
  };
  const campoDoKg = <CampoDaSerie rotulo={unidade === 'lb' ? `Carga, em ${nomeDaUnidade(unidade)}` : 'Carga (kg)'} unidade={unidade} larguraDoCampo={LARGURA_DO_KG}
    valor={kgParaTela(s.carga?.valorKg, unidade)} mascara={(t) => mascaraDeNumero(t, unidade === 'lb' ? CASAS_EM_LIBRA : 2)}
    erro={kgPendente ? null : mensagemNaUnidade(erros['carga.valorKg'], unidade)}
    aoMudar={(v) => aoMudar(alterarGrupo(series, g, { carga: { modo: 'CARGA_FIXA', valorKg: telaParaKg(v, unidade) } }, config))} />;
  const campoDoEsforco = (x: Serie, i: number, nome: string) => rpe
    ? <CampoDaSerie rotulo={`${nome} · RPE`} unidade="RPE" valor={x.esforco?.rpe ?? null} erro={porSerie[i]?.erros['esforco.rpe']} aoMudar={(v) => mudarRpe(i, v)} />
    : <EscolhaDoRir rotulo="RIR" rotuloAcessivel={`${nome} · RIR`} valor={x.esforco?.rir ?? null} aoMudar={(rir) => mudarRir(i, rir)} style={largura(LARGURA_DO_RIR)} />;

  const textoDaCarga = (x: Serie): string => {
    if (modo === 'CARGA_FIXA') return x.carga?.valorKg != null ? `${kgParaTela(x.carga.valorKg, unidade)?.toLocaleString('pt-BR')} ${unidade}` : '—';
    return escolha.opcoes.find((o) => o.valor === modo)?.rotulo ?? '—';
  };

  // A dica única da linha: as frases dos campos (que só marcam a caixa) e, sem nenhuma, a estimativa sobre a WS.
  const erroDoModo = erros['carga.modo'] ?? erros.carga;
  const frases: ReactNode[] = [
    ...(umaLinha ? mensagensDaSerie(s, g.inicio) : []),
    fixa && kgPendente ? <AvisoDoCampo key="falta-kg" mensagem={`${FALTA_A_CARGA}.`} /> : null,
    // O campo curto só marca a caixa: a frase do kg (na unidade de quem lê) vem aqui.
    fixa && !kgPendente && erros['carga.valorKg'] ? <ErroDoCampo key="kg" mensagem={mensagemNaUnidade(erros['carga.valorKg'], unidade)} /> : null,
    erroDoModo ? <ErroDoCampo key="modo" mensagem={erroDoModo} /> : null,
    avisos['carga.modo'] ? <AvisoDoCampo key="aviso-modo" mensagem={avisos['carga.modo']} /> : null,
  ].filter(Boolean);
  const estimativa = umaLinha && !semCarga ? dicaDaCarga(s, { config, unidade, wsKg: wsDeReferenciaKg(series, config) }) : null;
  const dicas = [
    rpe ? 'RPE de 1 a 10, de meio em meio (ex.: 8 ou 8,5).' : null,
    estimativa,
    varias && !iguais ? 'Ligar "Mesmo valor para todas" copia a Série 1 para as outras.' : null,
  ].filter((d): d is string => !!d);
  const dica = frases.length || dicas.length
    ? <View style={estilos.frases}>{frases}{dicas.map((d) => <Texto key={d} variante="pequeno">{d}</Texto>)}</View>
    : undefined;

  const nome = semCarga ? (podeRpe ? 'Esforço' : 'RIR') : podeRpe ? 'Carga e esforço' : 'Carga e RIR';
  // No aquecimento em % da WS a dica já diz "em branco, o aluno não recebe sugestão": o ⓘ repetiria a mesma frase.
  const info = ajuda && !estimativa?.includes(AJUDA_SEM_CARGA) ? ajuda : null;
  const atual: Esforco = rpe ? 'RPE' : 'RIR';
  // Só há duas opções: o alvo da troca é sempre a outra (o texto não fica vazio enquanto o painel fecha).
  const outro: Esforco = rpe ? 'RIR' : 'RPE';
  return <><LinhaDoFormulario nome={nome} dica={dica}>
    {semCarga ? null : <Escolha<ModoDeCarga> descricao="Forma de carga" compacta opcoes={escolha.opcoes} valor={escolha.marcado}
      aoMudar={(m) => { if (m !== escolha.marcado) aoMudar(alterarGrupo(series, g, { modo: modoAoEscolher(papel, m) }, config)); }} />}
    {umaLinha && percentual ? camposDoPercentual(s, 0, varias ? 'Todas as séries' : 'Série 1') : null}
    {fixa ? campoDoKg : null}
    {podeRpe ? <Escolha<Esforco> descricao="Esforço por RIR ou RPE" compacta opcoes={OPCOES_DO_ESFORCO} valor={rpe ? 'RPE' : 'RIR'} aoMudar={trocarEsforco} /> : null}
    {umaLinha ? campoDoEsforco(s, g.inicio, varias ? 'Todas as séries' : 'Série 1') : null}
    {varias ? <View><Interruptor rotulo="Mesmo valor para todas" valor={mesmoVale} aoMudar={ligarMesmo} /></View> : null}
    {info ? <BotaoDeInfo rotulo={`Sobre ${nome.toLowerCase()}`} aberto={infoAberta} aoAlternar={() => setInfoAberta(!infoAberta)} /> : null}
    {info && infoAberta ? <View style={estilos.inteira}><Explicacao texto={info} /></View> : null}
    {umaLinha ? null : g.series.map((x, j) => {
      const i = g.inicio + j;
      const nomeDaSerie = `Série ${j + 1}`;
      const mensagens = mensagensDaSerie(x, i);
      return <View key={x.uid} style={[estilos.inteira, estilos.serie]} role="group" aria-label={nomeDaSerie}>
        <View style={estilos.linhaDaSerie}>
          <Texto variante="rotulo" cor={cores.texto} style={largura(LARGURA_DO_NOME_DA_SERIE)}>{nomeDaSerie}</Texto>
          {semCarga ? null : <View style={[estilos.linhaDaSerie, { minWidth: escalar(LARGURA_DA_CARGA, fatorTexto) }]}>
            {percentual ? camposDoPercentual(x, j, nomeDaSerie) : <Texto numerico cor={cores.texto}>{textoDaCarga(x)}</Texto>}
          </View>}
          {campoDoEsforco(x, i, nomeDaSerie)}
        </View>
        {mensagens}
      </View>;
    })}
    {cluster && !semCarga && s.tecnica ? <View style={estilos.inteira}>
      <CamposDasCargasDosBlocos t={s.tecnica} mudar={mudarTecnica} e={subProblemas(erros, 'tecnica')} ws={ws} />
    </View> : null}
  </LinhaDoFormulario>
  <PainelConfirmacao visivel={confirmarTroca} titulo={`Trocar o esforço para ${outro}?`} perigo
    mensagem={`Trocar para ${outro} apaga o ${atual} de ${comEsforco === 1 ? '1 série' : `${comEsforco} séries`}.`}
    rotuloConfirmar={`Trocar para ${outro}`} rotuloCancelar={`Manter ${atual}`}
    aoConfirmar={() => { setConfirmarTroca(false); aplicarTroca(outro); }} aoCancelar={() => setConfirmarTroca(false)} />
  </>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  faixa: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campoDaFaixa: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  frases: { gap: 2 },
  // Ocupa a fileira inteira dos controles da linha (as linhas por série, a explicação, a carga por bloco).
  inteira: { flexBasis: '100%' },
  serie: { gap: espaco(0.5) },
  linhaDaSerie: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  // A lista do RIR tem a altura das caixas de número.
  rir: { minHeight: ALTURA_DO_CONTROLE },
});
