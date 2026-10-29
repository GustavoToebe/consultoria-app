import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Sessao } from '../api/tipos';
import { duracaoDoTreino } from '../dominio/conclusaoDoTreino';
import { duracaoDaFaixa, duracaoFalada, textoDaDuracaoAoVivo, textoDoVolumeAoVivo, volumeDaSessao } from '../dominio/treinoAoVivo';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Texto } from '../ui/Texto';

interface Props {
  versaoId: string;
  sessao: Sessao;
  data: string;
  hoje: string;
  feitas: number;
  total: number;
  registroDe: (serieUid: string) => RegistroLocal | undefined;
}

/**
 * Faixa do treino ao vivo (Engajamento 0.3): duração, volume e séries feitas da sessão no dia, na lista do dia e no
 * topo de cada exercício. A duração conta desde a primeira série marcada neste aparelho (P9), só hoje e até concluir;
 * concluído, mostra a declarada. Só com "Concluir treino" ligado. O relógio mora aqui para só esta linha redesenhar a cada
 * segundo, não a tela inteira.
 */
export function FaixaDoTreino({ versaoId, sessao, data, hoje, feitas, total, registroDe }: Props) {
  const { retornoHabilitado } = useSessao();
  const { inicioDoTreino, sessaoConcluidaDe } = useAluno();
  const { cores } = useTema();
  const inicio = inicioDoTreino(versaoId, sessao.uid, data);
  const conclusao = sessaoConcluidaDe(versaoId, sessao.uid, data);
  const contando = retornoHabilitado && !!inicio && !conclusao?.concluida && data === hoje;
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!contando) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [contando]);

  if (!retornoHabilitado) return null;
  const duracao = duracaoDaFaixa({
    concluida: conclusao?.concluida ? conclusao : null,
    data,
    hoje,
    contada: duracaoDoTreino(inicio, new Date(agora)),
  });
  const volume = textoDoVolumeAoVivo(volumeDaSessao(sessao, registroDe));
  const itens = [
    { rotulo: 'Duração', valor: textoDaDuracaoAoVivo(duracao.segundos), falado: `Duração do treino: ${duracaoFalada(duracao.segundos)}` },
    { rotulo: 'Volume', valor: volume, falado: `Volume: ${volume === '—' ? 'sem carga registrada' : volume}` },
    { rotulo: 'Séries', valor: `${feitas}/${total}`, falado: `${feitas} de ${total} séries feitas` },
  ];
  return (
    <View style={estilos.faixa} accessibilityRole="summary">
      {itens.map((i) => (
        // O relógio não é região viva: o leitor de tela lê o valor quando o foco chega, sem anunciar cada segundo.
        <View key={i.rotulo} style={estilos.item} accessible accessibilityLabel={i.falado}>
          <Texto variante="pequeno">{i.rotulo}</Texto>
          <Texto numerico style={[estilos.valor, { color: cores.texto }]}>{i.valor}</Texto>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { flexDirection: 'row', gap: espaco(1), justifyContent: 'space-between' },
  item: { flex: 1, minWidth: 0, gap: espaco(0.25) },
  valor: { fontFamily: fontes.semi, fontSize: 18 },
});
