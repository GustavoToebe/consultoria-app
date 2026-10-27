import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import type { AceiteInscricao, InscricaoDetalhe, PagamentoInscricao, SituacaoInscricao } from '../../api/inscricoesTipos';
import { aceitarInscricao, alterarInscricao, inscricao, notaNaInscricao, opcoesDeQuestionario, recusarInscricao } from '../../api/rotas';
import type { OpcaoQuestionario } from '../../api/tipos';
import { dataHoraParaTela, SEM_DADO } from '../../dominio/formatos';
import { rotuloDoSexo } from '../../dominio/sexo';
import {
  alunoDoConflito,
  anamneseInicialDoAceite,
  LIMITES_INSCRICAO,
  linkDoWhatsApp,
  OPCOES_PAGAMENTO,
  opcoesDeAnamneseDoAceite,
  podeAceitar,
  podeRecusar,
  seloDaSituacao,
  seloDoPagamento,
  situacoesDoAndamento,
  textoDaDuplicidade,
} from '../../dominio/inscricoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAvisoDoPlano } from '../../ui/useAvisoDoPlano';
import { useCarregar } from '../../ui/useCarregar';

const SEM_RESPONSAVEL = '';

/**
 * Uma inscrição aberta na fila: dados que a pessoa mandou, aviso de possível duplicidade, "Abrir WhatsApp" (sem texto
 * pré-preenchido: abrir não quer dizer que a mensagem foi enviada), andamento (situação, pagamento manual e
 * responsável), notas da equipe, Aceitar (cria o aluno e, se marcado, o convite de acesso) e Recusar. A API confere
 * permissão e versão em tudo; aqui só se escolhe o que mostrar.
 */
export function FolhaDaInscricao({ id, responsaveis, aoFechar, aoMudar }: {
  id: string | null;
  responsaveis: readonly ResponsavelEquipe[];
  aoFechar: () => void;
  /** A lista recarrega depois de qualquer alteração. */
  aoMudar: () => void;
}) {
  const { pode } = useSessao();
  const detalhe = useCarregar(id ? `inscricao:${id}` : null, () => inscricao(id ?? ''));
  const dados = detalhe.dados && detalhe.dados.id === id ? detalhe.dados : null;
  // A decisão (Aceitar/Recusar) fica no rodapé fixo da folha, sempre ao alcance; a confirmação continua no conteúdo.
  const [pedido, setPedido] = useState<Decisao | null>(null);
  const [decidindo, setDecidindo] = useState<Decisao | null>(null);
  const [aceitaId, setAceitaId] = useState<string | null>(null);
  const fechar = () => { setPedido(null); aoFechar(); };
  const decide = !!dados && aceitaId !== dados.id && dados.situacao !== 'ACEITA' && pode('INSCRICAO_ALTERAR');
  const podeAceitarAqui = decide && !!dados && pode('ALUNO_ALTERAR') && podeAceitar(dados.situacao);
  const podeRecusarAqui = decide && !!dados && podeRecusar(dados.situacao);
  const rodape = podeAceitarAqui || podeRecusarAqui ? (
    <>
      {podeRecusarAqui ? <Botao rotulo="Recusar" tipo="perigoTexto" aoTocar={() => setPedido('recusar')} carregando={decidindo === 'recusar'} desabilitado={!!decidindo} /> : null}
      {podeAceitarAqui ? <Botao rotulo="Aceitar" aoTocar={() => setPedido('aceitar')} carregando={decidindo === 'aceitar'} desabilitado={!!decidindo} /> : null}
    </>
  ) : undefined;
  return (
    <Folha visivel={!!id} titulo={dados?.nome ?? 'Inscrição'} aoFechar={fechar} rodape={rodape}>
      {detalhe.erro ? <MensagemErro texto={textoDoErro(detalhe.erro)} tentarDeNovo={detalhe.recarregar} erro={detalhe.erro} /> : null}
      {!dados && !detalhe.erro ? <Esqueleto /> : null}
      {dados ? (
        <Conteudo key={`${dados.id}:${dados.versao}`} dados={dados} responsaveis={responsaveis} aoFechar={fechar}
          pedido={pedido} aoFecharPedido={() => setPedido(null)} aoReabrirAceite={() => setPedido('aceitar')} aoDecidindo={setDecidindo} aoAceitar={() => setAceitaId(dados.id)}
          aoMudarLista={aoMudar} aoAtualizar={(d) => { detalhe.definir(d); aoMudar(); }}
          aoRecarregar={() => { detalhe.recarregar(); aoMudar(); }} />
      ) : null}
    </Folha>
  );
}

