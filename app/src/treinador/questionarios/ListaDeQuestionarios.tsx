import { router } from 'expo-router';
import { Archive, ArchiveRestore, Copy, Ellipsis, Pencil, Star, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  arquivarQuestionario, criarQuestionario, definirQuestionarioPadrao, desarquivarQuestionario, duplicarQuestionario, excluirQuestionario,
  listarQuestionarios,
} from '../../api/rotas';
import type { FinalidadeQuestionario, OrigemQuestionario, QuestionarioResumo } from '../../api/tipos';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { semAcento } from '../../dominio/telas';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas, type SeloDaLinha } from '../../ui/LinhaDaLista';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const irParaEditor = (id: string) => router.push(`/treinador/planejamento/questionario/${id}`);

/** Frase do uso ("2 alunos · 1 pasta · 5 envios"); sem uso nenhum diz isso. */
export function linhaDeUso(q: Pick<QuestionarioResumo, 'uso'>) {
  const { alunos, pastas, envios } = q.uso;
  const partes = [
    alunos ? `${alunos} ${alunos === 1 ? 'aluno' : 'alunos'}` : null,
    pastas ? `${pastas} ${pastas === 1 ? 'pasta' : 'pastas'}` : null,
    envios ? `${envios} ${envios === 1 ? 'envio' : 'envios'}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Sem uso ainda';
}

/**
 * Abas "Atualização" e "Anamnese" do Planejamento. Atualização: os questionários que o aluno responde no check-in; o
 * padrão vale para quem não tem outro escolhido (na ficha do aluno ou na pasta). Anamnese: os questionários que a
 * equipe envia ao aluno pela ficha; o padrão é só o primeiro sugerido. "Novo questionário" é o único botão primário.
 */
export function ListaDeQuestionarios({ finalidade = 'ATUALIZACAO', pedirNovo, aoConsumirNovo }: {
  finalidade?: FinalidadeQuestionario; pedirNovo: boolean; aoConsumirNovo: () => void;
}) {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const anamnese = finalidade === 'ANAMNESE';
  const [arquivados, setArquivados] = useState(false);
  const lista = useCarregar(`questionarios:${finalidade}:${arquivados}`, () => listarQuestionarios(arquivados, finalidade));
  const [busca, setBusca] = useState('');
  const termo = semAcento(busca.trim());
  const filtrados = lista.dados?.filter((q) => !termo || semAcento(`${q.nome} ${q.descricao ?? ''}`).includes(termo));
  const [novoAberto, setNovoAberto] = useState(false);
  // `?novo=1` (atalho da busca) abre o formulário e sai do endereço na mesma hora: assim fechar o formulário não reescreve
  // a URL e o voltar do navegador não tem passo sobrando. Sem a permissão não abre (a API recusaria de qualquer jeito).
  const consumir = useRef(aoConsumirNovo);
  useEffect(() => { consumir.current = aoConsumirNovo; });
  const podeAlterar = pode('QUESTIONARIO_ALTERAR');
  useEffect(() => {
    if (!pedirNovo) return;
    let vivo = true;
    void Promise.resolve().then(() => { if (!vivo) return; if (podeAlterar) setNovoAberto(true); consumir.current(); });
    return () => { vivo = false; };
  }, [pedirNovo, podeAlterar]);
  const novo = novoAberto && podeAlterar;
  const [menu, setMenu] = useState<QuestionarioResumo | null>(null);
  const [excluir, setExcluir] = useState<QuestionarioResumo | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const executar = (q: QuestionarioResumo, acao: () => Promise<unknown>, mensagem: string) => {
    setMenu(null); setOcupado(q.id);
    acao().then(() => { lista.recarregar(); avisar(mensagem, 'sucesso'); }, (e: unknown) => { lista.recarregar(); avisar(textoDoErro(e), 'perigo'); }).finally(() => setOcupado(null));
  };
  const fecharNovo = () => setNovoAberto(false);

  return <>
    <Cartao titulo={anamnese ? 'Anamneses' : 'Questionários de atualização'}
      descricao={anamnese ? 'O questionário inicial que você envia ao aluno pela ficha dele (cartão Anamnese). Ele responde no app, logado; a versão enviada não muda depois.'
        : 'O check-in que o aluno responde a cada período. O padrão vale para quem não tem outro escolhido na ficha ou na pasta.'}
      acoes={<Permitido codigo="QUESTIONARIO_ALTERAR"><Botao rotulo={anamnese ? 'Nova anamnese' : 'Novo questionário'} aoTocar={() => setNovoAberto(true)} /></Permitido>}>
      {/* A mesma barra da lista de modelos: busca, depois o filtro. */}
      <View style={estilos.busca}>
        <View style={estilos.campoBusca}><Campo rotulo={anamnese ? 'Buscar anamnese' : 'Buscar questionário'} valor={busca} aoMudar={setBusca} placeholder="Nome ou descrição" autoCorrect={false} /></View>
        <EscolhaEmFolha rotulo="Situação" valor={arquivados ? 'arquivados' : 'ativos'} aoMudar={(v) => setArquivados(v === 'arquivados')} style={estilos.seletor}
          opcoes={[{ valor: 'ativos', rotulo: 'Ativos' }, { valor: 'arquivados', rotulo: 'Arquivados' }]} />
      </View>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
      {!lista.dados && lista.carregando ? <Esqueleto /> : null}
      {lista.dados?.length && filtrados?.length === 0 ? <Vazio texto="Nenhum questionário com essa busca." /> : null}
      {lista.dados?.length === 0 ? <Vazio texto={arquivados ? 'Nenhum questionário arquivado.' : anamnese ? 'Nenhuma anamnese ainda. Crie uma em branco e monte as seções.' : 'Nenhum questionário ainda.'} /> : null}
      {filtrados?.length ? <ListaDeLinhas>{filtrados.map((q) =>
        <LinhaDoQuestionario key={q.id} q={q} ocupado={ocupado === q.id} podeAlterar={podeAlterar} aoAbrir={() => irParaEditor(q.id)} aoMenu={podeAlterar ? () => setMenu(q) : undefined} />)}</ListaDeLinhas> : null}
    </Cartao>

    {menu ? <Folha visivel titulo={menu.nome} aoFechar={() => setMenu(null)}>
      <Botao rotulo="Duplicar" tipo="secundario" Icone={Copy} cheio desabilitado={ocupado !== null}
        aoTocar={() => { const q = menu; setMenu(null); setOcupado(q.id); duplicarQuestionario(q.id).then((d) => { lista.recarregar(); avisar('Questionário duplicado.', 'sucesso'); irParaEditor(d.id); }, (e: unknown) => avisar(textoDoErro(e), 'perigo')).finally(() => setOcupado(null)); }} />
      {!menu.padrao && !menu.arquivado ? <Botao rotulo="Definir como padrão" tipo="secundario" Icone={Star} cheio desabilitado={menu.versaoPublicada === 0}
        motivo="Publique o questionário antes de torná-lo o padrão." aoTocar={() => executar(menu, () => definirQuestionarioPadrao(menu.id), 'Padrão alterado.')} /> : null}
      {menu.arquivado
        ? <Botao rotulo="Desarquivar" tipo="secundario" Icone={ArchiveRestore} cheio aoTocar={() => executar(menu, () => desarquivarQuestionario(menu.id), 'Questionário desarquivado.')} />
        : <Botao rotulo="Arquivar" tipo="secundario" Icone={Archive} cheio desabilitado={menu.padrao} motivo="O padrão não pode ser arquivado. Defina outro como padrão antes."
          aoTocar={() => executar(menu, () => arquivarQuestionario(menu.id), 'Questionário arquivado.')} />}
      <Botao rotulo="Excluir questionário" tipo="perigoTexto" Icone={Trash2} cheio desabilitado={menu.padrao || menu.uso.envios > 0}
        motivo={menu.padrao ? 'O padrão não pode ser excluído.' : 'Já foi respondido: arquive em vez de excluir.'} aoTocar={() => { setExcluir(menu); setMenu(null); }} />
    </Folha> : null}

    {novo ? <FormularioNovo finalidade={finalidade} aoFechar={fecharNovo} /> : null}

    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir “${excluir?.nome ?? ''}”?`}
      mensagem={excluir && (excluir.uso.alunos || excluir.uso.pastas) ? 'Os alunos e as pastas que o usavam passam a usar o padrão da consultoria.' : 'Esta ação não pode ser desfeita.'}
      rotuloConfirmar="Excluir questionário" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
        if (!excluir) return; const q = excluir; setExcluir(null);
        executar(q, () => excluirQuestionario(q.id), 'Questionário excluído.');
      }} />
  </>;
}

