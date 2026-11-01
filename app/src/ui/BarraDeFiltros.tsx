import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { Cartao } from './Cartao';
import { Folha } from './Folha';
import { depoisDeFecharAsFolhas } from './historicoDasFolhas';
import { sobre } from './sobre';
import { Texto } from './Texto';

export interface ChipDaBarra {
  chave: string;
  /** "Acesso: Sem acesso". */
  texto: string;
}

interface Props<T> {
  /** Campo de busca (sempre à vista). Sem ele, a barra é só o botão "Filtros" (lista sem busca útil na API). */
  busca?: { valor: string; aoMudar: (texto: string) => void; rotulo?: string; placeholder?: string };
  /** Os filtros em vigor. */
  valor: T;
  /** Grava os filtros escolhidos (ex.: no endereço). No celular só quando a folha fecha (ver abaixo). */
  aoAplicar: (filtros: T) => void;
  /** Os filtros de "nada filtrado": o "Limpar filtros". */
  limpo: T;
  /** Um chip por filtro ligado (fora a busca); o número do botão "Filtros" é quantos são. */
  chips: readonly ChipDaBarra[];
  /** ✕ do chip: tira só aquele filtro. */
  aoTirar: (chave: string) => void;
  /** Os seletores do painel "Filtros avançados" (`SelecaoMultiplaSuspensa` para várias opções, `Escolha` para uma). */
  seletores: (filtros: T, aoMudar: (filtros: T) => void) => ReactNode;
  /** Título do painel no PC; padrão "Filtros avançados". No celular a folha se chama "Filtros". */
  tituloDoPainel?: string;
  /** Texto do botão que fecha a folha no celular ("Ver alunos"). */
  rotuloDoResultado?: string;
}

/** Texto do botão "Filtros" para o leitor de tela: diz quantos estão ligados. */
export function rotuloDoBotaoDeFiltros(quantos: number): string {
  if (quantos === 0) return 'Filtros, nenhum ligado';
  return `Filtros, ${quantos} ${quantos === 1 ? 'ligado' : 'ligados'}`;
}

/**
 * Barra de filtros das listas (padrão da Central: busca + botão de filtros que abre os filtros avançados). Linha de
 * cima: o campo de busca, o botão "Filtros" com o número de filtros ligados e "Limpar filtros" quando há algum. No PC
 * (janela ≥ 768) o botão abre e fecha um cartão "Filtros avançados" logo abaixo, com os seletores em grade; no celular
 * abre uma `Folha` "Filtros". Embaixo, "Filtrado por" com um chip por filtro, cada um com o ✕ que o tira. Serve a todas
 * as listas do treinador (`docs/planos/filtros-nas-listas.md`): quem usa decide os seletores e o que cada chip significa.
 *
 * No PC cada escolha vale na hora (a de um seletor que abre a própria Folha, como `EscolhaEmFolha`, quando ela fecha, pelo
 * mesmo motivo do celular). Na folha do celular as escolhas ficam num rascunho e só são gravadas quando ela fecha
 * (X, tocar fora ou "Ver resultado"), depois do histórico assentar (`depoisDeFecharAsFolhas`): gravar no endereço com a
 * Folha aberta cairia na entrada de histórico dela e o fechar desfaria a escolha.
 */
