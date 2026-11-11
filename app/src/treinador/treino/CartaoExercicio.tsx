import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, ChevronUp, NotebookTabs, Save, Trash2, Unlink } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { descreverSeries } from '../../dominio/agrupamento';
import { erroDaCadencia, erroDaIsometria, normalizarCadencia, textoExecucao } from '../../dominio/execucaoDoExercicio';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { BORDA_BLOCO, espaco, LARGURA_MENU_LATERAL, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { Divisor } from '../../ui/Divisor';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { EditorSeries } from './EditorSeries';
import { estadoDoExercicio } from './estadoDoExercicio';

export interface PropsDoCartaoExercicio {
  exercicio: ExercicioPlano;
  posicao: number;
  total: number;
  aberto: boolean;
  comProblema: boolean;
  config: Configuracao | null;
  /** Problemas do exercício que não são de uma série (`nome`, `videoUrl`, `cadencia`, `isometriaSegundos`): chave relativa a ele. */
  erros?: Problemas;
  /** O exercício é de um grupo: oferece "Tirar do grupo". */
  noGrupo?: boolean;
  /** `false` quando o descanso do grupo substitui o descanso de cada série. */
  descansoPorSerie?: boolean;
  /** Abre e fecha o corpo; sem ele (o inspetor do PC, sempre aberto) o título não é botão e não há seta. */
  aoAbrir?: () => void;
  aoMudar: (e: ExercicioPlano) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  aoTirarDoGrupo?: () => void;
  aoEscolherDaBiblioteca: () => void;
  aoUsarReceita: () => void;
  aoSalvarReceita: () => void;
  /** Aba de séries aberta (uid de uma série do grupo) e a troca dela: o editor guarda uma por exercício (D8). */
  grupoAbertoUid?: string | null;
  aoAbrirGrupo?: (serieUid: string | null) => void;
  /** Imagem do exercício na biblioteca (nulo = fora dela ou sem imagem). */
  demonstracao?: { imagens: string[]; imagemPropriaEm: string | null } | null;
  /** Grupo muscular do exercício na biblioteca (etiqueta ao lado do nome); nulo fora dela. */
  grupoMuscular?: string | null;
}

/**
 * Exercício da sessão: fechado mostra o resumo das séries; aberto edita tudo. Sem modalidade, "Carga do exercício" nem
 * "Progressão de carga" (04/11, C08): a musculação aceita carga e progride; o cardio nasce do "+ Adicionar cardio" da
 * sessão e tem a prescrição própria.
 */
export function CartaoExercicio(p: PropsDoCartaoExercicio) {
  const { cores, bordas } = useTema();
  const largo = useWindowDimensions().width >= LARGURA_MENU_LATERAL;
  const e = p.exercicio;
  const erros = p.erros ?? {};
  const cardio = e.modalidade === 'CARDIO';
  const unidade = useUnidadeDeCarga();
  const resumo = descreverSeries(e.series, p.config, unidade);
  const execucao = textoExecucao(e);
  const mudar = (parcial: Partial<ExercicioPlano>) => p.aoMudar({ ...e, ...parcial });
  // Estado do exercício na faixa, pela mesma validação da publicação, ao vivo (protótipo de 30/10).
  const estado = useMemo(() => estadoDoExercicio(e, p.config), [e, p.config]);
  const comErro = p.comProblema || estado.tipo === 'perigo';
  // "Instruções, vídeo e cadência" fecha quando vazio e abre quando já tem algo (04/11). Até a pessoa tocar, segue o
  // conteúdo; com erro dentro fica aberto, para o "ir ao primeiro" cair num campo visível.
  const [escolhaDosExtras, setEscolhaDosExtras] = useState<boolean | null>(null);
  const extrasComErro = !!(erros.nome ?? erroDoVideo(e.videoUrl) ?? erros.videoUrl ?? erroDaCadencia(e.cadencia) ?? erros.cadencia ?? erroDaIsometria(e.isometriaSegundos) ?? erros.isometriaSegundos);
  const extrasPreenchidos = !!(e.observacao || e.videoUrl || e.cadencia || e.isometriaSegundos != null);
  const extrasAbertos = extrasComErro || !e.nome.trim() || (escolhaDosExtras ?? extrasPreenchidos);
  const foraDaBiblioteca = e.exercicioId === null && !!e.nome;

  const dados = <>
    {/* Nome de exibição e o que é opcional num acordeão só (10/11): fechado, o botão diz o que já tem dentro. */}
    <BotaoDeAbrir texto={textoDosExtras(e)} aberto={extrasAbertos} aoAlternar={() => setEscolhaDosExtras(!extrasAbertos)} />
    {extrasAbertos ? (
      <View style={[estilos.extras, { borderColor: cores.borda }]}>
        <Campo rotulo="Nome de exibição" valor={e.nome} aoMudar={(nome) => mudar({ nome })} maxLength={120} erro={erros.nome} />
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
        <View style={estilos.linhaExecucao}>
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
        </View>
      </View>
    ) : null}
    {cardio ? <Texto variante="pequeno">Cardio tem prescrição própria: duração, distância, ritmo, zona e intervalos.</Texto> : null}
    {p.noGrupo && p.aoTirarDoGrupo ? (
      <Botao rotulo="Tirar do grupo" rotuloAcessivel={`Tirar ${e.nome || 'o exercício'} do grupo`} tipo="fantasma" Icone={Unlink} aoTocar={p.aoTirarDoGrupo} />
    ) : null}
  </>;
  const series = <>
    <View style={estilos.tituloDasSeries}>
      <Texto variante="secao">{cardio ? 'Cardio' : 'Séries'}</Texto>
      {cardio ? null : <Botao rotulo="Receita de séries" rotuloAcessivel="Usar uma receita de séries" tipo="secundario" Icone={NotebookTabs} aoTocar={p.aoUsarReceita} />}
    </View>
    <EditorSeries cardio={cardio} series={e.series} config={p.config} semCarga={e.unidade === 'nenhuma'}
      descansoPorSerie={p.descansoPorSerie !== false} aoMudar={(series) => mudar({ series })}
      grupoAbertoUid={p.grupoAbertoUid} aoAbrirGrupo={p.aoAbrirGrupo} />
  </>;
  const salvarReceita = e.series.length && !cardio ? (
    <View style={estilos.rodape}>
      <Botao rotulo={rotuloSalvarComo('SERIES')} tipo="fantasma" Icone={Save} aoTocar={p.aoSalvarReceita} />
    </View>
  ) : null;

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
          accessibilityRole={p.aoAbrir ? 'button' : undefined}
          accessibilityLabel={p.aoAbrir ? `${p.aberto ? 'Fechar' : 'Editar'} ${e.nome || 'exercício sem nome'}` : undefined}
          accessibilityState={p.aoAbrir ? { expanded: p.aberto } : undefined}
          disabled={!p.aoAbrir}
          onPress={p.aoAbrir}
          style={estilos.titulo}>
          {/* A posição por extenso, pequena, em cima ("Exercício 2 de 5 · Peito"): não se confunde com o número da série
              (reunião de 30/10). O nome é o título; ao lado, um selo só, o da situação. */}
          <Texto variante="pequeno" numerico>{[`Exercício ${p.posicao + 1} de ${p.total}`, p.grupoMuscular].filter(Boolean).join(' · ')}</Texto>
          <View style={estilos.linhaDoNome}>
            <Texto variante="bloco" style={estilos.nome}>{e.nome || 'sem nome'}</Texto>
            {estado.tipo === 'sucesso' ? null : <Selo texto={estado.texto} tipo={estado.tipo} Icone={estado.Icone} />}
          </View>
          {/* Fechado, o resumo e os atributos; aberto, eles estão nos próprios campos logo abaixo. "Fora da biblioteca" não
              tem campo: fica também aberto. */}
          {!p.aberto ? resumo.map((r, i) => <Texto key={i} variante="suave">{r}</Texto>) : null}
          {!p.aberto && execucao ? <Texto variante="suave">{execucao}</Texto> : null}
          {(!p.aberto && cardio) || foraDaBiblioteca ? (
            <View style={estilos.selos}>
              {!p.aberto && cardio ? <Selo texto="Cardio" tipo="neutro" /> : null}
              {foraDaBiblioteca ? <Selo texto="Fora da biblioteca" tipo="neutro" /> : null}
            </View>
          ) : null}
        </Pressable>
        <View style={[estilos.acoes, largo ? estilos.acoesLargas : estilos.acoesEstreitas]}>
          {largo
            ? <Botao rotulo="Trocar" rotuloAcessivel={`Trocar ${e.nome || 'o exercício'}`} tipo="secundario" Icone={ArrowLeftRight} aoTocar={p.aoEscolherDaBiblioteca} />
            : <IconeBotao moldura Icone={ArrowLeftRight} rotulo={`Trocar ${e.nome || 'o exercício'}`} aoTocar={p.aoEscolherDaBiblioteca} />}
          <IconeBotao moldura Icone={ArrowUp} rotulo={`Subir ${e.nome || 'o exercício'}`} desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
          <IconeBotao moldura Icone={ArrowDown} rotulo={`Descer ${e.nome || 'o exercício'}`} desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
          <IconeBotao moldura Icone={Trash2} rotulo={`Remover ${e.nome || 'o exercício'}`} cor={cores.perigo} aoTocar={p.aoRemover} />
          {p.aoAbrir ? <IconeBotao moldura Icone={p.aberto ? ChevronUp : ChevronDown} rotulo={p.aberto ? 'Fechar exercício' : 'Editar exercício'} aoTocar={p.aoAbrir} /> : null}
        </View>
      </View>
      {p.aberto ? (
        <View style={estilos.corpo}>
          {dados}
          <Divisor style={estilos.divisor} />
          {series}
          {salvarReceita}
        </View>
      ) : null}
    </AlvoDeRolagem>
  );
}

