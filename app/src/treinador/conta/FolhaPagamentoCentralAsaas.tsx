import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, CreditCard, QrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Platform, StyleSheet, View } from 'react-native';

import {
  consultarSituacaoMinhaConta,
  gerarPixMinhaContaAsaas,
  type PixMinhaContaAsaasResponse,
} from '../../api/minhaContaAsaas';
import { linkDePagamento } from '../../api/rotas';
import type { CobrancaDaConta } from '../../api/tipos';
import { dataUriQrCodeBase64, erroCpfCnpjPagador, mascaraCpfCnpj, somenteDigitos } from '../../dominio/checkoutTransparente';
import { dataHoraParaTela, dataParaTela, moedaParaTela, SEM_DADO } from '../../dominio/formatos';
import { competenciaParaTela, situacaoDaCobrancaParaTela } from '../../dominio/minhaConta';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { abrirPagamentoComAviso } from '../../ui/abrirPagamentoComAviso';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CodigoQr } from '../../ui/CodigoQr';
import { Alerta } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha, LARGURA_FOLHA } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

const INTERVALO_POLLING_MS = 4000;

interface Props {
  cobranca: CobrancaDaConta | null;
  documentoPadrao?: string | null;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

/**
 * Pagamento das faturas da assinatura na Central, dentro de `Minha conta`: Pix imediato com QR Code dentro do app e cartão
 * pelo checkout da Central (`POST /minha-conta/cobrancas/{id}/pagar`), aberto no navegador. O app nunca vê nem guarda dado de
 * cartão. Com o Pix gerado ou o checkout aberto, a situação é conferida a cada 4 s e na volta ao app.
 */
export function FolhaPagamentoCentralAsaas({ cobranca, documentoPadrao, aoFechar, aoConfirmarPagamento }: Props) {
  return (
    <Folha visivel={cobranca !== null} titulo="Pagar fatura da assinatura" largura={LARGURA_FOLHA} aoFechar={aoFechar}>
      {cobranca ? (
        <ConteudoPagamentoCentral
          key={cobranca.id}
          cobranca={cobranca}
          documentoPadrao={documentoPadrao}
          aoFechar={aoFechar}
          aoConfirmarPagamento={aoConfirmarPagamento}
        />
      ) : null}
    </Folha>
  );
}

interface ConteudoProps {
  cobranca: CobrancaDaConta;
  documentoPadrao?: string | null;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

function ConteudoPagamentoCentral({ cobranca, documentoPadrao, aoFechar, aoConfirmarPagamento }: ConteudoProps) {
  const { cores } = useTema();
  const { avisar } = useAviso();

  const [confirmado, setConfirmado] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const [cpfCnpjPix, setCpfCnpjPix] = useState(documentoPadrao ? mascaraCpfCnpj(documentoPadrao) : '');
  const [erroDocPix, setErroDocPix] = useState<string | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pix, setPix] = useState<PixMinhaContaAsaasResponse | null>(null);
  const [codigoManual, setCodigoManual] = useState(false);

  const [abrindoCheckout, setAbrindoCheckout] = useState(false);
  const [checkoutAberto, setCheckoutAberto] = useState(false);

  const ocupadoRef = useRef(false);
  const aoConfirmarRef = useRef(aoConfirmarPagamento);
  useEffect(() => {
    aoConfirmarRef.current = aoConfirmarPagamento;
  });

