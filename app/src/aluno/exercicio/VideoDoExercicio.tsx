import { lazy, Suspense } from 'react';
import { View } from 'react-native';

// Só a coluna do exercício da web larga mostra o vídeo embutido: o player (WebView no nativo) carrega quando ela aparece,
// não junto da tela do exercício, que no celular só tem o botão "Vídeo".
const CapaDoVideo = lazy(() => import('../../comunidade/CapaDoVideo').then((m) => ({ default: m.CapaDoVideo })));

/** O exercício não tem capa nossa (`capaId` nulo): a `CapaDoVideo` nunca chama isto. */
const SEM_CAPA = () => Promise.reject(new Error('Exercício sem capa.'));

/**
 * Vídeo do exercício embutido em 16:9 na largura da coluna, a mesma peça da Comunidade (`comunidade/CapaDoVideo`): o
 * YouTube só monta depois do toque em "Assistir aqui" (`youtube-nocookie`, sem token nem cookie nosso) e "Abrir no YouTube"
 * continua, fora do app. Até o player carregar, o quadro já ocupa o lugar (sem salto).
 */
export function VideoDoExercicio({ videoUrl, nome, aoAbrirFora }: { videoUrl: string; nome: string; aoAbrirFora: (url: string) => void }) {
  return (
    <Suspense fallback={<View style={{ width: '100%', aspectRatio: 16 / 9 }} />}>
      <CapaDoVideo videoUrl={videoUrl} titulo={nome} capaId={null} baixarCapa={SEM_CAPA} aoAbrirFora={aoAbrirFora} />
    </Suspense>
  );
}
