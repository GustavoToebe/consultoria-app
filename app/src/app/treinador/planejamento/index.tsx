import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Copy, Ellipsis, Library, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { alterarReceita, criarReceita, duplicarReceita, excluirReceita, listarPastasModelos, listarReceitas } from '../../../api/rotas';
import type { PastaModelo, Receita, TipoReceita } from '../../../api/tipos';
import { agruparPorColecao, filtrarModelos, resumoDeModelos } from '../../../dominio/colecoes';
import { mensagemCopiaCriada } from '../../../dominio/planoDoAluno';
import { AplicarAoAluno } from '../../../treinador/planejamento/AplicarAoAluno';
import { FolhaColecoes } from '../../../treinador/planejamento/FolhaColecoes';
import { ListaDeQuestionarios } from '../../../treinador/questionarios/ListaDeQuestionarios';
import { ABA_ANAMNESE, ABA_ATUALIZACAO, ABA_INSCRICAO, ABAS_DE_QUESTIONARIO, abaDoPlanejamento, CATEGORIAS, conteudoInicial, gruposLiberados, metadadosDoModelo, rotuloNovoModelo, slugDaAba, tipoDoPlanejamento, usoDoModelo } from '../../../treinador/planejamento/modelos';
import { Abas } from '../../../ui/Abas';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../../../ui/CabecalhoDeGrupo';
import { Campo } from '../../../ui/Campo';
import { Cartao } from '../../../ui/Cartao';
import { Escolha } from '../../../ui/Escolha';
import { FaixaDeChips } from '../../../ui/FaixaDeChips';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { Esqueleto } from '../../../ui/Esqueleto';
import { textoDoErro } from '../../../ui/erros';
import { Folha } from '../../../ui/Folha';
import { IconeBotao } from '../../../ui/IconeBotao';
import { LinhaDaLista } from '../../../ui/LinhaDaLista';
import { ListaEmColunas, MINIMO_DA_COLUNA_COM_ACOES } from '../../../treinador/ListaEmColunas';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { descricaoDoModelo, LIMITE_DESCRICAO_DO_MODELO, podeAplicarModelo } from '../../../dominio/modelos';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';
import { useSecoesAbertas } from '../../../ui/useSecoesAbertas';
import { CONFIGURACAO_PADRAO } from '../../../dominio/metodologiaPadrao';

/** Chave da coleção no estado de abertura: o mesmo `pastaId` em tipos diferentes são seções diferentes. */
const chaveDaColecao = (tipo: TipoReceita, pastaId: string | null) => `${tipo}:${pastaId ?? ''}`;

