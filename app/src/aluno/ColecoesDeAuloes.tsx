import { MessageSquare, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AulaDaComunidade } from '../api/comunidadeTipos';
import { agruparAuloesPorCategoria, buscarAuloes, resumoDosAuloes } from '../dominio/comunidade';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Vazio } from '../ui/Estados';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/** Chave da coleção no conjunto das recolhidas; `''` = "Sem categoria". */
const chave = (categoria: string | null) => categoria ?? '';

/**
 * Aulões do aluno em coleções por categoria (como as coleções do Planejamento): um cartão por categoria com
 * `CabecalhoDeGrupo` recolhível, ordem alfabética e "Sem categoria" por último; dentro, a ordem da API. A busca é local
 * (título e descrição, sem acento), procura em todas as coleções e reabre as recolhidas. Sem rede nova: usa a lista já
 * carregada.
 */
export function ColecoesDeAuloes({ aulas, aoAssistir, aoComentarios }: {
  aulas: readonly AulaDaComunidade[];
  aoAssistir: (url: string | null) => void;
  aoComentarios: (aula: AulaDaComunidade) => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(new Set());
  const buscar = (texto: string) => {
    setBusca(texto);
    if (texto.trim()) setRecolhidas(new Set());
  };
  const alternar = (c: string) => setRecolhidas((atual) => {
    const nova = new Set(atual);
    if (!nova.delete(c)) nova.add(c);
    return nova;
  });
  const colecoes = agruparAuloesPorCategoria(buscarAuloes(aulas, busca));

  return (
    <View style={estilos.blocos}>
      <Campo rotulo="Buscar nos aulões" valor={busca} aoMudar={buscar} placeholder="Palavra do título ou da descrição"
        autoCorrect={false} inputMode="search" />
      {colecoes.length ? colecoes.map((g) => {
        const aberto = !recolhidas.has(chave(g.categoria));
        return (
          <Cartao key={chave(g.categoria)}
            cabecalho={<CabecalhoDeGrupo titulo={g.rotulo} resumo={resumoDosAuloes(g.itens.length)} aberto={aberto}
              aoAlternar={() => alternar(chave(g.categoria))} acoesJuntas />}>
            {aberto ? g.itens.map((a, i) => (
              // Itens separados por divisória, sem cartão dentro de cartão; o selo da categoria sai (a coleção já diz).
              <View key={a.id} style={[estilos.aula, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor, paddingTop: espaco(2) }]}>
                <Texto variante="bloco" nivel={2}>{a.titulo}</Texto>
                {a.descricao ? <Texto>{a.descricao}</Texto> : null}
                {a.videoUrl ? (
                  <LinhaDeAcoes>
                    <Botao rotulo="Assistir ao aulão" tipo="secundario" Icone={Video} aoTocar={() => aoAssistir(a.videoUrl)} />
                  </LinhaDeAcoes>
                ) : null}
                <View style={estilos.linha}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ver ${a.totalComentarios} comentário(s) do aulão ${a.titulo}`}
                    onPress={() => aoComentarios(a)}
                    style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
                    <MessageSquare size={18} color={cores.texto} aria-hidden />
                    <Texto variante="suave" cor={cores.texto} numerico>{a.totalComentarios} comentário(s)</Texto>
                  </Pressable>
                </View>
              </View>
            )) : null}
          </Cartao>
        );
      }) : (
        <Vazio texto="Nenhum aulão encontrado com essa busca." acao={{ rotulo: 'Limpar busca', aoTocar: () => setBusca('') }} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(3) },
  aula: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  // Hover e pressionado pintam `superficie3` (`ui/sobre`), como nos comentários do mural.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1), alignSelf: 'flex-start' },
});
