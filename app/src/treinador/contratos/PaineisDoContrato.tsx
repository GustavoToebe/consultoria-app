import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { cancelarContrato, LIMITES_DO_CONTRATO, prorrogarContrato, type ContratoResumo, type LinkDoResponsavel } from '../../api/contratos';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { linkDoContrato, linkDoWhatsAppDoContrato } from '../../dominio/contratoPublico';
import { dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Alerta } from '../../ui/Estados';
import { codigoApi, erroDeConexao, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { iconeWhatsApp } from '../../ui/IconeWhatsApp';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

const SEM_INTERNET = 'Confira a internet e tente de novo.';
/** Recusas em que o contrato mudou no servidor: a mensagem da API e a lista de novo. */
const RECARREGAM = new Set(['CONFLITO_EDICAO', 'CONTRATO_SEM_PRAZO', 'CONTRATO_NAO_PENDENTE', 'CONTRATO_ASSINADO']);

/**
 * Cancelar um contrato pendente (ficha › Contratos › ⋯). O motivo é obrigatório (até 300) e só a equipe o vê. Contrato que o
 * aluno assinou antes do cancelamento (409 `CONTRATO_ASSINADO`) não se cancela: o painel fecha, avisa e a lista recarrega.
 */
export function PainelCancelarContrato({ contrato, aoFechar, aoMudar }: { contrato: ContratoResumo; aoFechar: () => void; aoMudar: () => void }) {
  const { avisar } = useAviso();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = () => {
    if (!motivo.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    cancelarContrato(contrato.id, { motivo: motivo.trim(), versao: contrato.versao }).then(
      () => { setEnviando(false); aoFechar(); aoMudar(); avisar('Contrato cancelado.', 'sucesso'); },
      (e: unknown) => {
        setEnviando(false);
        const codigo = codigoApi(e) ?? '';
        if (RECARREGAM.has(codigo)) {
          aoFechar();
          aoMudar();
          avisar(codigo === 'CONTRATO_ASSINADO' ? 'O aluno assinou antes do cancelamento. Contrato assinado não se cancela.' : textoDoErro(e), 'atencao');
          return;
        }
        setErro(erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e));
      },
    );
  };
  return (
    <PainelConfirmacao visivel perigo titulo="Cancelar este contrato?"
      mensagem="O aluno deixa de ver o contrato e não pode mais assiná-lo. Para valer de novo, gere outro contrato."
      rotuloConfirmar="Cancelar contrato" rotuloCancelar="Voltar" carregando={enviando}
      desabilitado={!motivo.trim()} motivo="Escreva o motivo." aoConfirmar={confirmar} aoCancelar={aoFechar}>
      <View style={estilos.corpo}>
        {erro ? <Alerta tom="perigo" texto={erro} /> : null}
        <Campo rotulo="Motivo (só a equipe vê)" valor={motivo} aoMudar={setMotivo} linhas={3} maxLength={LIMITES_DO_CONTRATO.motivoDoCancelamento} />
        <Texto variante="pequeno" numerico style={estilos.contador}>{`${motivo.length} de ${LIMITES_DO_CONTRATO.motivoDoCancelamento}`}</Texto>
      </View>
    </PainelConfirmacao>
  );
}

const DIAS = [7, 15, 30] as const;

/** Prorrogar o prazo de um contrato pendente com prazo (T3: 7, 15 ou 30 dias). */
export function PainelProrrogarContrato({ contrato, aoFechar, aoMudar }: { contrato: ContratoResumo; aoFechar: () => void; aoMudar: () => void }) {
  const { avisar } = useAviso();
  const [dias, setDias] = useState<number>(7);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = () => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    prorrogarContrato(contrato.id, { dias, versao: contrato.versao }).then(
      (r) => {
        setEnviando(false);
        aoFechar();
        aoMudar();
        avisar(r.prazoAte ? `Prazo prorrogado até ${dataParaTela(dataEmBrasilia(r.prazoAte))}.` : 'Prazo prorrogado.', 'sucesso');
      },
      (e: unknown) => {
        setEnviando(false);
        if (RECARREGAM.has(codigoApi(e) ?? '')) { aoFechar(); aoMudar(); avisar(textoDoErro(e), 'atencao'); return; }
        setErro(erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e));
      },
    );
  };
  return (
    <PainelConfirmacao visivel titulo="Prorrogar o prazo?" mensagem="O aluno ganha mais dias para assinar."
      rotuloConfirmar="Prorrogar" rotuloCancelar="Voltar" carregando={enviando} aoConfirmar={confirmar} aoCancelar={aoFechar}>
      <View style={estilos.corpo}>
        {erro ? <Alerta tom="perigo" texto={erro} /> : null}
        <Escolha rotulo="Mais quantos dias" valor={dias} aoMudar={setDias} opcoes={DIAS.map((d) => ({ valor: d, rotulo: `${d} dias` }))} />
      </View>
    </PainelConfirmacao>
  );
}

