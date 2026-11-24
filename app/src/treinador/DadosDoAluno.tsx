import { Copy, Pencil } from 'lucide-react-native';
import { Fragment, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { alterarAluno, escolherQuestionarioDoAluno, opcoesDeQuestionario, responsaveisEquipe } from '../api/rotas';
import type { AlunoDetalhe } from '../api/tipos';
import { enderecoParaLeitura, NAO_INFORMADO, NOTA_TELEFONE_SEM_ACESSO, SECOES_DO_ALUNO } from '../dominio/cadastroDoAluno';
import { SECOES_DOS_DADOS, type SecaoDosDados } from '../dominio/colunasDaFicha';
import { linkParaFalarComOTreinador } from '../dominio/contatoDaConsultoria';
import { dataParaTela } from '../dominio/formatos';
import { textoDaMeta } from '../dominio/metaDoPesoNaFicha';
import { textoDoCiclo } from '../dominio/periodo';
import { linhaDosPlanosAtivos } from '../dominio/planosAtivos';
import { textoDoQuestionarioEscolhido } from '../dominio/seletorQuestionario';
import { rotuloDoSexo } from '../dominio/sexo';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR_DE_CAMPOS } from '../tema/tokens';
import { abrirLinkExterno } from '../ui/abrirLinkExterno';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { IconeBotao } from '../ui/IconeBotao';
import { IconeWhatsApp } from '../ui/IconeWhatsApp';
import { LinkTexto } from '../ui/LinkTexto';
import { LinhaDeDado, ListaDeDados, SubtituloDeDados } from '../ui/ListaDeDados';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { ColunasDaFicha, type ColunaDaFicha } from './BlocosDaFicha';
import { LinhaDoCicloNaFicha } from './ciclo/CicloNaFicha';
import { copiarTexto } from './financeiro/comum';
import { GrupoDoAlunoNaFicha } from './comunidade/GrupoDoAlunoNaFicha';
import { FormAluno } from './FormAluno';
import { SeletorDeQuestionario } from './questionarios/SeletorDeQuestionario';
import { CampoDeTags } from './tags/CampoDeTags';
import { ChipDeTag } from './tags/ChipDeTag';
import { nomesDasTags } from './tags/textosDasTags';

const PADRAO = 'Padrão da consultoria';

/**
 * Dados do aluno, no topo da aba Ficha do aluno: as quatro seções de `SECOES_DO_ALUNO`, iguais na consulta e na edição
 * (pedido do Gustavo de 12/11), nas colunas da aba quando cabem (o lugar de cada seção vem de `colunasDaAbaDados`: em duas,
 * 1 e 2 à esquerda, 3 e 4 à direita; em três, 1, 2 e 4 na primeira e 3 na última) e numa só no celular, na mesma ordem. Leitura numa `ListaDeDados` por cartão (24/11): rótulo à esquerda, valor e a coluna de ações à direita,
 * fio entre as linhas; dado ausente é "Não informado" e o herdado, "Padrão da consultoria".
 * CPF, endereço e a seção 4 inteira só com `ALUNO_SENSIVEL_LER`: sem ela a linha ou a seção somem, sem título vazio.
 * Um único "Editar dados" abre o formulário no lugar (`FormAluno`). A edição é da ficha (`editando`): ela é um passo do
 * histórico e o `?editar=1` do lápis da lista de alunos também mora lá. No contato, copiar telefone e e-mail e abrir o
 * WhatsApp (`BotoesDeContato`), só com valor. Tags (`docs/planos/tags-de-aluno.md`, D10) na Configuração do acompanhamento,
 * logo depois do questionário e no mesmo padrão dele: na leitura, os chips; na edição, o `CampoDeTags`, que grava na hora.
 */
