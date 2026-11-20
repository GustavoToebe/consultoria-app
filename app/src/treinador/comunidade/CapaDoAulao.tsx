import { ImagePlus, Trash2, Video } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { baixarCapaDaEquipe, criarCapaDoYoutube } from '../../api/comunidade';
import type { AulaDaComunidade } from '../../api/comunidadeTipos';
import { FotoRecusada } from '../../aluno/atualizacao/fotos/prepararFoto';
import { escolherEEnviarCapa } from '../../comunidade/fotosDoMural';
import {
  capaAoMudarOLink, capaDoYoutubeNaTela, idDoYoutube, origemInicialDaCapa, type OrigemDaCapa, ROTULO_BUSCANDO_A_CAPA,
  ROTULO_CAPA_DO_YOUTUBE, textoDoErroDaCapaDoYoutube,
} from '../../dominio/comunidade';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { MensagemDeErro } from '../../ui/Campo';
import { ImagemProtegida } from '../../ui/ImagemProtegida';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { separarErros, textoDoErro } from '../../ui/erros';

const LARGURA_DA_PREVIA = 320;
const ALTURA_DA_PREVIA = Math.round((LARGURA_DA_PREVIA * 9) / 16);
export const SEM_INTERNET_NA_CAPA = 'Sem conexão: a capa precisa de internet.';

/**
 * Capa do vídeo da aba Vídeos (D4). A capa mora no rascunho da folha (`capaId`); este gancho guarda de onde ela veio
 * (`OrigemDaCapa`) e faz a busca automática pelo link: o app só manda o link à nossa API (`POST /comunidade/capas/youtube`),
 * nunca toca na imagem do YouTube (C25). A busca nasce no `aoMudarOLink` (evento, não efeito: o StrictMode rodaria o efeito
 * duas vezes e gastaria duas capas da cota), e a resposta que chega depois de o link ou a capa mudarem é descartada.
 */
export function useCapaDoAulao({ original, link, capaId, mudarCapa, online }: {
  original?: AulaDaComunidade;
  link: string;
  capaId: string | null;
  mudarCapa: (id: string | null) => void;
  online: boolean;
}) {
  const [origem, setOrigem] = useState<OrigemDaCapa>(() => origemInicialDaCapa(original));
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Capa já criada por vídeo: voltar a um link já buscado não gasta outra (a capa pendente vale 24 h no servidor).
  const jaBuscadas = useRef(new Map<string, string>());
  const pedido = useRef(0);

  /** Invalida a busca em andamento: a resposta dela não muda mais a capa. */
  const largarBusca = () => {
    pedido.current += 1;
    setBuscando(false);
  };

  const buscar = async (video: string, url: string) => {
    largarBusca();
    setErro(null);
    const pronta = jaBuscadas.current.get(video);
    if (pronta) { mudarCapa(pronta); return; }
    const meu = pedido.current;
    setBuscando(true);
    try {
      const { id } = await criarCapaDoYoutube(url.trim());
      jaBuscadas.current.set(video, id);
      if (meu === pedido.current) mudarCapa(id);
    } catch (e) {
      const mensagem = separarErros(e, ['videoUrl']).campos.videoUrl ?? textoDoErro(e);
      if (meu === pedido.current) setErro(textoDoErroDaCapaDoYoutube(e instanceof ErroApi ? e.status : null, mensagem));
    } finally {
      if (meu === pedido.current) setBuscando(false);
    }
  };

  const aoMudarOLink = (novo: string) => {
    const passo = capaAoMudarOLink(origem, novo);
    if (passo.origem === origem) return;
    setOrigem(passo.origem);
    largarBusca();
    setErro(null);
    if (passo.limpar && capaId) mudarCapa(null);
    if (passo.buscar && online) void buscar(passo.buscar, novo);
  };

  const usarDoYoutube = () => {
    const video = idDoYoutube(link);
    if (!video) return;
    setOrigem({ tipo: 'automatica', video });
    void buscar(video, link);
  };

  const escolher = async () => {
    largarBusca();
    setErro(null);
    setEnviando(true);
    try {
      const id = await escolherEEnviarCapa('galeria');
      if (id) {
        mudarCapa(id);
        setOrigem({ tipo: 'fixa', video: idDoYoutube(link) });
      }
    } catch (e) {
      setErro(e instanceof FotoRecusada ? e.message : (separarErros(e, ['arquivo']).campos.arquivo ?? textoDoErro(e)));
    } finally {
      setEnviando(false);
    }
  };

  // Remover deixa o vídeo sem capa (o `PUT` com `capaId` nulo a apaga) e para de acompanhar o link até "Usar a capa do YouTube".
  const remover = () => {
    largarBusca();
    setErro(null);
    mudarCapa(null);
    setOrigem({ tipo: 'fixa', video: idDoYoutube(link) });
  };

  return {
    aoMudarOLink,
    ocupada: buscando || enviando,
    campo: { link, capaId, origem, buscando, enviando, erro, online, usarDoYoutube, escolher: () => void escolher(), remover },
  };
}

