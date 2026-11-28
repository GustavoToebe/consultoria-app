import { Check, Image as IconeDeImagem, Info, Minus, Play, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Exercicio, Modalidade } from '../../api/tipos';
import {
  COR_DA_MODALIDADE, detalheDoExercicio, nomeDaModalidade, OPCOES_CURTAS_DE_MIDIA, OPCOES_DE_IMAGEM, OPCOES_DE_VIDEO,
  temImagem, temVideo, type FiltrosDeExercicios, type OpcaoDeGrupo,
} from '../../dominio/exerciciosDaBiblioteca';
import { inteiroComMilhar } from '../../dominio/formatos';
import { agruparGruposParecidos, textoDasVariacoes, type GrupoAgrupado } from '../../dominio/gruposMusculares';
import {
  alternarGrupo, comMarcadosNoTopo, emDuasColunas, estadoDoGrupo, gruposDaBuscaAgrupada, LARGURA_DA_LISTA_EM_DUAS_COLUNAS, LARGURA_DO_PAINEL_EM_COLUNAS,
} from '../../dominio/painelDeExercicios';
import type { EstadoDosVisiveis } from '../../dominio/selecaoMultiplaSuspensa';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { Escolha } from '../../ui/Escolha';
import { LinhaDaLista, type SeloDaLinha } from '../../ui/LinhaDaLista';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { coresDaSelecao } from '../../ui/selecao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { UmaOpcao } from '../SeletoresDeFiltro';

/** Lado da miniatura da linha do exercício (Biblioteca, Catálogo e a folha "Escolher exercício"). */
export const LADO_DA_MINIATURA = 56;

/** Grupo do painel com ou sem a contagem (a da Biblioteca chega depois da lista de nomes). */
export type OpcaoDoGrupoNoPainel = Omit<OpcaoDeGrupo, 'contagem'> & { contagem?: number };

/**
 * A linha do exercício da Biblioteca: miniatura (ou o ícone, para o nome alinhar), nome e "● Modalidade · Grupo · Equipamento"
 * com os ícones de vídeo e imagem. A mesma na aba Exercícios (com o lápis e a miniatura que amplia) e na folha "Escolher
 * exercício" (dentro de uma opção de lista: sem nada que se toque dentro, então a miniatura não amplia; `antes` leva a caixa
 * desenhada da escolha de vários e `selos` o "Atual" da troca). `marcado` é o contorno da linha ativa.
 */
export function LinhaDoExercicio({ exercicio: e, ampliavel = false, antes, acoes, selos, marcado }: {
  exercicio: Exercicio; ampliavel?: boolean; antes?: ReactNode; acoes?: ReactNode; selos?: SeloDaLinha[]; marcado?: boolean;
}) {
  const miniatura = (
    <DemonstracaoDoExercicio exercicioId={e.id} nome={e.nome} imagens={e.imagens} imagemPropriaEm={e.imagemPropriaEm} papel="EQUIPE"
      largura={LADO_DA_MINIATURA} altura={LADO_DA_MINIATURA} preencher ampliavel={ampliavel} reservarEspaco />
  );
  return (
    <LinhaDaLista titulo={e.nome} valores={<DetalheDoExercicio exercicio={e} />} selos={selos} marcado={marcado}
      inicio={antes ? <View style={estilos.inicio}>{antes}{miniatura}</View> : miniatura} acoesAoLado acoes={acoes} />
  );
}

/**
 * Bolinha de 8 px na cor da modalidade (identificação, só marca: o nome fica escrito ao lado, em texto neutro). Redonda
 * para não se confundir com o quadradinho dos macros. "Outro" (sem cor) usa o `textoSuave`.
 */
export function MarcaDaModalidade({ modalidade }: { modalidade: Modalidade }) {
  const { identificacao, cores } = useTema();
  const chave = COR_DA_MODALIDADE[modalidade];
  const cor = (chave ? identificacao?.[chave]?.cor : undefined) ?? cores.textoSuave;
  return <View aria-hidden style={[estilos.marca, { backgroundColor: cor }]} />;
}

