import { router } from 'expo-router';
import { Archive, ArchiveRestore, Copy, Ellipsis, Pencil, Star, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  arquivarQuestionario, criarQuestionario, definirQuestionarioPadrao, desarquivarQuestionario, duplicarQuestionario, excluirQuestionario,
  listarQuestionarios, salvarQuestionario,
} from '../../api/rotas';
import type { FinalidadeQuestionario, QuestionarioDetalhe, QuestionarioResumo } from '../../api/tipos';
import { quandoPublicado } from '../../dominio/barraDoEditor';
import {
  arquivadosDaApi, chipsDosFiltros, filtrarQuestionarios, PUBLICACOES, SEM_FILTROS, semOFiltro, SITUACOES_DO_QUESTIONARIO, type ChaveDoFiltro,
  type FiltrosDeQuestionarios,
} from '../../dominio/filtrosDeQuestionarios';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas, type SeloDaLinha } from '../../ui/LinhaDaLista';
import { OpcaoCartao } from '../../ui/OpcaoCartao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { CamposFixosDaInscricao } from './CamposFixosDaInscricao';

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

/** Textos da lista por finalidade (o resto da tela é igual nas três abas). */
const TEXTOS: Record<FinalidadeQuestionario, { titulo: string; descricao: string; novo: string; buscar: string; vazio: string }> = {
  ATUALIZACAO: {
    titulo: 'Questionários de atualização', novo: 'Novo questionário', buscar: 'Buscar questionário',
    descricao: 'O check-in que o aluno responde a cada período. O padrão vale para quem não tem outro escolhido na ficha ou na pasta.',
    vazio: 'Nenhum questionário ainda.',
  },
  ANAMNESE: {
    titulo: 'Anamneses', novo: 'Nova anamnese', buscar: 'Buscar anamnese',
    descricao: 'O questionário inicial que você envia ao aluno pela ficha dele (cartão Anamnese). Ele responde no app, logado; a versão enviada não muda depois.',
    vazio: 'Nenhuma anamnese ainda. Crie uma em branco e monte as seções.',
  },
  INSCRICAO: {
    titulo: 'Perguntas da inscrição', novo: 'Novas perguntas', buscar: 'Buscar perguntas',
    descricao: 'As perguntas das páginas de inscrição, embaixo dos campos fixos. O link principal usa o padrão publicado, e outros formulários (como a Ficha rápida) podem ter link próprio em Interessados.',
    vazio: 'Nenhuma pergunta de inscrição ainda.',
  },
};

/**
 * Abas "Atualização", "Anamnese" e "Inscrição" do Planejamento. Atualização: os questionários que o aluno responde no check-in; o
 * padrão vale para quem não tem outro escolhido (na ficha do aluno ou na pasta). Anamnese: os questionários que a
 * equipe envia ao aluno pela ficha; o padrão é só o primeiro sugerido. Inscrição: as perguntas da página pública "Quero
 * ser aluno" (a página usa só o padrão) e, acima da lista, os campos fixos que o treinador pode esconder. "Novo
 * questionário" é o único botão primário.
 */
