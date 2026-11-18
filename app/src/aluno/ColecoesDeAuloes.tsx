import { MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AulaDaComunidade } from '../api/comunidadeTipos';
import { CapaDoVideo } from '../comunidade/CapaDoVideo';
import { buscarAuloes } from '../dominio/comunidade';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Vazio } from '../ui/Estados';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/**
 * Vídeos do aluno numa lista só, na ordem da API, com a busca local (título e descrição, sem acento). Sem rede nova: usa a
 * lista já carregada. O vídeo é a `CapaDoVideo` (a capa do treinador, o player só depois do toque e "Abrir no YouTube").
 * shortcut: lista simples desde a V088 (a categoria saiu); o passo 10 troca pelos cartões das coleções e a coleção aberta numerada.
 */
export function ColecoesDeAuloes({ aulas, baixarCapa, aoAbrirFora, aoComentarios }: {
  aulas: readonly AulaDaComunidade[];
  baixarCapa: (id: string) => Promise<Blob>;
  aoAbrirFora: (url: string) => void;
  aoComentarios: (aula: AulaDaComunidade) => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const encontrados = buscarAuloes(aulas, busca);

  return (
    <View style={estilos.blocos}>
      <Campo rotulo="Buscar nos vídeos" valor={busca} aoMudar={setBusca} placeholder="Palavra do título ou da descrição"
        autoCorrect={false} inputMode="search" />
      {encontrados.length ? (
        <Cartao>
          {encontrados.map((a, i) => (
            // Itens separados por divisória, sem cartão dentro de cartão.
            <View key={a.id} style={[estilos.aula, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor, paddingTop: espaco(2) }]}>
              <Texto variante="bloco" nivel={2}>{a.titulo}</Texto>
              {a.descricao ? <Texto>{a.descricao}</Texto> : null}
              <CapaDoVideo videoUrl={a.videoUrl} titulo={a.titulo} capaId={a.capaId ?? null} baixarCapa={baixarCapa} aoAbrirFora={aoAbrirFora} />
              <View style={estilos.linha}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver ${a.totalComentarios} comentário(s) do vídeo ${a.titulo}`}
                  onPress={() => aoComentarios(a)}
                  style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.sobre }]}>
                  <MessageSquare size={18} color={cores.texto} aria-hidden />
                  <Texto variante="suave" cor={cores.texto} numerico>{a.totalComentarios} comentário(s)</Texto>
                </Pressable>
              </View>
            </View>
          ))}
        </Cartao>
      ) : (
        <Vazio texto="Nenhum vídeo encontrado com essa busca." acao={{ rotulo: 'Limpar busca', aoTocar: () => setBusca('') }} />
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
