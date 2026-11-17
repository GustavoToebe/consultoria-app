import { Camera, ImagePlus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { publicarNoMuralDaEquipe, publicarNoMuralDoAluno } from '../api/comunidade';
import type { PodResumo } from '../api/comunidadeTipos';
import { FotoRecusada } from '../aluno/atualizacao/fotos/prepararFoto';
import {
  AVISO_AO_CRIAR_ENQUETE, avisoDoPod, type CampoDoPost, ENQUETE_OPCAO_MAXIMA, ENQUETE_OPCOES_MAXIMO, ENQUETE_OPCOES_MINIMO, errosDoPost,
  OPCOES_INICIAIS_DA_ENQUETE, POST_FOTOS_MAXIMO, type PapelNoMural, postParaEnviar, type RascunhoDoPost, tiposParaEscolher,
} from '../dominio/comunidade';
import { espaco } from '../tema/tokens';
import { CampoData, Interruptor } from '../ui/Campos';
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
import { CampoDaCapa } from './CampoDaCapa';
import { EscolhaDoGrupo } from './EscolhaDoGrupo';
import { escolherEEnviarFotoDoMural, rotasDaFotoDoMural } from './fotosDoMural';

const CAMPOS: CampoDoPost[] = ['tipo', 'texto', 'videoUrl', 'fotoIds', 'capaId', 'opcoes', 'encerraEm'];
const SEM_INTERNET = 'Sem conexão: publicar precisa de internet.';

/**
 * "Nova publicação" do mural numa `Folha` (aluno e equipe). O rascunho mora na tela (fechar e reabrir mantém); os erros
 * aparecem no envio, cada um no seu campo, com as regras de `dominio/comunidade` e o 422 da API no mesmo lugar. A equipe
 * escolhe também Aviso (nasce fixado), Vídeo (link https e capa opcional) e Enquete (a pergunta é o texto; 2 a 6 opções,
 * várias respostas e prazo opcionais, com o aviso de que o voto é identificado); fotos (0 a 4, aluno e equipe) só com
 * `comFotos`, uma por vez, pendentes até publicar, pela rota do papel (`rotasDaFotoDoMural`).
 *
 * Grupos (pods): o aluno com pod publica no mural que está vendo (`destino`, só leitura; o servidor confere que o pod é o
 * dele); a equipe com `grupos` escolhe Geral (padrão) ou um grupo, com o aviso de menor do grupo escolhido.
 */
export function FolhaNovaPublicacao({ visivel, papel, rascunho, aoMudar, comFotos, online = true, destino, grupos, aoFechar, aoPublicar }: {
  visivel: boolean;
  papel: PapelNoMural;
  rascunho: RascunhoDoPost;
  aoMudar: (r: RascunhoDoPost) => void;
  comFotos: boolean;
  online?: boolean;
  /** Aluno com pod: o mural onde o post vai (`podId` nulo = Geral) e o nome mostrado. */
  destino?: { podId: string | null; rotulo: string };
  /** Equipe com `COMUNIDADE_MODERAR`: os grupos para escolher onde publicar. */
  grupos?: readonly PodResumo[];
  aoFechar: () => void;
  /** Publicado (`podId` nulo = Geral): a tela limpa o rascunho, fecha, avisa e recarrega o mural. */
  aoPublicar: (podId: string | null) => void;
}) {
  const [tentou, setTentou] = useState(false);
  const [errosApi, setErrosApi] = useState<Partial<Record<CampoDoPost, string>>>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [erroDaFoto, setErroDaFoto] = useState<string | null>(null);
  const [grupoEscolhido, setGrupoEscolhido] = useState<string | null>(null);
  const grupo = grupos?.find((p) => p.id === grupoEscolhido) ?? null;
  const podId = destino ? destino.podId : grupo?.id ?? null;
  const avisoDoGrupo = avisoDoPod(grupo);

  const fotos = rascunho.fotoIds ?? [];
  const erros = tentou ? errosDoPost(rascunho, papel) : {};
  const erro = (c: CampoDoPost) => erros[c] ?? errosApi[c] ?? null;
  const mudar = (parte: Partial<RascunhoDoPost>, campo: CampoDoPost) => {
    aoMudar({ ...rascunho, ...parte });
    if (errosApi[campo]) setErrosApi({ ...errosApi, [campo]: undefined });
  };
  // A capa só vale no vídeo: trocar de tipo a tira (a API recusaria) e a enquete começa com duas opções vazias.
  const mudarTipo = (tipo: RascunhoDoPost['tipo']) => mudar({
    tipo,
    ...(tipo !== 'VIDEO' && rascunho.capaId ? { capaId: null } : {}),
    ...(tipo === 'ENQUETE' && !rascunho.opcoes ? { opcoes: [...OPCOES_INICIAIS_DA_ENQUETE] } : {}),
  }, 'tipo');
  const opcoesDaEnquete = rascunho.opcoes ?? OPCOES_INICIAIS_DA_ENQUETE;
  const mudarOpcao = (i: number, texto: string) => mudar({ opcoes: opcoesDaEnquete.map((o, j) => (j === i ? texto : o)) }, 'opcoes');

  const fechar = () => { setTentou(false); setErrosApi({}); setAlerta(null); setErroDaFoto(null); aoFechar(); };

  const publicar = async () => {
    setTentou(true);
    setAlerta(null);
    if (Object.keys(errosDoPost(rascunho, papel)).length) return;
    setEnviando(true);
    try {
      await (papel === 'equipe' ? publicarNoMuralDaEquipe : publicarNoMuralDoAluno)({ ...postParaEnviar(rascunho), ...(podId ? { podId } : {}) });
      setTentou(false);
      setErrosApi({});
      setGrupoEscolhido(null);
      aoPublicar(podId);
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
      const id = await escolherEEnviarFotoDoMural(origem, papel);
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
      await rotasDaFotoDoMural[papel].apagar(id);
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
      {grupos?.length ? (
        <>
          <EscolhaDoGrupo rotulo="Publicar em" rotuloDoNulo="Geral" grupos={grupos} valor={grupo?.id ?? null} aoMudar={setGrupoEscolhido} />
          {grupo ? <Texto variante="suave">Só os alunos deste grupo veem a publicação.</Texto> : null}
          {avisoDoGrupo ? <Alerta tom="atencao" texto={avisoDoGrupo} /> : null}
        </>
      ) : null}
      {destino ? (
        <Texto variante="suave">
          {destino.podId ? `Vai para o grupo ${destino.rotulo}: só quem está nele vê.` : 'Vai para o mural Geral, que todo o time vê.'}
        </Texto>
      ) : null}
      {/* A equipe tem seis tipos: em chips, que quebram a linha no celular em vez de espremer o segmento. */}
      <Escolha rotulo="Tipo" opcoes={opcoes} valor={rascunho.tipo} chips={opcoes.length > 3}
        aoMudar={mudarTipo} erro={erro('tipo')} />
      {rascunho.tipo === 'AVISO' ? <Texto variante="suave">O aviso nasce fixado no topo do mural. Dá para desafixar depois, no ⋯ da publicação.</Texto> : null}
      {rascunho.tipo === 'VIDEO' ? (
        <Campo rotulo="Link do vídeo" placeholder="https://" valor={rascunho.videoUrl ?? ''} autoCapitalize="none" autoCorrect={false}
          inputMode="url" ajuda="Link do YouTube toca aqui mesmo; outro link abre fora do app." aoMudar={(videoUrl) => mudar({ videoUrl }, 'videoUrl')} erro={erro('videoUrl')} />
      ) : null}
      {rascunho.tipo === 'ENQUETE' ? <Alerta tom="atencao" texto={AVISO_AO_CRIAR_ENQUETE} /> : null}
      <Campo
        rotulo={rascunho.tipo === 'VIDEO' ? 'Título do vídeo' : rascunho.tipo === 'ENQUETE' ? 'Pergunta' : 'Texto'}
        placeholder={rascunho.tipo === 'DUVIDA' ? 'Qual é a sua dúvida?' : rascunho.tipo === 'ENQUETE' ? 'O que você quer perguntar ao time?' : 'Escreva para o time'}
        valor={rascunho.texto}
        aoMudar={(texto) => mudar({ texto }, 'texto')}
        linhas={rascunho.tipo === 'VIDEO' || rascunho.tipo === 'ENQUETE' ? 2 : 4}
        erro={erro('texto')}
      />
      {rascunho.tipo === 'VIDEO' ? (
        <CampoDaCapa capaId={rascunho.capaId ?? null} videoUrl={rascunho.videoUrl} online={online} aoMudar={(capaId) => mudar({ capaId }, 'capaId')} erro={erro('capaId')} />
      ) : null}

      {rascunho.tipo === 'ENQUETE' ? (
        <View style={estilos.fotos}>
          <Texto variante="rotulo">{`Opções (de ${ENQUETE_OPCOES_MINIMO} a ${ENQUETE_OPCOES_MAXIMO})`}</Texto>
          {opcoesDaEnquete.map((o, i) => (
            <View key={i} style={estilos.opcao}>
              <View style={estilos.campoDaOpcao}>
                <Campo rotulo={`Opção ${i + 1}`} valor={o} maxLength={ENQUETE_OPCAO_MAXIMA} aoMudar={(t) => mudarOpcao(i, t)} />
              </View>
              {opcoesDaEnquete.length > ENQUETE_OPCOES_MINIMO ? (
                <IconeBotao Icone={X} rotulo={`Remover a opção ${i + 1}`} moldura
                  aoTocar={() => mudar({ opcoes: opcoesDaEnquete.filter((_, j) => j !== i) }, 'opcoes')} />
              ) : null}
            </View>
          ))}
          {erro('opcoes') ? <MensagemDeErro erro={erro('opcoes') as string} /> : null}
          <LinhaDeAcoes>
            <Botao rotulo="Adicionar opção" tipo="secundario" Icone={Plus}
              desabilitado={opcoesDaEnquete.length >= ENQUETE_OPCOES_MAXIMO} motivo={`Até ${ENQUETE_OPCOES_MAXIMO} opções.`}
              aoTocar={() => mudar({ opcoes: [...opcoesDaEnquete, ''] }, 'opcoes')} />
          </LinhaDeAcoes>
          <Interruptor rotulo="Permitir várias respostas" ajuda="Cada pessoa marca quantas opções quiser."
            valor={rascunho.variasRespostas === true} aoMudar={(variasRespostas) => mudar({ variasRespostas }, 'opcoes')} />
          <CampoData rotulo="Encerra em (opcional)" valor={rascunho.encerraEm ?? ''} erro={erro('encerraEm')}
            aoMudar={(encerraEm) => mudar({ encerraEm }, 'encerraEm')} />
          <Texto variante="pequeno">Sem data, a enquete fica aberta. Com data, encerra às 23:59 do dia (horário de Brasília).</Texto>
        </View>
      ) : null}

      {comFotos ? (
        <View style={estilos.fotos}>
          <Texto variante="rotulo">{`Fotos (opcional, até ${POST_FOTOS_MAXIMO})`}</Texto>
          {fotos.length ? (
            <View style={estilos.miniaturas}>
              {fotos.map((id, i) => (
                <View key={id} style={estilos.miniatura}>
                  <ImagemProtegida chave={`mural-foto:${id}`} carregar={() => rotasDaFotoDoMural[papel].baixar(id)} descricao={`Foto ${i + 1} da publicação`} tamanho={88} />
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
  // O X fica alinhado à caixa do campo, não ao rótulo.
  opcao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1) },
  campoDaOpcao: { flex: 1, minWidth: 0 },
});
