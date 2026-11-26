import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, CreditCard, QrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Platform, StyleSheet, View } from 'react-native';

import {
  consultarSituacaoCobrancaAluno,
  faturaOvertrainingPay,
  gerarPixOvertrainingPay,
  type PixOvertrainingPayResponse,
} from '../../api/alunoOvertrainingPay';
import type { CobrancaDoAluno } from '../../api/financeiroTipos';
import { dataUriQrCodeBase64, erroCpfPagador, mascaraCpf, somenteDigitos } from '../../dominio/checkoutTransparente';
import { referenciaDaCobranca, seloDaCobranca } from '../../dominio/financeiro';
import { centavosParaTela, dataHoraParaTela, dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
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
  cobranca: CobrancaDoAluno | null;
  cpfPagadorCadastrado: boolean;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

/**
 * Pagamento do aluno pelo Overtraining Pay: Pix imediato com QR Code dentro do app e cartão pela página de pagamento do
 * Asaas, aberta no navegador (`/overtraining-pay/fatura`). O app nunca vê nem guarda dado de cartão. Com o Pix gerado ou a
 * página do cartão aberta, a situação é conferida a cada 4 s e na volta ao app; PAGA fecha o ciclo e atualiza a lista.
 */
export function FolhaCheckoutTransparente({ cobranca, cpfPagadorCadastrado, aoFechar, aoConfirmarPagamento }: Props) {
  return (
    <Folha visivel={cobranca !== null} titulo="Pagamento no app" largura={LARGURA_FOLHA} aoFechar={aoFechar}>
      {cobranca ? (
        <ConteudoCheckoutTransparente
          key={cobranca.id}
          cobranca={cobranca}
          cpfPagadorCadastrado={cpfPagadorCadastrado}
          aoFechar={aoFechar}
          aoConfirmarPagamento={aoConfirmarPagamento}
        />
      ) : null}
    </Folha>
  );
}

interface ConteudoProps {
  cobranca: CobrancaDoAluno;
  cpfPagadorCadastrado: boolean;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

function ConteudoCheckoutTransparente({ cobranca, cpfPagadorCadastrado, aoFechar, aoConfirmarPagamento }: ConteudoProps) {
  const { cores } = useTema();
  const { avisar } = useAviso();

  const [confirmado, setConfirmado] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const [cpfPix, setCpfPix] = useState('');
  const [erroCpfPix, setErroCpfPix] = useState<string | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pix, setPix] = useState<PixOvertrainingPayResponse | null>(null);
  const [codigoManual, setCodigoManual] = useState(false);

  const [abrindoFatura, setAbrindoFatura] = useState(false);
  const [faturaAberta, setFaturaAberta] = useState(false);

  const ocupadoRef = useRef(false);
  const aoConfirmarRef = useRef(aoConfirmarPagamento);
  useEffect(() => {
    aoConfirmarRef.current = aoConfirmarPagamento;
  });

  // Confere a situação a cada 4 s e quando o app volta ao primeiro plano (o navegador do cartão ou o app do banco ficam por cima).
  const aguardando = (pix !== null || faturaAberta) && !confirmado;
  useEffect(() => {
    if (!aguardando) return;
    let ativo = true;
    const verificar = () => {
      consultarSituacaoCobrancaAluno(cobranca.id)
        .then((res) => {
          if (!ativo) return;
          if (res.situacao === 'PAGA') {
            setConfirmado(true);
            aoConfirmarRef.current();
          }
        })
        .catch(() => {
          // Falha pontual de rede: tenta de novo no próximo ciclo.
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

  const selo = seloDaCobranca(cobranca);
  const referencia = referenciaDaCobranca(cobranca);
  const valorFormatado = centavosParaTela(cobranca.valorCentavos);
  const vencimentoFormatado = dataParaTela(cobranca.vencimento);

  const gerarPix = () => {
    if (ocupadoRef.current) return;
    setErroGeral(null);
    if (!cpfPagadorCadastrado) {
      const erro = erroCpfPagador(cpfPix);
      setErroCpfPix(erro);
      if (erro) return;
    }
    ocupadoRef.current = true;
    setGerandoPix(true);
    setCodigoManual(false);
    gerarPixOvertrainingPay(cobranca.id, cpfPagadorCadastrado ? undefined : somenteDigitos(cpfPix))
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
    // Sem CPF cadastrado, pede aqui também (o campo fica acima); com o Pix já gerado o CPF já foi dado.
    const precisaDoCpf = !cpfPagadorCadastrado && !pix;
    if (precisaDoCpf) {
      const erro = erroCpfPagador(cpfPix);
      setErroCpfPix(erro);
      if (erro) return;
    }
    ocupadoRef.current = true;
    setAbrindoFatura(true);
    abrirPagamentoComAviso(() => faturaOvertrainingPay(cobranca.id, precisaDoCpf ? somenteDigitos(cpfPix) : undefined), avisar, 'Pagar com cartão')
      .then((aberta) => {
        if (aberta) setFaturaAberta(true);
      })
      .catch((erro: unknown) => {
        setErroGeral(textoDoErro(erro));
      })
      .finally(() => {
        ocupadoRef.current = false;
        setAbrindoFatura(false);
      });
  };

  const qrUri = dataUriQrCodeBase64(pix?.qrCodeBase64);

  return (
    <View style={estilos.conteudo}>
      <View style={[estilos.resumo, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
        <View style={estilos.linhaTopo}>
          <Texto variante="bloco" style={estilos.flexTexto}>{referencia}</Texto>
          <Selo texto={selo.rotulo} tipo={selo.tom} Icone={ICONE_DO_SELO[selo.tom]} />
        </View>
        <Texto variante="titulo" numerico>{valorFormatado}</Texto>
        <Texto variante="suave" numerico>
          {cobranca.vencida ? `Venceu em ${vencimentoFormatado}` : `Vence em ${vencimentoFormatado}`}
        </Texto>
      </View>

      {erroGeral ? <Alerta tom="perigo" texto={erroGeral} /> : null}

      {confirmado ? (
        <View style={[estilos.confirmado, { borderColor: cores.sucesso, backgroundColor: cores.sucessoSuave }]}>
          <CheckCircle2 size={28} color={cores.sucesso} strokeWidth={2.2} />
          <Texto variante="bloco" cor={cores.sucesso}>Pagamento confirmado!</Texto>
          <Texto variante="suave">
            Recebemos a confirmação desta cobrança. O seu plano já foi atualizado.
          </Texto>
          <Botao rotulo="Fechar" tipo="primario" cheio aoTocar={aoFechar} />
        </View>
      ) : (
        <>
          <View style={estilos.bloco}>
            <Texto variante="secao">Pix imediato</Texto>
            {!pix ? (
              <>
                {!cpfPagadorCadastrado ? (
                  <Campo
                    rotulo="CPF do pagador"
                    valor={cpfPix}
                    aoMudar={(t) => {
                      setCpfPix(mascaraCpf(t));
                      setErroCpfPix(null);
                    }}
                    erro={erroCpfPix}
                    ajuda="Pedido uma única vez para emitir a cobrança Pix com segurança."
                    placeholder="000.000.000-00"
                    keyboardType="number-pad"
                    numerico
                  />
                ) : null}
                <Texto variante="suave">
                  O QR Code Pix é gerado na hora e a confirmação acontece automaticamente em poucos segundos.
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
                      accessibilityLabel="QR Code Pix para pagamento"
                      resizeMode="contain"
                    />
                  ) : (
                    <CodigoQr conteudo={pix.codigoCopiaECola} tamanho={200} descricao="QR Code Pix para pagamento" />
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
                  Aguardando pagamento... A tela atualiza sozinha assim que o banco confirmar.
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
              Você paga na página segura do Asaas, no navegador, e escolhe lá o parcelamento. O app não recebe nem guarda dados do cartão.
            </Texto>
            <Botao
              rotulo="Pagar com cartão"
              Icone={CreditCard}
              tipo="secundario"
              cheio
              carregando={abrindoFatura}
              aoTocar={pagarComCartao}
            />
            {faturaAberta ? (
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
