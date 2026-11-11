import { MessageSquare, MessageSquareOff, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { comentarComoAluno, comentarComoEquipe, listarComentariosDaEquipe, listarComentariosDoAluno, removerComentario } from '../api/comunidade';
import type { AlvoDosComentarios, ComentarioDoMural } from '../api/comunidadeTipos';
import {
  COMENTARIO_MAXIMO, comentarioParaEnviar, comentariosDaPrimeiraPagina, comentariosQueFaltam, comComentarioEnviado, contadorDoComentario,
  erroDoComentario, juntarPaginaDeComentarios, MENSAGEM_COMENTARIO_VAZIO, proximaPaginaDeComentarios, semOComentario,
  type ComentariosLidos,
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
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { separarErros, textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';
import { AutorDoPost } from './AutorDoPost';
import { FolhaPerfilDoColega } from './FolhaPerfilDoColega';

/** Aluno lê e comenta (só com internet); a equipe lê e, com `COMUNIDADE_MODERAR`, remove e responde nos posts do mural (aulões, não). */
export type ModoDosComentarios = { tipo: 'aluno'; online: boolean } | { tipo: 'equipe'; podeModerar: boolean };

type Lidos = ComentariosLidos<ComentarioDoMural>;

const SEM_INTERNET = 'Sem conexão. Comentar precisa de internet.';
// Recuo do texto até o nome do autor: iniciais de 36 px + o espaço da linha do `AutorDoPost`.
const RECUO_DO_TEXTO = 36 + espaco(1);

const TEXTOS = {
  post: { indisponivel: 'Post não disponível', saiu: 'Este post saiu do mural.', onde: 'do mural' },
  aula: { indisponivel: 'Aulão não disponível', saiu: 'Este aulão saiu da Comunidade.', onde: 'do aulão' },
} as const;

const eh404 = (erro: unknown) => erro instanceof ErroApi && erro.status === 404;
const chaveDe = (alvo: AlvoDosComentarios | null) => (alvo ? `comentarios:${alvo.tipo}:${alvo.id}` : null);
const alvoDa = (chave: string): AlvoDosComentarios => {
  const [, tipo, ...id] = chave.split(':');
  return { tipo: tipo === 'aula' ? 'aula' : 'post', id: id.join(':') };
};

/**
 * Comentários de um post do mural ou de uma aula, numa `Folha` (aluno e equipe; `docs/design-e-front.md`). Lista do mais
 * antigo ao mais novo, 30 por vez, com "Carregar mais" que acrescenta a próxima página sem perder o que já foi lido; o
 * autor aparece como no post (apelido ao lado; só aluno abre o perfil do colega, numa folha por cima desta). 404 = o
 * post ou a aula saiu do alcance: "não disponível", sem tentar de novo. Nada fica no aparelho: o rascunho vive só na
 * memória enquanto a tela existe. `aoAlterar` avisa a tela para atualizar o total.
 */
export function FolhaComentarios({ alvo, modo, aoFechar, aoAlterar }: {
  alvo: AlvoDosComentarios | null;
  modo: ModoDosComentarios;
  aoFechar: () => void;
  aoAlterar: () => void;
}) {
  const { cores } = useTema();
  const chave = chaveDe(alvo);
  const aluno = modo.tipo === 'aluno';
  const lista = useCarregar<Lidos>(chave, (c) =>
    (aluno ? listarComentariosDoAluno : listarComentariosDaEquipe)(alvoDa(c), 0).then(comentariosDaPrimeiraPagina));
  const dados = lista.dadosDeOutraChave ? undefined : lista.dados;
  // As respostas (enviar, remover, carregar mais) chegam depois: juntam sobre o que está na tela agora, não sobre o de quando começaram.
  const atual = useRef(dados);
  useEffect(() => { atual.current = dados; });

  // Rascunho por alvo: trocar de post ou aula não leva o texto junto; fechar e reabrir o mesmo mantém.
  const [rascunho, setRascunho] = useState<{ chave: string | null; texto: string; erroCampo?: string; alerta?: { tom: 'atencao' | 'perigo'; texto: string } }>({ chave: null, texto: '' });
  const meu = rascunho.chave === chave ? rascunho : { chave, texto: '' };
  const [enviando, setEnviando] = useState(false);
  // Alvo que deu 404 depois de a lista abrir (ao comentar ou ao carregar mais).
  const [sumiu, setSumiu] = useState<string | null>(null);
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);
  const [remover, setRemover] = useState<ComentarioDoMural | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [erroAoRemover, setErroAoRemover] = useState<string | null>(null);
  // "Carregar mais" da chave aberta: buscando ou com erro (o que já foi lido fica).
  const [mais, setMais] = useState<{ chave: string; carregando: boolean; erro?: unknown } | null>(null);
  const maisAqui = mais && mais.chave === chave ? mais : null;
  // Fechar põe a chave em nulo; reabrir o mesmo alvo muda a chave e o `useCarregar` já busca a página 0 de novo (alguém
  // pode ter comentado ou moderado nesse meio-tempo). O erro de um "Carregar mais" antigo não sobrevive a isso.
  if (chave === null && mais) setMais(null);

  const textos = TEXTOS[alvo?.tipo ?? 'post'];
  const semInternet = aluno && !modo.online;
  // A equipe responde só no mural (a rota de comentar da equipe é do post); o comentário volta com `daEquipe`.
  const escreve = aluno || (modo.podeModerar && alvo?.tipo === 'post');
  const naoDisponivel = eh404(lista.erro) || (chave !== null && sumiu === chave);

  const erroLocal = erroDoComentario(meu.texto);
  const contador = contadorDoComentario(meu.texto);
  const motivo = semInternet ? SEM_INTERNET : erroLocal ?? undefined;
  // Perto do limite o leitor de tela ouve uma vez (não a cada tecla); acima dele, o erro do campo já é anunciado.
  const tomDoContador = contador?.tom;
  useEffect(() => {
    if (tomDoContador === 'atencao') AccessibilityInfo.announceForAccessibility(`Perto do limite de ${COMENTARIO_MAXIMO} caracteres.`);
  }, [tomDoContador]);

  const enviar = () => {
    const k = chave;
    const limpo = comentarioParaEnviar(meu.texto);
    if (!alvo || !k || !limpo || erroLocal || semInternet) return;
    setEnviando(true);
    setRascunho({ chave: k, texto: meu.texto });
    (aluno ? comentarComoAluno(alvo, limpo) : comentarComoEquipe(alvo.id, limpo)).then(
      (novo) => {
        setEnviando(false);
        setRascunho({ chave: k, texto: '' });
        if (atual.current) lista.definir(comComentarioEnviado(atual.current, novo), k);
        AccessibilityInfo.announceForAccessibility('Comentário publicado.');
        aoAlterar();
      },
      (erro: unknown) => {
        setEnviando(false);
        if (eh404(erro)) {
          setSumiu(k);
          aoAlterar();
          return;
        }
        // 422 do texto vai ao campo; o resto (429 do limite, rede, 5xx) vira aviso dentro da folha. O texto fica.
        const { campos, geral } = separarErros(erro, ['texto']);
        const tom = erro instanceof ErroApi && erro.status === 429 ? 'atencao' : 'perigo';
        setRascunho({ chave: k, texto: meu.texto, erroCampo: campos.texto, alerta: geral ? { tom, texto: geral } : undefined });
      },
    );
  };

  const carregarMais = () => {
    const k = chave;
    if (!alvo || !k || !dados || maisAqui?.carregando) return;
    setMais({ chave: k, carregando: true });
    (aluno ? listarComentariosDoAluno : listarComentariosDaEquipe)(alvo, proximaPaginaDeComentarios(dados)).then(
      (pagina) => {
        setMais(null);
        const antes = atual.current;
        if (!antes) return;
        const depois = juntarPaginaDeComentarios(antes, pagina);
        lista.definir(depois, k);
        const chegaram = depois.itens.length - antes.itens.length;
        AccessibilityInfo.announceForAccessibility(chegaram === 1 ? '1 comentário carregado.' : `${chegaram} comentários carregados.`);
      },
      (erro: unknown) => {
        if (eh404(erro)) { setMais(null); setSumiu(k); aoAlterar(); return; }
        setMais({ chave: k, carregando: false, erro });
      },
    );
  };

  const confirmarRemocao = () => {
    const alvoDoPainel = remover;
    const k = chave;
    if (!alvoDoPainel || !alvo) return;
    setRemovendo(true);
    setErroAoRemover(null);
    const tirar = () => {
      setRemover(null);
      if (atual.current && k) lista.definir(semOComentario(atual.current, alvoDoPainel.id), k);
      aoAlterar();
    };
    removerComentario(alvo.tipo, alvoDoPainel.id).then(
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

  const corDoContador = contador?.tom === 'perigo' ? cores.perigo : contador?.tom === 'atencao' ? cores.atencao : undefined;
  const escrever = escreve && dados && !naoDisponivel ? (
    <View style={estilos.escrever}>
      <Campo
        rotulo={aluno ? 'Seu comentário' : 'Responder como equipe'}
        placeholder={aluno ? 'Escreva para o time' : 'Resposta da equipe'}
        valor={meu.texto}
        aoMudar={(t) => setRascunho({ chave, texto: t })}
        linhas={3}
        editable={!enviando && !semInternet}
        erro={meu.erroCampo ?? (erroLocal && erroLocal !== MENSAGEM_COMENTARIO_VAZIO ? erroLocal : null)}
      />
      {contador ? (
        <Texto variante="pequeno" numerico cor={corDoContador} style={estilos.contador} accessibilityLabel={contador.rotuloAcessivel}>
          {contador.texto}
        </Texto>
      ) : null}
      {meu.alerta ? <Alerta tom={meu.alerta.tom} texto={meu.alerta.texto} /> : null}
      <LinhaDeAcoes alinhar="fim">
        <Botao rotulo="Comentar" tipo="primario" Icone={Send} carregando={enviando}
          desabilitado={!!motivo} motivo={motivo} aoTocar={enviar} />
      </LinhaDeAcoes>
    </View>
  ) : undefined;

  const linha = (c: ComentarioDoMural, separado: boolean) => (
    <View key={c.id} style={[estilos.comentario, separado && [estilos.separado, { borderTopColor: cores.divisor }]]}>
      <AutorDoPost
        post={{ ...c, fixado: false }}
        aoAbrirPerfil={aluno && c.autorEhAluno ? () => setPerfilAberto(c.autorId) : undefined}
        acao={c.daEquipe ? <Selo texto="Equipe" tipo="neutro" /> : undefined}
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
  );

  const faltam = dados ? comentariosQueFaltam(dados) : 0;
  const mostrados = dados ? dados.itens.length + dados.enviados.length : 0;

  return (
    <Folha visivel={!!alvo} titulo="Comentários" aoFechar={aoFechar} rodape={escrever}>
      {naoDisponivel ? (
        <Vazio Icone={MessageSquareOff} titulo={textos.indisponivel} texto={textos.saiu} />
      ) : lista.erro ? (
        <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} />
      ) : !dados ? (
        <Esqueleto cartoes={2} texto="Carregando os comentários" />
      ) : mostrados === 0 ? (
        <Vazio Icone={MessageSquare} texto="Ninguém comentou ainda." />
      ) : (
        <View style={estilos.lista}>
          {dados.itens.map((c, i) => linha(c, i > 0))}
          {faltam > 0 ? (
            <View style={[estilos.mais, { borderTopColor: cores.divisor }]}>
              <Texto variante="suave" numerico>{`Mostrando ${mostrados} de ${dados.total} comentários.`}</Texto>
              {maisAqui?.erro ? (
                <MensagemErro texto={textoDoErro(maisAqui.erro)} erro={maisAqui.erro} tentarDeNovo={carregarMais} />
              ) : (
                <LinhaDeAcoes>
                  <Botao rotulo="Carregar mais comentários" tipo="secundario" carregando={!!maisAqui?.carregando} aoTocar={carregarMais} />
                </LinhaDeAcoes>
              )}
            </View>
          ) : null}
          {/* Comentários que o aluno acabou de enviar enquanto faltavam páginas: no fim, onde a API também os põe. */}
          {dados.enviados.map((c, i) => linha(c, i > 0 || dados.itens.length > 0))}
        </View>
      )}

      {/* Dentro da folha: o painel e o perfil precisam do portal dela para ficar por cima. */}
      <PainelConfirmacao
        visivel={!!remover}
        titulo="Remover o comentário?"
        mensagem={remover ? `O comentário de ${remover.autorNome} sai ${textos.onde} para todos.` : undefined}
        rotuloConfirmar="Remover comentário"
        perigo
        carregando={removendo}
        aoConfirmar={confirmarRemocao}
        aoCancelar={fecharPainel}>
        {erroAoRemover ? <MensagemErro texto={erroAoRemover} /> : null}
      </PainelConfirmacao>
      {aluno ? <FolhaPerfilDoColega autorId={perfilAberto} online={!semInternet} aoFechar={() => setPerfilAberto(null)} /> : null}
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
  // Divisor como entre os comentários: o "Carregar mais" é o fim do trecho já lido.
  mais: { borderTopWidth: 1, paddingTop: espaco(1.5), gap: espaco(1) },
  // O rodapé da folha é uma linha; o bloco de escrever ocupa a largura toda dela.
  escrever: { flexBasis: '100%', flexGrow: 1, gap: espaco(1) },
  contador: { alignSelf: 'flex-end' },
});
