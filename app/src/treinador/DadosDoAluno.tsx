import { router, useLocalSearchParams } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { alterarAluno, escolherQuestionarioDoAluno, opcoesDeQuestionario, responsaveisEquipe } from '../api/rotas';
import type { AlunoDetalhe } from '../api/tipos';
import { enderecoParaLeitura, NAO_INFORMADO, NOTA_TELEFONE_SEM_ACESSO, SECOES_DO_ALUNO } from '../dominio/cadastroDoAluno';
import { dataParaTela } from '../dominio/formatos';
import { textoDaMeta } from '../dominio/metaDoPesoNaFicha';
import { textoDoCiclo } from '../dominio/periodo';
import { textoDoQuestionarioEscolhido } from '../dominio/seletorQuestionario';
import { rotuloDoSexo } from '../dominio/sexo';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { LinhaDoCicloNaFicha } from './ciclo/CicloNaFicha';
import { GrupoDoAlunoNaFicha } from './comunidade/GrupoDoAlunoNaFicha';
import { FormAluno } from './FormAluno';
import { SeletorDeQuestionario } from './questionarios/SeletorDeQuestionario';

const PADRAO = 'Padrão da consultoria';

/**
 * Dados do aluno, no topo da aba Ficha do aluno: as quatro seções de `SECOES_DO_ALUNO`, iguais na consulta e na edição
 * (pedido do Gustavo de 12/11), em duas colunas quando cabem (1 e 2 à esquerda, 3 e 4 à direita) e numa só no celular,
 * na mesma ordem. Leitura em pares rótulo + valor; dado ausente é "Não informado" e o herdado, "Padrão da consultoria".
 * CPF, endereço e a seção 4 inteira só com `ALUNO_SENSIVEL_LER`: sem ela a linha ou a seção somem, sem título vazio.
 * Um único "Editar dados" abre o formulário no lugar (`FormAluno`). `?editar=1` (o lápis da lista de alunos) abre já
 * editando, para quem pode editar, e sai do endereço na hora: o voltar do navegador não tem passo sobrando.
 */