type Decisao = 'aceitar' | 'recusar';

function Conteudo({ dados, responsaveis, aoFechar, aoMudarLista, aoAtualizar, aoRecarregar, pedido, aoFecharPedido, aoDecidindo, aoAceitar, aoReabrirAceite }: {
  dados: InscricaoDetalhe;
  /** Botão do rodapé tocado: abre a confirmação correspondente. */
  pedido: Decisao | null;
  aoFecharPedido: () => void;
  /** O aceite fecha o painel antes de ir à API; se a API pedir outra escolha (anamnese indisponível), ele volta. */
  aoReabrirAceite: () => void;
  /** Mantém o rodapé em "carregando" enquanto a decisão vai à API. */
  aoDecidindo: (d: Decisao | null) => void;
  aoAceitar: () => void;
  responsaveis: readonly ResponsavelEquipe[];
  aoFechar: () => void;
  aoMudarLista: () => void;
  aoAtualizar: (d: InscricaoDetalhe) => void;
  aoRecarregar: () => void;
}) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const avisoDoPlano = useAvisoDoPlano(aoFechar);
  const podeAlterar = pode('INSCRICAO_ALTERAR');
  const podeCadastrar = podeAlterar && pode('ALUNO_ALTERAR');
  const podeConvidar = pode('ALUNO_CONVITE');
  const podeVerAluno = pode('ALUNO_LER');

  const [situacao, setSituacao] = useState<SituacaoInscricao>(dados.situacao);
  const [pagamento, setPagamento] = useState<PagamentoInscricao>(dados.pagamento);
  const [responsavelId, setResponsavelId] = useState(dados.responsavelId ?? SEM_RESPONSAVEL);
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState<'andamento' | 'nota' | 'aceitar' | 'recusar' | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [alunoExistente, setAlunoExistente] = useState<string | null>(null);
  const [convidar, setConvidar] = useState(podeConvidar);
  const [aceite, setAceite] = useState<AceiteInscricao | null>(null);
  // Anamnese enviada junto com o aceite: `undefined` = a pessoa ainda não mexeu (vale a padrão publicada, sem efeito).
  const [anamneseEscolhida, setAnamneseEscolhida] = useState<string | null | undefined>(undefined);
  const podeEnviarAnamnese = pode('ANAMNESE_LER') && pode('ANAMNESE_ALTERAR') && pode('ALUNO_SENSIVEL_LER');
  const opcoes = useCarregar(pedido === 'aceitar' && podeEnviarAnamnese ? 'aceite:anamneses' : null, () => opcoesDeQuestionario('ANAMNESE'));
  const semAcessoAsAnamneses = opcoes.erro instanceof ErroApi && opcoes.erro.status === 403;
  const anamneseDoAceite = anamneseEscolhida !== undefined ? anamneseEscolhida : anamneseInicialDoAceite(opcoes.dados ?? []);

  const mudouAndamento = situacao !== dados.situacao || pagamento !== dados.pagamento
    || responsavelId !== (dados.responsavelId ?? SEM_RESPONSAVEL);
  const whatsapp = linkDoWhatsApp(dados.whatsapp);
  const duplicidade = textoDaDuplicidade(dados.duplicidade);
  const situacaoTela = seloDaSituacao(dados.situacao);
  const pagamentoTela = seloDoPagamento(dados.pagamento);

  /** Erro comum: conflito de versão recarrega; limite do plano vai para o aviso do plano; o resto fica na folha. */
  const falhou = (e: unknown) => {
    setOcupado(null);
    aoDecidindo(null);
    const aluno = alunoDoConflito(e);
    if (aluno) {
      setAlunoExistente(aluno);
      setErro(e);
      return;
    }
    if (codigoApi(e) === 'QUESTIONARIO_INDISPONIVEL') {
      // Nada foi criado: a anamnese escolhida saiu do ar. Recarrega as opções e devolve o painel para a pessoa escolher outra.
      avisar('Essa anamnese não está mais disponível. Escolha outra.', 'neutro');
      opcoes.recarregar();
      setAnamneseEscolhida(undefined);
      aoReabrirAceite();
      return;
    }
    if (codigoApi(e) === 'CONFLITO_EDICAO') {
      avisar('A inscrição foi alterada em outro lugar. Recarregamos para você conferir.', 'neutro');
      aoRecarregar();
      return;
    }
    if (avisoDoPlano(e)) return;
    setErro(e);
  };

  const executar = (tipo: 'andamento' | 'nota' | 'recusar', acao: () => Promise<InscricaoDetalhe>, sucesso: string) => {
    setOcupado(tipo);
    setErro(null);
    setAlunoExistente(null);
    acao().then((d) => {
      setOcupado(null);
      aoDecidindo(null);
      if (tipo === 'nota') setNota('');
      avisar(sucesso, 'sucesso');
      aoAtualizar(d);
    }, falhou);
  };

  const salvarAndamento = () => executar('andamento', () => alterarInscricao(dados.id, {
    situacao, pagamento, responsavelId: responsavelId || null, versao: dados.versao,
  }), 'Andamento salvo.');

  const acrescentarNota = () => {
    if (!nota.trim()) return;
    executar('nota', () => notaNaInscricao(dados.id, nota.trim()), 'Nota acrescentada.');
  };

  const recusar = () => {
    aoFecharPedido();
    aoDecidindo('recusar');
    executar('recusar', () => recusarInscricao(dados.id, dados.versao), 'Inscrição recusada.');
  };

  const aceitar = () => {
    aoFecharPedido();
    aoDecidindo('aceitar');
    setOcupado('aceitar');
    setErro(null);
    setAlunoExistente(null);
    aceitarInscricao(dados.id, {
      convidar: convidar && podeConvidar,
      anamneseQuestionarioId: podeEnviarAnamnese ? anamneseDoAceite : null,
      versao: dados.versao,
    }).then((r) => {
      setOcupado(null);
      aoDecidindo(null);
      aoAceitar();
      // O código do convite só existe nesta resposta: fica na folha até ela fechar (nada de recarregar o detalhe agora).
      setAceite(r);
      avisar(`Inscrição aceita: o aluno foi cadastrado.${r.anamneseId ? ' Anamnese enviada.' : ''}`, 'sucesso');
      aoMudarLista();
    }, falhou);
  };

  const abrirWhatsApp = () => {
    if (!whatsapp) return;
    Linking.openURL(whatsapp).catch(() => avisar('Não foi possível abrir o WhatsApp neste aparelho.', 'perigo'));
  };

  const copiar = (texto: string, oque: string) => {
    Clipboard.setStringAsync(texto).then(
      () => avisar(`${oque} copiado.`, 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  const abrirFicha = (alunoId: string) => {
    aoFechar();
    router.push(`/treinador/alunos/${alunoId}`);
  };

  if (aceite) {
    return <ResultadoDoAceite aceite={aceite} podeVerAluno={podeVerAluno} aoCopiar={copiar} aoAbrirFicha={abrirFicha} />;
  }

  return (
    <View style={estilos.corpo}>
      <View style={estilos.selos}>
        <Selo texto={situacaoTela.texto} tipo={situacaoTela.tipo} />
        {/* "Não controlado" é o padrão: o selo só aparece quando o pagamento está sendo acompanhado. */}
        {dados.pagamento !== 'NAO_CONTROLADO' ? <Selo texto={`Pagamento: ${pagamentoTela.texto}`} tipo={pagamentoTela.tipo} /> : null}
      </View>
      {duplicidade ? (
        <Cartao titulo="Possível duplicidade" descricao="Só um aviso: nada é juntado sozinho. Confira antes de aceitar.">
          <Texto>{duplicidade}</Texto>
          {dados.duplicidade.alunoId && podeVerAluno ? (
            <LinhaDeAcoes>
              <Botao rotulo="Abrir ficha do aluno" tipo="secundario" aoTocar={() => abrirFicha(dados.duplicidade.alunoId ?? '')} />
            </LinhaDeAcoes>
          ) : null}
        </Cartao>
      ) : null}

      <Cartao titulo="Contato" descricao={`Inscrição em ${dataHoraParaTela(dados.criadaEm)}.`}>
        <CampoLeitura rotulo="WhatsApp" valor={dados.whatsapp} />
        <CampoLeitura rotulo="E-mail" valor={dados.email} />
        <LinhaDeAcoes>
          <Botao rotulo="Abrir WhatsApp" Icone={MessageCircle} tipo="secundario" aoTocar={abrirWhatsApp}
            desabilitado={!whatsapp} motivo="O número não tem DDD válido." />
          <Botao rotulo="Copiar WhatsApp" Icone={Copy} tipo="secundario" aoTocar={() => copiar(dados.whatsapp, 'WhatsApp')} />
        </LinhaDeAcoes>
        <Texto variante="pequeno">Abrir o WhatsApp não envia nada: registre o contato numa nota ou no andamento.</Texto>
      </Cartao>

      <Cartao titulo="O que a pessoa escreveu">
        <CampoLeitura rotulo="Sexo" valor={dados.sexo ? rotuloDoSexo(dados.sexo) : 'Prefiro não informar'} />
        <CampoLeitura rotulo="Objetivo" valor={dados.objetivo} />
        <CampoLeitura rotulo="Observação" valor={dados.observacao} />
        <CampoLeitura rotulo="Ciência do texto da consultoria"
          valor={dados.cienciaEm ? `Marcada em ${dataHoraParaTela(dados.cienciaEm)}` : 'Não havia texto de privacidade'} />
      </Cartao>

      <Cartao titulo="Andamento">
        {podeAlterar && dados.situacao !== 'ACEITA' ? (
          <Escolha rotulo="Situação" opcoes={situacoesDoAndamento(dados.situacao)} valor={situacao} aoMudar={setSituacao} />
        ) : (
          <CampoLeitura rotulo="Situação" valor={situacaoTela.texto} />
        )}
        {podeAlterar ? (
          <>
            <Escolha rotulo="Pagamento (registro manual)" opcoes={OPCOES_PAGAMENTO} valor={pagamento} aoMudar={setPagamento} />
            <EscolhaEmFolha rotulo="Responsável" valor={responsavelId} aoMudar={setResponsavelId}
              opcoes={[{ valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }, ...responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))]}
              rotuloDoValor={dados.responsavelNome ?? 'Membro inativo'} />
          </>
        ) : (
          <>
            <CampoLeitura rotulo="Pagamento (registro manual)" valor={pagamentoTela.texto} />
            <CampoLeitura rotulo="Responsável" valor={dados.responsavelNome ?? (dados.responsavelId ? 'Membro inativo' : 'Sem responsável')} />
          </>
        )}
        {dados.pagamento === 'CONFIRMADO_MANUAL' ? (
          <Texto variante="pequeno">
            Confirmado por {dados.pagamentoConfirmadoPorNome ?? SEM_DADO} em {dataHoraParaTela(dados.pagamentoConfirmadoEm)}. O app não confere pagamento.
          </Texto>
        ) : null}
        {podeAlterar ? (
          <LinhaDeAcoes>
            <Botao rotulo="Salvar andamento" tipo="secundario" aoTocar={salvarAndamento} carregando={ocupado === 'andamento'}
              desabilitado={!mudouAndamento} motivo="Nada mudou no andamento." />
          </LinhaDeAcoes>
        ) : null}
      </Cartao>

      <Cartao titulo="Notas da equipe" descricao="Só a equipe vê. Ficam guardadas junto com a inscrição.">
        {dados.notas.length === 0 ? <Texto variante="suave">Nenhuma nota ainda.</Texto> : null}
        {dados.notas.map((n) => (
          <View key={n.id} style={estilos.nota}>
            <Texto variante="pequeno">{n.autorNome ?? SEM_DADO} · {dataHoraParaTela(n.criadaEm)}</Texto>
            <Texto selectable>{n.texto}</Texto>
          </View>
        ))}
        {podeAlterar ? (
          <>
            <Campo rotulo="Nova nota" valor={nota} aoMudar={setNota} linhas={3} maxLength={LIMITES_INSCRICAO.nota} />
            <LinhaDeAcoes>
              <Botao rotulo="Acrescentar nota" tipo="secundario" aoTocar={acrescentarNota} carregando={ocupado === 'nota'}
                desabilitado={!nota.trim()} motivo="Escreva a nota antes." />
            </LinhaDeAcoes>
          </>
        ) : null}
      </Cartao>

      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      {alunoExistente && podeVerAluno ? (
        <LinhaDeAcoes>
          <Botao rotulo="Abrir ficha do aluno" tipo="secundario" aoTocar={() => abrirFicha(alunoExistente)} />
        </LinhaDeAcoes>
      ) : null}

      {dados.situacao === 'ACEITA' ? (
        <Cartao titulo="Aluno cadastrado" descricao="Esta inscrição já virou aluno.">
          {dados.alunoId && podeVerAluno ? (
            <LinhaDeAcoes><Botao rotulo="Abrir ficha" aoTocar={() => abrirFicha(dados.alunoId ?? '')} /></LinhaDeAcoes>
          ) : null}
        </Cartao>
      ) : null}

      <PainelConfirmacao visivel={pedido === 'aceitar' && podeCadastrar} titulo="Aceitar inscrição?"
        mensagem={`${dados.nome} vira aluno da consultoria, com o nome${dados.email ? ' e o e-mail' : ''} da inscrição. O app não confere pagamento.`}
        rotuloConfirmar="Aceitar e cadastrar" aoConfirmar={aceitar} aoCancelar={aoFecharPedido}
        desabilitado={podeEnviarAnamnese && opcoes.carregando} motivo="Aguarde a lista de anamneses.">
        {podeConvidar ? (
          <CaixaSelecao rotulo="Enviar convite de acesso ao app" marcado={convidar} aoMudar={setConvidar}
            ajuda="Gera o link para a pessoa criar a senha. Você copia e manda." />
        ) : null}
        {podeEnviarAnamnese && !semAcessoAsAnamneses ? (
          <SeletorDaAnamnese opcoes={opcoes.dados} carregando={opcoes.carregando} erro={opcoes.erro} aoTentarDeNovo={opcoes.recarregar}
            valor={anamneseDoAceite} aoMudar={setAnamneseEscolhida}
            avisoDoAcesso={!(convidar && podeConvidar) && anamneseDoAceite !== null} />
        ) : null}
      </PainelConfirmacao>
      <PainelConfirmacao visivel={pedido === 'recusar' && podeAlterar} titulo="Recusar inscrição?" perigo
        mensagem="A inscrição sai da fila de atendimento. Recusadas e desistentes são apagadas sozinhas depois de 180 dias."
        rotuloConfirmar="Recusar" aoConfirmar={recusar} aoCancelar={aoFecharPedido} />
    </View>
  );
}

