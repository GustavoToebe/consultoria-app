import { Image as IconeDeImagem, Play, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Exercicio, Modalidade } from '../../api/tipos';
import {
  COR_DA_MODALIDADE, detalheDoExercicio, nomeDaModalidade, OPCOES_DE_IMAGEM, OPCOES_DE_VIDEO, temImagem, temVideo, type FiltrosDeExercicios,
} from '../../dominio/exerciciosDaBiblioteca';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Texto } from '../../ui/Texto';
import { UmaOpcao } from '../SeletoresDeFiltro';

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
  marca: { width: 8, height: 8, borderRadius: 4 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  // Marca e nome andam juntos: o item inteiro passa para a linha de baixo, nunca se parte.
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexShrink: 1 },
  detalhe: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  icones: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  icone: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
