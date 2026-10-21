import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { baixarImagemDoExercicio, baixarImagemDoExercicioDoAluno } from '../api/rotas';
import { origemDoSite } from '../api/cliente';
import {
  caminhosValidosDoCatalogo,
  demonstracaoDe,
  deveAlternar,
  fotoDaVez,
  INTERVALO_ALTERNANCIA_MS,
  textoAlternativoDaDemonstracao,
  urlDaFotoDoCatalogo,
} from '../dominio/demonstracaoExercicio';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, RAIO } from '../tema/tokens';
import { Folha } from './Folha';
import { enderecoDaImagem } from './ImagemProtegida';
import { useCarregar } from './useCarregar';
import { useMovimentoReduzido } from './useMovimentoReduzido';

interface Props {
  /** Nulo = exercício fora da biblioteca: só vale o que veio em `imagens`. */
  exercicioId: string | null;
  nome: string;
  /** Fotos do catálogo (`<id>/0.jpg`). */
  imagens?: readonly string[] | null;
  /** Data do envio da imagem própria; nulo = não tem. Muda quando o treinador troca a imagem. */
  imagemPropriaEm?: string | null;
  /** De quem é a rota que baixa a imagem própria: a da equipe ou a do aluno (só exercício do plano dele). */
  papel: 'EQUIPE' | 'ALUNO';
  largura?: number;
  altura?: number;
  /** Toque abre a imagem maior numa folha, inteira (a folha nunca corta). */
  ampliavel?: boolean;
  /** A miniatura preenche a caixa e corta a sobra (`cover`); sem isso a imagem aparece inteira, com sobra nas bordas. */
  preencher?: boolean;
}

/**
 * Demonstração do exercício: a imagem ou GIF próprio do treinador, senão as fotos do catálogo (duas, que alternam a
 * cada 0,8 s; com movimento reduzido fica na primeira e o GIF não anima), senão nada (não reserva espaço). A imagem
 * própria só vem pela API, com o token, e nunca fica em cache; se não carregar (sem internet) cai nas fotos do
 * catálogo ou some, sem quebrar a tela. As fotos do catálogo são públicas, do próprio site, e usam o cache de disco.
 */