/**
 * Campo "Enviar anamnese" do painel de aceite: "Não enviar agora" mais as anamneses publicadas, numa `Escolha` (os botões
 * quebram linha). Não usa `EscolhaEmFolha` mesmo com muitas opções: o painel é um AlertDialog modal (Radix) e a folha de
 * escolha abre num `Modal` fora dele, onde o toque não chega (testado no e2e). Também não usa o `SeletorDeQuestionario`
 * (busca outra finalidade, grava na hora).
 */
function SeletorDaAnamnese({ opcoes, carregando, erro, aoTentarDeNovo, valor, aoMudar, avisoDoAcesso }: {
  opcoes: readonly OpcaoQuestionario[] | undefined;
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  valor: string | null;
  aoMudar: (valor: string | null) => void;
  /** Convite desmarcado e anamnese escolhida: lembra que o aluno só vê quando entrar no app. */
  avisoDoAcesso: boolean;
}) {
  if (erro && !opcoes) return <MensagemErro texto="Não foi possível carregar as anamneses." tentarDeNovo={aoTentarDeNovo} erro={erro} />;
  if (!opcoes) return carregando ? <Texto variante="suave">Carregando as anamneses.</Texto> : null;
  if (opcoes.length === 0) return <Texto variante="suave">Nenhuma anamnese publicada.</Texto>;
  const lista = opcoesDeAnamneseDoAceite(opcoes);
  return (
    <View style={estilos.anamnese}>
      <Escolha rotulo="Enviar anamnese" valor={valor} opcoes={lista} aoMudar={aoMudar} />
      {avisoDoAcesso ? <Texto variante="pequeno">O aluno responde quando entrar no app.</Texto> : null}
    </View>
  );
}

