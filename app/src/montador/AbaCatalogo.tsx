import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { agruparPorSecao, filtrarExemplos, resumoDaBusca, resumoDoGrupo, tituloDoExemplo } from '../dominio/catalogoDeComponentes';
import type { TemaDoMontador } from '../dominio/montador';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Vazio } from '../ui/Estados';
import { Grade } from '../ui/Grade';
import { Texto } from '../ui/Texto';
import { EXEMPLOS_DO_CATALOGO, type ExemploComDesenho } from './catalogoDeComponentes';

/** Largura máxima do conteúdo: abaixo dos 1240 px em que a `Grade` passa a 3 colunas, então no PC são sempre 2. */
const LARGURA_DO_CATALOGO = 1200;

const OPCOES_DE_TEMA: { valor: TemaDoMontador; rotulo: string }[] = [
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'areia', rotulo: 'Areia' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

/**
 * Aba "Catálogo" do Montador: cada componente de `ui/` nos estados dele, funcionando, com dados fictícios. Busca sem
 * acento no nome, no estado e no caminho; seções na ordem de `SECOES_DO_CATALOGO`; um cartão por exemplo com o caminho
 * e as props no rodapé. O tema é o mesmo do Montador (vale para a tela inteira).
 */
export function AbaCatalogo({ tema, aoMudarTema }: { tema: TemaDoMontador; aoMudarTema: (tema: TemaDoMontador) => void }) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const filtrados = useMemo(() => filtrarExemplos(EXEMPLOS_DO_CATALOGO, busca), [busca]);
  const grupos = useMemo(() => agruparPorSecao(filtrados), [filtrados]);

  return (
    <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <View style={estilos.miolo}>
        <View style={estilos.ferramentas}>
          <View style={estilos.busca}>
            <Campo
              rotulo="Pesquisar componente"
              valor={busca}
              aoMudar={setBusca}
              placeholder="Ex.: Campo, Selo, erro"
              autoCapitalize="none"
              autoCorrect={false}
              acao={<Search size={18} color={cores.textoSuave} aria-hidden />}
            />
          </View>
          <View style={estilos.tema}>
            <Escolha<TemaDoMontador> rotulo="Tema" descricao="Tema do catálogo" valor={tema} aoMudar={aoMudarTema} opcoes={OPCOES_DE_TEMA} />
          </View>
        </View>

        <Texto variante="suave" numerico accessibilityLiveRegion="polite">
          {resumoDaBusca(filtrados.length, EXEMPLOS_DO_CATALOGO.length)}
        </Texto>
        {/* O foco não ganha exemplo desenhado: é o anel de verdade de cada peça, visto pelo teclado. */}
        <Texto variante="pequeno">Os exemplos funcionam: use Tab para ver o foco de cada um (normal, com erro e selecionado já estão nos cartões).</Texto>

        {grupos.length === 0 ? (
          <Vazio
            Icone={Search}
            titulo="Nenhum componente encontrado"
            texto="Confira a grafia ou procure pelo nome do componente, como Campo ou Botao."
            acao={{ rotulo: 'Limpar busca', aoTocar: () => setBusca('') }}
          />
        ) : (
          grupos.map((grupo) => (
            <View key={grupo.secao} style={estilos.secao}>
              <View role="heading" aria-level={2}>
                <CabecalhoDeGrupo titulo={grupo.titulo} resumo={resumoDoGrupo(grupo.exemplos.length)} />
              </View>
              <Grade gap={espaco(2)}>
                {grupo.exemplos.map((exemplo) => (
                  <CartaoDoExemplo key={exemplo.id} exemplo={exemplo} />
                ))}
              </Grade>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function CartaoDoExemplo({ exemplo }: { exemplo: ExemploComDesenho }) {
  const { cores } = useTema();
  const { Desenho } = exemplo;
  return (
    <Cartao
      titulo={tituloDoExemplo(exemplo)}
      nivel={3}
      style={estilos.cartao}
      rodape={
        <View style={[estilos.legenda, { borderTopColor: cores.borda }]}>
          <Texto variante="pequeno" cor={cores.texto} style={estilos.caminho}>
            {exemplo.caminho}
          </Texto>
          <Texto variante="pequeno">{exemplo.props}</Texto>
        </View>
      }>
      <View testID={`exemplo-${exemplo.id}`} style={estilos.palco}>
        <Desenho />
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  rolagem: { flex: 1 },
  conteudo: { padding: espaco(2), paddingBottom: espaco(6) },
  miolo: { width: '100%', maxWidth: LARGURA_DO_CATALOGO, alignSelf: 'center', gap: espaco(2) },
  ferramentas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(2) },
  busca: { flexGrow: 1, flexBasis: 280, minWidth: 0 },
  tema: { flexShrink: 0 },
  secao: { gap: espaco(2), marginTop: espaco(1) },
  cartao: { flexGrow: 1 },
  palco: { gap: espaco(1.5) },
  legenda: { borderTopWidth: 1, paddingTop: espaco(1), gap: 2 },
  caminho: { fontFamily: fontes.semi },
});
