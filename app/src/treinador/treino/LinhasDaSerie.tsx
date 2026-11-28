import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Serie } from '../../api/tipos';
import { type GrupoDeSeries } from '../../dominio/agrupamento';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { descansoDoClusterPendente, lerDescanso, lerQuantidade, maximoDeSeriesNoGrupo, MENSAGEM_DESCANSO_DO_CLUSTER, opcoesDeQuantidade, opcoesDoDescanso, textoCurtoDoDescanso } from '../../dominio/camposDaSerie';
import { corDoTipoDeSerie } from '../../dominio/corDaSerie';
import { DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { podeRestPauseNaUltima } from '../../dominio/exemplosDePrescricao';
import { explicacaoDaTecnica, explicacaoDoTipo, nomeDoTipo, padraoDaTecnica, papelDe, tecnicaDescritiva } from '../../dominio/metodologia';
import { TEXTO_FALTA_DESCANSO, blocoSemDescanso } from '../../dominio/pontosParaRevisar';
import { escalar } from '../../dominio/preferencias';
import { ROTULO_DA_OBSERVACAO_DA_SERIE } from '../../dominio/resumoDaSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { corDaSerie } from '../../ui/pinturaDaSerie';
import { Texto } from '../../ui/Texto';
import { BotaoDeInfo, Explicacao } from './BotaoDeAbrir';
import { AvisoDoCampo, CamposDasRepeticoes, ErroDoCampo, rodapeDasRepeticoes, RodapeDasRepeticoes } from './CamposBasicos';
import { CargaERirDaSerie } from './CargaERirDaSerie';
import { ALTURA_DO_CONTROLE, LinhaDoFormulario } from './LinhaDoFormulario';
import { formaVisivel, opcoesDeTecnica, problemasDoGrupoDeSeries, type EscolhaDeTecnica, type FormaDasRepeticoes, type ProblemasDaSerie } from './opcoesDoEditor';

/**
 * As linhas da série aberta (SERIE-ABERTA, seções 1 a 3): Tipo e técnica, Volume, Repetições, as da técnica, Carga e RIR
 * (`CargaERirDaSerie`) e Observação, cada uma uma `LinhaDoFormulario` (nome à esquerda, controles à direita, uma dica
 * embaixo). Sem regra nova: as listas, dicas e o "Mesmo valor para todas" vêm de `dominio/camposDaSerie`.
 */

/** Larguras do 27/11 (o Tipo e a Técnica no pedido de ~320, 28/11): até 320 cada, Séries ~96, Descanso ~128. */
const LARGURA_DO_SELECT = 320;
const MINIMO_DO_SELECT = 160;
const LARGURA_DAS_SERIES = 96;
const LARGURA_DO_DESCANSO = 128;
const MAXIMO_DA_OBSERVACAO = 120;
const LARGURA_DA_OBSERVACAO = 640;

/** O ⓘ de uma linha: o botão vai em `info`, a explicação (aberta) entra na dica. */
function useInfo(info: { rotulo: string; texto: string } | null) {
  const [aberta, setAberta] = useState(false);
  if (!info) return { botao: null, explicacao: null };
  return {
    botao: <BotaoDeInfo key={info.rotulo} rotulo={info.rotulo} aberto={aberta} aoAlternar={() => setAberta(!aberta)} />,
    explicacao: aberta ? <Explicacao key={`${info.rotulo}-texto`} texto={info.texto} /> : null,
  };
}

/** Junta as partes da dica de uma linha; nada = sem dica (a linha não reserva espaço). */
function dicaDe(...partes: ReactNode[]): ReactNode {
  const presentes = partes.filter((p) => p !== null && p !== undefined && p !== false && p !== '');
  return presentes.length ? <View style={estilos.dica}>{presentes}</View> : undefined;
}

const textoPequeno = (t: string | null | undefined) => (t ? <Texto key={t} variante="pequeno">{t}</Texto> : null);

// ---- Tipo e técnica ----

export interface OpcaoDoTipo { valor: string; rotulo: string; foraDaMetodologia: boolean }

/** "Tipo e técnica": os dois selects iguais (o tipo com a bolinha da cor dele) e o ⓘ "O que é o tipo X?". */
export function LinhaDoTipoETecnica({ grupo: g, config, tipos, problemas, aoAlterar, aoRestPauseNaUltima }: {
  grupo: GrupoDeSeries; config: Configuracao; tipos: readonly OpcaoDoTipo[];
  /** Os problemas do grupo (`problemasDoGrupoDeSeries`): o erro e o aviso do tipo vão para a dica. */
  problemas?: ProblemasDaSerie;
  aoAlterar: (m: AlteracaoDeGrupo) => void;
  /** "Aplicar Rest-pause só na última série", quando a metodologia oferece. */
  aoRestPauseNaUltima?: () => void;
}) {
  const { cores, fatorTexto, identificacao, preferencias } = useTema();
  const s = g.series[0];
  const nomeTipo = tipos.find((t) => t.valor === s.tipo)?.rotulo ?? nomeDoTipo(config, s.tipo);
  const explicacao = explicacaoDoTipo(config, s.tipo);
  const opcoesTecnica = opcoesDeTecnica(config, s.tecnica?.tipo);
  const nomeTecnica = s.tecnica ? opcoesTecnica.find((o) => o.valor === s.tecnica?.tipo)?.rotulo ?? null : null;
  const textoTecnica = s.tecnica ? (explicacaoDaTecnica(config, s.tecnica.tipo) || (tecnicaDescritiva(s.tecnica.tipo) ? explicacaoDoCatalogo(s.tecnica.tipo) : null)) : null;
  const foraDaTecnica = opcoesTecnica.find((o) => o.valor === (s.tecnica?.tipo ?? 'NENHUMA'))?.detalhe;
  const infoTipo = useInfo(explicacao ? { rotulo: `O que é o tipo ${nomeTipo}?`, texto: explicacao } : null);
  const infoTecnica = useInfo(textoTecnica && nomeTecnica ? { rotulo: `O que é ${nomeTecnica}?`, texto: textoTecnica } : null);
  // A bolinha segue a preferência "Cor das séries": no modo de ação o tipo vai só pelo nome (sem bolinha).
  const corDoTipo = (codigo: string) => corDaSerie(preferencias?.corDasSeries ?? 'TIPO', corDoTipoDeSerie(codigo, papelDe(config, codigo)), identificacao, cores).categoria?.cor;
  const opcoesTipo = tipos.map((o) => ({ valor: o.valor, rotulo: o.rotulo, cor: corDoTipo(o.valor), detalhe: o.foraDaMetodologia ? 'Fora da metodologia' : undefined }));
  // Até 320 cada; numa coluna estreita (o inspetor de 1280) os dois encolhem juntos até 160 antes de um descer.
  const largura = { flexGrow: 1, flexBasis: escalar(MINIMO_DO_SELECT, fatorTexto), maxWidth: escalar(LARGURA_DO_SELECT, fatorTexto) };
  const aoTecnica = (v: EscolhaDeTecnica) => aoAlterar({ tecnica: v === 'NENHUMA' ? null : tecnicaVazia(v, padraoDaTecnica(config, v)) });
  return <LinhaDoFormulario nome="Tipo e técnica" info={[infoTipo.botao, infoTecnica.botao]}
    dica={dicaDe(<ErroDoCampo key="erro" mensagem={problemas?.erros.tipo} />, <AvisoDoCampo key="aviso" mensagem={problemas?.avisos.tipo} />, infoTipo.explicacao, infoTecnica.explicacao,
      textoPequeno(foraDaTecnica),
      aoRestPauseNaUltima && podeRestPauseNaUltima(g, config)
        ? <View key="rp" style={estilos.acaoDaDica}><Botao rotulo="Aplicar Rest-pause só na última série" tipo="secundario" aoTocar={aoRestPauseNaUltima} /></View> : null)}>
    <View style={largura}>
      <EscolhaSuspensa<string> rotulo="Tipo da série" valor={s.tipo ?? ''} opcoes={opcoesTipo} aoMudar={(tipo) => aoAlterar({ tipo })}
        semBusca={tipos.length <= OPCOES_PARA_BUSCAR} rotuloDaBusca="Buscar tipo" textoVazio="Nenhum tipo encontrado." style={estilos.controle} />
    </View>
    <View style={largura}>
      <EscolhaSuspensa<EscolhaDeTecnica> rotulo="Técnica da série" opcoes={opcoesTecnica} valor={s.tecnica?.tipo ?? 'NENHUMA'} aoMudar={aoTecnica}
        semBusca={opcoesTecnica.length <= OPCOES_PARA_BUSCAR} rotuloDaBusca="Buscar técnica" textoVazio="Nenhuma técnica encontrada." style={estilos.controle} />
    </View>
  </LinhaDoFormulario>;
}

// ---- Volume ----

/**
 * "Volume": Séries e Descanso, os dois "digite ou escolha" (o descanso aceita "75", "1:30" e "2 min" e mostra "90 s" ou
 * "2 min"). `dica` é a frase de quem usa (o cluster explica o descanso); o erro do descanso vence, depois o aviso.
 */
export function LinhaDoVolume({ quantidade, maximo, aoQuantidade, descanso, aoDescanso, erroDoDescanso, avisoDoDescanso, dica }: {
  quantidade: number; maximo: number; aoQuantidade: (n: number) => void;
  descanso: number | null; aoDescanso: (segundos: number | null) => void;
  erroDoDescanso?: string | null; avisoDoDescanso?: string | null; dica?: string | null;
}) {
  const { fatorTexto } = useTema();
  return <LinhaDoFormulario nome="Volume"
    dica={dicaDe(<ErroDoCampo key="erro" mensagem={erroDoDescanso} />, erroDoDescanso ? null : <AvisoDoCampo key="aviso" mensagem={avisoDoDescanso} />, textoPequeno(dica))}>
    <View style={{ width: escalar(LARGURA_DAS_SERIES, fatorTexto) }}>
      <EscolhaSuspensa<number> rotulo="Séries" titulo="Quantas séries" valor={quantidade} opcoes={opcoesDeQuantidade(quantidade, maximo)}
        rotuloDaBusca="Digite ou escolha" textoVazio={`Digite um número de 1 a ${maximo}.`} style={estilos.controle}
        digitado={{ maxLength: 3, opcao: (t) => { const n = lerQuantidade(t, maximo); return n ? { valor: n, rotulo: String(n) } : null; } }}
        aoMudar={(n) => { if (n !== quantidade) aoQuantidade(n); }} />
    </View>
    <View style={{ width: escalar(LARGURA_DO_DESCANSO, fatorTexto) }}>
      <EscolhaSuspensa<number | null> rotulo="Descanso" titulo="Descanso depois da série" valor={descanso} opcoes={opcoesDoDescanso(descanso)}
        rotuloDaBusca="Digite ou escolha" textoVazio="Use segundos (75), 1:30 ou 2 min, até 60 min." style={estilos.controle}
        digitado={{ maxLength: 12, opcao: (t) => { const seg = lerDescanso(t); return seg != null ? { valor: seg, rotulo: textoCurtoDoDescanso(seg) } : null; } }}
        aoMudar={aoDescanso} />
    </View>
  </LinhaDoFormulario>;
}

/** O erro do descanso do grupo: o da validação ou o teto do contrato. */
export function erroDoDescansoDoGrupo(erros: Record<string, string>, descanso: number | null | undefined): string | null {
  return erros.descansoSegundos ?? (descanso != null && descanso > DESCANSO_MAXIMO_SEGUNDOS ? `Descanso: de 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null);
}

// ---- Repetições ----

/** "Repetições": Faixa · Exata · AMRAP e os números do modo, numa área de largura fixa; a dica (ou o erro) embaixo. */
export function LinhaDasRepeticoes({ serie: s, erros, aoMudar }: {
  serie: Serie; erros: Record<string, string>; aoMudar: (m: Pick<AlteracaoDeGrupo, 'repsMin' | 'repsMax' | 'amrap'>) => void;
}) {
  const [forma, setForma] = useState<FormaDasRepeticoes>(formaVisivel('FAIXA', s));
  const rodape = rodapeDasRepeticoes(formaVisivel(forma, s), s, erros, true);
  return <LinhaDoFormulario nome="Repetições" dica={rodape.erro || rodape.dica ? <RodapeDasRepeticoes {...rodape} /> : undefined}>
    <CamposDasRepeticoes compacta rotuloVisivel={false} valor={s} erros={erros} semRepeticoes="Sem repetições: o aluno lê a série por tempo."
      forma={forma} aoEscolherForma={setForma} aoMudar={(r) => aoMudar({ repsMin: r.repsMin, repsMax: r.repsMax, amrap: r.amrap })} />
  </LinhaDoFormulario>;
}

// ---- Observação ----

/** "Observação": uma linha que cresce até 3, até ~640 px, com o contador "0/120" dentro do campo. Quebra de linha vira espaço. */
export function LinhaDaObservacao({ valor, erro, aoMudar, ultima = true }: { valor: string; erro?: string | null; aoMudar: (t: string) => void; ultima?: boolean }) {
  // Sempre `linhas` (também 1): trocar `multiline` remonta o campo na web (input → textarea) e ele perde o foco.
  // shortcut: a altura sai do número de letras (~70 por linha em 640 px), não da medida do texto; se cortar, medir como o `CampoQueCresce` da mobilidade.
  const linhas = Math.min(3, Math.max(1, Math.ceil(valor.length / 68)));
  return <LinhaDoFormulario nome="Observação" ultima={ultima}>
    <View style={estilos.observacao}>
      <Campo rotulo={`${ROTULO_DA_OBSERVACAO_DA_SERIE} (opcional)`} rotuloOculto rotuloAcessivel={`${ROTULO_DA_OBSERVACAO_DA_SERIE} (opcional), ${valor.length} de ${MAXIMO_DA_OBSERVACAO} caracteres`}
        valor={valor} maxLength={MAXIMO_DA_OBSERVACAO} linhas={linhas} placeholder="Ex.: desça devagar, sem quicar"
        sufixo={`${valor.length}/${MAXIMO_DA_OBSERVACAO}`} aoMudar={(t) => aoMudar(t.replace(/\s*\n\s*/g, ' '))} erro={erro} />
    </View>
  </LinhaDoFormulario>;
}

// ---- A série simples inteira ----

export interface PropsDasLinhas {
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; semCarga: boolean;
  tipos: readonly OpcaoDoTipo[];
  porSerie: readonly ProblemasDaSerie[];
  aoAlterar: (m: AlteracaoDeGrupo) => void; aoMudarSeries: (novas: Serie[]) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima?: () => void;
  /**
   * As linhas da técnica (`CamposDaTecnica`/cluster), logo depois do Volume. No cluster elas tomam o lugar da linha
   * Repetições (seção 3).
   */
  linhasDaTecnica?: ReactNode;
  /** Membro de grupo com o descanso só no fim do grupo: sem o aviso "Falta o descanso." (como o `ignorarDescanso` do resumo). */
  descansoSoDoGrupo?: boolean;
}

/**
 * No cluster o descanso é o da série inteira, depois de todos os blocos (seção 3). Sem ele, a pendência âmbar própria
 * (`MENSAGEM_DESCANSO_DO_CLUSTER`) no lugar do "Falta o descanso.", sem travar o salvar nem marcar erro no campo.
 */
export const DICA_DO_DESCANSO_DO_CLUSTER = 'É o tempo depois de cada série (os blocos têm a pausa própria).';

/**
 * A série aberta, em linhas: Tipo e técnica, Volume, Repetições (fora do cluster), as da técnica, Carga e RIR (com a carga
 * de cada bloco no cluster) e Observação. A prévia e o rodapé ("Excluir série", "Fechar edição") ficam com quem usa.
 * Cardio não passa por aqui.
 */
export function LinhasDaSerie({ grupo: g, series, config, semCarga, tipos, porSerie, aoAlterar, aoMudarSeries, aoQuantidade, aoRestPauseNaUltima, linhasDaTecnica, descansoSoDoGrupo = false }: PropsDasLinhas) {
  const s = g.series[0];
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const problemas = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  const { erros } = problemas;
  const erroDoDescanso = erroDoDescansoDoGrupo(erros, s.descansoSegundos);
  return <View>
    <LinhaDoTipoETecnica grupo={g} config={config} tipos={tipos} problemas={problemas} aoAlterar={aoAlterar} aoRestPauseNaUltima={aoRestPauseNaUltima} />
    <LinhaDoVolume quantidade={g.series.length} maximo={maximoDeSeriesNoGrupo(series.length, g.series.length, LIMITE_SERIES)} aoQuantidade={aoQuantidade}
      descanso={s.descansoSegundos ?? null} aoDescanso={(descansoSegundos) => aoAlterar({ descansoSegundos })}
      erroDoDescanso={erroDoDescanso} avisoDoDescanso={!descansoSoDoGrupo && blocoSemDescanso(g) ? (descansoDoClusterPendente(s) ? MENSAGEM_DESCANSO_DO_CLUSTER : `${TEXTO_FALTA_DESCANSO}.`) : null}
      dica={cluster ? DICA_DO_DESCANSO_DO_CLUSTER : null} />
    {cluster ? null : <LinhaDasRepeticoes serie={s} erros={erros} aoMudar={aoAlterar} />}
    {linhasDaTecnica}
    <CargaERirDaSerie grupo={g} series={series} config={config} porSerie={porSerie} semCarga={semCarga} aoMudar={aoMudarSeries} />
    <LinhaDaObservacao valor={s.alvoExtra ?? ''} erro={erros.alvoExtra} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })} />
  </View>;
}

const estilos = StyleSheet.create({
  // Seletores com a altura dos campos numéricos (46): o estilo vem depois do botão.
  controle: { minHeight: ALTURA_DO_CONTROLE },
  dica: { gap: espaco(0.5) },
  acaoDaDica: { alignItems: 'flex-start', paddingTop: espaco(0.5) },
  observacao: { width: '100%', maxWidth: LARGURA_DA_OBSERVACAO },
});
