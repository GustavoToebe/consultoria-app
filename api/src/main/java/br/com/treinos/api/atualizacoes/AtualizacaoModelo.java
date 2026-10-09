package br.com.treinos.api.atualizacoes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;

/** Modelo global, sem dado de aluno e apenas de leitura; versões antigas permanecem disponíveis. */
@Entity @Table(name = "atualizacao_modelo")
public class AtualizacaoModelo {
    @Id private UUID id;
    private int versao;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false) private String conteudo;
    protected AtualizacaoModelo() { }
    public int getVersao() { return versao; }
    public String getConteudo() { return conteudo; }
}
