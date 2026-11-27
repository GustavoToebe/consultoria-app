import { Flag } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { MudancaDaAtualizacao } from '../../dominio/mudancasDaAtualizacao';
import { textoDosPontos, type PontoDeAtencao } from '../../dominio/pontosDeAtencao';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CamadaDaSerie } from '../../ui/CamadaDaSerie';
import { LARGURA_DA_FAIXA_DA_SERIE } from '../../ui/pinturaDaSerie';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * "Pontos de atenção" da revisão (`docs/planos/regras-de-atencao.md`, R4 e o último item do plano-front): o grupo no topo do
 * "O que mudou", com os fatos que bateram nas regras do treinador no envio. Superfície pintada de `atencao` (âmbar: o
 * treinador olha e decide; sem verde nem vermelho, o app não opina), borda neutra, barrinha à esquerda e a bandeira na
 * cor; rótulos e legendas neutros, então texto e ícone dizem o mesmo sem a cor. Cada linha: o rótulo da pergunta, o valor
 * (ou "anterior → atual" quando o histórico já chegou e a linha existe) e uma legenda "Sua regra: …" por fato. A conta da
 * cabeça é de fatos (a mesma do selo da lista), não de linhas: dois fatos da mesma pergunta dividem a linha.
 */
export function PontosDeAtencao({ pontos }: { pontos: readonly PontoDeAtencao[] }) {
  const { cores, variante, bordas } = useTema();
  const rotulo = useRotuloDaLinha();
  const titulo = textoDosPontos(pontos.reduce((n, p) => n + p.legendas.length, 0));
  if (!titulo) return null;
  const pintura = superficiePintada(cores.atencao, cores.superficie, variante, cores);
  return (
    <View testID="pontos-de-atencao" style={[estilos.grupo, fundoPintado(pintura)]}>
      <View style={estilos.cabeca}>
        <Flag size={16} color={cores.atencao} strokeWidth={2.25} aria-hidden />
        <Texto variante="rotulo" nivel={3} cor={cores.texto}>{titulo}</Texto>
      </View>
      <View role="list" aria-label="Pontos de atenção" style={estilos.lista}>
        {pontos.map((p) => (
          <View key={p.id} role="listitem" style={estilos.item}>
            <View style={estilos.linha}>
              <Texto variante="pequeno" style={rotulo}>{p.rotulo}</Texto>
              {p.mudanca ? <AnteriorParaAtual mudanca={p.mudanca} />
                // Peso sem pergunta (e fato sem pergunta): só a legenda; nas outras, valor ausente é "—".
                : p.valor !== null ? <Texto cor={cores.texto} numerico>{p.valor}</Texto>
                  : p.chave !== null ? <Texto cor={cores.texto}>—</Texto> : null}
            </View>
            {p.legendas.map((l, i) => <Texto key={`${i}:${l}`} variante="pequeno">{l}</Texto>)}
          </View>
        ))}
      </View>
      <CamadaDaSerie pintura={{ pintada: null, faixa: cores.atencao, borda: cores.divisor, larguraDaBorda: bordas.bloco }} ativa={false} raio={0} semBorda />
    </View>
  );
}

/** "82,0 kg → 80,0 kg", com a seta suave; o leitor de tela ouve "para" no lugar da seta. A mesma do "O que mudou". */
export function AnteriorParaAtual({ mudanca: m }: { mudanca: MudancaDaAtualizacao }) {
  const { cores } = useTema();
  // Sem anterior (pergunta de itens que a atualização anterior não tinha): só o fato de agora, sem seta.
  if (m.anterior === null) return <Texto cor={cores.texto}>{m.atual}</Texto>;
  return (
    <Texto cor={cores.texto} numerico>
      {m.anterior}
      <Texto variante="suave" aria-hidden>{'  →  '}</Texto>
      <Texto style={estilos.soParaLeitor}>{' para '}</Texto>
      {m.atual}
    </Texto>
  );
}

/** Recuo do texto: o respiro da caixa mais a barrinha; o "O que mudou" abaixo usa o mesmo, para as bordas se alinharem. */
export const RECUO_DOS_PONTOS = espaco(1.5) + LARGURA_DA_FAIXA_DA_SERIE;
/**
 * Coluna do rótulo nas duas listas, pela faixa da área (4.10, não a janela). Da faixa normal para cima, larga o bastante para os valores se alinharem nos rótulos comuns ("Dias com treino
 * registrado"); na compacta (celular, tablet), a de antes (140), para "82,0 kg → 80,0 kg" caber ao lado. O rótulo mais longo quebra a linha.
 */
export function useRotuloDaLinha() {
  return { minWidth: useFaixaDaTela() === 'compacta' ? 140 : 180, flexShrink: 1 } as const;
}

const estilos = StyleSheet.create({
  grupo: { padding: espaco(1.5), paddingLeft: RECUO_DOS_PONTOS, gap: espaco(1) },
  cabeca: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  lista: { gap: espaco(1.5) },
  item: { gap: espaco(0.25) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1.5), rowGap: espaco(0.25) },
  // Só o leitor de tela ouve "para" no lugar da seta.
  soParaLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
