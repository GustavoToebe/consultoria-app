import { useState } from 'react';

import { copiarPlanoParaAluno } from '../api/rotas';
import type { PlanoResumo, TipoPlano } from '../api/tipos';
import { dataDaTela } from '../dominio/formatos';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';
import { EscolhaDeAlunoEPasta, useEscolhaDeAlunoEPasta } from './EscolhaDeAlunoEPasta';

const DO_TIPO: Record<TipoPlano, string> = { treino: 'do treino', dieta: 'da dieta', mobilidade: 'da mobilidade' };

/**
 * Copia um plano para outro aluno: rascunho novo, com o conteúdo da última versão publicada (o rascunho, se nunca foi
 * publicado), numa pasta existente do destino ou numa pasta nova. O plano de origem não muda. Na dieta, medicação e
 * ergogênicos nunca vão. Quem renderiza já checou a permissão de alterar o tipo e `ALUNO_LER`.
 */
export function CopiarParaAluno({ tipo, plano, aoFechar, aoCopiar }: {
  tipo: TipoPlano; plano: PlanoResumo; aoFechar: () => void; aoCopiar: (alunoId: string, nomeDoAluno: string | null) => void;
}) {
  const escolha = useEscolhaDeAlunoEPasta({ excluirAlunoId: plano.alunoId });
  const { alunoId, destino } = escolha;
  const [titulo, setTitulo] = useState(plano.titulo);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const copiar = async () => {
    setErro(null);
    setSalvando(true);
    try {
      await copiarPlanoParaAluno(tipo, plano.id, { alunoId, pastaId: destino || null, titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null });
      aoCopiar(alunoId, escolha.nomeDoAluno);
    } catch (e) {
      setErro(e);
      setSalvando(false);
    }
  };
  const motivo =
    escolha.motivo ??
    (!titulo.trim() ? 'Informe o título.' : !destino && (ini === undefined || fi === undefined) ? 'Confira as datas.' : !destino && !!ini && !!fi && ini > fi ? 'O fim precisa ser depois do início.' : undefined);
  return (
    <Folha visivel titulo="Copiar para outro aluno" aoFechar={aoFechar} rodape={<Botao rotulo="Copiar para o aluno" aoTocar={() => void copiar()} carregando={salvando} desabilitado={!!motivo} motivo={motivo} />}>
      <Texto variante="suave">
        Cria um rascunho novo para o aluno escolhido, com o conteúdo {plano.versaoPublicada > 0 ? `publicado (v${plano.versaoPublicada})` : 'atual'} {DO_TIPO[tipo]} “{plano.titulo}”. O plano de origem continua igual.
        {tipo === 'dieta' ? ' Medicação e ergogênicos não são copiados.' : ''}
      </Texto>
      <EscolhaDeAlunoEPasta escolha={escolha} />
      <Campo rotulo={destino ? 'Título do plano' : 'Título da nova pasta / plano'} valor={titulo} aoMudar={setTitulo} maxLength={120} />
      {!destino ? (
        <>
          <CampoData rotulo="Início (opcional)" valor={inicio} aoMudar={setInicio} />
          <CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} />
        </>
      ) : (
        <Texto variante="pequeno">O período será o da pasta selecionada.</Texto>
      )}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}
