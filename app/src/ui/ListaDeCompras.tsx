import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../api/tipos';
import {
  listaDeCompras,
  NOTA_DA_LISTA,
  quantidadeParaTela,
  refeicoesComEscolha,
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
import { Tabela, type ColunaDaTabela } from './Tabela';
import { Texto } from './Texto';

const PERIODOS: { valor: PeriodoDaLista; rotulo: string }[] = [
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

const COLUNAS: ColunaDaTabela<LinhaDaLista>[] = [
  { chave: 'nome', titulo: 'Alimento', principal: true, flex: 2, render: (l) => <Texto numerico>{l.nome}</Texto> },
  {
    chave: 'quantidade',
    titulo: 'Quantidade',
    alinhar: 'direita',
    render: (l) => (
      <Texto numerico style={estilos.forte}>
        {quantidadeParaTela(l.quantidade, l.unidade)}
        {l.cru ? <Texto variante="suave"> cru</Texto> : null}
      </Texto>
    ),
  },
];

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
export function ListaDeCompras({ conteudo, aoGerarPdf }: { conteudo: ConteudoDieta; aoGerarPdf?: (escolha: EscolhaDaLista) => Promise<void> }) {
  const { avisar } = useAviso();
  const [periodo, setPeriodo] = useState<PeriodoDaLista>('semana');
  const [escolhas, setEscolhas] = useState<EscolhasDeOpcao>({});
  const [gerando, setGerando] = useState(false);
  const comEscolha = refeicoesComEscolha(conteudo);
  const linhas = listaDeCompras(conteudo, escolhas, periodo);
  const opcaoDe = (r: (typeof comEscolha)[number]) => r.opcoes.find((o) => o.uid === escolhas[r.uid]) ?? r.opcoes[0];

  const pdf = async () => {
    if (!aoGerarPdf) return;
    setGerando(true);
    try {
      await aoGerarPdf({ periodo, opcoes: comEscolha.map((r) => `${r.nome || 'Refeição'}: opção ${opcaoDe(r)?.rotulo ?? '—'}`), linhas });
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Cartao titulo="Para quanto tempo">
        <Escolha descricao="Período da lista" opcoes={PERIODOS} valor={periodo} aoMudar={setPeriodo} />
        {comEscolha.length ? (
          <View style={estilos.opcoes}>
            <Texto variante="suave">Nas refeições com mais de uma opção, escolha a que vai comprar.</Texto>
            {comEscolha.map((r) => (
              <Escolha
                key={r.uid}
                rotulo={`${r.horario ? `${r.horario} · ` : ''}${r.nome || 'Refeição'}`}
                opcoes={r.opcoes.map((o) => ({ valor: o.uid, rotulo: `Opção ${o.rotulo}` }))}
                valor={opcaoDe(r)?.uid ?? ''}
                aoMudar={(uid) => setEscolhas((atual) => ({ ...atual, [r.uid]: uid }))}
              />
            ))}
          </View>
        ) : null}
      </Cartao>
      <Cartao titulo={periodo === 'semana' ? 'Lista da semana' : 'Lista do mês'}>
        {linhas.length ? (
          <Tabela rotulo="Lista de compras" colunas={COLUNAS} linhas={linhas} chave={(l) => l.chave} />
        ) : (
          <Vazio titulo="Nada para listar" texto="A dieta não tem itens com quantidade." />
        )}
        <Texto variante="suave">{NOTA_DA_LISTA}</Texto>
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
  opcoes: { gap: espaco(1.5), paddingTop: espaco(1) },
});
