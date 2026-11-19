import { Check, CircleAlert, Minus, Plus, Trash2, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Serie } from '../../api/tipos';
import { type GrupoDeSeries } from '../../dominio/agrupamento';
import { blocosIguais, blocosValidos, resumoDosBlocos, textoDeBlocos } from '../../dominio/blocos';
import { DESCANSO_MAXIMO_SEGUNDOS, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { podeRestPauseNaUltima } from '../../dominio/exemplosDePrescricao';
import { explicacaoDaTecnica, explicacaoDoTipo, nomeDaSerieDeTrabalho, nomeDoTipo, padraoDaTecnica, tecnicaDescritiva } from '../../dominio/metodologia';
import { escalar } from '../../dominio/preferencias';
import { ROTULO_DA_OBSERVACAO_DA_SERIE } from '../../dominio/resumoDaSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { AvisoDoCampo, CamposDaTecnica, CamposDasRepeticoes, CamposDoCardio, CargaERirDaSerie, ErroDoCampo } from './CamposDaPrescricao';
import { cargaPendente, textoParaOAluno } from './cargaDaSerie';
import { type EscolhaDeTecnica, opcoesDeTecnica, problemasDoGrupoDeSeries, problemasPorSerie, secoesDaSerie, subProblemas } from './opcoesDoEditor';

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
 * Uma seção da série aberta: o fio `divisor` em cima e o título (h3). Sem caixa (séries no padrão da dieta, 19/11): a
 * própria linha da série é o título do bloco, e as seções só se separam por fios, sem cartão aninhado.
 */
function Faixa({ titulo, children }: { titulo?: string; children: ReactNode }) {
  const { cores } = useTema();
  return <View style={estilos.faixa}>
    <Divisor style={estilos.fio} />
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
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; numero: number;
  porSerie: ReturnType<typeof problemasPorSerie>;
  aoAlterar: (m: AlteracaoDeGrupo) => void; aoMudarSeries: (novas: Serie[]) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoRemover: () => void;
  /** "Fechar edição": fecha o bloco e devolve o foco à linha da série (`TabelaDeBlocos`). */
  aoFechar: () => void;
}

/**
 * A série aberta (séries no padrão da dieta, 19/11): o corpo do bloco cuja linha já é o título, sem cabeçalho repetido,
 * moldura nem halo. Seções separadas por fios (tipo e técnica; estrutura; carga e RIR, uma linha por série; observação)
 * e, no rodapé, "Para o aluno" à esquerda e "Excluir série" e "Fechar edição" à direita. Subir e descer ficam no ⋯ da
 * linha (`TabelaDeBlocos`), fora do bloco.
 */
export function EditorGrupo({ largo, grupo: g, series, config, cardio, semCarga, tipos, podeMais, numero, porSerie, aoAlterar, aoMudarSeries, aoQuantidade, aoRestPauseNaUltima, aoRemover, aoFechar }: PropsDoGrupo) {
  const { cores, fatorTexto } = useTema();
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
  const erroDoDescanso = erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `Descanso: de 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null);
  const resumoDoCluster = cluster ? resumoDosBlocos(s.tecnica?.blocos) : null;
  const blocos = s.tecnica?.blocos ?? null;
  const textoDoCluster = resumoDoCluster
    ? `${blocosIguais(blocos) ? `${resumoDoCluster.blocos} blocos × ${blocos![0]} reps` : `Blocos ${textoDeBlocos(blocos)}`} = ${resumoDoCluster.repeticoes} reps`
    : 'Complete os blocos';
  // A leitura do aluno; nula no cluster sem blocos válidos (o "Para o aluno" pede para completar).
  const leitura = cardio || !(cluster && !blocosValidos(blocos)) ? textoParaOAluno(g, config, unidade) : null;
  return <View style={estilos.corpo}>
      {/* Faixa 1: para que a série serve (tipo) e como executar (técnica). */}
      {secoes.tipo ? <Faixa titulo="Tipo e técnica">
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
      <Faixa titulo={cardio ? 'Quantidade' : 'Estrutura'}>
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

      {/* Faixa 4: a observação desta série (uma linha). */}
      {secoes.alvoExtra ? <Faixa titulo="Observação">
        <Campo rotulo={`${ROTULO_DA_OBSERVACAO_DA_SERIE} (opcional)`} valor={s.alvoExtra ?? ''} maxLength={120} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })}
          erro={erros.alvoExtra} />
      </Faixa> : null}

      {/* Rodapé: como o aluno vai ler, à esquerda; excluir e fechar, à direita (quebram para baixo no celular). */}
      <View style={estilos.faixa}>
        <Divisor style={estilos.fio} />
        <View style={estilos.rodape}>
          <ParaOAluno nivel={nivel} texto={leitura ?? 'Complete os blocos para visualizar a prescrição.'} />
          {/* À direita também quando quebra para a linha de baixo (a prévia longa ocupa a de cima). */}
          <LinhaDeAcoes alinhar="fim" style={estilos.acoesDoRodape}>
            <Botao tipo="perigoTexto" rotulo="Excluir série" rotuloAcessivel={`Remover série ${numero}`} Icone={Trash2} aoTocar={aoRemover} />
            <Botao tipo="secundario" rotulo="Fechar edição" rotuloAcessivel={`Fechar edição da série ${numero}`} Icone={X} aoTocar={aoFechar} />
          </LinhaDeAcoes>
        </View>
      </View>
  </View>;
}

/**
 * "Para o aluno: 3×3 a 5 · FS · 50% · 70% · 85% a 90% da WS" no rodapé do bloco (séries no padrão da dieta, 19/11): sem
 * caixa, o estado no ícone da cor dele (✓ em `sucesso` sem nada a corrigir; ⚠ âmbar com aviso; ⊗ vermelho com erro) e o
 * texto na cor do texto. Era o único selo de situação da série aberta: o "Pronta"/"Corrigir" do cabeçalho saiu com ele.
 */
function ParaOAluno({ nivel, texto }: { nivel: Nivel; texto: string }) {
  const { cores } = useTema();
  const Icone = ICONE_DO_NIVEL[nivel];
  return (
    <View style={estilos.previa}>
      <Icone size={16} color={cores[nivel]} strokeWidth={2.25} aria-hidden />
      <Texto numerico cor={cores.texto} style={estilos.flexivel}>
        <Texto variante="rotulo" cor={cores.texto}>Para o aluno: </Texto>{texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  // O mesmo recuo lateral da linha da série (`TabelaDeBlocos`), para os campos começarem embaixo do "Série N".
  corpo: { gap: espaco(2.5), paddingHorizontal: espaco(1.5), paddingTop: espaco(0.25), paddingBottom: espaco(2) },
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
  acoesDoRodape: { marginLeft: 'auto' },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  previa: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  flexivel: { flex: 1, minWidth: 0 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  numero: { fontFamily: fontes.negrito, minWidth: espaco(3), textAlign: 'center' },
  resumoDoCluster: { minHeight: 44, textAlignVertical: 'center', paddingTop: espaco(1.25) },
  suspensa: { maxWidth: 320 },
});
