import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Minus, Plus, Smartphone, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Serie } from '../../api/tipos';
import { tituloDoGrupoDeSeries, type GrupoDeSeries } from '../../dominio/agrupamento';
import { blocosIguais, blocosValidos, resumoDosBlocos, textoDeBlocos } from '../../dominio/blocos';
import { DESCANSO_MAXIMO_SEGUNDOS, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { podeRestPauseNaUltima } from '../../dominio/exemplosDePrescricao';
import { explicacaoDaTecnica, explicacaoDoTipo, nomeDaSerieDeTrabalho, nomeDoTipo, padraoDaTecnica, tecnicaDescritiva } from '../../dominio/metodologia';
import { escalar } from '../../dominio/preferencias';
import { ROTULO_DA_OBSERVACAO_DA_SERIE } from '../../dominio/resumoDaSerie';
import { useTema } from '../../tema/TemaProvider';
import { BORDA_ITEM, espaco, fontes, RAIO, tingido } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { NumeroInvertido } from '../../ui/NumeroInvertido';
import { type TipoSelo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { AvisoDoCampo, CamposDaTecnica, CamposDasRepeticoes, CamposDoCardio, CargaERirDaSerie, ErroDoCampo } from './CamposDaPrescricao';
import { textoParaOAluno } from './cargaDaSerie';
import { type EscolhaDeTecnica, opcoesDeTecnica, problemasDoGrupoDeSeries, problemasPorSerie, secoesDaSerie, subProblemas } from './opcoesDoEditor';

export type Nivel = 'sucesso' | 'atencao' | 'perigo';

/** Nível do grupo pela validação (a mesma da publicação): erro em qualquer série do grupo, aviso, ou pronta. */
export function nivelDoGrupo(porSerie: ReturnType<typeof problemasPorSerie>, g: GrupoDeSeries): Nivel {
  for (let i = g.inicio; i < g.inicio + g.series.length; i++) if (Object.keys(porSerie[i]?.erros ?? {}).length > 0) return 'perigo';
  return Object.keys(problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length).avisos).length > 0 ? 'atencao' : 'sucesso';
}

/** Selo do grupo de séries pela validação (a mesma da publicação): pronta, com aviso ou com erro. Só no "Editando". */
const SELO_DO_NIVEL: Record<Nivel, { texto: string; tipo: TipoSelo; Icone: LucideIcon }> = {
  sucesso: { texto: 'Pronta', tipo: 'sucesso', Icone: CircleCheck },
  atencao: { texto: 'Atenção', tipo: 'atencao', Icone: TriangleAlert },
  perigo: { texto: 'Corrigir', tipo: 'perigo', Icone: CircleAlert },
};

/** Os tipos como chips pelo NOME (código só quando o tipo não está na metodologia); muitos tipos viram busca em folha. */
function Tipos({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string; opcoes: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; valor: string | null; aoMudar: (codigo: string) => void;
}) {
  const aoEscolher = (codigo: string | null) => { if (codigo) aoMudar(codigo); };
  if (opcoes.length > OPCOES_PARA_BUSCAR) {
    return <EscolhaEmFolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor as string | null, rotulo: o.rotulo, detalhe: o.foraDaMetodologia ? 'Fora da metodologia' : undefined }))}
      valor={valor} aoMudar={aoEscolher} rotuloDoValor="Escolha o tipo" />;
  }
  return <Escolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor as string | null, rotulo: o.rotulo }))} valor={valor} aoMudar={aoEscolher} />;
}

/** "Nenhuma" e as técnicas da metodologia. Acima de oito, a mesma folha dos tipos; a de fora fica com o detalhe. */
function Tecnicas({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string; opcoes: ReturnType<typeof opcoesDeTecnica>; valor: EscolhaDeTecnica; aoMudar: (v: EscolhaDeTecnica) => void;
}) {
  const fora = opcoes.find((o) => o.valor === valor)?.detalhe;
  // Lista suspensa com busca (como o RIR): os chips das técnicas viravam duas ou três linhas no inspetor.
  return <>
    <EscolhaSuspensa<EscolhaDeTecnica> rotulo={rotulo} opcoes={opcoes} valor={valor} aoMudar={aoMudar} style={estilos.suspensa} />
    {fora ? <Texto variante="pequeno">{fora}</Texto> : null}
  </>;
}

