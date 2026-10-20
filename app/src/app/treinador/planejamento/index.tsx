import { Permitido } from '../../../ui/Permitido';
import { useSessao } from '../../../sessao/SessaoProvider';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, LARGURA_LISTA, RAIO } from '../../../tema/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Copy, Ellipsis, Library, Pencil, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { alterarPastaModelo, alterarReceita, criarPastaModelo, criarReceita, duplicarReceita, excluirPastaModelo, excluirReceita, listarPastasModelos, listarReceitas } from '../../../api/rotas';
import type { PastaModelo, Receita, TipoReceita } from '../../../api/tipos';
import { mensagemCopiaCriada } from '../../../dominio/planoDoAluno';
import { AplicarAoAluno } from '../../../treinador/planejamento/AplicarAoAluno';
import { ListaDeQuestionarios } from '../../../treinador/questionarios/ListaDeQuestionarios';
import { ABA_ANAMNESE, ABA_ATUALIZACAO, abaDoPlanejamento, CATEGORIAS, conteudoInicial, gruposLiberados, metadadosDoModelo, rotuloNovoModelo, slugDaAba, usoDoModelo } from '../../../treinador/planejamento/modelos';
import { Abas } from '../../../ui/Abas';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Campo } from '../../../ui/Campo';
import { Cartao } from '../../../ui/Cartao';
import { Escolha } from '../../../ui/Escolha';
import { EscolhaEmFolha } from '../../../ui/EscolhaEmFolha';
import { FaixaDeChips } from '../../../ui/FaixaDeChips';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { Esqueleto } from '../../../ui/Esqueleto';
import { textoDoErro } from '../../../ui/erros';
import { Grade } from '../../../ui/Grade';
import { Folha } from '../../../ui/Folha';
import { IconeBotao } from '../../../ui/IconeBotao';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { podeAplicarModelo } from '../../../dominio/modelos';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';
import { CONFIGURACAO_PADRAO } from '../../../dominio/metodologiaPadrao';

