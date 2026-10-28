/** Erro com texto para o aluno (o resto vira "Não foi possível gerar a imagem agora."). */
export class ErroDoCartao extends Error {}

export function textoDoErroDoCartao(erro: unknown): string {
  return erro instanceof ErroDoCartao ? erro.message : 'Não foi possível gerar a imagem agora.';
}
