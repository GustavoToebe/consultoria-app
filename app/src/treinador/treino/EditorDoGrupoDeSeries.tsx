import { Check, CircleAlert, Trash2, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Serie } from '../../api/tipos';
import { type GrupoDeSeries } from '../../dominio/agrupamento';
import { blocosIguais, blocosValidos, resumoDosBlocos, textoDeBlocos } from '../../dominio/blocos';
import { lerDescanso, lerQuantidade, maximoDeSeriesNoGrupo, opcoesDeQuantidade, opcoesDoDescanso, textoCurtoDoDescanso } from '../../dominio/camposDaSerie';
import { corDoTipoDeSerie } from '../../dominio/corDaSerie';
import { DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { podeRestPauseNaUltima } from '../../dominio/exemplosDePrescricao';
import { explicacaoDaTecnica, explicacaoDoTipo, nomeDaSerieDeTrabalho, nomeDoTipo, padraoDaTecnica, papelDe, tecnicaDescritiva } from '../../dominio/metodologia';
import { escalar } from '../../dominio/preferencias';
import { ROTULO_DA_OBSERVACAO_DA_SERIE } from '../../dominio/resumoDaSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CamadaDaSerie, fundoDaSerie, useCorDaSerie, usePinturaDaSerie } from '../../ui/CamadaDaSerie';
import { Campo } from '../../ui/Campo';
import { Divisor } from '../../ui/Divisor';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeInfo, Explicacao } from './BotaoDeAbrir';
import { LARGURA_DAS_REPETICOES, RodapeDasRepeticoes, rodapeDasRepeticoes } from './CamposBasicos';
import { AvisoDoCampo, CamposDaTecnica, CamposDasRepeticoes, CamposDoCardio, CargaERirDaSerie, ErroDoCampo } from './CamposDaPrescricao';
import { ajudaDaCargaDoGrupo } from './CargaERirDaSerie';
import { cargaPendente, textoParaOAluno } from './cargaDaSerie';
import { type EscolhaDeTecnica, type FormaDasRepeticoes, formaVisivel, opcoesDeTecnica, problemasDoGrupoDeSeries, problemasPorSerie, secoesDaSerie, subProblemas } from './opcoesDoEditor';

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
const ICONE_DO_NIVEL: Record<Nivel, LucideIcon> = { sucesso: Check, atencao: TriangleAlert, perigo: CircleAlert };

/** Tipo e Técnica (27/11): o mesmo select, até 320 px cada, lado a lado; encolhem juntos até 200 antes de empilhar. */
const LARGURA_DO_SELECT = 320;
/** "Séries" e "Descanso" são selects curtos ("Digite ou escolha"). */
const LARGURA_DAS_SERIES = 96;
const LARGURA_DO_DESCANSO = 124;

/**
 * Uma seção da série aberta: o fio `divisor` em cima e o título (h3), com o ⓘ ao lado quando há explicação. Sem caixa
 * (séries no padrão da dieta, 19/11): as seções só se separam por fios, sem cartão aninhado.
 */
