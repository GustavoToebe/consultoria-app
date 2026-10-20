import { useState } from 'react';

import { Botao } from '../ui/Botao';
import { LIMITE_DESCRICAO_DO_MODELO } from '../dominio/modelos';
import { Campo } from '../ui/Campo';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';

/** Nome e descrição para guardar algo do editor como receita da consultoria. */
export function FolhaSalvarReceita({
  titulo,
  explicacao,
  aoSalvar,
  aoFechar,
}: {
  titulo: string;
  explicacao?: string;
  aoSalvar: (nome: string, descricao: string | null) => Promise<void>;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const salvar = () => {
    setSalvando(true);
    setErro(null);
    aoSalvar(nome.trim(), descricao.trim() || null).catch((e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };
  return (
    <Folha
      visivel
      titulo={titulo}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar modelo" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim()} />
        </>
      }>
      <Texto variante="suave">{explicacao}</Texto>
      <Campo rotulo="Nome do modelo" valor={nome} aoMudar={setNome} maxLength={120} />
      <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={2} maxLength={LIMITE_DESCRICAO_DO_MODELO} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}
