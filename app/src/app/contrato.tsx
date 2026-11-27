import { TelaContratoPublico } from '../contratos/publica/TelaContratoPublico';

/** Pública, sem login (como o convite): `/contrato#codigo=...`, o link que a equipe envia ao responsável do aluno. */
export default function Contrato() {
  return <TelaContratoPublico />;
}
