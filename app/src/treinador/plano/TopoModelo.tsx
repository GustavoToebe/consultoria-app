import { router } from 'expo-router';
import { Save, UserPlus } from 'lucide-react-native';
import { useState } from 'react';

import type { Receita } from '../../api/tipos';
import { seloDoEditor, type SituacaoDoEditor } from '../../dominio/barraDoEditor';
import { podeAplicarModelo } from '../../dominio/modelos';
import { mensagemCopiaCriada } from '../../dominio/planoDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { AplicarAoAluno } from '../planejamento/AplicarAoAluno';
import { usoDoModelo } from '../planejamento/modelos';
import { BarraDoEditor } from './BarraDoEditor';
import type { usePlanoEditor } from './usePlanoEditor';

interface PropsDaBarra {
  situacao: SituacaoDoEditor;
  salvoAs: Date | null;
  mensagemDeErro?: string | null;
  salvando: boolean;
  /** Não dá para salvar (nome vazio, mobilidade incompleta…): `motivo` diz por quê. */
  desabilitado?: boolean;
  motivo?: string;
  aoSalvar: () => void;
  aoRecarregar: () => void;
  /** O modelo como está no servidor: com ele, semanas, dietas, pacotes e mobilidades ganham "Aplicar ao aluno". */
  receita?: Receita | null;
}

/**
 * Barra fixa de **todo** editor de modelo (semana, dia, dieta, refeição, séries, metodologia, mobilidade, pacote):
 * selo de estado e "Salvar modelo" sempre no mesmo lugar (antes ficava no topo em uns, no fim da página em outros e
 * dentro do cartão da metodologia). "Aplicar ao aluno" (secundário) só para o que se aplica e depois de salvo.
 */
export function BarraDoModelo({ situacao, salvoAs, mensagemDeErro, salvando, desabilitado, motivo, aoSalvar, aoRecarregar, receita }: PropsDaBarra) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [aplicando, setAplicando] = useState(false);
  const aplicavel = !!receita && usoDoModelo(receita.tipo).aplicavel && podeAplicarModelo(receita.tipo, pode);
  const pendente = situacao !== 'salvo';
  return (
    <>
      <BarraDoEditor selo={seloDoEditor(situacao, salvoAs, null)} erro={situacao === 'erro' ? mensagemDeErro : null}>
        {aplicavel ? (
          <Botao rotulo="Aplicar ao aluno" tipo="secundario" Icone={UserPlus} desabilitado={pendente} motivo="Salve o modelo antes."
            aoTocar={() => setAplicando(true)} />
        ) : null}
        {situacao === 'conflito'
          ? <Botao rotulo="Recarregar modelo" aoTocar={aoRecarregar} />
          : <Botao rotulo="Salvar modelo" Icone={Save} carregando={situacao === 'salvando' || salvando} desabilitado={desabilitado} motivo={motivo} aoTocar={aoSalvar} />}
      </BarraDoEditor>
      {aplicando && receita ? (
        <AplicarAoAluno modelo={receita} aoFechar={() => setAplicando(false)} aoAplicar={(id, nome) => {
          setAplicando(false);
          avisar(mensagemCopiaCriada(nome), 'sucesso');
          router.push(`/treinador/alunos/${id}`);
        }} />
      ) : null}
    </>
  );
}

/** Barra de modelo para os editores de treino e dieta (que usam o `usePlanoEditor`). */
export function BarraDoModeloDoEditor<C>({ editor, receita }: { editor: ReturnType<typeof usePlanoEditor<C>>; receita?: Receita | null }) {
  const { avisar } = useAviso();
  const e = editor.estado;
  if (!e) return null;
  return (
    <BarraDoModelo situacao={editor.situacao} salvoAs={editor.salvoAs} mensagemDeErro={editor.mensagemDeErro} salvando={false}
      desabilitado={!e.titulo.trim()} motivo="Informe o nome do modelo." aoRecarregar={editor.recarregar} receita={receita}
      aoSalvar={() => void editor.salvar().then((ok) => avisar(ok ? 'Modelo salvo.' : (editor.falhaAoSalvar() ?? 'Não foi possível salvar o modelo.'), ok ? 'sucesso' : 'perigo'))} />
  );
}

/** Nome do modelo, no topo do conteúdo (a barra só tem estado e ações). */
export function NomeDoModelo<C>({ editor }: { editor: ReturnType<typeof usePlanoEditor<C>> }) {
  const e = editor.estado;
  if (!e) return null;
  return (
    <Cartao>
      <Campo rotulo="Nome do modelo" valor={e.titulo} aoMudar={(titulo) => editor.alterar(() => ({ titulo }))} maxLength={120}
        erro={e.titulo.trim() ? null : 'Informe o nome do modelo.'} />
    </Cartao>
  );
}
