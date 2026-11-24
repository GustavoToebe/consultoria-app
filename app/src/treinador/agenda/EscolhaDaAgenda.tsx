import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AgendaPessoal } from '../../api/agendaTipos';
import { NOME_DA_AGENDA_PADRAO, ROTULOS_DAS_CORES_DA_AGENDA } from '../../dominio/agendaEvento';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { MensagemDeErro } from '../../ui/Campo';
import { Folha } from '../../ui/Folha';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { MarcadorDaAgenda } from './itemDaAgenda';

/**
 * "Agenda: ● Pessoal ▾" do evento (agenda: criar unificado, 23/11): o botão com cara de campo do `EscolhaEmFolha` (rótulo
 * à vista na frente do valor), com a bolinha da cor da agenda, que abre a lista numa folha (rádios com a bolinha e o nome).
 * Peça local porque a lista compartilhada não tem marca por opção. A cor nunca fala sozinha: o nome dela vai no nome
 * acessível ("Pessoal, azul"). Sem agenda nenhuma, mostra a "Pessoal" que nasce ao salvar, só leitura.
 */
export function EscolhaDaAgenda({ agendas, valor, aoMudar, erro }: {
  agendas: readonly AgendaPessoal[]; valor: string; aoMudar: (id: string) => void; erro?: string;
}) {
  const { cores } = useTema();
  const [aberta, setAberta] = useState(false);
  const escolhida = agendas.find((a) => a.id === valor);
  const nomeComCor = (a: AgendaPessoal) => `${a.nome}, ${ROTULOS_DAS_CORES_DA_AGENDA[a.cor].toLowerCase()}`;
  if (!agendas.length) {
    return (
      <View style={estilos.leitura} accessible accessibilityLabel={`Agenda: ${NOME_DA_AGENDA_PADRAO}, criada ao salvar`}>
        <Texto variante="suave">Agenda: </Texto>
        <Texto style={estilos.valor}>{`${NOME_DA_AGENDA_PADRAO} (criada ao salvar)`}</Texto>
      </View>
    );
  }
  return (
    <View style={estilos.grupo}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Agenda: ${escolhida ? nomeComCor(escolhida) : 'nenhuma'}. Escolher.`}
        accessibilityState={{ expanded: aberta }} aria-invalid={!!erro} onPress={() => setAberta(true)}
        style={(e) => [estilos.botao, { borderColor: erro ? cores.perigo : cores.bordaCampo, backgroundColor: sobre(e) ? cores.sobre : cores.campo }]}>
        <Texto variante="suave" style={estilos.valor}>Agenda: </Texto>
        {escolhida ? <MarcadorDaAgenda cor={escolhida.cor} /> : null}
        <Texto style={[estilos.valor, estilos.encolhe]} numberOfLines={1}>{escolhida?.nome ?? 'Escolher'}</Texto>
        <ChevronDown size={18} color={cores.textoSuave} strokeWidth={2} />
      </Pressable>
      {erro ? <MensagemDeErro erro={erro} /> : null}
      {aberta ? (
        <Folha visivel titulo="Escolher agenda" aoFechar={() => setAberta(false)}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Agenda" style={estilos.lista}>
            {agendas.map((a) => {
              const ativa = a.id === valor;
              return (
                <Pressable key={a.id} accessibilityRole="radio" accessibilityLabel={nomeComCor(a)} accessibilityState={{ checked: ativa }} aria-checked={ativa}
                  onPress={() => { aoMudar(a.id); setAberta(false); }}
                  style={(e) => [estilos.opcao, {
                    borderColor: ativa ? cores.bordaCampo : cores.divisor, backgroundColor: ativa ? cores.sobre : sobre(e) ? cores.superficie2 : cores.superficie,
                  }]}>
                  <MarcadorDaAgenda cor={a.cor} />
                  <Texto style={[estilos.valor, estilos.encolhe]}>{a.nome}</Texto>
                  {ativa ? <Check size={18} color={cores.texto} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Folha>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(0.5), alignItems: 'flex-start', maxWidth: '100%' },
  // Mesmo molde do botão do `EscolhaEmFolha` (alvo de 44, `bordaCampo`, `campo`).
  botao: {
    maxWidth: '100%', minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5),
    borderWidth: 1, borderRadius: RAIO_CONTROLE,
  },
  leitura: { flexDirection: 'row', alignItems: 'center', minHeight: ALVO_TOQUE, flexWrap: 'wrap' },
  valor: { fontFamily: fontes.semi, fontSize: 15 },
  encolhe: { flexShrink: 1 },
  lista: { gap: espaco(0.75) },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75),
    borderWidth: 1, borderRadius: RAIO_CONTROLE,
  },
});
