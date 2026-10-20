import { useState } from 'react';
import { View } from 'react-native';

import type { CobrancaResponse, FormaDePagamento } from '../../api/financeiroTipos';
import { cancelarCobranca, desfazerBaixaDaCobranca, registrarPagamentoManual } from '../../api/rotas';
import {
  atrasoParaTela, FORMAS_MANUAIS, hojeEmBrasilia, LIMITES, podeCancelarCobranca, podeDesfazerBaixa, podeRegistrarPagamento,
  rotuloDaForma, seloDaCobranca, validarBaixa,
} from '../../dominio/financeiro';
import { centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { avisoDeConflito, ehConflito } from './comum';

type Modo = 'detalhe' | 'baixa';
type Pergunta = 'desfazer' | 'cancelar' | null;

/**
 * Uma cobrança: os dados, o selo, e (com `FINANCEIRO_ALTERAR`) Registrar pagamento, Desfazer a baixa e Cancelar. Registrar
 * e cancelar só em cobrança em aberto; desfazer só em baixa manual. A API confere de novo. O app nunca envia valor de
 * cobrança: só data, forma, observação e a versão que viu. Sem botão "Pagar" (o aluno não paga por aqui).
 */
export function FolhaDaCobranca({ cobranca, podeAlterar, abrirEmBaixa, aoFechar, aoMudar }: {
  cobranca: CobrancaResponse | null;
  podeAlterar: boolean;
  /** Abre direto no formulário de pagamento (atalho da lista de inadimplentes). */
  abrirEmBaixa?: boolean;
  aoFechar: () => void;
  /** Depois de qualquer mudança (ou conflito): quem chamou recarrega as listas. */
  aoMudar: () => void;
}) {
  if (!cobranca) return null;
  // A chave reinicia o formulário a cada cobrança aberta.
  return <Conteudo key={`${cobranca.id}:${cobranca.versao}:${abrirEmBaixa ? 'b' : 'd'}`} cobranca={cobranca} podeAlterar={podeAlterar}
    abrirEmBaixa={!!abrirEmBaixa} aoFechar={aoFechar} aoMudar={aoMudar} />;
}

function Conteudo({ cobranca, podeAlterar, abrirEmBaixa, aoFechar, aoMudar }: {
  cobranca: CobrancaResponse;
  podeAlterar: boolean;
  abrirEmBaixa: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const [modo, setModo] = useState<Modo>(abrirEmBaixa && podeAlterar && podeRegistrarPagamento(cobranca) ? 'baixa' : 'detalhe');
  const [pergunta, setPergunta] = useState<Pergunta>(null);
  const [data, setData] = useState(dataParaTela(hojeEmBrasilia()));
  const [forma, setForma] = useState<FormaDePagamento | null>('PIX_DIRETO');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [tentou, setTentou] = useState(false);

  const selo = seloDaCobranca(cobranca);
  const hoje = hojeEmBrasilia();
  const iso = dataDaTela(data);
  const erroDaBaixa = validarBaixa({ data: iso ?? null, forma }, hoje);

  const concluir = (acao: () => Promise<unknown>, sucesso: string) => {
    setEnviando(true);
    setErro(null);
    acao().then(
      () => {
        setEnviando(false);
        setPergunta(null);
        avisar(sucesso, 'sucesso');
        aoMudar();
        aoFechar();
      },
      (e: unknown) => {
        setEnviando(false);
        if (ehConflito(e)) {
          setPergunta(null);
          avisar(avisoDeConflito('A cobrança foi alterada'), 'neutro');
          aoMudar();
          aoFechar();
          return;
        }
        setErro(e);
      },
    );
  };

  const registrar = () => {
    setTentou(true);
    if (erroDaBaixa || !iso || !forma) return;
    concluir(
      () => registrarPagamentoManual(cobranca.id, { data: iso, forma, observacao: observacao.trim() || null, versao: cobranca.versao }),
      'Pagamento registrado.',
    );
  };

  const confirmarPergunta = () => {
    const texto = motivo.trim();
    if (!texto) return;
    if (pergunta === 'desfazer') concluir(() => desfazerBaixaDaCobranca(cobranca.id, { motivo: texto, versao: cobranca.versao }), 'Baixa desfeita.');
    else concluir(() => cancelarCobranca(cobranca.id, { motivo: texto, versao: cobranca.versao }), 'Cobrança cancelada.');
  };

  const perguntar = (p: Pergunta) => { setMotivo(''); setErro(null); setPergunta(p); };

  const titulo = modo === 'baixa' ? 'Registrar pagamento' : 'Cobrança';
  const rodape = modo === 'baixa' ? (
    <>
      <Botao rotulo="Voltar" tipo="secundario" aoTocar={() => (abrirEmBaixa ? aoFechar() : setModo('detalhe'))} desabilitado={enviando} />
      <Botao rotulo="Registrar pagamento" aoTocar={registrar} carregando={enviando} />
    </>
  ) : podeAlterar ? (
    <LinhaDeAcoes alinhar="fim">
      {podeRegistrarPagamento(cobranca) ? <Botao rotulo="Registrar pagamento" aoTocar={() => setModo('baixa')} /> : null}
      {podeDesfazerBaixa(cobranca) ? <Botao rotulo="Desfazer baixa" tipo="secundario" aoTocar={() => perguntar('desfazer')} /> : null}
      {podeCancelarCobranca(cobranca) ? <Botao rotulo="Cancelar cobrança" tipo="perigoTexto" aoTocar={() => perguntar('cancelar')} /> : null}
    </LinhaDeAcoes>
  ) : undefined;

  const dataInvalida = tentou && (!iso || iso > hoje) ? erroDaBaixa : null;

  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar} rodape={rodape}>
      <View style={{ gap: espaco(1.5) }}>
        <LinhaDeAcoes alinhar="entre">
          <CampoLeitura rotulo="Aluno" valor={cobranca.alunoNome} />
          <Selo texto={selo.rotulo} tipo={selo.tom} />
        </LinhaDeAcoes>
        <CampoLeitura rotulo="Valor" valor={centavosParaTela(cobranca.valorCentavos)} numerico />
        {modo === 'detalhe' ? (
          <>
            <CampoLeitura rotulo="Plano" valor={cobranca.planoNome} />
            <CampoLeitura rotulo="Competência" valor={rotuloDoMes(cobranca.competencia)} />
            <CampoLeitura rotulo="Vencimento" valor={dataParaTela(cobranca.vencimento)} numerico />
            {cobranca.situacao === 'ABERTA' && cobranca.vencida ? <CampoLeitura rotulo="Atraso" valor={atrasoParaTela(cobranca.diasDeAtraso)} /> : null}
            {cobranca.situacao === 'PAGA' ? (
              <>
                <CampoLeitura rotulo="Pago em" valor={dataParaTela(cobranca.pagoEm)} numerico />
                <CampoLeitura rotulo="Forma" valor={rotuloDaForma(cobranca.forma)} />
                <CampoLeitura rotulo="Baixa dada por" valor={cobranca.baixaPorNome} />
              </>
            ) : null}
            <CampoLeitura rotulo="Observação" valor={cobranca.observacao} />
            {cobranca.motivo ? <CampoLeitura rotulo="Motivo" valor={cobranca.motivo} /> : null}
          </>
        ) : (
          <>
            <CampoData rotulo="Data do pagamento" valor={data} aoMudar={setData} erro={dataInvalida} />
            <Escolha rotulo="Forma de pagamento" opcoes={FORMAS_MANUAIS.map((f) => ({ valor: f.valor as FormaDePagamento | null, rotulo: f.rotulo }))}
              valor={forma} aoMudar={setForma} />
            <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} linhas={3} maxLength={LIMITES.observacao} />
          </>
        )}
        {erro && !pergunta ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
      <PainelConfirmacao visivel={pergunta !== null}
        titulo={pergunta === 'desfazer' ? 'Desfazer a baixa?' : 'Cancelar esta cobrança?'}
        mensagem={pergunta === 'desfazer'
          ? 'A cobrança volta a ficar em aberto. O motivo fica registrado.'
          : 'A cobrança deixa de valer e sai das contas de recebimento. O motivo é obrigatório.'}
        rotuloConfirmar={pergunta === 'desfazer' ? 'Desfazer baixa' : 'Cancelar cobrança'} rotuloCancelar="Voltar"
        perigo={pergunta === 'cancelar'} carregando={enviando} desabilitado={!motivo.trim()} motivo="Informe o motivo."
        aoConfirmar={confirmarPergunta} aoCancelar={() => setPergunta(null)}>
        <Campo rotulo="Motivo" valor={motivo} aoMudar={setMotivo} linhas={3} maxLength={LIMITES.motivo} />
        {erro && pergunta ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
    </Folha>
  );
}
