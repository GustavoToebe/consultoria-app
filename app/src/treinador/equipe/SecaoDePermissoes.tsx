import { ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  alternarCaixa, alternarSecao, COLUNAS, LARGURA_RECURSO_COM_SELO, LARGURAS_DAS_COLUNAS, estadoDaCaixa, estadoDaSecao, type CaixaDaMatriz, type LinhaDaMatriz, type SecaoDaMatriz,
} from '../../dominio/matrizDePermissoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { CaixaDePermissao } from './CaixaDePermissao';

interface Props {
  secao: SecaoDaMatriz;
  marcadas: ReadonlySet<string>;
  marcavel: (codigo: string) => boolean;
  rotulos: ReadonlyMap<string, string>;
  aberta: boolean;
  aoAlternar: () => void;
  /** `matriz` (tabela recurso × ação) ou `blocos` (um bloco por recurso, ações em lista) e onde fica o selo: decididos
   *  uma vez para a folha inteira por `arranjoDaMatriz`, pela largura medida. */
  forma: 'matriz' | 'blocos';
  seloAbaixo: boolean;
  aoMudar: (f: (atuais: readonly string[]) => string[]) => void;
}

const FIXAS = ['ver', 'editar', 'publicar'] as const;

/**
 * Seção do editor de perfil: faixa recolhível com "N de M" e "Marcar toda a seção" (caixa com estado parcial) e, aberta,
 * a matriz da seção. A caixa da faixa vale também com a seção fechada.
 */
