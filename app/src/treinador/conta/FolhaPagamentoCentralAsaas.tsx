import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, CreditCard, QrCode, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  consultarSituacaoMinhaConta,
  gerarPixMinhaContaAsaas,
  pagarCartaoMinhaContaAsaas,
  type PixMinhaContaAsaasResponse,
} from '../../api/minhaContaAsaas';
import type { CobrancaDaConta } from '../../api/tipos';
import {
  dataUriQrCodeBase64,
  erroCpfCnpjPagador,
  formularioCartaoTemErros,
  mascaraCartao,
  mascaraCep,
  mascaraCpfCnpj,
  mascaraCvv,
  mascaraTelefone,
  mascaraValidadeCartao,
  opcoesDeParcelamento,
  parsearValidadeCartao,
  somenteDigitos,
  validarFormularioCartao,
  type ErrosFormularioCartao,
} from '../../dominio/checkoutTransparente';
import { dataHoraParaTela, dataParaTela, moedaParaTela, SEM_DADO } from '../../dominio/formatos';
import { competenciaParaTela, situacaoDaCobrancaParaTela } from '../../dominio/minhaConta';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CodigoQr } from '../../ui/CodigoQr';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Alerta } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha, LARGURA_FOLHA } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

type AbaPagamentoCentral = 'pix' | 'cartao';

const ABAS_CENTRAL: { valor: AbaPagamentoCentral; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix imediato' },
  { valor: 'cartao', rotulo: 'Cartão de crédito' },
];

const INTERVALO_POLLING_MS = 4000;

