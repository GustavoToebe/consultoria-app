package br.com.treinos.api.conta;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Direitos da consultoria como a Central os descreve (contrato, seções 4 e 7): plano, situação e limites. Quem barra
 * é o {@link PlanoDaConsultoria} (só com {@code TREINOS_PLANO_APLICAR}); a Minha conta e o Consumo só leem. Na integração a
 * sincronização grava esta linha.
 */
public record DireitosLocais(UUID consultoriaId, UUID contratacaoId, long versao, String situacao,
                             boolean acessoLiberado, String motivoBloqueio, LocalDate vigenteAte, String planoCodigo,
                             String planoNome, Map<String, Long> limites, List<String> funcionalidades,
                             Instant confirmadoEm) {
}