export function SecaoDePermissoes({ secao, marcadas, marcavel, rotulos, aberta, aoAlternar, forma, seloAbaixo, aoMudar }: Props) {
  const largo = forma === 'matriz';
  const { cores } = useTema();
  const estado = estadoDaSecao(secao.codigos, marcadas, marcavel);
  // Código da caixa com o balão aberto: a linha e a célula dela sobem de camada (ver `CaixaDePermissao.aoMudarDica`).
  const [comDica, setComDica] = useState<string | null>(null);
  const contem = (cs: readonly (CaixaDaMatriz | null)[]) => cs.some((c) => c?.codigo === comDica);
  const caixa = (c: CaixaDaMatriz, comNome: boolean, dicaAbaixo = false) => {
    const e = estadoDaCaixa(c.codigo, marcadas, marcavel(c.codigo), rotulos);
    // No PC o selo está na linha do recurso e a dica abre no mouse ou no foco; no celular a dica fica escrita embaixo.
    const descricao = [c.dicaAcrescenta ? c.dica : null, largo && c.sensivel ? 'Dado sensível.' : null, e.motivo].filter(Boolean).join(' ');
    return (
      <CaixaDePermissao key={c.codigo} rotuloAcessivel={c.rotuloAcessivel} nome={comNome ? c.nome : undefined} valor={e.marcada} travada={e.travada}
        descricao={descricao || undefined} descricaoVisivel={!largo} dicaAbaixo={dicaAbaixo}
        aoMudarDica={(aberta) => setComDica((atual) => (aberta ? c.codigo : atual === c.codigo ? null : atual))} aoMudar={(v) => aoMudar((atuais) => alternarCaixa(atuais, c.codigo, v))} />
    );
  };
  // Selo sempre na mesma posição em todos os recursos: ao lado do nome (o nome quebra, o selo não desce), ou abaixo em
  // todos quando `seloAbaixo`.
  const recurso = (l: LinhaDaMatriz) => (
    <View style={seloAbaixo ? estilos.recursoEmColuna : estilos.recursoEmLinha}>
      <Texto style={estilos.nomeDoRecurso}>{l.recurso}</Texto>
      {l.selo ? <View style={estilos.selo}><Selo texto="Dado sensível" tipo="atencao" Icone={ShieldAlert} /></View> : null}
    </View>
  );
  return (
    <Cartao cabecalho={(
      <CabecalhoDeGrupo titulo={secao.secao} aberto={aberta} aoAlternar={aoAlternar}
        resumo={estado.total ? `${estado.marcadas} de ${estado.total}` : 'Nada que você possa atribuir'}
        acoes={estado.total ? (
          <CaixaDePermissao nome="Marcar toda a seção" rotuloAcessivel={`Marcar toda a seção ${secao.secao}`} valor={estado.valor}
            aoMudar={() => aoMudar((atuais) => alternarSecao(atuais, secao.codigos, marcavel, estado.valor))} />
        ) : null} />
    )}>
      {!aberta ? null : largo ? (
        <View role="table" aria-label={`Permissões da seção ${secao.secao}`}>
          <View role="row" style={[estilos.linha, estilos.cabecalho, { borderBottomColor: cores.divisor }]}>
            <View role="columnheader" style={estilos.colRecurso}><Texto variante="rotulo" cor={cores.textoSuave}>Recurso</Texto></View>
            {COLUNAS.map((c) => (
              <View key={c.chave} role="columnheader" style={c.chave === 'outras' ? estilos.colOutras : [estilos.colFixa, LARGURAS[c.chave]]}>
                <Texto variante="rotulo" cor={cores.textoSuave} style={c.chave === 'outras' ? null : estilos.centro}>{c.rotulo}</Texto>
              </View>
            ))}
          </View>
          {secao.linhas.map((l, i) => (
            <View key={l.recurso} role="row" style={[estilos.linha, i > 0 ? { borderTopWidth: 1, borderTopColor: cores.divisor } : null, contem([...FIXAS.map((k) => l.celulas[k]), ...l.outras]) ? estilos.porCima : null]}>
              <View role="rowheader" style={estilos.colRecurso}>{recurso(l)}</View>
              {FIXAS.map((k) => {
                const c = l.celulas[k];
                return <View key={k} role="cell" style={[estilos.colFixa, LARGURAS[k], contem([c]) ? estilos.porCima : null]}>{c ? caixa(c, false, i === 0) : null}</View>;
              })}
              <View role="cell" style={[estilos.colOutras, estilos.outras, contem(l.outras) ? estilos.porCima : null]}>{l.outras.map((c) => caixa(c, true, i === 0))}</View>
            </View>
          ))}
        </View>
      ) : (
        <View style={estilos.blocos}>
          {secao.linhas.map((l) => (
            <View key={l.recurso} style={[estilos.bloco, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
              {recurso(l)}
              {[...FIXAS.map((k) => l.celulas[k]), ...l.outras].map((c) => (c ? caixa(c, true) : null))}
            </View>
          ))}
        </View>
      )}
    </Cartao>
  );
}

// Colunas fixas para Ver, Criar e editar e Publicar ficarem no mesmo lugar em todas as seções.
const LARGURAS = { ver: { width: LARGURAS_DAS_COLUNAS.ver }, editar: { width: LARGURAS_DAS_COLUNAS.editar }, publicar: { width: LARGURAS_DAS_COLUNAS.publicar } };

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(0.5) },
  cabecalho: { borderBottomWidth: 1, paddingBottom: espaco(1) },
  // Largura fixa: cabe o nome mais longo com o selo ao lado (`arranjoDaMatriz` só escolhe a tabela quando ela cabe).
  colRecurso: { width: LARGURA_RECURSO_COM_SELO },
  colFixa: { alignItems: 'center', justifyContent: 'center' },
  colOutras: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 160 },
  centro: { textAlign: 'center' },
  porCima: { zIndex: 1 },
  recursoEmLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  recursoEmColuna: { alignItems: 'flex-start', gap: 4 },
  nomeDoRecurso: { fontFamily: fontes.semi, flexShrink: 1 },
  selo: { flexShrink: 0 },
  outras: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2) },
  blocos: { gap: espaco(1.5) },
  bloco: { borderWidth: 1, borderRadius: RAIO_CONTROLE, padding: espaco(1.5), gap: 2 },
});
