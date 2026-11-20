import { useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { alterarAula, criarAula } from '../../api/comunidade';
import type { AulaDaComunidade, PlaylistDaComunidade } from '../../api/comunidadeTipos';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import {
  aulaAlterada, AULA_DESCRICAO_MAXIMA, AULA_TITULO_MAXIMO, corpoDaAula, errosDaAula, linkTravaOEnvio, playlistsEmOrdem, type RascunhoDaAula,
  rascunhoInicialDaAula, SEM_COLECAO, TEXTO_CRIE_EM_COLECOES,
} from '../../dominio/comunidade';
import { useSessao } from '../../sessao/SessaoProvider';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { focarPrimeiroComErro, separarErros } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Folha } from '../../ui/Folha';
import { espaco } from '../../tema/tokens';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { CapaDoAulao, useCapaDoAulao } from './CapaDoAulao';

/** Teto do link na API (`CriarAulaRequest.videoUrl`). */
const LINK_MAXIMO = 500;
const CAMPOS_NA_TELA = ['titulo', 'videoUrl', 'playlistId', 'descricao', 'capaId'];
/** Acima disso a lista da coleção abre com busca. */
const COLECOES_SEM_BUSCA = 8;
const SEM_INTERNET = 'Sem conexão: publicar precisa de internet.';

interface Props {
  visivel: boolean;
  /**
   * Ausente = "Novo vídeo"; presente = editar esta aula (o `PUT` reenvia publicada e a coleção dela; a capa é a do rascunho, e
   * sem ela o `PUT` a apaga).
   */
  original?: AulaDaComunidade;
  /** As coleções da tela, para escolher (D17: o formulário não cria); `undefined` = não carregaram. */
  colecoes: readonly PlaylistDaComunidade[] | undefined;
  /**
   * Coleção já escolhida ao abrir um vídeo NOVO (o "Adicionar vídeo" do cabeçalho da coleção); ignorada ao editar. Lida só
   * ao montar (a folha nasce a cada abertura). Se a coleção não existir mais, vale "Sem coleção" (a mesma regra do `sumiu`).
   */
  colecaoInicialId?: string | null;
  aoFechar: () => void;
  aoSalvar: () => void;
  /** 404 na edição: a aula saiu enquanto a folha estava aberta. */
  aoSumir?: () => void;
}

/**
 * Formulário do vídeo (P1/P2 da 4.6; ordem do D4 de 19/11), o mesmo para criar e editar: Link do vídeo primeiro, a capa logo
 * abaixo (com link do YouTube ela vem sozinha, `CapaDoAulao`), depois Título, Coleção e Descrição. Corpo rolável, rodapé
 * fixo Cancelar + uma ação primária ("Publicar" / "Salvar"), erro no campo e o que não tem campo no status do rodapé (o
 * aviso da tela fica atrás do véu do Modal). Monta a cada abertura; fechar com alteração pergunta "Sair sem salvar?" e
 * sair apaga o rascunho (D1).
 */
