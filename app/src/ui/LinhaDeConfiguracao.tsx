import { createContext, isValidElement, useContext, useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Cartao } from './Cartao';
import { Texto } from './Texto';
import { useFaixaDeLargura } from './useFaixaDeLargura';

/** Abaixo disto (largura medida da lista), o segmento desce para baixo do nome, alinhado à esquerda (390 px). */
const LARGURA_LADO_A_LADO = 400;

const Empilhada = createContext(false);

/**
 * Seção de configuração (Aparência e preferências, 25/11): um `Cartao` com o título da seção e uma linha por opção, com o
 * fio `divisor` entre as linhas (não depois da última), no padrão da `ListaDeDados`. `linhas` aceita `null`/`false` (opção
 * que só existe num perfil ou plataforma): some da lista, e a seção sem nenhuma linha some inteira. Opção nova = mais um
 * item no array.
 */
export function SecaoDeConfiguracao({ titulo, linhas }: { titulo: string; linhas: readonly ReactNode[] }) {
  const { cores } = useTema();
  const { largura, aoMedir } = useFaixaDeLargura();
  const visiveis = linhas.filter((l) => l !== null && l !== undefined && l !== false);
  if (visiveis.length === 0) return null;
  return (
    <Cartao titulo={titulo}>
      <Empilhada.Provider value={largura > 0 && largura < LARGURA_LADO_A_LADO}>
        <View onLayout={aoMedir} style={estilos.lista}>
          {visiveis.map((linha, i) => (
            <View key={isValidElement(linha) && linha.key != null ? linha.key : i}
              style={i < visiveis.length - 1 ? { borderBottomWidth: 1, borderBottomColor: cores.divisor } : null}>
              {linha}
            </View>
          ))}
        </View>
      </Empilhada.Provider>
    </Cartao>
  );
}

interface Props {
  nome: string;
  descricao?: string;
  /**
   * `interruptor`: sempre à direita. `segmento` (padrão): à direita, e embaixo do nome quando a lista é estreita.
   * `grade` (temas, cores, tamanhos): sempre embaixo do nome, na largura toda.
   */
  forma?: 'interruptor' | 'segmento' | 'grade';
  /** O controle (já com o próprio nome acessível). */
  children: ReactNode;
}

/**
 * Linha de configuração: nome (uma vez só) e descrição curta à esquerda, controle à direita. Para o leitor de tela a linha é
 * um `group` com o nome e a descrição ligados (`aria-labelledby`, `aria-describedby`), porque `Escolha` e `Switch` não os
 * repassam; o controle mantém o nome dele.
 */
export function LinhaDeConfiguracao({ nome, descricao, forma = 'segmento', children }: Props) {
  const { cores } = useTema();
  const empilhada = useContext(Empilhada);
  const id = useId();
  const abaixo = forma === 'grade' || (forma === 'segmento' && empilhada);
  return (
    <View role="group" aria-labelledby={`${id}-nome`} aria-describedby={descricao ? `${id}-descricao` : undefined}
      style={[estilos.linha, abaixo ? estilos.abaixo : estilos.lado]}>
      <View style={abaixo ? estilos.textosAbaixo : estilos.textos}>
        <Texto nativeID={`${id}-nome`} cor={cores.texto} style={estilos.nome}>{nome}</Texto>
        {descricao ? <Texto nativeID={`${id}-descricao`} variante="pequeno">{descricao}</Texto> : null}
      </View>
      <View style={abaixo ? estilos.controleAbaixo : estilos.controle}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // O respiro da primeira e da última linha soma com o do cartão: a lista o devolve.
  lista: { marginVertical: -espaco(1) },
  // 48 de altura mínima, como a linha da `ListaDeDados`, com 12 em cima e embaixo (o controle tem alvo de 44).
  linha: { minHeight: 48, paddingVertical: espaco(1.5) },
  lado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(2), rowGap: espaco(1) },
  abaixo: { gap: espaco(1.5) },
  // Base de 160: se o controle não couber ao lado, desce (e fica à direita, como a ação da `ListaDeDados`).
  textos: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0, gap: 2 },
  textosAbaixo: { gap: 2 },
  nome: { fontFamily: fontes.medio },
  // Grade e prévia (Tamanho do texto, Cor de ação) com o mesmo respiro entre o nome e a grade.
  controleAbaixo: { gap: espaco(1.5) },
  controle: { marginLeft: 'auto', flexShrink: 0, maxWidth: '100%' },
});