export default function Planejamento() {
  const { avisar } = useAviso();
  const { pode, funcionalidadesDoPlano } = useSessao();
  // Quem só tem QUESTIONARIO_LER entra no Planejamento pela aba Atualização: nada de modelos é buscado nem mostrado.
  const veModelos = pode('MODELO_LER');
  const veAtualizacao = pode('QUESTIONARIO_LER');
  const modelos = useCarregar(veModelos ? 'planejamento' : null, () => listarReceitas());
  const colecoes = useCarregar(veModelos ? 'pastas-modelos' : null, listarPastasModelos);
  const [tipoEscolhido, setTipo] = useState<TipoReceita | null>(null);
  const [colecao, setColecao] = useState('*');
  const [busca, setBusca] = useState('');
  // A aba mora no endereço (`?aba=treino|dieta|pacotes|mobilidade|atualizacao`; sem ela, a primeira): tocar numa aba é um
  // passo do histórico e o voltar a desfaz. `?novo=1` (atalho da busca do topo) abre o formulário de novo modelo ou, na
  // aba Atualização, de novo questionário e sai do endereço na hora (consumido ao abrir, não ao fechar: fechar o
  // formulário não reescreve a URL e o voltar do navegador não tem passo sobrando).
  const { novo: pedirNovo, aba: abaPedida } = useLocalSearchParams<{ novo?: string; aba?: string }>();
  const aba = abaDoPlanejamento(abaPedida, veModelos, veAtualizacao, funcionalidadesDoPlano);
  const grupos = gruposLiberados(funcionalidadesDoPlano);
  const emAnamnese = aba === ABA_ANAMNESE;
  // As duas abas de questionário (atualização e anamnese) têm o próprio "novo" e nenhuma lista de modelos.
  const emAtualizacao = aba === ABA_ATUALIZACAO || emAnamnese;
  const [formularioAberto, setFormulario] = useState<Receita | 'novo' | null>(null);
  const formulario = formularioAberto;
  const fecharFormulario = () => setFormulario(null);
  useEffect(() => {
    if (pedirNovo !== '1' || emAtualizacao) return;
    let vivo = true;
    void Promise.resolve().then(() => { if (!vivo) return; setFormulario('novo'); router.setParams({ novo: undefined }); });
    return () => { vivo = false; };
  }, [pedirNovo, emAtualizacao]);
  const [organizar, setOrganizar] = useState(false);
  const [menu, setMenu] = useState<Receita | null>(null);
  const [excluir, setExcluir] = useState<Receita | null>(null);
  const [aplicar, setAplicar] = useState<Receita | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const atualizar = () => { modelos.recarregar(); colecoes.recarregar(); };
  // Grupo (Treino, Dieta, Pacotes, Mobilidade) são abas; os tipos do grupo, chips numa faixa que rola.
  const grupo = grupos.find((g) => g.rotulo === aba) ?? grupos[0];
  // O chip escolhido só vale dentro do grupo da aba (o menu pode trocar a aba sem remontar a tela).
  const tipo: TipoReceita = tipoEscolhido && grupo.tipos.includes(tipoEscolhido) ? tipoEscolhido : grupo.tipos[0];
  const categoria = CATEGORIAS.find((c) => c.valor === tipo) ?? CATEGORIAS[0];
  const uso = usoDoModelo(tipo);
  const nomeDaColecao = (id: string | null) => colecoes.dados?.find((c) => c.id === id)?.nome;
  const filtrados = modelos.dados?.filter((r) => r.tipo === tipo && (colecao === '*' || (r.pastaId ?? '') === colecao) && `${r.nome} ${r.descricao ?? ''}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase()));
  const duplicar = (r: Receita) => {
    setMenu(null); setOcupado(r.id);
    duplicarReceita(r.id).then(() => { modelos.recarregar(); avisar('Modelo duplicado.', 'sucesso'); }, (e: unknown) => avisar(textoDoErro(e), 'perigo')).finally(() => setOcupado(null));
  };
  return <Tela bordas={['top']} largura={LARGURA_LISTA}>
    <Cabecalho titulo="Planejamento" mostrarMarca="celular" />
    <Texto variante="suave">{emAnamnese ? 'Monte as anamneses que você envia ao aluno pela ficha dele.' : emAtualizacao ? 'Monte os questionários de atualização que o aluno responde a cada período.' : 'Monte modelos, vincule metodologias às semanas e reutilize nos alunos. Cada aplicação cria uma cópia independente.'}</Texto>
    <Abas abas={[...(veModelos ? grupos.map((g) => ({ valor: g.rotulo, rotulo: g.rotulo })) : []), ...(veAtualizacao ? [ABA_ATUALIZACAO, ABA_ANAMNESE].map((r) => ({ valor: r, rotulo: r })) : [])]}
      ativa={aba}
      aoMudar={(rotulo) => { if (rotulo !== aba) router.push({ pathname: '/treinador/planejamento', params: { aba: slugDaAba(rotulo) } }); }} />
    {emAtualizacao ? <ListaDeQuestionarios key={aba} finalidade={emAnamnese ? 'ANAMNESE' : 'ATUALIZACAO'} pedirNovo={pedirNovo === '1'} aoConsumirNovo={() => router.setParams({ novo: undefined })} /> : null}
    {!emAtualizacao && grupo.tipos.length > 1 ? (
      <FaixaDeChips quebrar accessibilityLabel={`Modelos de ${grupo.rotulo.toLocaleLowerCase()}`}>
        <Escolha descricao={`Modelos de ${grupo.rotulo.toLocaleLowerCase()}`} valor={tipo} aoMudar={setTipo} opcoes={CATEGORIAS.filter((c) => grupo.tipos.includes(c.valor))} />
      </FaixaDeChips>
    ) : null}
    {emAtualizacao ? null : <Cartao
      titulo={categoria.rotulo}
      descricao={uso.linha ? `${categoria.descricao} ${uso.linha}` : categoria.descricao}
      acoes={<Permitido codigo="MODELO_ALTERAR"><Botao rotulo={rotuloNovoModelo(tipo)} aoTocar={() => setFormulario('novo')} /></Permitido>}>
      {/* Mesma barra das outras listas: busca, depois o filtro. */}
      <View style={estilos.busca}>
        <View style={estilos.campoBusca}><Campo rotulo="Buscar modelo" valor={busca} aoMudar={setBusca} placeholder="Nome ou descrição" autoCorrect={false} /></View>
        <EscolhaEmFolha rotulo="Coleção" valor={colecao} aoMudar={setColecao} style={estilos.seletor}
          opcoes={[{ valor: '*', rotulo: 'Todas' }, { valor: '', rotulo: 'Sem coleção' }, ...(colecoes.dados ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))]}
          rodape={pode('MODELO_ALTERAR') ? <Botao rotulo="Organizar coleções" tipo="secundario" Icone={Library} aoTocar={() => setOrganizar(true)} /> : undefined} />
      </View>
      {modelos.erro || colecoes.erro ? <MensagemErro texto={textoDoErro(modelos.erro ?? colecoes.erro)} tentarDeNovo={atualizar} /> : null}
      {!modelos.dados && modelos.carregando ? <Esqueleto /> : null}
      {filtrados?.length === 0 ? <Vazio texto={busca.trim() || colecao !== '*' ? 'Nenhum modelo com essa busca ou coleção.' : `Nenhum modelo ainda. Toque em “${rotuloNovoModelo(tipo)}” para começar.`} /> : null}
      {filtrados?.length ? <Grade gap={espaco(2)}>{filtrados.map((r) => <CartaoModelo key={r.id} modelo={r} colecao={nomeDaColecao(r.pastaId)} aplicavel={uso.aplicavel && podeAplicarModelo(r.tipo, pode)}
        ocupado={ocupado === r.id} aoAplicar={() => setAplicar(r)} aoEditar={() => router.push(`/treinador/planejamento/modelo/${r.id}`)}
        aoMenu={pode('MODELO_ALTERAR') ? () => setMenu(r) : undefined} />)}</Grade> : null}
    </Cartao>}
    {menu ? <Folha visivel titulo={menu.nome} aoFechar={() => setMenu(null)}>
      <Botao rotulo="Renomear ou mudar de coleção" tipo="secundario" Icone={Pencil} cheio aoTocar={() => { setFormulario(menu); setMenu(null); }} />
      <Botao rotulo="Duplicar" tipo="secundario" Icone={Copy} cheio desabilitado={ocupado !== null} aoTocar={() => duplicar(menu)} />
      <Botao rotulo="Excluir modelo" tipo="perigoTexto" Icone={Trash2} cheio aoTocar={() => { setExcluir(menu); setMenu(null); }} />
    </Folha> : null}
    {formulario ? <Formulario key={typeof formulario === 'string' ? 'novo' : formulario.id} receita={formulario === 'novo' ? null : formulario} tipo={tipo} colecaoInicial={colecao === '*' ? '' : colecao} colecoes={colecoes.dados ?? []} aoFechar={fecharFormulario} aoSalvar={async (nome, descricao, pastaId) => {
      if (formulario === 'novo') {
        const novo = await criarReceita({ tipo, nome, descricao, pastaId, conteudo: conteudoInicial(tipo, CONFIGURACAO_PADRAO) });
        fecharFormulario(); modelos.recarregar(); router.push(`/treinador/planejamento/modelo/${novo.id}`);
      } else { await alterarReceita(formulario.id, { ...formulario, nome, descricao, pastaId }); fecharFormulario(); modelos.recarregar(); }
    }} /> : null}
    {organizar ? <OrganizarColecoes colecoes={colecoes.dados ?? []} aoFechar={() => setOrganizar(false)} atualizar={atualizar} /> : null}
    {aplicar ? <AplicarAoAluno modelo={aplicar} aoFechar={() => setAplicar(null)} aoAplicar={(id, nome) => { setAplicar(null); avisar(mensagemCopiaCriada(nome), 'sucesso'); router.push(`/treinador/alunos/${id}`); }} /> : null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir “${excluir?.nome ?? ''}”?`} mensagem="As cópias dos alunos e as metodologias já vinculadas permanecem iguais." rotuloConfirmar="Excluir modelo" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
      if (!excluir) return; const id = excluir.id; setExcluir(null);
      excluirReceita(id).then(modelos.recarregar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
    }} />
  </Tela>;
}