interface Props {
  cobranca: CobrancaDaConta | null;
  documentoPadrao?: string | null;
  emailPadrao?: string | null;
  telefonePadrao?: string | null;
  cepPadrao?: string | null;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

/**
 * Checkout Transparente Asaas para quitar faturas da assinatura na Central dentro de `Minha conta`.
 * PCI-DSS / LGPD: dados do cartão ficam apenas em estado volátil enquanto a folha está aberta e são descartados ao concluir/fechar.
 */
export function FolhaPagamentoCentralAsaas({
  cobranca,
  documentoPadrao,
  emailPadrao,
  telefonePadrao,
  cepPadrao,
  aoFechar,
  aoConfirmarPagamento,
}: Props) {
  return (
    <Folha
      visivel={cobranca !== null}
      titulo="Pagar fatura da assinatura"
      largura={LARGURA_FOLHA}
      aoFechar={aoFechar}
    >
      {cobranca ? (
        <ConteudoPagamentoCentral
          key={cobranca.id}
          cobranca={cobranca}
          documentoPadrao={documentoPadrao}
          emailPadrao={emailPadrao}
          telefonePadrao={telefonePadrao}
          cepPadrao={cepPadrao}
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
  emailPadrao?: string | null;
  telefonePadrao?: string | null;
  cepPadrao?: string | null;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

function ConteudoPagamentoCentral({
  cobranca,
  documentoPadrao,
  emailPadrao,
  telefonePadrao,
  cepPadrao,
  aoFechar,
  aoConfirmarPagamento,
}: ConteudoProps) {
  const { cores } = useTema();
  const { avisar } = useAviso();

  const [aba, setAba] = useState<AbaPagamentoCentral>('pix');
  const [confirmado, setConfirmado] = useState(false);
  const [emProcessamento, setEmProcessamento] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const docInicial = documentoPadrao ? mascaraCpfCnpj(documentoPadrao) : '';
  const [cpfCnpjPix, setCpfCnpjPix] = useState(docInicial);
  const [erroDocPix, setErroDocPix] = useState<string | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pix, setPix] = useState<PixMinhaContaAsaasResponse | null>(null);
  const [codigoManual, setCodigoManual] = useState(false);

  // Estado volátil do cartão
  const [parcelas, setParcelas] = useState(1);
  const [nomeImpresso, setNomeImpresso] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');
  const [validade, setValidade] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpfCnpjCartao, setCpfCnpjCartao] = useState(docInicial);
  const [cep, setCep] = useState(cepPadrao ? mascaraCep(cepPadrao) : '');
  const [numeroEndereco, setNumeroEndereco] = useState('');
  const [email, setEmail] = useState(emailPadrao ?? '');
  const [telefone, setTelefone] = useState(telefonePadrao ? mascaraTelefone(telefonePadrao) : '');
  const [errosCartao, setErrosCartao] = useState<ErrosFormularioCartao | null>(null);
  const [enviandoCartao, setEnviandoCartao] = useState(false);

  const ocupadoRef = useRef(false);
  const aoConfirmarRef = useRef(aoConfirmarPagamento);
  useEffect(() => {
    aoConfirmarRef.current = aoConfirmarPagamento;
  });

  const limparDadosSensiveis = () => {
    setNumeroCartao('');
    setValidade('');
    setCvv('');
  };

  const fecharComLimpeza = () => {
    limparDadosSensiveis();
    aoFechar();
  };

  const valorCentavos = Math.round(cobranca.valor * 100);
  const opcoesParcelas = useMemo(
    () => opcoesDeParcelamento(valorCentavos, 12, 'ALUNO').map((o) => ({ valor: o.parcelas, rotulo: o.rotulo })),
    [valorCentavos],
  );

  const deveFazerPolling = aba === 'pix' && pix !== null && !confirmado;
  useEffect(() => {
    if (!deveFazerPolling) return;
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
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [deveFazerPolling, cobranca.id]);

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

  const pagarCartao = () => {
    if (ocupadoRef.current) return;
    setErroGeral(null);
    const erros = validarFormularioCartao(
      {
        nomeImpresso,
        numero: numeroCartao,
        validade,
        cvv,
        cpfCnpj: cpfCnpjCartao,
        cep,
        numeroEndereco,
        email,
        telefone,
      },
      { aceitarCnpj: true },
    );
    setErrosCartao(erros);
    if (formularioCartaoTemErros(erros)) return;
    const validadeParsed = parsearValidadeCartao(validade);
    if (!validadeParsed) return;

    ocupadoRef.current = true;
    setEnviandoCartao(true);
    const docLimpo = somenteDigitos(cpfCnpjCartao);
    pagarCartaoMinhaContaAsaas(cobranca.id, {
      cpfCnpj: docLimpo,
      parcelas,
      cartao: {
        nomeImpresso: nomeImpresso.trim(),
        numero: somenteDigitos(numeroCartao),
        mesValidade: validadeParsed.mes,
        anoValidade: validadeParsed.ano,
        cvv: somenteDigitos(cvv),
      },
      titular: {
        nome: nomeImpresso.trim(),
        cpfCnpj: docLimpo,
        email: email.trim() || undefined,
        telefone: somenteDigitos(telefone) || undefined,
        cep: somenteDigitos(cep),
        numeroEndereco: numeroEndereco.trim() || undefined,
      },
    })
      .then((res) => {
        limparDadosSensiveis();
        if (res.situacao === 'PAGA') {
          setConfirmado(true);
          aoConfirmarRef.current();
        } else {
          setEmProcessamento(true);
          aoConfirmarRef.current();
        }
      })
      .catch((erro: unknown) => {
        setErroGeral(textoDoErro(erro));
      })
      .finally(() => {
        ocupadoRef.current = false;
        setEnviandoCartao(false);
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
          <Botao rotulo="Fechar" tipo="primario" cheio aoTocar={fecharComLimpeza} />
        </View>
      ) : emProcessamento ? (
        <View style={estilos.bloco}>
          <Alerta
            tom="atencao"
            titulo="Pagamento em processamento"
            texto="Seu cartão foi enviado para análise da operadora. Assim que for aprovado, a fatura será atualizada automaticamente."
          />
          <Botao rotulo="Fechar" tipo="primario" cheio aoTocar={fecharComLimpeza} />
        </View>
      ) : (
        <>
          <Abas abas={ABAS_CENTRAL} ativa={aba} aoMudar={setAba} fundo={cores.superficie} />

          {aba === 'pix' ? (
            <View style={estilos.bloco}>
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
          ) : (
            <View style={estilos.bloco}>
              <EscolhaSuspensa
                rotulo="Parcelamento"
                titulo="Escolher parcelas"
                valor={parcelas}
                opcoes={opcoesParcelas}
                aoMudar={setParcelas}
                semBusca
              />
              <Campo
                rotulo="Nome impresso no cartão"
                valor={nomeImpresso}
                aoMudar={setNomeImpresso}
                erro={errosCartao?.nomeImpresso}
                placeholder="Como aparece no cartão"
                autoCapitalize="characters"
                autoComplete="cc-name"
              />
              <Campo
                rotulo="Número do cartão"
                valor={numeroCartao}
                aoMudar={(t) => setNumeroCartao(mascaraCartao(t))}
                erro={errosCartao?.numero}
                placeholder="0000 0000 0000 0000"
                keyboardType="number-pad"
                autoComplete="cc-number"
                numerico
              />
              <CamposEmLinha minimo={120}>
                <Campo
                  rotulo="Validade"
                  valor={validade}
                  aoMudar={(t) => setValidade(mascaraValidadeCartao(t))}
                  erro={errosCartao?.validade}
                  placeholder="MM/AA"
                  keyboardType="number-pad"
                  autoComplete="cc-exp"
                  numerico
                />
                <Campo
                  rotulo="CVV"
                  valor={cvv}
                  aoMudar={(t) => setCvv(mascaraCvv(t))}
                  erro={errosCartao?.cvv}
                  placeholder="123"
                  keyboardType="number-pad"
                  secureTextEntry
                  autoComplete="cc-csc"
                  numerico
                />
              </CamposEmLinha>
              <CamposEmLinha minimo={140}>
                <Campo
                  rotulo="CPF ou CNPJ do titular"
                  valor={cpfCnpjCartao}
                  aoMudar={(t) => setCpfCnpjCartao(mascaraCpfCnpj(t))}
                  erro={errosCartao?.cpfCnpj}
                  placeholder="000.000.000-00"
                  keyboardType="number-pad"
                  numerico
                />
                <Campo
                  rotulo="CEP"
                  valor={cep}
                  aoMudar={(t) => setCep(mascaraCep(t))}
                  erro={errosCartao?.cep}
                  placeholder="00000-000"
                  keyboardType="number-pad"
                  numerico
                />
              </CamposEmLinha>
              <CamposEmLinha minimo={140}>
                <Campo
                  rotulo="Número do endereço (opcional)"
                  valor={numeroEndereco}
                  aoMudar={setNumeroEndereco}
                  placeholder="Ex.: 100"
                />
                <Campo
                  rotulo="Telefone (opcional)"
                  valor={telefone}
                  aoMudar={(t) => setTelefone(mascaraTelefone(t))}
                  erro={errosCartao?.telefone}
                  placeholder="(11) 99999-9999"
                  keyboardType="phone-pad"
                  numerico
                />
              </CamposEmLinha>
              <Campo
                rotulo="E-mail do titular (opcional)"
                valor={email}
                aoMudar={setEmail}
                erro={errosCartao?.email}
                placeholder="financeiro@consultoria.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={estilos.seguranca}>
                <ShieldCheck size={16} color={cores.textoSuave} strokeWidth={2} />
                <Texto variante="pequeno" style={estilos.flexTexto}>
                  Os dados do cartão são enviados com criptografia e nunca ficam salvos neste aparelho.
                </Texto>
              </View>
              <Botao
                rotulo={`Pagar fatura com cartão · ${valorFormatado}`}
                Icone={CreditCard}
                tipo="primario"
                cheio
                carregando={enviandoCartao}
                aoTocar={pagarCartao}
              />
            </View>
          )}
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
  pixBox: { alignItems: 'center', gap: espaco(1.5) },
  qrQuadro: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), backgroundColor: '#FFFFFF' },
  qrImagem: { width: 200, height: 200 },
  centralizado: { textAlign: 'center' },
  codigoCaixa: { width: '100%', borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  confirmado: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1), alignItems: 'center' },
  seguranca: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
});
