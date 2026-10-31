import { LARGURA_LISTA } from '../../../tema/tokens';
import { TelaImportacao } from '../../../treinador/importacao/TelaImportacao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';

/** Importação de planilha: prévia, confirmação e histórico. O arquivo não fica guardado. */
export default function Importacao() {
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo="Importação" subtitulo="Alunos, pesos, exercícios, alimentos, suplementos e outros. O arquivo não fica guardado." />
      <TelaImportacao />
    </Tela>
  );
}