export function BarraDeFiltros<T>({ busca, valor, aoAplicar, limpo, chips, aoTirar, seletores, tituloDoPainel = 'Filtros avançados', rotuloDoResultado = 'Ver resultado' }: Props<T>) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const [aberto, setAberto] = useState(false);
  // Na folha: o que foi escolhido e ainda não foi gravado.
  const [rascunho, setRascunho] = useState<{ filtros: T } | null>(null);
  const emFolha = width < LARGURA_MENU_LATERAL;
  const quantos = chips.length;
  const Seta = aberto ? ChevronUp : ChevronDown;
  const alternar = () => {
    if (emFolha) {
      setRascunho({ filtros: valor });
      setAberto(true);
    } else {
      setAberto((v) => !v);
    }
  };
  const fecharFolha = () => {
    const escolhido = rascunho;
    setAberto(false);
    setRascunho(null);
    if (escolhido) depoisDeFecharAsFolhas(() => aoAplicar(escolhido.filtros));
  };

  return (
    <View style={estilos.raiz}>
      <View style={estilos.linha}>
        {busca ? (
          <View style={estilos.busca}>
            <Campo rotulo={busca.rotulo ?? 'Buscar'} valor={busca.valor} aoMudar={busca.aoMudar} placeholder={busca.placeholder} autoCapitalize="none" />
          </View>
        ) : null}
        <View style={estilos.botoes}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rotuloDoBotaoDeFiltros(quantos)}
            accessibilityState={{ expanded: aberto }}
            aria-expanded={aberto}
            onPress={alternar}
            style={(e) => [estilos.filtros, { borderColor: cores.borda, backgroundColor: sobre(e) || aberto ? cores.superficie3 : 'transparent' }]}>
            <SlidersHorizontal size={18} color={cores.texto} strokeWidth={2} />
            <Texto style={estilos.rotuloFiltros} cor={cores.texto}>Filtros</Texto>
            {quantos > 0 ? (
              <View style={[estilos.contagem, { backgroundColor: cores.texto }]}>
                <Texto variante="pequeno" numerico cor={cores.fundo} style={estilos.numero}>{String(quantos)}</Texto>
              </View>
            ) : null}
            {emFolha ? null : <Seta size={18} color={cores.textoSuave} strokeWidth={2} />}
          </Pressable>
          {quantos > 0 ? <Botao rotulo="Limpar filtros" tipo="fantasma" Icone={X} aoTocar={() => aoAplicar(limpo)} /> : null}
        </View>
      </View>
      {aberto && !emFolha ? (
        <Cartao titulo={tituloDoPainel}>
          {/* Seletor que abre a própria Folha (`EscolhaEmFolha`) escolhe com ela aberta: grava depois que ela fecha. */}
          <View style={estilos.grade}>{seletores(valor, (filtros) => depoisDeFecharAsFolhas(() => aoAplicar(filtros)))}</View>
        </Cartao>
      ) : null}
      {aberto && emFolha && rascunho ? (
        <Folha visivel titulo="Filtros" aoFechar={fecharFolha}
          rodape={<Botao rotulo={rotuloDoResultado} cheio aoTocar={fecharFolha} />}>
          <View style={estilos.pilha}>{seletores(rascunho.filtros, (filtros) => setRascunho({ filtros }))}</View>
          <Botao rotulo="Limpar filtros" tipo="fantasma" Icone={X} aoTocar={() => setRascunho({ filtros: limpo })} />
        </Folha>
      ) : null}
      {quantos > 0 ? (
        <View style={estilos.filtrado} accessibilityRole="list" accessibilityLabel="Filtrado por">
          <Texto variante="suave">Filtrado por</Texto>
          {chips.map((c) => (
            <Pressable
              key={c.chave}
              accessibilityRole="button"
              accessibilityLabel={`Tirar filtro: ${c.texto}`}
              onPress={() => aoTirar(c.chave)}
              style={(e) => [estilos.chip, { borderColor: cores.bordaCampo, backgroundColor: sobre(e) ? cores.superficie3 : cores.superficie2 }]}>
              <Texto variante="pequeno" cor={cores.texto} style={estilos.textoDoChip}>{c.texto}</Texto>
              <X size={14} color={cores.texto} strokeWidth={2.5} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(1.5), rowGap: espaco(1) },
  busca: { flexGrow: 1, flexShrink: 1, flexBasis: 240, maxWidth: 480 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  filtros: {
    minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5),
    borderWidth: 1, borderRadius: RAIO,
  },
  rotuloFiltros: { fontFamily: fontes.semi },
  contagem: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  numero: { fontFamily: fontes.semi },
  // Seletores em grade no PC: cada um com pelo menos 260 px, quebrando linha.
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(2), alignItems: 'flex-start' },
  // Na folha a mesma linha que quebra: cada seletor (com base de 280 px, a da célula) ocupa a largura toda. Em coluna, a
  // base viraria altura.
  pilha: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(2), alignItems: 'flex-start' },
  filtrado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  chip: {
    minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingHorizontal: espaco(1.25),
    borderWidth: 1, borderRadius: RAIO, maxWidth: '100%',
  },
  textoDoChip: { flexShrink: 1 },
});
