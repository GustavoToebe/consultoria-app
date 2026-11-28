import { Permitido } from '../../ui/Permitido';
import { Ellipsis, Merge, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { inativarExercicio, listarExercicios, listarExerciciosPagina, TAMANHO_DA_PAGINA_DE_EXERCICIOS } from '../../api/rotas';
import type { Exercicio } from '../../api/tipos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { ListaEmColunas } from '../ListaEmColunas';
import { espaco, LARGURA_FOLHA_LARGA } from '../../tema/tokens';
import { comContagemDasModalidades } from '../../dominio/painelDeExercicios';
import { gruposDaConsulta, marcadosExistentes } from '../../dominio/selecaoMultiplaSuspensa';
import {
  chipsDosExercicios, coincideComABusca, contagemDosGrupos, midiaParaApi, modalidadesExistentes, opcoesDeModalidade,
  ORDEM_DAS_MODALIDADES, passaNosFiltros, rotuloDoMostrar, SEM_FILTROS_DE_EXERCICIOS, semOFiltro, type FiltrosDeExercicios,
} from '../../dominio/exerciciosDaBiblioteca';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { LegendaDasModalidades, LinhaDoExercicio, PainelDeExercicios } from './ModalidadeDoExercicio';
import { FolhaOrganizarGruposMusculares } from './FolhaOrganizarGruposMusculares';
import { ImportarDePlanilha } from './ImportarDePlanilha';
import { FolhaExercicio } from './FolhaExercicio';

const estilos = StyleSheet.create({
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  // Mesma composição da `FolhaAlimento`: um cartão com faixa de título por assunto, 24 px entre eles.
  partes: { gap: espaco(3) },
});

/** Exercícios da consultoria: lista, novo/editar (com vídeo) e inativar (planos já montados guardam a cópia). */
export function AbaExercicios() {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosDeExercicios>(SEM_FILTROS_DE_EXERCICIOS);
  const buscaAtrasada = useAtrasado(busca.trim());
  // Os grupos da última resposta: a consulta só leva os marcados que ainda existem (senão "Todos os grupos" na tela e 0 no servidor).
  const [gruposConhecidos, setGruposConhecidos] = useState<string[]>([]);
  const gruposEscolhidos = gruposDaConsulta(filtros.grupos, gruposConhecidos);
  // Modalidades marcadas, na ordem da tela (chave estável). Sempre vão à consulta, mesmo a que sumiu da biblioteca: o chip
  // continua lá e "Limpar filtros" resolve, em vez de a lista voltar inteira com a caixa marcada.
  const modalidadesEscolhidas = ORDEM_DAS_MODALIDADES.filter((m) => filtros.modalidades.has(m));
  const video = midiaParaApi(filtros.video);
  const imagem = midiaParaApi(filtros.imagem);
  // Chave própria da página: a 'biblioteca-exercicios' é da lista inteira, usada em outras telas.
  const chave = JSON.stringify(['biblioteca-exercicios-pagina', pagina, buscaAtrasada, gruposEscolhidos, modalidadesEscolhidas, video, imagem]);
  const { dados, erro, carregando, recarregar } = useCarregar(chave, () =>
    listarExerciciosPagina({ texto: buscaAtrasada, grupos: gruposEscolhidos, modalidades: modalidadesEscolhidas, video, imagem, pagina }));
  const [editando, setEditando] = useState<Exercicio | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Exercicio | null>(null);
  // Guardar a lista de grupos da resposta durante o render (não em efeito): a próxima consulta já sai com os grupos certos.
  if (dados && dados.grupos !== gruposConhecidos) setGruposConhecidos(dados.grupos);
  const grupos = dados?.grupos ?? gruposConhecidos;
  const opcoesDeGrupo = grupos.map((g) => ({ valor: g, rotulo: g }));
  // Grupo que já não existe (o último exercício dele saiu) não filtra: sem isso a lista ficaria vazia sem explicação.
  const gruposAtivos = marcadosExistentes(opcoesDeGrupo, filtros.grupos);
  const aplicados = { ...filtros, grupos: gruposAtivos };
  const chips = chipsDosExercicios(aplicados, opcoesDeGrupo);
  const lista = dados?.itens ?? [];
  const opcoesDeModalidades = opcoesDeModalidade(dados?.modalidades ?? [], filtros.modalidades);
  const total = dados?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA_DE_EXERCICIOS));
  const semFiltro = !buscaAtrasada && chips.length === 0;
  // A lista inteira (a mesma chave das outras telas) só quando alguém abre os filtros: dá a contagem de cada grupo e o
  // "Mostrar N exercícios". Sem ela (carregando ou com erro) os chips ficam só com o nome e o botão sem número.
  const [querContagem, setQuerContagem] = useState(false);
  const listaInteira = useCarregar(querContagem ? 'biblioteca-exercicios' : null, () => listarExercicios());
  const todos = listaInteira.dados;
  // Cada abertura depois da primeira busca de novo: salvar, criar ou tirar um exercício muda as contagens.
  const abrirPainel = () => { if (querContagem) listaInteira.recarregar(); else setQuerContagem(true); };
  const gruposDoPainel = todos ? contagemDosGrupos(todos) : opcoesDeGrupo;
  // Busca só em nome e grupo, como o servidor (`ExpansorTermosExercicio.casou`; sem o equipamento).
  // shortcut: a tradução dos termos em inglês do app (`coincideComBuscaExercicio`) pode diferir da do servidor num termo raro; trocar pelo `total` de uma consulta da API se divergir na prática.
  const mostrar = (f: FiltrosDeExercicios) => rotuloDoMostrar(todos ? todos.filter((e) => passaNosFiltros(e, f) && coincideComABusca({ ...e, equipamento: null }, buscaAtrasada)).length : null);
  // ⋯ da aba: "Organizar grupos musculares" usa a mesma lista inteira (abrir recarrega, como o painel de filtros) e,
  // depois de unir, a página e as contagens dos filtros são refeitas.
  const [menu, setMenu] = useState(false);
  const [organizar, setOrganizar] = useState(false);
  const gruposUnidos = () => { recarregar(); listaInteira.recarregar(); };
  // A folha do exercício usa a mesma lista inteira (nomes e contagens dos seletores): abrir só a pede se ainda não veio.
  const editar = (alvo: Exercicio | 'novo') => { setQuerContagem(true); setEditando(alvo); };
  const mudarBusca = (texto: string) => { setBusca(texto); setPagina(0); };
  // Todos os filtros vão à API: trocar qualquer um volta à primeira página.
  const mudarFiltros = (novos: FiltrosDeExercicios) => { setFiltros(novos); setPagina(0); };

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarExercicio(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        // Tirou o único da última página: volta uma página, em vez de abrir uma vazia.
        if (pagina > 0 && lista.length === 1) setPagina(pagina - 1);
        else recarregar();
        listaInteira.recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <Cartao
      titulo="Exercícios da biblioteca"
      descricao="Os exercícios que você escolhe ao montar o treino, com vídeo quando houver."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR">
        <Botao rotulo="Novo exercício" Icone={Plus} aoTocar={() => editar('novo')} />
        <IconeBotao Icone={Ellipsis} moldura rotulo="Ações dos exercícios" aoTocar={() => setMenu(true)} />
      </Permitido>}>
      <BarraDeFiltros busca={{ rotulo: 'Buscar exercício', placeholder: 'Nome ou grupo', valor: busca, aoMudar: mudarBusca }}
        valor={aplicados} aoAplicar={mudarFiltros} limpo={SEM_FILTROS_DE_EXERCICIOS} chips={chips}
        aoTirar={(chave) => mudarFiltros(semOFiltro(aplicados, chave))} painelLateral={{ titulo: 'Filtros de exercícios', largura: LARGURA_FOLHA_LARGA }}
        aoAbrirPainel={abrirPainel} rotuloDoAplicar={mostrar}
        seletores={(atual, mudar) => <PainelDeExercicios atual={atual} mudar={mudar} grupos={gruposDoPainel} opcoesDeModalidades={comContagemDasModalidades(opcoesDeModalidades, todos)} />} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && total === 0 ? (
        <>
        <Vazio titulo={!semFiltro ? 'Nenhum exercício encontrado' : 'Biblioteca de exercícios vazia'} texto={!semFiltro ? 'Tente outro termo de busca ou outros filtros.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um exercício.' : 'Ainda não há itens cadastrados.'} acao={chips.length > 0 ? { rotulo: 'Limpar filtros', aoTocar: () => mudarFiltros(SEM_FILTROS_DE_EXERCICIOS) } : !semFiltro ? { rotulo: 'Limpar busca', aoTocar: () => mudarBusca('') } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar exercício', aoTocar: () => editar('novo') } : undefined} />
        {/* Só a biblioteca realmente vazia: busca ou filtro sem resultado leva a limpar, não a importar. */}
        {semFiltro ? <ImportarDePlanilha destino="exercicios" /> : null}
        </>
      ) : null}
      {lista.length ? <LegendaDasModalidades modalidades={modalidadesExistentes(lista)} /> : null}
      {lista.length ? <ListaEmColunas divisorias>{lista.map((e) => (
        <LinhaDoExercicio key={e.id} exercicio={e} ampliavel
          acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} moldura rotulo={`Editar ${e.nome}`} aoTocar={() => editar(e)} /></Permitido>} />
      ))}</ListaEmColunas> : null}
      {total > TAMANHO_DA_PAGINA_DE_EXERCICIOS ? (
        <View style={estilos.paginacao}>
          <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
          <Texto variante="suave">Página {pagina + 1} de {paginas} · {total} exercícios</Texto>
          <Botao rotulo="Próxima" tipo="secundario" desabilitado={pagina + 1 >= paginas} aoTocar={() => setPagina(pagina + 1)} />
        </View>
      ) : null}
      {editando ? (
        <FolhaExercicio
          inicial={editando === 'novo' ? null : editando}
          aoTirar={editando === 'novo' ? undefined : () => { const alvo = editando; setEditando(null); setInativar(alvo); }}
          aoFechar={() => setEditando(null)}
          aoImagemMudou={recarregar}
          todos={todos} erroDaBiblioteca={listaInteira.erro}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            // Um grupo ou equipamento novo muda as contagens da próxima abertura.
            listaInteira.recarregar();
            avisar('Exercício salvo.', 'sucesso');
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={inativar !== null}
        titulo={`Tirar “${inativar?.nome ?? ''}” da biblioteca?`}
        mensagem="Os planos que já usam este exercício continuam com ele. Ele só deixa de aparecer para novos planos."
        rotuloConfirmar="Tirar da biblioteca"
        perigo
        aoConfirmar={confirmarInativar}
        aoCancelar={() => setInativar(null)}
      />
      {menu ? (
        <FolhaDeAcoes titulo="Ações dos exercícios" aoFechar={() => setMenu(false)} acoes={[{
          rotulo: 'Organizar grupos musculares', detalhe: 'Junte variações como “Ombro” e “Ombros” num nome só.', Icone: Merge,
          aoTocar: () => { abrirPainel(); setOrganizar(true); },
        }]} />
      ) : null}
      {organizar ? (
        <FolhaOrganizarGruposMusculares exercicios={todos} erro={listaInteira.erro} carregando={listaInteira.carregando}
          recarregar={listaInteira.recarregar} aoFechar={() => setOrganizar(false)} aoUnir={gruposUnidos} />
      ) : null}
    </Cartao>
  );
}