function Faixa({ titulo, info, children }: { titulo?: string; info?: { rotulo: string; texto: string } | null; children: ReactNode }) {
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

/** Um select com o ⓘ ao lado e a explicação embaixo (Tipo e Técnica). */
function SelectComInfo({ select, info, depois }: { select: ReactNode; info?: { rotulo: string; texto: string } | null; depois?: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  return <View style={[estilos.juntos, estilos.coluna]}>
    <View style={estilos.selectEInfo}>
      <View style={estilos.select}>{select}</View>
      {info ? <BotaoDeInfo rotulo={info.rotulo} aberto={aberta} aoAlternar={() => setAberta(!aberta)} /> : <View style={estilos.semInfo} />}
    </View>
    {info && aberta ? <Explicacao texto={info.texto} /> : null}
    {depois}
  </View>;
}

interface PropsDoGrupo {
  /** Tipo e Técnica lado a lado, o recuo maior e as ações na linha do título: a coluna das séries é larga. */
  largo: boolean;
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean;
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; numero: number;
  porSerie: ReturnType<typeof problemasPorSerie>;
  aoAlterar: (m: AlteracaoDeGrupo) => void; aoMudarSeries: (novas: Serie[]) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoRemover: () => void;
  /** "Fechar edição": fecha o bloco e devolve o foco à linha da série (`TabelaDeBlocos`). */
  aoFechar: () => void;
}

/**
 * A série aberta (séries no padrão da dieta, 19/11; campos de 27/11): o corpo do bloco cuja linha já é o título. Seções
 * separadas por fios: tipo e técnica (dois selects iguais, com o ⓘ); estrutura (Séries e Descanso como "Digite ou
 * escolha", as repetições numa área de largura fixa, os campos da técnica embaixo); carga e RIR; observação. No rodapé,
 * a prévia "Para o aluno" (mini cartão na cor da série) à esquerda e "Excluir série" e "Fechar edição" à direita.
 */
export function EditorGrupo({ largo, grupo: g, series, config, cardio, semCarga, tipos, numero, porSerie, aoAlterar, aoMudarSeries, aoQuantidade, aoRestPauseNaUltima, aoRemover, aoFechar }: PropsDoGrupo) {
  const { cores, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  const s = g.series[0];
  const secoes = secoesDaSerie(cardio ? 'CARDIO' : null);
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const { erros, avisos } = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  const nivel = nivelDoGrupo(porSerie, g);
  const explicacao = explicacaoDoTipo(config, s.tipo);
  const tecnicaTexto = s.tecnica ? (explicacaoDaTecnica(config, s.tecnica.tipo) || (tecnicaDescritiva(s.tecnica.tipo) ? explicacaoDoCatalogo(s.tecnica.tipo) : null)) : null;
  const descritiva = tecnicaDescritiva(s.tecnica?.tipo);
  const aoTecnica = (v: EscolhaDeTecnica) => aoAlterar({ tecnica: v === 'NENHUMA' ? null : tecnicaVazia(v, padraoDaTecnica(config, v)) });
  const nomeTipo = tipos.find((t) => t.valor === s.tipo)?.rotulo ?? nomeDoTipo(config, s.tipo);
  const opcoesTecnica = opcoesDeTecnica(config, s.tecnica?.tipo);
  const nomeTecnica = s.tecnica ? opcoesTecnica.find((o) => o.valor === s.tecnica?.tipo)?.rotulo ?? null : null;
  const foraDaTecnica = opcoesTecnica.find((o) => o.valor === (s.tecnica?.tipo ?? 'NENHUMA'))?.detalhe;
  const erroDoDescanso = erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `Descanso: de 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null);
  const resumoDoCluster = cluster ? resumoDosBlocos(s.tecnica?.blocos) : null;
  const blocos = s.tecnica?.blocos ?? null;
  const textoDoCluster = resumoDoCluster
    ? `${blocosIguais(blocos) ? `${resumoDoCluster.blocos} blocos × ${blocos![0]} reps` : `Blocos ${textoDeBlocos(blocos)}`} = ${resumoDoCluster.repeticoes} reps`
    : 'Complete os blocos';
  // A leitura do aluno; nula no cluster sem blocos válidos (o "Para o aluno" pede para completar).
  const leitura = cardio || !(cluster && !blocosValidos(blocos)) ? textoParaOAluno(g, config, unidade) : null;
  const maximo = maximoDeSeriesNoGrupo(series.length, g.series.length, LIMITE_SERIES);
  const ajudaDaCarga = ajudaDaCargaDoGrupo(g, config, semCarga, unidade);
  const cor = useCorDaSerie(cardio ? null : corDoTipoDeSerie(s.tipo, papelDe(config, s.tipo))).cor;
  const largura = (px: number) => ({ width: escalar(px, fatorTexto) });
  // A forma das repetições fica aqui (27/11): a dica de uma linha vai embaixo da Estrutura inteira, na largura toda.
  const [formaEscolhida, setFormaEscolhida] = useState<FormaDasRepeticoes>(formaVisivel('FAIXA', s));
  const forma = formaVisivel(formaEscolhida, s);
  const rodapeDasReps = rodapeDasRepeticoes(forma, s, erros, true);
  const tipo = tipos.length > OPCOES_PARA_BUSCAR
    ? <EscolhaSuspensa<string> rotulo="Tipo da série" valor={s.tipo ?? ''} rotuloDaBusca="Buscar tipo" textoVazio="Nenhum tipo encontrado."
      opcoes={tipos.map((o) => ({ valor: o.valor, rotulo: o.rotulo, detalhe: o.foraDaMetodologia ? 'Fora da metodologia' : undefined }))} aoMudar={(t) => aoAlterar({ tipo: t })} />
    : <EscolhaSuspensa<string> rotulo="Tipo da série" valor={s.tipo ?? ''} semBusca
      opcoes={tipos.map((o) => ({ valor: o.valor, rotulo: o.rotulo, detalhe: o.foraDaMetodologia ? 'Fora da metodologia' : undefined }))} aoMudar={(t) => aoAlterar({ tipo: t })} />;
  return <View style={estilos.corpo}>
      {/* Faixa 1: para que a série serve (tipo) e como executar (técnica), no mesmo select, lado a lado. */}
      {secoes.tipo ? <Faixa titulo="Tipo e técnica">
        <View style={estilos.selects}>
          <SelectComInfo select={tipo} info={explicacao ? { rotulo: `O que é o tipo ${nomeTipo}?`, texto: explicacao } : null}
            depois={<><ErroDoCampo mensagem={erros.tipo} /><AvisoDoCampo mensagem={avisos.tipo} /></>} />
          {secoes.tecnica ? <SelectComInfo
            select={<EscolhaSuspensa<EscolhaDeTecnica> rotulo="Técnica da série" opcoes={opcoesTecnica} valor={s.tecnica?.tipo ?? 'NENHUMA'} aoMudar={aoTecnica}
              rotuloDaBusca="Buscar técnica" textoVazio="Nenhuma técnica encontrada." semBusca={opcoesTecnica.length <= OPCOES_PARA_BUSCAR} />}
            info={tecnicaTexto && nomeTecnica ? { rotulo: `O que é ${nomeTecnica}?`, texto: tecnicaTexto } : null}
            depois={foraDaTecnica ? <Texto variante="pequeno">{foraDaTecnica}</Texto> : null} /> : null}
        </View>
        {secoes.tecnica && podeRestPauseNaUltima(g, config) ? <LinhaDeAcoes>
          <Botao rotulo="Aplicar Rest-pause só na última série" tipo="secundario" aoTocar={aoRestPauseNaUltima} />
        </LinhaDeAcoes> : null}
      </Faixa> : null}

      {/* Faixa 2: séries × repetições × descanso numa linha que quebra; os campos da técnica embaixo, na largura toda. */}
      <Faixa titulo={cardio ? 'Quantidade' : 'Estrutura'}>
        <View style={estilos.estrutura}>
          <View style={largura(LARGURA_DAS_SERIES)}>
            <EscolhaSuspensa<number> rotulo="Séries" titulo="Quantas séries" valor={g.series.length} opcoes={opcoesDeQuantidade(g.series.length, maximo)}
              rotuloDaBusca="Digite ou escolha" textoVazio={`Digite um número de 1 a ${maximo}.`}
              digitado={{ maxLength: 3, opcao: (t) => { const n = lerQuantidade(t, maximo); return n ? { valor: n, rotulo: String(n) } : null; } }}
              aoMudar={(n) => { if (n !== g.series.length) aoQuantidade(n); }} />
          </View>
          {secoes.prescricao && !cluster ? <CamposDasRepeticoes compacta valor={s} erros={erros} semRepeticoes="Sem repetições: o aluno lê a série por tempo."
            forma={formaEscolhida} aoEscolherForma={setFormaEscolhida}
            aoMudar={(r) => aoAlterar({ repsMin: r.repsMin, repsMax: r.repsMax, amrap: r.amrap })} /> : null}
          {secoes.prescricao && cluster ? <View style={[estilos.juntos, largura(LARGURA_DAS_REPETICOES)]}>
            <Texto variante="rotulo">Repetições</Texto>
            <Texto numerico cor={cores.texto} style={estilos.resumoDoCluster} accessibilityLiveRegion="polite">{textoDoCluster}</Texto>
            <ErroDoCampo mensagem={erros.repsMin} />
          </View> : null}
          {secoes.prescricao ? <View style={largura(LARGURA_DO_DESCANSO)}>
            <EscolhaSuspensa<number | null> rotulo="Descanso" titulo="Descanso depois da série" valor={s.descansoSegundos ?? null} opcoes={opcoesDoDescanso(s.descansoSegundos)}
              rotuloDaBusca="Digite ou escolha" textoVazio="Use segundos (75), 1:30 ou 2 min, até 60 min."
              digitado={{ maxLength: 12, opcao: (t) => { const seg = lerDescanso(t); return seg != null ? { valor: seg, rotulo: textoCurtoDoDescanso(seg) } : null; } }}
              aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })} />
          </View> : null}
        </View>
        {secoes.prescricao && !cluster ? <RodapeDasRepeticoes {...rodapeDasReps} /> : null}
        <ErroDoCampo mensagem={erroDoDescanso} />
        {secoes.tecnica && s.tecnica && !descritiva
          ? <CamposDaTecnica tecnica={s.tecnica} erros={subProblemas(erros, 'tecnica')} semCarga={semCarga} ws={nomeDaSerieDeTrabalho(config)} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
          : null}
        {secoes.cardio ? <CamposDoCardio cardio={s.cardio} aoMudar={(c) => aoAlterar({ cardio: c })} erros={{ ...subProblemas(erros, 'cardio'), ...(erros.cardio ? { cardio: erros.cardio } : {}) }} /> : null}
      </Faixa>

      {/* Faixa 3: a carga pelo papel e o RIR, uma linha por série (ou uma só, com "Mesmo valor para todas"). */}
      {secoes.carga ? <Faixa titulo={semCarga ? 'RIR' : 'Carga e RIR'} info={ajudaDaCarga ? { rotulo: 'Sobre carga e RIR', texto: ajudaDaCarga } : null}>
        <CargaERirDaSerie grupo={g} series={series} config={config} porSerie={porSerie} semCarga={semCarga} aoMudar={aoMudarSeries} />
      </Faixa> : null}

      {/* Faixa 4: a observação desta série, na largura de leitura, crescendo com o texto. */}
      {secoes.alvoExtra ? <Faixa titulo="Observação">
        <Observacao valor={s.alvoExtra ?? ''} erro={erros.alvoExtra} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })} />
      </Faixa> : null}

      {/* Rodapé: como o aluno vai ver, à esquerda; excluir e fechar, à direita (quebram para baixo no celular). */}
      <View style={estilos.faixa}>
        <Divisor style={estilos.fio} />
        <View style={estilos.rodape}>
          <ParaOAluno nivel={nivel} cor={cor} texto={leitura ?? 'Complete os blocos para visualizar a prescrição.'}
            descanso={!cardio && s.descansoSegundos != null ? textoCurtoDoDescanso(s.descansoSegundos) : null} />
          <LinhaDeAcoes alinhar="fim" style={estilos.acoesDoRodape}>
            <Botao tipo="perigoTexto" rotulo="Excluir série" rotuloAcessivel={`Remover série ${numero}`} Icone={Trash2} aoTocar={aoRemover} />
            <Botao tipo="secundario" rotulo="Fechar edição" rotuloAcessivel={`Fechar edição da série ${numero}`} Icone={X} aoTocar={aoFechar} />
          </LinhaDeAcoes>
        </View>
      </View>
  </View>;
}

const MAXIMO_DA_OBSERVACAO = 120;

/**
 * A observação da série (`alvoExtra`, até 120): na largura de leitura (~72ch), crescendo de uma para duas linhas com o
 * texto, e o contador no canto. É uma frase só: a quebra de linha digitada vira espaço.
 */
function Observacao({ valor, erro, aoMudar }: { valor: string; erro?: string | null; aoMudar: (t: string) => void }) {
  // shortcut: a altura sai do número de letras (~70 por linha em 72ch), não da medida do texto; se cortar, medir como o `CampoQueCresce` da mobilidade.
  const linhas = valor.length > 68 ? 2 : 1;
  return <View style={estilos.observacao}>
    <Campo rotulo={`${ROTULO_DA_OBSERVACAO_DA_SERIE} (opcional)`} valor={valor} maxLength={MAXIMO_DA_OBSERVACAO} linhas={linhas}
      aoMudar={(t) => aoMudar(t.replace(/\s*\n\s*/g, ' '))} erro={erro} />
    <Texto variante="pequeno" numerico style={estilos.contador} accessibilityLabel={`${valor.length} de ${MAXIMO_DA_OBSERVACAO} caracteres`}>{`${valor.length}/${MAXIMO_DA_OBSERVACAO}`}</Texto>
  </View>;
}

/**
 * "Para o aluno" no rodapé (27/11): um mini cartão da série como o aluno vê, pintado na cor do tipo pela preferência
 * "Cor das séries" (`ui/CamadaDaSerie`, a peça das linhas das séries: faixa reta e fundo), com a leitura numa linha
 * ("1×AMRAP · Aquecimento · RIR 2") e o descanso embaixo. O estado fica no ícone da cor dele (✓ pronta, ⚠ aviso, ⊗ erro).
 */
function ParaOAluno({ nivel, cor, texto, descanso }: { nivel: Nivel; cor: string | null; texto: string; descanso: string | null }) {
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
      </View>
      <CamadaDaSerie pintura={pintura} ativa={false} raio={RAIO_DA_PREVIA} />
    </View>
  );
}

const RAIO_DA_PREVIA = 12;

const estilos = StyleSheet.create({
  // O mesmo recuo lateral da linha da série (`TabelaDeBlocos`), para os campos começarem embaixo do "Série N".
  corpo: { gap: espaco(2.5), paddingHorizontal: espaco(1.5), paddingTop: espaco(0.25), paddingBottom: espaco(2) },
  faixa: { gap: espaco(1.5) },
  // O fio da faixa fica a meio caminho da anterior: o vão do corpo (20) em cima e mais 8 até o título.
  fio: { marginBottom: espaco(1) },
  tituloDaFaixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.25), minHeight: 24, marginVertical: -espaco(1.25) },
  // Tipo e Técnica: os dois selects encolhem juntos (de 320 a 200) antes de um descer para baixo do outro.
  selects: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(2), rowGap: espaco(1.5) },
  coluna: { flexGrow: 1, flexShrink: 1, flexBasis: 200, maxWidth: LARGURA_DO_SELECT + 44 + espaco(0.5) },
  selectEInfo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  select: { flex: 1, minWidth: 0 },
  // Sem ⓘ, a mesma largura: os dois selects continuam do mesmo tamanho.
  semInfo: { width: 44 },
  // Séries, repetições e descanso: lado a lado enquanto couberem; no celular a linha quebra.
  estrutura: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(3), rowGap: espaco(1.5) },
  juntos: { gap: espaco(0.5) },
  acoesDoRodape: { marginLeft: 'auto' },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  previa: { flexGrow: 1, flexShrink: 1, flexBasis: 260, maxWidth: 560, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75),
    paddingVertical: espaco(1), paddingHorizontal: espaco(1.5), borderRadius: RAIO_DA_PREVIA },
  // A faixa reta da cor (4 px) fica à esquerda: o conteúdo começa depois dela.
  previaPintada: { paddingLeft: espaco(1.5) + 4 },
  iconeDaPrevia: { marginTop: 2 },
  flexivel: { flex: 1, minWidth: 0, gap: 2 },
  resumoDoCluster: { minHeight: 44, textAlignVertical: 'center', paddingTop: espaco(1.25) },
  observacao: { width: '100%', maxWidth: LARGURA_TEXTO_CORRIDO, gap: 2 },
  contador: { alignSelf: 'flex-end' },
});
