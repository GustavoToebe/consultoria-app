import { AlertCircle, CheckCircle2, Clock, ExternalLink, QrCode, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import {
  gerarCobrancaTesteOvertrainingPay,
  removerOvertrainingPay,
  salvarOvertrainingPay,
  sincronizarStatusOvertrainingPay,
  type CobrancaTesteResponse,
  type OvertrainingPayConfigResponse,
} from '../../api/financeiroOvertrainingPay';
import { centavosDaTela, centavosParaCampo, SEM_DADO } from '../../dominio/formatos';
import {
  CODIGO_OUTRO_BANCO,
  estadoInicialOvertrainingPay,
  etapasDaHomologacao,
  formatarCep,
  formatarDocumentoTitular,
  formatarTelefoneTitular,
  motivoBloqueioCobrancaTeste,
  OPCOES_DE_BANCO,
  OPCOES_TIPO_CONTA,
  OPCOES_TIPO_PESSOA,
  podeGerarCobrancaTeste,
  seloDaHomologacao,
  urlOnboardingSegura,
  validarFormularioOvertrainingPay,
  type ErrosOvertrainingPay,
  type EstadoFormularioOvertrainingPay,
} from '../../dominio/overtrainingPay';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FORMULARIO, RAIO_CONTROLE } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { semPreencher } from '../../ui/CampoDeChave';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { LinhaDeOpcao } from './AjustesDaAba';
import { avisoDeConflito, CampoMoeda, ehConflito } from './comum';
import { FolhaCobrancaTeste } from './FolhaCobrancaTeste';

interface Props {
  dados: OvertrainingPayConfigResponse;
  podeAlterar: boolean;
  aoMudar: (novo: OvertrainingPayConfigResponse) => void;
  aoRecarregar: () => void;
}

/**
 * Cartão de homologação e conta de repasse do Overtraining Pay (Prancha 2).
 * Recebe `key={dados.versao ?? 'novo'}` do pai para reinicializar o estado sem `setState` em `useEffect`.
 */