export function DadosDoAluno({ aluno, padrao, aoAlterar }: { aluno: AlunoDetalhe; padrao: number | null; aoAlterar: (a: AlunoDetalhe) => void }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  // "Cancelar" com algum campo mudado pergunta "Descartar alterações?" (não é sair da ficha). Sem alteração, fecha na hora.
  const { pendente } = useSaidaGuardada();
  const [editando, setEditando] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const { editar } = useLocalSearchParams<{ editar?: string }>();
  const podeEditar = !aluno.anonimizado && pode('ALUNO_ALTERAR');
  useEffect(() => {
    if (editar !== '1') return;
    let vivo = true;
    void Promise.resolve().then(() => { if (!vivo) return; if (podeEditar) setEditando(true); router.setParams({ editar: undefined, aba: 'ficha' }); });
    return () => { vivo = false; };
  }, [editar, podeEditar]);
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
      {editando ? (
        <FormAluno
          inicial={aluno}
          nivel={3}
          diasPadrao={padrao}
          rotuloSalvar="Salvar"
          aoCancelar={() => { if (pendente()) setDescartar(true); else setEditando(false); }}
          // O questionário fica na seção do acompanhamento, mas grava na hora (não espera o Salvar), como antes.
          noAcompanhamento={comQuestionario ? (
            <View style={estilos.comAjuda}>
              <SeletorDeQuestionario rotulo="Questionário de atualização" valor={aluno.questionarioId} rotuloDoNulo={PADRAO} podeAlterar={pode('ALUNO_ALTERAR')}
                aoEscolher={async (questionarioId) => { aoAlterar(await escolherQuestionarioDoAluno(aluno.id, questionarioId)); avisar('Questionário trocado.', 'sucesso'); }} />
              <Texto variante="pequeno">Troca na hora, sem esperar o Salvar.</Texto>
            </View>
          ) : null}
          aoSalvar={async (dados) => {
            const a = await alterarAluno(aluno.id, dados);
            aoAlterar(a);
            setEditando(false);
            avisar('Dados salvos.', 'sucesso');
          }}
        />
      ) : (
        <Leitura aluno={aluno} padrao={padrao} questionario={comQuestionario ? questionarios : null} />
      )}
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

function Leitura({ aluno, padrao, questionario }: { aluno: AlunoDetalhe; padrao: number | null; questionario: Questionarios | null }) {
  const { pode } = useSessao();
  const sensivel = pode('ALUNO_SENSIVEL_LER');
  const responsaveis = useCarregar('responsaveis-ficha', () => responsaveisEquipe());
  const responsavel = !aluno.responsavelId ? 'Sem responsável'
    : responsaveis.dados ? (responsaveis.dados.find((r) => r.id === aluno.responsavelId)?.nome ?? 'Membro inativo')
      : responsaveis.erro ? textoDoErro(responsaveis.erro) : 'Carregando…';
  const textoDoQuestionario = !questionario ? null
    : questionario.dados ? textoDoQuestionarioEscolhido(aluno.questionarioId, questionario.dados, PADRAO)
      : !aluno.questionarioId ? PADRAO : questionario.erro ? textoDoErro(questionario.erro) : 'Carregando…';
  return (
    <View style={estilos.colunas}>
      <View style={estilos.coluna}>
        <Cartao titulo={SECOES_DO_ALUNO.identificacao} nivel={3}>
          <Par rotulo="Nome" valor={aluno.nome} />
          <Par rotulo="Data de nascimento" valor={dataParaTela(aluno.dataNascimento ?? null)} numerico />
          <Par rotulo="Sexo" valor={aluno.sexo ? rotuloDoSexo(aluno.sexo) : null} />
          {sensivel ? <Par rotulo="CPF" valor={aluno.cpf} numerico /> : null}
        </Cartao>
        <Cartao titulo={SECOES_DO_ALUNO.contato} nivel={3}>
          <Par rotulo="E-mail" valor={aluno.email} />
          <Par rotulo="Telefone" valor={aluno.telefone} numerico
            nota={!aluno.temAcesso && !aluno.anonimizado ? NOTA_TELEFONE_SEM_ACESSO : undefined} />
          {sensivel ? <Par rotulo="Endereço" valor={enderecoParaLeitura(aluno.endereco)} /> : null}
        </Cartao>
      </View>
      <View style={estilos.coluna}>
        <Cartao titulo={SECOES_DO_ALUNO.acompanhamento} nivel={3}>
          <Par rotulo="Treinador responsável" valor={responsavel} />
          {responsaveis.erro ? <MensagemErro texto={textoDoErro(responsaveis.erro)} tentarDeNovo={responsaveis.recarregar} /> : null}
          {textoDoQuestionario ? <Par rotulo="Questionário de atualização" valor={textoDoQuestionario} /> : null}
          <Par rotulo="Nova atualização a cada" valor={textoDoCiclo(aluno.diasAtualizacao, padrao)} numerico />
          <LinhaDoCicloNaFicha alunoId={aluno.id} />
          {pode('COMUNIDADE_MODERAR') ? <GrupoDoAlunoNaFicha aluno={aluno} /> : null}
        </Cartao>
        {sensivel ? (
          <Cartao titulo={SECOES_DO_ALUNO.objetivo} nivel={3}>
            <Par rotulo="Objetivo" valor={aluno.objetivo} />
            <Par rotulo="Meta do peso" valor={textoDaMeta(aluno.metaDoPeso)} />
            <Par rotulo="Observações" valor={aluno.observacoes} />
          </Cartao>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Par de leitura da ficha: no PC rótulo numa coluna fixa e valor ao lado (os valores alinhados entre as linhas); no
 * celular rótulo em cima. Sem valor, "Não informado" em texto suave. O leitor de tela ouve "Rótulo: valor", como no
 * `CampoLeitura`. O valor tem largura de leitura (640) e quebra natural, e-mail comprido inclusive.
 */
function Par({ rotulo, valor, numerico, nota }: { rotulo: string; valor: string | null | undefined; numerico?: boolean; nota?: ReactNode }) {
  const { width } = useWindowDimensions();
  const emLinha = width >= LARGURA_MENU_LATERAL;
  const vazio = !valor?.trim();
  const texto = vazio ? NAO_INFORMADO : valor!;
  return (
    <View style={[estilos.par, emLinha && estilos.parEmLinha]} accessibilityLabel={`${rotulo}: ${texto}`}>
      <Texto variante="rotulo" style={emLinha ? estilos.rotuloEmLinha : null}>{rotulo}</Texto>
      <View style={[estilos.valor, emLinha && estilos.valorEmLinha]}>
        <Texto variante={vazio ? 'suave' : 'corpo'} numerico={numerico && !vazio}>{texto}</Texto>
        {nota ? <Texto variante="pequeno">{nota}</Texto> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  dados: { gap: espaco(2) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1), minHeight: 44 },
  titulo: { flexShrink: 1 },
  // As mesmas colunas do `FormAluno`: a seção fica no mesmo lugar ao abrir e ao fechar a edição.
  colunas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(3) },
  coluna: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, gap: espaco(3) },
  comAjuda: { gap: espaco(0.5) },
  par: { gap: espaco(0.25) },
  parEmLinha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(2) },
  // 168: cabe "Questionário de atualização" em duas linhas curtas e "Treinador responsável" numa só.
  rotuloEmLinha: { width: 168, flexShrink: 0 },
  valor: { gap: espaco(0.5), maxWidth: 640 },
  valorEmLinha: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
});
