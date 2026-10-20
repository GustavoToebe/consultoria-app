import * as rotas from '../api/rotas';
import { dataParaTela } from '../dominio/formatos';
import { Cabecalho } from './Cabecalho';
import { Carregando, MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { Tela } from './Tela';
import { TextosDosTermos } from './TextosDosTermos';
import { useCarregar } from './useCarregar';

/** Largura da coluna de leitura (a mesma do aluno). */
const LARGURA_LEITURA = 720;

/**
 * Releitura do termo de uso e do aviso de privacidade (já aceitos), nas duas áreas. Coluna de 720 px também no PC:
 * texto corrido com linhas de mais de 150 letras cansa a leitura. A seta de voltar vem do `Cabecalho` (origem: Perfil
 * ou Conta).
 */
export function TelaDosTermos() {
  const termos = useCarregar('termos', () => rotas.termos());
  return (
    <Tela bordas={['top']} largura={LARGURA_LEITURA}>
      <Cabecalho titulo="Termos e privacidade"
        subtitulo={termos.dados ? `Versão de ${dataParaTela(termos.dados.versao)}${termos.dados.aceito ? ', aceita por você.' : '.'}` : undefined} />
      {termos.erro ? (
        <MensagemErro texto={textoDoErro(termos.erro)} erro={termos.erro} tentarDeNovo={termos.recarregar} />
      ) : !termos.dados ? (
        <Carregando />
      ) : (
        <TextosDosTermos termos={termos.dados} />
      )}
    </Tela>
  );
}