/**
 * Largura da caixa do descanso: cabe "3600" e o "s" no tamanho de texto padrão; cresce com o texto da pessoa. Em 90 (não 112)
 * para Séries × Repetições × Descanso caberem numa linha a partir de 1440 e Repetições × Descanso juntos em 1280, com as
 * caixas mín/máx proporcionais ao sufixo (84 cortava o "3600"); no celular o descanso desce, sem cortar nada.
 */
const LARGURA_DO_DESCANSO = 90;

/**
 * Uma faixa da série aberta: título de seção (h3) e, da segunda em diante, o `Divisor` em cima. Sem caixa: a série aberta
 * já é a 2ª moldura (exercício › série) e a faixa é o 3º nível, em divisor (§5.1).
 */
function Faixa({ titulo, primeira = false, children }: { titulo?: string; primeira?: boolean; children: ReactNode }) {
  const { cores } = useTema();
  return <View style={estilos.faixa}>
    {primeira ? null : <Divisor style={estilos.fio} />}
    {titulo ? <Texto variante="secao" nivel={3} cor={cores.texto}>{titulo}</Texto> : null}
    {children}
  </View>;
}

/** Explicação recolhida (do tipo ou da técnica): o texto só aparece depois do "O que é?". */
function Explicacao({ texto }: { texto: string }) {
  const { cores } = useTema();
  return <View style={[estilos.explicacao, { borderLeftColor: cores.borda }]}>
    <Texto variante="suave">{texto}</Texto>
  </View>;
}

interface PropsDoGrupo {
  /** Tipo e Técnica lado a lado, o recuo maior e as ações na linha do título: a coluna das séries é larga. */
  largo: boolean;
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean;
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; primeiro: boolean; ultimo: boolean; numero: number;
  porSerie: ReturnType<typeof problemasPorSerie>;
  aoMover: (d: -1 | 1) => void; aoAlterar: (m: AlteracaoDeGrupo) => void; aoMudarSeries: (novas: Serie[]) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoRemover: () => void;
}

/**
 * A série aberta (o grupo da aba): "Editando: Série N · tipo" com os números embaixo, o único selo de situação, subir,
 * descer e remover; embaixo, três faixas (tipo e técnica; estrutura; carga e RIR, uma linha por série) e, no rodapé, a
 * observação desta série e "Para o aluno".
 */