/** Legenda das cores, uma vez acima da lista (como a dos macros), só com as modalidades que estão na lista. */
export function LegendaDasModalidades({ modalidades }: { modalidades: readonly Modalidade[] }) {
  if (modalidades.length === 0) return null;
  return (
    <View style={estilos.legenda} role="list" aria-label="Cores das modalidades">
      {modalidades.map((m) => (
        <View key={m} style={estilos.item} role="listitem">
          <MarcaDaModalidade modalidade={m} />
          <Texto variante="pequeno">{nomeDaModalidade(m)}</Texto>
        </View>
      ))}
    </View>
  );
}

/**
 * Ícone neutro que diz o que o exercício tem ("Tem vídeo", "Tem imagem"): nome acessível (`role=img`) e, na web, a dica do
 * navegador (`title`, que o react-native-web não repassa: vai pelo nó). Não é botão: não faz nada ao tocar.
 */
function IconeDoQueTem({ Icone, rotulo }: { Icone: LucideIcon; rotulo: string }) {
  const { cores } = useTema();
  const no = useRef<View>(null);
  useEffect(() => {
    const el: unknown = no.current;
    if (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) el.title = rotulo;
  }, [rotulo]);
  return (
    <View ref={no} role="img" aria-label={rotulo} style={estilos.icone}>
      <Icone size={16} color={cores.textoSuave} strokeWidth={2} aria-hidden />
    </View>
  );
}

/**
 * Linha de detalhe da lista: "● Máquina · Abdômen · Colchonete" e, no fim, os ícones de vídeo e de imagem. A mesma nas
 * abas Exercícios e Importar do catálogo (o do catálogo não tem vídeo nem imagem própria: vão nulos).
 */
