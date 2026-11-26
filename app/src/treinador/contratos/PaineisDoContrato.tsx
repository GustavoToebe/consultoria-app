import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { cancelarContrato, LIMITES_DO_CONTRATO, prorrogarContrato, type ContratoResumo } from '../../api/contratos';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Alerta } from '../../ui/Estados';
import { codigoApi, erroDeConexao, textoDoErro } from '../../ui/erros';
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

const estilos = StyleSheet.create({
  corpo: { gap: espaco(1.5) },
  contador: { alignSelf: 'flex-end' },
});
