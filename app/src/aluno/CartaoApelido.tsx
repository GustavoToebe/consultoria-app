import { useState } from 'react';

import { ErroApi } from '../api/cliente';
import { definirMeuApelido } from '../api/comunidade';
import { meusDados } from '../api/rotas';
import { apelidoParaEnviar, erroDoApelido } from '../dominio/comunidade';
import { useAluno } from '../offline/AlunoProvider';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { codigoApi, separarErros, textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { useCarregar } from '../ui/useCarregar';

/**
 * Apelido da Comunidade, na Conta do aluno logo depois de "Meus dados" (cartão próprio: o apelido tem rota própria,
 * `PUT /aluno/comunidade/apelido`, e não entra no salvar com versão dos dados cadastrais). Lê o apelido atual em
 * `GET /aluno/meus-dados`. Só com internet: sem conexão o cartão some e nada fica no aparelho. A regra local
 * (`dominio/comunidade.erroDoApelido`) mostra o erro antes; o 422 da API vem como reserva, no mesmo campo.
 */
export function CartaoApelido() {
  const { online } = useAluno();
  const { avisar } = useAviso();
  const carga = useCarregar(online ? 'aluno-apelido' : null, () => meusDados());
  // `null` = o campo mostra o salvo; texto = a pessoa já digitou.
  const [texto, setTexto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<'salvar' | 'remover' | null>(null);
  const [erroDaApi, setErroDaApi] = useState<string | null>(null);

  if (!online) return null;
  if (carga.erro instanceof ErroApi && carga.erro.semConexao) return null;
  if (!carga.dados) {
    return (
      <Cartao titulo="Comunidade">
        {carga.erro ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : <Esqueleto cartoes={1} texto="Carregando seu apelido" />}
      </Cartao>
    );
  }
  const dados = carga.dados;
  const salvo = dados.apelido ?? null;
  const valor = texto ?? salvo ?? '';
  const novo = apelidoParaEnviar(valor);
  const erroLocal = erroDoApelido(valor);
  const mudou = novo !== salvo;

  const enviar = (apelido: string | null, acao: 'salvar' | 'remover') => {
    setSalvando(acao);
    setErroDaApi(null);
    definirMeuApelido(apelido).then(
      () => {
        setSalvando(null);
        setTexto(null);
        carga.definir({ ...dados, apelido });
        avisar(apelido ? 'Apelido salvo.' : 'Apelido removido.', 'sucesso');
      },
      (erro: unknown) => {
        setSalvando(null);
        if (codigoApi(erro) === 'ALUNO_ANONIMIZADO') {
          setTexto(null);
          carga.recarregar();
          avisar(textoDoErro(erro), 'neutro');
          return;
        }
        const { campos, geral } = separarErros(erro, ['apelido']);
        setErroDaApi(campos.apelido ?? null);
        if (geral) avisar(geral, 'perigo');
      },
    );
  };

  return (
    <Cartao titulo="Comunidade">
      <Campo rotulo="Apelido (opcional)" ajuda="Aparece ao lado do seu nome na Comunidade." valor={valor}
        aoMudar={(t) => { setTexto(t); setErroDaApi(null); }} erro={erroLocal ?? erroDaApi}
        autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} maxLength={40} editable={!salvando} />
      <LinhaDeAcoes alinhar="fim">
        {salvo ? (
          <Botao rotulo="Remover apelido" tipo="secundario" carregando={salvando === 'remover'} desabilitado={!!salvando}
            motivo="Salvando o apelido" aoTocar={() => enviar(null, 'remover')} />
        ) : null}
        <Botao rotulo="Salvar apelido" carregando={salvando === 'salvar'} desabilitado={!mudou || !!erroLocal || !!salvando}
          motivo={salvando ? 'Salvando o apelido' : erroLocal ? 'Corrija o apelido.' : 'Nada foi alterado ainda.'}
          aoTocar={() => enviar(novo, 'salvar')} />
      </LinhaDeAcoes>
    </Cartao>
  );
}