export function DemonstracaoDoExercicio({ exercicioId, nome, imagens, imagemPropriaEm, papel, largura = 96, altura, ampliavel, preencher }: Props) {
  const demo = demonstracaoDe({ imagens, imagemPropriaEm: exercicioId ? imagemPropriaEm : null });
  const [aberta, setAberta] = useState(false);
  const { width, height } = useWindowDimensions();
  if (!demo) return null;
  const descricao = textoAlternativoDaDemonstracao(nome);
  const catalogo = caminhosValidosDoCatalogo(imagens);
  const alturaDaCaixa = altura ?? largura;
  const miniatura = (
    <Conteudo demo={demo} catalogo={catalogo} exercicioId={exercicioId} descricao={descricao} papel={papel} largura={largura} altura={alturaDaCaixa} preencher={preencher} />
  );
  if (!ampliavel) return miniatura;
  // O lado cabe na janela (largura e altura, com o título da folha) e não passa de `LADO_AMPLIADO`.
  const lado = Math.max(200, Math.min(width - 48, height - 200, LADO_AMPLIADO));
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${descricao}. Tocar para ampliar`} onPress={() => setAberta(true)}
        style={{ minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE, maxWidth: '100%' }}>
        {miniatura}
      </Pressable>
      <Folha visivel={aberta} titulo={`Demonstração: ${nome}`} aoFechar={() => setAberta(false)} largura={LADO_AMPLIADO + 48}>
        <View style={{ alignItems: 'center' }}>
          <Conteudo demo={demo} catalogo={catalogo} exercicioId={exercicioId} descricao={descricao} papel={papel} largura={lado} altura={lado} />
        </View>
      </Folha>
    </>
  );
}

type Demo = NonNullable<ReturnType<typeof demonstracaoDe>>;

interface ConteudoProps {
  demo: Demo;
  /** Fotos do catálogo, para onde cai a imagem própria que não carregou. */
  catalogo: readonly string[];
  exercicioId: string | null;
  descricao: string;
  papel: 'EQUIPE' | 'ALUNO';
  largura: number;
  altura: number;
  preencher?: boolean;
}

function Conteudo({ demo, catalogo, exercicioId, descricao, papel, largura, altura, preencher }: ConteudoProps) {
  const { cores } = useTema();
  const caixa = [estilos.caixa, { width: largura, height: altura, maxWidth: '100%' as const, borderColor: cores.borda, backgroundColor: cores.superficie2 }];
  if (demo.tipo === 'PROPRIA' && exercicioId) {
    return <ImagemPropria exercicioId={exercicioId} versao={demo.versao} descricao={descricao} papel={papel} caixa={caixa} caminhos={catalogo} preencher={preencher} />;
  }
  return demo.tipo === 'CATALOGO' ? <FotosDoCatalogo caminhos={demo.caminhos} descricao={descricao} caixa={caixa} preencher={preencher} /> : null;
}

type Caixa = React.ComponentProps<typeof View>['style'];

function ImagemPropria({ exercicioId, versao, descricao, papel, caixa, caminhos, preencher }: {
  exercicioId: string; versao: string; descricao: string; papel: 'EQUIPE' | 'ALUNO'; caixa: Caixa; caminhos?: readonly string[]; preencher?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const baixar = papel === 'ALUNO' ? baixarImagemDoExercicioDoAluno : baixarImagemDoExercicio;
  const { dados: endereco, erro, carregando } = useCarregar(`demonstracao:${papel}:${exercicioId}:${versao}`, async () => enderecoDaImagem(await baixar(exercicioId)));
  useEffect(
    () => () => {
      if (endereco?.startsWith('blob:')) URL.revokeObjectURL(endereco);
    },
    [endereco],
  );
  if (erro) return caminhos?.length ? <FotosDoCatalogo caminhos={caminhos} descricao={descricao} caixa={caixa} preencher={preencher} /> : null;
  if (carregando || !endereco) return <View accessibilityRole="progressbar" accessibilityLabel={`Carregando: ${descricao}`} style={caixa} />;
  return (
    <View style={caixa}>
      <Image source={{ uri: endereco }} cachePolicy="none" autoplay={!reduzido} accessibilityLabel={descricao} contentFit={preencher ? 'cover' : 'contain'} style={estilos.imagem} />
    </View>
  );
}

function FotosDoCatalogo({ caminhos, descricao, caixa, preencher }: { caminhos: readonly string[]; descricao: string; caixa: Caixa; preencher?: boolean }) {
  const reduzido = useMovimentoReduzido();
  const [passo, setPasso] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const alterna = deveAlternar(caminhos.length, reduzido);
  useEffect(() => {
    if (!alterna) return;
    const relogio = setInterval(() => setPasso((p) => p + 1), INTERVALO_ALTERNANCIA_MS);
    return () => clearInterval(relogio);
  }, [alterna]);
  const base = origemDoSite();
  const urls = caminhos.map((c) => urlDaFotoDoCatalogo(base, c)).filter((u): u is string => u !== null);
  if (!urls.length || falhou) return null;
  const vez = fotoDaVez(urls.length, passo, reduzido);
  return (
    <View style={caixa}>
      {urls.map((uri, i) => (
        <Image key={uri} source={{ uri }} cachePolicy="disk" accessibilityLabel={i === vez ? descricao : undefined}
          accessible={i === vez} contentFit={preencher ? 'cover' : 'contain'} onError={() => setFalhou(true)}
          style={[estilos.imagem, { opacity: i === vez ? 1 : 0 }]} />
      ))}
    </View>
  );
}

/** Maior lado da imagem ampliada (a folha leva 48 px de margem a mais). */
const LADO_AMPLIADO = 760;

const estilos = StyleSheet.create({
  caixa: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  imagem: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
