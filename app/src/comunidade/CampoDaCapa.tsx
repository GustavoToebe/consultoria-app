import { ImagePlus, Trash2, Video } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { baixarCapaDaEquipe, criarCapaDoYoutube } from '../api/comunidade';
import { FotoRecusada } from '../aluno/atualizacao/fotos/prepararFoto';
import { podeUsarCapaDoYoutube, ROTULO_BUSCANDO_A_CAPA, ROTULO_CAPA_DO_YOUTUBE, textoDoErroDaCapaDoYoutube } from '../dominio/comunidade';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { MensagemDeErro } from '../ui/Campo';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { separarErros, textoDoErro } from '../ui/erros';
import { escolherEEnviarCapa } from './fotosDoMural';

const LARGURA_DA_PREVIA = 240;

/**
 * Capa do vídeo (equipe, post de vídeo e aulão): opcional, escolhida da galeria, reduzida e enviada na hora (`POST
 * /comunidade/capas`); a folha guarda só o id. Sem capa, o quadro do vídeo fica neutro. Remover só tira o id do
 * rascunho: no aulão, salvar sem `capaId` apaga a capa. Com link do YouTube e sem capa, "Usar a capa do YouTube" pede a capa
 * à nossa API (`POST /comunidade/capas/youtube`) e grava o id devolvido, sem o app tocar na imagem do YouTube (C25).
 */
export function CampoDaCapa({ capaId, aoMudar, erro, online = true, videoUrl }: {
  capaId: string | null;
  aoMudar: (id: string | null) => void;
  erro?: string | null;
  online?: boolean;
  /** Link do vídeo do formulário: sendo do YouTube e sem capa, aparece "Usar a capa do YouTube" (C25). */
  videoUrl?: string | null;
}) {
  const [enviando, setEnviando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  const escolher = async () => {
    setErroDoEnvio(null);
    setEnviando(true);
    try {
      const id = await escolherEEnviarCapa('galeria');
      if (id) aoMudar(id);
    } catch (e) {
      setErroDoEnvio(e instanceof FotoRecusada ? e.message : (separarErros(e, ['arquivo']).campos.arquivo ?? textoDoErro(e)));
    } finally {
      setEnviando(false);
    }
  };
  // O app só manda o link à nossa API (a imagem do YouTube nunca passa por aqui); o id volta como o de um envio comum.
  const usarCapaDoYoutube = async () => {
    setErroDoEnvio(null);
    setBuscando(true);
    try {
      aoMudar((await criarCapaDoYoutube((videoUrl ?? '').trim())).id);
    } catch (e) {
      const mensagem = separarErros(e, ['videoUrl']).campos.videoUrl ?? textoDoErro(e);
      setErroDoEnvio(textoDoErroDaCapaDoYoutube(e instanceof ErroApi ? e.status : null, mensagem));
    } finally {
      setBuscando(false);
    }
  };
  const motivo = online ? undefined : 'Sem conexão: enviar a capa precisa de internet.';
  const mensagem = erroDoEnvio ?? erro;
  const mostrarYoutube = podeUsarCapaDoYoutube(videoUrl, capaId);
  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo">Capa (opcional)</Texto>
      <Texto variante="pequeno">Aparece antes de o vídeo tocar. Escolha uma imagem da galeria; o app reduz e envia em JPEG.</Texto>
      {capaId ? (
        <ImagemProtegida chave={`capa:${capaId}`} carregar={() => baixarCapaDaEquipe(capaId)} descricao="Capa do vídeo"
          tamanho={LARGURA_DA_PREVIA} altura={Math.round((LARGURA_DA_PREVIA * 9) / 16)} />
      ) : null}
      <LinhaDeAcoes>
        <Botao rotulo={capaId ? 'Trocar capa' : 'Escolher capa'} tipo="secundario" Icone={ImagePlus} carregando={enviando}
          desabilitado={!!motivo || buscando} motivo={motivo} aoTocar={() => void escolher()} />
        {mostrarYoutube ? <Botao rotulo={buscando ? ROTULO_BUSCANDO_A_CAPA : ROTULO_CAPA_DO_YOUTUBE} tipo="secundario" Icone={Video}
          carregando={buscando} desabilitado={!!motivo || enviando} motivo={motivo} aoTocar={() => void usarCapaDoYoutube()} /> : null}
        {capaId ? <Botao rotulo="Remover capa" tipo="perigoTexto" Icone={Trash2} desabilitado={enviando}
          motivo="Espere a capa terminar de enviar." aoTocar={() => { setErroDoEnvio(null); aoMudar(null); }} /> : null}
      </LinhaDeAcoes>
      {mensagem ? <MensagemDeErro erro={mensagem} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
});
