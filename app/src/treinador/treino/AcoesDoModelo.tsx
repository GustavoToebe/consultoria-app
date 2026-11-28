import { router } from 'expo-router';
import { PencilLine, Save, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Receita } from '../../api/tipos';
import { seloDoEditor, type SituacaoDoEditor } from '../../dominio/barraDoEditor';
import { podeAplicarModelo } from '../../dominio/modelos';
import { mensagemCopiaCriada } from '../../dominio/planoDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { DicaDoBotao } from '../../ui/DicaDoBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { AplicarAoAluno } from '../planejamento/AplicarAoAluno';
import { usoDoModelo } from '../planejamento/modelos';
import type { usePlanoEditor } from '../plano/usePlanoEditor';

interface Props {
  situacao: SituacaoDoEditor;
  salvoAs: Date | null;
  mensagemDeErro?: string | null;
  salvando: boolean;
  /** Não dá para salvar (nome vazio): `motivo` diz por quê. */
  desabilitado?: boolean;
  motivo?: string;
  aoSalvar: () => void;
  aoRecarregar: () => void;
  /** O modelo como está no servidor: com ele, "Aplicar ao aluno" (só para o que se aplica e a quem pode). */
  receita?: Receita | null;
}

/**
 * As ações do modelo de treino no cabeçalho único (27/11, `Cabecalho acoes` da `TelaDoEditor cabecalhoGrudado`): estado,
 * "Aplicar ao aluno" (secundário) e "Salvar modelo" (o primário), na faixa do título. Mesmo comportamento da `BarraDoModelo`
 * (que segue no celular e nos outros modelos); a diferença é o desenho: "Alterações não salvas" em âmbar, texto e lápis sem
 * pílula (pedido do Gustavo; a D12 da barra continua neutra), e o motivo dos botões desabilitados na `DicaDoBotao`, porque
 * escrito embaixo quebraria a faixa. Os outros estados (salvo, salvando, falha, conflito) usam o `Selo` de sempre.
 */
export function AcoesDoModelo({ situacao, salvoAs, mensagemDeErro, salvando, desabilitado, motivo, aoSalvar, aoRecarregar, receita }: Props) {
  const { pode } = useSessao();
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [aplicando, setAplicando] = useState(false);
  const aplicavel = !!receita && usoDoModelo(receita.tipo).aplicavel && podeAplicarModelo(receita.tipo, pode);
  const pendente = situacao !== 'salvo';
  const selo = seloDoEditor(situacao, salvoAs, null);
  return (
    <View style={estilos.acoes}>
      <View style={estilos.estado}>
        {selo.naoSalvo ? (
          <View style={estilos.naoSalvo}>
            <PencilLine size={16} color={cores.atencao} strokeWidth={2} aria-hidden />
            <Texto variante="pequeno" cor={cores.atencao}>{selo.texto}</Texto>
          </View>
        ) : <Selo texto={selo.texto} tipo={selo.tipo} />}
        {/* A falha ao salvar fica à vista: sem ela, quem fecha a aba perde o trabalho sem saber. */}
        {situacao === 'erro' && mensagemDeErro ? <Texto variante="pequeno" cor={cores.perigo} style={estilos.erro}>{mensagemDeErro}</Texto> : null}
      </View>
      {aplicavel ? (
        <DicaDoBotao rotulo="Aplicar ao aluno" motivo={pendente ? 'Salve o modelo antes.' : undefined}>
          {(m) => <Botao rotulo="Aplicar ao aluno" tipo="secundario" Icone={UserPlus} desabilitado={pendente} motivo={m} aoTocar={() => setAplicando(true)} />}
        </DicaDoBotao>
      ) : null}
      {situacao === 'conflito'
        ? <Botao rotulo="Recarregar modelo" aoTocar={aoRecarregar} />
        : (
          <DicaDoBotao rotulo="Salvar modelo" motivo={desabilitado ? motivo : undefined}>
            {(m) => <Botao rotulo="Salvar modelo" Icone={Save} carregando={situacao === 'salvando' || salvando} desabilitado={desabilitado} motivo={m} aoTocar={aoSalvar} />}
          </DicaDoBotao>
        )}
      {aplicando && receita ? (
        <AplicarAoAluno modelo={receita} aoFechar={() => setAplicando(false)} aoAplicar={(id, nome) => {
          setAplicando(false);
          avisar(mensagemCopiaCriada(nome), 'sucesso');
          router.push(`/treinador/alunos/${id}`);
        }} />
      ) : null}
    </View>
  );
}

/** As mesmas ações para o editor de treino (o `usePlanoEditor`), no molde da `BarraDoModeloDoEditor`: troca de uma linha. */
export function AcoesDoModeloDoEditor<C>({ editor, receita }: { editor: ReturnType<typeof usePlanoEditor<C>>; receita?: Receita | null }) {
  const { avisar } = useAviso();
  const e = editor.estado;
  if (!e) return null;
  return (
    <AcoesDoModelo situacao={editor.situacao} salvoAs={editor.salvoAs} mensagemDeErro={editor.mensagemDeErro} salvando={false}
      desabilitado={!e.titulo.trim()} motivo="Informe o nome do modelo." aoRecarregar={editor.recarregar} receita={receita}
      aoSalvar={() => void editor.salvar().then((ok) => avisar(ok ? 'Modelo salvo.' : (editor.falhaAoSalvar() ?? 'Não foi possível salvar o modelo.'), ok ? 'sucesso' : 'perigo'))} />
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(1), maxWidth: '100%' },
  estado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), flexShrink: 1, marginRight: espaco(0.5) },
  naoSalvo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  erro: { flexShrink: 1 },
});
