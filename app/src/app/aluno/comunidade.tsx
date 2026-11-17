import { router, useLocalSearchParams } from 'expo-router';
import { Award, Flag, Medal, Plus, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  baixarCapaDoAluno, baixarFotoDoColega, baixarFotoDoMuralDoAluno, listarAulasDoAluno, listarMinhasConquistas, listarMuralDoAluno,
  obterConfiguracaoDoAluno, obterMeuRanking, reagirComoAluno, votarComoAluno,
} from '../../api/comunidade';
import { ErroApi } from '../../api/cliente';
import type { AlvoDosComentarios, FiltrosDoMural, PostDoMural, TipoDePost } from '../../api/comunidadeTipos';
import { AvisoDoPerfilNaComunidade } from '../../aluno/AvisoDoPerfil';
import { ColecoesDeAuloes } from '../../aluno/ColecoesDeAuloes';
import { BarraDoMural } from '../../comunidade/BarraDoMural';
import { CartaoDoPost } from '../../comunidade/CartaoDoPost';
import { FolhaComentarios } from '../../comunidade/FolhaComentarios';
import { type AlvoDosVotos, FolhaDosVotos } from '../../comunidade/FolhaDosVotos';
import { FolhaNovaPublicacao } from '../../comunidade/FolhaNovaPublicacao';
import { FolhaPerfilDoColega } from '../../comunidade/FolhaPerfilDoColega';
import { ListaDeColegas } from '../../comunidade/ListaDeColegas';
import { PainelDeDenuncia } from '../../comunidade/PainelDeDenuncia';
import { useAcoesDoPost } from '../../comunidade/useAcoesDoPost';
import {
  type FiltroDoMural, filtrosParaApi, MURAL_SEM_FILTRO, podeAnexarFoto, ROTULO_DO_MURAL_GERAL, podePublicar, type RascunhoDoPost, textoDaPosicao,
  TIPO_PADRAO_DO_POST, tipoPedido,
} from '../../dominio/comunidade';
import {
  type AbaDoMural, ABAS_DO_MURAL, abaDoParametro, abaDoTipo, carregarMuralDaAba, filtroNaAba, PARAMETRO_DO_MEU_GRUPO, textoDoVazioDaAba, tiposParaBuscar, visaoDoParametro,
} from '../../dominio/muralEmAbas';
import { dataParaTela } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { FolhaDeAcoes } from '../../treinador/FolhaDeAcoes';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';

type AbaComunidade = 'mural' | 'auloes' | 'ranking' | 'colegas';
type VisaoDoMural = 'geral' | 'grupo';

/** Estado de uma fonte da tela: carregando, erro (com tentar de novo) ou vazio; `null` = mostrar os dados. */
function EstadoDaFonte({ carregando, erro, vazio, textoVazio, recarregar, acaoVazio }: {
  carregando: boolean; erro: unknown; vazio: boolean; textoVazio: string; recarregar: () => void;
  acaoVazio?: { rotulo: string; aoTocar: () => void };
}) {
  if (erro) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
  if (carregando && vazio) return <Esqueleto />;
  if (vazio) return <Vazio texto={textoVazio} acao={acaoVazio} />;
  return null;
}

const RASCUNHO_VAZIO: RascunhoDoPost = { tipo: TIPO_PADRAO_DO_POST, texto: '' };
const PREFIXO_DO_MURAL = 'mural-posts:';
// Fixados primeiro (a ordem da API se mantém dentro de cada grupo).
const fixadosPrimeiro = (posts: PostDoMural[]) => [...posts].sort((a, b) => Number(b.fixado) - Number(a.fixado));

/**
 * Comunidade do aluno: mural do time, aulões, conquistas, a própria posição no ranking e os colegas com perfil visível. Tudo vem da API e nada fica no aparelho:
 * sem conexão a tela só avisa. O apelido aparece ao lado do nome do autor; tocar num autor que é aluno abre o perfil dele.
 */
