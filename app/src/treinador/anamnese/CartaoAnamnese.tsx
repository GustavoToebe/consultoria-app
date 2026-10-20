import { ClipboardList, Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import {
  anamnesesDoAluno, aplicarAlteracaoDaAnamnese, atribuirAnamnese, baixarFotoDaAnamnese, descartarAlteracaoDaAnamnese, detalheAnamnese,
  dispensarAnamnese, opcoesDeQuestionario, revisarAnamnese,
} from '../../api/rotas';
import type { AlteracaoDoCadastro, AnamneseDetalhe } from '../../api/tipos';
import { QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import {
  linhaDaAnamnese, permissaoDeLeituraDoDestino, permissaoDoDestino, ROTULO_DO_DESTINO, seloDaAlteracao, seloDaAnamnese, temPendente, textoDoValor, textoParaRevisar,
} from '../../dominio/anamnese';
import { dataHoraParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Cartão "Anamnese" da ficha do aluno (`ANAMNESE_LER`; a rota também exige `ALUNO_SENSIVEL_LER`). Mostra as anamneses
 * enviadas ao aluno, abre as respostas (a versão respondida, com imagens e fotos; "—" sem resposta, "Não se aplica"
 * para a escondida por condição), marca como revisada e dispensa com motivo. "Enviar anamnese" (`ANAMNESE_ALTERAR`)
 * escolhe um questionário de anamnese publicado. Respostas que alimentam o cadastro (peso, objetivo): o que estava vazio
 * já foi preenchido no envio; o que difere aparece como "N alterações do cadastro para revisar", com Aplicar/Descartar
 * por item (`ANAMNESE_ALTERAR` + `ALUNO_SENSIVEL_ALTERAR`). Respostas são dado sensível: nada vai para log.
 */
export function CartaoAnamnese({ alunoId, anonimizado, aoMudarCadastro }: { alunoId: string; anonimizado: boolean; aoMudarCadastro?: () => void }) {
  const { pode } = useSessao();
  const lista = useCarregar(`anamneses:${alunoId}`, () => anamnesesDoAluno(alunoId));
  const [enviar, setEnviar] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  if (lista.erro instanceof ErroApi && lista.erro.status === 403) return null;
  const podeAlterar = pode('ANAMNESE_ALTERAR');
  const pendente = temPendente(lista.dados ?? []);
  return <Cartao titulo="Anamnese" descricao="Questionário inicial que o aluno responde no app. A versão enviada não muda depois."
    acoes={podeAlterar && !anonimizado ? <Botao rotulo="Enviar anamnese" tipo="secundario" Icone={Send} desabilitado={pendente || !lista.dados}
      motivo={pendente ? 'Já há uma anamnese aguardando o aluno. Dispense-a para enviar outra.' : 'Carregando.'} aoTocar={() => setEnviar(true)} /> : undefined}>
    {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} tentarDeNovo={lista.recarregar} /> : null}
    {!lista.dados && lista.carregando ? <Esqueleto cartoes={1} /> : null}
    {lista.dados?.length === 0 ? <Texto variante="suave">Nenhuma anamnese enviada a este aluno. Usar a anamnese é opcional.</Texto> : null}
    {lista.dados?.map((a) => {
      const revisar = textoParaRevisar(a.alteracoesParaRevisar);
      return <ItemDeLista key={a.id} titulo={a.questionarioNome}
        detalhe={[`${linhaDaAnamnese(a)} · v${a.questionarioVersaoNumero}`, revisar].filter(Boolean).join(' · ')}
        Icone={ClipboardList} selo={seloDaAnamnese(a.situacao)} aoTocar={() => setAberta(a.id)} />;
    })}
    {enviar ? <FolhaEnviar alunoId={alunoId} aoFechar={() => setEnviar(false)} aoEnviar={() => { setEnviar(false); lista.recarregar(); }} /> : null}
    {aberta ? <FolhaDaAnamnese id={aberta} podeAlterar={podeAlterar} aoFechar={() => setAberta(null)} aoMudar={lista.recarregar}
      aoMudarCadastro={aoMudarCadastro} /> : null}
  </Cartao>;
}

function FolhaEnviar({ alunoId, aoFechar, aoEnviar }: { alunoId: string; aoFechar: () => void; aoEnviar: () => void }) {
  const { avisar } = useAviso();
  const opcoes = useCarregar('anamneses-opcoes', () => opcoesDeQuestionario('ANAMNESE'));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const padrao = opcoes.dados?.find((o) => o.padrao)?.id ?? opcoes.dados?.[0]?.id ?? null;
  const questionario = escolhido ?? padrao;
  const confirmar = () => {
    if (!questionario) return;
    setEnviando(true);
    atribuirAnamnese(alunoId, questionario).then(() => {
      avisar('Anamnese enviada. O aluno vê no início do app.', 'sucesso');
      aoEnviar();
    }, (e: unknown) => {
      if (e instanceof ErroApi && e.codigo === 'QUESTIONARIO_INDISPONIVEL') opcoes.recarregar();
      avisar(textoDoErro(e), 'perigo');
    }).finally(() => setEnviando(false));
  };
  return <Folha visivel titulo="Enviar anamnese" aoFechar={aoFechar}
    rodape={<Botao rotulo="Enviar ao aluno" carregando={enviando} desabilitado={!questionario} motivo="Escolha a anamnese." aoTocar={confirmar} />}>
    {opcoes.erro ? <MensagemErro texto={textoDoErro(opcoes.erro)} tentarDeNovo={opcoes.recarregar} /> : null}
    {!opcoes.dados && opcoes.carregando ? <Esqueleto cartoes={1} /> : null}
    {opcoes.dados?.length === 0 ? <View style={estilos.bloco}>
      <Texto>Nenhuma anamnese publicada ainda.</Texto>
      <LinkTexto texto="Criar em Planejamento › Anamnese" href="/treinador/planejamento?aba=anamnese" />
    </View> : null}
    {opcoes.dados?.length ? <>
      <EscolhaEmFolha rotulo="Anamnese" titulo="Anamnese" valor={questionario} opcoes={opcoes.dados.map((o) => ({ valor: o.id, rotulo: o.padrao ? `${o.nome} (padrão)` : o.nome }))}
        aoMudar={setEscolhido} />
      <Texto variante="suave">O aluno responde no app (ou na web), logado. A versão publicada agora fica presa a este envio: se você publicar outra depois, ele continua respondendo esta.</Texto>
    </> : null}
  </Folha>;
}

function FolhaDaAnamnese({ id, podeAlterar, aoFechar, aoMudar, aoMudarCadastro }: {
  id: string; podeAlterar: boolean; aoFechar: () => void; aoMudar: () => void; aoMudarCadastro?: () => void;
}) {
  const { avisar } = useAviso();
  const detalhe = useCarregar(`anamnese:${id}`, () => detalheAnamnese(id));
  const [dispensar, setDispensar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const a = detalhe.dados;
  const agir = (acao: () => Promise<AnamneseDetalhe>, mensagem: string) => {
    setOcupado(true);
    acao().then((novo) => { detalhe.definir(novo); aoMudar(); avisar(mensagem, 'sucesso'); setDispensar(false); setMotivo(''); },
      (e: unknown) => { avisar(textoDoErro(e), 'perigo'); if (e instanceof ErroApi && e.status === 409) detalhe.recarregar(); })
      .finally(() => setOcupado(false));
  };
  return <Folha visivel titulo={a?.questionarioNome ?? 'Anamnese'} largura={LARGURA_EDITOR} aoFechar={aoFechar}>
    {detalhe.erro ? <MensagemErro texto={textoDoErro(detalhe.erro)} tentarDeNovo={detalhe.recarregar} /> : null}
    {!a && detalhe.carregando ? <Esqueleto /> : null}
    {a ? <>
      <View style={estilos.selos}>
        <Selo {...seloDaAnamnese(a.situacao)} />
        <Selo texto={`Versão ${a.questionarioVersaoNumero}`} tipo="neutro" />
      </View>
      <View style={estilos.bloco}>
        <Texto variante="suave">{`Enviada ao aluno em ${dataHoraParaTela(a.atribuidaEm)}${a.atribuidaPorNome ? ` por ${a.atribuidaPorNome}` : ''}.`}</Texto>
        {a.enviadaEm ? <Texto variante="suave">{`Respondida pelo aluno em ${dataHoraParaTela(a.enviadaEm)}.`}</Texto> : null}
        {a.revisadaEm ? <Texto variante="suave">{`Revisada em ${dataHoraParaTela(a.revisadaEm)}${a.revisadaPorNome ? ` por ${a.revisadaPorNome}` : ''}.`}</Texto> : null}
        {a.dispensadaEm ? <Texto variante="suave">{`Dispensada em ${dataHoraParaTela(a.dispensadaEm)}${a.dispensadaPorNome ? ` por ${a.dispensadaPorNome}` : ''}. Motivo: ${a.dispensaMotivo ?? '—'}`}</Texto> : null}
      </View>
      {podeAlterar ? <LinhaDeAcoes>
        {a.situacao === 'ENVIADA' ? <Botao rotulo="Marcar como revisada" carregando={ocupado} aoTocar={() => agir(() => revisarAnamnese(a.id, a.versao), 'Anamnese marcada como revisada.')} /> : null}
        {a.situacao === 'PENDENTE' ? <Botao rotulo="Dispensar" tipo="perigoTexto" aoTocar={() => setDispensar(true)} /> : null}
      </LinhaDeAcoes> : null}
      {a.alteracoes?.length ? <AlteracoesDoCadastro anamnese={a} podeAlterar={podeAlterar} aoMudar={(novo) => { detalhe.definir(novo); aoMudar(); aoMudarCadastro?.(); }}
        aoConflito={detalhe.recarregar} /> : null}
      {a.situacao === 'PENDENTE' ? <Texto>Aguardando o aluno responder.</Texto>
        : a.situacao === 'DISPENSADA' && !a.enviadaEm ? null
        : <QuestionarioAtualizacao modelo={a.modelo} respostas={a.respostas ?? {}} carregarFotoDaEquipe={(foto) => baixarFotoDaAnamnese(a.id, foto)} />}
      <PainelConfirmacao visivel={dispensar} titulo="Dispensar esta anamnese?" mensagem="O aluno deixa de ver o pedido. Fica registrado quem dispensou e o motivo."
        rotuloConfirmar="Dispensar" perigo carregando={ocupado} desabilitado={!motivo.trim()} motivo="Escreva o motivo."
        aoCancelar={() => setDispensar(false)} aoConfirmar={() => agir(() => dispensarAnamnese(a.id, motivo.trim(), a.versao), 'Anamnese dispensada.')}>
        <Campo rotulo="Motivo" valor={motivo} aoMudar={setMotivo} maxLength={300} linhas={2} />
      </PainelConfirmacao>
    </> : null}
  </Folha>;
}

/**
 * O que a anamnese fez no cadastro: preenchido no envio (campo vazio), aplicado, descartado ou, quando o cadastro já
 * tinha outro valor, "Para revisar" com o atual ao lado do proposto. Aplicar e descartar pedem confirmação no painel e
 * exigem também a permissão do campo (sem ela, só a leitura). A resposta original continua logo abaixo, nas respostas.
 */
function AlteracoesDoCadastro({ anamnese: a, podeAlterar, aoMudar, aoConflito }: {
  anamnese: AnamneseDetalhe; podeAlterar: boolean; aoMudar: (novo: AnamneseDetalhe) => void; aoConflito: () => void;
}) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [confirmar, setConfirmar] = useState<{ alteracao: AlteracaoDoCadastro; acao: 'aplicar' | 'descartar' } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // CPF e endereço são dado sensível mesmo só para ler (a API já limita a lista a quem lê a anamnese, que depende dessa permissão).
  const alteracoes = (a.alteracoes ?? []).filter((x) => pode(permissaoDeLeituraDoDestino(x.destino)));
  const podeAgirEm = (x: AlteracaoDoCadastro) => podeAlterar && pode(permissaoDoDestino(x.destino));
  const pendentes = alteracoes.filter((x) => x.situacao === 'PENDENTE').length;
  const agir = () => {
    if (!confirmar) return;
    const { alteracao, acao } = confirmar;
    setOcupado(true);
    (acao === 'aplicar' ? aplicarAlteracaoDaAnamnese(a.id, alteracao.id) : descartarAlteracaoDaAnamnese(a.id, alteracao.id)).then((novo) => {
      setConfirmar(null);
      aoMudar(novo);
      avisar(acao === 'aplicar' ? 'Cadastro atualizado.' : 'Alteração descartada. O cadastro ficou como estava.', 'sucesso');
    }, (e: unknown) => {
      setConfirmar(null);
      avisar(textoDoErro(e), 'perigo');
      if (e instanceof ErroApi && e.status === 409) aoConflito();
    }).finally(() => setOcupado(false));
  };
  return <View style={estilos.bloco}>
    <Texto variante="secao">Cadastro do aluno</Texto>
    <Texto variante="suave">{pendentes
      ? 'A anamnese trouxe valores diferentes dos que já estão no cadastro. Nada foi trocado: aplique ou descarte cada um.'
      : 'Respostas que alimentam o cadastro. Campo vazio é preenchido no envio; nada é trocado sem você aplicar.'}</Texto>
    {alteracoes.map((x) => <View key={x.id} style={estilos.alteracao}>
      <View style={estilos.selos}>
        <Texto variante="rotulo">{ROTULO_DO_DESTINO[x.destino]}</Texto>
        <Selo {...seloDaAlteracao(x)} />
      </View>
      {x.situacao === 'PENDENTE' ? <>
        <Texto>{`No cadastro: ${textoDoValor(x.destino, x.valorAtual)}`}</Texto>
        <Texto>{`Na anamnese: ${textoDoValor(x.destino, x.valor)}`}</Texto>
        {podeAgirEm(x) ? <LinhaDeAcoes>
          <Botao rotulo="Aplicar ao cadastro" tipo="secundario" aoTocar={() => setConfirmar({ alteracao: x, acao: 'aplicar' })} />
          <Botao rotulo="Descartar" tipo="perigoTexto" aoTocar={() => setConfirmar({ alteracao: x, acao: 'descartar' })} />
        </LinhaDeAcoes> : <Texto variante="pequeno">{x.destino === 'TELEFONE' ? 'Seu perfil não permite alterar os dados do aluno.' : 'Seu perfil não permite alterar dados sensíveis do aluno.'}</Texto>}
      </> : <>
        <Texto>{textoDoValor(x.destino, x.valor)}</Texto>
        {x.resolvidaEm && !x.automatica ? <Texto variante="pequeno">{`${x.situacao === 'APLICADA' ? 'Aplicada' : 'Descartada'} em ${dataHoraParaTela(x.resolvidaEm)}${x.resolvidaPorNome ? ` por ${x.resolvidaPorNome}` : ''}.`}</Texto> : null}
      </>}
    </View>)}
    <PainelConfirmacao visivel={!!confirmar} titulo={confirmar?.acao === 'aplicar' ? 'Aplicar ao cadastro?' : 'Descartar esta alteração?'}
      mensagem={confirmar ? (confirmar.acao === 'aplicar'
        ? `${ROTULO_DO_DESTINO[confirmar.alteracao.destino]}: “${textoDoValor(confirmar.alteracao.destino, confirmar.alteracao.valorAtual)}” passa a ser “${textoDoValor(confirmar.alteracao.destino, confirmar.alteracao.valor)}”.`
        : 'O cadastro fica como está. A resposta continua guardada na anamnese.') : ''}
      rotuloConfirmar={confirmar?.acao === 'aplicar' ? 'Aplicar' : 'Descartar'} perigo={confirmar?.acao === 'descartar'} carregando={ocupado}
      aoCancelar={() => setConfirmar(null)} aoConfirmar={agir} />
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.5) },
  selos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
  alteracao: { gap: espaco(0.5) },
});
