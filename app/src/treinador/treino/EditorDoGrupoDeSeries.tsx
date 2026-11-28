import { Check, CircleAlert, Trash2, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Serie } from '../../api/tipos';
import { type GrupoDeSeries } from '../../dominio/agrupamento';
import { maximoDeSeriesNoGrupo, opcoesDeQuantidade } from '../../dominio/camposDaSerie';
import { LIMITE_SERIES, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { nomeDaSerieDeTrabalho, tecnicaDescritiva } from '../../dominio/metodologia';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CamadaDaSerie, fundoDaSerie, usePinturaDaSerie } from '../../ui/CamadaDaSerie';
import { Divisor } from '../../ui/Divisor';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeInfo, Explicacao } from './BotaoDeAbrir';
// A prévia sai pelo índice: os testes das abas o trocam por peças vazias (os cartões do aluno não entram neles).
import { CamposDaTecnica, CamposDoCardio } from './CamposDaPrescricao';
import { cargaPendente, textoParaOAluno } from './cargaDaSerie';
import { LinhasDaSerie, type OpcaoDoTipo } from './LinhasDaSerie';
import { problemasDoGrupoDeSeries, problemasPorSerie, subProblemas } from './opcoesDoEditor';
import { PreviaDaSerie } from './PreviaDaSerie';

export type Nivel = 'sucesso' | 'atencao' | 'perigo';

/**
 * Nível do grupo pela validação (a mesma da publicação): erro em qualquer série do grupo, aviso ou só a carga por
 * preencher (âmbar, `cargaPendente`), ou pronta.
 */
export function nivelDoGrupo(porSerie: ReturnType<typeof problemasPorSerie>, g: GrupoDeSeries): Nivel {
  let pendente = false;
  for (let j = 0; j < g.series.length; j++) {
    for (const campo of Object.keys(porSerie[g.inicio + j]?.erros ?? {})) {
      if (!cargaPendente(g.series[j], campo)) return 'perigo';
      pendente = true;
    }
  }
  return pendente || Object.keys(problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length).avisos).length > 0 ? 'atencao' : 'sucesso';
}

/** O grupo tem carga obrigatória ainda vazia: a coluna Carga diz "Falta a carga" (âmbar). */
export function faltaCargaNoGrupo(porSerie: ReturnType<typeof problemasPorSerie>, g: GrupoDeSeries): boolean {
  return g.series.some((s, j) => Object.keys(porSerie[g.inicio + j]?.erros ?? {}).some((campo) => cargaPendente(s, campo)));
}

/** O ícone da prévia "Para o aluno" pela validação (a mesma da publicação): a forma diz o estado, não só a cor. */
export const ICONE_DO_NIVEL: Record<Nivel, LucideIcon> = { sucesso: Check, atencao: TriangleAlert, perigo: CircleAlert };

/**
 * Uma seção com o fio `divisor` em cima e o título (h3), com o ⓘ ao lado quando há explicação (o cardio; a série de força
 * usa as linhas do formulário).
 */
export function Faixa({ titulo, info, children }: { titulo?: string; info?: { rotulo: string; texto: string } | null; children: ReactNode }) {
  const { cores } = useTema();
  const [aberta, setAberta] = useState(false);
  return <View style={estilos.faixa}>
    <Divisor style={estilos.fio} />
    {titulo ? <View style={estilos.tituloDaFaixa}>
      <Texto variante="secao" nivel={3} cor={cores.texto}>{titulo}</Texto>
      {info ? <BotaoDeInfo rotulo={info.rotulo} aberto={aberta} aoAlternar={() => setAberta(!aberta)} /> : null}
    </View> : null}
    {info && aberta ? <Explicacao texto={info.texto} /> : null}
    {children}
  </View>;
}

interface PropsDoGrupo {
  /** A prévia do aluno ao lado do formulário (a coluna das séries tem ~900 px ou mais); senão, embaixo dele. */
  previaAoLado: boolean;
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean;
  /** Membro de superset/circuito com o descanso depois da volta: a série não acusa "Falta o descanso". */
  descansoSoDoGrupo: boolean;
  tipos: OpcaoDoTipo[]; podeMais: boolean; numero: number;
  porSerie: ReturnType<typeof problemasPorSerie>;
  aoAlterar: (m: AlteracaoDeGrupo) => void; aoMudarSeries: (novas: Serie[]) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoRemover: () => void;
  /** "Fechar edição": fecha o bloco e devolve o foco à linha da série (`TabelaDeBlocos`). */
  aoFechar: () => void;
}

