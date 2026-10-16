package br.com.treinos.api.security;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;

import java.util.regex.Pattern;

/**
 * O nome do papel da API (PLATAFORMA_PAPEL_APP) entra como texto dentro de SQL (callback do Flyway e concessões do módulo
 * de autenticação). Antes de qualquer migração rodar, só é aceito identificador simples; vazio continua valendo (um
 * usuário só: testes e dev). Valor fora do padrão derruba a subida sem repetir o conteúdo.
 */
public class ValidaPapelDoApp implements EnvironmentPostProcessor {

    static final Pattern IDENTIFICADOR = Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]*$");

    static final String[] PROPRIEDADES = {"spring.flyway.placeholders.papelApp", "plataforma.auth.migracao.papel-app"};

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment ambiente, SpringApplication aplicacao) {
        for (String propriedade : PROPRIEDADES) {
            String valor = ambiente.getProperty(propriedade);
            if (valor != null && !valor.isEmpty() && !IDENTIFICADOR.matcher(valor).matches()) {
                throw new IllegalStateException("PLATAFORMA_PAPEL_APP inválida: use só letras, números e _, começando por letra ou _ (" + propriedade + ").");
            }
        }
    }
}
