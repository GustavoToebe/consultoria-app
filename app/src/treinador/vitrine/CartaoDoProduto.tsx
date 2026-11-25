import { Ellipsis, Eye, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { baixarFotoDoItem } from '../../api/rotas';
import type { ItemDaVitrine } from '../../api/vitrineTipos';
import { PrecoFormatado } from '../../aluno/vitrine/CartaoDoItem';
import { MiniaturaDoItem } from '../../aluno/vitrine/MiniaturaDoItem';
import { contornoDoCartao } from '../../dominio/preferencias';
import { rotuloDoTipo, textoDoPreco } from '../../dominio/vitrine';
import { SEM_CATEGORIA } from '../../dominio/vitrineCategorias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { AlcaDeArraste, type ArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

/** Nome do ⋯ do item; a tela devolve o foco a ele depois de mover. */
export const rotuloDoMenuDoItem = (nome: string) => `Ações do item ${nome}`;

/**
 * Cartão de um item na grade da Vitrine: foto 1:1 (ou o quadro neutro), nome, "Categoria · Tipo", preço (o especial com o
 * normal riscado, como o aluno vê), selo neutro "Inativo" ou "Na página pública" e, embaixo, a alça, o ⋯ (Mover para
 * cima/baixo, o caminho do teclado) e "Editar". `compacto` (grade de uma coluna, celular): foto de 88 px à esquerda.
 * Os cartões da mesma linha têm a mesma altura, com as ações sempre embaixo.
 */
export function CartaoDoProduto({ item, podeAlterar, lojaHabilitada, compacto, arraste, aoMenu, aoEditar }: {
  item: ItemDaVitrine;
  podeAlterar: boolean;
  lojaHabilitada: boolean;
  compacto: boolean;
  arraste?: { lista: ArrasteDaLista; indice: number };
  aoMenu?: () => void;
  aoEditar: () => void;
}) {
  const { cores, bordas, preferencias } = useTema();
  const [lado, setLado] = useState(0);
  const selo = seloDoItem(item, lojaHabilitada);
  const textos = (
    <View style={compacto ? estilos.textosAoLado : estilos.textos}>
      <Texto variante="subtitulo" numberOfLines={2}>{item.nome}</Texto>
      <Texto variante="suave" numberOfLines={1}>{`${item.categoriaNome ?? SEM_CATEGORIA} · ${rotuloDoTipo(item.tipo)}`}</Texto>
      <PrecoFormatado preco={textoDoPreco(item)} />
      {selo ? <View style={estilos.selo}><Selo texto={selo} tipo="neutro" /></View> : null}
    </View>
  );
  return (
    <View role="listitem" testID={`cartao-do-item-${item.id}`}
      style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: contornoDoCartao(cores, preferencias.contraste), borderWidth: bordas.bloco }]}>
      {compacto ? (
        <View style={estilos.linhaCompacta}>
          <MiniaturaDoItem item={item} carregar={baixarFotoDoItem} tamanho={88} />
          {textos}
        </View>
      ) : (
        <>
          <View style={estilos.foto} onLayout={(e) => setLado(Math.floor(e.nativeEvent.layout.width))}>
            {lado > 0 ? <MiniaturaDoItem item={item} carregar={baixarFotoDoItem} tamanho={lado} /> : null}
          </View>
          {textos}
        </>
      )}
      <View style={estilos.acoes}>
        <View style={estilos.ordem}>
          {arraste ? <AlcaDeArraste arraste={arraste.lista} indice={arraste.indice} /> : null}
          {aoMenu ? <IconeBotao Icone={Ellipsis} rotulo={rotuloDoMenuDoItem(item.nome)} aoTocar={aoMenu} /> : null}
        </View>
        <Botao rotulo={podeAlterar ? 'Editar' : 'Ver'} rotuloAcessivel={`${podeAlterar ? 'Editar' : 'Ver'} ${item.nome}`} tipo="secundario"
          Icone={podeAlterar ? Pencil : Eye} aoTocar={aoEditar} />
      </View>
    </View>
  );
}

/** Inativo some de tudo; ativo, digital e marcado é o que a página pública mostra (a API só manda esses). Neutros: não pedem ação. */
function seloDoItem(item: ItemDaVitrine, lojaHabilitada: boolean): string | null {
  if (!item.ativo) return 'Inativo';
  if (lojaHabilitada && item.naPaginaPublica && item.tipo === 'DIGITAL') return 'Na página pública';
  return null;
}

const estilos = StyleSheet.create({
  cartao: { flexGrow: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.5) },
  foto: { width: '100%', aspectRatio: 1 },
  linhaCompacta: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  textos: { gap: espaco(0.5) },
  textosAoLado: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  selo: { flexDirection: 'row', paddingTop: espaco(0.25) },
  // `marginTop: auto`: na linha da grade os cartões têm a mesma altura e as ações ficam sempre embaixo.
  acoes: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  ordem: { flexDirection: 'row', alignItems: 'center' },
});
