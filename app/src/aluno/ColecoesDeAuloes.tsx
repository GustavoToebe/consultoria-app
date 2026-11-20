import { type RefObject, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarPlaylistsDoAluno } from '../api/comunidade';
import type { AulaDaComunidade } from '../api/comunidadeTipos';
import { CartaoDoVideo } from '../comunidade/CartaoDoVideo';
import { chaveDoGrupo, numerosNaColecao } from '../dominio/colecoesDoAluno';
import { agruparPorPlaylist, buscarAuloes, resumoDosAuloes } from '../dominio/comunidade';
import { colunasDosVideos } from '../dominio/gradeDosVideos';
import { espaco } from '../tema/tokens';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { Grade } from '../ui/Grade';
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
 * coleção, no número do selo da capa. Os vídeos são os cartões da grade do treinador (D6, 20/11), sem ⋯ nem alça: o "Abrir no
 * YouTube" (ou "Abrir vídeo") fica visível no cartão. A grade usa a régua do treinador (`colunasDosVideos`) medida na própria
 * grade: com a tela do aluno em 720 px, 1 coluna no celular e 2 no PC. A busca procura em todas, abre as que têm resultado e
 * limpar volta ao de antes. O voltar (navegador e Android) fecha as coleções abertas sem sair da Comunidade. Se
 * `GET /aluno/comunidade/playlists` falhar, os vídeos aparecem numa grade só, na ordem da API e sem número: agrupar sem as
 * coleções poria tudo em "Sem coleção".
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
          <GradeDeVideos aulas={encontrados} {...acoes} />
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
            {aberta ? <GradeDeVideos aulas={g.itens} numeros={numeros} {...acoes} /> : null}
          </Cartao>
        );
      })}
    </View>
  );
}

/** Os cartões de vídeo; o número (posição na coleção) só dentro de uma coleção, nunca em "Sem coleção" nem sem agrupar. */
function GradeDeVideos({ aulas, numeros, baixarCapa, aoAbrirFora, aoComentarios }: {
  aulas: readonly AulaDaComunidade[];
  numeros?: ReadonlyMap<string, number>;
} & AcoesDoVideo) {
  return (
    <Grade gap={espaco(2)} colunas={colunasDosVideos}>
      {aulas.map((a) => (
        // h2: o cabeçalho da coleção é botão, não título.
        <CartaoDoVideo key={a.id} aula={a} numero={numeros?.get(a.id)} nivel={2} baixarCapa={baixarCapa} aoAbrirFora={aoAbrirFora}
          aoComentarios={() => aoComentarios(a)} />
      ))}
    </Grade>
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(3) },
});
