import { Plus, X } from 'lucide-react-native';
import { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  adicionarLembrete, DIGITOS_DA_ANTECEDENCIA, LEMBRETES_MAXIMO, type LinhaDeLembrete, motivoSemAdicionar, mudarLembrete, removerLembrete,
  rotuloDaUnidade, UNIDADES, type UnidadeDaAntecedencia,
} from '../../dominio/antecedenciaDoLembrete';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';

interface Props {
  lembretes: readonly LinhaDeLembrete[];
  /** Erro de cada linha pelo `id` (a conferência da tela ou o 422 `lembretesMinutos[i]`). */
  erros: Readonly<Record<string, string>>;
  /** Erro da lista inteira (o 422 `lembretesMinutos`). */
  erroDaLista?: string;
  aoMudar: (lembretes: LinhaDeLembrete[]) => void;
}

/**
 * "Notificações" do compromisso, como no Google Agenda (D4 de `docs/planos/lembretes-do-compromisso.md`): cada linha é o
 * número, a unidade (minutos, horas ou dias, na mesma lista suspensa do Início e do Fim) e o X para remover; até cinco e
 * nenhuma vale (= sem lembrete). A ordem é a digitada. O erro fica sob a linha, sem repetir o valor; toda regra vem de
 * `dominio/antecedenciaDoLembrete`.
 */
export function ListaDeNotificacoes({ lembretes, erros, erroDaLista, aoMudar }: Props) {
  const motivo = motivoSemAdicionar(lembretes);
  // O X tocado some com a linha: na web o foco iria para a página; vai para "Adicionar notificação" (sempre habilitado depois).
  const adicionarRef = useRef<View>(null);
  const remover = (id: string) => {
    aoMudar(removerLembrete(lembretes, id));
    if (Platform.OS === 'web') setTimeout(() => (adicionarRef.current as unknown as HTMLElement | null)?.focus?.(), 0);
  };
  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo" numerico>{`Notificações · ${lembretes.length} de ${LEMBRETES_MAXIMO}`}</Texto>
      <Texto variante="pequeno">No app do celular, antes do início, para os alunos e o responsável.</Texto>
      {lembretes.length ? lembretes.map((l, i) => {
        const nome = `Notificação ${i + 1}`;
        const erro = erros[l.id];
        const opcoes = UNIDADES.map((u: UnidadeDaAntecedencia) => ({ valor: u, rotulo: rotuloDaUnidade(u, l.valor) }));
        return (
          // Grupo com o nome da linha: o leitor de tela diz de qual notificação são o número, a unidade e o X.
          <View key={l.id} role="group" aria-label={nome} style={estilos.linha}>
            <View style={estilos.campos}>
              <View style={estilos.numero}>
                <Campo rotulo={nome} rotuloOculto rotuloAcessivel={`${nome}: quantidade`} valor={l.valor} erro={erro} erroSemTexto
                  aoMudar={(t) => aoMudar(mudarLembrete(lembretes, l.id, { valor: t }))}
                  keyboardType="number-pad" inputMode="numeric" maxLength={DIGITOS_DA_ANTECEDENCIA} numerico />
              </View>
              <EscolhaEmFolha<UnidadeDaAntecedencia> rotulo="Unidade" titulo={`Unidade da ${nome.toLowerCase()}`} valor={l.unidade}
                opcoes={opcoes} aoMudar={(unidade) => aoMudar(mudarLembrete(lembretes, l.id, { unidade }))} />
              <IconeBotao moldura Icone={X} rotulo={`Remover a ${nome.toLowerCase()}`} aoTocar={() => remover(l.id)} />
            </View>
            {erro ? <MensagemDeErro erro={erro} /> : null}
          </View>
        );
      }) : <Texto variante="suave">Sem notificação: ninguém recebe lembrete deste compromisso.</Texto>}
      {erroDaLista ? <MensagemDeErro erro={erroDaLista} /> : null}
      <Botao ref={adicionarRef} rotulo="Adicionar notificação" tipo="secundario" Icone={Plus} aoTocar={() => aoMudar(adicionarLembrete(lembretes))}
        desabilitado={!!motivo} motivo={motivo ?? undefined} />
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1), alignItems: 'flex-start' },
  linha: { gap: espaco(0.5), alignSelf: 'stretch' },
  // Número, unidade e o X numa linha (cabe em 390 px); se a letra estiver grande, quebra sem estourar a folha.
  campos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  numero: { width: 88 },
});
