import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { categoriaDoDigitado, SEM_CATEGORIA } from '../dominio/seletorDeCategoria';
import { espaco } from '../tema/tokens';
import { MensagemDeErro } from '../ui/Campo';
import { EscolhaSuspensa } from '../ui/EscolhaSuspensa';
import { Texto } from '../ui/Texto';

/** Chaves da lista: "Sem categoria", uma por categoria (pela posição) e a nova (com o nome). Nunca colidem com o valor de quem usa. */
const SEM = 's';
const OPCAO = 'o:';
const NOVA = 'n:';

/**
 * Campo "Categoria" de um item (Vitrine e Biblioteca › Outros): escolha única com busca (sem acento e sem caixa),
 * "Sem categoria" primeiro, as categorias e "Criar categoria “texto”" quando o texto não é uma que já existe. Só a
 * aparência e a interação: o que criar faz (API, ids, limites e mensagens) é de quem usa, por `aoCriar`, `criando` e `erro`.
 * Avisos e ações próprias da tela entram como `children`, logo abaixo, no mesmo grupo.
 */
export function SeletorDeCategoria<T extends string | null>({ valor, semCategoria, categorias, maximo, aoEscolher, aoCriar, criando, erro, ajuda, children }: {
  valor: T;
  /** O valor de "Sem categoria" para quem usa (`null` na Vitrine, `''` em Outros). */
  semCategoria: T;
  /** Inclui a do valor atual, para o campo fechado mostrar o nome dela. */
  categorias: readonly { valor: T; nome: string }[];
  /** Limite de caracteres do texto digitado (o nome da categoria nova). */
  maximo: number;
  aoEscolher: (valor: T) => void;
  /** Recebe o nome limpo da categoria nova (nunca igual, sem acento nem caixa, a uma que já existe). */
  aoCriar: (nome: string) => void;
  /** Criação em andamento: "Criando a categoria…" logo abaixo, anunciado ao leitor de tela. */
  criando?: boolean;
  erro?: string | null;
  /** Texto de apoio sob o campo; some enquanto há erro. */
  ajuda?: string;
  children?: ReactNode;
}) {
  const indice = categorias.findIndex((c) => c.valor === valor);
  const chave = valor === semCategoria ? SEM : indice >= 0 ? `${OPCAO}${indice}` : '';
  return (
    <View style={estilos.campo}>
      <EscolhaSuspensa<string> rotulo="Categoria" titulo="Categoria do item" valor={chave}
        rotuloDaBusca="Buscar ou criar categoria" textoVazio="Nenhuma categoria encontrada."
        opcoes={[{ valor: SEM, rotulo: SEM_CATEGORIA }, ...categorias.map((c, i) => ({ valor: `${OPCAO}${i}`, rotulo: c.nome }))]}
        digitado={{
          maxLength: maximo,
          opcao: (t) => {
            const d = categoriaDoDigitado(t, categorias);
            if (!d) return null;
            if ('nova' in d) return { valor: `${NOVA}${d.nova}`, rotulo: `Criar categoria “${d.nova}”`, detalhe: 'Categoria nova' };
            return { valor: `${OPCAO}${categorias.indexOf(d.existente)}`, rotulo: d.existente.nome };
          },
        }}
        aoMudar={(k) => {
          if (k === SEM) aoEscolher(semCategoria);
          else if (k.startsWith(NOVA)) aoCriar(k.slice(NOVA.length));
          else {
            const c = categorias[Number(k.slice(OPCAO.length))];
            if (c) aoEscolher(c.valor);
          }
        }} />
      {criando ? <Texto variante="pequeno" accessibilityLiveRegion="polite">Criando a categoria…</Texto> : null}
      {erro ? <MensagemDeErro erro={erro} /> : ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
});
