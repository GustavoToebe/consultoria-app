import { LARGURA_LISTA } from '../../../tema/tokens';
import { DicionarioDaImportacao } from '../../../treinador/importacao/DicionarioDaImportacao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';

/** Dicionário da consultoria (item do hub de Configurações, grupo Dados): os termos que a importação assistida aprendeu. */
export default function DicionarioDaImportacaoTela() {
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Dicionário da importação"
        descricao="Os nomes de exercícios e alimentos que a importação assistida aprendeu com as suas respostas. Remova o que estiver errado: a próxima importação volta a perguntar."
      />
      <DicionarioDaImportacao />
    </Tela>
  );
}
