import { CheckCircle2 } from 'lucide-react-native';
import { useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { melhorSugestao, rotuloDaDuvida, trechoDaDuvida } from '../../dominio/importacaoAssistida';
import type { DecisaoImportacao, DuvidaImportacao, SugestaoDuvida } from '../../servicos/importacaoAssistida';
import { espaco, fontes } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Tabela, type ColunaDaTabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { BuscaNaBiblioteca } from './BuscaNaBiblioteca';

/** Resposta sendo escrita para uma dúvida (uma por vez). */
export interface EdicaoDoTermo {
  id: string;
  resposta: string;
  salvarDicionario: boolean;
}

/** Trecho com mais que isto ganha "Ver trecho inteiro" (fechado, duas linhas). */
const TRECHO_CURTO = 80;

/**
 * "Termos para conferir" (25/11; mais rápido em 28/11, 2.4): uma linha por termo (Tipo · Termo · Arquivo · Trecho ·
 * Ocorrências · ação) na `Tabela`, que vira cartões abaixo de 760 px. Na linha, a melhor sugestão é um botão ("Usar
 * Supino reto"), "Manter como está" fica o nome do documento e "Corrigir" abre, embaixo da linha, as sugestões, o campo
 * com busca na biblioteca e o "Lembrar nas próximas importações". Resolvida mostra o que ficou, com Alterar e Desfazer.
 */
export function TermosParaConferir({ duvidas, decisoes, edicao, salvando, respondendo, revogando, pendente, buscaNaBiblioteca, aoEditar, aoMudarResposta, aoMudarDicionario, aoSalvar, aoCancelar, aoResponder, aoRevogar }: {
  duvidas: readonly DuvidaImportacao[];
  /** O botão que recebe o foco ao entrar na tela (T-206): o ref vai só no "Corrigir" desta dúvida. */
  pendente?: { id: string; ref: Ref<View> };
  decisoes: ReadonlyMap<string, DecisaoImportacao>;
  edicao: EdicaoDoTermo | null;
  salvando: boolean;
  /** Dúvida respondida direto da linha ("Usar…" ou "Manter como está"): o carregando gira só nela. */
  respondendo: string | null;
  /** Decisão sendo desfeita: o carregando gira só na linha dela (2.7). */
  revogando: string | null;
  /** Com `BIBLIOTECA_LER`: o campo busca exercícios e alimentos da biblioteca. */
  buscaNaBiblioteca: boolean;
  aoEditar: (d: DuvidaImportacao, resposta: string, referenciaId: string | null) => void;
  aoMudarResposta: (texto: string) => void;
  aoMudarDicionario: (valor: boolean) => void;
  aoSalvar: () => void;
  aoCancelar: () => void;
  /** Resposta de um toque, sem abrir a edição. `null` = manter o termo do documento. */
  aoResponder: (d: DuvidaImportacao, sugestao: SugestaoDuvida | null) => void;
  aoRevogar: (decisao: DecisaoImportacao) => void;
}) {
  const [trechosAbertos, setTrechosAbertos] = useState<ReadonlySet<string>>(new Set());
  const ocupado = salvando || !!respondendo || !!revogando;
  const alternarTrecho = (id: string) => setTrechosAbertos((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });

  const colunas: ColunaDaTabela<DuvidaImportacao>[] = [
    {
      chave: 'tipo', titulo: 'Tipo', largura: 180,
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
    { chave: 'arquivo', titulo: 'Arquivo', flex: 1, minimo: 90, render: (d) => <Texto variante="suave">{d.arquivoOrigem?.trim() || '—'}</Texto> },
    {
      chave: 'trecho', titulo: 'Trecho', flex: 2, minimo: 100,
      render: (d) => {
        const trecho = trechoDaDuvida(d);
        const aberto = trechosAbertos.has(d.id);
        return (
          <View style={estilos.celula}>
            <Texto variante="suave" numberOfLines={aberto ? undefined : 2}>{trecho}</Texto>
            {trecho.length > TRECHO_CURTO ? (
              <Botao rotulo={aberto ? 'Ver menos' : 'Ver trecho inteiro'} rotuloAcessivel={`${aberto ? 'Ver menos do' : 'Ver o'} trecho de ${d.termoOriginal}`}
                tipo="fantasma" tamanho="pequeno" aoTocar={() => alternarTrecho(d.id)} />
            ) : null}
          </View>
        );
      },
    },
    {
      chave: 'ocorrencias', titulo: 'Ocorrências', largura: 100, alinhar: 'direita',
      render: (d) => <Texto numerico>{String(d.ocorrenciaIds?.length ?? d.ocorrencias)}</Texto>,
    },
    {
      chave: 'acao', titulo: 'Ação', largura: 220, acao: true, alinhar: 'direita',
      render: (d) => {
        // Na linha em edição os botões ficam embaixo (Salvar e Cancelar), para não haver dois caminhos ao mesmo tempo.
        if (edicao?.id === d.id) return null;
        if (!d.resolvida) {
          const melhor = melhorSugestao(d);
          return (
            <View style={estilos.acoes}>
              {melhor ? (
                <Botao rotulo={`Usar ${melhor.termo}`} rotuloAcessivel={`Usar ${melhor.termo} para ${d.termoOriginal}`} tipo="secundario"
                  carregando={respondendo === d.id} desabilitado={ocupado && respondendo !== d.id} motivo="Aguarde a resposta em andamento."
                  aoTocar={() => aoResponder(d, melhor)} />
              ) : null}
              <Botao ref={pendente?.id === d.id ? pendente.ref : undefined} rotulo="Corrigir o termo" rotuloAcessivel={`Corrigir o termo ${d.termoOriginal}`}
                tipo={melhor ? 'fantasma' : 'secundario'} desabilitado={ocupado} motivo="Aguarde a resposta em andamento."
                aoTocar={() => aoEditar(d, d.termoOriginal, null)} />
              <Botao rotulo="Manter como está" rotuloAcessivel={`Manter ${d.termoOriginal} como está no documento`} tipo="fantasma"
                desabilitado={ocupado} motivo="Aguarde a resposta em andamento." aoTocar={() => aoResponder(d, null)} />
            </View>
          );
        }
        const decisao = decisoes.get(d.id);
        return (
          <View style={estilos.acoes}>
            <Botao rotulo="Alterar resposta" rotuloAcessivel={`Alterar a resposta de ${d.termoOriginal}`} tipo="secundario" desabilitado={ocupado}
              motivo="Aguarde a resposta em andamento." aoTocar={() => aoEditar(d, d.respostaEscolhida ?? d.termoOriginal, decisao?.referenciaId ?? null)} />
            {decisao ? (
              <Botao rotulo="Desfazer resposta" rotuloAcessivel={`Desfazer a resposta de ${d.termoOriginal}`} tipo="fantasma"
                carregando={revogando === decisao.decisaoId} desabilitado={ocupado && revogando !== decisao.decisaoId}
                motivo="Aguarde a resposta em andamento." aoTocar={() => aoRevogar(decisao)} />
            ) : null}
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
              <Texto variante="rotulo">Sugestões</Texto>
              <LinhaDeAcoes>
                {d.sugestoes.map((sug) => (
                  <Botao key={`${sug.termo}-${sug.referenciaId ?? ''}`} rotulo={sug.termo} tipo="secundario"
                    aoTocar={() => aoEditar(d, sug.termo, sug.referenciaId ?? null)} />
                ))}
              </LinhaDeAcoes>
            </View>
          ) : null}
          <Campo rotulo="Nome correto do exercício ou alimento" valor={edicao.resposta} aoMudar={aoMudarResposta} />
          {buscaNaBiblioteca ? <BuscaNaBiblioteca tipo={d.tipo} texto={edicao.resposta} aoEscolher={(nome, id) => aoEditar(d, nome, id)} /> : null}
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
