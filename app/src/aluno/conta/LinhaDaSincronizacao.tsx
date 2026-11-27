import { RefreshCw } from 'lucide-react-native';

import { dataParaTela } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { Botao } from '../../ui/Botao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { SeloSincronizacao } from '../SeloSincronizacao';
import { LinhaDaConta } from './SecaoDaConta';

/**
 * Sincronização na seção App (23/11): o selo do estado e "Sincronizar agora" embaixo do texto; o que estava no cartão de antes
 * (quantos aguardam, a mensagem do envio e as falhas) vira texto de apoio. "Sincronizar agora" é secundário; o primário só
 * aparece quando há falha ("Tentar de novo").
 */
export function LinhaDaSincronizacao() {
  const { pendentes, falhas, falhasDeMobilidade, falhasDeConclusao, falhasDeAgua, envio, mensagemEnvio, sincronizarAgora, tentarDeNovo } = useAluno();
  const totalDeFalhas = falhas.length + falhasDeMobilidade.length + falhasDeConclusao.length + falhasDeAgua.length;
  const resumo = pendentes + totalDeFalhas
    ? `${pendentes} aguardando envio${totalDeFalhas ? `, ${totalDeFalhas} com falha` : ''}.`
    : 'Tudo o que você registrou já está com o seu treinador.';
  return (
    <LinhaDaConta titulo="Sincronização" Icone={RefreshCw}>
      <SeloSincronizacao />
      <Texto variante="suave">{resumo} Sem internet, os registros ficam no aparelho e vão depois.</Texto>
      {mensagemEnvio ? <Texto variante="suave">{mensagemEnvio}</Texto> : null}
      {falhas.map((f) => <Texto key={f.id} variante="suave">{dataParaTela(f.data)}: {f.motivo}</Texto>)}
      {falhasDeMobilidade.map((f) => <Texto key={f.id} variante="suave">Mobilidade, {dataParaTela(f.data)}: {f.motivo}</Texto>)}
      {falhasDeAgua.map((f) => <Texto key={f.id} variante="suave">Água, {dataParaTela(f.data)}: {f.motivo}</Texto>)}
      {falhasDeConclusao.map((f) => <Texto key={f.id} variante="suave">Conclusão do treino, {dataParaTela(f.data)}: {f.motivo}</Texto>)}
      {/* Embaixo do texto (27/11): à direita, na coluna estreita da web, o texto quebrava em 4 ou 5 linhas. */}
      <LinhaDeAcoes>
        <Botao rotulo="Sincronizar agora" tipo="secundario" carregando={envio === 'enviando'} aoTocar={() => void sincronizarAgora()} />
        {totalDeFalhas ? <Botao rotulo="Tentar de novo" aoTocar={() => void tentarDeNovo()} /> : null}
      </LinhaDeAcoes>
    </LinhaDaConta>
  );
}