/** Depois do aceite: o link do convite aparece uma vez só (sai daqui ao fechar a folha). */
function ResultadoDoAceite({ aceite, podeVerAluno, aoCopiar, aoAbrirFicha }: {
  aceite: AceiteInscricao;
  podeVerAluno: boolean;
  aoCopiar: (texto: string, oque: string) => void;
  aoAbrirFicha: (alunoId: string) => void;
}) {
  const { cores } = useTema();
  const convite = aceite.convite;
  return (
    <View style={estilos.corpo}>
      <Selo texto="Aceita" tipo="sucesso" />
      <Cartao titulo="Aluno cadastrado" descricao="A inscrição fica na lista como aceita, ligada ao aluno.">
        {convite ? (
          <>
            <Texto variante="suave">
              Envie o link para a pessoa criar a senha. Válido até {dataHoraParaTela(convite.expiraEm)}. O link não aparece
              de novo depois que você fechar; dá para gerar outro na ficha do aluno.
            </Texto>
            <View style={[estilos.destaque, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
              <View style={estilos.textoDestaque}>
                <Texto variante="pequeno">Link do convite</Texto>
                <Texto selectable style={estilos.link}>{convite.link}</Texto>
              </View>
              <Botao rotulo="Copiar" tipo="secundario" Icone={Copy} aoTocar={() => aoCopiar(convite.link, 'Link')} />
            </View>
          </>
        ) : (
          <Texto variante="suave">Sem convite agora. Quando quiser, gere o convite de acesso na ficha do aluno.</Texto>
        )}
        {podeVerAluno ? (
          <LinhaDeAcoes><Botao rotulo="Abrir ficha" aoTocar={() => aoAbrirFicha(aceite.alunoId)} /></LinhaDeAcoes>
        ) : null}
      </Cartao>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap' },
  anamnese: { gap: espaco(0.75) },
  nota: { gap: 2 },
  destaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
    flexWrap: 'wrap',
  },
  textoDestaque: { flex: 1, minWidth: 180, gap: 2 },
  link: { fontFamily: fontes.normal, fontSize: 14 },
});
