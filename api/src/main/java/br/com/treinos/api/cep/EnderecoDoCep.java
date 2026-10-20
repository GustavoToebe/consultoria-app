package br.com.treinos.api.cep;

/** O que a consulta de CEP devolve: só o endereço público do CEP (número e complemento são de quem digita). */
public record EnderecoDoCep(String logradouro, String bairro, String cidade, String uf) {
}
