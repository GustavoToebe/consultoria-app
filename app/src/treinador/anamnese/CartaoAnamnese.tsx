import { ClipboardList, Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import {
  anamnesesDoAluno, atribuirAnamnese, baixarFotoDaAnamnese, detalheAnamnese, dispensarAnamnese, opcoesDeQuestionario, revisarAnamnese,
} from '../../api/rotas';
import type { AnamneseDetalhe } from '../../api/tipos';
import { QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import { linhaDaAnamnese, seloDaAnamnese, temPendente } from '../../dominio/anamnese';
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
 * escolhe um questionário de anamnese publicado. Respostas são dado sensível: nada vai para log.
 */
export function CartaoAnamnese({ alunoId, anonimizado }: { alunoId: string; anonimizado: boolean }) {
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
    {lista.dados?.map((a) => <ItemDeLista key={a.id} titulo={a.questionarioNome} detalhe={`${linhaDaAnamnese(a)} · v${a.questionarioVersaoNumero}`}
      Icone={ClipboardList} selo={seloDaAnamnese(a.situacao)} aoTocar={() => setAberta(a.id)} />)}
    {enviar ? <FolhaEnviar alunoId={alunoId} aoFechar={() => setEnviar(false)} aoEnviar={() => { setEnviar(false); lista.recarregar(); }} /> : null}
    {aberta ? <FolhaDaAnamnese id={aberta} podeAlterar={podeAlterar} aoFechar={() => setAberta(null)} aoMudar={lista.recarregar} /> : null}
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

function FolhaDaAnamnese({ id, podeAlterar, aoFechar, aoMudar }: { id: string; podeAlterar: boolean; aoFechar: () => void; aoMudar: () => void }) {
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

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.5) },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
});