  // Confere a situação a cada 4 s e quando o app volta ao primeiro plano (o navegador do cartão fica por cima).
  const aguardando = (pix !== null || checkoutAberto) && !confirmado;
  useEffect(() => {
    if (!aguardando) return;
    let ativo = true;
    const verificar = () => {
      consultarSituacaoMinhaConta(cobranca.id)
        .then((res) => {
          if (!ativo) return;
          if (res.situacao === 'PAGA') {
            setConfirmado(true);
            aoConfirmarRef.current();
          }
        })
        .catch(() => {
          // Tenta novamente no próximo ciclo.
        });
    };
    const id = setInterval(verificar, INTERVALO_POLLING_MS);
    let removerRetorno: () => void;
    if (Platform.OS === 'web') {
      const aoVoltar = () => {
        if (document.visibilityState === 'visible') verificar();
      };
      document.addEventListener('visibilitychange', aoVoltar);
      removerRetorno = () => document.removeEventListener('visibilitychange', aoVoltar);
    } else {
      const assinatura = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') verificar();
      });
      removerRetorno = () => assinatura.remove();
    }
    return () => {
      ativo = false;
      clearInterval(id);
      removerRetorno();
    };
  }, [aguardando, cobranca.id]);

  const situacao = situacaoDaCobrancaParaTela(cobranca);
  const competencia = competenciaParaTela(cobranca.competenciaInicio, cobranca.competenciaFim);
  const valorFormatado = moedaParaTela(cobranca.valor);
  const vencimento = dataParaTela(cobranca.vencimento) || SEM_DADO;

  const gerarPix = () => {
    if (ocupadoRef.current) return;
    setErroGeral(null);
    const digitosDoc = somenteDigitos(cpfCnpjPix);
    if (digitosDoc.length > 0) {
      const erro = erroCpfCnpjPagador(cpfCnpjPix);
      setErroDocPix(erro);
      if (erro) return;
    }
    ocupadoRef.current = true;
    setGerandoPix(true);
    setCodigoManual(false);
    gerarPixMinhaContaAsaas(cobranca.id, digitosDoc || undefined)
      .then((res) => {
        setPix(res);
      })
      .catch((erro: unknown) => {
        setErroGeral(textoDoErro(erro));
      })
      .finally(() => {
        ocupadoRef.current = false;
        setGerandoPix(false);
      });
  };

  const copiarPix = () => {
    if (!pix?.codigoCopiaECola) return;
    Clipboard.setStringAsync(pix.codigoCopiaECola).then(
      (ok) => {
        if (ok === false) {
          setCodigoManual(true);
          avisar('Não foi possível copiar sozinho. Selecione o código abaixo e copie à mão.', 'neutro');
        } else {
          avisar('Código Pix copiado. Cole no app do seu banco em Pix copia e cola.', 'sucesso');
        }
      },
      () => {
        setCodigoManual(true);
        avisar('Não foi possível copiar sozinho. Selecione o código abaixo e copie à mão.', 'neutro');
      },
    );
  };

  // Na web a aba abre dentro do clique (antes de qualquer await): `abrirPagamentoComAviso` cuida disso.
  const pagarComCartao = () => {
    if (ocupadoRef.current) return;
    setErroGeral(null);
    ocupadoRef.current = true;
    setAbrindoCheckout(true);
    abrirPagamentoComAviso(() => linkDePagamento(cobranca.id), avisar, 'Pagar com cartão')
      .then((aberto) => {
        if (aberto) setCheckoutAberto(true);
      })
      .catch((erro: unknown) => {
        setErroGeral(textoDoErro(erro));
      })
      .finally(() => {
        ocupadoRef.current = false;
        setAbrindoCheckout(false);
      });
  };

  const qrUri = dataUriQrCodeBase64(pix?.qrCodeBase64);

  return (
    <View style={estilos.conteudo}>
      <View style={[estilos.resumo, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
        <View style={estilos.linhaTopo}>
          <Texto variante="bloco" style={estilos.flexTexto}>{competencia}</Texto>
          <Selo texto={situacao.texto} tipo={situacao.tipo} />
        </View>
        <Texto variante="titulo" numerico>{valorFormatado}</Texto>
        <Texto variante="suave" numerico>{`Vencimento: ${vencimento}`}</Texto>
      </View>

      {erroGeral ? <Alerta tom="perigo" texto={erroGeral} /> : null}

      {confirmado ? (
        <View style={[estilos.confirmado, { borderColor: cores.sucesso, backgroundColor: cores.sucessoSuave }]}>
          <CheckCircle2 size={28} color={cores.sucesso} strokeWidth={2.2} />
          <Texto variante="bloco" cor={cores.sucesso}>Pagamento confirmado!</Texto>
          <Texto variante="suave">A fatura da sua assinatura foi quitada e atualizada na Central.</Texto>
          <Botao rotulo="Fechar" tipo="primario" cheio aoTocar={aoFechar} />
        </View>
      ) : (
        <>
          <View style={estilos.bloco}>
            <Texto variante="secao">Pix imediato</Texto>
            {!pix ? (
              <>
                <Campo
                  rotulo="CPF ou CNPJ do pagador (opcional se já cadastrado)"
                  valor={cpfCnpjPix}
                  aoMudar={(t) => {
                    setCpfCnpjPix(mascaraCpfCnpj(t));
                    setErroDocPix(null);
                  }}
                  erro={erroDocPix}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  keyboardType="number-pad"
                  numerico
                />
                <Texto variante="suave">
                  Gere o QR Code Pix imediato para quitar sua fatura sem sair do aplicativo.
                </Texto>
                <Botao
                  rotulo="Gerar QR Code Pix"
                  Icone={QrCode}
                  tipo="primario"
                  cheio
                  carregando={gerandoPix}
                  aoTocar={gerarPix}
                />
              </>
            ) : (
              <View style={estilos.pixBox}>
                <View style={[estilos.qrQuadro, { borderColor: cores.divisor }]}>
                  {qrUri ? (
                    <Image
                      source={{ uri: qrUri }}
                      style={estilos.qrImagem}
                      accessibilityLabel="QR Code Pix da fatura"
                      resizeMode="contain"
                    />
                  ) : (
                    <CodigoQr conteudo={pix.codigoCopiaECola} tamanho={200} descricao="QR Code Pix da fatura" />
                  )}
                </View>
                {pix.expiraEm ? (
                  <Texto variante="pequeno" numerico>
                    Válido até {dataHoraParaTela(pix.expiraEm)}
                  </Texto>
                ) : null}
                <Botao
                  rotulo="Copiar código Pix copia e cola"
                  Icone={Copy}
                  tipo="primario"
                  cheio
                  aoTocar={copiarPix}
                />
                <Texto variante="pequeno" style={estilos.centralizado}>
                  Aguardando confirmação do pagamento...
                </Texto>
                {codigoManual ? (
                  <View style={[estilos.codigoCaixa, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
                    <Texto variante="rotulo">Código Pix copia e cola</Texto>
                    <Texto selectable>{pix.codigoCopiaECola}</Texto>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View style={[estilos.bloco, estilos.cartao, { borderTopColor: cores.divisor }]}>
            <Texto variante="secao">Cartão de crédito</Texto>
            <Texto variante="suave">
              Você paga na página de pagamento, no navegador. O app não recebe nem guarda dados do cartão.
            </Texto>
            <Botao
              rotulo="Pagar com cartão"
              Icone={CreditCard}
              tipo="secundario"
              cheio
              carregando={abrindoCheckout}
              aoTocar={pagarComCartao}
            />
            {checkoutAberto ? (
              <Texto variante="pequeno" style={estilos.centralizado}>
                Aguardando pagamento... Ao voltar para o app, conferimos sozinhos.
              </Texto>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { gap: espaco(2) },
  resumo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  flexTexto: { flexShrink: 1 },
  bloco: { gap: espaco(1.5) },
  cartao: { borderTopWidth: 1, paddingTop: espaco(2) },
  pixBox: { alignItems: 'center', gap: espaco(1.5) },
  qrQuadro: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), backgroundColor: '#FFFFFF' },
  qrImagem: { width: 200, height: 200 },
  centralizado: { textAlign: 'center' },
  codigoCaixa: { width: '100%', borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  confirmado: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1), alignItems: 'center' },
});
