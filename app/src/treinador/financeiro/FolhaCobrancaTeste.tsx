import { CheckCircle2, Circle, Copy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  consultarCobrancaTesteOvertrainingPay,
  type CobrancaTesteResponse,
} from '../../api/financeiroOvertrainingPay';
import { centavosParaTela } from '../../dominio/formatos';
import { checklistCobrancaTeste } from '../../dominio/overtrainingPay';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO_CONTROLE } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Alerta } from '../../ui/Estados';
import { Folha, LARGURA_FOLHA } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { copiarTexto } from './comum';

const INTERVALO_POLLING_MS = 4_000;

interface Props {
  visivel: boolean;
  cobranca: CobrancaTesteResponse | null;
  aoFechar: () => void;
  aoHomologar: () => void;
}

/**
 * Folha da cobrança teste de homologação do Overtraining Pay (Prancha 3).
 * Exibe o QR Code Pix de R$ 5,00, botão de copiar Pix copia e cola, checklist de 4 etapas
 * e polling leve a cada 4s enquanto aberta até atingir `PAGA` ou `HOMOLOGADA`.
 */
export function FolhaCobrancaTeste({ visivel, cobranca, aoFechar, aoHomologar }: Props) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [atualizada, setAtualizada] = useState<CobrancaTesteResponse | null>(null);
  const [copiarAMao, setCopiarAMao] = useState(false);

  const atual = cobranca
    ? (atualizada && atualizada.cobrancaTesteId === cobranca.cobrancaTesteId ? atualizada : cobranca)
    : null;
  const cobrancaId = atual?.cobrancaTesteId ?? null;
  const situacao = atual?.situacao ?? null;
  const concluida = situacao === 'PAGA' || situacao === 'HOMOLOGADA';

  useEffect(() => {
    if (!visivel || !cobrancaId || concluida) return undefined;
    let ativo = true;
    const consultar = () => {
      consultarCobrancaTesteOvertrainingPay(cobrancaId).then(
        (res) => {
          if (!ativo) return;
          setAtualizada(res);
          if (res.situacao === 'HOMOLOGADA' || res.situacao === 'PAGA') {
            avisar('Pagamento de teste confirmado! Conta homologada.', 'sucesso');
            aoHomologar();
          }
        },
        () => undefined,
      );
    };
    const timer = setInterval(consultar, INTERVALO_POLLING_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [visivel, cobrancaId, concluida, aoHomologar, avisar]);

  const copiarCodigo = () => {
    if (!atual?.pixCopiaECola) return;
    setCopiarAMao(false);
    void copiarTexto(atual.pixCopiaECola).then((ok) => {
      if (ok) avisar('Código Pix copia e cola copiado.', 'sucesso');
      else {
        setCopiarAMao(true);
        avisar('Não foi possível copiar automaticamente. Selecione o código e copie à mão.', 'neutro');
      }
    });
  };

  const itens = checklistCobrancaTeste(situacao);
  const seloSituacao = situacao === 'HOMOLOGADA'
    ? { texto: 'Conta homologada', tipo: 'sucesso' as const }
    : situacao === 'PAGA'
      ? { texto: 'Pagamento confirmado', tipo: 'sucesso' as const }
      : { texto: 'Aguardando pagamento', tipo: 'atencao' as const };

  return (
    <Folha
      visivel={visivel && !!atual}
      titulo="Cobrança de teste (homologação)"
      aoFechar={aoFechar}
      largura={LARGURA_FOLHA}
      alturaDoConteudo
      rodape={<Botao rotulo={concluida ? 'Concluir' : 'Fechar'} tipo={concluida ? 'primario' : 'secundario'} aoTocar={aoFechar} />}
    >
      {atual ? (
        <View style={estilos.corpo}>
          <View style={estilos.cabecalhoValor}>
            <View style={estilos.valorBloco}>
              <Texto variante="suave">Valor simbólico da validação</Texto>
              <Texto variante="titulo" numerico>{centavosParaTela(atual.valorCentavos)}</Texto>
            </View>
            <Selo texto={seloSituacao.texto} tipo={seloSituacao.tipo} />
          </View>

          <Texto variante="suave">
            Pague este Pix no app do seu banco para confirmar que a sua conta de repasse e os avisos automáticos estão funcionando.
          </Texto>

          {atual.qrCodeBase64 ? (
            <View style={[estilos.caixaQr, { backgroundColor: '#FFFFFF', borderColor: cores.divisor }]}>
              <Image
                source={{ uri: `data:image/png;base64,${atual.qrCodeBase64}` }}
                style={estilos.imagemQr}
                resizeMode="contain"
                accessibilityLabel="QR Code Pix da cobrança de teste de R$ 5,00"
              />
            </View>
          ) : (
            <Alerta tom="atencao" texto="O QR Code em imagem não veio nesta tentativa. Use o código Pix copia e cola abaixo." />
          )}

          {atual.pixCopiaECola ? (
            <View style={[estilos.blocoCodigo, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
              <Texto variante="rotulo">Pix copia e cola</Texto>
              <Texto selectable numerico variante="pequeno" numberOfLines={3}>{atual.pixCopiaECola}</Texto>
              {copiarAMao ? <Texto variante="pequeno">Selecione o código acima e copie manualmente.</Texto> : null}
              <LinhaDeAcoes>
                <Botao rotulo="Copiar código Pix copia e cola" tipo="secundario" Icone={Copy} aoTocar={copiarCodigo} />
              </LinhaDeAcoes>
            </View>
          ) : null}

          <View style={[estilos.checklist, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
            <Texto variante="secao">Acompanhamento da validação</Texto>
            {itens.map((item) => (
              <View key={item.id} style={estilos.itemChecklist}>
                {item.concluido ? (
                  <CheckCircle2 size={18} color={cores.sucesso} />
                ) : (
                  <Circle size={18} color={cores.textoSuave} />
                )}
                <Texto cor={item.concluido ? cores.texto : cores.textoSuave}>{item.rotulo}</Texto>
              </View>
            ))}
          </View>

          {concluida ? (
            <Alerta tom="sucesso" texto="Homologação concluída! Você já pode ligar o Overtraining Pay nas formas de recebimento." />
          ) : (
            <Texto variante="pequeno">Atualizamos a situação automaticamente a cada 4 segundos enquanto esta janela estiver aberta.</Texto>
          )}
        </View>
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  cabecalhoValor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1) },
  valorBloco: { gap: 2 },
  caixaQr: { alignSelf: 'center', padding: espaco(1.5), borderRadius: RAIO_CONTROLE, borderWidth: 1 },
  imagemQr: { width: 200, height: 200 },
  blocoCodigo: { padding: espaco(1.5), borderRadius: RAIO_CONTROLE, borderWidth: 1, gap: espaco(1) },
  checklist: { padding: espaco(1.5), borderRadius: RAIO_CONTROLE, borderWidth: 1, gap: espaco(1) },
  itemChecklist: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
});
