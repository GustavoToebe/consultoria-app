import { MessageSquare } from 'lucide-react-native';
import { type RefObject, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarPlaylistsDoAluno } from '../api/comunidade';
import type { AulaDaComunidade } from '../api/comunidadeTipos';
import { CapaDoVideo } from '../comunidade/CapaDoVideo';
import { chaveDoGrupo, numerosNaColecao } from '../dominio/colecoesDoAluno';
import { agruparPorPlaylist, buscarAuloes, resumoDosAuloes } from '../dominio/comunidade';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { useSecoesAbertas } from '../ui/useSecoesAbertas';
import { useVoltarFechaColecao } from './useVoltarFechaColecao';

interface AcoesDoVideo {
  baixarCapa: (id: string) => Promise<Blob>;
  aoAbrirFora: (url: string) => void;
  aoComentarios: (aula: AulaDaComunidade) => void;
}

/**
 * Vídeos do aluno agrupados por coleção (passo 10 do `docs/planos/comunidade-playlists.md`): um cartão por coleção na ordem
 * do treinador, com o nome e "N vídeos"; "Sem coleção" por último e só se houver; coleção sem vídeo não aparece (D16). Os
 * cartões nascem fechados (uma coleção só nasce aberta, design 4.8) e, abertos, mostram os vídeos numerados pela posição na
 * coleção. A busca procura em todas, abre as que têm resultado e limpar volta ao de antes. O voltar (navegador e Android)
 * fecha as coleções abertas sem sair da Comunidade. Se `GET /aluno/comunidade/playlists` falhar, os vídeos aparecem numa
 * lista só, na ordem da API e sem número: agrupar sem as coleções poria tudo em "Sem coleção".
 */
export function ColecoesDeAuloes({ aulas, fecharRef, ...acoes }: {
  aulas: readonly AulaDaComunidade[];
  /** Com coleção aberta pelo toque, a função que a fecha (senão `null`): o pai fecha antes de trocar de aba. */
  fecharRef: RefObject<(() => void) | null>;
} & AcoesDoVideo) {
  const colecoes = useCarregar('auloes-colecoes', () => listarPlaylistsDoAluno());
  const playlists = colecoes.dados ?? [];
  const [busca, setBusca] = useState('');
  const termo = busca.trim();
  // Ids da lista INTEIRA (não a da busca): é o que a regra das seções pede. Só depois de as coleções chegarem: antes, tudo
  // seria "Sem coleção", a única seção, e ela nasceria aberta.
  const todos = agruparPorPlaylist(aulas, playlists);
  const secoes = useSecoesAbertas(colecoes.dados ? todos.map(chaveDoGrupo) : []);
  const grupos = agruparPorPlaylist(buscarAuloes(aulas, busca), playlists);
  const numeros = numerosNaColecao(aulas, playlists);
  const buscar = (texto: string) => {
    setBusca(texto);
    secoes.aoBuscar(texto.trim(), agruparPorPlaylist(buscarAuloes(aulas, texto), playlists).map(chaveDoGrupo));
  };

  // Coleção aberta pelo toque vira um passo do histórico (como a edição dos Dados do aluno): o voltar a fecha. Uma coleção
  // só já nasce aberta e a busca abre sozinha; nesses casos o voltar segue o caminho normal.
  const abertaPeloToque = colecoes.dados !== undefined && !termo && todos.length > 1 && todos.some((g) => secoes.estaAberta(chaveDoGrupo(g)));
  useVoltarFechaColecao(abertaPeloToque, secoes.fecharTodas);
  useEffect(() => {
    fecharRef.current = abertaPeloToque ? secoes.fecharTodas : null;
    return () => { fecharRef.current = null; };
  });

  const campoDeBusca = (
    <Campo rotulo="Buscar nos vídeos" valor={busca} aoMudar={buscar} placeholder="Palavra do título ou da descrição"
      autoCorrect={false} inputMode="search" />
  );
  const vazioDaBusca = <Vazio texto="Nenhum vídeo encontrado com essa busca." acao={{ rotulo: 'Limpar busca', aoTocar: () => buscar('') }} />;

  if (colecoes.erro) {
    const encontrados = buscarAuloes(aulas, busca);
    return (
      <View style={estilos.blocos}>
        <MensagemErro texto="Não foi possível carregar as coleções. Os vídeos aparecem abaixo, sem agrupar."
          erro={colecoes.erro} tentarDeNovo={colecoes.recarregar} />
        {campoDeBusca}
        {encontrados.length ? (
          <Cartao>
            {encontrados.map((a, i) => <VideoDaColecao key={a.id} aula={a} primeiro={i === 0} {...acoes} />)}
          </Cartao>
        ) : vazioDaBusca}
      </View>
    );
  }
  if (!colecoes.dados) return <Esqueleto />;

  return (
    <View style={estilos.blocos}>
      {campoDeBusca}
      {grupos.length === 0 ? vazioDaBusca : grupos.map((g) => {
        const chave = chaveDoGrupo(g);
        const aberta = secoes.estaAberta(chave);
        return (
          <Cartao key={chave} cabecalho={<CabecalhoDeGrupo titulo={g.rotulo} resumo={resumoDosAuloes(g.itens.length)}
            aberto={aberta} aoAlternar={() => secoes.alternar(chave)} />}>
            {aberta ? g.itens.map((a, i) => (
              <VideoDaColecao key={a.id} aula={a} primeiro={i === 0} numero={numeros.get(a.id)} {...acoes} />
            )) : null}
          </Cartao>
        );
      })}
    </View>
  );
}

/** Um vídeo da lista: "3. Título" (o número só dentro de uma coleção), descrição, a capa (player depois do toque) e os comentários. */
function VideoDaColecao({ aula: a, primeiro, numero, baixarCapa, aoAbrirFora, aoComentarios }: { aula: AulaDaComunidade; primeiro: boolean; numero?: number } & AcoesDoVideo) {
  const { cores } = useTema();
  return (
    // Itens separados por divisória, sem cartão dentro de cartão.
    <View style={[estilos.aula, !primeiro && { borderTopWidth: 1, borderTopColor: cores.divisor, paddingTop: espaco(2) }]}>
      <Texto variante="bloco" nivel={2}>{numero ? `${numero}. ${a.titulo}` : a.titulo}</Texto>
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
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(3) },
  aula: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  // Hover e pressionado pintam `superficie3` (`ui/sobre`), como nos comentários do mural.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1), alignSelf: 'flex-start' },
});
