import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Check } from 'lucide-react-native';

import type { PerguntaAtualizacao, RespostaAtualizacao } from '../../api/tipos';
import { alternarMarcado, colunasDasOpcoes } from '../../dominio/atualizacaoQuestionario';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { Texto } from '../../ui/Texto';
import { ImagemDaOpcao } from './ImagemDaPergunta';

const VAO_OPCOES = espaco(1.5);

/**
 * Escolha com imagem por opção (aparelhos da academia, escala de referência): cartões em grade (2 por linha no
 * celular, 3 ou 4 no PC), o cartão inteiro marca, imagem inteira numa proporção fixa e o nome embaixo. Marcado = borda
 * grossa na cor do texto, fundo realçado e a caixinha cheia. Na escolha única marcar uma desmarca a outra. Sem
 * `aoMudar`, só leitura: as escolhidas em destaque e as outras apagadas.
 */
export function OpcoesComImagem({ p, valor, aoMudar }: { p: PerguntaAtualizacao; valor: RespostaAtualizacao; aoMudar?: (valor: RespostaAtualizacao) => void }) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const opcoes = p.opcoes ?? [];
  const unica = p.tipo === 'ESCOLHA_UNICA';
  const marcadas = unica ? (typeof valor === 'string' ? [valor] : []) : Array.isArray(valor) ? valor : [];
  const colunas = colunasDasOpcoes(largura);
  const celula = largura > 0 ? Math.floor((largura - VAO_OPCOES * (colunas - 1)) / colunas) : 0;
  const imagem = Math.max(0, celula - 2 * espaco(1) - 4);
  const tocar = (id: string) => {
    if (!aoMudar) return;
    const marcado = marcadas.includes(id);
    if (unica) aoMudar(marcado ? (p.obrigatoria ? id : null) : id);
    else aoMudar(alternarMarcado(marcadas, opcoes, id));
  };
  return <View style={estilos.gradeDeOpcoes} onLayout={(e: LayoutChangeEvent) => setLargura(Math.floor(e.nativeEvent.layout.width))}
    accessibilityRole={unica ? 'radiogroup' : undefined} accessibilityLabel={p.rotulo}>
    {celula > 0 ? opcoes.map((o) => {
      const marcado = marcadas.includes(o.id);
      return <Pressable key={o.id} disabled={!aoMudar} onPress={() => tocar(o.id)}
        accessibilityRole={unica ? 'radio' : 'checkbox'} accessibilityLabel={o.rotulo}
        accessibilityState={{ checked: marcado, disabled: !aoMudar }} aria-checked={marcado}
        style={({ pressed }) => [estilos.opcaoComImagem, {
          width: celula,
          borderWidth: marcado ? 2 : 1,
          padding: marcado ? espaco(1) - 1 : espaco(1),
          borderColor: marcado ? cores.texto : cores.bordaCampo,
          backgroundColor: !aoMudar && !marcado ? coresDoDesabilitado(cores).fundo : marcado || pressed ? cores.sobre : cores.superficie2,
        }]}>
        {o.imagemId ? <ImagemDaOpcao id={o.imagemId} descricao={`Imagem da opção ${o.rotulo}`} largura={imagem} />
          : <View style={[estilos.semImagem, { height: Math.round(imagem * 0.75), borderColor: cores.divisor }]} />}
        <View style={estilos.rodapeDaOpcao}>
          <View style={[unica ? estilos.bolinha : estilos.caixinha, { borderColor: marcado ? cores.texto : cores.bordaCampo, backgroundColor: marcado ? cores.texto : cores.campo }]}>
            {marcado ? <Check size={14} color={cores.fundo} /> : null}
          </View>
          <Texto style={estilos.rotuloDaOpcao} cor={!aoMudar && !marcado ? cores.textoSuave : undefined}>{o.rotulo}</Texto>
        </View>
      </Pressable>;
    }) : null}
  </View>;
}

const estilos = StyleSheet.create({
  gradeDeOpcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: VAO_OPCOES, alignSelf: 'stretch' },
  opcaoComImagem: { borderRadius: RAIO, gap: espaco(1) },
  semImagem: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO },
  rodapeDaOpcao: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), minHeight: 24 },
  caixinha: { width: 22, height: 22, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  bolinha: { width: 22, height: 22, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rotuloDaOpcao: { flex: 1 },
});
