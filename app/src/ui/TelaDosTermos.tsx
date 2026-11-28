import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import * as rotas from '../api/rotas';
import type { DocumentoDeTermos, TermosVigentes } from '../api/tipos';
import { linhaDaVersao, secoesDoDocumento } from '../dominio/termos';
import { imprimir } from '../pdf/imprimir';
import { logoComoDataUri } from '../pdf/logo';
import { documentoTermos } from '../pdf/pdfTermos';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco, fontes, LARGURA_TEXTO_CORRIDO } from '../tema/tokens';
import { Abas } from './Abas';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Cabecalho } from './Cabecalho';
import { Alerta, Carregando, MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { IndiceDosTermos, LARGURA_DO_INDICE } from './IndiceDosTermos';
import { Selo } from './Selo';
import { Tela } from './Tela';
import { Texto } from './Texto';
import { DocumentoDosTermos } from './TextosDosTermos';
import { useAreaDaTela } from './useAreaDaTela';
import { useCarregar } from './useCarregar';

/** Coluna do aluno (a mesma das outras telas da Conta). A equipe usa o contêiner das outras telas de Configurações. */
const LARGURA_DO_ALUNO = 720;
const VAO = espaco(4);
/** Abaixo disto (celular, coluna estreita de Configurações) o índice some e o texto fica sozinho. */
const LARGURA_PARA_O_INDICE = 640 + VAO + LARGURA_DO_INDICE;

const ABAS: { valor: DocumentoDeTermos['id']; rotulo: string }[] = [
  { valor: 'TERMO_USO', rotulo: 'Termo de uso' },
  { valor: 'AVISO_PRIVACIDADE', rotulo: 'Aviso de privacidade' },
];

/**
 * Releitura do termo de uso e do aviso de privacidade (já aceitos), nas duas áreas (28/11): alinhada à esquerda, abas
 * "Termo de uso · Aviso de privacidade", o texto direto na página em ~72 caracteres e, à direita, "Nesta página" com as
 * seções numeradas (some no celular). Abaixo do título, a versão e a data do aceite e o "Baixar PDF". O selo "Rascunho em
 * revisão" e as notas para a revisão do advogado são só da equipe: o aluno nunca vê aviso de rascunho nem nota interna. A seta de voltar vem do `Cabecalho` (origem: Perfil ou Conta).
 */
export function TelaDosTermos() {
  const { usuario } = useSessao();
  const aluno = usuario?.papel === 'ALUNO';
  return (
    <Tela bordas={['top']} largura={aluno ? LARGURA_DO_ALUNO : undefined}>
      <CorpoDosTermos equipe={!aluno} />
    </Tela>
  );
}

/** Dentro da `Tela`: só aqui o `useRolagem` (o toque no índice) e o `useAreaDaTela` (mostrar o índice) enxergam a tela. */
function CorpoDosTermos({ equipe }: { equipe: boolean }) {
  const termos = useCarregar('termos', () => rotas.termos());
  const [aba, setAba] = useState<DocumentoDeTermos['id']>('TERMO_USO');
  const { largura } = useAreaDaTela();
  const documento = termos.dados?.documentos.find((d) => d.id === aba);
  const comIndice = largura >= LARGURA_PARA_O_INDICE;
  return (
    <>
      <Cabecalho titulo="Termos e privacidade" descricao="O termo de uso e o aviso de privacidade que você aceitou para usar o app, para reler quando quiser."
        subtitulo={termos.dados ? linhaDaVersao(termos.dados.versao, termos.dados.aceitoEm) : undefined} />
      {termos.erro ? (
        <MensagemErro texto={textoDoErro(termos.erro)} erro={termos.erro} tentarDeNovo={termos.recarregar} />
      ) : !termos.dados ? (
        <Carregando />
      ) : (
        <>
          <View style={estilos.topo}>
            <BaixarPdf termos={termos.dados} />
            {equipe && termos.dados.rascunho ? <Selo texto="Rascunho em revisão" tipo="atencao" /> : null}
          </View>
          {/* Nota de trabalho para o advogado: a API só a manda à equipe e nunca no texto (nem no PDF, montado do texto). */}
          {equipe && termos.dados.notasInternas?.length ? (
            <View style={estilos.notas}>
              <Alerta tom="atencao" titulo="Notas para a revisão do advogado">
                <Texto>Só a equipe vê estas notas; o aluno, a página pública e o PDF não as mostram.</Texto>
                {termos.dados.notasInternas.map((n, i) => (
                  <Texto key={i}><Texto style={estilos.negrito}>{n.documentoTitulo}:</Texto> {n.texto}</Texto>
                ))}
              </Alerta>
            </View>
          ) : null}
          <Abas abas={ABAS} ativa={aba} aoMudar={setAba} vao={espaco(3)}>
            {!documento ? (
              <MensagemErro texto="Não foi possível carregar o texto." tentarDeNovo={termos.recarregar} />
            ) : (
              <View style={estilos.colunas}>
                <View style={estilos.leitura}>
                  <DocumentoDosTermos key={documento.id} documento={documento} />
                </View>
                {comIndice ? <IndiceDosTermos key={documento.id} secoes={secoesDoDocumento(documento.id, documento.texto)} /> : null}
              </View>
            )}
          </Abas>
        </>
      )}
    </>
  );
}

/** Os dois documentos num PDF, como a tela os mostra. Não depende da funcionalidade `PDF` do plano (é registro do aceite). */
function BaixarPdf({ termos }: { termos: TermosVigentes }) {
  const { marca } = useSessao();
  const { avisar } = useAviso();
  const [gerando, setGerando] = useState(false);
  const baixar = () => {
    if (!marca) return;
    setGerando(true);
    logoComoDataUri(marca)
      .then((logoDataUri) => imprimir(documentoTermos({ marca, logoDataUri, termos, emitidoEm: new Date() })))
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };
  return (
    <Botao rotulo="Baixar PDF" tipo="secundario" Icone={FileDown} carregando={gerando} desabilitado={!marca}
      motivo={marca ? undefined : 'Carregando os dados da consultoria.'} aoTocar={baixar} />
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  notas: { maxWidth: LARGURA_TEXTO_CORRIDO, width: '100%' },
  negrito: { fontFamily: fontes.semi },
  // `flex-start`: sem isso a coluna do índice estica até a altura do texto e o `sticky` não fica parado.
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  // A coluna de leitura para nos ~72 caracteres: o índice fica logo ao lado do texto, não na outra ponta da tela larga.
  leitura: { flex: 1, minWidth: 0, maxWidth: LARGURA_TEXTO_CORRIDO },
});