/**
 * A série aberta (SERIE-ABERTA, seções 1 a 4): o corpo do bloco cuja linha já é o título. À esquerda o formulário em
 * linhas (`LinhasDaSerie`: Tipo e técnica, Volume, Repetições ou as linhas do Cluster, Carga e RIR, Observação); à direita
 * (embaixo, na coluna estreita) a prévia com os cartões do app do aluno (`PreviaDaSerie`). No rodapé, "Excluir série" e
 * "Fechar edição". O cardio fica no desenho anterior (Quantidade e a leitura "Para o aluno").
 */
export function EditorGrupo({ previaAoLado, grupo: g, series, config, cardio, semCarga, descansoSoDoGrupo, tipos, numero, porSerie, aoAlterar, aoMudarSeries, aoQuantidade, aoRestPauseNaUltima, aoRemover, aoFechar }: PropsDoGrupo) {
  const s = g.series[0];
  const { erros } = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  const rodape = <View style={estilos.faixa}>
    <Divisor style={estilos.fio} />
    <LinhaDeAcoes alinhar="fim">
      <Botao tipo="perigoTexto" rotulo="Excluir série" rotuloAcessivel={`Remover série ${numero}`} Icone={Trash2} aoTocar={aoRemover} />
      <Botao tipo="secundario" rotulo="Fechar edição" rotuloAcessivel={`Fechar edição da série ${numero}`} Icone={X} aoTocar={aoFechar} />
    </LinhaDeAcoes>
  </View>;
  if (cardio) return <View style={estilos.corpo}>
    <Faixa titulo="Quantidade">
      <View style={estilos.series}>
        <EscolhaSuspensa<number> rotulo="Séries" titulo="Quantas séries" valor={g.series.length}
          opcoes={opcoesDeQuantidade(g.series.length, maximoDeSeriesNoGrupo(series.length, g.series.length, LIMITE_SERIES))}
          aoMudar={(n) => { if (n !== g.series.length) aoQuantidade(n); }} />
      </View>
      <CamposDoCardio cardio={s.cardio} aoMudar={(c) => aoAlterar({ cardio: c })} erros={{ ...subProblemas(erros, 'cardio'), ...(erros.cardio ? { cardio: erros.cardio } : {}) }} />
    </Faixa>
    <ParaOAlunoDoCardio grupo={g} config={config} nivel={nivelDoGrupo(porSerie, g)} />
    {rodape}
  </View>;
  const linhasDaTecnica = s.tecnica && !tecnicaDescritiva(s.tecnica.tipo)
    ? <CamposDaTecnica tecnica={s.tecnica} erros={subProblemas(erros, 'tecnica')} semCarga={semCarga} ws={nomeDaSerieDeTrabalho(config)} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
    : null;
  return <View style={estilos.corpo}>
    <View style={previaAoLado ? estilos.lado : estilos.empilhado}>
      <View style={previaAoLado ? estilos.formulario : null}>
        <LinhasDaSerie grupo={g} series={series} config={config} semCarga={semCarga} tipos={tipos} porSerie={porSerie}
          aoAlterar={aoAlterar} aoMudarSeries={aoMudarSeries} aoQuantidade={aoQuantidade} aoRestPauseNaUltima={aoRestPauseNaUltima}
          linhasDaTecnica={linhasDaTecnica} descansoSoDoGrupo={descansoSoDoGrupo} />
      </View>
      <View style={previaAoLado ? estilos.previaAoLado : estilos.previaEmbaixo}>
        <PreviaDaSerie grupo={g} series={series} config={config} semCarga={semCarga} />
      </View>
    </View>
    {rodape}
  </View>;
}

