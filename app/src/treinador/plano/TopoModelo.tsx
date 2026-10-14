import { textoDoSalvo } from '../../dominio/estadoDoRascunho';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Selo, type TipoSelo } from '../../ui/Selo';
import type { SituacaoRascunho, usePlanoEditor } from './usePlanoEditor';

const SITUACOES: Record<SituacaoRascunho, { texto: string; tipo: TipoSelo }> = {
  salvo: { texto: 'Salvo', tipo: 'sucesso' },
  pendente: { texto: 'Alterações não salvas', tipo: 'atencao' },
  salvando: { texto: 'Salvando…', tipo: 'neutro' },
  erro: { texto: 'Não foi possível salvar. Tente novamente.', tipo: 'perigo' },
  conflito: { texto: 'Este modelo mudou em outra tela. Recarregue antes de editar.', tipo: 'perigo' },
  dataInvalida: { texto: 'Confira os campos.', tipo: 'perigo' },
};

export function TopoModelo<C>({ editor }: { editor: ReturnType<typeof usePlanoEditor<C>> }) {
  const e = editor.estado;
  if (!e) return null;
  return <Cartao titulo="Modelo reutilizável" descricao="Nada é salvo sozinho: as alterações só valem depois de Salvar modelo (ao sair com alteração pendente, o app pergunta antes). As cópias já aplicadas aos alunos permanecem iguais.">
    <Campo rotulo="Nome do modelo" valor={e.titulo} aoMudar={(titulo) => editor.alterar(() => ({ titulo }))} maxLength={120} />
    <Selo texto={editor.situacao === 'salvo' ? textoDoSalvo(editor.salvoAs) : (editor.situacao === 'erro' && editor.mensagemDeErro) || SITUACOES[editor.situacao].texto} tipo={SITUACOES[editor.situacao].tipo} />
    {editor.situacao === 'conflito' ? <Botao rotulo="Recarregar modelo" aoTocar={editor.recarregar} /> : <Botao rotulo="Salvar modelo" aoTocar={() => void editor.salvar()} carregando={editor.situacao === 'salvando'} desabilitado={!e.titulo.trim()} />}
  </Cartao>;
}