/**
 * Semanas, dietas e pacotes: "Aplicar ao aluno" + "Editar", os dois secundários (o primário da tela é "Nova …" do
 * tipo). Linha de metadados ("6 sessões · 32 exercícios") e a descrição; onde usar as peças vai uma vez só, na
 * descrição do cartão do tipo. O resto fica no menu ⋯. As ações ficam na base do cartão, alinhadas entre cartões de alturas diferentes.
 */
function CartaoModelo({ modelo: r, colecao, aplicavel, ocupado, aoAplicar, aoEditar, aoMenu }: {
  modelo: Receita; colecao: string | undefined; aplicavel: boolean; ocupado: boolean;
  aoAplicar: () => void; aoEditar: () => void; aoMenu?: () => void;
}) {
  const { cores } = useTema();
  return <View style={[estilos.modelo, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
    <View style={estilos.topoModelo}>
      <View style={estilos.textosModelo}>
        <Texto variante="bloco">{r.nome}</Texto>
        <Texto variante="pequeno" numerico>{metadadosDoModelo(r.tipo, r.conteudo)}{colecao ? ` · ${colecao}` : ''}</Texto>
        {r.descricao ? <Texto variante="suave" numberOfLines={2}>{r.descricao}</Texto> : null}
      </View>
      {aoMenu ? <IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${r.nome}`} desabilitado={ocupado} aoTocar={aoMenu} /> : null}
    </View>
    <View style={estilos.acoesModelo}>
      {aplicavel ? <Permitido codigo="MODELO_APLICAR"><Botao rotulo="Aplicar ao aluno" tipo="secundario" aoTocar={aoAplicar} /></Permitido> : null}
      <Permitido codigo="MODELO_ALTERAR"><Botao rotulo="Editar" tipo="secundario" Icone={Pencil} carregando={ocupado} aoTocar={aoEditar} /></Permitido>
    </View>
  </View>;
}

function Formulario({ receita, tipo, colecaoInicial, colecoes, aoFechar, aoSalvar }: { receita: Receita | null; tipo: TipoReceita; colecaoInicial: string; colecoes: PastaModelo[]; aoFechar: () => void; aoSalvar: (nome: string, descricao: string | null, pastaId: string | null) => Promise<void> }) {
  const [nome, setNome] = useState(receita?.nome ?? ''); const [descricao, setDescricao] = useState(receita?.descricao ?? '');
  const [colecao, setColecao] = useState(receita ? receita.pastaId ?? '' : colecaoInicial);
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<unknown>(null);
  return <Folha visivel titulo={receita ? 'Renomear ou mudar de coleção' : rotuloNovoModelo(tipo)} aoFechar={aoFechar} rodape={<Botao rotulo={receita ? 'Salvar' : 'Criar e editar'} desabilitado={!nome.trim()} motivo="Informe o nome do modelo." carregando={salvando} aoTocar={() => {
    setSalvando(true); setErro(null); aoSalvar(nome.trim(), descricao.trim() || null, colecao || null).catch((e: unknown) => { setErro(e); setSalvando(false); });
  }} />}>
    <Campo rotulo="Nome do modelo" valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={400} />
    <Escolha rotulo="Coleção" valor={colecao} aoMudar={setColecao} opcoes={[{ valor: '', rotulo: 'Sem coleção' }, ...colecoes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}

/** Coleções organizam os modelos (na API ainda se chamam pastas de modelos; a pasta do aluno é outra coisa). */
function OrganizarColecoes({ colecoes: pastas, aoFechar, atualizar }: { colecoes: PastaModelo[]; aoFechar: () => void; atualizar: () => void }) {
  const [nome, setNome] = useState(''); const [editando, setEditando] = useState<PastaModelo | null>(null);
  const [excluir, setExcluir] = useState<PastaModelo | null>(null); const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const executar = async (acao: () => Promise<unknown>) => {
    setSalvando(true); setErro(null);
    try { await acao(); atualizar(); setNome(''); setEditando(null); } catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  return <Folha visivel titulo="Organizar coleções" aoFechar={aoFechar}>
    <Texto variante="suave">Coleções só organizam seus modelos. Para aplicar treinos e dietas juntos a um aluno, use um pacote.</Texto>
    <Campo rotulo={editando ? 'Renomear coleção' : 'Nova coleção'} valor={nome} aoMudar={setNome} maxLength={120} />
    <Botao rotulo={editando ? 'Salvar nome' : 'Criar coleção'} carregando={salvando} desabilitado={!nome.trim()} motivo="Informe o nome da coleção." aoTocar={() => void executar(() => editando ? alterarPastaModelo(editando.id, nome.trim(), editando.versao) : criarPastaModelo(nome.trim()))} />
    {editando ? <Botao rotulo="Cancelar edição" tipo="fantasma" aoTocar={() => { setEditando(null); setNome(''); }} /> : null}
    {pastas.map((p) => <Cartao key={p.id} titulo={p.nome}><Permitido codigo="MODELO_ALTERAR"><Botao rotulo="Renomear coleção" tipo="secundario" desabilitado={salvando} aoTocar={() => { setEditando(p); setNome(p.nome); }} /></Permitido><Permitido codigo="MODELO_ALTERAR"><Botao rotulo="Excluir coleção" tipo="perigoTexto" desabilitado={salvando} aoTocar={() => setExcluir(p)} /></Permitido></Cartao>)}
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir coleção “${excluir?.nome ?? ''}”?`} mensagem="Os modelos passam para Sem coleção." rotuloConfirmar="Excluir coleção" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => { if (!excluir) return; const id = excluir.id; setExcluir(null); void executar(() => excluirPastaModelo(id)); }} />
  </Folha>;
}

const estilos = StyleSheet.create({
  busca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1) },
  campoBusca: { flexGrow: 1, flexBasis: 240 },
  // O Botao se alinha ao topo por padrão; aqui fica na base, rente ao campo de busca.
  seletor: { alignSelf: 'flex-end' },
  modelo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5), minHeight: 56, flexGrow: 1 },
  topoModelo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  textosModelo: { flex: 1, gap: espaco(0.5) },
  acoesModelo: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), marginTop: 'auto' },
});
