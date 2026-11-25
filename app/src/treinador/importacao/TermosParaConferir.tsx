import { CheckCircle2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { rotuloDaDuvida, trechoDaDuvida } from '../../dominio/importacaoAssistida';
import type { DecisaoImportacao, DuvidaImportacao } from '../../servicos/importacaoAssistida';
import { espaco, fontes } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Tabela, type ColunaDaTabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';

/** Resposta sendo escrita para uma dúvida (uma por vez). */
export interface EdicaoDoTermo {
  id: string;
  resposta: string;
  salvarDicionario: boolean;
}

/**
 * "Termos para conferir" (25/11): uma linha compacta por termo (Tipo · Termo · Trecho · Ocorrências · ação) na `Tabela`,
 * que vira cartões abaixo de 760 px. Corrigir abre, embaixo da própria linha, as sugestões do catálogo, o campo e o
 * "Lembrar nas próximas importações"; resolvida mostra o que ficou, com Alterar e Revogar.
 */
export function TermosParaConferir({ duvidas, decisoes, edicao, salvando, revogando, aoEditar, aoMudarResposta, aoMudarDicionario, aoSalvar, aoCancelar, aoRevogar }: {
  duvidas: readonly DuvidaImportacao[];
  decisoes: ReadonlyMap<string, DecisaoImportacao>;
  edicao: EdicaoDoTermo | null;
  salvando: boolean;
  revogando: boolean;
  aoEditar: (d: DuvidaImportacao, resposta: string, referenciaId: string | null) => void;
  aoMudarResposta: (texto: string) => void;
  aoMudarDicionario: (valor: boolean) => void;
  aoSalvar: () => void;
  aoCancelar: () => void;
  aoRevogar: (decisao: DecisaoImportacao) => void;
}) {
  const colunas: ColunaDaTabela<DuvidaImportacao>[] = [
    {
      chave: 'tipo', titulo: 'Tipo', largura: 200,
      render: (d) => (
        <View style={estilos.celula}>
          <Texto>{rotuloDaDuvida(d.tipo)}</Texto>
          <Selo texto={d.resolvida ? 'Resolvida' : 'Conferir'} tipo={d.resolvida ? 'sucesso' : 'atencao'} />
        </View>
      ),
    },
    {
      chave: 'termo', titulo: 'Termo', flex: 1, minimo: 90, principal: true,
      render: (d) => (
        <View style={estilos.celula}>
          <Texto style={estilos.termo}>{d.termoOriginal}</Texto>
          {d.resolvida ? <Texto variante="suave">Ficou como: {d.respostaEscolhida ?? '—'}</Texto> : null}
        </View>
      ),
    },
    { chave: 'trecho', titulo: 'Trecho', flex: 2, minimo: 100, render: (d) => <Texto variante="suave" numberOfLines={2}>{trechoDaDuvida(d)}</Texto> },
    {
      chave: 'ocorrencias', titulo: 'Ocorrências', largura: 100, alinhar: 'direita',
      render: (d) => <Texto numerico>{String(d.ocorrenciaIds?.length ?? d.ocorrencias)}</Texto>,
    },
    {
      chave: 'acao', titulo: 'Ação', largura: 170, acao: true, alinhar: 'direita',
      render: (d) => {
        // Na linha em edição os botões ficam embaixo (Salvar e Cancelar), para não haver dois caminhos ao mesmo tempo.
        if (edicao?.id === d.id) return null;
        if (!d.resolvida) {
          return (
            <View style={estilos.acoes}>
              <Botao rotulo="Corrigir o termo" rotuloAcessivel={`Corrigir o termo ${d.termoOriginal}`} tipo="secundario" aoTocar={() => aoEditar(d, d.termoOriginal, null)} />
            </View>
          );
        }
        const decisao = decisoes.get(d.id);
        return (
          <View style={estilos.acoes}>
            <Botao rotulo="Alterar resposta" rotuloAcessivel={`Alterar a resposta de ${d.termoOriginal}`} tipo="secundario"
              aoTocar={() => aoEditar(d, d.respostaEscolhida ?? d.termoOriginal, decisao?.referenciaId ?? null)} />
            {decisao ? <Botao rotulo="Revogar" rotuloAcessivel={`Revogar a resposta de ${d.termoOriginal}`} tipo="fantasma" carregando={revogando} aoTocar={() => aoRevogar(decisao)} /> : null}
          </View>
        );
      },
    },
  ];

  const emEdicao = edicao ? duvidas.find((d) => d.id === edicao.id) : undefined;
  return (
    <Tabela
      rotulo="Termos para conferir"
      larguraMinima={760}
      vao={espaco(2)}
      alinharLinhas="topo"
      linhas={duvidas}
      chave={(d) => d.id}
      colunas={colunas}
      // Só a linha em edição tem detalhe: as outras ficam com a altura de uma linha.
      detalhe={emEdicao && edicao ? (d) => (d.id === emEdicao.id ? (
        <View style={estilos.edicao}>
          {d.sugestoes?.length ? (
            <View style={estilos.bloco}>
              <Texto variante="rotulo">Sugestões do catálogo</Texto>
              <LinhaDeAcoes>
                {d.sugestoes.map((sug) => (
                  <Botao
                    key={`${sug.termo}-${sug.referenciaId ?? ''}`}
                    rotulo={sug.nota != null ? `${sug.termo} (${Math.round(sug.nota * 100)}%)` : sug.termo}
                    tipo="secundario"
                    aoTocar={() => aoEditar(d, sug.termo, sug.referenciaId ?? null)}
                  />
                ))}
              </LinhaDeAcoes>
            </View>
          ) : null}
          <Campo rotulo="Nome correto do exercício ou alimento" valor={edicao.resposta} aoMudar={aoMudarResposta} />
          <Interruptor rotulo="Lembrar nas próximas importações" ajuda="Fica no dicionário da consultoria." valor={edicao.salvarDicionario} aoMudar={aoMudarDicionario} />
          <LinhaDeAcoes>
            <Botao rotulo="Salvar resposta" tipo="primario" Icone={CheckCircle2} carregando={salvando}
              desabilitado={!edicao.resposta.trim()} motivo="Escreva o nome correto." aoTocar={aoSalvar} />
            <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={aoCancelar} />
          </LinhaDeAcoes>
        </View>
      ) : null) : undefined}
    />
  );
}

const estilos = StyleSheet.create({
  celula: { gap: espaco(0.5), alignItems: 'flex-start' },
  termo: { fontFamily: fontes.medio },
  acoes: { gap: espaco(1), alignItems: 'flex-end' },
  // O campo não estica na linha de ~1200 px: o nome de um exercício cabe com folga em 640.
  edicao: { maxWidth: 640, gap: espaco(2), paddingTop: espaco(1), paddingBottom: espaco(1) },
  bloco: { gap: espaco(1) },
});
