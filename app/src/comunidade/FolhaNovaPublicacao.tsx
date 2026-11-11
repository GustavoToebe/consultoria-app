import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { apagarFotoPendenteDoMural, baixarFotoDoMuralDoAluno, publicarNoMuralDaEquipe, publicarNoMuralDoAluno } from '../api/comunidade';
import { FotoRecusada } from '../aluno/atualizacao/fotos/prepararFoto';
import {
  type CampoDoPost, errosDoPost, POST_FOTOS_MAXIMO, type PapelNoMural, postParaEnviar, type RascunhoDoPost, tiposParaEscolher,
} from '../dominio/comunidade';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo, MensagemDeErro } from '../ui/Campo';
import { Escolha } from '../ui/Escolha';
import { Alerta } from '../ui/Estados';
import { Folha } from '../ui/Folha';
import { IconeBotao } from '../ui/IconeBotao';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { separarErros, textoDoErro } from '../ui/erros';
import { escolherEEnviarFotoDoMural } from './fotosDoMural';

const CAMPOS: CampoDoPost[] = ['tipo', 'texto', 'videoUrl', 'fotoIds'];
const SEM_INTERNET = 'Sem conexão: publicar precisa de internet.';

/**
 * "Nova publicação" do mural numa `Folha` (aluno e equipe). O rascunho mora na tela (fechar e reabrir mantém); os erros
 * aparecem no envio, cada um no seu campo, com as regras de `dominio/comunidade` e o 422 da API no mesmo lugar. A equipe
 * escolhe também Aviso (nasce fixado) e Vídeo (link https, aberto fora do app); fotos só para o aluno com `comFotos`,
 * uma por vez, pendentes até publicar.
 */
