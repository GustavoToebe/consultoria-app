import { MessageSquare, MessageSquareOff, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { comentarMural, listarComentariosDoMural, listarComentariosDoMuralEquipe, removerComentarioDoMural } from '../api/comunidade';
import type { ComentarioDoMural } from '../api/comunidadeTipos';
import {
  COMENTARIO_AVISO_A_PARTIR, COMENTARIO_MAXIMO, comentarioParaEnviar, erroDoComentario, MENSAGEM_COMENTARIO_VAZIO, tamanhoDoComentario,
} from '../dominio/comunidade';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Esqueleto } from '../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../ui/Estados';
import { Folha } from '../ui/Folha';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { separarErros, textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';
import { AutorDoPost } from './AutorDoPost';
import { FolhaPerfilDoColega } from './FolhaPerfilDoColega';

/** Aluno lê e comenta (só com internet); a equipe lê e, com `COMUNIDADE_MODERAR`, remove. A equipe não comenta no mural. */
export type ModoDosComentarios = { tipo: 'aluno'; online: boolean } | { tipo: 'equipe'; podeModerar: boolean };

const PREFIXO = 'comentarios-mural:';
const SEM_INTERNET = 'Sem conexão. Comentar precisa de internet.';
// Recuo do texto até o nome do autor: iniciais de 36 px + o espaço da linha do `AutorDoPost`.
const RECUO_DO_TEXTO = 36 + espaco(1);

const eh404 = (erro: unknown) => erro instanceof ErroApi && erro.status === 404;

/**
 * Comentários de um post do mural, numa `Folha` (aluno e equipe; `docs/design-e-front.md`). Lista do mais antigo ao
 * mais novo, com o autor como no post (apelido ao lado; só aluno abre o perfil do colega, numa folha por cima desta).
 * 404 = o post saiu do alcance (oculto ou de outra consultoria): "Post não disponível", sem tentar de novo. Nada fica no
 * aparelho: o rascunho vive só na memória enquanto a tela existe. `aoAlterar` avisa a tela para atualizar o total.
 */
export function FolhaComentarios({ postId, modo, aoFechar, aoAlterar }: {
  postId: string | null;
  modo: ModoDosComentarios;
  aoFechar: () => void;
  aoAlterar: () => void;
}) {
  const { cores } = useTema();
  const chave = postId ? `${PREFIXO}${postId}` : null;
  const lista = useCarregar(chave, (c) => {
    const id = c.slice(PREFIXO.length);
    return modo.tipo === 'aluno' ? listarComentariosDoMural(id) : listarComentariosDoMuralEquipe(id);
  });
  // Reabrir o mesmo post busca de novo (alguém pode ter comentado ou moderado nesse meio-tempo), como o perfil do colega.
  useEffect(() => {
    if (postId && lista.dados !== undefined && !lista.dadosDeOutraChave) lista.recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);
  const dados = lista.dadosDeOutraChave ? undefined : lista.dados;

  // Rascunho por post: trocar de post não leva o texto junto; fechar e reabrir o mesmo post mantém.
  const [rascunho, setRascunho] = useState<{ postId: string | null; texto: string; erroCampo?: string; alerta?: { tom: 'atencao' | 'perigo'; texto: string } }>({ postId: null, texto: '' });
  const meu = rascunho.postId === postId ? rascunho : { postId, texto: '' };
  const [enviando, setEnviando] = useState(false);
  // Post que deu 404 ao comentar (saiu do mural depois de a lista abrir).
  const [sumiu, setSumiu] = useState<string | null>(null);
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);
  const [remover, setRemover] = useState<ComentarioDoMural | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [erroAoRemover, setErroAoRemover] = useState<string | null>(null);

  const aluno = modo.tipo === 'aluno';
  const semInternet = aluno && !modo.online;
  // Sem internet o perfil fecha de vez, como no mural.
  if (semInternet && perfilAberto) setPerfilAberto(null);
  const naoDisponivel = eh404(lista.erro) || (postId !== null && sumiu === postId);

  const erroLocal = erroDoComentario(meu.texto);
  const tamanho = tamanhoDoComentario(meu.texto);
  const motivo = semInternet ? SEM_INTERNET : erroLocal ?? undefined;

  const enviar = () => {
    const id = postId;
    const limpo = comentarioParaEnviar(meu.texto);
    if (!id || !limpo || erroLocal || semInternet) return;
    setEnviando(true);
    setRascunho({ postId: id, texto: meu.texto });
    comentarMural(id, limpo).then(
      (novo) => {
        setEnviando(false);
        setRascunho({ postId: id, texto: '' });
        lista.definir([...(dados ?? []), novo], `${PREFIXO}${id}`);
        AccessibilityInfo.announceForAccessibility('Comentário publicado.');
        aoAlterar();
      },
      (erro: unknown) => {
        setEnviando(false);
        if (eh404(erro)) {
          setSumiu(id);
          aoAlterar();
          return;
        }
        // 422 do texto vai ao campo; o resto (429 do limite, rede, 5xx) vira aviso dentro da folha. O texto fica.
        const { campos, geral } = separarErros(erro, ['texto']);
        const tom = erro instanceof ErroApi && erro.status === 429 ? 'atencao' : 'perigo';
        setRascunho({ postId: id, texto: meu.texto, erroCampo: campos.texto, alerta: geral ? { tom, texto: geral } : undefined });
      },
    );
  };

  const confirmarRemocao = () => {
    const alvo = remover;
    if (!alvo) return;
    setRemovendo(true);
    setErroAoRemover(null);
    const tirar = () => {
      setRemover(null);
      lista.definir((dados ?? []).filter((c) => c.id !== alvo.id), chave ?? undefined);
      aoAlterar();
    };
    removerComentarioDoMural(alvo.id).then(
      () => { setRemovendo(false); tirar(); },
      (erro: unknown) => {
        setRemovendo(false);
        // 404: já não existe (outra pessoa removeu). Sai da lista e a lista vem de novo da API.
        if (eh404(erro)) { tirar(); lista.recarregar(); return; }
        setErroAoRemover(textoDoErro(erro));
      },
    );
  };

  const fecharPainel = () => { setRemover(null); setErroAoRemover(null); };

  const escrever = aluno && dados && !naoDisponivel ? (
    <View style={estilos.escrever}>
      <Campo
        rotulo="Seu comentário"
        placeholder="Escreva para o time"
        valor={meu.texto}
        aoMudar={(t) => setRascunho({ postId, texto: t })}
        linhas={3}
        editable={!enviando && !semInternet}
        erro={meu.erroCampo ?? (erroLocal && erroLocal !== MENSAGEM_COMENTARIO_VAZIO ? erroLocal : null)}
      />
      {tamanho >= COMENTARIO_AVISO_A_PARTIR ? (
        <Texto variante="pequeno" numerico style={estilos.contador} accessibilityLabel={`${tamanho} de ${COMENTARIO_MAXIMO} caracteres`}>
          {tamanho}/{COMENTARIO_MAXIMO}
        </Texto>
      ) : null}
      {meu.alerta ? <Alerta tom={meu.alerta.tom} texto={meu.alerta.texto} /> : null}
      <LinhaDeAcoes alinhar="fim">
        <Botao rotulo="Comentar" tipo="primario" Icone={Send} carregando={enviando}
          desabilitado={!!motivo} motivo={motivo} aoTocar={enviar} />
      </LinhaDeAcoes>
    </View>
  ) : undefined;

  return (
    <Folha visivel={!!postId} titulo="Comentários" aoFechar={aoFechar} rodape={escrever}>
      {naoDisponivel ? (
        <Vazio Icone={MessageSquareOff} titulo="Post não disponível" texto="Este post saiu do mural." />
      ) : lista.erro ? (
        <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} />
      ) : !dados ? (
        <Esqueleto cartoes={2} texto="Carregando os comentários" />
      ) : dados.length === 0 ? (
        <Vazio Icone={MessageSquare} texto="Ninguém comentou ainda." />
      ) : (
        <View style={estilos.lista}>
          {dados.map((c, i) => (
            <View key={c.id} style={[estilos.comentario, i > 0 && [estilos.separado, { borderTopColor: cores.divisor }]]}>
              <AutorDoPost
                post={{ ...c, fixado: false }}
                aoAbrirPerfil={aluno && c.autorEhAluno ? () => setPerfilAberto(c.autorId) : undefined}
              />
              <Texto style={estilos.recuo}>{c.texto}</Texto>
              {/* Depois do texto, e não ao lado do nome: no celular a ação ao lado desceria para entre o nome e o texto. */}
              {modo.tipo === 'equipe' && modo.podeModerar ? (
                <View style={[estilos.recuo, estilos.acaoDoComentario]}>
                  <Botao rotulo="Remover comentário" rotuloAcessivel={`Remover comentário de ${c.autorNome}`} tipo="perigoTexto"
                    Icone={Trash2} aoTocar={() => setRemover(c)} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Dentro da folha: o painel e o perfil precisam do portal dela para ficar por cima. */}
      <PainelConfirmacao
        visivel={!!remover}
        titulo="Remover o comentário?"
        mensagem={remover ? `O comentário de ${remover.autorNome} sai do mural para todos.` : undefined}
        rotuloConfirmar="Remover comentário"
        perigo
        carregando={removendo}
        aoConfirmar={confirmarRemocao}
        aoCancelar={fecharPainel}>
        {erroAoRemover ? <MensagemErro texto={erroAoRemover} /> : null}
      </PainelConfirmacao>
      {aluno ? <FolhaPerfilDoColega autorId={perfilAberto} aoFechar={() => setPerfilAberto(null)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  comentario: { gap: espaco(0.5) },
  separado: { borderTopWidth: 1, paddingTop: espaco(1.5) },
  recuo: { paddingLeft: RECUO_DO_TEXTO },
  // O botão fantasma tem respiro interno; a margem negativa alinha o ícone ao texto.
  acaoDoComentario: { flexDirection: 'row', marginLeft: -espaco(2) },
  // O rodapé da folha é uma linha; o bloco de escrever ocupa a largura toda dela.
  escrever: { flexBasis: '100%', flexGrow: 1, gap: espaco(1) },
  contador: { alignSelf: 'flex-end' },
});
