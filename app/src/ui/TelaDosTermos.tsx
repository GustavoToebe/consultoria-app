import * as rotas from '../api/rotas';
import { LARGURA_EDITOR } from '../tema/tokens';
import { Cabecalho } from './Cabecalho';
import { Carregando, MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { Tela } from './Tela';
import { TextosDosTermos } from './TextosDosTermos';
import { Texto } from './Texto';
import { useCarregar } from './useCarregar';

/** Releitura do termo de uso e do aviso de privacidade (já aceitos), nas duas áreas. */
export function TelaDosTermos({ publico }: { publico: 'treinador' | 'aluno' }) {
  const termos = useCarregar('termos', () => rotas.termos());
  return (
    <Tela bordas={['top']} largura={publico === 'aluno' ? 720 : LARGURA_EDITOR}>
      <Cabecalho titulo="Termos e privacidade" mostrarMarca={publico === 'aluno' ? 'sempre' : 'celular'} />
      {termos.erro ? (
        <MensagemErro texto={textoDoErro(termos.erro)} erro={termos.erro} tentarDeNovo={termos.recarregar} />
      ) : !termos.dados ? (
        <Carregando />
      ) : (
        <>
          <Texto variante="suave">Versão {termos.dados.versao}{termos.dados.aceito ? ', aceita por você.' : '.'}</Texto>
          <TextosDosTermos termos={termos.dados} />
        </>
      )}
    </Tela>
  );
}
