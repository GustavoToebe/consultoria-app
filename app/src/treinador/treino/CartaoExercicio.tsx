import { ArrowLeftRight, ChevronDown, ChevronUp, Ellipsis, NotebookTabs, Save, Trash2, Unlink } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { AlternativaDeExercicio, Configuracao, ExercicioPlano } from '../../api/tipos';
import { descreverSeries } from '../../dominio/agrupamento';
import { resumoDosExtras } from '../../dominio/camposDaSerie';
import { erroDaCadencia, erroDaIsometria, normalizarCadencia, textoExecucao } from '../../dominio/execucaoDoExercicio';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { BORDA_BLOCO, espaco, LARGURA_MENU_LATERAL, LARGURA_TEXTO_CORRIDO, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
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
import { acoesDeMover } from '../acoesDeMover';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { AlternativasDoExercicio } from './AlternativasDoExercicio';
import { SecaoRecolhivel } from '../../ui/SecaoRecolhivel';
import { BotaoDeInfo, Explicacao } from './BotaoDeAbrir';
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
  /** Alternativas de troca do dia: abre a folha da biblioteca e pede a troca em todas as sessões. Sem os dois, o bloco não aparece. */
  aoAdicionarAlternativa?: () => void;
  aoTrocarEmTodas?: (alternativa: AlternativaDeExercicio) => void;
  /** Aba de séries aberta (uid de uma série do grupo) e a troca dela: o editor guarda uma por exercício (D8). */
  grupoAbertoUid?: string | null;
  aoAbrirGrupo?: (serieUid: string | null) => void;
  /** Imagem do exercício na biblioteca (nulo = fora dela ou sem imagem). */
  demonstracao?: { imagens: string[]; imagemPropriaEm: string | null } | null;
  /** Grupo muscular do exercício na biblioteca (etiqueta ao lado do nome); nulo fora dela. */
  grupoMuscular?: string | null;
  /** Alça de arrastar (`ui/ArrasteDaLista`) no começo do topo, no cartão empilhado. */
  alca?: ReactNode;
}

/**
 * Exercício da sessão: fechado mostra o resumo das séries; aberto edita tudo. Sem modalidade, "Carga do exercício" nem
 * "Progressão de carga" (04/11, C08): a musculação aceita carga e progride; o cardio nasce do "+ Adicionar cardio" da
 * sessão e tem a prescrição própria.
 */
