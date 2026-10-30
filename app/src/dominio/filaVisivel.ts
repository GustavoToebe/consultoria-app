import type { RegistroAguaLocal, RegistroLocal, RegistroMobilidadeLocal, RegistroSessaoConcluidaLocal } from '../offline/repositorioLocal';

/**
 * O que o aluno enxerga da fila de envio (selo, Conta, aviso de "Sair" e "Excluir conta"). Com "Concluir treino"
 * desligado as conclusões continuam no aparelho e na fila, mas ficam fora da conta: não somam em `pendentes`, e
 * `falhasDeConclusao` e `sessoesConcluidasNoAparelho` saem vazios (assim `treinosNaoEnviados` também não as conta).
 */
export function filaVisivel(
  registros: readonly Pick<RegistroLocal, 'situacao'>[],
  mobilidade: readonly Pick<RegistroMobilidadeLocal, 'situacao'>[],
  conclusoes: readonly RegistroSessaoConcluidaLocal[],
  retornoHabilitado: boolean,
  /** A água do dia na fila (sempre conta: não depende de chave). */
  agua: readonly Pick<RegistroAguaLocal, 'situacao'>[] = [],
): {
  pendentes: number;
  falhasDeConclusao: RegistroSessaoConcluidaLocal[];
  sessoesConcluidasNoAparelho: RegistroSessaoConcluidaLocal[];
} {
  const visiveis = retornoHabilitado ? [...conclusoes] : [];
  return {
    pendentes:
      registros.filter((r) => r.situacao === 'LOCAL').length +
      mobilidade.filter((r) => r.situacao === 'LOCAL').length +
      visiveis.filter((r) => r.situacao === 'LOCAL').length +
      agua.filter((r) => r.situacao === 'LOCAL').length,
    falhasDeConclusao: visiveis.filter((r) => r.situacao === 'FALHOU'),
    sessoesConcluidasNoAparelho: visiveis,
  };
}
