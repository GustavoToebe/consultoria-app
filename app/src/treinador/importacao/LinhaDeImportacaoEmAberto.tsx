import { Ellipsis, RotateCcw, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dataHoraParaTela } from '../../dominio/formatos';
import { contagensDaSessaoEmAberto, prazoDaSessao, seloDaSessao } from '../../dominio/importacaoAssistida';
import type { SessaoListaItem } from '../../servicos/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { FolhaDeAcoes } from '../FolhaDeAcoes';

/**
 * Importações que ainda podem ser retomadas, uma linha cada (26/11), sem cartão dentro do cartão: data e hora, selo da
 * situação, contagens e prazo à esquerda; "Retomar" e o ⋯ (Descartar) à direita. Fio `divisor` só entre as linhas, como a
 * `ListaDeLinhas divisorias`. No celular os textos quebram e as ações descem para baixo deles, alinhadas à direita.
 */
export function ImportacoesEmAberto({ sessoes, retomando, aoRetomar, aoDescartar }: {
  sessoes: readonly SessaoListaItem[];
  /** Id da que está abrindo: o carregando gira só nela. */
  retomando: string | null;
  aoRetomar: (id: string) => void;
  aoDescartar: (s: SessaoListaItem) => void;
}) {
  const { cores } = useTema();
  const [menu, setMenu] = useState<SessaoListaItem | null>(null);
  return (
    <>
    <View role="list" aria-label="Importações em aberto">
      {sessoes.map((s, i) => {
        const quando = dataHoraParaTela(s.criadoEm);
        const selo = seloDaSessao(s.estado);
        const prazo = prazoDaSessao(s.expiraEm);
        return (
          <View key={s.id} role="listitem" style={[estilos.linha, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
            <View style={estilos.textos}>
              <Texto variante="bloco" numerico>{quando}</Texto>
              {/* O `Selo` se alinha ao topo (`alignSelf`); a caixa o centra na linha. */}
              <View><Selo texto={selo.texto} tipo={selo.tipo} ponto /></View>
              <Texto variante="suave" numerico>{contagensDaSessaoEmAberto(s)}</Texto>
              {prazo ? <Texto variante="suave" numerico>{prazo}</Texto> : null}
            </View>
            <View style={estilos.acoes}>
              <Botao rotulo="Retomar" rotuloAcessivel={`Retomar a importação de ${quando}`} tipo="acao" Icone={RotateCcw}
                carregando={retomando === s.id} desabilitado={!!retomando && retomando !== s.id} motivo="Abrindo outra importação…"
                aoTocar={() => aoRetomar(s.id)} />
              <IconeBotao Icone={Ellipsis} moldura rotulo={`Mais ações da importação de ${quando}`} aoTocar={() => setMenu(s)} />
            </View>
          </View>
        );
      })}
    </View>
    {/* A folha fica fora da lista: uma lista só contém itens. */}
      {menu ? (
        <FolhaDeAcoes titulo={`Importação de ${dataHoraParaTela(menu.criadoEm)}`} aoFechar={() => setMenu(null)} acoes={[
          { rotulo: 'Descartar', detalhe: 'Apaga os arquivos temporários. O que já foi gravado fica.', Icone: Trash2, perigo: true, aoTocar: () => aoDescartar(menu) },
        ]} />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1.5) },
  // Data · selo · contagens · prazo na mesma linha enquanto couber; no celular quebram, legíveis.
  textos: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(2), rowGap: espaco(0.5) },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), marginLeft: 'auto' },
});
