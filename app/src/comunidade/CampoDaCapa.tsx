import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { baixarCapaDaEquipe } from '../api/comunidade';
import { FotoRecusada } from '../aluno/atualizacao/fotos/prepararFoto';
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
 * rascunho: no aulão, salvar sem `capaId` apaga a capa.
 */
export function CampoDaCapa({ capaId, aoMudar, erro, online = true }: {
  capaId: string | null;
  aoMudar: (id: string | null) => void;
  erro?: string | null;
  online?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
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
  const motivo = online ? undefined : 'Sem conexão: enviar a capa precisa de internet.';
  const mensagem = erroDoEnvio ?? erro;
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
          desabilitado={!!motivo} motivo={motivo} aoTocar={() => void escolher()} />
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
