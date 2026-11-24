import { Fragment, type RefObject, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarPlaylistsDoAluno } from '../api/comunidade';
import type { AulaDaComunidade } from '../api/comunidadeTipos';
import { CabecalhoDaColecao, FioEntreColecoes, VAO_DO_CABECALHO } from '../comunidade/CabecalhoDaColecao';
import { CartaoDoVideo } from '../comunidade/CartaoDoVideo';
import { numerosDasColecoes, textosDoCabecalho } from '../dominio/cabecalhoDaColecao';
import { chaveDoGrupo, numerosNaColecao } from '../dominio/colecoesDoAluno';
import { agruparPorPlaylist, buscarAuloes } from '../dominio/comunidade';
import { colunasDosVideos } from '../dominio/gradeDosVideos';
import { espaco, LARGURA_FORMULARIO } from '../tema/tokens';
import { Campo } from '../ui/Campo';
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
 * Vídeos do aluno agrupados por coleção (passo 10 do `docs/planos/comunidade-playlists.md`): uma seção por coleção na ordem
 * do treinador, sem cartão em volta, com o mesmo cabeçalho do treinador (cabeçalho de coleção, 23/11: "COLEÇÃO N", nome e
 * pílula "N vídeos", o fio acima das seguintes), que aqui é o botão de abrir e fechar; "Sem coleção" por último e só se
 * houver; coleção sem vídeo não aparece (D16). As
 * seções nascem fechadas (uma coleção só nasce aberta, design 4.8) e, abertas, mostram os vídeos numerados pela posição na
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

  // O campo não estica com a tela (4.10): fica na largura de formulário.
  const campoDeBusca = (
    <View style={estilos.busca}>
      <Campo rotulo="Buscar nos vídeos" valor={busca} aoMudar={buscar} placeholder="Palavra do título ou da descrição"
        autoCorrect={false} inputMode="search" />
    </View>
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

  // "Coleção N" pela ordem das coleções que o aluno vê, sem a busca (a busca não renumera).
  const numerosDasSecoes = numerosDasColecoes(todos.flatMap((g) => (g.playlist ? [g.playlist] : [])));
  return (
    <View style={estilos.blocos}>
      {campoDeBusca}
      {grupos.length === 0 ? vazioDaBusca : (
        <View>
          {grupos.map((g, i) => {
            const chave = chaveDoGrupo(g);
            const aberta = secoes.estaAberta(chave);
            return (
              <Fragment key={chave}>
                {i > 0 ? <FioEntreColecoes /> : null}
                <View style={estilos.secao}>
                  <CabecalhoDaColecao textos={textosDoCabecalho(g, numerosDasSecoes)} alternar={{ aberta, aoAlternar: () => secoes.alternar(chave) }} />
                  {aberta ? <GradeDeVideos aulas={g.itens} numeros={numeros} nivel={3} {...acoes} /> : null}
                </View>
              </Fragment>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Os cartões de vídeo; o número (posição na coleção) só dentro de uma coleção, nunca em "Sem coleção" nem sem agrupar. */
function GradeDeVideos({ aulas, numeros, nivel = 2, baixarCapa, aoAbrirFora, aoComentarios }: {
  aulas: readonly AulaDaComunidade[];
  numeros?: ReadonlyMap<string, number>;
  /** h3 dentro da coleção (o cabeçalho dela é o h2); h2 na grade sem agrupar. */
  nivel?: 2 | 3;
} & AcoesDoVideo) {
  return (
    <Grade gap={espaco(2)} colunas={colunasDosVideos}>
      {aulas.map((a) => (
        <CartaoDoVideo key={a.id} aula={a} numero={numeros?.get(a.id)} nivel={nivel} baixarCapa={baixarCapa} aoAbrirFora={aoAbrirFora}
          aoComentarios={() => aoComentarios(a)} />
      ))}
    </Grade>
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(3) },
  busca: { maxWidth: LARGURA_FORMULARIO },
  secao: { gap: VAO_DO_CABECALHO },
});