/** A leitura "Para o aluno" do cardio (o cardio não tem a prévia com os cartões do aluno). */
function ParaOAlunoDoCardio({ grupo: g, config, nivel }: { grupo: GrupoDeSeries; config: Configuracao; nivel: Nivel }) {
  const unidade = useUnidadeDeCarga();
  return <ParaOAluno nivel={nivel} cor={null} texto={textoParaOAluno(g, config, unidade)} descanso={null} />;
}

/**
 * "Para o aluno" no rodapé (27/11): um mini cartão da série como o aluno vê, pintado na cor do tipo pela preferência
 * "Cor das séries" (`ui/CamadaDaSerie`, a peça das linhas das séries: faixa reta e fundo), com a leitura numa linha
 * ("1×AMRAP · Aquecimento · RIR 2") e o descanso embaixo. O estado fica no ícone da cor dele (✓ pronta, ⚠ aviso, ⊗ erro).
 */
export function ParaOAluno({ nivel, cor, texto, descanso, extra }: { nivel: Nivel; cor: string | null; texto: string; descanso: string | null;
  /** Uma linha a mais, já pronta (o aquecimento e o desaquecimento do bloco de cardio). */
  extra?: string | null }) {
  const { cores } = useTema();
  const pintura = usePinturaDaSerie(cor, 'CHEIA');
  const Icone = ICONE_DO_NIVEL[nivel];
  return (
    <View style={[estilos.previa, fundoDaSerie(pintura, cores.superficie2), cor ? estilos.previaPintada : null]} role="group" aria-label="Prévia para o aluno">
      <View style={estilos.iconeDaPrevia} aria-hidden><Icone size={16} color={cores[nivel]} strokeWidth={2.25} /></View>
      <View style={estilos.flexivel}>
        <Texto numerico cor={cores.texto}>
          <Texto variante="rotulo" cor={cores.texto}>Para o aluno: </Texto>{texto}
        </Texto>
        {descanso ? <Texto variante="pequeno" numerico>{`Descanso ${descanso}`}</Texto> : null}
        {extra ? <Texto variante="pequeno" numerico>{extra}</Texto> : null}
      </View>
      <CamadaDaSerie pintura={pintura} ativa={false} raio={RAIO_DA_PREVIA} />
    </View>
  );
}

const RAIO_DA_PREVIA = 12;

/** Prévia ao lado: base de 340 px, até 420 (SERIE-ABERTA, seção 1); com 340 ela cabe ao lado já em 920 (`EditorSeries`). */
const LARGURA_DA_PREVIA = 340;

const estilos = StyleSheet.create({
  // O mesmo recuo lateral da linha da série (`TabelaDeBlocos`), para os campos começarem embaixo do "Série N".
  corpo: { gap: espaco(2.5), paddingHorizontal: espaco(1.5), paddingTop: espaco(0.25), paddingBottom: espaco(2) },
  // Formulário (flexível) e prévia lado a lado, com o vão de um grupo para o outro; embaixo, a prévia desce.
  lado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  empilhado: { gap: espaco(2) },
  formulario: { flex: 1, minWidth: 0 },
  previaAoLado: { flexBasis: LARGURA_DA_PREVIA, flexShrink: 0, minWidth: 340, maxWidth: 420, paddingTop: espaco(1.5) },
  // Embaixo, o cartão do aluno fica na largura de um celular, não esticado na coluna toda.
  previaEmbaixo: { width: '100%', maxWidth: 420 },
  faixa: { gap: espaco(1.5) },
  // O fio da faixa fica a meio caminho da anterior: o vão do corpo (20) em cima e mais 8 até o título.
  fio: { marginBottom: espaco(1) },
  tituloDaFaixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.25), minHeight: 24, marginVertical: -espaco(1.25) },
  series: { width: 96 },
  previa: { flexGrow: 1, flexShrink: 1, flexBasis: 260, maxWidth: 560, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75),
    paddingVertical: espaco(1), paddingHorizontal: espaco(1.5), borderRadius: RAIO_DA_PREVIA },
  // A faixa reta da cor (4 px) fica à esquerda: o conteúdo começa depois dela.
  previaPintada: { paddingLeft: espaco(1.5) + 4 },
  iconeDaPrevia: { marginTop: 2 },
  flexivel: { flex: 1, minWidth: 0, gap: 2 },
});
