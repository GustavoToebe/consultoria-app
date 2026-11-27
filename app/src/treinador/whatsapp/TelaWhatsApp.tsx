import { CheckCircle2, Lock, MessageCircle, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dataHoraParaTela } from '../../dominio/formatos';
import { LARGURA_DUAS_COLUNAS } from '../../dominio/grade';
import {
  ehWhatsAppIndisponivel,
  ROTULOS_TIPO_AVISO,
  seloDaSituacaoModelo,
  validarConexaoWhatsApp,
  validarModeloWhatsApp,
  type ErrosConexaoWhatsApp,
  type ErrosModeloWhatsApp,
} from '../../dominio/whatsapp';
import {
  listarModelosWhatsApp,
  obterConexaoWhatsApp,
  removerConexaoWhatsApp,
  removerModeloWhatsApp,
  salvarConexaoWhatsApp,
  salvarModeloWhatsApp,
  type ConexaoWhatsApp,
  type ModeloWhatsApp,
} from '../../servicos/whatsapp';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FORMULARIO, LARGURA_LISTA, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { Grade } from '../../ui/Grade';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

/**
 * Configuração do WhatsApp oficial da Meta (Passo B9 de `docs/planos/contato-da-consultoria.md`).
 * Exige `WHATSAPP_ALTERAR`; se a chave `TREINOS_WHATSAPP_HABILITADO` estiver desligada no servidor (503),
 * mostra aviso claro de recurso desativado. O token de acesso nunca é reexibido.
 */
export function TelaWhatsApp() {
  const { pode } = useSessao();

  if (!pode('WHATSAPP_ALTERAR')) {
    return (
      <Tela bordas={['top']} largura={LARGURA_LISTA}>
        <Cabecalho titulo="WhatsApp oficial" descricao="Avisos automáticos de cobrança e compromisso via Meta." />
        <Vazio
          Icone={Lock}
          nivel={1}
          titulo="Acesso restrito"
          texto="Apenas quem tem permissão de configurar o WhatsApp da consultoria pode acessar esta tela."
        />
      </Tela>
    );
  }

  return <ConteudoWhatsApp />;
}

