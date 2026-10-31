import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  alternarBloco,
  blocosParaEditar,
  blocosPermitidos,
  moverBloco,
  PAINEL_DO_INICIO_PADRAO,
  type ContextoDoPainel,
  type PainelDoInicioPreferido,
} from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Interruptor } from '../../ui/Campos';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

/**
 * "Editar" do Início numa `Folha`: liga ou desliga cada bloco que o perfil pode ver e muda a ordem com Subir e Descer
 * (sem arrastar). Trabalha num rascunho: Concluir grava nas preferências (no aparelho), Cancelar descarta, Voltar ao
 * padrão volta o rascunho à ordem de fábrica. Os Primeiros passos ficam fora (fixos no topo).
 */
export function EditarPainel({ ctx, inicial, aoConcluir, aoFechar }: {
  ctx: ContextoDoPainel;
  inicial: PainelDoInicioPreferido;
  aoConcluir: (pref: PainelDoInicioPreferido) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [rascunho, setRascunho] = useState(inicial);
  const lista = blocosParaEditar(ctx, rascunho);
  const permitidos = blocosPermitidos(ctx, rascunho);
  const nenhumLigado = lista.every((b) => !b.ligado);
  return (
    <Folha visivel titulo="Editar o Início" aoFechar={aoFechar}
      rodape={(
        <LinhaDeAcoes>
          <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={aoFechar} />
          <Botao rotulo="Voltar ao padrão" tipo="secundario" aoTocar={() => setRascunho(PAINEL_DO_INICIO_PADRAO)} />
          <Botao rotulo="Concluir" aoTocar={() => aoConcluir(rascunho)} />
        </LinhaDeAcoes>
      )}>
      <View style={estilos.corpo}>
        <Texto variante="suave">Escolha os blocos que aparecem e a ordem deles. Fica salvo neste aparelho. Os Primeiros passos ficam sempre no topo.</Texto>
        {nenhumLigado ? <Texto variante="suave">Nenhum bloco ligado: o Início fica só com o Próximo passo.</Texto> : null}
        <View accessibilityRole="list">
          {lista.map((b) => (
            <View key={b.id} style={[estilos.linha, { borderColor: cores.divisor }]}>
              <View style={[estilos.posicao, { borderColor: cores.bordaCampo }]} accessible={false}>
                <Texto variante="rotulo" numerico cor={cores.texto}>{String(b.posicao)}</Texto>
              </View>
              <View style={estilos.interruptor}>
                <Interruptor rotulo={b.titulo} ajuda={`${b.ligado ? 'Aparece' : 'Escondido'} · ${b.descricao}`} valor={b.ligado}
                  aoMudar={() => setRascunho((r) => alternarBloco(r, b.id))} />
              </View>
              <View style={estilos.setas}>
                <IconeBotao Icone={ArrowUp} moldura rotulo={`Subir ${b.titulo} (posição ${b.posicao} de ${b.total})`} desabilitado={!b.podeSubir}
                  aoTocar={() => setRascunho((r) => moverBloco(r, b.id, -1, permitidos))} />
                <IconeBotao Icone={ArrowDown} moldura rotulo={`Descer ${b.titulo} (posição ${b.posicao} de ${b.total})`} desabilitado={!b.podeDescer}
                  aoTocar={() => setRascunho((r) => moverBloco(r, b.id, 1, permitidos))} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), paddingVertical: espaco(1), borderTopWidth: 1 },
  posicao: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  interruptor: { flex: 1, minWidth: 0 },
  setas: { flexDirection: 'row', gap: espaco(0.5), flexShrink: 0 },
});