export function DadosDoAluno({ aluno, padrao, aoAlterar, editando, aoEditar, colunas }: {
  aluno: AlunoDetalhe; padrao: number | null; aoAlterar: (a: AlunoDetalhe) => void; editando: boolean; aoEditar: (editando: boolean) => void;
  /** As colunas da aba: as seções de cada uma e os blocos que as seguem (Ficha › Dados em duas ou três, `BlocosDaFicha`). */
  colunas?: ColunaDaFicha[];
}) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  // "Cancelar" com algum campo mudado pergunta "Descartar alterações?" (não é sair da ficha). Sem alteração, fecha na hora.
  const { pendente } = useSaidaGuardada();
  const setEditando = aoEditar;
  const [descartar, setDescartar] = useState(false);
  const podeEditar = !aluno.anonimizado && pode('ALUNO_ALTERAR');
  // As mesmas permissões do `SeletorDeQuestionario`: sem elas (ou com 403 nas opções) a linha do questionário some.
  const podeVerQuestionario = pode('QUESTIONARIO_LER') || pode('ALUNO_ALTERAR') || pode('PASTA_ALTERAR');
  const questionarios = useCarregar(podeVerQuestionario ? 'questionarios-opcoes' : null, () => opcoesDeQuestionario());
  const comQuestionario = podeVerQuestionario && !(questionarios.erro instanceof ErroApi && questionarios.erro.status === 403);

  return (
    <View style={estilos.dados}>
      <View style={estilos.topo}>
        <Texto variante="bloco" nivel={2} style={estilos.titulo}>Dados do aluno</Texto>
        {editando || !podeEditar ? null : <Botao rotulo="Editar dados" tipo="secundario" Icone={Pencil} aoTocar={() => setEditando(true)} />}
      </View>
      {/* O formulário fica no teto do editor de campos também com a aba em três colunas (4.10). */}
      {editando ? (
        <View style={estilos.formulario}><FormAluno
          inicial={aluno}
          nivel={3}
          diasPadrao={padrao}
          rotuloSalvar="Salvar"
          aoCancelar={() => { if (pendente()) setDescartar(true); else setEditando(false); }}
          // O questionário fica na seção do acompanhamento, mas grava na hora (não espera o Salvar), como antes.
          noAcompanhamento={(
            <>
              {comQuestionario ? (
                <View style={estilos.comAjuda}>
                  <SeletorDeQuestionario rotulo="Questionário de atualização" valor={aluno.questionarioId} rotuloDoNulo={PADRAO} podeAlterar={pode('ALUNO_ALTERAR')}
                    aoEscolher={async (questionarioId) => { aoAlterar(await escolherQuestionarioDoAluno(aluno.id, questionarioId)); avisar('Questionário trocado.', 'sucesso'); }} />
                  <Texto variante="pequeno">Troca na hora, sem esperar o Salvar.</Texto>
                </View>
              ) : null}
              {podeEditar ? <CampoDeTags aluno={aluno} aoAlterar={aoAlterar} /> : null}
            </>
          )}
          aoSalvar={async (dados) => {
            const a = await alterarAluno(aluno.id, dados);
            aoAlterar(a);
            setEditando(false);
            avisar('Dados salvos.', 'sucesso');
          }}
        /></View>
      ) : null}
      {!editando || colunas ? (
        <Leitura aluno={aluno} padrao={padrao} questionario={comQuestionario ? questionarios : null} aoAlterar={aoAlterar} editando={editando} colunas={colunas} />
      ) : null}
      <PainelConfirmacao
        visivel={descartar}
        titulo="Descartar alterações?"
        mensagem="Há alterações que ainda não foram salvas. Se descartar agora, elas serão perdidas."
        rotuloConfirmar="Descartar"
        rotuloCancelar="Continuar editando"
        perigo
        aoConfirmar={() => { setDescartar(false); setEditando(false); }}
        aoCancelar={() => setDescartar(false)}
      />
    </View>
  );
}

type Questionarios = ReturnType<typeof useCarregar<Awaited<ReturnType<typeof opcoesDeQuestionario>>>>;