/** Id no DOM (web) do topo do cartão: o "Exercício aberto" o traz para baixo da barra grudada. */
export const idDoExercicio = (uid: string) => `exercicio-${uid}`;

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
  // "Nome de exibição e instruções" nasce fechado, mesmo com conteúdo (18/11; o botão diz o que há dentro). Abre sozinho
  // com nome vazio (exercício recém-criado, o campo é obrigatório) e com erro dentro, para o "ir ao primeiro" cair num campo visível.
  const [escolhaDosExtras, setEscolhaDosExtras] = useState(false);
  const extrasComErro = !!(erros.nome ?? erroDoVideo(e.videoUrl) ?? erros.videoUrl ?? erroDaCadencia(e.cadencia) ?? erros.cadencia ?? erroDaIsometria(e.isometriaSegundos) ?? erros.isometriaSegundos);
  const extrasAbertos = extrasComErro || !e.nome.trim() || escolhaDosExtras;
  const foraDaBiblioteca = e.exercicioId === null && !!e.nome;
  // Arrastar (18/11): as setas saíram da linha e foram para o ⋯ ("Mover para cima/baixo").
  const [menu, setMenu] = useState(false);
  const nomeDoExercicio = e.nome || 'o exercício';
  const acoesDoMenu = acoesDeMover({ nome: nomeDoExercicio, posicao: p.posicao, total: p.total, aoMover: p.aoMover });
  const [explicarExecucao, setExplicarExecucao] = useState(false);

  const dados = <>
    {/* Seção recolhível de verdade (27/11): o título com a seta e, fechada, o resumo do que há dentro. Aberta, em grade:
        nome | vídeo; a observação na largura de leitura; cadência | isometria. As explicações ficam no ⓘ. */}
    <SecaoRecolhivel titulo="Nome de exibição e instruções" resumo={resumoDosExtras(e)} aberta={extrasAbertos} aoMudar={setEscolhaDosExtras}>
      <View style={estilos.extras}>
        <View style={estilos.linhaDosExtras}>
          <View style={estilos.metade}>
            <Campo rotulo="Nome de exibição" valor={e.nome} aoMudar={(nome) => mudar({ nome })} maxLength={120} erro={erros.nome} />
          </View>
          <View style={estilos.metade}>
            <Campo
              rotulo="Vídeo (link do YouTube, opcional)"
              valor={e.videoUrl ?? ''}
              aoMudar={(t) => mudar({ videoUrl: t.trim() || null })}
              erro={erroDoVideo(e.videoUrl) ?? erros.videoUrl}
              placeholder="https://youtu.be/…"
              autoCapitalize="none"
              keyboardType="url"
              maxLength={500}
            />
          </View>
        </View>
        <View style={estilos.leitura}>
          <Campo
            rotulo="Observação para o aluno"
            valor={e.observacao ?? ''}
            aoMudar={(t) => mudar({ observacao: t || null })}
            linhas={2}
            maxLength={1000}
          />
        </View>
        <View style={estilos.linhaExecucao}>
          <View style={estilos.cadencia}>
            <Campo
              rotulo="Cadência"
              valor={e.cadencia ?? ''}
              aoMudar={(t) => mudar({ cadencia: normalizarCadencia(t) })}
              erro={erroDaCadencia(e.cadencia) ?? erros.cadencia}
              placeholder="3-1-1-0"
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
            />
          </View>
          <View style={estilos.infoDaExecucao}>
            <BotaoDeInfo rotulo="Sobre cadência e isometria" aberto={explicarExecucao} aoAlternar={() => setExplicarExecucao(!explicarExecucao)} />
          </View>
        </View>
        {explicarExecucao ? <Explicacao texto="Cadência: descida-pausa embaixo-subida-pausa em cima, em segundos; X = o mais rápido possível. Isometria: segure N s; diga onde na observação." /> : null}
      </View>
    </SecaoRecolhivel>
    {p.aoAdicionarAlternativa && p.aoTrocarEmTodas ? (
      <AlternativasDoExercicio exercicio={e} erros={erros} aoMudar={p.aoMudar} aoAdicionar={p.aoAdicionarAlternativa} aoTrocarEmTodas={p.aoTrocarEmTodas} />
    ) : null}
    {cardio ? <Texto variante="pequeno">Cardio tem prescrição própria: duração, distância, ritmo, zona e intervalos.</Texto> : null}
    {p.noGrupo && p.aoTirarDoGrupo ? (
      <Botao rotulo="Tirar do grupo" rotuloAcessivel={`Tirar ${e.nome || 'o exercício'} do grupo`} tipo="fantasma" Icone={Unlink} aoTocar={p.aoTirarDoGrupo} />
    ) : null}
  </>;
  // 27/11: o total no cabeçalho ("SÉRIES · 5 no total") e as duas ações de receita à direita; o rodapé saiu.
  const total = e.series.length;
  const series = <>
    <View style={estilos.tituloDasSeries}>
      <View style={estilos.tituloETotal}>
        <Texto variante="secao" nivel={3}>{cardio ? 'Cardio' : 'Séries'}</Texto>
        {total ? <Texto variante="pequeno" numerico>{`· ${total} no total`}</Texto> : null}
      </View>
      {/* Sem séries, "Usar receita" fica no estado vazio do `EditorSeries` (D13), não duas vezes. */}
      {cardio || !total ? null : <View style={estilos.acoesDasSeries}>
        <Botao rotulo="Usar receita de séries" tipo="acao" Icone={NotebookTabs} aoTocar={p.aoUsarReceita} />
        <Botao rotulo="Salvar como receita" rotuloAcessivel="Salvar como receita de séries" tipo="secundario" Icone={Save} aoTocar={p.aoSalvarReceita} />
      </View>}
    </View>
    <EditorSeries cardio={cardio} series={e.series} config={p.config} semCarga={e.unidade === 'nenhuma'}
      aoUsarReceita={cardio ? undefined : p.aoUsarReceita}
      descansoPorSerie={p.descansoPorSerie !== false} aoMudar={(series) => mudar({ series })}
      grupoAbertoUid={p.grupoAbertoUid} aoAbrirGrupo={p.aoAbrirGrupo} />
  </>;

  return (
    <AlvoDeRolagem chave={e.uid}
      style={[
        estilos.cartao,
        // Reunião de 29/10: o exercício é o bloco principal (cartão branco) e os grupos de séries ficam dentro dele, em
        // cartão com contorno e faixas próprios (`EditorDoGrupoDeSeries`); aberto, o topo vira faixa para marcar onde o
        // exercício começa.
        { borderWidth: bordas.bloco, borderColor: comErro ? cores.perigo : cores.borda, backgroundColor: cores.superficie },
        // Séries no padrão da dieta (19/11): aberto, o painel em edição ganha a faixa da esquerda na cor de ação, a mesma
        // barra do cartão da refeição na dieta (`CartaoRefeicao`, `BARRA_DA_REFEICAO`). É o único destaque de ação do
        // painel: a série aberta dentro dele usa só o fundo tingido. Com erro, o contorno fica vermelho e a faixa não muda.
        p.aberto ? { borderLeftWidth: FAIXA_DO_PAINEL, borderLeftColor: cores.acao } : null,
      ]}>
      {/* A faixa do exercício é mais forte que as de dentro dele (`faixaForte`), aberto ou fechado. */}
      <View nativeID={idDoExercicio(e.uid)} style={[estilos.topo, p.alca ? estilos.topoComAlca : null, { backgroundColor: cores.faixaForte }, p.aberto && { borderBottomWidth: LINHA_DA_FAIXA, borderBottomColor: cores.bordaCampo }]}>
        {p.alca}
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
            // WCAG 2.5.3: o nome acessível começa pelo texto visível ("Trocar exercício: Supino reto").
            ? <Botao rotulo="Trocar exercício" rotuloAcessivel={`Trocar exercício: ${e.nome || 'o exercício'}`} tipo="secundario" Icone={ArrowLeftRight} aoTocar={p.aoEscolherDaBiblioteca} />
            : <IconeBotao moldura Icone={ArrowLeftRight} rotulo={`Trocar exercício: ${e.nome || 'o exercício'}`} aoTocar={p.aoEscolherDaBiblioteca} />}
          {acoesDoMenu.length ? <IconeBotao moldura Icone={Ellipsis} rotulo={`Mais ações de ${nomeDoExercicio}`} aoTocar={() => setMenu(true)} /> : null}
          {/* 26/11: o mesmo "Excluir" dos três editores (tonal, ao lado do ⋯, rótulo com o objeto). */}
          <Botao tipo="perigo" rotulo="Excluir exercício" rotuloAcessivel={`Excluir exercício: ${nomeDoExercicio}`} Icone={Trash2} aoTocar={p.aoRemover} />
          {p.aoAbrir ? <IconeBotao moldura Icone={p.aberto ? ChevronUp : ChevronDown} rotulo={p.aberto ? 'Fechar exercício' : 'Editar exercício'} aoTocar={p.aoAbrir} /> : null}
        </View>
      </View>
      {menu ? <FolhaDeAcoes titulo={e.nome || 'Exercício sem nome'} aoFechar={() => setMenu(false)} acoes={acoesDoMenu} /> : null}
      {p.aberto ? (
        <View style={estilos.corpo}>
          {dados}
          <Divisor style={estilos.divisor} />
          {series}
        </View>
      ) : null}
    </AlvoDeRolagem>
  );
}

