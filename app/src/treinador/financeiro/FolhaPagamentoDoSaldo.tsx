import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { registrarPagamentoDoSaldo } from '../../api/financeiroContrato';
import type { ContratacaoResponse, FormaDePagamento, ResumoDoContrato } from '../../api/financeiroTipos';
import { motivoSemSaldo, traduzirErroDoSaldo } from '../../dominio/contratoFechado';
import { FORMAS_MANUAIS, hojeEmBrasilia } from '../../dominio/financeiro';
import { centavosDaTela, centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { novoUid } from '../../dominio/uid';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { Texto } from '../../ui/Texto';
import { CampoMoeda } from './comum';

type Situacao = 'PAGA' | 'ABERTA';

/**
 * "Registrar pagamento do saldo" (D4): uma cobrança nova, de valor exato, ligada ao contrato de saldo livre, já paga (com a
 * forma) ou aberta (o link sai depois pela folha da cobrança, que abre em seguida). O saldo e o limite são os da API (o
 * bloco `contrato`); a tela não compara o valor com eles: acima do limite é o 422 `SALDO_INVALIDO`, no campo. Limite zero =
 * botão desabilitado com o motivo. Um `pedidoId` por abertura: repetir depois de falha de rede não lança em dobro; só o 409
 * `PEDIDO_JA_USADO` (o pedido já existe com outros dados) troca o id para o próximo envio.
 */
export function FolhaPagamentoDoSaldo({ contratacao, contrato, aoFechar, aoMudar, aoAbrirCobranca }: {
  contratacao: ContratacaoResponse;
  contrato: ResumoDoContrato;
  aoFechar: () => void;
  /** Recarrega o cartão (contratações e cobranças). */
  aoMudar: () => void;
  /** O id da cobrança aberta recém-criada: quem chama abre a folha dela (copiar o link) quando a lista recarregar. */
  aoAbrirCobranca: (cobrancaId: string) => void;
}) {
  const { avisar } = useAviso();
  const [pedidoId, setPedidoId] = useState(novoUid);
  const ocupado = useRef(false);
  const [valorTexto, setValorTexto] = useState('');
  const [vencimentoTexto, setVencimentoTexto] = useState(() => dataParaTela(hojeEmBrasilia()));
  const [situacao, setSituacao] = useState<Situacao>('PAGA');
  const [forma, setForma] = useState<FormaDePagamento | null>(null);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroDoValor, setErroDoValor] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const semSaldo = motivoSemSaldo(contrato);
  const valorCentavos = centavosDaTela(valorTexto);
  const vencimento = dataDaTela(vencimentoTexto);
  const erros = {
    valor: erroDoValor ?? (tentou && valorCentavos === null ? 'Informe um valor maior que zero, por exemplo 200,00.' : null),
    vencimento: tentou && !vencimento ? 'Informe a data no formato DD/MM/AAAA.' : null,
    forma: tentou && situacao === 'PAGA' && !forma ? 'Escolha como o aluno pagou.' : null,
  };

  const enviar = () => {
    setTentou(true);
    if (semSaldo || valorCentavos === null || !vencimento || (situacao === 'PAGA' && !forma) || ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    setMensagem(null);
    setErroDoValor(null);
    const jaPaga = situacao === 'PAGA';
    registrarPagamentoDoSaldo(contratacao.id, { pedidoId, valorCentavos, vencimento, jaPaga, ...(jaPaga ? { forma } : {}) }).then(
      ({ cobrancaId }) => {
        avisar(jaPaga ? 'Pagamento registrado.' : 'Cobrança criada em aberto. Copie o link de pagamento na folha dela.', 'sucesso');
        aoMudar();
        aoFechar();
        if (!jaPaga) aoAbrirCobranca(cobrancaId);
      },
      (e: unknown) => {
        ocupado.current = false;
        setEnviando(false);
        const t = traduzirErroDoSaldo(e);
        setErroDoValor(t.campoValor);
        setMensagem(t.mensagem);
        // O mesmo pedido já existe com outros dados: o próximo "Registrar" é um pedido novo.
        if (t.novoPedido) setPedidoId(novoUid());
        if (t.recarregar) aoMudar();
      },
    );
  };

  return (
    <Folha visivel titulo="Registrar pagamento do saldo" aoFechar={aoFechar}
      rodape={(
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} desabilitado={enviando} />
          <Botao rotulo={situacao === 'PAGA' ? 'Registrar pagamento' : 'Criar cobrança'} aoTocar={enviar} carregando={enviando}
            desabilitado={!!semSaldo} motivo={semSaldo ?? undefined} />
        </>
      )}>
      <View style={estilos.bloco}>
        <ListaDeDados>
          <LinhaDeDado rotulo="Falta pagar" valor={centavosParaTela(contrato.saldoCentavos)} numerico />
          <LinhaDeDado rotulo="Dá para lançar até" valor={centavosParaTela(contrato.limiteDeLancamentoCentavos)} numerico
            nota={contrato.limiteDeLancamentoCentavos !== contrato.saldoCentavos ? 'Cobranças em aberto do contrato já reservam parte do saldo.' : undefined} />
        </ListaDeDados>
        {semSaldo ? <Alerta tom="atencao" texto={semSaldo} /> : (
          <>
            <CampoMoeda mascara rotulo="Valor" texto={valorTexto} erro={erros.valor}
              aoMudar={(t) => { setValorTexto(t); setErroDoValor(null); }} ajuda="O valor exato que o aluno pagou ou vai pagar agora." />
            <Escolha rotulo="Situação" valor={situacao} aoMudar={setSituacao}
              opcoes={[{ valor: 'PAGA', rotulo: 'Já recebi' }, { valor: 'ABERTA', rotulo: 'Fica em aberto' }]} />
            <CampoData rotulo={situacao === 'PAGA' ? 'Data do pagamento' : 'Vencimento'} valor={vencimentoTexto} aoMudar={setVencimentoTexto} erro={erros.vencimento} />
            {situacao === 'PAGA' ? (
              <Escolha rotulo="Como o aluno pagou" valor={forma} aoMudar={setForma} erro={erros.forma}
                opcoes={FORMAS_MANUAIS.map((f) => ({ valor: f.valor as FormaDePagamento | null, rotulo: f.rotulo }))} />
            ) : <Texto variante="suave">A cobrança nasce em aberto; o link de pagamento sai na folha dela, que abre em seguida.</Texto>}
          </>
        )}
        {mensagem ? <MensagemErro texto={mensagem} /> : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(2) },
});