export function HomologacaoOvertrainingPay({ dados, podeAlterar, aoMudar, aoRecarregar }: Props) {
  const { cores } = useTema();
  const { avisar } = useAviso();

  const [estado, setEstado] = useState<EstadoFormularioOvertrainingPay>(() => estadoInicialOvertrainingPay(dados));
  const [rendaTexto, setRendaTexto] = useState(() => (
    dados.rendaMensalCentavos !== null && dados.rendaMensalCentavos > 0 ? centavosParaCampo(dados.rendaMensalCentavos) : ''
  ));
  const [trocandoDoc, setTrocandoDoc] = useState(false);
  const [trocandoBancoDados, setTrocandoBancoDados] = useState(false);
  const [erros, setErros] = useState<ErrosOvertrainingPay>({});
  const [erroGeral, setErroGeral] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [gerandoTeste, setGerandoTeste] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [confirmandoRemover, setConfirmandoRemover] = useState(false);
  const [cobrancaTeste, setCobrancaTeste] = useState<CobrancaTesteResponse | null>(null);

  const selo = seloDaHomologacao(dados.situacao);
  const etapas = etapasDaHomologacao(dados.situacao, dados.etapas);
  const urlOnboarding = urlOnboardingSegura(dados.onboardingUrl);
  const podeTestar = podeGerarCobrancaTeste(dados.situacao);
  const motivoTeste = motivoBloqueioCobrancaTeste(dados.situacao);
  const configurada = dados.situacao !== 'NAO_CONFIGURADA';
  const liquidadasTexto = dados.cobrancasLiquidadas === 1
    ? '1 cobrança liquidada'
    : `${dados.cobrancasLiquidadas} cobranças liquidadas`;

  const mudar = (parcial: Partial<EstadoFormularioOvertrainingPay>) => {
    setEstado((atual) => ({ ...atual, ...parcial }));
    setErroGeral(null);
  };

  const mudarRenda = (texto: string) => {
    setRendaTexto(texto);
    const centavos = centavosDaTela(texto);
    mudar({ rendaMensalCentavos: centavos });
    setErros((e) => ({ ...e, rendaMensalCentavos: undefined }));
  };

  const salvar = () => {
    const resultado = validarFormularioOvertrainingPay(estado);
    if (!resultado.ok) {
      setErros(resultado.erros);
      return;
    }
    setSalvando(true);
    setErros({});
    setErroGeral(null);
    salvarOvertrainingPay(resultado.corpo).then(
      (novo) => {
        setSalvando(false);
        setTrocandoDoc(false);
        setTrocandoBancoDados(false);
        avisar('Dados de homologação salvos com sucesso.', 'sucesso');
        aoMudar(novo);
      },
      (e: unknown) => {
        setSalvando(false);
        if (ehConflito(e)) {
          avisar(avisoDeConflito('A homologação do Overtraining Pay foi alterada'), 'neutro');
          aoRecarregar();
          return;
        }
        const campos = errosPorCampo(e) as ErrosOvertrainingPay;
        if (Object.keys(campos).length > 0) setErros(campos);
        else setErroGeral(e);
      },
    );
  };

  const sincronizar = () => {
    setSincronizando(true);
    setErroGeral(null);
    sincronizarStatusOvertrainingPay().then(
      (novo) => {
        setSincronizando(false);
        avisar('Situação da homologação atualizada.', 'sucesso');
        aoMudar(novo);
      },
      (e: unknown) => {
        setSincronizando(false);
        setErroGeral(e);
      },
    );
  };

  const abrirTeste = () => {
    setGerandoTeste(true);
    setErroGeral(null);
    gerarCobrancaTesteOvertrainingPay().then(
      (res) => {
        setGerandoTeste(false);
        setCobrancaTeste(res);
      },
      (e: unknown) => {
        setGerandoTeste(false);
        setErroGeral(e);
      },
    );
  };

  const desativar = () => {
    setRemovendo(true);
    setErroGeral(null);
    removerOvertrainingPay(dados.versao).then(
      () => {
        setRemovendo(false);
        setConfirmandoRemover(false);
        avisar('Overtraining Pay desativado.', 'sucesso');
        aoRecarregar();
      },
      (e: unknown) => {
        setRemovendo(false);
        if (ehConflito(e)) {
          setConfirmandoRemover(false);
          avisar(avisoDeConflito('A homologação do Overtraining Pay foi alterada'), 'neutro');
          aoRecarregar();
          return;
        }
        setErroGeral(e);
      },
    );
  };

  const abrirOnboarding = () => {
    if (!urlOnboarding) return;
    void Linking.openURL(urlOnboarding).catch(() => {
      avisar('Não foi possível abrir o link de validação de documentos.', 'perigo');
    });
  };

  return (
    <>
      <Cartao
        titulo="Homologação e conta de repasse"
        descricao="Configure o titular, a conta bancária de repasse e realize a cobrança teste para ativar o Overtraining Pay."
        acoes={(
          <View style={estilos.acoesTopo}>
            <Selo texto={selo.texto} tipo={selo.tipo} />
            <Selo texto={liquidadasTexto} tipo="neutro" />
          </View>
        )}
        rodape={podeAlterar ? (
          <View style={estilos.rodape}>
            {erroGeral && !confirmandoRemover ? <MensagemErro texto={textoDoErro(erroGeral)} erro={erroGeral} /> : null}
            <LinhaDeAcoes alinhar="fim">
              <Botao
                rotulo="Gerar cobrança de teste"
                tipo="acao"
                Icone={QrCode}
                carregando={gerandoTeste}
                desabilitado={!podeTestar || salvando}
                motivo={motivoTeste}
                aoTocar={abrirTeste}
              />
              <Botao
                rotulo="Salvar homologação"
                tipo="primario"
                carregando={salvando}
                desabilitado={gerandoTeste}
                aoTocar={salvar}
              />
            </LinhaDeAcoes>
          </View>
        ) : undefined}
      >
        {/* Trilha visual de 4 passos */}
        <View style={estilos.trilha} role="list" aria-label="Etapas da homologação">
          {etapas.map((etapa) => {
            const corIcone = etapa.estado === 'concluida'
              ? cores.sucesso
              : etapa.estado === 'atual'
                ? cores.atencao
                : etapa.estado === 'erro'
                  ? cores.perigo
                  : cores.textoSuave;
            const bordaEtapa = etapa.estado === 'atual' ? cores.bordaCampo : cores.divisor;
            return (
              <View
                key={etapa.id}
                role="listitem"
                style={[estilos.etapa, { backgroundColor: cores.superficie2, borderColor: bordaEtapa }]}
              >
                {etapa.estado === 'concluida' ? (
                  <CheckCircle2 size={16} color={corIcone} />
                ) : etapa.estado === 'erro' ? (
                  <AlertCircle size={16} color={corIcone} />
                ) : (
                  <Clock size={16} color={corIcone} />
                )}
                <Texto variante="pequeno" cor={etapa.estado === 'pendente' ? cores.textoSuave : cores.texto}>
                  {`${etapa.numero}. ${etapa.titulo}`}
                </Texto>
              </View>
            );
          })}
        </View>

        {/* Aviso de documentos pendentes */}
        {dados.situacao === 'DOCUMENTOS_PENDENTES' ? (
          <View style={estilos.secaoAlerta}>
            <Alerta
              tom="atencao"
              texto="Falta concluir o envio de documentos do titular para liberar a cobrança de teste."
            />
            {podeAlterar ? (
              <LinhaDeAcoes>
                {urlOnboarding ? (
                  <Botao
                    rotulo="Validar documentos do titular"
                    tipo="secundario"
                    Icone={ExternalLink}
                    aoTocar={abrirOnboarding}
                  />
                ) : null}
                <Botao
                  rotulo="Já enviei, atualizar situação"
                  tipo="secundario"
                  Icone={RefreshCw}
                  carregando={sincronizando}
                  aoTocar={sincronizar}
                />
              </LinhaDeAcoes>
            ) : null}
          </View>
        ) : null}

        {dados.situacao === 'REJEITADA' ? (
          <Alerta
            tom="perigo"
            texto="A validação anterior foi recusada. Revise os dados do titular e da conta de repasse e salve novamente."
          />
        ) : null}

        {podeAlterar ? (
          <View style={estilos.formulario}>
            {/* 1. Titular / Emissor */}
            <View style={estilos.secao}>
              <Texto variante="secao">1. Titular da conta</Texto>
              <Escolha
                rotulo="Tipo de cadastro"
                valor={estado.tipoPessoa}
                opcoes={[...OPCOES_TIPO_PESSOA]}
                aoMudar={(tipoPessoa) => {
                  mudar({ tipoPessoa, documento: '' });
                  setErros((e) => ({ ...e, documento: undefined }));
                }}
              />
              {estado.documentoJaSalvo && !trocandoDoc ? (
                <View style={estilos.blocoMascarado}>
                  <CampoLeitura
                    rotulo={estado.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}
                    valor={dados.documentoMascarado ?? SEM_DADO}
                  />
                  <LinhaDeAcoes>
                    <Botao
                      rotulo="Alterar documento"
                      tipo="secundario"
                      aoTocar={() => setTrocandoDoc(true)}
                    />
                  </LinhaDeAcoes>
                </View>
              ) : (
                <View style={estilos.blocoMascarado}>
                  <Campo
                    {...semPreencher('documento-do-titular')}
                    rotulo={estado.tipoPessoa === 'PJ' ? 'CNPJ do titular' : 'CPF do titular'}
                    valor={estado.documento}
                    aoMudar={(t) => {
                      mudar({ documento: formatarDocumentoTitular(estado.tipoPessoa, t) });
                      setErros((e) => ({ ...e, documento: undefined }));
                    }}
                    erro={erros.documento ?? null}
                    keyboardType={estado.tipoPessoa === 'PF' ? 'number-pad' : 'default'}
                    maxLength={18}
                  />
                  {estado.documentoJaSalvo ? (
                    <LinhaDeAcoes>
                      <Botao
                        rotulo="Manter documento salvo"
                        tipo="fantasma"
                        aoTocar={() => {
                          setTrocandoDoc(false);
                          mudar({ documento: '' });
                        }}
                      />
                    </LinhaDeAcoes>
                  ) : null}
                </View>
              )}

              <Campo
                rotulo={estado.tipoPessoa === 'PJ' ? 'Razão social' : 'Nome completo do titular'}
                valor={estado.nomeTitular}
                aoMudar={(nomeTitular) => {
                  mudar({ nomeTitular });
                  setErros((e) => ({ ...e, nomeTitular: undefined }));
                }}
                erro={erros.nomeTitular ?? null}
                maxLength={120}
              />

              <CamposEmLinha minimo={220}>
                <Campo
                  rotulo="E-mail financeiro"
                  valor={estado.emailFinanceiro}
                  aoMudar={(emailFinanceiro) => {
                    mudar({ emailFinanceiro });
                    setErros((e) => ({ ...e, emailFinanceiro: undefined }));
                  }}
                  erro={erros.emailFinanceiro ?? null}
                  keyboardType="email-address"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={160}
                />
                <Campo
                  rotulo="Telefone"
                  valor={estado.telefone}
                  placeholder={dados.telefoneMascarado ?? '(45) 99999-8888'}
                  ajuda={dados.telefoneMascarado ? `Salvo: ${dados.telefoneMascarado}. Deixe em branco para manter.` : 'Celular com DDD.'}
                  aoMudar={(t) => {
                    mudar({ telefone: formatarTelefoneTitular(t) });
                    setErros((e) => ({ ...e, telefone: undefined }));
                  }}
                  erro={erros.telefone ?? null}
                  keyboardType="phone-pad"
                  inputMode="tel"
                  maxLength={20}
                />
              </CamposEmLinha>

              <CamposEmLinha minimo={220}>
                <Campo
                  rotulo="CEP"
                  valor={estado.cep}
                  aoMudar={(t) => {
                    mudar({ cep: formatarCep(t) });
                    setErros((e) => ({ ...e, cep: undefined }));
                  }}
                  erro={erros.cep ?? null}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={9}
                />
                <CampoMoeda
                  rotulo={estado.tipoPessoa === 'PJ' ? 'Faturamento mensal aproximado' : 'Renda mensal aproximada'}
                  texto={rendaTexto}
                  aoMudar={mudarRenda}
                  erro={erros.rendaMensalCentavos ?? null}
                  mascara
                />
              </CamposEmLinha>

              <Campo
                rotulo="Endereço completo"
                valor={estado.enderecoResumo}
                ajuda="Rua, número, bairro, cidade e UF."
                aoMudar={(enderecoResumo) => {
                  mudar({ enderecoResumo });
                  setErros((e) => ({ ...e, enderecoResumo: undefined }));
                }}
                erro={erros.enderecoResumo ?? null}
                maxLength={200}
              />
            </View>

            {/* 2. Conta Bancária de Repasse */}
            <View style={estilos.secao}>
              <Texto variante="secao">2. Conta bancária de repasse</Texto>
              <EscolhaSuspensa
                rotulo="Banco"
                valor={estado.bancoSelecionado}
                opcoes={OPCOES_DE_BANCO}
                rotuloDaBusca="Buscar banco pelo nome ou código"
                textoVazio="Nenhum banco encontrado."
                aoMudar={(bancoSelecionado) => {
                  mudar({ bancoSelecionado });
                  setErros((e) => ({ ...e, bancoCodigo: undefined, bancoNome: undefined }));
                }}
              />
              {estado.bancoSelecionado === CODIGO_OUTRO_BANCO ? (
                <CamposEmLinha minimo={200}>
                  <Campo
                    rotulo="Código do banco (3 dígitos)"
                    valor={estado.bancoCodigoCustom}
                    aoMudar={(t) => {
                      mudar({ bancoCodigoCustom: t.replace(/\D/g, '').slice(0, 3) });
                      setErros((e) => ({ ...e, bancoCodigo: undefined }));
                    }}
                    erro={erros.bancoCodigo ?? null}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={3}
                  />
                  <Campo
                    rotulo="Nome do banco"
                    valor={estado.bancoNomeCustom}
                    aoMudar={(bancoNomeCustom) => {
                      mudar({ bancoNomeCustom });
                      setErros((e) => ({ ...e, bancoNome: undefined }));
                    }}
                    erro={erros.bancoNome ?? null}
                    maxLength={80}
                  />
                </CamposEmLinha>
              ) : null}

              <Escolha
                rotulo="Tipo de conta"
                valor={estado.tipoConta}
                opcoes={[...OPCOES_TIPO_CONTA]}
                aoMudar={(tipoConta) => mudar({ tipoConta })}
              />

              {estado.agenciaJaSalva && estado.contaJaSalva && !trocandoBancoDados ? (
                <View style={estilos.blocoMascarado}>
                  <CamposEmLinha minimo={160}>
                    <CampoLeitura rotulo="Agência" valor={dados.agenciaMascarada ?? SEM_DADO} />
                    <CampoLeitura rotulo="Conta com dígito" valor={dados.contaMascarada ?? SEM_DADO} />
                  </CamposEmLinha>
                  <LinhaDeAcoes>
                    <Botao
                      rotulo="Alterar agência e conta"
                      tipo="secundario"
                      aoTocar={() => setTrocandoBancoDados(true)}
                    />
                  </LinhaDeAcoes>
                </View>
              ) : (
                <View style={estilos.blocoMascarado}>
                  <CamposEmLinha minimo={200}>
                    <Campo
                      rotulo="Agência (sem dígito)"
                      valor={estado.agencia}
                      aoMudar={(t) => {
                        mudar({ agencia: t.replace(/\D/g, '').slice(0, 6) });
                        setErros((e) => ({ ...e, agencia: undefined }));
                      }}
                      erro={erros.agencia ?? null}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={6}
                    />
                    <Campo
                      rotulo="Conta com dígito"
                      valor={estado.conta}
                      placeholder="123456-7"
                      aoMudar={(t) => {
                        mudar({ conta: t.replace(/[^0-9A-Za-z-]/g, '').slice(0, 16) });
                        setErros((e) => ({ ...e, conta: undefined }));
                      }}
                      erro={erros.conta ?? null}
                      maxLength={16}
                    />
                  </CamposEmLinha>
                  {estado.agenciaJaSalva && estado.contaJaSalva ? (
                    <LinhaDeAcoes>
                      <Botao
                        rotulo="Manter agência e conta salvas"
                        tipo="fantasma"
                        aoTocar={() => {
                          setTrocandoBancoDados(false);
                          mudar({ agencia: '', conta: '' });
                        }}
                      />
                    </LinhaDeAcoes>
                  ) : null}
                </View>
              )}

              <LinhaDeOpcao
                titulo="Repasse Pix diário automático"
                descricao="Transfere automaticamente o saldo disponível para sua conta bancária cadastrada."
                interruptor={{
                  valor: estado.repasseAutomatico,
                  aoMudar: (repasseAutomatico) => mudar({ repasseAutomatico }),
                }}
              />
            </View>

            {configurada ? (
              <LinhaDeAcoes>
                <Botao
                  rotulo="Desativar Overtraining Pay"
                  tipo="perigoTexto"
                  aoTocar={() => {
                    setErroGeral(null);
                    setConfirmandoRemover(true);
                  }}
                />
              </LinhaDeAcoes>
            ) : null}
          </View>
        ) : (
          <View style={estilos.formulario}>
            <CamposEmLinha minimo={180}>
              <CampoLeitura rotulo="Titular" valor={dados.nomeTitular ?? SEM_DADO} />
              <CampoLeitura rotulo="Documento" valor={dados.documentoMascarado ?? SEM_DADO} />
              <CampoLeitura rotulo="E-mail financeiro" valor={dados.emailFinanceiro ?? SEM_DADO} />
              <CampoLeitura rotulo="Banco" valor={dados.bancoCodigo && dados.bancoNome ? `${dados.bancoCodigo} - ${dados.bancoNome}` : SEM_DADO} />
              <CampoLeitura rotulo="Agência" valor={dados.agenciaMascarada ?? SEM_DADO} />
              <CampoLeitura rotulo="Conta" valor={dados.contaMascarada ?? SEM_DADO} />
            </CamposEmLinha>
            <Texto variante="suave">Para alterar a homologação do Overtraining Pay, peça a quem administra o financeiro.</Texto>
          </View>
        )}
      </Cartao>

      <FolhaCobrancaTeste
        visivel={!!cobrancaTeste}
        cobranca={cobrancaTeste}
        aoFechar={() => setCobrancaTeste(null)}
        aoHomologar={() => {
          setCobrancaTeste(null);
          aoRecarregar();
        }}
      />

      <PainelConfirmacao
        visivel={confirmandoRemover}
        titulo="Desativar o Overtraining Pay?"
        mensagem="O Overtraining Pay será desligado nas formas de recebimento e as credenciais locais serão apagadas. Os pagamentos já registrados continuam no histórico."
        rotuloConfirmar="Desativar Overtraining Pay"
        rotuloCancelar="Voltar"
        perigo
        carregando={removendo}
        aoConfirmar={desativar}
        aoCancelar={() => setConfirmandoRemover(false)}
      >
        {erroGeral && confirmandoRemover ? <MensagemErro texto={textoDoErro(erroGeral)} erro={erroGeral} /> : null}
      </PainelConfirmacao>
    </>
  );
}

const estilos = StyleSheet.create({
  acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  trilha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  etapa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(0.75),
    borderWidth: 1,
    borderRadius: RAIO_CONTROLE,
    paddingHorizontal: espaco(1.25),
    paddingVertical: espaco(0.75),
  },
  secaoAlerta: { gap: espaco(1.5) },
  formulario: { gap: espaco(2.5), maxWidth: LARGURA_FORMULARIO },
  secao: { gap: espaco(1.5) },
  blocoMascarado: { gap: espaco(0.75) },
  rodape: { gap: espaco(1) },
});