type PropsDaCapa = ReturnType<typeof useCapaDoAulao>['campo'] & { erroDaApi?: string | null };

/**
 * O bloco da capa logo abaixo do link: a prévia (16:9) com a capa do YouTube já preenchida, "Trocar capa" e "Remover capa";
 * sem capa, "Escolher capa" e, com link do YouTube, "Usar a capa do YouTube". Enquanto busca, o quadro guarda o lugar da
 * prévia (sem salto) e o botão diz "Buscando a capa…".
 */
export function CapaDoAulao({ link, capaId, origem, buscando, enviando, erro, erroDaApi, online, usarDoYoutube, escolher, remover }: PropsDaCapa) {
  const { cores } = useTema();
  const { oferecer, aviso } = capaDoYoutubeNaTela(origem, link, capaId);
  const motivo = online ? undefined : SEM_INTERNET_NA_CAPA;
  const mensagem = erro ?? erroDaApi;
  const doYoutube = origem.tipo === 'automatica' && !!capaId;
  return (
    <View style={estilos.bloco}>
      <View style={estilos.cabeca}>
        <Texto variante="rotulo">Capa (opcional)</Texto>
        <Texto variante="pequeno">
          {doYoutube ? 'A capa do YouTube, que aparece antes de o vídeo tocar.'
            : 'Aparece antes de o vídeo tocar. Escolha uma imagem da galeria; o app reduz e envia em JPEG.'}
        </Texto>
      </View>
      {capaId ? (
        <ImagemProtegida chave={`capa:${capaId}`} carregar={() => baixarCapaDaEquipe(capaId)} descricao="Capa do vídeo"
          tamanho={LARGURA_DA_PREVIA} altura={ALTURA_DA_PREVIA} />
      ) : buscando ? (
        <View style={[estilos.quadro, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ActivityIndicator color={cores.textoSuave} />
        </View>
      ) : null}
      <LinhaDeAcoes>
        <Botao rotulo={capaId ? 'Trocar capa' : 'Escolher capa'} tipo="secundario" Icone={ImagePlus} carregando={enviando}
          desabilitado={!!motivo} motivo={motivo} aoTocar={escolher} />
        {oferecer ? <Botao rotulo={buscando ? ROTULO_BUSCANDO_A_CAPA : ROTULO_CAPA_DO_YOUTUBE} tipo="secundario" Icone={Video}
          carregando={buscando} desabilitado={!!motivo || enviando} motivo={motivo ?? 'Espere a capa terminar de enviar.'}
          aoTocar={usarDoYoutube} /> : null}
        {capaId ? <Botao rotulo="Remover capa" tipo="perigoTexto" Icone={Trash2} desabilitado={enviando}
          motivo="Espere a capa terminar de enviar." aoTocar={remover} /> : null}
      </LinhaDeAcoes>
      {aviso ? <Texto variante="pequeno" accessibilityLiveRegion="polite">{aviso}</Texto> : null}
      {mensagem ? <MensagemDeErro erro={mensagem} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  cabeca: { gap: espaco(0.5) },
  quadro: {
    width: LARGURA_DA_PREVIA, height: ALTURA_DA_PREVIA, maxWidth: '100%', borderWidth: 1, borderRadius: RAIO,
    alignItems: 'center', justifyContent: 'center',
  },
});
