import type { alterarMarca } from '../../api/rotas';
import type { ConsultoriaResponse, TextosDasFases } from '../../api/tipos';

/** Corpo do `PUT /consultoria/marca`: um recurso só, gravado por três telas (Marca, Contato e Padrões do acompanhamento). */
export type CorpoDaConsultoria = Parameters<typeof alterarMarca>[0];

const textoOuNulo = (s: string | null | undefined) => s?.trim() || null;

/** As quatro fases com o texto aparado, ou nulo quando vazio (o mesmo formato que a tela sempre mandou). */
export function textosDasFases(t: Partial<Record<keyof TextosDasFases, string | null>> | null | undefined): TextosDasFases {
  return { menstrual: textoOuNulo(t?.menstrual), folicular: textoOuNulo(t?.folicular), ovulatoria: textoOuNulo(t?.ovulatoria), lutea: textoOuNulo(t?.lutea) };
}

/**
 * O corpo inteiro com os valores GRAVADOS da consultoria lida. Cada tela sobrepõe só os campos dela: os demais vão como
 * estão, senão salvar a cor apagaria o WhatsApp (em branco apaga na API) ou o prazo da atualização (nulo = sem padrão).
 * `versao` é a lida: se outra tela gravou antes, o 409 `CONFLITO_EDICAO` recarrega. As redes ficam de fora (ausente mantém)
 * e só a tela do Contato as manda; a meta também, quando a API não a devolveu.
 */
export function corpoDaConsultoria(c: ConsultoriaResponse): CorpoDaConsultoria {
  return {
    nome: c.marca.nome,
    corPrimaria: c.marca.corPrimaria,
    fonteTitulo: c.marca.fonteTitulo,
    temaPadrao: c.marca.temaPadrao,
    versao: c.versao,
    diasAtualizacaoPadrao: c.diasAtualizacaoPadrao ?? null,
    textosFasesCiclo: textosDasFases(c.textosFasesCiclo),
    ...(c.metaDoPeso ? { metaDoPeso: c.metaDoPeso } : null),
    whatsapp: c.whatsapp ?? '',
    emailRemetenteNome: c.emailRemetenteNome ?? '',
    emailResponderPara: c.emailResponderPara ?? '',
  };
}
