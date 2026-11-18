import { useState } from 'react';

import { ErroApi } from '../../api/cliente';
import { alterarAula, criarAula } from '../../api/comunidade';
import type { AulaDaComunidade } from '../../api/comunidadeTipos';
import { CampoDaCapa } from '../../comunidade/CampoDaCapa';
import {
  AULA_DESCRICAO_MAXIMA, AULA_TITULO_MAXIMO, corpoDaAula, errosDaAula, RASCUNHO_DA_AULA_VAZIO, type RascunhoDaAula, rascunhoDaAula,
} from '../../dominio/comunidade';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { separarErros } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';

/** Teto do link na API (`CriarAulaRequest.videoUrl`). */
const LINK_MAXIMO = 500;
// shortcut: ainda sem o campo da coleção (passo 8); o `playlistId` vai como está no rascunho e o erro dele (raro) vai ao rodapé.
const CAMPOS_NA_TELA = ['titulo', 'videoUrl', 'descricao', 'capaId'];

interface Props {
  visivel: boolean;
  /**
   * Ausente = "Novo aulão"; presente = editar esta aula (o `PUT` reenvia publicada e a coleção dela; a capa é a do rascunho, e
   * sem ela o `PUT` a apaga).
   */
  original?: AulaDaComunidade;
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
export function FolhaDoAulao({ visivel, original, aoFechar, aoSalvar, aoSumir }: Props) {
  const [r, setR] = useState<RascunhoDaAula>(() => (original ? rascunhoDaAula(original) : RASCUNHO_DA_AULA_VAZIO));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Erro que a API apontou no campo (422); some quando o campo muda.
  const [errosApi, setErrosApi] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const erros = errosDaAula(r);
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
      if (original) await alterarAula(original.id, corpoDaAula(r, original));
      else await criarAula(corpoDaAula(r));
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
