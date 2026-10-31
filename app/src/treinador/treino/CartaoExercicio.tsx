import { ArrowLeftRight, ChevronDown, ChevronUp, CircleAlert, CircleCheck, Save, Trash2, TriangleAlert, Unlink } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { descreverSeries } from '../../dominio/agrupamento';
import { comModalidade, trocaApagaSeries } from '../../dominio/editorTreino';
import { erroDaCadencia, erroDaIsometria, normalizarCadencia, textoExecucao } from '../../dominio/execucaoDoExercicio';
import { MODALIDADES } from '../../dominio/modalidades';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { BORDA_BLOCO, espaco, fontes, LARGURA_MENU_LATERAL, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { AvisoDoCampo } from './CamposDaPrescricao';
import { BotaoDeMover, EditorSeries } from './EditorSeries';

interface Props {
  exercicio: ExercicioPlano;
  posicao: number;
  total: number;
  aberto: boolean;
  comProblema: boolean;
  config: Configuracao | null;
  /** Problemas do exercício que não são de uma série (`nome`, `videoUrl`, `cadencia`, `isometriaSegundos`): chave relativa a ele. */
  erros?: Problemas;
  /** Avisos do mesmo tipo (`progressao`...): aparecem, mas não travam nada. */
  avisos?: Problemas;
  /** O exercício é de um grupo: oferece "Tirar do grupo". */
  noGrupo?: boolean;
  /** `false` quando o descanso do grupo substitui o descanso de cada série. */
  descansoPorSerie?: boolean;
  aoAbrir: () => void;
  aoMudar: (e: ExercicioPlano) => void;
  /** Troca de modalidade que apaga as séries (de ou para cardio), já confirmada: a tela guarda o conteúdo anterior para o "Desfazer". */
  aoMudarApagandoSeries?: (e: ExercicioPlano) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  aoTirarDoGrupo?: () => void;
  aoEscolherDaBiblioteca: () => void;
  aoUsarReceita: () => void;
  aoSalvarReceita: () => void;
  /** Imagem do exercício na biblioteca (nulo = fora dela ou sem imagem). */
  demonstracao?: { imagens: string[]; imagemPropriaEm: string | null } | null;
  /** Grupo muscular do exercício na biblioteca (etiqueta ao lado do nome); nulo fora dela. */
  grupoMuscular?: string | null;
}

const OPCOES_DE_MODALIDADE: { valor: string | null; rotulo: string }[] = [
  { valor: null, rotulo: 'Não informada' },
  ...Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor, rotulo })),
];

