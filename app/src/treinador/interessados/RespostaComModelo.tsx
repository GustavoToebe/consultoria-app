import * as Clipboard from 'expo-clipboard';
import { Copy, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { AcaoDaMensagem, InscricaoDetalhe, ModeloDeMensagem } from '../../api/inscricoesTipos';
import { mensagemPreparada, modelosDeMensagem } from '../../api/rotas';
import {
  linkDoWhatsAppComTexto,
  mensagemComVariaveis,
  primeiroNome,
  VARIAVEIS_DA_MENSAGEM,
  variaveisQueFaltam,
} from '../../dominio/inscricoes';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * "Responder com modelo": escolhe uma resposta pronta, troca as variáveis (primeiro nome, consultoria, plano da
 * proposta) e deixa a prévia editável. O app só prepara: Copiar ou Abrir WhatsApp, e quem envia é a pessoa. Fica
 * registrado "mensagem preparada" (nunca "enviada"), sem o texto. Variável sem valor trava as duas ações.
 */
export function RespostaComModelo({ visivel, dados, consultoria, aoFechar, aoRegistrar }: {
  visivel: boolean;
  dados: InscricaoDetalhe;
  consultoria: string | null;
  aoFechar: () => void;
  /** Registrou a mensagem preparada: o histórico recarrega. */
  aoRegistrar: () => void;
}) {
  const { avisar } = useAviso();
  const modelos = useCarregar(visivel ? 'inscricoes:modelos-de-mensagem' : null, () => modelosDeMensagem());
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [registrando, setRegistrando] = useState<AcaoDaMensagem | null>(null);
  const valores = { primeiroNome: primeiroNome(dados.nome), consultoria, plano: dados.proposta.planoNome };

  const escolher = (id: string | null, lista: readonly ModeloDeMensagem[]) => {
    setModeloId(id);
    const modelo = lista.find((m) => m.id === id);
    setTexto(modelo ? mensagemComVariaveis(modelo.texto, valores).texto : '');
  };

  const faltando = variaveisQueFaltam(texto);
  const vazio = !texto.trim();
  const motivo = vazio ? 'Escolha um modelo ou escreva a mensagem.' : faltando.length ? `Preencha: ${faltando.join(', ')}` : undefined;
  const link = linkDoWhatsAppComTexto(dados.whatsapp, texto);

  const registrar = (acao: AcaoDaMensagem, sucesso: string) => {
    setRegistrando(acao);
    mensagemPreparada(dados.id, modeloId, acao).then(() => {
      setRegistrando(null);
      avisar(sucesso, 'sucesso');
      aoRegistrar();
    }, () => {
      setRegistrando(null);
      avisar('A mensagem foi preparada, mas não deu para registrar no histórico. Anote numa nota.', 'perigo');
    });
  };

  const copiar = () => {
    Clipboard.setStringAsync(texto).then(
      () => registrar('COPIADA', 'Mensagem copiada. Registre o envio numa nota quando mandar.'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  const abrir = () => {
    if (!link) return;
    Linking.openURL(link).then(
      () => registrar('WHATSAPP_ABERTO', 'WhatsApp aberto com a mensagem. Registre o envio numa nota quando mandar.'),
      () => avisar('Não foi possível abrir o WhatsApp neste aparelho.', 'perigo'),
    );
  };

  const fechar = () => {
    setModeloId(null);
    setTexto('');
    aoFechar();
  };

  const lista = modelos.dados ?? [];
  const opcoes = lista.map((m) => ({ valor: m.id as string | null, rotulo: m.nome }));
  const bloqueado = !!motivo;
  const rodape = (
    <>
      <Botao rotulo="Copiar" Icone={Copy} tipo="secundario" aoTocar={copiar} desabilitado={bloqueado || !!registrando}
        carregando={registrando === 'COPIADA'} motivo={motivo} />
      <Botao rotulo="Abrir WhatsApp" Icone={MessageCircle} aoTocar={abrir} desabilitado={bloqueado || !link || !!registrando}
        carregando={registrando === 'WHATSAPP_ABERTO'} motivo={motivo ?? 'O número não tem DDD válido.'} />
    </>
  );
  return (
    <Folha visivel={visivel} titulo="Responder com modelo" aoFechar={fechar} rodape={rodape}>
      <View style={estilos.corpo}>
        {modelos.erro ? <MensagemErro texto={textoDoErro(modelos.erro)} erro={modelos.erro} tentarDeNovo={modelos.recarregar} /> : null}
        {!modelos.dados && !modelos.erro ? <Esqueleto /> : null}
        {modelos.dados && lista.length === 0 ? (
          <Texto variante="suave">Nenhuma resposta pronta. Crie em Respostas prontas, no topo da tela, ou escreva abaixo.</Texto>
        ) : null}
        {lista.length > 0 && lista.length <= OPCOES_PARA_BUSCAR ? (
          <Escolha rotulo="Modelo" opcoes={opcoes} valor={modeloId} aoMudar={(v) => escolher(v, lista)} />
        ) : null}
        {lista.length > OPCOES_PARA_BUSCAR ? (
          <EscolhaEmFolha rotulo="Modelo" opcoes={opcoes} valor={modeloId} aoMudar={(v) => escolher(v, lista)} rotuloDoValor="Escolher" />
        ) : null}
        <Campo rotulo="Mensagem" valor={texto} aoMudar={setTexto} linhas={6} maxLength={1000}
          erro={faltando.length ? `Preencha: ${faltando.join(', ')}` : null} />
        <Texto variante="pequeno">
          Variáveis: {VARIAVEIS_DA_MENSAGEM.map((v) => `${v.chave} (${v.descricao})`).join(', ')}. O app não envia nada: você
          copia ou abre o WhatsApp e manda.
        </Texto>
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(1.5) },
});
