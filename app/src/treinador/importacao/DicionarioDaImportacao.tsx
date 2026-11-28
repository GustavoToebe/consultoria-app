import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';

import { dataParaTela } from '../../dominio/formatos';
import { rotuloDoTipoDoApelido, textoDoErroDaImportacao } from '../../dominio/importacaoAssistida';
import { listarApelidos, removerApelido, type ApelidoDto } from '../../servicos/importacaoAssistida';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Dicionário da consultoria (2.8): os termos que a importação assistida aprendeu com o "Lembrar nas próximas importações".
 * Só lista e remove; remover pede confirmação e a próxima importação volta a perguntar o termo. Ler pede `ALUNO_LER` e
 * remover `ALUNO_ALTERAR`, como a API.
 * shortcut: lista inteira sem página (a API devolve tudo); trocar quando o dicionário de uma consultoria passar de ~500 termos.
 */
export function DicionarioDaImportacao() {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const lista = useCarregar('apelidos', () => listarApelidos());
  const [remover, setRemover] = useState<ApelidoDto | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const podeRemover = pode('ALUNO_ALTERAR');

  const confirmarRemocao = async () => {
    const alvo = remover;
    setRemover(null);
    if (!alvo) return;
    setRemovendo(alvo.id);
    setErro(null);
    try {
      await removerApelido(alvo.id);
      lista.definir((lista.dados ?? []).filter((a) => a.id !== alvo.id));
      avisar(`“${alvo.termoOriginal}” saiu do dicionário.`, 'sucesso');
    } catch (e: unknown) {
      setErro(e);
    } finally {
      setRemovendo(null);
    }
  };

  if (lista.erro) return <MensagemErro texto={textoDoErroDaImportacao(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} />;
  if (!lista.dados) return <Esqueleto texto="Carregando o dicionário" />;
  if (lista.dados.length === 0) {
    return (
      <Vazio
        titulo="Nenhum termo no dicionário"
        texto="Quando você corrige um termo na importação assistida com “Lembrar nas próximas importações” ligado, ele aparece aqui."
      />
    );
  }
  return (
    <>
      <Cartao titulo="Termos aprendidos" descricao={`${lista.dados.length} ${lista.dados.length === 1 ? 'termo' : 'termos'}.`}>
        {erro ? <MensagemErro texto={textoDoErroDaImportacao(erro)} erro={erro} /> : null}
        <Tabela
          rotulo="Termos do dicionário"
          larguraMinima={640}
          linhas={lista.dados}
          chave={(a) => a.id}
          colunas={[
            { chave: 'termo', titulo: 'No documento', flex: 1, minimo: 120, principal: true, render: (a) => <Texto>{a.termoOriginal}</Texto> },
            { chave: 'valor', titulo: 'Vira', flex: 1, minimo: 120, render: (a) => <Texto>{a.valorMapeado}</Texto> },
            { chave: 'tipo', titulo: 'Tipo', largura: 120, render: (a) => <Texto variante="suave">{rotuloDoTipoDoApelido(a.tipo)}</Texto> },
            { chave: 'criado', titulo: 'Desde', largura: 120, render: (a) => <Texto variante="suave" numerico>{dataParaTela(a.criadoEm)}</Texto> },
            ...(podeRemover ? [{
              chave: 'acao', titulo: 'Ação', largura: 140, acao: true, alinhar: 'direita' as const,
              render: (a: ApelidoDto) => (
                <Botao rotulo="Remover" rotuloAcessivel={`Remover “${a.termoOriginal}” do dicionário`} tipo="perigoTexto" Icone={Trash2}
                  carregando={removendo === a.id} desabilitado={!!removendo && removendo !== a.id} motivo="Removendo outro termo…"
                  aoTocar={() => setRemover(a)} />
              ),
            }] : []),
          ]}
        />
      </Cartao>
      <PainelConfirmacao
        visivel={!!remover}
        titulo={`Remover “${remover?.termoOriginal ?? ''}” do dicionário?`}
        mensagem="A próxima importação volta a perguntar este termo. O que já foi gravado não muda."
        rotuloConfirmar="Remover do dicionário"
        perigo
        aoConfirmar={() => void confirmarRemocao()}
        aoCancelar={() => setRemover(null)}
      />
    </>
  );
}
