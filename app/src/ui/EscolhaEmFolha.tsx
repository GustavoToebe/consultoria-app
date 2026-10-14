import { Check, ChevronDown } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { semAcento } from '../dominio/telas';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Campo } from './Campo';
import { Esqueleto } from './Esqueleto';
import { Folha } from './Folha';
import { sobre } from './sobre';
import { Texto } from './Texto';

export interface OpcaoDaFolha<T> {
  valor: T;
  rotulo: string;
  /** Linha pequena abaixo do rótulo. */
  detalhe?: string;
}

interface Props<T> {
  rotulo: string;
  valor: T;
  opcoes: readonly OpcaoDaFolha<T>[];
  aoMudar: (valor: T) => void;
  /** Título da folha; padrão o rótulo. */
  titulo?: string;
  /** Texto do botão quando o valor não está nas opções (ex.: "Todas"). */
  rotuloDoValor?: string;
  /**
   * Busca no topo da folha. Sem `busca`, filtra as opções aqui (sem acento) quando há mais de oito; com `busca`
   * (valor e aoMudar) quem chama filtra, por exemplo pela API.
   */
  busca?: { valor: string; aoMudar: (texto: string) => void; rotulo?: string };
  /** Conteúdo depois da lista (paginação, erro, "Organizar..."). */
  rodape?: ReactNode;
  textoVazio?: string;
  /** Mostra o esqueleto no lugar de "nenhuma opção" enquanto as opções chegam. */
  carregando?: boolean;
  desabilitado?: boolean;
  /** Estilo do botão (ex.: `alignSelf: 'flex-end'` quando fica ao lado de um campo com rótulo). */
  style?: StyleProp<ViewStyle>;
}

/** A partir de quantas opções a lista ganha busca própria. */
export const OPCOES_PARA_BUSCAR = 8;

/**
 * Escolha com muitas opções (pessoa da equipe, grupo muscular, aluno): um botão "Rótulo: valor" que abre uma folha
 * com busca e uma lista de rádio com alvo de 44 px. Substitui faixas de chips com quatro ou cinco linhas. Até oito
 * opções, sem busca, use `Escolha`.
 */
export function EscolhaEmFolha<T extends string | number | null>({
  rotulo, valor, opcoes, aoMudar, titulo, rotuloDoValor, busca, rodape, textoVazio = 'Nenhuma opção encontrada.', carregando, desabilitado, style,
}: Props<T>) {
  const { cores } = useTema();
  const [aberta, setAberta] = useState(false);
  const [filtro, setFiltro] = useState('');
  const escolhida = opcoes.find((o) => o.valor === valor);
  const textoDoValor = escolhida?.rotulo ?? rotuloDoValor ?? '—';
  const comBuscaLocal = !busca && opcoes.length > OPCOES_PARA_BUSCAR;
  const termo = semAcento(filtro.trim());
  const visiveis = comBuscaLocal && termo ? opcoes.filter((o) => semAcento(`${o.rotulo} ${o.detalhe ?? ''}`).includes(termo)) : opcoes;
  const fechar = () => {
    setAberta(false);
    setFiltro('');
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${textoDoValor}. Escolher.`}
        accessibilityState={{ disabled: !!desabilitado, expanded: aberta }}
        disabled={desabilitado}
        onPress={() => setAberta(true)}
        style={(estado) => [estilos.botao, { borderColor: cores.borda, backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent', opacity: desabilitado ? 0.5 : 1 }, style]}>
        <Texto style={estilos.textoBotao} numberOfLines={1}>
          <Texto variante="suave" style={estilos.textoBotao}>{rotulo}: </Texto>
          {textoDoValor}
        </Texto>
        <ChevronDown size={18} color={cores.textoSuave} strokeWidth={2} />
      </Pressable>
      {aberta ? (
        <Folha visivel titulo={titulo ?? rotulo} aoFechar={fechar}>
          {busca ? <Campo rotulo={busca.rotulo ?? 'Buscar'} valor={busca.valor} aoMudar={busca.aoMudar} autoCorrect={false} /> : null}
          {comBuscaLocal ? <Campo rotulo="Buscar" valor={filtro} aoMudar={setFiltro} autoCorrect={false} /> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={estilos.lista}>
            {visiveis.length === 0 ? (carregando ? <Esqueleto texto="Carregando opções" cartoes={2} /> : <Texto variante="suave">{textoVazio}</Texto>) : null}
            {visiveis.map((o) => {
              const ativa = o.valor === valor;
              return (
                <Pressable
                  key={String(o.valor)}
                  accessibilityRole="radio"
                  accessibilityLabel={o.detalhe ? `${o.rotulo}, ${o.detalhe}` : o.rotulo}
                  accessibilityState={{ checked: ativa }}
                  aria-checked={ativa}
                  onPress={() => {
                    aoMudar(o.valor);
                    fechar();
                  }}
                  style={(estado) => [estilos.opcao, { borderColor: ativa ? cores.texto : cores.borda, backgroundColor: ativa ? cores.texto : sobre(estado) ? cores.superficie3 : cores.superficie2 }]}>
                  <View style={estilos.textosOpcao}>
                    <Texto style={[estilos.rotuloOpcao, { color: ativa ? cores.fundo : cores.texto }]}>{o.rotulo}</Texto>
                    {o.detalhe ? <Texto variante="pequeno" cor={ativa ? cores.fundo : undefined}>{o.detalhe}</Texto> : null}
                  </View>
                  {ativa ? <Check size={18} color={cores.fundo} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>
          {rodape}
        </Folha>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  botao: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: ALVO_TOQUE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    paddingHorizontal: espaco(2),
    borderWidth: 1,
    borderRadius: RAIO,
  },
  textoBotao: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1 },
  lista: { gap: espaco(0.75) },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderWidth: 1, borderRadius: RAIO },
  textosOpcao: { flex: 1, gap: 1 },
  rotuloOpcao: { fontFamily: fontes.semi },
});
