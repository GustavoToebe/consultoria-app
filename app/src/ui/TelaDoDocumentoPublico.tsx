import * as rotas from '../api/rotas';
import type { DocumentoDeTermos } from '../api/tipos';
import { dataParaTela } from '../dominio/formatos';
import { Carregando, MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { LinksDosTermos } from './LinksDosTermos';
import { Selo } from './Selo';
import { TelaPublica } from './TelaPublica';
import { DocumentoDosTermos } from './TextosDosTermos';
import { useCarregar } from './useCarregar';

/**
 * Página pública (sem login) de um documento: o aviso de privacidade ou o termo de uso, com o texto que vem da API
 * (`GET /publico/termos`, a mesma fonte da tela logada; nada do texto mora no app). Marca do produto, não da consultoria.
 * O h1 é fixo em todos os estados; erro ou sem rede mostra "Tentar de novo", nunca a tela vazia.
 */
export function TelaDoDocumentoPublico({ id, titulo }: { id: DocumentoDeTermos['id']; titulo: string }) {
  const termos = useCarregar('termos-publicos', () => rotas.termosPublicos());
  const documento = termos.dados?.documentos.find((d) => d.id === id);
  return (
    <TelaPublica titulo={titulo} subtitulo={termos.dados ? `Versão de ${dataParaTela(termos.dados.versao)}.` : undefined}>
      {termos.erro ? (
        <MensagemErro texto={textoDoErro(termos.erro)} erro={termos.erro} tentarDeNovo={termos.recarregar} />
      ) : !termos.dados ? (
        <Carregando texto="Carregando o texto…" />
      ) : !documento ? (
        <MensagemErro texto="Não foi possível carregar o texto." tentarDeNovo={termos.recarregar} />
      ) : (
        <>
          {termos.dados.rascunho ? <Selo texto="Rascunho em revisão" tipo="atencao" /> : null}
          <DocumentoDosTermos documento={documento} />
        </>
      )}
      <LinksDosTermos todas />
    </TelaPublica>
  );
}