/**
 * Metadados da linha do questionário: "Publicado v3 · Padrão · Arquivado · 2 alunos · 5 envios", cada parte só quando
 * vale. "Nunca publicado" não entra aqui: é selo, porque pede atenção.
 */
export function metadadosDoQuestionario(q: Pick<QuestionarioResumo, 'versaoPublicada' | 'padrao' | 'arquivado' | 'uso'>): string {
  return [q.versaoPublicada ? `Publicado v${q.versaoPublicada}` : null, q.padrao ? 'Padrão' : null, q.arquivado ? 'Arquivado' : null, linhaDeUso(q)]
    .filter(Boolean).join(' · ');
}

/** Selos só do que pede atenção: nunca publicado e alterado desde a publicação. */
export function selosDoQuestionario(q: Pick<QuestionarioResumo, 'versaoPublicada' | 'alteradoDesdePublicacao'>): SeloDaLinha[] {
  return [
    ...(q.versaoPublicada ? [] : [{ texto: 'Nunca publicado', tipo: 'atencao' as const }]),
    ...(q.alteradoDesdePublicacao ? [{ texto: 'Alterado desde a publicação', tipo: 'atencao' as const }] : []),
  ];
}

function LinhaDoQuestionario({ q, ocupado, podeAlterar, aoAbrir, aoMenu }: {
  q: QuestionarioResumo; ocupado: boolean; podeAlterar: boolean; aoAbrir: () => void; aoMenu?: () => void;
}) {
  return <LinhaDaLista titulo={q.nome} metadados={metadadosDoQuestionario(q)} descricao={q.descricao ?? undefined} selos={selosDoQuestionario(q)} acoes={<>
    <Botao rotulo={podeAlterar && !q.arquivado ? 'Editar' : 'Ver'} tipo="secundario" Icone={Pencil} carregando={ocupado} aoTocar={aoAbrir} />
    {aoMenu ? <IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${q.nome}`} desabilitado={ocupado} aoTocar={aoMenu} /> : null}
  </>} />;
}

function FormularioNovo({ finalidade, aoFechar }: { finalidade: FinalidadeQuestionario; aoFechar: () => void }) {
  const anamnese = finalidade === 'ANAMNESE';
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  // Anamnese começa em branco: não há modelo da plataforma para ela.
  const [origem, setOrigem] = useState<OrigemQuestionario>(anamnese ? 'VAZIO' : 'FABRICA');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  return <Folha visivel titulo={anamnese ? 'Nova anamnese' : 'Novo questionário'} aoFechar={aoFechar} rodape={<Botao rotulo="Criar e editar" desabilitado={!nome.trim()} motivo="Informe o nome." carregando={salvando} aoTocar={() => {
    setSalvando(true); setErro(null);
    criarQuestionario({ nome: nome.trim(), descricao: descricao.trim() || null, origem, finalidade }).then((d) => { aoFechar(); irParaEditor(d.id); }, (e: unknown) => { setErro(e); setSalvando(false); });
  }} />}>
    <Campo rotulo={anamnese ? 'Nome da anamnese' : 'Nome do questionário'} valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={400} />
    {anamnese ? <Texto variante="suave">Começa com uma seção vazia. Use seções para dividir (dados, rotina, treino, alimentação) e condições para mostrar perguntas só quando fazem sentido.</Texto> : <>
      <Escolha rotulo="Começar de" valor={origem} aoMudar={setOrigem} opcoes={[{ valor: 'FABRICA', rotulo: 'Modelo da plataforma' }, { valor: 'VAZIO', rotulo: 'Em branco' }]} />
      <Texto variante="suave">{origem === 'FABRICA' ? 'Traz as perguntas do questionário original para você ajustar.' : 'Começa com uma seção vazia.'}</Texto>
    </>}
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}

const estilos = StyleSheet.create({
  busca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1) },
  campoBusca: { flexGrow: 1, flexBasis: 240 },
  seletor: { alignSelf: 'flex-end' },
});