export function EditorGrupo({ largo, grupo: g, series, config, cardio, semCarga, tipos, podeMais, primeiro, ultimo, numero, porSerie, aoMover, aoAlterar, aoMudarSeries, aoQuantidade, aoRestPauseNaUltima, aoRemover }: PropsDoGrupo) {
  const { cores, bordas, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  // Explicações do tipo e da técnica começam recolhidas; o "O que é?" abre.
  const [explicarTipo, setExplicarTipo] = useState(false);
  const [explicarTecnica, setExplicarTecnica] = useState(false);
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
  const recuo = espaco(largo ? 2.5 : 2);
  const borda = nivel === 'perigo' ? cores.perigo : cores.bordaCampo;
  const erroDoDescanso = erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `Descanso: de 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null);
  const resumoDoCluster = cluster ? resumoDosBlocos(s.tecnica?.blocos) : null;
  const blocos = s.tecnica?.blocos ?? null;
  const textoDoCluster = resumoDoCluster
    ? `${blocosIguais(blocos) ? `${resumoDoCluster.blocos} blocos × ${blocos![0]} reps` : `Blocos ${textoDeBlocos(blocos)}`} = ${resumoDoCluster.repeticoes} reps`
    : 'Complete os blocos';
  // A leitura do aluno; nula no cluster sem blocos válidos (o "Para o aluno" pede para completar).
  const leitura = cardio || !(cluster && !blocosValidos(blocos)) ? textoParaOAluno(g, config, unidade) : null;
  const titulo = cardio ? `Série ${numero}` : `Série ${numero} · ${tituloDoGrupoDeSeries(g, config)}`;
  return <View style={[estilos.grupo, { borderWidth: bordas.item, borderColor: borda, backgroundColor: cores.superficie }]}>
    {/* "Editando: Série 2 · Trabalho · WS" e, embaixo, os números (reunião de 30/10). Na coluna estreita as ações descem uma
        linha, senão o título quebra palavra por palavra. */}
    <CabecalhoDeGrupo titulo={`Editando: ${titulo}`} resumo={leitura ?? undefined} selo={nivel === 'sucesso' ? undefined : SELO_DO_NIVEL[nivel]} linha="fina"
      inicio={<NumeroInvertido numero={numero} invertido />} acoesJuntas={largo} acoes={<>
      <IconeBotao moldura Icone={ArrowUp} rotulo={`Subir série ${numero}`} desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
      <IconeBotao moldura Icone={ArrowDown} rotulo={`Descer série ${numero}`} desabilitado={ultimo} aoTocar={() => aoMover(1)} />
      <IconeBotao moldura Icone={Trash2} rotulo={`Remover série ${numero}`} cor={cores.perigo} aoTocar={aoRemover} />
    </>} />
    <View style={[estilos.corpo, { padding: recuo }]}>
      {/* Faixa 1: para que a série serve (tipo) e como executar (técnica). */}
      {secoes.tipo ? <Faixa titulo="Tipo e técnica" primeira>
        <View style={largo ? estilos.lado : estilos.empilhado}>
          <View style={[estilos.juntos, largo ? estilos.ladoMaior : null]}>
            <Tipos rotulo="Tipo da série" opcoes={tipos} valor={s.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
            {explicacao ? <BotaoDeAbrir texto={`O que é o tipo ${nomeTipo}?`} aberto={explicarTipo} aoAlternar={() => setExplicarTipo(!explicarTipo)} /> : null}
            {explicacao && explicarTipo ? <Explicacao texto={explicacao} /> : null}
            <ErroDoCampo mensagem={erros.tipo} />
            <AvisoDoCampo mensagem={avisos.tipo} />
          </View>
          {secoes.tecnica ? <View style={[estilos.juntos, largo ? estilos.ladoMenor : null]}>
            <Tecnicas rotulo="Técnica da série" opcoes={opcoesTecnica} valor={s.tecnica?.tipo ?? 'NENHUMA'} aoMudar={aoTecnica} />
            {tecnicaTexto && nomeTecnica ? <BotaoDeAbrir texto={`O que é ${nomeTecnica}?`} aberto={explicarTecnica} aoAlternar={() => setExplicarTecnica(!explicarTecnica)} /> : null}
            {tecnicaTexto && nomeTecnica && explicarTecnica ? <Explicacao texto={tecnicaTexto} /> : null}
          </View> : null}
        </View>
        {secoes.tecnica && podeRestPauseNaUltima(g, config) ? <LinhaDeAcoes>
          <Botao rotulo="Aplicar Rest-pause só na última série" tipo="secundario" aoTocar={aoRestPauseNaUltima} />
        </LinhaDeAcoes> : null}
      </Faixa> : null}

      {/* Faixa 2: séries × repetições × descanso numa linha que quebra; os campos da técnica embaixo, na largura toda. */}
      <Faixa titulo={cardio ? 'Quantidade' : 'Estrutura'} primeira={!secoes.tipo}>
        <View style={estilos.estrutura}>
          <View style={estilos.juntos}>
            <Texto variante="rotulo">Séries</Texto>
            <View style={estilos.contador}>
              <IconeBotao moldura Icone={Minus} rotulo="Uma série completa a menos" desabilitado={g.series.length <= 1} aoTocar={() => aoQuantidade(g.series.length - 1)} />
              <Texto numerico variante="bloco" style={estilos.numero} accessibilityLabel={`${g.series.length} séries completas`}>{g.series.length}</Texto>
              <IconeBotao moldura Icone={Plus} rotulo="Uma série completa a mais" desabilitado={!podeMais} aoTocar={() => aoQuantidade(g.series.length + 1)} />
            </View>
          </View>
          {/* Repetições e descanso quebram juntos: sem espaço para os três, as Séries ficam em cima e os dois descem lado a lado. */}
          {secoes.prescricao ? <View style={[estilos.estrutura, estilos.repeticoesEDescanso]}>
            {secoes.prescricao && !cluster ? <CamposDasRepeticoes compacta valor={s} erros={erros} semRepeticoes="Sem repetições: o aluno lê a série por tempo."
              aoMudar={(r) => aoAlterar({ repsMin: r.repsMin, repsMax: r.repsMax, amrap: r.amrap })} /> : null}
            {secoes.prescricao && cluster ? <View style={estilos.juntos}>
              <Texto variante="rotulo">Repetições</Texto>
              <Texto numerico cor={cores.texto} style={estilos.resumoDoCluster}>{textoDoCluster}</Texto>
            </View> : null}
            {secoes.prescricao ? <View style={{ width: escalar(LARGURA_DO_DESCANSO, fatorTexto) }}>
              <CampoNumerico rotulo="Descanso" rotuloAcessivel="Descanso depois da série, em segundos" inteiro sufixo="s" sufixoNaCaixa valor={s.descansoSegundos}
                aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })} erroSemTexto
                erro={erroDoDescanso} />
            </View> : null}
          </View> : null}
        </View>
        <ErroDoCampo mensagem={erroDoDescanso} />
        {secoes.tecnica && s.tecnica && !descritiva
          ? <CamposDaTecnica tecnica={s.tecnica} erros={subProblemas(erros, 'tecnica')} semCarga={semCarga} ws={nomeDaSerieDeTrabalho(config)} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
          : null}
        {secoes.prescricao && cluster ? <ErroDoCampo mensagem={erros.repsMin} /> : null}
        {secoes.cardio ? <CamposDoCardio cardio={s.cardio} aoMudar={(c) => aoAlterar({ cardio: c })} erros={{ ...subProblemas(erros, 'cardio'), ...(erros.cardio ? { cardio: erros.cardio } : {}) }} /> : null}
      </Faixa>

      {/* Faixa 3: a carga pelo papel e, sempre visível, uma linha por série com o % (ou kg) e o RIR dela. */}
      {secoes.carga ? <Faixa titulo={semCarga ? 'RIR' : 'Carga e RIR'}>
        <CargaERirDaSerie grupo={g} series={series} config={config} porSerie={porSerie} semCarga={semCarga} aoMudar={aoMudarSeries} />
      </Faixa> : null}

      {/* Rodapé: a observação desta série (uma linha) e como o aluno vai ler. */}
      <Faixa>
        {secoes.alvoExtra ? <Campo rotulo={`${ROTULO_DA_OBSERVACAO_DA_SERIE} (opcional)`} valor={s.alvoExtra ?? ''} maxLength={120} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })}
          erro={erros.alvoExtra} /> : null}
        <ParaOAluno nivel={nivel} texto={leitura ?? 'Complete os blocos para visualizar a prescrição.'} />
      </Faixa>
    </View>
  </View>;
}

/**
 * "Para o aluno: 3×3 a 5 · FS · 50% · 70% · 85% a 90% da WS". Com aviso ou erro, fundo e borda na cor do estado; sem
 * nada a corrigir, neutra e sem selo (o "Pronto" repetido em lista, cabeçalho e prévia saiu: reorganização de 10/11).
 */
function ParaOAluno({ nivel, texto }: { nivel: Nivel; texto: string }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.previa, nivel === 'sucesso'
      ? { borderColor: cores.borda, backgroundColor: cores.superficie2 }
      : { borderColor: cores[nivel], backgroundColor: tingido(cores[nivel], cores.superficie) }]}>
      <View style={estilos.linhaDaPrevia}>
        <View style={estilos.textoDaPrevia}>
          <Smartphone size={16} color={cores.texto} />
          <Texto numerico cor={cores.texto} style={estilos.flexivel}>
            <Texto variante="rotulo" cor={cores.texto}>Para o aluno: </Texto>{texto}
          </Texto>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // A faixa do cabeçalho fica rente às bordas; o corpo tem o próprio recuo.
  grupo: { borderWidth: BORDA_ITEM, borderRadius: RAIO, overflow: 'hidden' },
  corpo: { gap: espaco(2.5) },
  faixa: { gap: espaco(1.5) },
  // O fio da faixa fica a meio caminho da anterior: o vão do corpo (20) em cima e mais 8 até o título.
  fio: { marginBottom: espaco(1) },
  lado: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start' },
  empilhado: { gap: espaco(1.5) },
  ladoMaior: { flex: 3, minWidth: 0 },
  ladoMenor: { flex: 2, minWidth: 0 },
  // Séries, repetições e descanso: lado a lado enquanto couberem; no celular a linha quebra.
  estrutura: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(3), rowGap: espaco(1.5) },
  repeticoesEDescanso: { flexShrink: 1, minWidth: 0, maxWidth: '100%' },
  juntos: { gap: espaco(0.5) },
  explicacao: { borderLeftWidth: 2, paddingLeft: espaco(1.5), paddingVertical: espaco(0.5) },
  previa: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
  linhaDaPrevia: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1) },
  textoDaPrevia: { flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  flexivel: { flex: 1, minWidth: 0 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  numero: { fontFamily: fontes.negrito, minWidth: espaco(3), textAlign: 'center' },
  resumoDoCluster: { minHeight: 44, textAlignVertical: 'center', paddingTop: espaco(1.25) },
  suspensa: { maxWidth: 320 },
});
