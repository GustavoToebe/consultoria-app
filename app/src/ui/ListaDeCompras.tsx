import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../api/tipos';
import {
  listaDeCompras,
  marcaSemFator,
  NOTA_DA_LISTA_ALUNO,
  NOTA_DA_LISTA_TREINADOR,
  PERIODOS_DA_LISTA,
  quantidadeParaTela,
  refeicoesComEscolha,
  ROTULO_DO_PERIODO,
  textosDasOpcoes,
  tituloDaLista,
  type EscolhasDeOpcao,
  type LinhaDaLista,
  type PeriodoDaLista,
} from '../dominio/listaDeCompras';
import { espaco, fontes } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Cartao } from './Cartao';
import { Escolha } from './Escolha';
import { Vazio } from './Estados';
import { textoDoErro } from './erros';
import { NoPlano } from './NoPlano';
import { Selo } from './Selo';
import { Tabela, type ColunaDaTabela } from './Tabela';
import { Texto } from './Texto';

const PERIODOS = PERIODOS_DA_LISTA.map((valor) => ({ valor, rotulo: ROTULO_DO_PERIODO[valor] }));

/** Período e, quando a refeição tem mais de uma opção, qual entra na lista. A folha do PDF da dieta usa o mesmo controle. */
export function EscolhasDaLista({
  conteudo,
  periodo,
  aoMudarPeriodo,
  escolhas,
  aoMudarEscolhas,
}: {
  conteudo: ConteudoDieta;
  periodo: PeriodoDaLista;
  aoMudarPeriodo: (periodo: PeriodoDaLista) => void;
  escolhas: EscolhasDeOpcao;
  aoMudarEscolhas: (escolhas: EscolhasDeOpcao) => void;
}) {
  const comEscolha = refeicoesComEscolha(conteudo);
  const opcaoDe = (r: (typeof comEscolha)[number]) => r.opcoes.find((o) => o.uid === escolhas[r.uid]) ?? r.opcoes[0];
  return (
    <>
      <Escolha descricao="Período da lista" opcoes={PERIODOS} valor={periodo} aoMudar={aoMudarPeriodo} />
      {comEscolha.length ? (
        <View style={estilos.opcoes}>
          <Texto variante="suave">Nas refeições com mais de uma opção, escolha a que vai comprar.</Texto>
          {comEscolha.map((r) => (
            <Escolha
              key={r.uid}
              rotulo={`${r.horario ? `${r.horario} · ` : ''}${r.nome || 'Refeição'}`}
              opcoes={r.opcoes.map((o) => ({ valor: o.uid, rotulo: `Opção ${o.rotulo}` }))}
              valor={opcaoDe(r)?.uid ?? ''}
              aoMudar={(uid) => aoMudarEscolhas({ ...escolhas, [r.uid]: uid })}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

/**
 * Alimento e quantidade. A quantidade é coluna de "ação" da `Tabela`: no celular fica no canto do cartão, sem o rótulo
 * "Quantidade" repetido em cada item. Item sem fator diz isso (aluno: "(como na dieta)"; treinador: selo "Sem fator"),
 * para não parecer peso cru.
 */
function colunas(papel: 'aluno' | 'treinador'): ColunaDaTabela<LinhaDaLista>[] {
  return [
    { chave: 'nome', titulo: 'Alimento', principal: true, flex: 2, render: (l) => (
      <View style={estilos.nome}>
        <Texto numerico>{l.nome}</Texto>
        {papel === 'treinador' && l.semFator ? <Selo texto={marcaSemFator('treinador')} tipo="neutro" /> : null}
      </View>
    ) },
    {
      chave: 'quantidade',
      titulo: 'Quantidade',
      alinhar: 'direita',
      acao: true,
      tituloNaTabela: true,
      render: (l) => (
        <Texto numerico style={estilos.forte}>
          {quantidadeParaTela(l.quantidade, l.unidade)}
          {l.cru ? <Texto variante="suave"> cru</Texto> : null}
          {papel === 'aluno' && l.semFator ? <Texto variante="suave"> ({marcaSemFator('aluno')})</Texto> : null}
        </Texto>
      ),
    },
  ];
}

/** O que o PDF precisa da escolha feita na tela. */
export interface EscolhaDaLista {
  periodo: PeriodoDaLista;
  /** "Café da manhã: opção B" para cada refeição com mais de uma opção. */
  opcoes: string[];
  linhas: LinhaDaLista[];
}

/**
 * Lista de compras de um conteúdo de dieta (o aluno na tela `aluno/lista-de-compras`, com a versão publicada; o
 * treinador na prévia do editor, com os fatores atuais da biblioteca já aplicados). Período e opção por refeição são
 * estado da tela, não ficam salvos. O botão de PDF só aparece com `aoGerarPdf` e com a funcionalidade `PDF` no plano.
 */
export function ListaDeCompras({ conteudo, aoGerarPdf, papel = 'aluno' }: { conteudo: ConteudoDieta; aoGerarPdf?: (escolha: EscolhaDaLista) => Promise<void>; papel?: 'aluno' | 'treinador' }) {
  const { avisar } = useAviso();
  const [periodo, setPeriodo] = useState<PeriodoDaLista>('semana');
  const [escolhas, setEscolhas] = useState<EscolhasDeOpcao>({});
  const [gerando, setGerando] = useState(false);
  const linhas = listaDeCompras(conteudo, escolhas, periodo);

  const pdf = async () => {
    if (!aoGerarPdf) return;
    setGerando(true);
    try {
      await aoGerarPdf({ periodo, opcoes: textosDasOpcoes(conteudo, escolhas), linhas });
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Cartao titulo="Para quanto tempo">
        <EscolhasDaLista conteudo={conteudo} periodo={periodo} aoMudarPeriodo={setPeriodo} escolhas={escolhas} aoMudarEscolhas={setEscolhas} />
      </Cartao>
      <Cartao titulo={tituloDaLista(periodo)}>
        {linhas.length ? (
          <Tabela rotulo="Lista de compras" colunas={colunas(papel)} linhas={linhas} chave={(l) => l.chave} />
        ) : (
          <Vazio titulo="Nada para listar" texto="A dieta não tem itens com quantidade." />
        )}
        <Texto variante="suave">{papel === 'aluno' ? NOTA_DA_LISTA_ALUNO : NOTA_DA_LISTA_TREINADOR}</Texto>
      </Cartao>
      {aoGerarPdf ? (
        <NoPlano funcionalidade="PDF">
          <Botao rotulo="Baixar PDF da lista" tipo="secundario" cheio Icone={FileDown} carregando={gerando} desabilitado={!linhas.length} motivo="A lista está vazia." aoTocar={() => void pdf()} />
        </NoPlano>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  forte: { fontFamily: fontes.semi },
  nome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  opcoes: { gap: espaco(1.5), paddingTop: espaco(1) },
});