function Leitura({ aluno, padrao, questionario, aoAlterar, editando, colunas }: {
  aluno: AlunoDetalhe; padrao: number | null; questionario: Questionarios | null; aoAlterar: (a: AlunoDetalhe) => void;
  editando: boolean; colunas?: ColunaDaFicha[];
}) {
  const { pode, pagamentosHabilitados } = useSessao();
  const sensivel = pode('ALUNO_SENSIVEL_LER');
  const tags = aluno.tags ?? [];
  // Sem tags, a linha só aparece para quem pode pôr uma (com "Não informado"); quem só lê não vê linha vazia.
  const comTags = tags.length > 0 || (!aluno.anonimizado && pode('ALUNO_ALTERAR'));
  const responsaveis = useCarregar('responsaveis-ficha', () => responsaveisEquipe());
  const responsavel = !aluno.responsavelId ? 'Sem responsável'
    : responsaveis.dados ? (responsaveis.dados.find((r) => r.id === aluno.responsavelId)?.nome ?? 'Membro inativo')
      : responsaveis.erro ? textoDoErro(responsaveis.erro) : 'Carregando…';
  const textoDoQuestionario = !questionario ? null
    : questionario.dados ? textoDoQuestionarioEscolhido(aluno.questionarioId, questionario.dados, PADRAO)
      : !aluno.questionarioId ? PADRAO : questionario.erro ? textoDoErro(questionario.erro) : 'Carregando…';
  const linhaDosPlanos = linhaDosPlanosAtivos(aluno.planosAtivos);
  const comGrupo = pode('COMUNIDADE_MODERAR');
  // A coluna de ações só existe com ação dentro (uma vazia tiraria o vão do valor).
  const comFinanceiro = pode('FINANCEIRO_LER') && pagamentosHabilitados;
  // Em colunas os cartões da aba ficam lado a lado com as seções: o mesmo nível de título, na ordem do DOM.
  const nivel = colunas ? 2 : 3;
  const secoes: Record<SecaoDosDados, ReactNode> = {
    identificacao: (
        <Cartao titulo={SECOES_DO_ALUNO.identificacao} nivel={nivel}>
          <ListaDeDados>
            <Par rotulo="Nome" valor={aluno.nome} />
            <Par rotulo="Data de nascimento" valor={dataParaTela(aluno.dataNascimento ?? null)} numerico />
            <Par rotulo="Sexo" valor={aluno.sexo ? rotuloDoSexo(aluno.sexo) : null} />
            {sensivel ? <Par rotulo="CPF" valor={aluno.cpf} numerico /> : null}
          </ListaDeDados>
        </Cartao>
    ),
    contato: (
        <Cartao titulo={SECOES_DO_ALUNO.contato} nivel={nivel}>
          <ListaDeDados>
            <Par rotulo="E-mail" valor={aluno.email} acoes={aluno.email?.trim() ? <BotoesDeContato tipo="email" valor={aluno.email} nome={aluno.nome} /> : undefined} />
            <Par rotulo="Telefone" valor={aluno.telefone} numerico
              nota={!aluno.temAcesso && !aluno.anonimizado ? NOTA_TELEFONE_SEM_ACESSO : undefined}
              acoes={aluno.telefone?.trim() ? <BotoesDeContato tipo="telefone" valor={aluno.telefone} nome={aluno.nome} /> : undefined} />
            {sensivel ? <Par rotulo="Endereço" valor={enderecoParaLeitura(aluno.endereco)} /> : null}
          </ListaDeDados>
        </Cartao>
    ),
    acompanhamento: (
        <Cartao titulo={SECOES_DO_ALUNO.acompanhamento} nivel={nivel}>
          {/* Os grupos e a ordem do pedido de 24/11; PLANO e COMUNIDADE só aparecem com a linha deles. */}
          <ListaDeDados>
            <SubtituloDeDados>Acompanhamento</SubtituloDeDados>
            <Par rotulo="Treinador responsável" valor={responsavel}
              nota={responsaveis.erro ? <MensagemErro texto={textoDoErro(responsaveis.erro)} tentarDeNovo={responsaveis.recarregar} /> : undefined} />
            {textoDoQuestionario ? <Par rotulo="Questionário de atualização" valor={textoDoQuestionario} /> : null}
            <Par rotulo="Nova atualização a cada" valor={textoDoCiclo(aluno.diasAtualizacao, padrao)} numerico />
            {comTags ? (
              <Par rotulo="Tags" valor={nomesDasTags(tags)}
                conteudo={tags.length ? <View style={estilos.tags}>{tags.map((t) => <ChipDeTag key={t.id} tag={t} />)}</View> : undefined} />
            ) : null}
            {/* Por último no grupo: some sozinha (acompanhamento desligado), e o fio só fica entre linhas que existem. */}
            <LinhaDoCicloNaFicha alunoId={aluno.id} />
            {linhaDosPlanos ? <SubtituloDeDados>Plano</SubtituloDeDados> : null}
            {linhaDosPlanos ? <Par rotulo="Planos ativos" valor={linhaDosPlanos} acoes={comFinanceiro ? <VerNoFinanceiro alunoId={aluno.id} /> : undefined} /> : null}
            {comGrupo ? <SubtituloDeDados>Comunidade</SubtituloDeDados> : null}
            {comGrupo ? <GrupoDoAlunoNaFicha aluno={aluno} aoAlterar={aoAlterar} /> : null}
          </ListaDeDados>
        </Cartao>
    ),
    objetivo: sensivel ? (
          <Cartao titulo={SECOES_DO_ALUNO.objetivo} nivel={nivel}>
            <ListaDeDados>
              <Par rotulo="Objetivo" valor={aluno.objetivo} />
              <Par rotulo="Meta do peso" valor={textoDaMeta(aluno.metaDoPeso)} />
              <Par rotulo="Observações" valor={aluno.observacoes} />
            </ListaDeDados>
          </Cartao>
    ) : null,
  };
  // Com `colunas` (a aba em duas ou três colunas, `BlocosDaFicha`, 24/11) as seções abrem cada coluna e os blocos da aba vêm
  // logo embaixo, na mesma pilha; editando, o formulário fica em cima e as colunas só com os blocos, que continuam montados
  // (as chaves não mudam). Sem `colunas` (a faixa compacta), uma coluna só: 1, 2, 3 e 4, na ordem do celular.
  if (!colunas) return <View style={estilos.numaColuna}>{SECOES_DOS_DADOS.map((s) => <Fragment key={s}>{secoes[s]}</Fragment>)}</View>;
  return (
    <ColunasDaFicha colunas={colunas.map((c) => ({
      proporcao: c.proporcao, teto: c.teto,
      conteudo: [
        ...(editando ? [] : c.secoes.filter((s) => secoes[s]).map((s) => <Fragment key={s}>{secoes[s]}</Fragment>)),
        ...c.blocos,
      ],
    }))} />
  );
}

