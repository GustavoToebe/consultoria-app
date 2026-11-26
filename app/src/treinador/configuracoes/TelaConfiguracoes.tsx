import { Redirect, type Href } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { buscarCartoes, destinoNaColuna, gruposDeCartoes, primeiroItemDentro } from '../../dominio/configuracoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Vazio } from '../../ui/Estados';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Tela } from '../../ui/Tela';
import { BuscaDasConfiguracoes } from './BuscaDasConfiguracoes';
import { nadaEncontrado, useCartoesDoPerfil, useDuasColunas } from './comum';
import { iconeDaConfiguracao } from './icones';

/**
 * `/treinador/configuracoes` (`docs/planos/configuracoes-centralizadas.md`). A partir de 1024 px de janela a lista mora na
 * coluna da esquerda do layout e este endereço abre o primeiro item (Meus dados), sem empilhar histórico. Abaixo disso é a
 * lista: busca no topo e um cartão por grupo com linhas simples (ícone, título, descrição e seta), que abrem a rota inteira
 * de cada tela, como antes. Tudo vem da sessão: sem carregando nem erro, e abre sem internet.
 */
export function TelaConfiguracoes() {
  const duas = useDuasColunas();
  const visiveis = useCartoesDoPerfil();
  const primeiro = primeiroItemDentro(visiveis);
  if (duas && primeiro) return <Redirect href={destinoNaColuna(primeiro) as Href} />;
  return <ListaDasConfiguracoes visiveis={visiveis} />;
}

function ListaDasConfiguracoes({ visiveis }: { visiveis: ReturnType<typeof useCartoesDoPerfil> }) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const campo = useRef<TextInput>(null);
  const achados = buscarCartoes(busca, visiveis);
  const grupos = gruposDeCartoes(achados);
  return (
    <Tela largura={LARGURA_EDITOR} bordas={['top']}>
      <Cabecalho titulo="Configurações" descricao="Sua conta, a consultoria, a equipe e o atendimento, num lugar só." />
      <BuscaDasConfiguracoes valor={busca} aoMudar={setBusca} achados={achados.length} campo={campo} />
      {grupos.length === 0 ? (
        <Vazio Icone={SearchX} titulo={nadaEncontrado(busca)} nivel={2}
          texto="Tente outra palavra ou um sinônimo, como “senha”, “logo” ou “cobrança”."
          acao={{ rotulo: 'Limpar busca', aoTocar: () => { setBusca(''); campo.current?.focus(); } }} />
      ) : (
        <View style={estilos.grupos}>
          {grupos.map(({ grupo, cartoes }) => (
            <Cartao key={grupo} titulo={grupo}>
              <ListaDeLinhas divisorias>
                {cartoes.map((c) => {
                  const Icone = iconeDaConfiguracao(c.id);
                  return (
                    <LinhaDaLista key={c.id} href={c.href as Href} titulo={c.titulo} descricao={c.descricao} rotulo={`${c.titulo}, ${c.descricao}`}
                      inicio={<View aria-hidden><Icone size={20} color={cores.textoSuave} strokeWidth={2} /></View>} />
                  );
                })}
              </ListaDeLinhas>
            </Cartao>
          ))}
        </View>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  grupos: { gap: espaco(3) },
});
