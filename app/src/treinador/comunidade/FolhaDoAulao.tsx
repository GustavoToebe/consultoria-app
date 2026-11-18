import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { alterarAula, criarAula } from '../../api/comunidade';
import type { AulaDaComunidade, PlaylistDaComunidade } from '../../api/comunidadeTipos';
import { CampoDaCapa } from '../../comunidade/CampoDaCapa';
import {
  AULA_DESCRICAO_MAXIMA, AULA_TITULO_MAXIMO, corpoDaAula, errosDaAula, playlistsEmOrdem, RASCUNHO_DA_AULA_VAZIO, type RascunhoDaAula,
  rascunhoDaAula, SEM_COLECAO, TEXTO_CRIE_EM_COLECOES,
} from '../../dominio/comunidade';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { separarErros } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Folha } from '../../ui/Folha';
import { espaco } from '../../tema/tokens';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

/** Teto do link na API (`CriarAulaRequest.videoUrl`). */
const LINK_MAXIMO = 500;
const CAMPOS_NA_TELA = ['titulo', 'videoUrl', 'playlistId', 'descricao', 'capaId'];
/** Acima disso a lista da coleção abre com busca. */
const COLECOES_SEM_BUSCA = 8;

interface Props {
  visivel: boolean;
  /**
   * Ausente = "Novo vídeo"; presente = editar esta aula (o `PUT` reenvia publicada e a coleção dela; a capa é a do rascunho, e
   * sem ela o `PUT` a apaga).
   */
  original?: AulaDaComunidade;
  /** As coleções da tela, para escolher (D17: o formulário não cria); `undefined` = não carregaram. */
  colecoes: readonly PlaylistDaComunidade[] | undefined;
  aoFechar: () => void;
  aoSalvar: () => void;
  /** 404 na edição: a aula saiu enquanto a folha estava aberta. */
  aoSumir?: () => void;
}

/**
 * Formulário do aulão (P1/P2 da 4.6), o mesmo para criar e editar: corpo rolável, rodapé fixo Cancelar + uma ação
 * primária, erro no campo e o que não tem campo no status do rodapé (o aviso da tela fica atrás do véu do Modal). Quem
 * cria mantém a folha montada (o rascunho sobrevive ao Cancelar); quem edita monta com `key` da aula.
 */
export function FolhaDoAulao({ visivel, original, colecoes, aoFechar, aoSalvar, aoSumir }: Props) {
  const [r, setR] = useState<RascunhoDaAula>(() => (original ? rascunhoDaAula(original) : RASCUNHO_DA_AULA_VAZIO));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Erro que a API apontou no campo (422); some quando o campo muda.
  const [errosApi, setErrosApi] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const erros = errosDaAula(r);
  // A coleção que sumiu enquanto a folha de criar estava montada vale como "Sem coleção", derivado e sem estado a corrigir.
  // Na edição fica a da aula (mesmo sem a lista): trocar de coleção é escolha da pessoa, nunca do app.
  const sumiu = !original && !!r.playlistId && !!colecoes && !colecoes.some((p) => p.id === r.playlistId);
  const rascunho = sumiu ? { ...r, playlistId: null } : r;
  const opcoesDeColecao = [{ valor: '', rotulo: SEM_COLECAO }, ...playlistsEmOrdem(colecoes ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))];
  const mudar = (campo: 'titulo' | 'link' | 'descricao', chaveDaApi: string) => (valor: string) => {
    setR((atual) => ({ ...atual, [campo]: valor }));
    setErrosApi((a) => (chaveDaApi in a ? Object.fromEntries(Object.entries(a).filter(([k]) => k !== chaveDaApi)) : a));
  };

  const fechar = () => {
    setTentou(false);
    setErrosApi({});
    setErroGeral(null);
    aoFechar();
  };

  const salvar = async () => {
    setTentou(true);
    if (erros.titulo || erros.link || salvando) return;
    setSalvando(true);
    setErroGeral(null);
    try {
      if (original) await alterarAula(original.id, corpoDaAula(rascunho, original));
      else await criarAula(corpoDaAula(rascunho));
      setTentou(false);
      setErrosApi({});
      if (!original) setR(RASCUNHO_DA_AULA_VAZIO);
      aoSalvar();
    } catch (e) {
      if (original && e instanceof ErroApi && e.status === 404 && aoSumir) { aoSumir(); return; }
      const { campos, geral } = separarErros(e, CAMPOS_NA_TELA);
      setErrosApi(campos);
      setErroGeral(geral);
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
          <Botao rotulo={original ? 'Salvar alterações' : 'Publicar para o time'} tipo="primario" carregando={salvando}
            aoTocar={() => void salvar()} />
        </LinhaDeAcoes>
      }>
      <Campo rotulo="Título" placeholder="Ex.: Vídeo sobre progressão de carga" valor={r.titulo} maxLength={AULA_TITULO_MAXIMO}
        aoMudar={mudar('titulo', 'titulo')} erro={(tentou && erros.titulo) || errosApi.titulo || undefined} />
      <Campo rotulo="Link do vídeo" placeholder="https://" valor={r.link} maxLength={LINK_MAXIMO} inputMode="url"
        autoCapitalize="none" autoCorrect={false}
        aoMudar={mudar('link', 'videoUrl')} erro={(tentou && erros.link) || errosApi.videoUrl || undefined} />
      <View style={estilos.colecao}>
        <EscolhaSuspensa<string> rotulo="Coleção" titulo="Coleção do vídeo" valor={rascunho.playlistId ?? ''} opcoes={opcoesDeColecao}
          semBusca={opcoesDeColecao.length <= COLECOES_SEM_BUSCA} rotuloDaBusca="Buscar coleção" textoVazio="Nenhuma coleção encontrada."
          aoMudar={(v) => {
            setR((atual) => ({ ...atual, playlistId: v || null }));
            setErrosApi((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'playlistId')));
          }} />
        {errosApi.playlistId ? <MensagemDeErro erro={errosApi.playlistId} />
          : <Texto variante="pequeno">{colecoes && !colecoes.length ? `Nenhuma coleção ainda. ${TEXTO_CRIE_EM_COLECOES}, no topo da aba Vídeos.`
            : original ? 'Trocar de coleção leva o vídeo para o fim da nova.' : 'O vídeo entra no fim da coleção.'}</Texto>}
      </View>
      <Campo rotulo="Descrição (opcional)" placeholder="O que será abordado e o que o aluno precisa saber" valor={r.descricao}
        maxLength={AULA_DESCRICAO_MAXIMA} aoMudar={mudar('descricao', 'descricao')} linhas={4}
        erro={errosApi.descricao || undefined} />
      <CampoDaCapa capaId={r.capaId} videoUrl={r.link} erro={errosApi.capaId || undefined} aoMudar={(capaId) => {
        setR((atual) => ({ ...atual, capaId }));
        setErrosApi((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'capaId')));
      }} />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  colecao: { gap: espaco(0.5) },
});