export function FolhaNovaPublicacao({ visivel, papel, rascunho, aoMudar, comFotos, online = true, aoFechar, aoPublicar }: {
  visivel: boolean;
  papel: PapelNoMural;
  rascunho: RascunhoDoPost;
  aoMudar: (r: RascunhoDoPost) => void;
  comFotos: boolean;
  online?: boolean;
  aoFechar: () => void;
  /** Publicado: a tela limpa o rascunho, fecha, avisa e recarrega o mural. */
  aoPublicar: () => void;
}) {
  const [tentou, setTentou] = useState(false);
  const [errosApi, setErrosApi] = useState<Partial<Record<CampoDoPost, string>>>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [erroDaFoto, setErroDaFoto] = useState<string | null>(null);

  const fotos = rascunho.fotoIds ?? [];
  const erros = tentou ? errosDoPost(rascunho, papel) : {};
  const erro = (c: CampoDoPost) => erros[c] ?? errosApi[c] ?? null;
  const mudar = (parte: Partial<RascunhoDoPost>, campo: CampoDoPost) => {
    aoMudar({ ...rascunho, ...parte });
    if (errosApi[campo]) setErrosApi({ ...errosApi, [campo]: undefined });
  };

  const fechar = () => { setTentou(false); setErrosApi({}); setAlerta(null); setErroDaFoto(null); aoFechar(); };

  const publicar = async () => {
    setTentou(true);
    setAlerta(null);
    if (Object.keys(errosDoPost(rascunho, papel)).length) return;
    setEnviando(true);
    try {
      await (papel === 'equipe' ? publicarNoMuralDaEquipe : publicarNoMuralDoAluno)(postParaEnviar(rascunho));
      setTentou(false);
      setErrosApi({});
      aoPublicar();
    } catch (e) {
      const { campos, geral } = separarErros(e, CAMPOS);
      setErrosApi(campos);
      setAlerta(geral ?? null);
    } finally {
      setEnviando(false);
    }
  };

  const adicionarFoto = async (origem: 'galeria' | 'camera') => {
    setErroDaFoto(null);
    setSubindoFoto(true);
    try {
      const id = await escolherEEnviarFotoDoMural(origem);
      if (id) mudar({ fotoIds: [...fotos, id] }, 'fotoIds');
    } catch (e) {
      setErroDaFoto(e instanceof FotoRecusada ? e.message : (separarErros(e, ['arquivo']).campos.arquivo ?? textoDoErro(e)));
    } finally {
      setSubindoFoto(false);
    }
  };

  const tirarFoto = async (id: string) => {
    setErroDaFoto(null);
    try {
      await apagarFotoPendenteDoMural(id);
    } catch (e) {
      // 404: a pendente já saiu (passou do prazo ou foi publicada); some da lista do mesmo jeito.
      if (!(e instanceof ErroApi && e.status === 404)) { setErroDaFoto(textoDoErro(e)); return; }
    }
    mudar({ fotoIds: fotos.filter((f) => f !== id) }, 'fotoIds');
  };

  const cheio = fotos.length >= POST_FOTOS_MAXIMO;
  const motivoDaFoto = !online ? SEM_INTERNET : cheio ? `Até ${POST_FOTOS_MAXIMO} fotos por publicação.` : undefined;
  const opcoes = tiposParaEscolher(papel).map((t) => ({ valor: t.tipo, rotulo: t.rotulo }));

  return (
    <Folha
      visivel={visivel}
      titulo="Nova publicação"
      aoFechar={fechar}
      rodape={
        <LinhaDeAcoes>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
          <Botao rotulo="Publicar" tipo="primario" carregando={enviando} desabilitado={!online || subindoFoto}
            motivo={!online ? SEM_INTERNET : 'Espere a foto terminar de enviar.'} aoTocar={() => void publicar()} />
        </LinhaDeAcoes>
      }>
      {/* A equipe tem cinco tipos: em chips, que quebram a linha no celular em vez de espremer o segmento. */}
      <Escolha rotulo="Tipo" opcoes={opcoes} valor={rascunho.tipo} chips={opcoes.length > 3}
        aoMudar={(tipo) => mudar({ tipo }, 'tipo')} erro={erro('tipo')} />
      {rascunho.tipo === 'AVISO' ? <Texto variante="suave">O aviso nasce fixado no topo do mural. Dá para desafixar depois, no ⋯ da publicação.</Texto> : null}
      {rascunho.tipo === 'VIDEO' ? (
        <Campo rotulo="Link do vídeo" placeholder="https://" valor={rascunho.videoUrl ?? ''} autoCapitalize="none" autoCorrect={false}
          inputMode="url" ajuda="Abre fora do app, como os aulões." aoMudar={(videoUrl) => mudar({ videoUrl }, 'videoUrl')} erro={erro('videoUrl')} />
      ) : null}
      <Campo
        rotulo={rascunho.tipo === 'VIDEO' ? 'Título do vídeo' : 'Texto'}
        placeholder={rascunho.tipo === 'DUVIDA' ? 'Qual é a sua dúvida?' : 'Escreva para o time'}
        valor={rascunho.texto}
        aoMudar={(texto) => mudar({ texto }, 'texto')}
        linhas={rascunho.tipo === 'VIDEO' ? 2 : 4}
        erro={erro('texto')}
      />

      {papel === 'aluno' && comFotos ? (
        <View style={estilos.fotos}>
          <Texto variante="rotulo">{`Fotos (opcional, até ${POST_FOTOS_MAXIMO})`}</Texto>
          {fotos.length ? (
            <View style={estilos.miniaturas}>
              {fotos.map((id, i) => (
                <View key={id} style={estilos.miniatura}>
                  <ImagemProtegida chave={`mural-foto:${id}`} carregar={() => baixarFotoDoMuralDoAluno(id)} descricao={`Foto ${i + 1} da publicação`} tamanho={88} />
                  <IconeBotao Icone={X} rotulo={`Remover a foto ${i + 1}`} moldura aoTocar={() => void tirarFoto(id)} />
                </View>
              ))}
            </View>
          ) : null}
          <LinhaDeAcoes>
            <Botao rotulo="Adicionar foto" tipo="secundario" Icone={ImagePlus} carregando={subindoFoto}
              desabilitado={!!motivoDaFoto} motivo={motivoDaFoto} aoTocar={() => void adicionarFoto('galeria')} />
            {Platform.OS !== 'web' ? (
              <Botao rotulo="Tirar foto" tipo="secundario" Icone={Camera} desabilitado={!!motivoDaFoto || subindoFoto}
                motivo={motivoDaFoto ?? 'Espere a foto terminar de enviar.'} aoTocar={() => void adicionarFoto('camera')} />
            ) : null}
          </LinhaDeAcoes>
          {erroDaFoto ?? erro('fotoIds') ? <MensagemDeErro erro={(erroDaFoto ?? erro('fotoIds')) as string} /> : null}
        </View>
      ) : null}

      {alerta ? <Alerta tom="perigo" texto={alerta} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  fotos: { gap: espaco(1) },
  miniaturas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  miniatura: { alignItems: 'center', gap: espaco(0.5) },
});
