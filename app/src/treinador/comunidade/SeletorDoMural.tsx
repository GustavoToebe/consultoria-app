import { Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { PodResumo } from '../../api/comunidadeTipos';
import { ROTULO_DO_MURAL_GERAL } from '../../dominio/comunidade';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Escolha } from '../../ui/Escolha';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Texto } from '../../ui/Texto';

/** Até quantos grupos o seletor fica em chips; com mais, lista suspensa (D5, 19/11). */
const GRUPOS_EM_CHIPS = 4;
// Valor interno do Geral (`null` da API): não colide com um id de pod (UUID).
const GERAL = '__geral';

/**
 * Qual mural a equipe vê (D5, 19/11): Geral ou um grupo, com o rótulo "Mural" à vista (o mesmo nome no leitor de tela).
 * Até quatro grupos, chips (Geral + 4 = 5 opções, que sem `chips` virariam segmento, igual ao Avisos | Alunos ao lado);
 * com mais, lista suspensa. "Gerenciar grupos" vem sempre no fim, como botão (não é uma opção). Sem grupo nenhum, só ele.
 * `travado` ("Só denunciadas", que vêm de todos os grupos) troca a escolha pelo motivo.
 */
export function SeletorDoMural({ grupos, valor, aoMudar, travado, aoGerenciar }: {
  grupos: readonly PodResumo[];
  valor: string | null;
  aoMudar: (podId: string | null) => void;
  travado?: string;
  aoGerenciar: () => void;
}) {
  const { cores } = useTema();
  const opcoes = [{ valor: GERAL, rotulo: ROTULO_DO_MURAL_GERAL }, ...grupos.map((p) => ({ valor: p.id, rotulo: p.nome }))];
  const mudar = (v: string) => aoMudar(v === GERAL ? null : v);
  // O `Botao` traz `alignSelf: flex-start`; a caixa em volta é que desce até a base dos chips.
  const gerenciar = <View style={estilos.base}><Botao rotulo="Gerenciar grupos" tipo="fantasma" Icone={Users} aoTocar={aoGerenciar} /></View>;
  // Sem grupo, só o botão, descido a altura de um rótulo para a base alinhar com Publicações e a busca ao lado.
  if (!grupos.length) return <View style={[estilos.linha, estilos.semRotulo]}>{gerenciar}</View>;
  return (
    <View style={estilos.linha}>
      {travado ? (
        <View style={estilos.campo}>
          <Texto variante="rotulo" cor={cores.texto}>Mural</Texto>
          <Texto variante="suave" style={estilos.motivo}>{travado}</Texto>
        </View>
      ) : grupos.length <= GRUPOS_EM_CHIPS ? (
        <Escolha rotulo="Mural" chips valor={valor ?? GERAL} aoMudar={mudar} opcoes={opcoes} />
      ) : (
        <EscolhaSuspensa rotulo="Mural" titulo="Escolher o mural" valor={valor ?? GERAL} aoMudar={mudar} opcoes={opcoes}
          semBusca={opcoes.length <= OPCOES_PARA_BUSCAR} rotuloDaBusca="Buscar grupo" textoVazio="Nenhum grupo encontrado." style={estilos.suspensa} />
      )}
      {gerenciar}
    </View>
  );
}

const estilos = StyleSheet.create({
  // O botão alinha pela base com os chips (que têm o rótulo em cima) e desce para a linha de baixo quando não cabe.
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(1), rowGap: espaco(1), flexShrink: 1, maxWidth: '100%' },
  campo: { gap: espaco(0.5), flexShrink: 1 },
  // Mesma altura do controle (44) para a base alinhar com os vizinhos.
  motivo: { minHeight: 44, textAlignVertical: 'center', paddingTop: espaco(1.25) },
  suspensa: { minWidth: 220, maxWidth: 320 },
  base: { alignSelf: 'flex-end' },
  // A linha do rótulo (18) + o vão entre rótulo e controle (4), os mesmos do `Campo` e da `Escolha`.
  semRotulo: { paddingTop: 18 + espaco(0.5) },
});
