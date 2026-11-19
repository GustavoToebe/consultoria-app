import { StyleSheet, View } from 'react-native';

import type { PeriodoDoPlano } from '../../api/financeiroTipos';
import {
  AJUDA_DA_ASSINATURA, AJUDA_DO_PRODUTO, AVISO_PERDE_KIWIFY, planoPodeTerKiwify, PRODUTO_MAXIMO, ROTULO_DA_ASSINATURA, ROTULO_DO_PRODUTO,
} from '../../dominio/kiwify';
import { espaco } from '../../tema/tokens';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { Texto } from '../../ui/Texto';

/**
 * "Assinatura cobrada pela Kiwify" no formulário do plano comercial (D17): só no plano mensal; ligado, pede o ID do produto
 * na Kiwify. Quem monta confere a chave da plataforma (`kiwifyHabilitada`) e guarda o estado; aqui só os campos e os erros
 * (o da tela e o do servidor, que nunca repetem o valor). `perde`: o plano gravado era Kiwify e a periodicidade escolhida
 * não deixa; a tela avisa antes de salvar.
 */
export function KiwifyNoPlano({ periodicidade, ligado, aoMudarLigado, produto, aoMudarProduto, erroDoProduto, erroDaAssinatura, perde }: {
  periodicidade: PeriodoDoPlano;
  ligado: boolean;
  aoMudarLigado: (v: boolean) => void;
  produto: string;
  aoMudarProduto: (t: string) => void;
  erroDoProduto: string | null;
  erroDaAssinatura: string | null;
  perde: boolean;
}) {
  if (!planoPodeTerKiwify(periodicidade)) return perde ? <Texto variante="pequeno">{AVISO_PERDE_KIWIFY}</Texto> : null;
  return (
    <View style={estilos.grupo}>
      <Interruptor rotulo={ROTULO_DA_ASSINATURA} valor={ligado} aoMudar={aoMudarLigado} ajuda={AJUDA_DA_ASSINATURA} />
      {erroDaAssinatura ? <MensagemDeErro erro={erroDaAssinatura} /> : null}
      {ligado ? (
        <Campo rotulo={ROTULO_DO_PRODUTO} valor={produto} aoMudar={aoMudarProduto} erro={erroDoProduto} ajuda={AJUDA_DO_PRODUTO}
          maxLength={PRODUTO_MAXIMO} autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1.5) },
});