export default function Planejamento() {
  const { avisar } = useAviso();
  const { pode, funcionalidadesDoPlano } = useSessao();
  // Quem só tem QUESTIONARIO_LER entra no Planejamento pela aba Atualização: nada de modelos é buscado nem mostrado.
  const veModelos = pode('MODELO_LER');
  const veAtualizacao = pode('QUESTIONARIO_LER');
  const modelos = useCarregar(veModelos ? 'planejamento' : null, () => listarReceitas());
  const colecoes = useCarregar(veModelos ? 'pastas-modelos' : null, listarPastasModelos);
  const [tipoEscolhido, setTipo] = useState<TipoReceita | null>(null);
  const [busca, setBusca] = useState('');
  // A aba mora no endereço (`?aba=treino|dieta|pacotes|mobilidade|atualizacao`; sem ela, a primeira): tocar numa aba é um
  // passo do histórico e o voltar a desfaz. `?novo=1` (atalho da busca do topo) abre o formulário de novo modelo ou, na
  // aba Atualização, de novo questionário e sai do endereço na hora (consumido ao abrir, não ao fechar: fechar o
  // formulário não reescreve a URL e o voltar do navegador não tem passo sobrando).
  // `?colar=1` junto com `?novo=1` (atalho "Colar treino de PDF / Docs" da Importação): o modelo novo abre o editor já com a
  // Folha de colar o texto aberta. Vale só para esse "novo" (guardado em `colarAoCriar`, nunca fica no endereço).
  const { novo: pedirNovo, aba: abaPedida, tipo: tipoPedido, colar: pedirColar } = useLocalSearchParams<{ novo?: string; aba?: string; tipo?: string; colar?: string }>();
  const [colarAoCriar, setColarAoCriar] = useState(false);
  const aba = abaDoPlanejamento(abaPedida, veModelos, veAtualizacao, funcionalidadesDoPlano);
  const grupos = gruposLiberados(funcionalidadesDoPlano);
  const emAnamnese = aba === ABA_ANAMNESE;
  const emInscricao = aba === ABA_INSCRICAO;
  // As três abas de questionário (atualização, anamnese e inscrição) têm o próprio "novo" e nenhuma lista de modelos.
  const emAtualizacao = aba === ABA_ATUALIZACAO || emAnamnese || emInscricao;
  const [formularioAberto, setFormulario] = useState<Receita | 'novo' | null>(null);
  const formulario = formularioAberto;
  const fecharFormulario = () => { setFormulario(null); setColarAoCriar(false); };
  useEffect(() => {
    if (pedirNovo !== '1' || emAtualizacao) return;
    let vivo = true;
    void Promise.resolve().then(() => {
      if (!vivo) return;
      setFormulario('novo');
      setColarAoCriar(pedirColar === '1');
      router.setParams({ novo: undefined, colar: undefined });
    });
    return () => { vivo = false; };
  }, [pedirNovo, pedirColar, emAtualizacao]);
  // "Organizar coleções" abre a folha; o lápis de um grupo abre a mesma folha já renomeando aquela coleção (pelo id).
  const [organizar, setOrganizar] = useState<{ editarId: string | null } | null>(null);
  // Coleções que abrem e fecham, por chave `tipo:pastaId` (pastaId vazio = "Sem coleção"), de TODOS os tipos e sem filtro
  // de busca: abrir numa lista não abre nas outras e trocar de chip não perde o que a pessoa abriu. Nascem fechadas, menos
  // a coleção única do tipo (`abrirDePartida`); buscar abre as que têm resultado e limpar a busca volta ao de antes; o
  // modelo criado ou movido abre a coleção dele (`abrir`). Nada vai ao aparelho (docs/design-e-front.md, 4.8).
  const gruposDosTipos = (termo: string): string[][] => {
    const dados = modelos.dados; const pastas = colecoes.erro ? undefined : colecoes.dados;
    if (!dados || !pastas) return [];
    return CATEGORIAS.map((c) => agruparPorColecao(filtrarModelos(dados, c.valor, termo), pastas).map((g) => chaveDaColecao(c.valor, g.pastaId)));
  };
  const todasAsChaves = gruposDosTipos('');
  const secoes = useSecoesAbertas(todasAsChaves.flat(), todasAsChaves.filter((chaves) => chaves.length === 1).flat());
  const buscar = (texto: string) => { setBusca(texto); secoes.aoBuscar(texto, gruposDosTipos(texto).flat()); };
  const [menu, setMenu] = useState<Receita | null>(null);
  const [excluir, setExcluir] = useState<Receita | null>(null);
  const [aplicar, setAplicar] = useState<Receita | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const atualizar = () => { modelos.recarregar(); colecoes.recarregar(); };
  // Grupo (Treino, Dieta, Pacotes, Mobilidade) são abas; os tipos do grupo, chips numa faixa que rola.
  const grupo = grupos.find((g) => g.rotulo === aba) ?? grupos[0];
  // O chip escolhido só vale dentro do grupo da aba (o menu pode trocar a aba sem remontar a tela).
  // Sem toque num chip, vale o `?tipo=` do endereço (os Primeiros passos abrem direto em Metodologias).
  const tipoDesejado = tipoEscolhido ?? tipoDoPlanejamento(tipoPedido);
  const tipo: TipoReceita = tipoDesejado && grupo.tipos.includes(tipoDesejado) ? tipoDesejado : grupo.tipos[0];
  const categoria = CATEGORIAS.find((c) => c.valor === tipo) ?? CATEGORIAS[0];
  const uso = usoDoModelo(tipo);
  const filtrados = modelos.dados ? filtrarModelos(modelos.dados, tipo, busca) : undefined;
  // Os grupos esperam as duas buscas: sem as coleções, tudo cairia em "Sem coleção" por um instante. Se as coleções
  // falharem, fica só a mensagem de erro: agrupar sem elas poria todo modelo em "Sem coleção", o que é informação falsa.
  // Nas abas de questionário não há lista de modelos.
  const carregando = (!modelos.dados && modelos.carregando) || (!colecoes.dados && colecoes.carregando);
  const porColecao = !emAtualizacao && filtrados && !carregando && !colecoes.erro ? agruparPorColecao(filtrados, colecoes.dados ?? []) : undefined;
  const duplicar = (r: Receita) => {
    setMenu(null); setOcupado(r.id);
    duplicarReceita(r.id).then(() => { modelos.recarregar(); avisar('Modelo duplicado.', 'sucesso'); }, (e: unknown) => avisar(textoDoErro(e), 'perigo')).finally(() => setOcupado(null));
  };
  return <Tela bordas={['top']} largura={LARGURA_LISTA}>
    <Cabecalho titulo="Planejamento" mostrarMarca="celular" />
    {/* Nas abas de modelo o apoio é a descrição do tipo, no cartão: sem frase de página repetindo a mesma ideia, o
        primeiro modelo fica mais perto do topo. "Aplicar" já diz que cria uma cópia para o aluno. */}
    {emAtualizacao ? <Texto variante="suave">{emInscricao ? 'Monte as perguntas da página "Quero ser aluno", embaixo dos campos fixos.' : emAnamnese ? 'Monte as anamneses que você envia ao aluno pela ficha dele.' : 'Monte os questionários de atualização que o aluno responde a cada período.'}</Texto> : null}
    <Abas abas={[...(veModelos ? grupos.map((g) => ({ valor: g.rotulo, rotulo: g.rotulo })) : []), ...(veAtualizacao ? ABAS_DE_QUESTIONARIO.map((r) => ({ valor: r, rotulo: r })) : [])]}
      ativa={aba}
      aoMudar={(rotulo) => { if (rotulo !== aba) router.push({ pathname: '/treinador/planejamento', params: { aba: slugDaAba(rotulo) } }); }} />
    {emAtualizacao ? <ListaDeQuestionarios key={aba} finalidade={emInscricao ? 'INSCRICAO' : emAnamnese ? 'ANAMNESE' : 'ATUALIZACAO'} pedirNovo={pedirNovo === '1'} aoConsumirNovo={() => router.setParams({ novo: undefined })} /> : null}
    {!emAtualizacao && grupo.tipos.length > 1 ? (
      <FaixaDeChips quebrar accessibilityLabel={`Modelos de ${grupo.rotulo.toLocaleLowerCase()}`}>
        <Escolha descricao={`Modelos de ${grupo.rotulo.toLocaleLowerCase()}`} valor={tipo} aoMudar={setTipo} opcoes={CATEGORIAS.filter((c) => grupo.tipos.includes(c.valor))} />
      </FaixaDeChips>
    ) : null}
    {emAtualizacao ? null : <Cartao
      titulo={categoria.rotulo}
      descricao={uso.linha ? `${categoria.descricao} ${uso.linha}` : categoria.descricao}>
      {/* Busca e criação na mesma fileira: a busca procura em todas as coleções (os grupos abaixo, não um filtro) e o
          primário da área ("Nova …") fica ao lado dela, no fim. */}
      <View style={estilos.busca}>
        <View style={estilos.campoBusca}><Campo rotulo="Buscar modelo" valor={busca} aoMudar={buscar} placeholder="Nome ou descrição" autoCorrect={false} /></View>
        <Permitido codigo="MODELO_ALTERAR">
          <View style={estilos.acoesDaBusca}>
            <Botao rotulo="Organizar coleções" tipo="secundario" Icone={Library} aoTocar={() => setOrganizar({ editarId: null })} />
            <Botao rotulo={rotuloNovoModelo(tipo)} Icone={Plus} aoTocar={() => setFormulario('novo')} />
          </View>
        </Permitido>
      </View>
      {modelos.erro || colecoes.erro ? <MensagemErro texto={textoDoErro(modelos.erro ?? colecoes.erro)} tentarDeNovo={atualizar} /> : null}
      {carregando ? <Esqueleto /> : null}
      {porColecao?.length === 0 ? <Vazio texto={busca.trim() ? 'Nenhum modelo com essa busca.' : `Nenhum modelo ainda. Toque em “${rotuloNovoModelo(tipo)}” para começar.`} /> : null}
    </Cartao>}
    {/* Um cartão por coleção (alfabética, "Sem coleção" por último), como a Biblioteca › Outros; recolhido mostra só a faixa. */}
    {porColecao?.map((g) => {
      const chave = chaveDaColecao(tipo, g.pastaId);
      const aberto = secoes.estaAberta(chave);
      const colecao = g.pastaId ? colecoes.dados?.find((c) => c.id === g.pastaId) : undefined;
      return <Cartao key={g.pastaId ?? ''} cabecalho={<CabecalhoDeGrupo titulo={g.rotulo} resumo={resumoDeModelos(g.itens.length)} aberto={aberto} aoAlternar={() => secoes.alternar(chave)} acoesJuntas
        acoes={colecao && pode('MODELO_ALTERAR') ? <IconeBotao Icone={Pencil} rotulo={`Renomear coleção ${g.rotulo}`} aoTocar={() => setOrganizar({ editarId: colecao.id })} /> : undefined} />}>
        {aberto ? <ListaEmColunas minimo={MINIMO_DA_COLUNA_COM_ACOES}>{g.itens.map((r) => <LinhaDeModelo key={r.id} modelo={r} aplicavel={uso.aplicavel && podeAplicarModelo(r.tipo, pode)}
          ocupado={ocupado === r.id} aoAplicar={() => setAplicar(r)} aoEditar={() => router.push(`/treinador/planejamento/modelo/${r.id}`)}
          aoMenu={pode('MODELO_ALTERAR') ? () => setMenu(r) : undefined} />)}</ListaEmColunas> : null}
      </Cartao>;
    })}
    {menu ? <Folha visivel titulo={menu.nome} aoFechar={() => setMenu(null)}>
      <Botao rotulo="Renomear ou mudar de coleção" tipo="secundario" Icone={Pencil} cheio aoTocar={() => { setFormulario(menu); setMenu(null); }} />
      <Botao rotulo="Duplicar" tipo="acao" Icone={Copy} cheio desabilitado={ocupado !== null} aoTocar={() => duplicar(menu)} />
      <Botao rotulo="Excluir modelo" tipo="perigoTexto" Icone={Trash2} cheio aoTocar={() => { setExcluir(menu); setMenu(null); }} />
    </Folha> : null}
    {formulario ? <Formulario key={typeof formulario === 'string' ? 'novo' : formulario.id} receita={formulario === 'novo' ? null : formulario} tipo={tipo} colecoes={colecoes.dados ?? []} aoFechar={fecharFormulario} aoSalvar={async (nome, descricao, pastaId) => {
      if (formulario === 'novo') {
        const novo = await criarReceita({ tipo, nome, descricao, pastaId, conteudo: conteudoInicial(tipo, CONFIGURACAO_PADRAO) });
        const colar = colarAoCriar && (tipo === 'PLANO_TREINO' || tipo === 'SESSAO_TREINO');
        secoes.abrir(chaveDaColecao(tipo, pastaId));
        fecharFormulario(); modelos.recarregar();
        router.push(colar ? { pathname: '/treinador/planejamento/modelo/[id]', params: { id: novo.id, colar: '1' } } : `/treinador/planejamento/modelo/${novo.id}`);
      } else { await alterarReceita(formulario.id, { ...formulario, nome, descricao, pastaId }); secoes.abrir(chaveDaColecao(formulario.tipo, pastaId)); fecharFormulario(); modelos.recarregar(); }
    }} /> : null}
    {organizar ? <FolhaColecoes colecoes={colecoes.dados} erroDasColecoes={colecoes.erro} modelos={modelos.erro ? undefined : modelos.dados} inicialId={organizar.editarId}
      aoFechar={() => setOrganizar(null)} atualizar={atualizar} /> : null}
    {aplicar ? <AplicarAoAluno modelo={aplicar} aoFechar={() => setAplicar(null)} aoAplicar={(id, nome) => { setAplicar(null); avisar(mensagemCopiaCriada(nome), 'sucesso'); router.push(`/treinador/alunos/${id}`); }} /> : null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir “${excluir?.nome ?? ''}”?`} mensagem="As cópias dos alunos e as metodologias já vinculadas permanecem iguais." rotuloConfirmar="Excluir modelo" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
      if (!excluir) return; const id = excluir.id; setExcluir(null);
      excluirReceita(id).then(modelos.recarregar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
    }} />
  </Tela>;
}

/**
 * Linha do modelo dentro do cartão da coleção (`ui/LinhaDaLista`, o padrão das listas): nome, metadados
 * ("6 sessões · 32 exercícios") e descrição; "Aplicar ao aluno" e "Editar" secundários (o primário da tela é "Nova …"
 * do tipo) e o resto no menu ⋯. No PC tudo numa linha; no celular, textos em cima e ações embaixo. Onde usar as
 * peças vai uma vez só, na descrição do cartão do tipo.
 */
function LinhaDeModelo({ modelo: r, aplicavel, ocupado, aoAplicar, aoEditar, aoMenu }: {
  modelo: Receita; aplicavel: boolean; ocupado: boolean;
  aoAplicar: () => void; aoEditar: () => void; aoMenu?: () => void;
}) {
  return <LinhaDaLista titulo={r.nome} metadados={metadadosDoModelo(r.tipo, r.conteudo)} descricao={descricaoDoModelo(r)} acoes={<>
    {aplicavel ? <Permitido codigo="MODELO_APLICAR"><Botao rotulo="Aplicar ao aluno" tipo="secundario" aoTocar={aoAplicar} /></Permitido> : null}
    <Permitido codigo="MODELO_ALTERAR"><Botao rotulo="Editar" tipo="secundario" Icone={Pencil} carregando={ocupado} aoTocar={aoEditar} /></Permitido>
    {aoMenu ? <IconeBotao Icone={Ellipsis} moldura rotulo={`Mais ações de ${r.nome}`} desabilitado={ocupado} aoTocar={aoMenu} /> : null}
  </>} />;
}

function Formulario({ receita, tipo, colecoes, aoFechar, aoSalvar }: { receita: Receita | null; tipo: TipoReceita; colecoes: PastaModelo[]; aoFechar: () => void; aoSalvar: (nome: string, descricao: string | null, pastaId: string | null) => Promise<void> }) {
  const [nome, setNome] = useState(receita?.nome ?? ''); const [descricao, setDescricao] = useState(receita?.descricao ?? '');
  const [colecao, setColecao] = useState(receita?.pastaId ?? '');
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<unknown>(null);
  return <Folha visivel titulo={receita ? 'Renomear ou mudar de coleção' : rotuloNovoModelo(tipo)} aoFechar={aoFechar} rodape={<Botao rotulo={receita ? 'Salvar' : 'Criar e editar'} desabilitado={!nome.trim()} motivo="Informe o nome do modelo." carregando={salvando} aoTocar={() => {
    setSalvando(true); setErro(null); aoSalvar(nome.trim(), descricao.trim() || null, colecao || null).catch((e: unknown) => { setErro(e); setSalvando(false); });
  }} />}>
    <Campo rotulo="Nome do modelo" valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={LIMITE_DESCRICAO_DO_MODELO} />
    <Escolha rotulo="Coleção" valor={colecao} aoMudar={setColecao} opcoes={[{ valor: '', rotulo: 'Sem coleção' }, ...colecoes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}

const estilos = StyleSheet.create({
  busca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1) },
  // Teto da busca da Biblioteca (`BarraDaBiblioteca`): na tela larga o campo não estica e os botões vêm logo depois dele.
  campoBusca: { flexGrow: 1, flexBasis: 240, maxWidth: 480 },
  // Os botões ficam na base, rentes ao campo de busca; quebram juntos para baixo dele no celular.
  // `maxWidth` faz os botões quebrarem entre si em 390 (sem ele a fileira media o conteúdo e cortava "Nova …" na borda).
  acoesDaBusca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1), maxWidth: '100%' },
});