function ConteudoWhatsApp() {
  const { cores } = useTema();
  const { avisar } = useAviso();

  const dados = useCarregar('whatsapp-config', async () => {
    const [conexao, modelos] = await Promise.all([obterConexaoWhatsApp(), listarModelosWhatsApp()]);
    return { conexao, modelos: modelos.modelos };
  });

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [formIniciadoParaVersao, setFormIniciadoParaVersao] = useState<string | null>(null);
  const [errosConexao, setErrosConexao] = useState<ErrosConexaoWhatsApp>({});
  const [salvandoConexao, setSalvandoConexao] = useState(false);
  const [confirmarDesconectar, setConfirmarDesconectar] = useState(false);
  const [removendoConexao, setRemovendoConexao] = useState(false);

  const [modeloEditando, setModeloEditando] = useState<ModeloWhatsApp | null>(null);
  const [nomeModelo, setNomeModelo] = useState('');
  const [idiomaModelo, setIdiomaModelo] = useState('pt_BR');
  const [errosModelo, setErrosModelo] = useState<ErrosModeloWhatsApp>({});
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [modeloParaRemover, setModeloParaRemover] = useState<ModeloWhatsApp | null>(null);
  const [removendoModelo, setRemovendoModelo] = useState(false);

  // Tela larga (revisão de 24/11): quando sobra espaço para os modelos em duas colunas ao lado, a Conexão fica com a
  // largura de formulário à esquerda e os Modelos ao lado, em grade; abaixo disso, um embaixo do outro, como antes.
  const { largura, aoMedir } = useFaixaDeLargura();
  // O recuo do cartão dos Modelos (20 px e a borda de cada lado) também sai da conta, para a grade ter os 760 das 2 colunas.
  const ladoALado = largura >= LARGURA_FORMULARIO + espaco(3) + LARGURA_DUAS_COLUNAS + 2 * espaco(3);

  const conexao: ConexaoWhatsApp | undefined = dados.dados?.conexao;
  const modelos: ModeloWhatsApp[] = dados.dados?.modelos ?? [];

  if (conexao) {
    const assinatura = `${conexao.configurada}:${conexao.versao ?? 'n'}`;
    if (formIniciadoParaVersao !== assinatura) {
      setFormIniciadoParaVersao(assinatura);
      setPhoneNumberId(conexao.phoneNumberId ?? '');
      setWabaId(conexao.wabaId ?? '');
      setAccessToken('');
    }
  }

  if (dados.erro && ehWhatsAppIndisponivel(dados.erro)) {
    return (
      <Tela bordas={['top']} largura={LARGURA_LISTA}>
        <Cabecalho titulo="WhatsApp oficial" descricao="Avisos automáticos de cobrança e compromisso via Meta." />
        <Vazio
          Icone={MessageCircle}
          nivel={1}
          titulo="Recurso desativado"
          texto="Os avisos pelo WhatsApp oficial não estão ativos nesta instalação do app."
        />
      </Tela>
    );
  }

  const aoSalvarConexao = async () => {
    const configurada = !!conexao?.configurada;
    const erros = validarConexaoWhatsApp({ phoneNumberId, wabaId, accessToken, configurada });
    setErrosConexao(erros);
    if (Object.keys(erros).length > 0) return;

    setSalvandoConexao(true);
    try {
      await salvarConexaoWhatsApp({
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        accessToken: accessToken.trim() ? accessToken.trim() : null,
        versao: conexao?.versao ?? null,
      });
      setAccessToken('');
      avisar('Conexão do WhatsApp salva.', 'sucesso');
      dados.recarregar();
    } catch (e: unknown) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setSalvandoConexao(false);
    }
  };

  const aoDesconectar = async () => {
    setRemovendoConexao(true);
    try {
      await removerConexaoWhatsApp(conexao?.versao ?? null);
      setConfirmarDesconectar(false);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      avisar('Conexão removida e avisos pendentes cancelados.', 'neutro');
      dados.recarregar();
    } catch (e: unknown) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setRemovendoConexao(false);
    }
  };

  const abrirEdicaoModelo = (m: ModeloWhatsApp) => {
    setModeloEditando(m);
    setNomeModelo(m.nome ?? '');
    setIdiomaModelo(m.idioma ?? 'pt_BR');
    setErrosModelo({});
  };

  const aoSalvarModelo = async () => {
    if (!modeloEditando) return;
    const erros = validarModeloWhatsApp({ nome: nomeModelo, idioma: idiomaModelo });
    setErrosModelo(erros);
    if (Object.keys(erros).length > 0) return;

    setSalvandoModelo(true);
    try {
      await salvarModeloWhatsApp(modeloEditando.tipo, {
        nome: nomeModelo.trim(),
        idioma: idiomaModelo.trim(),
        versao: modeloEditando.versao ?? null,
      });
      setModeloEditando(null);
      avisar('Modelo salvo.', 'sucesso');
      dados.recarregar();
    } catch (e: unknown) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setSalvandoModelo(false);
    }
  };

  const aoRemoverModelo = async () => {
    if (!modeloParaRemover) return;
    setRemovendoModelo(true);
    try {
      await removerModeloWhatsApp(modeloParaRemover.tipo, modeloParaRemover.versao ?? null);
      setModeloParaRemover(null);
      avisar('Modelo removido.', 'neutro');
      dados.recarregar();
    } catch (e: unknown) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setRemovendoModelo(false);
    }
  };

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="WhatsApp oficial"
        descricao="Conecte a conta comercial da Meta da sua consultoria para enviar lembretes de cobrança e avisos de compromisso."
      />

      {dados.erro ? <MensagemErro texto={textoDoErro(dados.erro)} erro={dados.erro} tentarDeNovo={dados.recarregar} /> : null}
      {!dados.dados && dados.carregando ? <Esqueleto texto="Carregando configuração do WhatsApp" /> : null}

      {conexao ? (
        <View onLayout={aoMedir} style={[estilos.blocos, ladoALado ? estilos.ladoALado : null]}>
          <Cartao
            style={ladoALado ? estilos.conexao : null}
            titulo="Conexão com a Meta"
            descricao="Use os dados da conta comercial da sua consultoria no Gerenciador do WhatsApp (Cloud API)."
            acoes={
              <Selo
                texto={conexao.configurada ? 'Conectada' : 'Não conectada'}
                tipo={conexao.configurada ? 'sucesso' : 'neutro'}
              />
            }
          >
            {conexao.configurada && conexao.tokenGravadoEm ? (
              <Texto variante="suave">
                Token de acesso salvo em {dataHoraParaTela(conexao.tokenGravadoEm)}. Por segurança, ele não é exibido; preencha apenas se quiser trocar.
              </Texto>
            ) : null}

            <Campo
              rotulo="Phone Number ID"
              valor={phoneNumberId}
              aoMudar={setPhoneNumberId}
              erro={errosConexao.phoneNumberId ?? null}
              placeholder="Ex.: 123456789012345"
              autoCapitalize="none"
            />
            <Campo
              rotulo="WABA ID (Conta do WhatsApp Business)"
              valor={wabaId}
              aoMudar={setWabaId}
              erro={errosConexao.wabaId ?? null}
              placeholder="Ex.: 987654321098765"
              autoCapitalize="none"
            />
            <Campo
              rotulo={conexao.configurada ? 'Novo token de acesso (opcional)' : 'Token de acesso da Meta'}
              valor={accessToken}
              aoMudar={setAccessToken}
              erro={errosConexao.accessToken ?? null}
              secureTextEntry
              autoCapitalize="none"
              placeholder={conexao.configurada ? 'Deixe em branco para manter o atual' : 'Cole o token permanente da Meta'}
            />

            <LinhaDeAcoes>
              <Botao
                rotulo={conexao.configurada ? 'Salvar conexão' : 'Conectar WhatsApp'}
                tipo="primario"
                Icone={CheckCircle2}
                carregando={salvandoConexao}
                aoTocar={() => void aoSalvarConexao()}
              />
              {conexao.configurada ? (
                <Botao
                  rotulo="Desconectar"
                  tipo="perigoTexto"
                  Icone={Trash2}
                  aoTocar={() => setConfirmarDesconectar(true)}
                />
              ) : null}
            </LinhaDeAcoes>
          </Cartao>

          <Cartao
            style={ladoALado ? estilos.modelos : null}
            titulo="Modelos de mensagem"
            descricao="Cadastre cada modelo no Gerenciador da Meta na categoria Utilidade com as variáveis na ordem exata e informe o nome abaixo."
          >
            <Grade gap={espaco(1.5)}>
              {modelos.map((m) => {
                const selo = seloDaSituacaoModelo(m.situacao, m.configurado);
                return (
                  <View
                    key={m.tipo}
                    style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}
                  >
                    <View style={estilos.cabecalhoItem}>
                      <Texto variante="bloco" nivel={3} style={estilos.encolher}>
                        {ROTULOS_TIPO_AVISO[m.tipo] ?? m.tipo}
                      </Texto>
                      <Selo texto={selo.texto} tipo={selo.tipo} />
                    </View>

                    {m.configurado ? (
                      <Texto variante="suave" numerico>
                        Modelo: {m.nome} ({m.idioma})
                      </Texto>
                    ) : null}

                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      Texto sugerido: {m.textoSugerido}
                    </Texto>
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      Variáveis: {m.variaveis.map((v, i) => `{{${i + 1}}} ${v}`).join(' · ')}
                    </Texto>

                    <LinhaDeAcoes>
                      {/* Seis cartões com os mesmos botões: o nome acessível diz de qual aviso é (começa pelo rótulo visível). */}
                      <Botao
                        rotulo={m.configurado ? 'Editar modelo' : 'Configurar modelo'}
                        rotuloAcessivel={`${m.configurado ? 'Editar modelo' : 'Configurar modelo'}: ${ROTULOS_TIPO_AVISO[m.tipo] ?? m.tipo}`}
                        tipo="secundario"
                        aoTocar={() => abrirEdicaoModelo(m)}
                      />
                      {m.configurado ? (
                        <Botao
                          rotulo="Remover"
                          rotuloAcessivel={`Remover modelo: ${ROTULOS_TIPO_AVISO[m.tipo] ?? m.tipo}`}
                          tipo="fantasma"
                          aoTocar={() => setModeloParaRemover(m)}
                        />
                      ) : null}
                    </LinhaDeAcoes>
                  </View>
                );
              })}
            </Grade>
          </Cartao>
        </View>
      ) : null}

      <Folha
        visivel={!!modeloEditando}
        titulo={modeloEditando ? ROTULOS_TIPO_AVISO[modeloEditando.tipo] : 'Modelo'}
        aoFechar={() => setModeloEditando(null)}
        rodape={
          <>
            <Botao rotulo="Cancelar" tipo="secundario" aoTocar={() => setModeloEditando(null)} />
            <Botao
              rotulo="Salvar modelo"
              tipo="primario"
              carregando={salvandoModelo}
              aoTocar={() => void aoSalvarModelo()}
            />
          </>
        }
      >
        {modeloEditando ? (
          <View style={estilos.blocos}>
            <Texto variante="suave">Texto sugerido para cadastrar na Meta: {modeloEditando.textoSugerido}</Texto>
            <Texto variante="pequeno" cor={cores.textoSuave}>
              Ordem das variáveis: {modeloEditando.variaveis.map((v, i) => `{{${i + 1}}} ${v}`).join(' · ')}
            </Texto>
            <Campo
              rotulo="Nome do modelo na Meta"
              valor={nomeModelo}
              aoMudar={setNomeModelo}
              erro={errosModelo.nome ?? null}
              placeholder="Ex.: lembrete_cobranca_antes"
              autoCapitalize="none"
            />
            <Campo
              rotulo="Idioma"
              valor={idiomaModelo}
              aoMudar={setIdiomaModelo}
              erro={errosModelo.idioma ?? null}
              placeholder="pt_BR"
              autoCapitalize="none"
            />
          </View>
        ) : null}
      </Folha>

      <PainelConfirmacao
        visivel={confirmarDesconectar}
        titulo="Desconectar o WhatsApp?"
        mensagem="A conexão com a Meta será removida e todos os avisos pendentes serão cancelados."
        rotuloConfirmar="Desconectar"
        perigo
        carregando={removendoConexao}
        aoConfirmar={() => void aoDesconectar()}
        aoCancelar={() => setConfirmarDesconectar(false)}
      />

      <PainelConfirmacao
        visivel={!!modeloParaRemover}
        titulo="Remover este modelo?"
        mensagem="Sem modelo configurado, nenhum aviso deste tipo será enviado pelo WhatsApp."
        rotuloConfirmar="Remover"
        perigo
        carregando={removendoModelo}
        aoConfirmar={() => void aoRemoverModelo()}
        aoCancelar={() => setModeloParaRemover(null)}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(3) },
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start' },
  conexao: { width: LARGURA_FORMULARIO, flexShrink: 0 },
  modelos: { flex: 1, minWidth: 0 },
  item: { flexGrow: 1, borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1) },
  cabecalhoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  encolher: { flex: 1, minWidth: 0 },
});
