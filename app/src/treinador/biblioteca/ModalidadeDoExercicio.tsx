import { Check, Image as IconeDeImagem, Play, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Exercicio, Modalidade } from '../../api/tipos';
import {
  COR_DA_MODALIDADE, detalheDoExercicio, GRUPOS_SEM_BUSCA, gruposDaBusca, nomeDaModalidade, OPCOES_CURTAS_DE_MIDIA, OPCOES_DE_IMAGEM, OPCOES_DE_VIDEO,
  temImagem, temVideo, type FiltrosDeExercicios, type OpcaoDeGrupo,
} from '../../dominio/exerciciosDaBiblioteca';
import { inteiroComMilhar } from '../../dominio/formatos';
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

/**
 * Painel de filtros dos exercícios na Biblioteca e na folha "Escolher exercício": Grupo muscular em chips de várias escolhas
 * com a contagem, Modalidade com as bolinhas e Vídeo e Imagem em segmento (Todos · Com · Sem). O Catálogo continua com os
 * `SeletoresDeExercicios` (lá a API não traz a contagem dos grupos). `comModalidade` falso: a folha do cardio só tem cardio.
 */
export function PainelDeExercicios<F extends FiltrosDeExercicios>({ atual, mudar, grupos, opcoesDeModalidades, comModalidade = true }: {
  atual: F; mudar: (f: F) => void; grupos: readonly OpcaoDoGrupoNoPainel[];
  opcoesDeModalidades: readonly { valor: Modalidade; rotulo: string }[]; comModalidade?: boolean;
}) {
  return (
    <>
      {grupos.length > 0 ? <FiltroDeGrupos opcoes={grupos} marcados={atual.grupos} aoMudar={(m) => mudar({ ...atual, grupos: m })} /> : null}
      {comModalidade ? <FiltroDeModalidades opcoes={opcoesDeModalidades} marcados={atual.modalidades} aoMudar={(m) => mudar({ ...atual, modalidades: m })} /> : null}
      <Escolha rotulo="Vídeo" opcoes={OPCOES_CURTAS_DE_MIDIA} valor={atual.video} aoMudar={(v) => mudar({ ...atual, video: v })} />
      <Escolha rotulo="Imagem" opcoes={OPCOES_CURTAS_DE_MIDIA} valor={atual.imagem} aoMudar={(v) => mudar({ ...atual, imagem: v })} />
    </>
  );
}

/**
 * "Grupo muscular" do painel: um chip por grupo (vários de uma vez; nenhum = todos), em ordem alfabética e com quantos
 * exercícios tem ("Peito 18"; o leitor de tela diz "Peito, 18 exercícios"). Acima de `GRUPOS_SEM_BUSCA` grupos, a busca
 * "Buscar grupo" no topo, que nunca esconde um grupo marcado. Sem a contagem (ainda não chegou), o chip só tem o nome.
 * As peças que já existiam não servem: a `Escolha` é de uma escolha só, a `SelecaoMultiplaSuspensa` não mostra a contagem
 * e abre outra camada por cima do painel, e a `CaixaSelecao` (uma linha por opção) faria 17 linhas.
 */
export function FiltroDeGrupos({ opcoes, marcados, aoMudar }: {
  opcoes: readonly OpcaoDoGrupoNoPainel[]; marcados: ReadonlySet<string>; aoMudar: (m: Set<string>) => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const comBusca = opcoes.length > GRUPOS_SEM_BUSCA;
  const visiveis: readonly OpcaoDoGrupoNoPainel[] = comBusca ? gruposDaBusca(opcoes.map((o) => ({ ...o, contagem: o.contagem ?? 0 })), busca, marcados) : opcoes;
  const contagemDe = (valor: string) => opcoes.find((x) => x.valor === valor)?.contagem;
  const alternar = (valor: string) => {
    const novo = new Set(marcados);
    if (novo.has(valor)) novo.delete(valor); else novo.add(valor);
    aoMudar(novo);
  };
  return (
    <View role="group" aria-label="Grupo muscular" style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>Grupo muscular</Texto>
      {comBusca ? <Campo rotulo="Buscar grupo" rotuloOculto valor={busca} aoMudar={setBusca} placeholder="Buscar grupo" autoCorrect={false} autoCapitalize="none" /> : null}
      <View style={estilos.chips}>
        {visiveis.map((o) => {
          const marcado = marcados.has(o.valor);
          const visual = coresDaSelecao(cores, marcado);
          const contagem = contagemDe(o.valor);
          return (
            <Pressable key={o.valor} accessibilityRole="checkbox" aria-checked={marcado} accessibilityState={{ checked: marcado }}
              accessibilityLabel={contagem === undefined ? o.rotulo : `${o.rotulo}, ${contagem === 1 ? '1 exercício' : `${inteiroComMilhar(contagem)} exercícios`}`}
              onPress={() => alternar(o.valor)}
              style={(estado) => [estilos.chip, { borderColor: visual.borda, backgroundColor: !marcado && sobre(estado) ? cores.superficie2 : visual.fundo }]}>
              {marcado ? <Check size={16} color={visual.texto} strokeWidth={2.5} aria-hidden /> : null}
              <Texto style={[estilos.textoDoChip, { color: visual.texto, fontFamily: marcado ? fontes.semi : fontes.medio }]}>{o.rotulo}</Texto>
              {contagem === undefined ? null : <Texto numerico aria-hidden style={[estilos.textoDoChip, { color: cores.textoSuave }]}>{inteiroComMilhar(contagem)}</Texto>}
            </Pressable>
          );
        })}
      </View>
      {comBusca && visiveis.length === 0 ? <Texto variante="suave" accessibilityLiveRegion="polite">{`Nenhum grupo com “${busca.trim()}”.`}</Texto> : null}
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
  marca: { width: 8, height: 8, borderRadius: 4 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  // Marca e nome andam juntos: o item inteiro passa para a linha de baixo, nunca se parte.
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexShrink: 1 },
  detalhe: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  icones: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  icone: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