/** "Nome de exibição e instruções", com o que já está preenchido entre parênteses (o nome sempre está). */
function textoDosExtras(e: ExercicioPlano): string {
  const tem = [e.observacao ? 'observação' : null, e.videoUrl ? 'vídeo' : null, e.cadencia ? 'cadência' : null, e.isometriaSegundos != null ? 'isometria' : null].filter(Boolean);
  return `Nome de exibição e instruções${tem.length ? ` (com ${tem.join(', ')})` : ''}`;
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: BORDA_BLOCO, borderRadius: RAIO, overflow: 'hidden' },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.25) },
  linhaDoNome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  acoesEstreitas: { marginLeft: 'auto' },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 2, minHeight: 44, justifyContent: 'center' },
  nome: { flexShrink: 1 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5), marginTop: espaco(0.25) },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  // No PC os botões de mover têm texto: a linha quebra em vez de apertar o nome do exercício.
  acoesLargas: { flexWrap: 'wrap', justifyContent: 'flex-end' },
  extras: { gap: espaco(1.5), paddingLeft: espaco(1.5), borderLeftWidth: 2 },
  tituloDasSeries: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  corpo: { gap: espaco(1.5), padding: espaco(1.5), paddingTop: espaco(2) },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espaco(1) },
  linhaExecucao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  cadencia: { flexGrow: 1, flexBasis: 220 },
  isometria: { width: 180 },
  // Separa o contexto do exercício das séries.
  divisor: { marginVertical: espaco(0.5) },
});
