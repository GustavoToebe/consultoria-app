import { router, type Href } from 'expo-router';
import { FileDown, PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { LARGURA_EDITOR, espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cabecalho } from '../ui/Cabecalho';
import { Cartao } from '../ui/Cartao';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { GUIAS, type Publico } from './conteudo';
import { TutorialGuiado } from './TutorialGuiado';

/** Ajuda de cada área: primeiros passos, tutorial guiado, guia em PDF (web), seções de uso e perguntas frequentes. */
export function TelaAjuda({ publico }: { publico: Publico }) {
  const guia = GUIAS[publico];
  const [tutorial, setTutorial] = useState(false);
  return (
    <Tela bordas={['top']} largura={publico === 'aluno' ? 720 : LARGURA_EDITOR}>
      <Cabecalho titulo="Ajuda" mostrarMarca={publico === 'aluno' ? 'sempre' : 'celular'} />
      <Texto variante="suave">{guia.introducao}</Texto>
      <Cartao
        titulo="Tutorial guiado"
        descricao="Um passeio rápido pelas telas, na ordem em que você vai usá-las."
        acoes={<Botao rotulo="Iniciar tutorial" Icone={PlayCircle} aoTocar={() => setTutorial(true)} />}>
        <Texto variante="pequeno">{guia.tutorial.length} passos. Dá para sair e voltar quando quiser.</Texto>
      </Cartao>
      <Cartao titulo="Primeiros passos">
        {guia.primeirosPassos.map((p, i) => (
          <View key={p.titulo} style={estilos.passo}>
            <Texto numerico variante="bloco">{i + 1}. {p.titulo}</Texto>
            <Texto variante="suave">{p.texto}</Texto>
            {p.rota ? (
              <View style={estilos.acao}>
                <Botao rotulo="Abrir" tipo="secundario" aoTocar={() => router.navigate(p.rota as Href)} />
              </View>
            ) : null}
          </View>
        ))}
      </Cartao>
      {Platform.OS === 'web' ? (
        <Cartao titulo="Guia do usuário em PDF" descricao="Para ler com calma, imprimir ou enviar.">
          <View style={estilos.acao}>
            <Botao rotulo={`Abrir ${guia.titulo.toLowerCase()}`} tipo="secundario" Icone={FileDown} aoTocar={() => void Linking.openURL(`/guias/${guia.arquivoPdf}`)} />
          </View>
        </Cartao>
      ) : null}
      {guia.secoes.map((s) => (
        <Cartao key={s.titulo} titulo={s.titulo} recolhivel recolhido>
          {s.itens.map((item) => (
            <View key={item.titulo} style={estilos.item}>
              <Texto variante="rotulo">{item.titulo}</Texto>
              <Texto>{item.texto}</Texto>
            </View>
          ))}
        </Cartao>
      ))}
      <Cartao titulo="Perguntas frequentes" recolhivel recolhido>
        {guia.perguntas.map((p) => (
          <View key={p.pergunta} style={estilos.item}>
            <Texto variante="rotulo">{p.pergunta}</Texto>
            <Texto>{p.resposta}</Texto>
          </View>
        ))}
      </Cartao>
      {tutorial ? <TutorialGuiado passos={guia.tutorial} aoFechar={() => setTutorial(false)} /> : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  passo: { gap: espaco(0.5) },
  item: { gap: espaco(0.25) },
  acao: { flexDirection: 'row' },
});