export default function ComunidadeAluno() {
  const { cores } = useTema();
  const { online } = useAluno();
  const { avisar } = useAviso();
  const { usuario } = useSessao();
  const params = useLocalSearchParams<{ aba?: string; mural?: string; grupo?: string; publicar?: string; texto?: string }>();
  // A aba mora no endereço (`?aba=`). `setParams` mantém a tela montada (o rascunho fica) e preserva os outros parâmetros.
  const aba: AbaComunidade = params.aba === 'auloes' || params.aba === 'ranking' || params.aba === 'colegas' ? params.aba : 'mural';
  const setAba = (valor: AbaComunidade) => { if (valor !== aba) router.setParams({ aba: valor }); };

  // Avisos ou Alunos (C39) no endereço (`?mural=`; desconhecido = Avisos). As abas valem dentro do Geral e do Meu grupo.
  const abaDoMural = abaDoParametro(params.mural);
  const setAbaDoMural = (valor: AbaDoMural) => { if (valor !== abaDoMural) router.setParams({ mural: valor }); };
  const [filtroPedidoDoMural, setFiltro] = useState<FiltroDoMural>(MURAL_SEM_FILTRO);
  // O tipo de outra aba não vale aqui (o chip some e volta com a aba dele), sem estado a corrigir.
  const filtro = filtroNaAba(filtroPedidoDoMural, abaDoMural);
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  // Quem publica, se anexa foto e o grupo (pod) do aluno: a API decide e o app só segue (sem a configuração, o formulário não aparece).
  const config = useCarregar(online ? 'mural-configuracao' : null, () => obterConfiguracaoDoAluno());
  const publica = podePublicar(config.dados);
  // "Meu grupo" mora no endereço (`?grupo=meu`) e só vale com o pod que a API mandou; sem pod, fica o Geral e não há seletor.
  const pod = config.dados?.pod ?? null;
  const esperandoOGrupo = params.grupo === PARAMETRO_DO_MEU_GRUPO && config.dados === undefined && !config.erro;
  const visao: VisaoDoMural = visaoDoParametro(params.grupo, !!pod);
  const setVisao = (valor: VisaoDoMural) => { if (valor !== visao) router.setParams({ grupo: valor === 'grupo' ? PARAMETRO_DO_MEU_GRUPO : undefined }); };
  const podDoMural = visao === 'grupo' ? pod : null;
  // A chave leva os tipos que a aba pede: trocar de aba ou de chip busca de novo, e a resposta de outra aba não entra.
  const chaveDoMural = online && !esperandoOGrupo
    ? `${PREFIXO_DO_MURAL}${JSON.stringify({ tipos: tiposParaBuscar(filtro, abaDoMural), filtros: filtrosParaApi(filtro, buscaAtrasada, podDoMural?.id) })}` : null;
  const mural = useCarregar(chaveDoMural, async (c) => {
    const pedido: { tipos: TipoDePost[]; filtros: FiltrosDoMural } = JSON.parse(c.slice(PREFIXO_DO_MURAL.length));
    try {
      return await carregarMuralDaAba(listarMuralDoAluno, pedido.filtros, pedido.tipos);
    } catch (e) {
      // 404 no grupo: a equipe tirou o aluno do pod depois de a tela abrir. Volta ao Geral e pergunta de novo qual é o grupo.
      if (pedido.filtros.podId && e instanceof ErroApi && e.status === 404) {
        router.setParams({ grupo: undefined });
        config.recarregar();
        avisar('Você não está mais nesse grupo. Mostrando o mural Geral.', 'neutro');
      }
      throw e;
    }
  });
  const posts = mural.dadosDeOutraChave ? undefined : mural.dados?.content;
  const [rascunho, setRascunho] = useState<RascunhoDoPost>(RASCUNHO_VAZIO);
  const [compondo, setCompondo] = useState(false);
  const [menuDe, setMenuDe] = useState<PostDoMural | null>(null);
  const [denunciar, setDenunciar] = useState<PostDoMural | null>(null);

  // C11: o "Bom trabalho!" manda `?publicar=RESULTADO&texto=`. Abre a publicação com o texto pronto e editável e tira os
  // parâmetros do endereço na hora (voltar não reabre); nunca publica sozinho. Com a chave desligada, fica a frase neutra.
  useEffect(() => {
    if (params.publicar === undefined && params.texto === undefined) return undefined;
    const tipo = tipoPedido(params.publicar, 'aluno');
    const texto = params.texto ?? '';
    let vivo = true;
    void Promise.resolve().then(() => {
      if (!vivo) return;
      if (tipo) { setRascunho({ tipo, texto }); setCompondo(true); }
      // Atrás da folha, o mural na aba onde o post vai aparecer.
      router.setParams({ publicar: undefined, texto: undefined, ...(tipo ? { aba: undefined, mural: abaDoTipo(tipo) } : {}) });
    });
    return () => { vivo = false; };
  }, [params.publicar, params.texto]);
  // Autor (usuário) cujo perfil está aberto na folha; `null` = fechada.
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);
  // Post ou aula cujos comentários estão abertos; a folha fica aberta sem internet (o campo trava com o motivo).
  const [comentariosDe, setComentariosDe] = useState<AlvoDosComentarios | null>(null);
  const auloes = useCarregar(online ? 'auloes-lista' : null, () => listarAulasDoAluno());
  const ranking = useCarregar(online ? 'ranking-lista' : null, () => obterMeuRanking());
  const conquistas = useCarregar(online ? 'conquistas-lista' : null, () => listarMinhasConquistas());

  const publicado = (podId: string | null) => {
    // O post do aluno mora na aba Alunos: publicando de Avisos, a tela segue para lá, senão ele "some" logo depois do aviso.
    const abaDoPost = abaDoTipo(rascunho.tipo);
    setRascunho(RASCUNHO_VAZIO);
    setCompondo(false);
    avisar(podId && podDoMural ? `Publicado no grupo ${podDoMural.nome}.` : 'Publicado no mural.', 'sucesso');
    if (abaDoPost !== abaDoMural) setAbaDoMural(abaDoPost);
    else mural.recarregar();
  };

  const acoes = useAcoesDoPost({ mural, chave: chaveDoMural, reagir: reagirComoAluno, votar: votarComoAluno });
  const [votosDe, setVotosDe] = useState<AlvoDosVotos>(null);

  const abrir = async (url: string | null | undefined) => {
    if (!(await abrirLinkExterno(url))) avisar('Não foi possível abrir o link.', 'perigo');
  };

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Comunidade" subtitulo="Mural do time, aulões, conquistas e colegas da sua consultoria." />
      <AvisoDoPerfilNaComunidade online={online} />

      {!online ? (
        <Cartao>
          <Vazio Icone={WifiOff} texto="Sem conexão. O mural, os aulões, as conquistas e os colegas aparecem quando o aparelho voltar a ter internet." />
        </Cartao>
      ) : (
        <>
          <Abas<AbaComunidade>
            ativa={aba}
            aoMudar={setAba}
            abas={[
              { valor: 'mural', rotulo: 'Mural' },
              { valor: 'auloes', rotulo: 'Aulões' },
              { valor: 'ranking', rotulo: 'Conquistas' },
              { valor: 'colegas', rotulo: 'Colegas' },
            ]}
          />

          {aba === 'mural' ? (
            <View style={estilos.blocos}>
              {/* O grupo escolhe qual mural se vê; a publicação nova vai para o mesmo (o aluno nunca vê quem está no grupo). */}
              {pod || (config.dados && publica) ? (
                <View style={estilos.topoDoMural}>
                  {pod ? (
                    <Escolha<VisaoDoMural> descricao="Qual mural" valor={visao} aoMudar={setVisao}
                      opcoes={[{ valor: 'geral', rotulo: ROTULO_DO_MURAL_GERAL }, { valor: 'grupo', rotulo: 'Meu grupo' }]} />
                  ) : <View />}
                  {config.dados && publica ? (
                    <Botao rotulo="Nova publicação" tipo="primario" Icone={Plus} aoTocar={() => setCompondo(true)} />
                  ) : null}
                </View>
              ) : null}
              {/* O nome (até 40) fica no texto, que quebra a linha; no segmento ele cortaria em 390 px. */}
              {podDoMural ? <Texto variante="suave">{`Grupo ${podDoMural.nome}: só quem está nele vê estas publicações.`}</Texto> : null}
              {config.erro ? (
                <MensagemErro texto={textoDoErro(config.erro)} erro={config.erro} tentarDeNovo={config.recarregar} />
              ) : config.dados && publica ? null : config.dados ? (
                <Texto variante="suave">No momento, só a equipe publica no mural. Você pode reagir, votar nas enquetes e comentar.</Texto>
              ) : null}

              {/* Avisos | Alunos (C39) numa linha própria, depois do grupo (o escopo): o segmento na largura toda lê como a
                  divisão do conteúdo e não espreme a linha do grupo com o botão em 390 px. */}
              <Escolha<AbaDoMural> descricao="Publicações" distribuida valor={abaDoMural} aoMudar={setAbaDoMural} opcoes={[...ABAS_DO_MURAL]} />
              <BarraDoMural aba={abaDoMural} filtro={filtro} aoFiltrar={setFiltro} busca={busca} aoBuscar={setBusca} comDenunciados={false} />

              <EstadoDaFonte carregando={mural.carregando} erro={mural.erro} vazio={!posts?.length}
                textoVazio={textoDoVazioDaAba(abaDoMural, filtro, busca, podDoMural?.nome)}
                recarregar={mural.recarregar}
                acaoVazio={filtro.tipo ? { rotulo: 'Limpar filtros', aoTocar: () => setFiltro(MURAL_SEM_FILTRO) } : busca.trim() ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') }
                  // Avisos vazio (a aba padrão) não é beco: o próximo passo é a outra aba.
                  : abaDoMural === 'avisos' ? { rotulo: 'Ver publicações dos alunos', aoTocar: () => setAbaDoMural('alunos') } : undefined} />

              {posts ? fixadosPrimeiro(posts).map((p) => (
                <CartaoDoPost
                  key={p.id}
                  post={p}
                  baixarFoto={baixarFotoDoMuralDoAluno}
                  aoAbrirPerfil={p.autorEhAluno ? () => setPerfilAberto(p.autorId) : undefined}
                  baixarCapa={baixarCapaDoAluno}
                  aoReagir={(codigo, ligar) => acoes.aoReagir?.(p.id, codigo, ligar)}
                  aoVotar={(ids) => acoes.aoVotar?.(p.id, ids)}
                  ocupado={acoes.ocupados.has(p.id)}
                  aoMostrarVotos={() => setVotosDe({ postId: p.id })}
                  baixarFotoDoVotante={baixarFotoDoColega}
                  aoComentarios={() => setComentariosDe({ tipo: 'post', id: p.id })}
                  // O próprio post não tem ação para o aluno: denunciar é só de post de outra pessoa.
                  aoAbrirMenu={p.autorId !== usuario?.id ? () => setMenuDe(p) : undefined}
                  aoAbrirFora={(url) => void abrir(url)}
                />
              )) : null}
            </View>
          ) : null}

          {aba === 'auloes' ? (
            <View style={estilos.blocos}>
              <EstadoDaFonte carregando={auloes.carregando} erro={auloes.erro} vazio={!auloes.dados?.length}
                textoVazio="Nenhum aulão por enquanto." recarregar={auloes.recarregar} />
              {auloes.dados?.length ? (
                <ColecoesDeAuloes aulas={auloes.dados} baixarCapa={baixarCapaDoAluno} aoAbrirFora={(url) => void abrir(url)}
                  aoComentarios={(a) => setComentariosDe({ tipo: 'aula', id: a.id })} />
              ) : null}
            </View>
          ) : null}

          {aba === 'ranking' ? (
            <View style={estilos.blocos}>
              <Cartao titulo="Suas conquistas" descricao="Liberadas conforme você conclui treinos.">
                <EstadoDaFonte carregando={conquistas.carregando} erro={conquistas.erro} vazio={!conquistas.dados?.length}
                  textoVazio="Nenhuma conquista por enquanto." recarregar={conquistas.recarregar} />
                {conquistas.dados?.length ? (
                  <View style={estilos.grade}>
                    {conquistas.dados.map((c) => (
                      <View key={c.id} style={[estilos.item, estilos.conquista, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
                        <Award size={24} color={cores.texto} aria-hidden />
                        <Texto variante="bloco" nivel={3} style={estilos.centro}>{c.titulo}</Texto>
                        <Texto variante="suave" style={estilos.centro}>{c.descricao}</Texto>
                        <View style={estilos.seloCentral}>
                          <Selo texto="Conquistada" tipo="neutro" />
                        </View>
                        <Texto variante="pequeno" cor={cores.textoSuave} numerico style={estilos.centro}>{dataParaTela(c.conquistadaEm)}</Texto>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Cartao>

              <Cartao titulo="Sua posição" descricao="Pelo número de treinos concluídos. Só você vê a sua posição; nomes de outros alunos não aparecem.">
                <EstadoDaFonte carregando={ranking.carregando} erro={ranking.erro} vazio={!ranking.dados}
                  textoVazio="A sua posição ainda não está disponível." recarregar={ranking.recarregar} />
                {ranking.dados ? (
                  <View style={[estilos.item, estilos.linha, { backgroundColor: cores.superficie3, borderColor: cores.borda }]}>
                    <Medal size={24} color={cores.texto} aria-hidden />
                    <View style={estilos.encolher}>
                      <Texto variante="bloco" numerico>{textoDaPosicao(ranking.dados.posicao, ranking.dados.participantes)}</Texto>
                      <Texto variante="suave" numerico>
                        {ranking.dados.treinosConcluidos} treino(s) concluído(s) · {ranking.dados.pontuacao} pts
                      </Texto>
                    </View>
                  </View>
                ) : null}
              </Cartao>
            </View>
          ) : null}

          {aba === 'colegas' ? <ListaDeColegas aoAbrir={setPerfilAberto} /> : null}
        </>
      )}
      <FolhaPerfilDoColega autorId={perfilAberto} online={online} aoFechar={() => setPerfilAberto(null)} />
      <FolhaComentarios alvo={comentariosDe} modo={{ tipo: 'aluno', online }} aoFechar={() => setComentariosDe(null)}
        aoAlterar={comentariosDe?.tipo === 'aula' ? auloes.recarregar : mural.recarregar} />
      <FolhaDosVotos alvo={votosDe} papel="aluno" aoFechar={() => setVotosDe(null)} />
      <FolhaNovaPublicacao visivel={compondo && publica} papel="aluno" rascunho={rascunho} aoMudar={setRascunho}
        comFotos={podeAnexarFoto(config.dados)} online={online} aoFechar={() => setCompondo(false)} aoPublicar={publicado}
        destino={pod ? { podId: podDoMural?.id ?? null, rotulo: podDoMural?.nome ?? ROTULO_DO_MURAL_GERAL } : undefined} />
      {menuDe ? (
        <FolhaDeAcoes titulo="Ações da publicação" aoFechar={() => setMenuDe(null)}
          acoes={[{ rotulo: 'Denunciar', detalhe: 'A equipe da consultoria vai olhar.', Icone: Flag, perigo: true, aoTocar: () => setDenunciar(menuDe) }]} />
      ) : null}
      <PainelDeDenuncia post={denunciar} aoFechar={() => setDenunciar(null)} aoSumir={mural.recarregar} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 16 px dentro do cartão e do item.
  blocos: { gap: espaco(3) },
  // Seletor do mural à esquerda e a ação principal à direita; no celular estreito, o botão desce para a linha de baixo.
  topoDoMural: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(2) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  encolher: { flex: 1, minWidth: 0, gap: 2 },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  conquista: { flexGrow: 1, flexBasis: 150, alignItems: 'center', gap: espaco(1) },
  centro: { textAlign: 'center' },
  // O Selo se alinha ao início por conta própria; a linha o centraliza no cartão da conquista.
  seloCentral: { flexDirection: 'row', justifyContent: 'center', alignSelf: 'stretch' },
});