export function ListaDeQuestionarios({ finalidade = 'ATUALIZACAO', pedirNovo, aoConsumirNovo }: {
  finalidade?: FinalidadeQuestionario; pedirNovo: boolean; aoConsumirNovo: () => void;
}) {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const textos = TEXTOS[finalidade];
  // Filtros (`docs/planos/filtros-nas-listas.md`, D12): a situação vai à API; busca e publicação filtram o que veio.
  const [filtros, setFiltros] = useState<FiltrosDeQuestionarios>(SEM_FILTROS);
  const arquivados = arquivadosDaApi(filtros.situacao);
  const lista = useCarregar(`questionarios:${finalidade}:${arquivados}`, () => listarQuestionarios(arquivados, finalidade));
  const [busca, setBusca] = useState('');
  const filtrados = lista.dados ? filtrarQuestionarios(lista.dados, filtros, busca) : undefined;
  const chips = chipsDosFiltros(filtros);
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
    {finalidade === 'INSCRICAO' ? <CamposFixosDaInscricao /> : null}
    <Cartao titulo={textos.titulo} descricao={textos.descricao}
      acoes={<Permitido codigo="QUESTIONARIO_ALTERAR"><Botao rotulo={textos.novo} aoTocar={() => setNovoAberto(true)} /></Permitido>}>
      {/* Busca e o botão "Filtros" (situação e publicação), como nas outras listas. */}
      <BarraDeFiltros busca={{ valor: busca, aoMudar: setBusca, rotulo: textos.buscar, placeholder: 'Nome ou descrição' }}
        valor={filtros} aoAplicar={setFiltros} limpo={SEM_FILTROS} chips={chips} aoTirar={(chave) => setFiltros(semOFiltro(filtros, chave as ChaveDoFiltro))}
        painelLateral={{ titulo: 'Filtros de questionários' }}
        seletores={(atuais, mudar) => (
          <GrupoDoPainel titulo="Situação" primeiro>
            <Escolha rotulo="Situação" opcoes={[...SITUACOES_DO_QUESTIONARIO]} valor={atuais.situacao} aoMudar={(situacao) => mudar({ ...atuais, situacao })} />
            <Escolha rotulo="Publicação" opcoes={[...PUBLICACOES]} valor={atuais.publicacao} aoMudar={(publicacao) => mudar({ ...atuais, publicacao })} />
          </GrupoDoPainel>
        )} />
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
      {!lista.dados && lista.carregando ? <Esqueleto /> : null}
      {lista.dados?.length && filtrados?.length === 0 ? <Vazio texto={filtros.publicacao ? 'Nenhum questionário com essa busca e esses filtros.' : 'Nenhum questionário com essa busca.'}
        acao={chips.length ? { rotulo: 'Limpar filtros', aoTocar: () => setFiltros(SEM_FILTROS) } : busca ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') } : undefined} /> : null}
      {lista.dados?.length === 0 ? <Vazio texto={arquivados === true ? 'Nenhum questionário arquivado.' : textos.vazio}
        acao={chips.length ? { rotulo: 'Limpar filtros', aoTocar: () => setFiltros(SEM_FILTROS) } : undefined} /> : null}
      {filtrados?.length ? <ListaDeLinhas>{filtrados.map((q) =>
        <LinhaDoQuestionario key={q.id} q={q} ocupado={ocupado === q.id} podeAlterar={podeAlterar} aoAbrir={() => irParaEditor(q.id)} aoMenu={podeAlterar ? () => setMenu(q) : undefined} />)}</ListaDeLinhas> : null}
    </Cartao>

    {/* ⋯ da linha (bloco G): a `FolhaDeAcoes` do resto do app, com o motivo no detalhe e Excluir como item de perigo. */}
    {menu ? <FolhaDeAcoes titulo={menu.nome} aoFechar={() => setMenu(null)} acoes={[
      { rotulo: 'Duplicar', detalhe: 'Cria uma cópia do rascunho e abre no editor.', Icone: Copy, desabilitado: ocupado !== null,
        aoTocar: () => {
          const q = menu; setOcupado(q.id);
          duplicarQuestionario(q.id).then((d) => { lista.recarregar(); avisar('Questionário duplicado.', 'sucesso'); irParaEditor(d.id); }, (e: unknown) => avisar(textoDoErro(e), 'perigo'))
            .finally(() => setOcupado(null));
        } },
      !menu.padrao && !menu.arquivado && { rotulo: 'Definir como padrão', Icone: Star, desabilitado: menu.versaoPublicada === 0,
        detalhe: menu.versaoPublicada === 0 ? 'Publique o questionário antes de torná-lo o padrão.' : 'Passa a valer para quem não tem outro escolhido.',
        aoTocar: () => executar(menu, () => definirQuestionarioPadrao(menu.id), 'Padrão alterado.') },
      menu.arquivado
        ? { rotulo: 'Desarquivar', Icone: ArchiveRestore, detalhe: 'Volta para a lista e pode ser editado.',
          aoTocar: () => executar(menu, () => desarquivarQuestionario(menu.id), menu.codigoPublico ? 'Questionário desarquivado. O link continua fechado até você abri-lo de novo.' : 'Questionário desarquivado.') }
        : { rotulo: 'Arquivar', Icone: Archive, desabilitado: menu.padrao,
          detalhe: menu.padrao ? 'O padrão não pode ser arquivado. Defina outro como padrão antes.' : 'Sai da lista; quem já respondeu mantém as respostas.',
          aoTocar: () => executar(menu, () => arquivarQuestionario(menu.id), menu.publicoAberto ? 'Questionário arquivado. O link de inscrição dele foi fechado.' : 'Questionário arquivado.') },
      { rotulo: 'Excluir questionário', Icone: Trash2, perigo: true, desabilitado: menu.padrao || menu.uso.envios > 0,
        detalhe: menu.padrao ? 'O padrão não pode ser excluído.' : menu.uso.envios > 0 ? 'Já foi respondido: arquive em vez de excluir.' : undefined,
        aoTocar: () => setExcluir(menu) },
    ]} /> : null}

    {novo ? <FormularioNovo finalidade={finalidade} existentes={(lista.dados ?? []).filter((q) => !q.arquivado)} aoFechar={fecharNovo} /> : null}

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
 * vale. "Nunca publicado" não entra aqui: é selo.
 */
export function metadadosDoQuestionario(q: Pick<QuestionarioResumo, 'versaoPublicada' | 'padrao' | 'arquivado' | 'uso'> & { rascunhoAlteradoEm?: string | null }): string {
  return [q.versaoPublicada ? `Publicado v${q.versaoPublicada}` : null, q.padrao ? 'Padrão' : null, q.arquivado ? 'Arquivado' : null, linhaDeUso(q),
    q.rascunhoAlteradoEm ? `editado em ${quandoPublicado(q.rascunhoAlteradoEm)}` : null]
    .filter(Boolean).join(' · ');
}

/**
 * Selos da linha, os dois neutros, como o "Rascunho" e o "Alterações não publicadas" do editor de plano: rascunho sem
 * erro não é pendência nem problema (guia premium, pág. 8).
 */
export function selosDoQuestionario(q: Pick<QuestionarioResumo, 'versaoPublicada' | 'alteradoDesdePublicacao'>): SeloDaLinha[] {
  return [
    ...(q.versaoPublicada ? [] : [{ texto: 'Nunca publicado', tipo: 'neutro' as const }]),
    ...(q.alteradoDesdePublicacao ? [{ texto: 'Alterado desde a publicação', tipo: 'neutro' as const }] : []),
  ];
}

function LinhaDoQuestionario({ q, ocupado, podeAlterar, aoAbrir, aoMenu }: {
  q: QuestionarioResumo; ocupado: boolean; podeAlterar: boolean; aoAbrir: () => void; aoMenu?: () => void;
}) {
  return <LinhaDaLista titulo={q.nome} metadados={metadadosDoQuestionario(q)} descricao={q.descricao ?? undefined} selos={selosDoQuestionario(q)} acoes={<>
    <Botao rotulo={podeAlterar && !q.arquivado ? 'Editar' : 'Ver'} tipo="secundario" Icone={Pencil} carregando={ocupado} aoTocar={aoAbrir} />
    {aoMenu ? <IconeBotao Icone={Ellipsis} moldura rotulo={`Mais ações de ${q.nome}`} desabilitado={ocupado} aoTocar={aoMenu} /> : null}
  </>} />;
}

type Origem = 'FABRICA' | 'COPIA' | 'VAZIO';

/** Uma linha de ajuda por finalidade (bloco G: a regra de saúde da inscrição fica no `Alerta` do editor). */
const AJUDA_DO_NOVO: Record<FinalidadeQuestionario, string> = {
  ATUALIZACAO: 'Depois de publicar, defina como padrão ou escolha na ficha do aluno ou na pasta.',
  ANAMNESE: 'Depois de publicar, envie ao aluno pelo cartão Anamnese da ficha.',
  INSCRICAO: 'Depois de publicar, defina como padrão do link principal ou use num link próprio em Interessados.',
};

/**
 * "Novo" das três abas (bloco G): Nome, Descrição e "Começar de" iguais em todas. Modelo da plataforma só existe na
 * atualização; "Copiar de um existente" só com outro questionário ativo na aba. A API não cria a partir de outro: copiar
 * é duplicar e depois gravar o nome e a descrição escritos aqui (se a segunda chamada falhar, a cópia abre com o nome
 * "(cópia)" e o aviso diz isso).
 */
function FormularioNovo({ finalidade, existentes, aoFechar }: { finalidade: FinalidadeQuestionario; existentes: readonly QuestionarioResumo[]; aoFechar: () => void }) {
  const { avisar } = useAviso();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const origens: { valor: Origem; titulo: string; descricao: string }[] = [
    ...(finalidade === 'ATUALIZACAO' ? [{ valor: 'FABRICA' as const, titulo: 'Modelo da plataforma', descricao: 'As perguntas do questionário original, para você ajustar.' }] : []),
    ...(existentes.length ? [{ valor: 'COPIA' as const, titulo: 'Copiar de um existente', descricao: 'O rascunho atual de outro desta aba, com as seções e as perguntas dele.' }] : []),
    { valor: 'VAZIO', titulo: 'Em branco', descricao: 'Você monta as perguntas do zero.' },
  ];
  const [origem, setOrigem] = useState<Origem>(origens[0].valor);
  const [copiarDe, setCopiarDe] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const falta = !nome.trim() ? 'Informe o nome.' : origem === 'COPIA' && !copiarDe ? 'Escolha de qual copiar.' : undefined;

  const criar = (): Promise<QuestionarioDetalhe> => {
    const corpo = { nome: nome.trim(), descricao: descricao.trim() || null };
    if (origem !== 'COPIA' || !copiarDe) return criarQuestionario({ ...corpo, origem: origem === 'FABRICA' ? 'FABRICA' : 'VAZIO', finalidade });
    return duplicarQuestionario(copiarDe).then((copia) => salvarQuestionario(copia.id, { ...corpo, conteudo: copia.rascunho, versao: copia.versao })
      .catch(() => { avisar('A cópia foi criada, mas o nome não foi gravado. Troque o nome no editor.', 'perigo'); return copia; }));
  };

  return <Folha visivel titulo={TEXTOS[finalidade].novo} aoFechar={aoFechar} rodape={<Botao rotulo="Criar e editar" desabilitado={!!falta} motivo={falta} carregando={salvando} aoTocar={() => {
    setSalvando(true); setErro(null);
    criar().then((d) => { aoFechar(); irParaEditor(d.id); }, (e: unknown) => { setErro(e); setSalvando(false); });
  }} />}>
    <Campo rotulo={finalidade === 'ANAMNESE' ? 'Nome da anamnese' : 'Nome do questionário'} valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={400} />
    <View style={estilos.origens} role="radiogroup" aria-label="Começar de">
      <Texto variante="rotulo">Começar de</Texto>
      {origens.map((o) => <OpcaoCartao key={o.valor} titulo={o.titulo} descricao={o.descricao} selecionada={origem === o.valor} aoEscolher={() => setOrigem(o.valor)} />)}
    </View>
    {origem === 'COPIA' ? <EscolhaEmFolha rotulo="Copiar de" titulo="Copiar de" valor={copiarDe ?? ''} rotuloDoValor="Escolher"
      opcoes={existentes.map((q) => ({ valor: q.id, rotulo: q.nome }))} aoMudar={setCopiarDe} /> : null}
    <Texto variante="pequeno">{AJUDA_DO_NOVO[finalidade]}</Texto>
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}

const estilos = StyleSheet.create({
  origens: { gap: espaco(1) },
});