export function DetalheDoExercicio({ exercicio: e }: { exercicio: Pick<Exercicio, 'modalidade' | 'grupoMuscular' | 'equipamento' | 'videoUrl' | 'imagemPropriaEm' | 'imagens'> }) {
  const resto = detalheDoExercicio(e);
  return (
    <View style={estilos.detalhe}>
      <View style={estilos.item}>
        <MarcaDaModalidade modalidade={e.modalidade} />
        <Texto variante="pequeno" numerico>{resto ? `${nomeDaModalidade(e.modalidade)} · ${resto}` : nomeDaModalidade(e.modalidade)}</Texto>
      </View>
      {temVideo(e) || temImagem(e) ? (
        <View style={estilos.icones}>
          {temVideo(e) ? <IconeDoQueTem Icone={Play} rotulo="Tem vídeo" /> : null}
          {temImagem(e) ? <IconeDoQueTem Icone={IconeDeImagem} rotulo="Tem imagem" /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Seletores do painel "Filtros" dos exercícios (Grupo muscular, Modalidade, Vídeo e Imagem), os mesmos nas abas
 * Exercícios e Importar do catálogo. `comVideo` falso tira o Vídeo (o catálogo não tem vídeo: o filtro nunca acharia nada).
 */
export function SeletoresDeExercicios<F extends FiltrosDeExercicios>({ atual, mudar, opcoesDeGrupo, opcoesDeModalidades, comVideo = true }: {
  atual: F; mudar: (f: F) => void; opcoesDeGrupo: readonly { valor: string; rotulo: string }[];
  opcoesDeModalidades: readonly { valor: Modalidade; rotulo: string }[]; comVideo?: boolean;
}) {
  return (
    <>
      {opcoesDeGrupo.length > 0 ? (
        <SelecaoMultiplaSuspensa rotulo="Grupo muscular" rotuloDeTodos="Todos os grupos" rotuloDaBusca="Buscar grupo" opcoes={opcoesDeGrupo}
          marcados={atual.grupos} aoMudar={(m) => mudar({ ...atual, grupos: m })} style={estilos.cheio} />
      ) : null}
      <FiltroDeModalidades opcoes={opcoesDeModalidades} marcados={atual.modalidades} aoMudar={(m) => mudar({ ...atual, modalidades: m })} />
      {comVideo ? <UmaOpcao rotulo="Vídeo" valor={atual.video} opcoes={OPCOES_DE_VIDEO} aoMudar={(v) => mudar({ ...atual, video: v })} /> : null}
      <UmaOpcao rotulo="Imagem" valor={atual.imagem} opcoes={OPCOES_DE_IMAGEM} aoMudar={(v) => mudar({ ...atual, imagem: v })} />
    </>
  );
}

/** Opção de modalidade do painel; a contagem vem quando quem usa tem a lista inteira (`comContagemDasModalidades`). */
export type OpcaoDaModalidadeNoPainel = { valor: Modalidade; rotulo: string; contagem?: number };

/** "Peito, 18 exercícios" (o nome falado da opção); sem a contagem, só o nome. */
const nomeComContagem = (rotulo: string, contagem: number | undefined) =>
  contagem === undefined ? rotulo : `${rotulo}, ${contagem === 1 ? '1 exercício' : `${inteiroComMilhar(contagem)} exercícios`}`;

/**
 * Painel de filtros dos exercícios na Biblioteca e na folha "Escolher exercício" (pedido de 27/11): com o painel medindo a
 * partir de `LARGURA_DO_PAINEL_EM_COLUNAS` (a folha média, 800), duas colunas, Grupo muscular à esquerda e Modalidade, Vídeo
 * e Imagem à direita; abaixo disso (o celular e o painel lateral de 460), tudo numa coluna. A medida é do painel, não da
 * janela. `esquerda` troca o Grupo muscular (a folha do cardio põe ali o "Tipo de cardio"); `comModalidade` falso: a folha
 * do cardio só tem cardio. O Catálogo continua com os `SeletoresDeExercicios` (lá a API não traz a contagem dos grupos).
 */
export function PainelDeExercicios<F extends FiltrosDeExercicios>({ atual, mudar, grupos, opcoesDeModalidades, comModalidade = true, esquerda }: {
  atual: F; mudar: (f: F) => void; grupos: readonly OpcaoDoGrupoNoPainel[];
  opcoesDeModalidades: readonly OpcaoDaModalidadeNoPainel[]; comModalidade?: boolean; esquerda?: ReactNode;
}) {
  // Antes da primeira medida, empilhado (o que cabe em qualquer largura).
  const [largura, setLargura] = useState(0);
  const lado = largura >= LARGURA_DO_PAINEL_EM_COLUNAS;
  const primeira = esquerda ?? (grupos.length > 0 ? <FiltroDeGrupos opcoes={grupos} marcados={atual.grupos} aoMudar={(m) => mudar({ ...atual, grupos: m })} /> : null);
  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={lado ? estilos.colunas : estilos.empilhado}>
      {primeira ? <View style={[estilos.empilhado, lado && estilos.coluna]}>{primeira}</View> : null}
      <View style={[estilos.empilhado, lado && estilos.coluna]}>
        {comModalidade ? <ChipsDeModalidade opcoes={opcoesDeModalidades} marcados={atual.modalidades} aoMudar={(m) => mudar({ ...atual, modalidades: m })} /> : null}
        {/* Vídeo e Imagem na mesma linha (compactos: os dois cabem nos ~370 px da coluna e nos 358 do celular); só quebram se não couberem. */}
        <View style={estilos.midias}>
          <Escolha compacta rotulo="Vídeo" opcoes={OPCOES_CURTAS_DE_MIDIA} valor={atual.video} aoMudar={(v) => mudar({ ...atual, video: v })} />
          <Escolha compacta rotulo="Imagem" opcoes={OPCOES_CURTAS_DE_MIDIA} valor={atual.imagem} aoMudar={(v) => mudar({ ...atual, imagem: v })} />
        </View>
      </View>
    </View>
  );
}

/**
 * "Grupo muscular" do painel: a busca "Buscar grupo" no topo (só com mais de `GRUPOS_PARA_BUSCAR` linhas: com poucos
 * grupos a lista inteira já se lê de uma vez) e, embaixo, uma lista de linhas
 * iguais (caixa + nome + contagem em mono, alinhada à direita), em duas colunas lidas de cima para baixo quando a lista mede
 * `LARGURA_DA_LISTA_EM_DUAS_COLUNAS` ou mais. Cada linha é um grupo de `agruparGruposParecidos`: as variações do mesmo
 * grupo ("Panturrilha" e "Panturrilhas") viram uma linha com o total somado e o ⓘ que mostra as variações; marcar a linha
 * marca todos os nomes reais (o filtro continua sendo a lista de nomes), e com parte deles marcada a caixa fica mista.
 * Os marcados ao abrir vêm primeiro; a ordem não muda enquanto se marca (a linha não foge do dedo nem do foco).
 * A busca nunca esconde um grupo marcado. Sem a contagem (a Biblioteca ainda não trouxe a lista inteira), só os nomes.
 */
/** Acima disto (linhas da lista, já agrupadas) o filtro de grupos ganha a busca; até aqui, só a lista. */
export const GRUPOS_PARA_BUSCAR = 12;

export function FiltroDeGrupos({ opcoes, marcados, aoMudar }: {
  opcoes: readonly OpcaoDoGrupoNoPainel[]; marcados: ReadonlySet<string>; aoMudar: (m: Set<string>) => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  // Os marcados de quando o painel abriu: o painel monta a cada abertura (e o "Limpar filtros" do painel lateral o remonta).
  const [noTopo] = useState(() => new Set(marcados));
  const [largura, setLargura] = useState(0);
  const semContagem = opcoes.some((o) => o.contagem === undefined);
  const agrupados = agruparGruposParecidos(opcoes.map((o) => ({ nome: o.valor, contagem: o.contagem ?? 0 })));
  const visiveis = comMarcadosNoTopo(gruposDaBuscaAgrupada(agrupados, busca, marcados), noTopo);
  const colunas = largura >= LARGURA_DA_LISTA_EM_DUAS_COLUNAS ? emDuasColunas(visiveis) : [visiveis];
  return (
    <View role="group" aria-label="Grupo muscular" style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>Grupo muscular</Texto>
      {agrupados.length > GRUPOS_PARA_BUSCAR
        ? <Campo rotulo="Buscar grupo" rotuloOculto valor={busca} aoMudar={setBusca} placeholder="Buscar grupo" autoCorrect={false} autoCapitalize="none" />
        : null}
      <View style={estilos.listaDeGrupos} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
        {colunas.map((coluna, i) => (
          <View key={i} style={estilos.colunaDeGrupos}>
            {coluna.map((g) => (
              <LinhaDoGrupo key={g.chave} grupo={g} semContagem={semContagem} estado={estadoDoGrupo(g, marcados)} aoTocar={() => aoMudar(alternarGrupo(g, marcados))} />
            ))}
          </View>
        ))}
      </View>
      {busca.trim() !== '' && visiveis.length === 0 ? <Texto variante="suave" accessibilityLiveRegion="polite">{`Nenhum grupo com “${busca.trim()}”.`}</Texto> : null}
    </View>
  );
}

/**
 * Uma linha da lista de grupos. O ⓘ é um botão irmão da caixa (não fica dentro dela: tocar nele não marca), um disclosure
 * como o da `SecaoRecolhivel`: abre as variações logo abaixo, no lugar, sem balão que a rolagem da folha cortaria. O resto
 * da linha à direita (a contagem) também marca, mas fica fora do Tab e do leitor de tela (a caixa já diz a contagem).
 */
function LinhaDoGrupo({ grupo, estado, semContagem, aoTocar }: { grupo: GrupoAgrupado; estado: EstadoDosVisiveis; semContagem: boolean; aoTocar: () => void }) {
  const { cores } = useTema();
  const [vendo, setVendo] = useState(false);
  const [emCima, setEmCima] = useState(false);
  const variacoes = grupo.variacoes.length > 1 ? (semContagem ? grupo.nomes.join(' · ') : textoDasVariacoes(grupo)) : '';
  const marcada = estado !== 'nenhum';
  const sobreA = { onHoverIn: () => setEmCima(true), onHoverOut: () => setEmCima(false) };
  return (
    <View>
      <View style={[estilos.linhaDoGrupo, { backgroundColor: emCima ? cores.sobre : 'transparent' }]}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={nomeComContagem(grupo.rotulo, semContagem ? undefined : grupo.total)}
          accessibilityState={{ checked: estado === 'alguns' ? 'mixed' : marcada }} aria-checked={estado === 'alguns' ? 'mixed' : marcada}
          onPress={aoTocar} {...sobreA} style={estilos.marcarGrupo}>
          <View style={[estilos.caixa, { backgroundColor: marcada ? cores.texto : cores.campo, borderColor: marcada ? cores.texto : cores.bordaCampo }]}>
            {estado === 'todos' ? <Check size={16} color={cores.fundo} strokeWidth={3} aria-hidden /> : null}
            {estado === 'alguns' ? <Minus size={16} color={cores.fundo} strokeWidth={3} aria-hidden /> : null}
          </View>
          <Texto style={[estilos.nomeDoGrupo, { fontFamily: marcada ? fontes.semi : fontes.medio }]}>{grupo.rotulo}</Texto>
        </Pressable>
        {variacoes ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Variações de ${grupo.rotulo}`} accessibilityState={{ expanded: vendo }} aria-expanded={vendo}
            onPress={() => setVendo(!vendo)} style={(e) => [estilos.info, { backgroundColor: vendo || sobre(e) ? cores.sobre : 'transparent' }]}>
            <Info size={16} color={vendo ? cores.texto : cores.textoSuave} strokeWidth={2} aria-hidden />
          </Pressable>
        ) : null}
        <Pressable aria-hidden focusable={false} accessible={false} onPress={aoTocar} {...sobreA} style={estilos.restoDaLinha}>
          {semContagem ? null : <Texto numerico cor={cores.textoSuave} style={estilos.contagem}>{inteiroComMilhar(grupo.total)}</Texto>}
        </Pressable>
      </View>
      {variacoes && vendo ? <Texto variante="pequeno" style={estilos.variacoes} accessibilityLiveRegion="polite">{variacoes}</Texto> : null}
    </View>
  );
}

/**
 * "Modalidade" do painel: chips compactos numa linha (bolinha da legenda + nome + contagem em mono), vários de uma vez
 * (nenhum = todas), quebrando só quando não cabem. A seleção é a neutra dos chips (superfície de seleção, contorno e ✓).
 */
function ChipsDeModalidade({ opcoes, marcados, aoMudar }: { opcoes: readonly OpcaoDaModalidadeNoPainel[]; marcados: ReadonlySet<string>; aoMudar: (m: Set<string>) => void }) {
  const { cores } = useTema();
  if (opcoes.length === 0) return null;
  return (
    <View role="group" aria-label="Modalidade" style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>Modalidade</Texto>
      <View style={estilos.chips}>
        {opcoes.map((o) => {
          const marcado = marcados.has(o.valor);
          const visual = coresDaSelecao(cores, marcado);
          return (
            <Pressable key={o.valor} accessibilityRole="checkbox" aria-checked={marcado} accessibilityState={{ checked: marcado }}
              accessibilityLabel={nomeComContagem(o.rotulo, o.contagem)}
              onPress={() => {
                const novo = new Set(marcados);
                if (marcado) novo.delete(o.valor); else novo.add(o.valor);
                aoMudar(novo);
              }}
              style={(estado) => [estilos.chip, estilos.chipCompacto, { borderColor: visual.borda, backgroundColor: !marcado && sobre(estado) ? cores.superficie2 : visual.fundo }]}>
              {marcado ? <Check size={14} color={visual.texto} strokeWidth={2.5} aria-hidden /> : null}
              <MarcaDaModalidade modalidade={o.valor} />
              <Texto style={[estilos.textoDoChip, { color: visual.texto, fontFamily: marcado ? fontes.semi : fontes.medio }]}>{o.rotulo}</Texto>
              {o.contagem === undefined ? null : <Texto numerico aria-hidden style={[estilos.textoDoChip, { color: cores.textoSuave }]}>{inteiroComMilhar(o.contagem)}</Texto>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** "Modalidade" no painel de filtros: uma caixa por opção (as que a biblioteca tem), com a bolinha da legenda; nenhuma marcada = todas. */
export function FiltroDeModalidades({ opcoes, marcados, aoMudar }: { opcoes: readonly { valor: Modalidade; rotulo: string }[]; marcados: ReadonlySet<string>; aoMudar: (m: Set<string>) => void }) {
  const { cores } = useTema();
  if (opcoes.length === 0) return null;
  return (
    <View role="group" aria-label="Modalidade" style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>Modalidade</Texto>
      {opcoes.map((o) => (
        <CaixaSelecao key={o.valor} rotulo={o.rotulo} marcado={marcados.has(o.valor)} marca={<MarcaDaModalidade modalidade={o.valor} />}
          aoMudar={(marcar) => {
            const novo = new Set(marcados);
            if (marcar) novo.add(o.valor); else novo.delete(o.valor);
            aoMudar(novo);
          }} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Seletor no painel de filtros: a largura toda da coluna.
  cheio: { alignSelf: 'stretch' },
  grupo: { gap: espaco(1) },
  inicio: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  // Os chips de grupo quebram linha, com o espaço e a medida dos chips da `Escolha`.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  chip: {
    minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, maxWidth: '100%', paddingHorizontal: espaco(1.5), borderRadius: RAIO_CONTROLE, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  textoDoChip: { fontSize: 14, flexShrink: 1, paddingVertical: 4 },
  chipCompacto: { paddingHorizontal: espaco(1.25) },
  // Painel: duas colunas iguais com 32 px entre elas (o dobro dos 24 entre os grupos de cada coluna) ou uma coluna só.
  empilhado: { gap: espaco(3) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(4) },
  coluna: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  midias: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(2) },
  // Lista de grupos: colunas iguais, linhas de 44 px; o fundo do hover cobre a linha inteira.
  listaDeGrupos: { flexDirection: 'row', alignItems: 'flex-start', columnGap: espaco(2) },
  colunaDeGrupos: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  linhaDoGrupo: { flexDirection: 'row', alignItems: 'center', minHeight: ALVO_TOQUE, borderRadius: RAIO_CONTROLE, paddingLeft: espaco(1) },
  marcarGrupo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, flexShrink: 1, minWidth: 0 },
  caixa: { width: 24, height: 24, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  nomeDoGrupo: { fontSize: 14, flexShrink: 1, paddingVertical: 4 },
  info: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  // O resto da linha: a contagem encostada à direita, com o mesmo recuo da caixa à esquerda.
  restoDaLinha: { flexGrow: 1, minHeight: ALVO_TOQUE, alignItems: 'flex-end', justifyContent: 'center', paddingLeft: espaco(1), paddingRight: espaco(1) },
  contagem: { fontSize: 14 },
  // As variações alinham com o nome (recuo da linha + caixa + vão).
  variacoes: { paddingLeft: espaco(1) + 24 + espaco(1), paddingBottom: espaco(1) },
  marca: { width: 8, height: 8, borderRadius: 4 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  // Marca e nome andam juntos: o item inteiro passa para a linha de baixo, nunca se parte.
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexShrink: 1 },
  detalhe: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  icones: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  icone: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