/** Linha dos Dados do aluno: a `LinhaDeDado` com o "Não informado" da ficha no lugar do valor ausente. */
function Par(props: Omit<ComponentProps<typeof LinhaDeDado>, 'vazio'>) {
  return <LinhaDeDado vazio={NAO_INFORMADO} {...props} />;
}

/**
 * "Ver no Financeiro" da linha "Planos ativos" (D13; a linha vem de `linhaDosPlanosAtivos`, da contratação ATIVA, e some sem
 * ela): o mesmo destino do cartão Plano contratado; quem chama só o põe para quem lê o financeiro.
 */
function VerNoFinanceiro({ alunoId }: { alunoId: string }) {
  return <LinkTexto texto="Ver no Financeiro" href={`/treinador/financeiro?aba=cobrancas&alunoId=${encodeURIComponent(alunoId)}` as never} />;
}

/**
 * Contato do aluno (18/11): "Copiar e-mail", "Copiar telefone" e "Abrir WhatsApp" (`wa.me/55…` fora do app, sem token e sem
 * texto pronto; o número é o de `linkParaFalarComOTreinador`, que só aceita DDD + número). Sem valor nada aparece; telefone
 * que não vira número de WhatsApp fica só com o copiar. Copiar avisa se o navegador recusou.
 */
function BotoesDeContato({ tipo, valor, nome }: { tipo: 'email' | 'telefone'; valor: string | null | undefined; nome: string }) {
  const { avisar } = useAviso();
  const texto = valor?.trim();
  if (!texto) return null;
  const oQue = tipo === 'email' ? 'E-mail' : 'Telefone';
  const whatsapp = tipo === 'telefone' ? linkParaFalarComOTreinador(texto) : null;
  const copiar = () => {
    void copiarTexto(texto).then((ok) => avisar(ok ? `${oQue} copiado.` : 'Não foi possível copiar. Selecione e copie à mão.', ok ? 'sucesso' : 'perigo'));
  };
  return (
    <View style={estilos.botoes}>
      <IconeBotao Icone={Copy} moldura rotulo={`Copiar ${oQue.toLowerCase()} de ${nome}`} aoTocar={copiar} />
      {whatsapp ? (
        <IconeBotao Icone={IconeWhatsApp} moldura rotulo={`Abrir WhatsApp de ${nome}`}
          aoTocar={() => { void abrirLinkExterno(whatsapp).then((ok) => { if (!ok) avisar('Não foi possível abrir o WhatsApp. Copie o telefone e chame pelo aplicativo.', 'perigo'); }); }} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  botoes: { flexDirection: 'row', gap: espaco(0.5) },
  dados: { gap: espaco(2) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1), minHeight: 44 },
  titulo: { flexShrink: 1 },
  formulario: { maxWidth: LARGURA_EDITOR_DE_CAMPOS },
  // Faixa compacta: as quatro seções numa coluna, na ordem do celular (24/11; em colunas, `ColunasDaFicha`).
  numaColuna: { gap: espaco(3) },
  comAjuda: { gap: espaco(0.5) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75), paddingTop: 2 },
});
