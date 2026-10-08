import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import type { usePlanoEditor } from './usePlanoEditor';

export function TopoModelo<C>({ editor }: { editor: ReturnType<typeof usePlanoEditor<C>> }) {
  const e = editor.estado;
  if (!e) return null;
  return <Cartao titulo="Modelo reutilizável">
    <Campo rotulo="Nome do modelo" valor={e.titulo} aoMudar={(titulo) => editor.alterar(() => ({ titulo }))} maxLength={120} />
    <Texto variante="suave">As alterações ficam neste modelo. As cópias já aplicadas aos alunos permanecem iguais.</Texto>
    <Texto>{({ salvo: 'Salvo', pendente: 'Alterações pendentes', salvando: 'Salvando…', erro: 'Não foi possível salvar. Tente novamente.', conflito: 'Este modelo mudou em outra tela. Recarregue antes de editar.', dataInvalida: 'Confira os campos.' })[editor.situacao]}</Texto>
    {editor.situacao === 'conflito' ? <Botao rotulo="Recarregar modelo" aoTocar={editor.recarregar} /> : <Botao rotulo="Salvar modelo" aoTocar={() => void editor.salvar()} carregando={editor.situacao === 'salvando'} desabilitado={!e.titulo.trim()} />}
  </Cartao>;
}