/**
 * Largura da faixa do painel aberto: a mesma 6 da barra da refeição na dieta (`BARRA_DA_REFEICAO`, local do `CartaoRefeicao`).
 * shortcut: valor repetido nos dois editores; se mudar, extrair um token (`FAIXA_DO_PAINEL` em `tema/tokens.ts`) e usar nos dois.
 */
const FAIXA_DO_PAINEL = 6;

const estilos = StyleSheet.create({
  cartao: { borderWidth: BORDA_BLOCO, borderRadius: RAIO, overflow: 'hidden' },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.25) },
  // Com a alça, o recuo da esquerda fica com ela (a alça já tem a largura do vão).
  topoComAlca: { paddingLeft: espaco(0.5) },
  linhaDoNome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  acoesEstreitas: { marginLeft: 'auto' },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 2, minHeight: 44, justifyContent: 'center' },
  nome: { flexShrink: 1 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5), marginTop: espaco(0.25) },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  // No PC os botões de mover têm texto: a linha quebra em vez de apertar o nome do exercício.
  acoesLargas: { flexWrap: 'wrap', justifyContent: 'flex-end' },
  extras: { gap: espaco(1.5) },
  linhaDosExtras: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0 },
  leitura: { width: '100%', maxWidth: LARGURA_TEXTO_CORRIDO },
  infoDaExecucao: { paddingTop: 18 + espaco(0.5) },
  tituloDasSeries: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  tituloETotal: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.75) },
  acoesDasSeries: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), marginLeft: 'auto' },
  corpo: { gap: espaco(1.5), padding: espaco(1.5), paddingTop: espaco(2) },
  linhaExecucao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  cadencia: { width: 200 },
  isometria: { width: 120 },
  // Separa o contexto do exercício das séries.
  divisor: { marginVertical: espaco(0.5) },
});