export function FolhaDoAulao({ visivel, original, colecoes, colecaoInicialId, aoFechar, aoSalvar, aoSumir }: Props) {
  const { offline } = useSessao();
  const [inicial] = useState(() => rascunhoInicialDaAula(original, colecaoInicialId));
  const [r, setR] = useState<RascunhoDaAula>(inicial);
  const [tentou, setTentou] = useState(false);
  // O erro de formato do link aparece ao sair do campo (e daí em diante acompanha a digitação); o de vazio, só ao enviar.
  const [saiuDoLink, setSaiuDoLink] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Erro que a API apontou no campo (422); some quando o campo muda.
  const [errosApi, setErrosApi] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const linkRef = useRef<TextInput>(null);
  const tituloRef = useRef<TextInput>(null);

  const semErroApi = (chave: string) =>
    setErrosApi((a) => (chave in a ? Object.fromEntries(Object.entries(a).filter(([k]) => k !== chave)) : a));
  const capa = useCapaDoAulao({
    original, link: r.link, capaId: r.capaId, online: !offline,
    mudarCapa: (capaId) => { setR((atual) => ({ ...atual, capaId })); semErroApi('capaId'); },
  });

  const erros = errosDaAula(r);
  const erroDoLink = (tentou || (saiuDoLink && !!r.link.trim()) ? erros.link : null) || errosApi.videoUrl || null;
  const erroDoTitulo = (tentou && erros.titulo) || errosApi.titulo || undefined;
  // A coleção que sumiu enquanto a folha de criar estava montada vale como "Sem coleção", derivado e sem estado a corrigir.
  // Na edição fica a da aula (mesmo sem a lista): trocar de coleção é escolha da pessoa, nunca do app.
  const sumiu = !original && !!r.playlistId && !!colecoes && !colecoes.some((p) => p.id === r.playlistId);
  const rascunho = sumiu ? { ...r, playlistId: null } : r;
  const opcoesDeColecao = [{ valor: '', rotulo: SEM_COLECAO }, ...playlistsEmOrdem(colecoes ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))];
  const mudar = (campo: 'titulo' | 'descricao', chaveDaApi: string) => (valor: string) => {
    setR((atual) => ({ ...atual, [campo]: valor }));
    semErroApi(chaveDaApi);
  };
  const mudarLink = (link: string) => {
    setR((atual) => ({ ...atual, link }));
    semErroApi('videoUrl');
    capa.aoMudarOLink(link);
  };

  // Sair zera tudo (a folha também nasce de novo a cada abertura, em `FolhasDosVideos`): a próxima abre como a primeira.
  const descartar = () => {
    setR(inicial);
    setTentou(false);
    setSaiuDoLink(false);
    setErrosApi({});
    setErroGeral(null);
    aoFechar();
  };
  const { fechar, aviso } = useFecharComAviso(visivel, aulaAlterada(r, inicial), descartar);

  // Publicar desativado só pelo que a pessoa vê o porquê: sem internet, link inválido (erro sob o campo) ou capa a caminho.
  const motivo = offline ? SEM_INTERNET
    : linkTravaOEnvio(r.link) ? 'Corrija o link do vídeo.'
      : capa.ocupada ? 'Espere a capa terminar de carregar.' : null;

  const salvar = async () => {
    setTentou(true);
    if (salvando || motivo) return;
    if (erros.link || erros.titulo) {
      focarPrimeiroComErro({ link: erros.link ?? '', titulo: erros.titulo ?? '' }, [['link', linkRef], ['titulo', tituloRef]]);
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    try {
      if (original) await alterarAula(original.id, corpoDaAula(rascunho, original));
      else await criarAula(corpoDaAula(rascunho));
      setTentou(false);
      setErrosApi({});
      if (!original) setR(inicial);
      aoSalvar();
    } catch (e) {
      if (original && e instanceof ErroApi && e.status === 404 && aoSumir) { aoSumir(); return; }
      const { campos, geral } = separarErros(e, CAMPOS_NA_TELA);
      setErrosApi(campos);
      setErroGeral(geral);
      focarPrimeiroComErro({ link: campos.videoUrl ?? '', titulo: campos.titulo ?? '' }, [['link', linkRef], ['titulo', tituloRef]]);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Folha
      visivel={visivel}
      titulo={original ? 'Editar vídeo' : 'Novo vídeo'}
      aoFechar={fechar}
      statusDoRodape={erroGeral ? <MensagemErro texto={erroGeral} /> : undefined}
      rodape={
        <LinhaDeAcoes>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
          <Botao rotulo={original ? 'Salvar' : 'Publicar'} tipo="primario" carregando={salvando} desabilitado={!!motivo}
            motivo={motivo ?? undefined} aoTocar={() => void salvar()} />
        </LinhaDeAcoes>
      }>
      <Campo ref={linkRef} rotulo="Link do vídeo" placeholder="https://www.youtube.com/watch?v=…" valor={r.link} maxLength={LINK_MAXIMO}
        inputMode="url" autoCapitalize="none" autoCorrect={false} ajuda="Link https. Do YouTube, a capa vem sozinha."
        aoMudar={mudarLink} onBlur={() => setSaiuDoLink(true)} erro={erroDoLink} />
      {r.link.trim() || r.capaId ? <CapaDoAulao {...capa.campo} erroDaApi={errosApi.capaId} /> : null}
      <Campo ref={tituloRef} rotulo="Título" placeholder="Ex.: Vídeo sobre progressão de carga" valor={r.titulo}
        maxLength={AULA_TITULO_MAXIMO} aoMudar={mudar('titulo', 'titulo')} erro={erroDoTitulo} />
      <View style={estilos.colecao}>
        <EscolhaSuspensa<string> rotulo="Coleção" titulo="Coleção do vídeo" valor={rascunho.playlistId ?? ''} opcoes={opcoesDeColecao}
          semBusca={opcoesDeColecao.length <= COLECOES_SEM_BUSCA} rotuloDaBusca="Buscar coleção" textoVazio="Nenhuma coleção encontrada."
          aoMudar={(v) => {
            setR((atual) => ({ ...atual, playlistId: v || null }));
            semErroApi('playlistId');
          }} />
        {errosApi.playlistId ? <MensagemDeErro erro={errosApi.playlistId} />
          : <Texto variante="pequeno">{colecoes && !colecoes.length ? `Nenhuma coleção ainda. ${TEXTO_CRIE_EM_COLECOES}`
            : original ? 'Trocar de coleção leva o vídeo para o fim da nova.' : 'Entra no fim da coleção.'}</Texto>}
      </View>
      <Campo rotulo="Descrição (opcional)" placeholder="O que será abordado e o que o aluno precisa saber" valor={r.descricao}
        maxLength={AULA_DESCRICAO_MAXIMA} aoMudar={mudar('descricao', 'descricao')} linhas={4}
        erro={errosApi.descricao || undefined} />
      {aviso}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  colecao: { gap: espaco(0.5) },
});
