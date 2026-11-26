import { PlayCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoMobilidadeApi } from '../api/tipos';
import { itemParaTela } from '../dominio/mobilidade';
import { espaco, fontes, LARGURA_TEXTO_CORRIDO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';

type Secao = ConteudoMobilidadeApi['secoes'][number];
type Item = Secao['itens'][number];

/**
 * Uma seção da mobilidade como o aluno vê: o título, e cada item com nome, prescrição ("—" sem ela) e "Ver vídeo" quando o
 * link é do YouTube. Usada pela tela do aluno (`ConteudoDaMobilidade`, com o ✓ em `marcar`) e pela prévia ao vivo do editor
 * do treinador (`treinador/mobilidade/PreviaDaMobilidade`, sem `marcar`), para as duas nunca divergirem.
 */
export function CartaoDaSecaoDaMobilidade({ secao, aoVerVideo, marcar }: {
  secao: Secao;
  aoVerVideo: (url: string) => void;
  /** O ✓ de cada item (só na mobilidade vigente, com dia para marcar). */
  marcar?: (item: Item) => ReactNode;
}) {
  return (
    <Cartao cabecalho={<CabecalhoDeGrupo titulo={secao.titulo?.trim() || 'Mobilidade'} />}>
      {secao.itens.map((item) => {
        const i = itemParaTela(item);
        return (
          <View key={item.uid} style={estilos.linha}>
            <View style={estilos.item}>
              <Texto numerico style={estilos.nome}>{i.nome}</Texto>
              <Texto numerico variante="suave">{i.prescricao}</Texto>
              {i.video ? <Botao rotulo="Ver vídeo" tipo="secundario" Icone={PlayCircle} aoTocar={() => aoVerVideo(i.video!)} /> : null}
            </View>
            {marcar?.(item)}
          </View>
        );
      })}
    </Cartao>
  );
}

/** As orientações do treinador, antes das seções; sem texto, nada. */
export function CartaoDasOrientacoesDaMobilidade({ texto }: { texto: string | null }) {
  if (!texto?.trim()) return null;
  return (
    <Cartao titulo="Orientações">
      <Texto numerico style={estilos.corrido}>{texto}</Texto>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  item: { flex: 1, minWidth: 0, gap: 4 },
  nome: { fontFamily: fontes.semi },
  corrido: { maxWidth: LARGURA_TEXTO_CORRIDO },
});