/** Exercício da sessão: fechado mostra o resumo das séries; aberto edita tudo. Cardio tem a prescrição própria. */
export function CartaoExercicio(p: Props) {
  const { cores, bordas } = useTema();
  const largo = useWindowDimensions().width >= LARGURA_MENU_LATERAL;
  const e = p.exercicio;
  const erros = p.erros ?? {};
  const avisos = p.avisos ?? {};
  const cardio = e.modalidade === 'CARDIO';
  const resumo = descreverSeries(e.series, p.config);
  const execucao = textoExecucao(e);
  const mudar = (parcial: Partial<ExercicioPlano>) => p.aoMudar({ ...e, ...parcial });
  // Estado do exercício na faixa, pela mesma validação da publicação, ao vivo (protótipo de 30/10).
  const estado = useMemo(() => estadoDoExercicio(e, p.config), [e, p.config]);
  const comErro = p.comProblema || estado.tipo === 'perigo';
  // "Execução" e "Observação e vídeo" começam fechados (pedido do Gustavo de 30/10); só abrem sozinhos com erro dentro.
  const [execucaoAberta, setExecucaoAberta] = useState(!!(erroDaCadencia(e.cadencia) ?? erros.cadencia ?? erroDaIsometria(e.isometriaSegundos) ?? erros.isometriaSegundos));
  const [extrasAbertos, setExtrasAbertos] = useState(!!(erroDoVideo(e.videoUrl) ?? erros.videoUrl));
  // Modalidade pedida que apagaria as séries: espera a confirmação.
  const [modalidadePendente, setModalidadePendente] = useState<{ valor: string | null } | null>(null);
  // A modalidade aparece como resumo ("Modalidade: Livre") e só vira escolha depois do "Alterar" (reunião de 30/10): um
  // toque sem querer nos chips não troca mais nada. Nunca é deduzida do nome do exercício.
  const [alterandoModalidade, setAlterandoModalidade] = useState(false);
  const trocarModalidade = (valor: string | null) => {
    if (valor === e.modalidade) return;
    if (trocaApagaSeries(e, valor)) setModalidadePendente({ valor });
    else {
      p.aoMudar(comModalidade(e, valor));
      setAlterandoModalidade(false);
    }
  };
  const confirmarModalidade = () => {
    if (!modalidadePendente) return;
    const novo = comModalidade(e, modalidadePendente.valor);
    setModalidadePendente(null);
    setAlterandoModalidade(false);
    (p.aoMudarApagandoSeries ?? p.aoMudar)(novo);
  };
  const nomeDaModalidade = OPCOES_DE_MODALIDADE.find((o) => o.valor === (e.modalidade ?? null))?.rotulo ?? e.modalidade ?? 'Não informada';

  return (
    <AlvoDeRolagem chave={e.uid}
      style={[
        estilos.cartao,
        // Reunião de 29/10: o exercício é o bloco principal (cartão branco) e os grupos de séries ficam dentro dele, em
        // `superficie2` com a faixa própria; aberto, o topo vira faixa para marcar onde o exercício começa.
        { borderWidth: bordas.bloco, borderColor: comErro ? cores.perigo : cores.borda, backgroundColor: cores.superficie },
      ]}>
      {/* A faixa do exercício é mais forte que as de dentro dele (`faixaForte`), aberto ou fechado. */}
      <View style={[estilos.topo, { backgroundColor: cores.faixaForte }, p.aberto && { borderBottomWidth: LINHA_DA_FAIXA, borderBottomColor: cores.bordaCampo }]}>
        {p.demonstracao ? (
          <DemonstracaoDoExercicio exercicioId={e.exercicioId} nome={e.nome} imagens={p.demonstracao.imagens}
            imagemPropriaEm={p.demonstracao.imagemPropriaEm} papel="EQUIPE" largura={56} altura={56} preencher ampliavel />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${p.aberto ? 'Fechar' : 'Editar'} ${e.nome || 'exercício sem nome'}`}
          accessibilityState={{ expanded: p.aberto }}
          onPress={p.aoAbrir}
          style={estilos.titulo}>
          <View style={estilos.linhaDoNome}>
            {/* "Exercício 2 de 5 · Supino reto": a posição por extenso não se confunde com o número da série (reunião de 30/10). */}
            <Texto style={estilos.nome}>
              <Texto style={[estilos.nome, { color: cores.textoSuave }]}>Exercício {p.posicao + 1} de {p.total} · </Texto>
              {e.nome || 'sem nome'}
            </Texto>
            {p.grupoMuscular ? <Selo texto={p.grupoMuscular} tipo="neutro" /> : null}
            <Selo texto={estado.texto} tipo={estado.tipo} Icone={estado.Icone} />
          </View>
          {!p.aberto ? (
            resumo.length ? (
              resumo.map((r, i) => (
                <Texto key={i} variante="suave">
                  {r}
                </Texto>
              ))
            ) : null
          ) : null}
          {!p.aberto && execucao ? <Texto variante="suave">{execucao}</Texto> : null}
          <View style={estilos.selos}>
            {cardio ? <Selo texto="Cardio" tipo="neutro" /> : null}
            {!e.progressao && !cardio ? <Selo texto="Sem progressão" tipo="neutro" /> : null}
            {e.exercicioId === null && e.nome ? <Selo texto="Fora da biblioteca" tipo="neutro" /> : null}
          </View>
        </Pressable>
        <View style={[estilos.acoes, largo ? estilos.acoesLargas : estilos.acoesEstreitas]}>
          {largo
            ? <Botao rotulo="Trocar" rotuloAcessivel={`Trocar ${e.nome || 'o exercício'}`} tipo="secundario" Icone={ArrowLeftRight} aoTocar={p.aoEscolherDaBiblioteca} />
            : <IconeBotao moldura Icone={ArrowLeftRight} rotulo={`Trocar ${e.nome || 'o exercício'}`} aoTocar={p.aoEscolherDaBiblioteca} />}
          <BotaoDeMover alvo="exercicio" direcao={-1} comTexto={largo} desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
          <BotaoDeMover alvo="exercicio" direcao={1} comTexto={largo} desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
          <IconeBotao moldura Icone={Trash2} rotulo={`Remover ${e.nome || 'o exercício'}`} cor={cores.perigo} aoTocar={p.aoRemover} />
          <IconeBotao moldura Icone={p.aberto ? ChevronUp : ChevronDown} rotulo={p.aberto ? 'Fechar exercício' : 'Editar exercício'} aoTocar={p.aoAbrir} />
        </View>
      </View>
      {p.aberto ? (
        <View style={estilos.corpo}>
          <Texto variante="secao" nivel={3}>Dados do exercício</Texto>
          <Campo rotulo="Nome de exibição" valor={e.nome} aoMudar={(nome) => mudar({ nome })} maxLength={120} erro={erros.nome} />
          {alterandoModalidade ? (
            <View style={estilos.modalidade}>
              <Escolha rotulo="Modalidade" compacta opcoes={OPCOES_DE_MODALIDADE} valor={e.modalidade} aoMudar={trocarModalidade} />
              <Texto variante="pequeno">Livre e máquina mantêm as séries como estão. Trocar de ou para cardio apaga as séries (dá para desfazer).</Texto>
              <View style={estilos.linhaDaModalidade}>
                <Botao rotulo="Manter como está" rotuloAcessivel="Manter a modalidade como está" tipo="fantasma" aoTocar={() => setAlterandoModalidade(false)} />
              </View>
            </View>
          ) : (
            <View style={estilos.linhaDaModalidade}>
              <Texto><Texto variante="rotulo">Modalidade: </Texto>{nomeDaModalidade}</Texto>
              <Botao rotulo="Alterar" rotuloAcessivel="Alterar modalidade" tipo="secundario" aoTocar={() => setAlterandoModalidade(true)} />
            </View>
          )}
          {!cardio ? (
            <Escolha
              rotulo="Carga do exercício"
              opcoes={[
                { valor: 'kg', rotulo: 'Em kg' },
                { valor: 'nenhuma', rotulo: 'Sem carga (elástico, peso corporal)' },
              ]}
              valor={e.unidade}
              aoMudar={(unidade) => mudar({ unidade })}
            />
          ) : null}
          {/* Progressão perto da carga: as duas são decisões de carga do exercício inteiro (teste local de 30/10). */}
          {!cardio ? (
            <Interruptor
              rotulo="Progressão de carga"
              ajuda={e.progressao ? 'O aluno busca subir a carga.' : 'O aluno vê "Foco em controle, não em carga".'}
              valor={e.progressao}
              aoMudar={(progressao) => mudar({ progressao })}
            />
          ) : null}
          {!cardio ? <AvisoDoCampo mensagem={avisos.progressao} /> : null}
          {cardio ? <Texto variante="pequeno">Cardio tem prescrição própria: duração, distância, ritmo, zona e intervalos. Trocar de ou para cardio apaga as séries.</Texto> : null}
          {p.noGrupo && p.aoTirarDoGrupo ? (
            <Botao rotulo="Tirar do grupo" rotuloAcessivel={`Tirar ${e.nome || 'o exercício'} do grupo`} tipo="fantasma" Icone={Unlink} aoTocar={p.aoTirarDoGrupo} />
          ) : null}
          <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
          <Texto variante="secao">{cardio ? 'Cardio' : 'Séries'}</Texto>
          <EditorSeries modalidade={e.modalidade} series={e.series} config={p.config} semCarga={e.unidade === 'nenhuma'} descansoPorSerie={p.descansoPorSerie !== false} aoMudar={(series) => mudar({ series })} aoUsarReceita={p.aoUsarReceita}
            numeroDoExercicio={p.posicao + 1} nomeDoExercicio={e.nome} />
          <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
          <CabecalhoDeGrupo titulo="Execução (opcional)" resumo={execucaoAberta ? undefined : resumoDaExecucao(e)} aberto={execucaoAberta} aoAlternar={() => setExecucaoAberta((v) => !v)} />
          {execucaoAberta ? <View style={estilos.linhaExecucao}>
            <View style={estilos.cadencia}>
              <Campo
                rotulo="Cadência"
                valor={e.cadencia ?? ''}
                aoMudar={(t) => mudar({ cadencia: normalizarCadencia(t) })}
                erro={erroDaCadencia(e.cadencia) ?? erros.cadencia}
                ajuda="Descida-pausa embaixo-subida-pausa em cima, em segundos; X = o mais rápido possível."
                placeholder="Ex.: 3-1-1-0"
                autoCapitalize="characters"
                maxLength={15}
              />
            </View>
            <View style={estilos.isometria}>
              <CampoNumerico
                rotulo="Isometria"
                inteiro
                sufixo="s"
                valor={e.isometriaSegundos ?? null}
                aoMudar={(isometriaSegundos) => mudar({ isometriaSegundos })}
                erro={erroDaIsometria(e.isometriaSegundos) ?? erros.isometriaSegundos}
                ajuda="Segure N s; diga onde na observação."
              />
            </View>
          </View> : null}
          <CabecalhoDeGrupo titulo="Observação e vídeo" resumo={extrasAbertos ? undefined : resumoDosExtras(e)} aberto={extrasAbertos} aoAlternar={() => setExtrasAbertos((v) => !v)} />
          {extrasAbertos ? (
            <>
              <Campo
                rotulo="Observação para o aluno"
                valor={e.observacao ?? ''}
                aoMudar={(t) => mudar({ observacao: t || null })}
                linhas={2}
                maxLength={1000}
              />
              <Campo
                rotulo="Vídeo (link do YouTube, opcional)"
                valor={e.videoUrl ?? ''}
                aoMudar={(t) => mudar({ videoUrl: t.trim() || null })}
                erro={erroDoVideo(e.videoUrl) ?? erros.videoUrl}
                autoCapitalize="none"
                keyboardType="url"
                maxLength={500}
              />
            </>
          ) : null}
          {e.series.length && !cardio ? (
            <View style={estilos.rodape}>
              <Botao rotulo={rotuloSalvarComo('SERIES')} tipo="fantasma" Icone={Save} aoTocar={p.aoSalvarReceita} />
            </View>
          ) : null}
        </View>
      ) : null}
      <PainelConfirmacao
        visivel={modalidadePendente !== null}
        titulo={modalidadePendente?.valor === 'CARDIO' ? 'Trocar para cardio?' : 'Tirar o exercício do cardio?'}
        mensagem={`${e.series.length === 1 ? 'A série' : `As ${e.series.length} séries`} deste exercício ${e.series.length === 1 ? 'será apagada' : 'serão apagadas'}, porque a prescrição de cardio é outra. Dá para desfazer logo depois.`}
        rotuloConfirmar="Apagar séries e trocar"
        perigo
        aoCancelar={() => setModalidadePendente(null)}
        aoConfirmar={confirmarModalidade}
      />
    </AlvoDeRolagem>
  );
}

/**
 * Selo da faixa: "Pronto" (verde), avisos (âmbar) ou problemas (vermelho), pela validação da publicação. Exercício sem
 * série diz isso em vez de contar o problema.
 */
function estadoDoExercicio(e: ExercicioPlano, config: Configuracao | null) {
  const r = validarExercicio(e, config);
  if (e.series.length === 0) return { tipo: 'perigo' as const, texto: e.modalidade === 'CARDIO' ? 'Sem prescrição' : 'Sem séries', Icone: CircleAlert };
  if (r.erros.length) return { tipo: 'perigo' as const, texto: r.erros.length === 1 ? '1 problema a corrigir' : `${r.erros.length} problemas a corrigir`, Icone: CircleAlert };
  if (r.avisos.length) return { tipo: 'atencao' as const, texto: r.avisos.length === 1 ? '1 aviso' : `${r.avisos.length} avisos`, Icone: TriangleAlert };
  return { tipo: 'sucesso' as const, texto: 'Pronto', Icone: CircleCheck };
}

/** O que está preenchido na "Execução", para a faixa fechada não esconder: "Cadência 3-1-1-0 · isometria 2 s". */
function resumoDaExecucao(e: ExercicioPlano): string {
  const partes = [e.cadencia ? `Cadência ${e.cadencia}` : null, e.isometriaSegundos != null ? `isometria ${e.isometriaSegundos} s` : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Nada preenchido';
}

/** O mesmo para "Observação e vídeo", no jeito do resumo da sessão. */
function resumoDosExtras(e: ExercicioPlano): string {
  const partes = [e.observacao ? 'com observação' : null, e.videoUrl ? 'com vídeo' : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Nada preenchido';
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: BORDA_BLOCO, borderRadius: RAIO, overflow: 'hidden' },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.25) },
  linhaDoNome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  acoesEstreitas: { marginLeft: 'auto' },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 2, minHeight: 44, justifyContent: 'center' },
  nome: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5), marginTop: 2 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  // No PC os botões de mover têm texto: a linha quebra em vez de apertar o nome do exercício.
  acoesLargas: { flexWrap: 'wrap', justifyContent: 'flex-end' },
  modalidade: { gap: espaco(1) },
  linhaDaModalidade: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  corpo: { gap: espaco(1.5), padding: espaco(1.5), paddingTop: espaco(2) },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espaco(1) },
  linhaExecucao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  cadencia: { flexGrow: 1, flexBasis: 220 },
  isometria: { width: 180 },
  // Separa as partes do exercício (dados, séries, execução).
  divisor: { height: StyleSheet.hairlineWidth, marginVertical: espaco(0.5) },
});
