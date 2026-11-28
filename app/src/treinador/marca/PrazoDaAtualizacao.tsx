import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { hojeEmBrasilia } from '../../dominio/financeiro';
import { ATALHOS_DOS_DIAS, exemploDoPrazo } from '../../dominio/padroesDoAcompanhamento';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { MensagemDeErro } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Texto } from '../../ui/Texto';

/** Caixa do número: três dígitos em fonte mono, centrados. */
const LARGURA_DA_CAIXA = 96;

/**
 * Prazo da nova atualização (Padrões do acompanhamento, 28/11): a frase "Nova atualização a cada [14] dias" com a caixa no
 * meio, os atalhos 7 · 14 · 21 · 28 · 30 e o exemplo ao vivo do período com o "hoje" de Brasília. O atalho só PREENCHE o
 * campo (regra 17): é botão comum, sem estado de escolhido; o valor vive na caixa. O nome do campo continua "Nova
 * atualização a cada (dias)". O erro fica embaixo da frase, não espremido nos 96 px da caixa. Um atalho recria a caixa
 * (`chave`, que apaga o que não era número, "1a") e a caixa nova nasce focada.
 */
export function PrazoDaAtualizacao({ dias, aoMudar, aoValidade, legivel, erro }: {
  dias: number | null;
  aoMudar: (dias: number | null) => void;
  aoValidade: (valido: boolean) => void;
  /** `false` enquanto a caixa tem algo que não é número inteiro. */
  legivel: boolean;
  erro: string | null;
}) {
  const [chave, setChave] = useState(0);
  const exemplo = legivel ? exemploDoPrazo(hojeEmBrasilia(), dias) : null;
  const escolher = (n: number) => {
    aoMudar(n);
    aoValidade(true);
    setChave((c) => c + 1);
  };
  return (
    <View style={estilos.bloco}>
      <View style={estilos.frase}>
        <Texto variante="rotulo">Nova atualização a cada</Texto>
        <View style={estilos.caixa}>
          <CampoNumerico key={chave} autoFocus={chave > 0} rotulo="Nova atualização a cada (dias)" rotuloOculto inteiro mono centralizado valor={dias}
            aoMudar={aoMudar} aoValidade={aoValidade} erro={legivel ? erro : null} erroSemTexto />
        </View>
        <Texto variante="rotulo">dias</Texto>
      </View>
      {/* O texto que não é número vem antes: o erro da faixa seria do último número lido ("400"), não do que está na caixa. */}
      {!legivel ? <MensagemDeErro erro="Use só números inteiros." /> : erro ? <MensagemDeErro erro={erro} /> : null}
      <View role="group" accessibilityLabel="Atalhos do prazo" style={estilos.atalhos}>
        {ATALHOS_DOS_DIAS.map((n) => (
          <Botao key={n} tipo="secundario" tamanho="pequeno" rotulo={String(n)} rotuloAcessivel={`${n} dias`} style={estilos.atalho}
            aoTocar={() => escolher(n)} />
        ))}
      </View>
      {exemplo ? <Texto variante="suave" numerico accessibilityLiveRegion="polite">{exemplo}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  frase: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  caixa: { width: LARGURA_DA_CAIXA },
  // O alvo de 44 do `Botao pequeno` já separa os desenhos de 32; o vão só afasta os alvos.
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5) },
  // "7" sozinho daria um alvo mais estreito que 44.
  atalho: { minWidth: ALVO_TOQUE },
});