/** Na web o link usa a origem da própria página (local, homologação ou produção); no celular, a de produção. */
const origemDoLink = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined);

/**
 * O link do responsável, mostrado UMA vez: logo depois de gerar (201) ou de "Gerar novo link do responsável". O código só
 * existe no estado desta folha (fechou, sumiu; nada no aparelho nem em log). "Copiar link" e "Enviar pelo WhatsApp" (`wa.me`
 * com o texto fixo, fora do app, sem token nosso; sem telefone, a pessoa escolhe o contato). Sem código (o reenvio do mesmo
 * pedido devolve só a validade), a folha diz que o contrato foi gerado e oferece um link novo.
 */
export function FolhaLinkDoResponsavel({ link, aoFechar, aoGerarNovo }: {
  link: Pick<LinkDoResponsavel, 'codigo' | 'expiraEm'>;
  aoFechar: () => void;
  /** Só sem código: gera outro (o anterior deixa de valer). */
  aoGerarNovo?: () => void;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const url = link.codigo ? linkDoContrato(link.codigo, origemDoLink()) : null;
  const validade = `Válido até ${dataParaTela(dataEmBrasilia(link.expiraEm))}.`;
  const copiar = () => {
    if (!url) return;
    Clipboard.setStringAsync(url).then(
      () => avisar('Link copiado.', 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };
  const whatsapp = () => {
    if (url) Linking.openURL(linkDoWhatsAppDoContrato(url)).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'));
  };
  return (
    <Folha visivel titulo="Link do responsável" aoFechar={aoFechar} rodape={<Botao rotulo="Concluir" aoTocar={aoFechar} />}>
      <View style={estilos.corpo}>
        {url ? (
          <>
            <Texto>Envie este link ao responsável. Ele confere o CPF, lê o contrato e assina, sem conta no app.</Texto>
            <View style={[estilos.link, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
              <Texto variante="pequeno">Link</Texto>
              <Texto selectable style={estilos.url}>{url}</Texto>
              <Texto variante="pequeno">{validade}</Texto>
            </View>
            <View style={estilos.acoesDoLink}>
              <Botao rotulo="Copiar link" tipo="secundario" Icone={Copy} aoTocar={copiar} />
              <Botao rotulo="Enviar pelo WhatsApp" rotuloAcessivel="Enviar pelo WhatsApp: abrir WhatsApp com o link" tipo="acao" Icone={iconeWhatsApp(true)} aoTocar={whatsapp} />
            </View>
            <Alerta tom="atencao" texto="Este link aparece só agora. Para outro, use “Gerar novo link” na ficha." />
          </>
        ) : (
          <>
            <Texto>O contrato foi gerado. O link do responsável aparece só uma vez e não está mais disponível aqui. Para enviar, gere um novo: o anterior deixa de valer.</Texto>
            {aoGerarNovo ? <Botao rotulo="Gerar novo link do responsável" tipo="secundario" style={estilos.inicio} aoTocar={aoGerarNovo} /> : null}
          </>
        )}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(1.5) },
  link: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  url: { fontSize: 14 },
  acoesDoLink: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  inicio: { alignSelf: 'flex-start' },
  contador: { alignSelf: 'flex-end' },
});
