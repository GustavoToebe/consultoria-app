import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { contratarPlano } from '../../api/financeiroF1';
import type { ContratacaoResponse } from '../../api/financeiroTipos';
import { listarContratacoesDoAluno, listarPlanosComerciais } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { pedidoDeContratacao, propostaComOutroValor, temContratacaoVigente } from '../../dominio/cobrancaDoInteressado';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { PERIODICIDADES } from '../../dominio/inscricoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const PELA_FICHA = 'Para cobrar pelo app, cadastre a contratação no Financeiro, na ficha do aluno.';

interface Props {
  alunoId: string;
  nomeDoAluno: string;
  /** `planoDoInteressado`: id nulo = plano escrito à mão na proposta (ou nenhum). */
  plano: { id: string | null; nome: string | null };
  valorDaProposta: number | null;
  /** O pagamento foi confirmado na inscrição: a primeira cobrança pode nascer paga. */
  pagamentoConfirmado: boolean;
}

/**
 * "Gerar cobrança" depois do aceite: contrata o plano que a pessoa escolheu (ou o da proposta) para o aluno novo, pelo
 * mesmo `POST /alunos/{id}/contratacoes` do Financeiro, sem valor no corpo (o servidor usa o do plano). Some com o
 * financeiro desligado; sem `FINANCEIRO_LER` + `FINANCEIRO_ALTERAR` + `ALUNO_LER` fica só a frase de sempre.
 */
export function GerarCobrancaDoInteressado(props: Props) {
  const { pode, pagamentosHabilitados } = useSessao();
  if (!pagamentosHabilitados) return null;
  if (!pode('FINANCEIRO_LER') || !pode('FINANCEIRO_ALTERAR') || !pode('ALUNO_LER')) return <Texto variante="pequeno">{PELA_FICHA}</Texto>;
  if (!props.plano.id) {
    return <Texto variante="pequeno">{props.plano.nome ? `O plano da proposta (${props.plano.nome}) não é um plano do Financeiro. ${PELA_FICHA}` : PELA_FICHA}</Texto>;
  }
  return <Gerar {...props} planoId={props.plano.id} />;
}

function Gerar({ alunoId, nomeDoAluno, plano, planoId, valorDaProposta, pagamentoConfirmado }: Props & { planoId: string }) {
  const { avisar } = useAviso();
  const contratacoes = useCarregar(`interessado:contratacoes:${alunoId}`, () => listarContratacoesDoAluno(alunoId));
  const planos = useCarregar('interessado:planos-comerciais', () => listarPlanosComerciais(false));
  const [aberto, setAberto] = useState(false);
  const [primeiroPago, setPrimeiroPago] = useState(pagamentoConfirmado);
  const [enviando, setEnviando] = useState(false);
  const [gerada, setGerada] = useState<ContratacaoResponse | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  // O segundo toque chega antes de a tela redesenhar: sem a trava sairiam dois pedidos (o segundo voltaria 409).
  const ocupado = useRef(false);

  const carga = contratacoes.erro ?? planos.erro;
  if (carga) {
    return <MensagemErro texto="Não foi possível conferir o financeiro do aluno." erro={carga}
      tentarDeNovo={() => { contratacoes.recarregar(); planos.recarregar(); }} />;
  }
  if (!contratacoes.dados || !planos.dados) return <Texto variante="suave">Conferindo o financeiro do aluno.</Texto>;
  if (gerada || temContratacaoVigente(contratacoes.dados)) {
    const nome = gerada?.planoNome ?? contratacoes.dados.find((c) => c.situacao !== 'ENCERRADA')?.planoNome;
    return <Texto variante="pequeno">{`Plano contratado${nome ? ` (${nome})` : ''}: as cobranças ficam no Financeiro, na ficha do aluno.`}</Texto>;
  }
  const doFinanceiro = planos.dados.find((p) => p.id === planoId);
  if (!doFinanceiro) {
    return <Texto variante="pequeno">{`O plano escolhido${plano.nome ? ` (${plano.nome})` : ''} não está ativo no Financeiro. ${PELA_FICHA}`}</Texto>;
  }

  const hoje = hojeEmBrasilia();
  const pedido = pedidoDeContratacao(doFinanceiro.id, hoje, pagamentoConfirmado && primeiroPago);
  const gerar = () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setAberto(false);
    setEnviando(true);
    setErro(null);
    contratarPlano(alunoId, pedido).then((r) => {
      setGerada(r);
      avisar('Cobrança gerada: plano contratado para o aluno.', 'sucesso');
    }, (e: unknown) => {
      const codigo = codigoApi(e);
      if (codigo === 'CONTRATACAO_VIGENTE') {
        avisar('Este aluno já tem um plano contratado.', 'neutro');
        contratacoes.recarregar();
      } else if (codigo === 'PLANO_COMERCIAL_ARQUIVADO') {
        avisar('O plano foi arquivado no Financeiro. Escolha outro na ficha do aluno.', 'neutro');
        planos.recarregar();
      } else {
        setErro(e);
      }
    }).finally(() => {
      ocupado.current = false;
      setEnviando(false);
    });
  };

  return (
    <View style={estilos.bloco}>
      <LinhaDeAcoes>
        <Botao rotulo="Gerar cobrança" tipo="secundario" aoTocar={() => setAberto(true)} carregando={enviando} />
      </LinhaDeAcoes>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      <PainelConfirmacao visivel={aberto} titulo="Gerar cobrança?"
        mensagem={`Contrata o plano escolhido para ${nomeDoAluno}. O valor é o do plano no Financeiro.`}
        rotuloConfirmar="Gerar cobrança" aoConfirmar={gerar} aoCancelar={() => setAberto(false)}>
        <View style={estilos.conferir}>
          <Texto variante="secao">Conferir antes de gerar</Texto>
          <Texto variante="pequeno">Plano: {doFinanceiro.nome}</Texto>
          <Texto variante="pequeno">Valor do plano: {centavosParaTela(doFinanceiro.valorCentavos)} · {PERIODICIDADES[doFinanceiro.periodicidade]}</Texto>
          <Texto variante="pequeno">Início: {dataParaTela(hoje)}, com vencimento todo dia {pedido.diaVencimento}</Texto>
          {propostaComOutroValor(valorDaProposta, doFinanceiro.valorCentavos) ? (
            <Texto variante="pequeno">
              {`A proposta tem outro valor (${centavosParaTela(valorDaProposta)}). Para cobrar esse valor, contrate pelo Financeiro, na ficha do aluno.`}
            </Texto>
          ) : null}
        </View>
        {pagamentoConfirmado ? (
          <CaixaSelecao rotulo="Primeiro período já pago" marcado={primeiroPago} aoMudar={setPrimeiroPago}
            ajuda="O pagamento foi confirmado na inscrição: a primeira cobrança já nasce paga." />
        ) : null}
        <Texto variante="pequeno">Outra data de início ou outro valor: use Contratar plano na ficha do aluno.</Texto>
      </PainelConfirmacao>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  conferir: { gap: 2 },
});
