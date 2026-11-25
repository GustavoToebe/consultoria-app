import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, CreditCard, QrCode, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  consultarSituacaoCobrancaAluno,
  gerarPixOvertrainingPay,
  pagarCartaoOvertrainingPay,
  type PixOvertrainingPayResponse,
} from '../../api/alunoOvertrainingPay';
import type { CobrancaDoAluno, JurosDoParcelamento } from '../../api/financeiroTipos';
import {
  dataUriQrCodeBase64,
  erroCpfPagador,
  formularioCartaoTemErros,
  mascaraCartao,
  mascaraCep,
  mascaraCpf,
  mascaraCvv,
  mascaraTelefone,
  mascaraValidadeCartao,
  opcoesDeParcelamento,
  parsearValidadeCartao,
  somenteDigitos,
  validarFormularioCartao,
  type ErrosFormularioCartao,
} from '../../dominio/checkoutTransparente';
import { referenciaDaCobranca, seloDaCobranca } from '../../dominio/financeiro';
import { centavosParaTela, dataHoraParaTela, dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
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

type AbaCheckout = 'pix' | 'cartao';

const ABAS_CHECKOUT: { valor: AbaCheckout; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix imediato' },
  { valor: 'cartao', rotulo: 'Cartão de crédito' },
];

const INTERVALO_POLLING_MS = 4000;

interface Props {
  cobranca: CobrancaDoAluno | null;
  maxParcelas: number;
  juros: JurosDoParcelamento;
  cpfPagadorCadastrado: boolean;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

/**
 * Checkout Transparente do aluno (Pix imediato com QR Code + Cartão de crédito) sem sair do app.
 * PCI-DSS / LGPD: dados do cartão existem apenas no estado volátil do conteúdo montado enquanto a folha está aberta e são
 * descartados imediatamente ao confirmar ou fechar (nunca salvos em storage, URL ou log).
 */
export function FolhaCheckoutTransparente({
  cobranca,
  maxParcelas,
  juros,
  cpfPagadorCadastrado,
  aoFechar,
  aoConfirmarPagamento,
}: Props) {
  return (
    <Folha
      visivel={cobranca !== null}
      titulo="Pagamento no app"
      largura={LARGURA_FOLHA}
      aoFechar={aoFechar}
    >
      {cobranca ? (
        <ConteudoCheckoutTransparente
          key={cobranca.id}
          cobranca={cobranca}
          maxParcelas={maxParcelas}
          juros={juros}
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
  maxParcelas: number;
  juros: JurosDoParcelamento;
  cpfPagadorCadastrado: boolean;
  aoFechar: () => void;
  aoConfirmarPagamento: () => void;
}

function ConteudoCheckoutTransparente({
  cobranca,
  maxParcelas,
  juros,
  cpfPagadorCadastrado,
  aoFechar,
  aoConfirmarPagamento,
}: ConteudoProps) {
  const { cores } = useTema();
  const { avisar } = useAviso();

  const [aba, setAba] = useState<AbaCheckout>('pix');
  const [confirmado, setConfirmado] = useState(false);
  const [emProcessamento, setEmProcessamento] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Estado do Pix
  const [cpfPix, setCpfPix] = useState('');
  const [erroCpfPix, setErroCpfPix] = useState<string | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pix, setPix] = useState<PixOvertrainingPayResponse | null>(null);
  const [codigoManual, setCodigoManual] = useState(false);

  // Estado volátil do cartão (zerado ao concluir ou fechar)
  const [parcelas, setParcelas] = useState(1);
  const [nomeImpresso, setNomeImpresso] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');
  const [validade, setValidade] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpfTitular, setCpfTitular] = useState('');
  const [cep, setCep] = useState('');
  const [numeroEndereco, setNumeroEndereco] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
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
    setCpfTitular('');
    setCpfPix('');
  };

  const fecharComLimpeza = () => {
    limparDadosSensiveis();
    aoFechar();
  };

  const opcoesParcelas = useMemo(
    () => opcoesDeParcelamento(cobranca.valorCentavos, maxParcelas, juros),
    [cobranca.valorCentavos, maxParcelas, juros],
  );
  const opcoesSuspensa = useMemo(
    () => opcoesParcelas.map((o) => ({ valor: o.parcelas, rotulo: o.rotulo })),
    [opcoesParcelas],
  );

  // Polling leve a cada 4s enquanto o QR Code Pix estiver visível e não confirmado.
  const deveFazerPolling = aba === 'pix' && pix !== null && !confirmado;
  useEffect(() => {
    if (!deveFazerPolling) return;
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
          // Falha pontual de rede durante polling: tenta novamente no próximo ciclo.
        });
    };
    const id = setInterval(verificar, INTERVALO_POLLING_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [deveFazerPolling, cobranca.id]);

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

  const pagarCartao = () => {
    if (ocupadoRef.current) return;
    setErroGeral(null);
    const erros = validarFormularioCartao({
      nomeImpresso,
      numero: numeroCartao,
      validade,
      cvv,
      cpfCnpj: cpfTitular,
      cep,
      numeroEndereco,
      email,
      telefone,
    });
    setErrosCartao(erros);
    if (formularioCartaoTemErros(erros)) return;
    const validadeParsed = parsearValidadeCartao(validade);
    if (!validadeParsed) return;

    ocupadoRef.current = true;
    setEnviandoCartao(true);
    const cpfLimpo = somenteDigitos(cpfTitular);
    pagarCartaoOvertrainingPay(cobranca.id, {
      cpfPagador: cpfLimpo,
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
        cpfCnpj: cpfLimpo,
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
      {/* Resumo da cobrança */}
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
          <Botao rotulo="Fechar" tipo="primario" cheio aoTocar={fecharComLimpeza} />
        </View>
      ) : emProcessamento ? (
        <View style={estilos.bloco}>
          <Alerta
            tom="atencao"
            titulo="Pagamento em processamento"
            texto="Seu cartão foi enviado para análise da operadora. Assim que for aprovado, a cobrança será marcada como paga automaticamente."
          />
          <Botao rotulo="Fechar" tipo="primario" cheio aoTocar={fecharComLimpeza} />
        </View>
      ) : (
        <>
          <Abas abas={ABAS_CHECKOUT} ativa={aba} aoMudar={setAba} fundo={cores.superficie} />

          {aba === 'pix' ? (
            <View style={estilos.bloco}>
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
          ) : (
            <View style={estilos.bloco}>
              <EscolhaSuspensa
                rotulo="Parcelamento"
                titulo="Escolher parcelas"
                valor={parcelas}
                opcoes={opcoesSuspensa}
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
                  rotulo="CPF do titular"
                  valor={cpfTitular}
                  aoMudar={(t) => setCpfTitular(mascaraCpf(t))}
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
                  placeholder="Ex.: 120"
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
                placeholder="nome@exemplo.com"
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
                rotulo={`Pagar com cartão · ${valorFormatado}`}
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
