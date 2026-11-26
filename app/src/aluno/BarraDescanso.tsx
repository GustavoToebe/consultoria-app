import { useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AJUSTE_DO_DESCANSO_SEGUNDOS, relogioDoDescanso, textoDoTempo } from '../dominio/descanso';
import { useAluno } from '../offline/AlunoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Botao } from '../ui/Botao';
import { fundoPintado, superficiePintada } from '../ui/superficiePintada';
import { Texto } from '../ui/Texto';

/** A tela do exercício (`/aluno/sessao/<uid>/<exercicio>`, não a do "Bom trabalho") desenha a própria barra de baixo. */
export const ehTelaDoExercicio = (caminho: string) => /^\/aluno\/sessao\/[^/]+\/[^/]+$/.test(caminho) && !caminho.endsWith('/concluido');

/**
 * Barra fixa de baixo (fora da rolagem, acima do menu): enquanto o descanso conta, pintada de azul (`informacao`, padrão
 * `ui/superficiePintada`) com o tempo grande, a barra de progresso, "−15 s", "+15 s" e "Pular descanso"; parado ou
 * terminado, `proximo` (na tela do exercício, "Próximo: <exercício> ›"; nas outras telas, nada). A vibração do fim é do
 * `AlunoProvider` (uma vez por descanso, com o app aberto); aqui só o relógio da barra, que redesenha só ela.
 */
export function BarraDescanso({ proximo, coluna }: {
  proximo?: ReactNode;
  /**
   * Web larga do exercício: a coluna das séries medida pela rota (`esquerda` a partir da borda desta barra). O conteúdo da
   * barra (o "Próximo" ou o cronômetro) fica nela; o fundo continua na largura toda. Sem ela, o conteúdo ocupa a barra.
   */
  coluna?: { esquerda: number; largura: number } | null;
}) {
  const { descanso, ajustarDescanso, pularDescanso } = useAluno();
  const { cores, variante } = useTema();
  const [agora, atualizar] = useState(() => Date.now());
  useEffect(() => {
    if (!descanso) return;
    const atualizarAgora = () => atualizar(Date.now());
    const intervalo = setInterval(atualizarAgora, 250);
    const app = AppState.addEventListener('change', atualizarAgora);
    return () => {
      clearInterval(intervalo);
      app.remove();
    };
  }, [descanso]);
  const relogio = relogioDoDescanso(descanso, agora);
  const naColuna = (conteudo: ReactNode) => (coluna ? <View style={[estilos.coluna, { marginLeft: coluna.esquerda - espaco(2), width: coluna.largura }]}>{conteudo}</View> : conteudo);
  if (relogio.fase !== 'CONTANDO') return proximo ? <View style={[estilos.barra, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>{naColuna(proximo)}</View> : null;
  const pintada = superficiePintada(cores.informacao, cores.superficie, variante, cores);
  const duracao = Math.round((descanso?.duracaoMs ?? 0) / 1000);
  return (
    <View style={[estilos.barra, fundoPintado(pintada), { borderColor: pintada.borda }]} accessibilityRole="timer" aria-label="Descanso">
      {naColuna(<>
        <View style={estilos.linha}>
          <View style={estilos.tempo}>
            <Texto variante="pequeno" cor={pintada.texto} style={estilos.rotulo}>{descanso?.rotulo ?? 'Descanso'}</Texto>
            {/* O relógio não é região viva: o leitor de tela lê o valor quando o foco chega, sem anunciar cada segundo. */}
            <Texto numerico style={estilos.numero} cor={cores.texto} accessibilityLabel={`${relogio.segundos} segundos restantes`}>{relogio.texto}</Texto>
          </View>
          <Botao rotulo="Pular descanso" tipo="secundario" aoTocar={pularDescanso} />
        </View>
        <View style={estilos.linha}>
          <Botao rotulo="−15 s" rotuloAcessivel="Diminuir 15 segundos" tipo="secundario" aoTocar={() => ajustarDescanso(-AJUSTE_DO_DESCANSO_SEGUNDOS)} />
          <View style={estilos.progresso}>
            <BarraProgresso feitas={relogio.segundos} total={Math.max(duracao, relogio.segundos)} cor={cores.informacao} trilho={cores.superficie2}
              rotulo="Tempo de descanso restante" valorEmTexto={`${relogio.texto} de ${textoDoTempo(duracao)}`} />
          </View>
          <Botao rotulo="+15 s" rotuloAcessivel="Aumentar 15 segundos" tipo="secundario" aoTocar={() => ajustarDescanso(AJUSTE_DO_DESCANSO_SEGUNDOS)} />
        </View>
      </>)}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { borderTopWidth: 1, paddingHorizontal: espaco(2), paddingVertical: espaco(1), gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  coluna: { gap: espaco(1) },
  tempo: { flex: 1, minWidth: 0 },
  rotulo: { fontFamily: fontes.semi },
  numero: { fontFamily: fontes.negrito, fontSize: 32, lineHeight: 38 },
  progresso: { flex: 1, minWidth: 0 },
});
